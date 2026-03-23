export {};
const { contextBridge, ipcRenderer } = require('electron');

const settingsApi = {
  checkEnvironment: () => ipcRenderer.invoke('jamo:check-environment'),
};

contextBridge.exposeInMainWorld('jamoSettings', settingsApi);
