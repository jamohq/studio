import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { GrpcClients } from './grpc-client';
import { IPC } from '../shared/types';
import type { CommitTag, CommitSource, ChatContext, ChatMessage, ChatStreamChunk } from '../shared/types';
import { checkEnvironment } from './env-check';
import { runClaude, ClaudeRunResult } from './claude-code-runner';
import * as runStore from './run-store';
import { autoCommit, getCommitHistory } from './smart-commit';

const activeTerminalStreams = new Map<string, any>();

// Track workspace ID → filesystem path for providers that need cwd
const workspacePaths = new Map<string, string>();

// Track active claude processes for cancellation
const activeClaudeRuns = new Map<string, ClaudeRunResult>();

export function getWorkspacePath(wsId: string): string | undefined {
  return workspacePaths.get(wsId);
}

// Deferred gRPC clients — resolves when the engine is ready.
// Uses a re-assignable promise so engine restarts provide fresh clients.
let currentClients: GrpcClients | null = null;
let clientsResolve: (clients: GrpcClients) => void;
let clientsPromise = new Promise<GrpcClients>((resolve) => {
  clientsResolve = resolve;
});

/** Call this when the engine is started (or restarted) and clients are created. */
export function setGrpcClients(clients: GrpcClients): void {
  currentClients = clients;
  // Resolve the pending promise for any waiters.
  clientsResolve(clients);
  // Create a fresh promise for the next restart cycle.
  clientsPromise = new Promise<GrpcClients>((resolve) => {
    clientsResolve = resolve;
  });
}

/** Await this in any handler that needs gRPC. Throws if engine isn't ready within 15s. */
async function getClients(): Promise<GrpcClients> {
  // Fast path: clients already available.
  if (currentClients) return currentClients;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Engine not ready — please wait and try again')), 15000)
  );
  return Promise.race([clientsPromise, timeout]);
}

function sendChunk(chunk: ChatStreamChunk): void {
  try {
    getWindow().webContents.send(IPC.CHAT_STREAM, chunk);
  } catch { /* window may have closed */ }
}

function buildSystemPrompt(context: ChatContext): string {
  let prompt = `You are an AI coding assistant in Jamo Studio. Help users by reading, writing, and modifying files in their workspace.

Guidelines:
- Read relevant files before making changes to understand the existing code
- Keep changes focused and minimal — only change what's needed
- Follow existing code style and conventions in the project
- Explain what you're doing and why`;

  if (context.openFile) {
    prompt += `\n\nThe user currently has this file open: ${context.openFile}`;
  }
  if (context.openFileContent) {
    prompt += `\n\nCurrent file content:\n\`\`\`\n${context.openFileContent}\n\`\`\``;
  }
  if (context.projectSections) {
    const sectionEntries = Object.entries(context.projectSections).filter(([_, v]) => v);
    if (sectionEntries.length > 0) {
      prompt += '\n\nProject context:';
      for (const [name, content] of sectionEntries) {
        prompt += `\n\n### ${name}\n${content}`;
      }
    }
  }

  return prompt;
}

let ipcRegistered = false;
let activeWindow: BrowserWindow | null = null;
const activeEventStreams: any[] = [];

/** Clean up all active streams and running processes. Call on app quit. */
export function cleanupIpcResources(): void {
  // Close terminal gRPC streams.
  for (const [, stream] of activeTerminalStreams) {
    try { stream.end(); } catch { /* */ }
  }
  activeTerminalStreams.clear();

  // Close event streams.
  for (const stream of activeEventStreams) {
    try { stream.cancel(); } catch { /* */ }
  }
  activeEventStreams.length = 0;

  // Kill any running Claude processes.
  for (const [, run] of activeClaudeRuns) {
    try { run.kill(); } catch { /* */ }
  }
  activeClaudeRuns.clear();
}

/** Update the active window used for push events (terminal data, chat stream, events). */
export function setActiveWindow(win: BrowserWindow): void {
  activeWindow = win;
  win.on('closed', () => {
    if (activeWindow === win) activeWindow = null;
  });
}

