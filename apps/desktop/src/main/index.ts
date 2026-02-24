import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { startEngine, EngineHandle } from './engine';
import { createClients } from './grpc-client';
import { registerIpcHandlers } from './ipc-handlers';

let engine: EngineHandle | null = null;

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the UI immediately so the user sees something.
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Start the Go engine in the background.
  try {
    console.log('Starting Jamo engine...');
    engine = await startEngine();
    console.log(`Engine started on port ${engine.port}`);

    const clients = createClients(engine.port, engine.token);

    // Health check with retry.
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        clients.health.ping({}, (err: any, res: any) => {
          if (err) {
            attempts++;
            if (attempts > 10) {
              reject(new Error(`Health check failed after ${attempts} attempts: ${err.message}`));
              return;
            }
            setTimeout(check, 500);
            return;
          }
          console.log(`Engine health: ${res.status} v${res.version}`);
          resolve();
        });
      };
      check();
    });

    registerIpcHandlers(clients, mainWindow);
    console.log('Engine ready, IPC handlers registered.');
  } catch (err) {
    console.error('Engine startup failed:', err);
  }
}

app.whenReady().then(createWindow).catch((err) => {
  console.error('Failed to start:', err);
});

app.on('before-quit', () => {
  if (engine) {
    console.log('Stopping engine...');
    engine.process.kill();
    engine = null;
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
