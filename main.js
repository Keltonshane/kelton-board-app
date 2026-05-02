const { app, BrowserWindow, globalShortcut, powerSaveBlocker, ipcMain, Notification, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

let autoUpdater;
try { ({ autoUpdater } = require('electron-updater')); } catch {}

// ── LOGGER ───────────────────────────────────────────────
const LOG_DIR = () => path.join(app.getPath('userData'), 'logs');

function logLine(level, msg) {
  try {
    const dir = LOG_DIR();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().substring(0, 10);
    const ts   = new Date().toISOString().replace('T', ' ').substring(0, 19);
    fs.appendFileSync(path.join(dir, `${date}.log`), `[${ts}] [${level}] ${msg}\n`, 'utf8');
  } catch {}
}

function pruneLogs() {
  try {
    const dir = LOG_DIR();
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.log'))) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    }
  } catch {}
}

function currentLogPath() {
  const date = new Date().toISOString().substring(0, 10);
  return path.join(LOG_DIR(), `${date}.log`);
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow;
let tray        = null;
let powerSaveId = null;
app.isQuitting  = false;

// When packaged, settings live in userData so they survive updates.
// In dev they stay next to main.js for easy editing.
const SETTINGS_PATH = app.isPackaged
  ? path.join(app.getPath('userData'), 'settings.json')
  : path.join(__dirname, 'settings.json');

const DEFAULT_SETTINGS = {
  idleScreensaver: { enabled: true, idleMinutes: 30 },
  afterHours:      { enabled: true, closedSunday: true },
  launchOnStartup: false,
  quoteCoworkers:  ['Preston', 'Trey'],
  notifications:   { approvalSound: true, newCardSound: true, volume: 0.8 },
  quickJobs:       { enabled: true, overdueHour: 8, overdueSound: true },
};

function ensureSettingsFile() {
  if (!app.isPackaged) return;
  if (fs.existsSync(SETTINGS_PATH)) return;
  try {
    const bundled = path.join(__dirname, 'settings.json');
    if (fs.existsSync(bundled)) fs.copyFileSync(bundled, SETTINGS_PATH);
    else fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  } catch {}
}

function readSettings() {
  try {
    return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')));
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function writeSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── TRAY ────────────────────────────────────────────────
function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    {
      label: 'Show Board',
      click: () => {
        mainWindow.show();
        if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
      },
    },
    { type: 'separator' },
    {
      label: 'Launch on Startup',
      type:    'checkbox',
      checked: openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        const s = readSettings();
        s.launchOnStartup = item.checked;
        writeSettings(s);
        tray.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  const icon     = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Kelton Action Board');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => {
    mainWindow.show();
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
  });
}

// ── WINDOW ───────────────────────────────────────────────
function createWindow() {
  const iconPath  = path.join(__dirname, 'assets', 'icon.ico');
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    title: 'Lawnsmith Plus — Kelton Action Board',
    icon:  iconExists ? iconPath : undefined,
    fullscreen:  true,
    frame:       false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  mainWindow.loadFile('kelton-board.html');
  powerSaveId = powerSaveBlocker.start('prevent-display-sleep');

  // Minimize to tray on close instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });
}

// ── IPC ─────────────────────────────────────────────────
ipcMain.on('show-notification', (event, { title, body }) => {
  if (!Notification.isSupported()) return;
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  new Notification({
    title, body,
    icon:   fs.existsSync(iconPath) ? iconPath : undefined,
    silent: false,
  }).show();
});

ipcMain.handle('read-settings', () => readSettings());
ipcMain.handle('write-settings', (event, data) => {
  logLine('INFO', 'Settings saved');
  writeSettings(data);
  if (typeof data.launchOnStartup === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: data.launchOnStartup });
    if (tray) tray.setContextMenu(buildTrayMenu());
  }
  return true;
});
ipcMain.handle('open-log', () => {
  const logPath = currentLogPath();
  if (fs.existsSync(logPath)) shell.openPath(logPath);
  else shell.openPath(LOG_DIR());
  return true;
});
ipcMain.on('install-update', () => {
  if (!autoUpdater) return;
  logLine('INFO', 'User triggered update install');
  app.isQuitting = true;
  autoUpdater.quitAndInstall();
});

// ── AUTO-UPDATER ─────────────────────────────────────────
function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload         = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update',  () => logLine('INFO', 'Checking for update'));
  autoUpdater.on('update-available',   info => {
    logLine('INFO', `Update available: ${info.version}`);
    mainWindow?.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', () => logLine('INFO', 'App is up to date'));
  autoUpdater.on('update-downloaded',  info => {
    logLine('INFO', `Update downloaded: ${info.version}`);
    mainWindow?.webContents.send('update-ready', info);
  });
  autoUpdater.on('error', err => logLine('ERROR', `Auto-update error: ${err.message}`));

  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch(e) { logLine('WARN', `Update check skipped: ${e.message}`); } }, 12000);
  setInterval(() =>  { try { autoUpdater.checkForUpdates(); } catch {} }, 4 * 3600 * 1000);
}

// ── LIFECYCLE ────────────────────────────────────────────
app.whenReady().then(() => {
  ensureSettingsFile();
  pruneLogs();
  logLine('INFO', `App starting — version ${app.getVersion()}`);

  const settings = readSettings();
  app.setLoginItemSettings({ openAtLogin: !!settings.launchOnStartup });

  createWindow();
  createTray();
  setupAutoUpdater();

  globalShortcut.register('F11', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  globalShortcut.register('Control+Shift+Q', () => {
    app.isQuitting = true;
    app.quit();
  });
});

app.on('will-quit', () => {
  logLine('INFO', 'App shutting down');
  globalShortcut.unregisterAll();
  if (powerSaveId !== null) powerSaveBlocker.stop(powerSaveId);
});

// Window-all-closed only fires if we fully closed (not hidden), so let it quit.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
