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
};

contextBridge.exposeInMainWorld('jamo', api);
