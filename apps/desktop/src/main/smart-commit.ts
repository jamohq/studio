import { GrpcClients } from './grpc-client';
import * as fs from 'fs';
import * as pathMod from 'path';
import type { CommitTag, CommitSource, CommitMetadata, ChangedFile, GitCommitResponse } from '../shared/types';

/** Files/dirs to exclude from change classification. */
const INFRA_PATTERNS = [
  '.jamo/runs/',
  '.jamo/.prompt',
  '.jamo/.run.sh',
  '.jamo/.exit_status',
  '.jamo/.output',
];

function isInfraFile(path: string): boolean {
  return INFRA_PATTERNS.some((p) => path === p || path.startsWith(p));
}

export function classifyChanges(files: ChangedFile[]): 'code' | 'design' | 'mixed' {
  let hasDesign = false;
  let hasCode = false;

  for (const f of files) {
    if (isInfraFile(f.path)) continue;
    if (f.path.startsWith('.jamo/creator/')) {
      hasDesign = true;
    } else if (!f.path.startsWith('.jamo/')) {
      hasCode = true;
    }
  }

  if (hasDesign && hasCode) return 'mixed';
  if (hasDesign) return 'design';
  return 'code';
}

export function parseCommitTag(message: string): CommitMetadata | null {
  const tagMatch = message.match(/^jamo:tag=(.+)$/m);
  if (!tagMatch) return null;

  const tag = tagMatch[1] as CommitTag;
  const sourceMatch = message.match(/^jamo:source=(.+)$/m);
  const runIdMatch = message.match(/^jamo:runId=(.+)$/m);

  return {
    tag,
    source: (sourceMatch?.[1] as CommitSource) || 'manual',
    runId: runIdMatch?.[1] || undefined,
  };
}

function formatCommitMessage(tag: CommitTag, description: string, source: CommitSource, runId?: string): string {
  let msg = `[${tag}] ${description}\n\njamo:tag=${tag}\njamo:source=${source}`;
  if (runId) {
    msg += `\njamo:runId=${runId}`;
  }
  return msg;
}

function grpcGitStatus(clients: GrpcClients, wsId: string): Promise<{ files: ChangedFile[]; isClean: boolean }> {
  return new Promise((resolve, reject) => {
    clients.git.status({ workspaceId: wsId }, (err: any, res: any) => {
      if (err) return reject(err);
      const files = (res.files || []).map((f: any) => ({ path: f.path, status: f.status }));
      resolve({ files, isClean: res.isClean });
    });
  });
}

function grpcGitCommit(clients: GrpcClients, wsId: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    clients.git.commit({ workspaceId: wsId, message }, (err: any, res: any) => {
      if (err) return reject(err);
      resolve(res.commitHash);
    });
  });
}

function grpcGitLog(clients: GrpcClients, wsId: string, limit: number): Promise<Array<{ hash: string; shortHash: string; message: string; timestamp: string }>> {
  return new Promise((resolve, reject) => {
    clients.git.log({ workspaceId: wsId, limit }, (err: any, res: any) => {
      if (err) return reject(err);
      resolve((res.entries || []).map((e: any) => ({
        hash: e.hash,
        shortHash: e.shortHash,
        message: e.message,
        timestamp: e.timestamp,
      })));
    });
  });
}

// Simple mutex to prevent concurrent auto-commits
let commitLock = false;
const commitQueue: Array<() => void> = [];

function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!commitLock) {
      commitLock = true;
      resolve();
    } else {
      commitQueue.push(resolve);
    }
  });
}

function releaseLock(): void {
  const next = commitQueue.shift();
  if (next) {
    next();
  } else {
    commitLock = false;
  }
}

const GITIGNORE_ENTRIES = [
  '.jamo/runs/',
  '.jamo/.prompt',
  '.jamo/.run.sh',
  '.jamo/.exit_status',
  '.jamo/.output',
];

/** Ensure .gitignore has entries for jamo infra files. */
function ensureGitignoreEntries(wsPath: string): void {
  const gitignorePath = pathMod.join(wsPath, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch { /* file may not exist */ }

  const lines = content.split('\n');
  const missing = GITIGNORE_ENTRIES.filter((entry) => !lines.some((l) => l.trim() === entry));
  if (missing.length === 0) return;

  const additions = '\n# Jamo Studio infra (auto-added)\n' + missing.join('\n') + '\n';
  fs.writeFileSync(gitignorePath, content + (content.endsWith('\n') ? '' : '\n') + additions);
}

export async function autoCommit(
  clients: GrpcClients,
  wsId: string,
  opts: { tag?: CommitTag; description: string; source: CommitSource; runId?: string },
  wsPath?: string,
): Promise<GitCommitResponse | null> {
  await acquireLock();
  try {
    // Ensure gitignore entries exist before checking status
    if (wsPath) { try { ensureGitignoreEntries(wsPath); } catch { /* best effort */ } }

    // Check if there are actual changes
    const status = await grpcGitStatus(clients, wsId);
    if (status.isClean) return null;

    // Filter out infra files to decide if there's anything worth committing
    const meaningful = status.files.filter((f) => !isInfraFile(f.path));
    if (meaningful.length === 0) return null;

    // Classify changes and pick appropriate tag
    // chat-log is always kept as-is; code/design tags are auto-classified
    const classification = classifyChanges(status.files);
    let tag: CommitTag;
    if (opts.tag === 'chat-log') {
      tag = 'chat-log';
    } else {
      const isManual = opts.source === 'manual';
      tag = classification === 'design'
        ? (isManual ? 'manual-design' : 'auto-design')
        : (isManual ? 'manual-code' : 'auto-code');
    }

    const message = formatCommitMessage(tag, opts.description, opts.source, opts.runId);
    const commitHash = await grpcGitCommit(clients, wsId, message);
    return { commitHash };
  } finally {
    releaseLock();
  }
}

export async function getCommitHistory(
  clients: GrpcClients,
  wsId: string,
  limit = 50,
): Promise<Array<{ hash: string; shortHash: string; message: string; timestamp: string; meta?: CommitMetadata; filesChanged?: number }>> {
  const entries = await grpcGitLog(clients, wsId, limit);
  return entries.map((e) => ({
    ...e,
    meta: parseCommitTag(e.message) || undefined,
  }));
}

export function isTimestampOnlyChange(diff: string): boolean {
  // Check if the only changes in a diff are updatedAt timestamp fields
  const lines = diff.split('\n');
  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@')) continue;
    // Skip empty context lines
    if (!line.startsWith('+') && !line.startsWith('-')) continue;

    const content = line.slice(1).trim();
    if (!content) continue;

    // Allow changes that only touch "updatedAt" fields
    if (content.includes('"updatedAt"')) continue;
    // Allow trailing commas that shift
    if (content === ',' || content === '') continue;

    // Any other changed line means it's not timestamp-only
    return false;
  }
  return true;
}
