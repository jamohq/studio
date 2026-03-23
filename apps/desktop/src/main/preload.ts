export {};
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  ping: () => ipcRenderer.invoke('jamo:ping'),

  selectDirectory: () => ipcRenderer.invoke('jamo:select-directory'),

  openWorkspace: (path: string) => ipcRenderer.invoke('jamo:open-workspace', path),

  readFile: (wsId: string, path: string) => ipcRenderer.invoke('jamo:read-file', wsId, path),

  writeFile: (wsId: string, path: string, content: string) =>
    ipcRenderer.invoke('jamo:write-file', wsId, path, content),

  writeFileBinary: (wsId: string, path: string, base64Content: string) =>
    ipcRenderer.invoke('jamo:write-file-binary', wsId, path, base64Content),

  readFileBinary: (wsId: string, path: string) =>
    ipcRenderer.invoke('jamo:read-file-binary', wsId, path),

  listDirectory: (wsId: string, path: string) =>
    ipcRenderer.invoke('jamo:list-directory', wsId, path),

  moveFile: (wsId: string, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('jamo:move-file', wsId, oldPath, newPath),

  createDirectory: (wsId: string, path: string) =>
    ipcRenderer.invoke('jamo:create-directory', wsId, path),

  deleteFile: (wsId: string, path: string) =>
    ipcRenderer.invoke('jamo:delete-file', wsId, path),

  createTerminal: (wsId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('jamo:create-terminal', wsId, cols, rows),

  startTerminalStream: (sessionId: string) =>
    ipcRenderer.send('jamo:start-terminal-stream', sessionId),

  sendTerminalInput: (sessionId: string, data: string) =>
    ipcRenderer.send('jamo:send-terminal-input', sessionId, data),

  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('jamo:resize-terminal', sessionId, cols, rows),

  onTerminalData: (cb: any) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on('jamo:terminal-data', handler);
    return () => ipcRenderer.removeListener('jamo:terminal-data', handler);
  },

  onTerminalEnd: (cb: any) => {
    const handler = (_event: any, sessionId: string) => cb(sessionId);
    ipcRenderer.on('jamo:terminal-end', handler);
    return () => ipcRenderer.removeListener('jamo:terminal-end', handler);
  },

  checkDirEmpty: (dirPath: string) =>
    ipcRenderer.invoke('jamo:check-dir-empty', dirPath),

  clearDir: (dirPath: string) =>
    ipcRenderer.invoke('jamo:clear-dir', dirPath),

  gitInit: (wsId: string) =>
    ipcRenderer.invoke('jamo:git-init', wsId),

  gitStatus: (wsId: string) =>
    ipcRenderer.invoke('jamo:git-status', wsId),

  gitDiff: (wsId: string, filePath?: string) =>
    ipcRenderer.invoke('jamo:git-diff', wsId, filePath),

  gitCommit: (wsId: string, message: string) =>
    ipcRenderer.invoke('jamo:git-commit', wsId, message),

  gitLog: (wsId: string, limit?: number) =>
    ipcRenderer.invoke('jamo:git-log', wsId, limit),

  gitCheckout: (wsId: string, paths?: string[]) =>
    ipcRenderer.invoke('jamo:git-checkout', wsId, paths || []),

  smartCommit: (wsId: string, opts: any) =>
    ipcRenderer.invoke('jamo:smart-commit', wsId, opts),

  getCommitHistory: (wsId: string, limit?: number) =>
    ipcRenderer.invoke('jamo:get-commit-history', wsId, limit),

  gitDiffCommits: (wsId: string, fromRef: string, toRef: string) =>
    ipcRenderer.invoke('jamo:git-diff-commits', wsId, fromRef, toRef),

  gitRevertTo: (wsId: string, commitHash: string) =>
    ipcRenderer.invoke('jamo:git-revert-to', wsId, commitHash),

  gitAdd: (wsId: string, paths: string[]) =>
    ipcRenderer.invoke('jamo:git-add', wsId, paths),

  gitResetFiles: (wsId: string, paths: string[]) =>
    ipcRenderer.invoke('jamo:git-reset-files', wsId, paths),

  gitBranch: (wsId: string) =>
    ipcRenderer.invoke('jamo:git-branch', wsId),

  gitCommitStaged: (wsId: string, message: string) =>
    ipcRenderer.invoke('jamo:git-commit-staged', wsId, message),

  gitDiffStaged: (wsId: string, filePath?: string) =>
    ipcRenderer.invoke('jamo:git-diff-staged', wsId, filePath),

  generate: (wsId: string, prompt: string) =>
    ipcRenderer.invoke('jamo:generate', wsId, prompt),

  applyPatches: (wsId: string, taskId: string, patches: any[]) =>
    ipcRenderer.invoke('jamo:apply-patches', wsId, taskId, patches),

  subscribeEvents: (wsId: string) =>
    ipcRenderer.send('jamo:subscribe-events', wsId),

  onEvent: (cb: any) => {
    const handler = (_event: any, jamoEvent: any) => cb(jamoEvent);
    ipcRenderer.on('jamo:event', handler);
    return () => ipcRenderer.removeListener('jamo:event', handler);
  },

  openExternal: (url: string) => ipcRenderer.invoke('jamo:open-external', url),

  checkEnvironment: () => ipcRenderer.invoke('jamo:check-environment'),

  chatSend: (wsId: string, message: string, context: any, existingMessages?: any[]) =>
    ipcRenderer.invoke('jamo:chat-send', wsId, message, context, existingMessages),

  onChatStream: (cb: any) => {
    const handler = (_event: any, chunk: any) => cb(chunk);
    ipcRenderer.on('jamo:chat-stream', handler);
    return () => ipcRenderer.removeListener('jamo:chat-stream', handler);
  },

  chatCancel: (runId: string) =>
    ipcRenderer.invoke('jamo:chat-cancel', runId),

  listRuns: (wsId: string, limit?: number) =>
    ipcRenderer.invoke('jamo:list-runs', wsId, limit),

  getRun: (wsId: string, runId: string) =>
    ipcRenderer.invoke('jamo:get-run', wsId, runId),
};

contextBridge.exposeInMainWorld('jamo', api);
