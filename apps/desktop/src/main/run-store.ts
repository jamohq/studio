import { GrpcClients } from './grpc-client';
import { ulid } from 'ulid';
import type { Run } from '../shared/types';

const RUNS_DIR = '.jamo/runs';

function grpcReadFile(clients: GrpcClients, wsId: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    clients.workspace.readFile({ workspaceId: wsId, relativePath: path }, (err: any, res: any) => {
      if (err) return reject(err);
      const content = Buffer.isBuffer(res.content) ? res.content.toString('utf-8') : res.content;
      resolve(content);
    });
  });
}

function grpcWriteFile(clients: GrpcClients, wsId: string, path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    clients.workspace.writeFile(
      { workspaceId: wsId, relativePath: path, content: Buffer.from(content, 'utf-8') },
      (err: any) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function grpcListDirectory(clients: GrpcClients, wsId: string, path: string): Promise<Array<{ name: string; isDir: boolean }>> {
  return new Promise((resolve, reject) => {
    clients.workspace.listDirectory({ workspaceId: wsId, relativePath: path }, (err: any, res: any) => {
      if (err) return reject(err);
      resolve((res.entries || []).map((e: any) => ({ name: e.name, isDir: e.isDir })));
    });
  });
}

function grpcCreateDirectory(clients: GrpcClients, wsId: string, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    clients.workspace.createDirectory({ workspaceId: wsId, relativePath: path }, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function ensureRunsDir(clients: GrpcClients, wsId: string): Promise<void> {
  try {
    await grpcListDirectory(clients, wsId, RUNS_DIR);
  } catch {
    // Create .jamo and .jamo/runs
    try { await grpcCreateDirectory(clients, wsId, '.jamo'); } catch { /* may exist */ }
    await grpcCreateDirectory(clients, wsId, RUNS_DIR);
  }
}

export async function createRun(clients: GrpcClients, wsId: string, data: Omit<Run, 'id' | 'createdAt' | 'completedAt'>): Promise<Run> {
  await ensureRunsDir(clients, wsId);

  const run: Run = {
    ...data,
    id: ulid(),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const filePath = `${RUNS_DIR}/${run.id}.json`;
  await grpcWriteFile(clients, wsId, filePath, JSON.stringify(run, null, 2));
  return run;
}

export async function updateRun(clients: GrpcClients, wsId: string, runId: string, updates: Partial<Run>): Promise<Run> {
  const filePath = `${RUNS_DIR}/${runId}.json`;
  const raw = await grpcReadFile(clients, wsId, filePath);
  const run: Run = { ...JSON.parse(raw), ...updates };
  await grpcWriteFile(clients, wsId, filePath, JSON.stringify(run, null, 2));
  return run;
}

export async function listRuns(clients: GrpcClients, wsId: string, limit = 50): Promise<Run[]> {
  let entries: Array<{ name: string; isDir: boolean }>;
  try {
    entries = await grpcListDirectory(clients, wsId, RUNS_DIR);
  } catch {
    return [];
  }

  const jsonFiles = entries
    .filter((e) => !e.isDir && e.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name)) // ULID sorts reverse-chronologically
    .slice(0, limit);

  const runs: Run[] = [];
  for (const file of jsonFiles) {
    try {
      const raw = await grpcReadFile(clients, wsId, `${RUNS_DIR}/${file.name}`);
      runs.push(JSON.parse(raw));
    } catch {
      // Skip corrupt files
    }
  }
  return runs;
}

export async function getRun(clients: GrpcClients, wsId: string, runId: string): Promise<Run> {
  const filePath = `${RUNS_DIR}/${runId}.json`;
  const raw = await grpcReadFile(clients, wsId, filePath);
  return JSON.parse(raw);
}
