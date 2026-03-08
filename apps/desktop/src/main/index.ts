import { app, BrowserWindow, Menu, shell, dialog, nativeImage, session } from 'electron';
import * as path from 'path';
import { startEngineWithRecovery, EngineHandle } from './engine';
import { createClients } from './grpc-client';
import { registerIpcHandlers } from './ipc-handlers';

app.name = 'Jamo Studio';

// Set macOS dock icon and name during development
if (process.platform === 'darwin') {
  const dockIcon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'icon.png'));
  if (!dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon);
  }
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory', 'createDirectory'],
              title: 'Open Project',
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const win = BrowserWindow.getFocusedWindow();
              if (win) {
                win.webContents.send('open-workspace', result.filePaths[0]);
              }
            }
          },
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Jamo Documentation',
          click: () => shell.openExternal('https://jamo.com/docs'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let engine: EngineHandle | null = null;

async function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'Jamo Studio',
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Set Content-Security-Policy headers.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* http://localhost:*; font-src 'self' data:",
        ],
      },
    });
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
    engine = await startEngineWithRecovery(
      (newHandle) => {
        console.log(`Engine restarted on port ${newHandle.port}`);
        engine = newHandle;
        const newClients = createClients(newHandle.port, newHandle.token);
        registerIpcHandlers(newClients, mainWindow);
        mainWindow.webContents.send('engine-restarted');
      },
      (error) => {
        console.error('Engine fatal crash:', error);
        mainWindow.webContents.send('engine-crashed', error);
      },
    );
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

app.whenReady().then(() => {
  buildAppMenu();
  return createWindow();
}).catch((err) => {
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
