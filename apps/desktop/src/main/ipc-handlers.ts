import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { GrpcClients } from './grpc-client';
import { IPC } from '../shared/types';

const activeTerminalStreams = new Map<string, any>();

export function registerIpcHandlers(clients: GrpcClients, mainWindow: BrowserWindow) {
  // -------------------------------------------------------------------------
  // Unary RPCs

  ipcMain.handle(IPC.PING, async () => {
    return new Promise((resolve, reject) => {
      clients.health.ping({}, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ status: res.status, version: res.version });
      });
    });
  });

  ipcMain.handle(IPC.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.OPEN_WORKSPACE, async (_event, path: string) => {
    return new Promise((resolve, reject) => {
      clients.workspace.openWorkspace({ path }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ workspaceId: res.workspaceId, path: res.path });
      });
    });
  });

  ipcMain.handle(IPC.READ_FILE, async (_event, wsId: string, relativePath: string) => {
    return new Promise((resolve, reject) => {
      clients.workspace.readFile({ workspaceId: wsId, relativePath }, (err: any, res: any) => {
        if (err) return reject(err);
        // Convert Buffer to base64 string for IPC transport.
        const content = Buffer.isBuffer(res.content)
          ? res.content.toString('utf-8')
          : res.content;
        resolve({ content });
      });
    });
  });

  ipcMain.handle(IPC.WRITE_FILE, async (_event, wsId: string, relativePath: string, content: string) => {
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
    console.log('[IPC] moveFile called:', oldPath, '->', newPath);
    return new Promise((resolve, reject) => {
      clients.workspace.moveFile({ workspaceId: wsId, oldPath, newPath }, (err: any) => {
        if (err) {
          console.error('[IPC] moveFile FAILED:', err.message || err);
          return reject(err);
        }
        console.log('[IPC] moveFile OK');
        resolve(undefined);
      });
    });
  });

  ipcMain.handle(IPC.CREATE_DIRECTORY, async (_event, wsId: string, relativePath: string) => {
    console.log('[IPC] createDirectory called:', wsId, relativePath);
    return new Promise((resolve, reject) => {
      clients.workspace.createDirectory({ workspaceId: wsId, relativePath }, (err: any, res: any) => {
        if (err) {
          console.error('[IPC] createDirectory FAILED:', relativePath, err.message || err);
          return reject(err);
        }
        console.log('[IPC] createDirectory OK:', relativePath);
        resolve(undefined);
      });
    });
  });

  ipcMain.handle(IPC.DELETE_FILE, async (_event, wsId: string, relativePath: string) => {
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
    try {
      const entries = fs.readdirSync(dirPath);
      return entries.length === 0;
    } catch {
      return true; // doesn't exist yet, treat as empty
    }
  });

  ipcMain.handle(IPC.CLEAR_DIR, async (_event, dirPath: string) => {
    // Validate: path must be absolute, within user's home directory, and normalized.
    const resolved = path.resolve(dirPath);
    const home = require('os').homedir();
    if (!resolved.startsWith(home + path.sep) || resolved === home) {
      throw new Error('Cannot clear directory outside of home folder');
    }
    const entries = fs.readdirSync(resolved);
    for (const entry of entries) {
      fs.rmSync(path.join(resolved, entry), { recursive: true, force: true });
    }
  });

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // -------------------------------------------------------------------------
  // Git RPCs

  ipcMain.handle(IPC.GIT_INIT, async (_event, wsId: string) => {
    return new Promise((resolve, reject) => {
      clients.git.init({ workspaceId: wsId }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ alreadyInitialized: res.alreadyInitialized });
      });
    });
  });

  ipcMain.handle(IPC.GIT_STATUS, async (_event, wsId: string) => {
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
  });

  ipcMain.handle(IPC.GIT_DIFF, async (_event, wsId: string, filePath?: string) => {
    return new Promise((resolve, reject) => {
      clients.git.diff({ workspaceId: wsId, filePath: filePath || '' }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ diff: res.diff });
      });
    });
  });

  ipcMain.handle(IPC.GIT_COMMIT, async (_event, wsId: string, message: string) => {
    return new Promise((resolve, reject) => {
      clients.git.commit({ workspaceId: wsId, message }, (err: any, res: any) => {
        if (err) return reject(err);
        resolve({ commitHash: res.commitHash });
      });
    });
  });

  ipcMain.handle(IPC.GIT_LOG, async (_event, wsId: string, limit?: number) => {
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
    return new Promise((resolve, reject) => {
      clients.git.checkout({ workspaceId: wsId, paths: paths || [] }, (err: any) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  });

  ipcMain.handle(IPC.CREATE_TERMINAL, async (_event, wsId: string, cols: number, rows: number) => {
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

  ipcMain.on(IPC.START_TERMINAL_STREAM, (_event, sessionId: string) => {
    const stream = clients.terminal.terminalStream();

    activeTerminalStreams.set(sessionId, stream);

    // Send initial message with session ID.
    stream.write({ sessionId });

    // Read data from PTY and send to renderer.
    stream.on('data', (msg: any) => {
      const data = Buffer.isBuffer(msg.data) ? msg.data.toString('base64') : '';
      mainWindow.webContents.send(IPC.TERMINAL_DATA, { sessionId: msg.sessionId, data });
    });

    stream.on('end', () => {
      activeTerminalStreams.delete(sessionId);
      mainWindow.webContents.send(IPC.TERMINAL_END, sessionId);
    });

    stream.on('error', (err: any) => {
      console.error('Terminal stream error:', err);
      activeTerminalStreams.delete(sessionId);
      mainWindow.webContents.send(IPC.TERMINAL_END, sessionId);
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
  // Event streaming

  ipcMain.on(IPC.SUBSCRIBE_EVENTS, (_event, wsId: string) => {
    const stream = clients.event.streamEvents({ workspaceId: wsId });

    stream.on('data', (event: any) => {
      mainWindow.webContents.send(IPC.EVENT, {
        id: event.id,
        type: event.type,
        payload: Buffer.isBuffer(event.payload) ? event.payload.toString('base64') : '',
        timestampMs: event.timestampMs,
      });
    });

    stream.on('error', (err: any) => {
      console.error('Event stream error:', err);
    });
  });
}