function getWindow(): BrowserWindow {
  if (!activeWindow || activeWindow.isDestroyed()) {
    throw new Error('No active window');
  }
  return activeWindow;
}

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // Prevent double-registration when multiple windows are created.
  // IPC handlers are process-global — registering twice throws.
  if (ipcRegistered) {
    setActiveWindow(mainWindow);
    return;
  }
  ipcRegistered = true;
  setActiveWindow(mainWindow);
  // -------------------------------------------------------------------------
  // Unary RPCs

  ipcMain.handle(IPC.PING, async () => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.health.ping({}, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ status: res.status, version: res.version });
      });
    });
  });

  ipcMain.handle(IPC.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.OPEN_WORKSPACE, async (_event, path: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.openWorkspace({ path }, (err: any, res: any) => {
        if (err) return reject(err);
        workspacePaths.set(res.workspaceId, res.path);
        resolve({ workspaceId: res.workspaceId, path: res.path });
      });
    });
  });

  ipcMain.handle(IPC.READ_FILE, async (_event, wsId: string, relativePath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.readFile({ workspaceId: wsId, relativePath }, (err: any, res: any) => {
        if (err) return reject(err);
        const content = Buffer.isBuffer(res.content)
          ? res.content.toString('utf-8')
          : res.content;
        resolve({ content });
      });
    });
  });

  ipcMain.handle(IPC.WRITE_FILE, async (_event, wsId: string, relativePath: string, content: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.writeFile(
        { workspaceId: wsId, relativePath, content: Buffer.from(content, 'utf-8') },
        (err: any) => {
          if (err) return reject(err);
          resolve(undefined);
        }
      );
    });
  });

  ipcMain.handle(IPC.WRITE_FILE_BINARY, async (_event, wsId: string, relativePath: string, base64Content: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.writeFile(
        { workspaceId: wsId, relativePath, content: Buffer.from(base64Content, 'base64') },
        (err: any) => {
          if (err) return reject(err);
          resolve(undefined);
        }
      );
    });
  });

  ipcMain.handle(IPC.READ_FILE_BINARY, async (_event, wsId: string, relativePath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.readFile({ workspaceId: wsId, relativePath }, (err: any, res: any) => {
        if (err) return reject(err);
        const content = Buffer.isBuffer(res.content)
          ? res.content.toString('base64')
          : Buffer.from(res.content).toString('base64');
        resolve(content);
      });
    });
  });

  ipcMain.handle(IPC.LIST_DIRECTORY, async (_event, wsId: string, relativePath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.listDirectory({ workspaceId: wsId, relativePath }, (err: any, res: any) => {
        if (err) return reject(err);
        const entries = (res.entries || []).map((e: any) => ({
          name: e.name,
          isDir: e.isDir,
          size: Number(e.size || 0),
        }));
        resolve({ entries });
      });
    });
  });

  ipcMain.handle(IPC.MOVE_FILE, async (_event, wsId: string, oldPath: string, newPath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.moveFile({ workspaceId: wsId, oldPath, newPath }, (err: any) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  });

  ipcMain.handle(IPC.CREATE_DIRECTORY, async (_event, wsId: string, relativePath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.createDirectory({ workspaceId: wsId, relativePath }, (err: any) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  });

  ipcMain.handle(IPC.DELETE_FILE, async (_event, wsId: string, relativePath: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.workspace.deleteFile({ workspaceId: wsId, relativePath }, (err: any) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Project creation helpers (local filesystem, no gRPC)

  ipcMain.handle(IPC.CHECK_DIR_EMPTY, async (_event, dirPath: string) => {
    // Validate: path must be within user's home directory.
    const resolved = path.resolve(dirPath);
    const home = require('os').homedir();
    if (!resolved.startsWith(home + path.sep) && resolved !== home) {
      throw new Error('Cannot check directory outside of home folder');
    }
    try {
      const entries = fs.readdirSync(resolved);
      return entries.length === 0;
    } catch {
      return true; // doesn't exist yet, treat as empty
    }
  });

  ipcMain.handle(IPC.CLEAR_DIR, async (_event, dirPath: string) => {
    // Validate: path must be absolute, within user's home directory, and normalized.
    // Use realpathSync to resolve symlinks before the containment check.
    const home = require('os').homedir();
    let resolved: string;
    try {
      resolved = fs.realpathSync(dirPath);
    } catch {
      // Path doesn't exist yet — resolve without symlink resolution.
      resolved = path.resolve(dirPath);
    }
    if (!resolved.startsWith(home + path.sep) || resolved === home) {
      throw new Error('Cannot clear directory outside of home folder');
    }
    const entries = fs.readdirSync(resolved);
    for (const entry of entries) {
      fs.rmSync(path.join(resolved, entry), { recursive: true, force: true });
    }
  });

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    // Only allow http(s) URLs to prevent opening arbitrary protocols (file://, smb://, etc.)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked URL with disallowed protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.CHECK_ENVIRONMENT, async () => {
    return checkEnvironment();
  });

  // -------------------------------------------------------------------------
  // Git RPCs

  ipcMain.handle(IPC.GIT_INIT, async (_event, wsId: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.git.init({ workspaceId: wsId }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ alreadyInitialized: res.alreadyInitialized });
      });
    });
  });

  ipcMain.handle(IPC.GIT_STATUS, async (_event, wsId: string) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) {
      // Fallback to gRPC if workspace path not yet tracked
      const clients = await getClients();
      return new Promise((resolve, reject) => {
        clients.git.status({ workspaceId: wsId }, (err: any, res: any) => {
          if (err) return reject(err);
          const files = (res.files || []).map((f: any) => ({
            path: f.path,
            status: f.status,
          }));
          resolve({ files, isClean: res.isClean });
        });
      });
    }

    return new Promise((resolve, reject) => {
      execFile('git', ['status', '--porcelain=v1'], { cwd: wsPath }, (err, stdout) => {
        if (err) return reject(err);
        const lines = stdout.trimEnd().split('\n').filter(Boolean);
        const files = lines.map((line) => {
          const x = line[0]; // index status
          const y = line[1]; // worktree status
          const filePath = line.slice(3).trim();
          // Handle renames: "R  old -> new"
          const parts = filePath.split(' -> ');
          const displayPath = parts[parts.length - 1];

          const statusMap: Record<string, string> = {
            M: 'modified', A: 'added', D: 'deleted', R: 'renamed', '?': 'untracked',
          };
          // Worktree status for display
          const status = statusMap[y !== ' ' && y !== '?' ? y : x] || 'modified';

          let indexStatus = '';
          if (x === '?' && y === '?') {
            indexStatus = ''; // untracked
          } else if (x !== ' ' && x !== '?' && (y === ' ' || y === '?')) {
            indexStatus = 'staged';
          } else if (x !== ' ' && x !== '?' && y !== ' ' && y !== '?') {
            indexStatus = 'partially-staged';
          }

          return { path: displayPath, status, indexStatus };
        });
        resolve({ files, isClean: files.length === 0 });
      });
    });
  });

  ipcMain.handle(IPC.GIT_DIFF, async (_event, wsId: string, filePath?: string) => {
    const clients = await getClients();
    try {
      const result: any = await new Promise((resolve, reject) => {
        clients.git.diff({ workspaceId: wsId, filePath: filePath || '' }, (err: any, res: any) => {
          if (err) return reject(err);
          resolve({ diff: res.diff });
        });
      });
      return result;
    } catch (grpcErr) {
      // Fallback for untracked files: git diff --no-index exits with code 1
      // when differences exist, which the Go engine treats as an error.
      if (filePath) {
        const wsPath = workspacePaths.get(wsId);
        if (wsPath) {
          const absFile = path.join(wsPath, filePath);
          return new Promise((resolve) => {
            execFile('git', ['diff', '--no-index', '/dev/null', absFile], { cwd: wsPath, maxBuffer: 5 * 1024 * 1024 }, (_err, stdout) => {
              // --no-index always exits 1 when files differ, so ignore _err
              if (stdout) {
                resolve({ diff: stdout });
              } else {
                resolve({ diff: '' });
              }
            });
          });
        }
      }
      throw grpcErr;
    }
  });

  ipcMain.handle(IPC.GIT_COMMIT, async (_event, wsId: string, message: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.git.commit({ workspaceId: wsId, message }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ commitHash: res.commitHash });
      });
    });
  });

  ipcMain.handle(IPC.GIT_LOG, async (_event, wsId: string, limit?: number) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.git.log({ workspaceId: wsId, limit: limit || 20 }, (err: any, res: any) => {
        if (err) return reject(err);
        const entries = (res.entries || []).map((e: any) => ({
          hash: e.hash,
          shortHash: e.shortHash,
          message: e.message,
          timestamp: e.timestamp,
        }));
        resolve({ entries });
      });
    });
  });

  ipcMain.handle(IPC.GIT_CHECKOUT, async (_event, wsId: string, paths: string[]) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.git.checkout({ workspaceId: wsId, paths: paths || [] }, (err: any) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Smart commit & history

  ipcMain.handle(IPC.SMART_COMMIT, async (_event, wsId: string, opts: { tag: CommitTag; description: string; source: CommitSource; runId?: string }) => {
    const clients = await getClients();
    return autoCommit(clients, wsId, opts, workspacePaths.get(wsId));
  });

  ipcMain.handle(IPC.GET_COMMIT_HISTORY, async (_event, wsId: string, limit?: number) => {
    const clients = await getClients();
    const entries = await getCommitHistory(clients, wsId, limit);
    return { entries };
  });

  ipcMain.handle(IPC.GIT_DIFF_COMMITS, async (_event, wsId: string, fromRef: string, toRef: string) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');

    return new Promise((resolve, reject) => {
      // Get name-status for file list
      execFile('git', ['diff', '--name-status', fromRef, toRef], { cwd: wsPath }, (err, nameStatus) => {
        if (err) return reject(err);

        const files = nameStatus.trim().split('\n').filter(Boolean).map((line) => {
          const [status, ...pathParts] = line.split('\t');
          const s = status.startsWith('M') ? 'modified' : status.startsWith('A') ? 'added' : status.startsWith('D') ? 'deleted' : status.startsWith('R') ? 'renamed' : 'modified';
          return { path: pathParts[pathParts.length - 1] || pathParts[0], status: s };
        });

        // Get full diff
        execFile('git', ['diff', fromRef, toRef], { cwd: wsPath, maxBuffer: 5 * 1024 * 1024 }, (err2, diff) => {
          if (err2) return reject(err2);
          resolve({ files, diff });
        });
      });
    });
  });

  ipcMain.handle(IPC.GIT_REVERT_TO, async (_event, wsId: string, commitHash: string) => {
    const clients = await getClients();
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');

    // Checkout all files from that commit
    await new Promise<void>((resolve, reject) => {
      execFile('git', ['checkout', commitHash, '--', '.'], { cwd: wsPath }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Get the original commit message for the restore commit description
    const originalMsg = await new Promise<string>((resolve, reject) => {
      execFile('git', ['log', '--format=%s', '-1', commitHash], { cwd: wsPath }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    });

    // Auto-commit the restore
    const result = await autoCommit(clients, wsId, {
      tag: 'manual-code',
      description: `Restored to: ${originalMsg}`,
      source: 'manual',
    }, wsPath);

    return result;
  });

  // --- Source control: staging, branch, commit-staged ---

  ipcMain.handle(IPC.GIT_ADD, async (_event, wsId: string, paths: string[]) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');
    return new Promise<void>((resolve, reject) => {
      execFile('git', ['add', '--', ...paths], { cwd: wsPath }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  ipcMain.handle(IPC.GIT_RESET_FILES, async (_event, wsId: string, paths: string[]) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');
    return new Promise<void>((resolve, reject) => {
      execFile('git', ['reset', 'HEAD', '--', ...paths], { cwd: wsPath }, (err) => {
        if (err) {
          // Fallback for repos with no commits yet
          execFile('git', ['rm', '--cached', '--', ...paths], { cwd: wsPath }, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
          return;
        }
        resolve();
      });
    });
  });

  ipcMain.handle(IPC.GIT_BRANCH, async (_event, wsId: string) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) return { branch: 'main' }; // fallback when workspace path not yet tracked
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: wsPath }, (err, stdout) => {
        if (err) return resolve({ branch: 'main' });
        resolve({ branch: stdout.trim() });
      });
    });
  });

  ipcMain.handle(IPC.GIT_COMMIT_STAGED, async (_event, wsId: string, message: string) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');
    return new Promise((resolve, reject) => {
      execFile('git', ['commit', '-m', message], { cwd: wsPath }, (err, stdout) => {
        if (err) return reject(err);
        // Extract commit hash
        const match = stdout.match(/\[.+\s([a-f0-9]+)\]/);
        resolve({ commitHash: match?.[1] || '' });
      });
    });
  });

  ipcMain.handle(IPC.GIT_DIFF_STAGED, async (_event, wsId: string, filePath?: string) => {
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) return { diff: '' }; // fallback when workspace path not yet tracked
    const args = ['diff', '--cached'];
    if (filePath) args.push('--', filePath);
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: wsPath, maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        resolve({ diff: stdout });
      });
    });
  });

  ipcMain.handle(IPC.CREATE_TERMINAL, async (_event, wsId: string, cols: number, rows: number) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.terminal.createTerminal(
        { workspaceId: wsId, cols, rows },
        (err: any, res: any) => {
          if (err) return reject(err);
          resolve(res.sessionId);
        }
      );
    });
  });

  ipcMain.handle(IPC.GENERATE, async (_event, wsId: string, prompt: string) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      clients.generate.generate({ workspaceId: wsId, prompt }, (err: any, res: any) => {
        if (err) return reject(err);
        const patches = (res.patches || []).map((p: any) => ({
          filePath: p.filePath,
          content: Buffer.isBuffer(p.content) ? p.content.toString('utf-8') : p.content,
        }));
        resolve({ taskId: res.taskId, patches });
      });
    });
  });

  ipcMain.handle(IPC.APPLY_PATCHES, async (_event, wsId: string, taskId: string, patches: any[]) => {
    const clients = await getClients();
    return new Promise((resolve, reject) => {
      const grpcPatches = patches.map((p) => ({
        filePath: p.filePath,
        content: Buffer.from(p.content, 'utf-8'),
      }));
      clients.generate.applyPatches(
        { workspaceId: wsId, taskId, patches: grpcPatches },
        (err: any, res: any) => {
          if (err) return reject(err);
          resolve({ results: res.results });
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // Terminal streaming

  ipcMain.on(IPC.START_TERMINAL_STREAM, async (_event, sessionId: string) => {
    const clients = await getClients();
    const stream = clients.terminal.terminalStream();

    activeTerminalStreams.set(sessionId, stream);

    // Send initial message with session ID.
    stream.write({ sessionId });

    // Read data from PTY and send to renderer.
    stream.on('data', (msg: any) => {
      try {
        const data = Buffer.isBuffer(msg.data) ? msg.data.toString('base64') : '';
        getWindow().webContents.send(IPC.TERMINAL_DATA, { sessionId: msg.sessionId, data });
      } catch { /* window may have closed */ }
    });

    stream.on('end', () => {
      activeTerminalStreams.delete(sessionId);
      try { getWindow().webContents.send(IPC.TERMINAL_END, sessionId); } catch { /* */ }
    });

    stream.on('error', (err: any) => {
      console.error('Terminal stream error:', err);
      activeTerminalStreams.delete(sessionId);
      try { getWindow().webContents.send(IPC.TERMINAL_END, sessionId); } catch { /* */ }
    });
  });

  ipcMain.on(IPC.SEND_TERMINAL_INPUT, (_event, sessionId: string, data: string) => {
    const stream = activeTerminalStreams.get(sessionId);
    if (stream) {
      stream.write({ sessionId, data: Buffer.from(data, 'base64') });
    }
  });

  ipcMain.on(IPC.RESIZE_TERMINAL, (_event, sessionId: string, cols: number, rows: number) => {
    const stream = activeTerminalStreams.get(sessionId);
    if (stream) {
      stream.write({ sessionId, resize: { cols, rows } });
    }
  });

  // -------------------------------------------------------------------------
  // Chat AI (via Claude Code CLI)

  ipcMain.handle(IPC.CHAT_SEND, async (_event, wsId: string, message: string, context: ChatContext, existingMessages?: ChatMessage[]) => {
    const clients = await getClients();
    const wsPath = workspacePaths.get(wsId);
    if (!wsPath) throw new Error('Workspace path not found');

    const filesChanged: string[] = [];

    // Create the run
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const allMessages = [...(existingMessages || []), userMsg];

    const run = await runStore.createRun(clients, wsId, {
      type: 'chat',
      status: 'running',
      input: {
        message,
        notes: null,
        context,
        parentRunId: null,
      },
      output: {
        filesChanged: [],
        messageCount: allMessages.length,
      },
      messages: allMessages,
    });

    // Build prompt: include conversation history for context
    let fullPrompt = message;
    if (existingMessages && existingMessages.length > 0) {
      const historyLines = existingMessages.map(
        (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      );
      fullPrompt = `Previous conversation:\n${historyLines.join('\n\n')}\n\nUser: ${message}`;
    }

    const systemPrompt = buildSystemPrompt(context);

    const claudeRun = runClaude({
      prompt: fullPrompt,
      cwd: wsPath,
      systemPrompt,
    });

    activeClaudeRuns.set(run.id, claudeRun);

    let assistantContent = '';

    claudeRun.emitter.on('text', (delta: string) => {
      assistantContent += delta;
      sendChunk({ runId: run.id, delta });
    });

    claudeRun.emitter.on('tool_use', (tool: { name: string; input: string }) => {
      sendChunk({ runId: run.id, toolUse: tool });
    });

    claudeRun.emitter.on('file_change', (filePath: string) => {
      if (!filesChanged.includes(filePath)) {
        filesChanged.push(filePath);
      }
      sendChunk({ runId: run.id, fileChange: filePath });
    });

    claudeRun.emitter.on('complete', async (sessionId?: string) => {
      activeClaudeRuns.delete(run.id);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        runId: run.id,
      };

      const finalMessages = [...allMessages, assistantMsg];

      try {
        await runStore.updateRun(clients, wsId, run.id, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          output: {
            filesChanged,
            messageCount: finalMessages.length,
          },
          messages: finalMessages,
        });
      } catch { /* best effort */ }

      sendChunk({ runId: run.id, status: 'completed', sessionId });

      // Auto-commit if files were changed
      if (filesChanged.length > 0) {
        const desc = `Chat: ${message.slice(0, 60)}${message.length > 60 ? '...' : ''}`;
        autoCommit(clients, wsId, {
          description: desc,
          source: 'chat',
          runId: run.id,
        }, wsPath).catch((err) => console.error('[Chat] Auto-commit failed:', err));
      }
    });

    claudeRun.emitter.on('error', async (errorMessage: string) => {
      activeClaudeRuns.delete(run.id);
      console.error('[Chat] Claude error:', errorMessage);
      try {
        await runStore.updateRun(clients, wsId, run.id, { status: 'error', completedAt: new Date().toISOString() });
      } catch { /* best effort */ }
      sendChunk({ runId: run.id, status: 'error', error: errorMessage });
    });

    return { runId: run.id };
  });

  ipcMain.handle(IPC.CHAT_CANCEL, async (_event, runId: string) => {
    const claudeRun = activeClaudeRuns.get(runId);
    if (claudeRun) {
      claudeRun.kill();
      activeClaudeRuns.delete(runId);
    }
  });

  ipcMain.handle(IPC.LIST_RUNS, async (_event, wsId: string, limit?: number) => {
    const clients = await getClients();
    return runStore.listRuns(clients, wsId, limit);
  });

  ipcMain.handle(IPC.GET_RUN, async (_event, wsId: string, runId: string) => {
    const clients = await getClients();
    return runStore.getRun(clients, wsId, runId);
  });

  // -------------------------------------------------------------------------
  // Event streaming

  ipcMain.on(IPC.SUBSCRIBE_EVENTS, async (_event, wsId: string) => {
    const clients = await getClients();
    const stream = clients.event.streamEvents({ workspaceId: wsId });
    activeEventStreams.push(stream);

    stream.on('data', (event: any) => {
      try {
        getWindow().webContents.send(IPC.EVENT, {
          id: event.id,
          type: event.type,
          payload: Buffer.isBuffer(event.payload) ? event.payload.toString('base64') : '',
          timestampMs: event.timestampMs,
        });
      } catch { /* window may have closed */ }
    });

    stream.on('error', (err: any) => {
      console.error('Event stream error:', err);
    });
  });
}
