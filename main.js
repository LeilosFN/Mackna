const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    title: 'Leilos Launcher',
    frame: true, // Keep standard frame for now, or false for custom drag
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.removeMenu();

  // Load Vite Dev Server in Dev, or dist/index.html in Prod
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Fortnite Main Directory'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('launch', async (_, fortnitePath, user) => {
  try {
    if (!fortnitePath) return { error: 'No path selected' };

    // Default to unused if no user (should not happen with UI logic)
    const email = user ? user.email : 'unused';
    const password = user ? user.password : 'unused';

    // 1. Verify Path

    const binariesPath = path.join(fortnitePath, 'FortniteGame', 'Binaries', 'Win64');
    const exePath = path.join(binariesPath, 'FortniteClient-Win64-Shipping.exe');

    if (!fs.existsSync(exePath)) {
      return { error: 'Fortnite executable not found in selected path. Make sure you selected the ROOT Fortnite folder.' };
    }

    sendLog('Found Fortnite Executable...');

    // 2. Copy DLLs
    const dllSourceDir = path.join(__dirname, 'dlls');

    // Ensure dlls exist source
    if (fs.existsSync(dllSourceDir)) {
      sendLog('Injecting DLLs...');

      const copyFile = (srcName, destName) => {
        try {
          fs.copyFileSync(
            path.join(dllSourceDir, srcName),
            path.join(binariesPath, destName)
          );
          sendLog(`Copied ${srcName} as ${destName}`);
        } catch (e) {
          sendLog(`Failed to copy ${srcName}: ${e.message}`);
        }
      };

      // Strategy: Copy all original names, and also create Proxy
      // User said:
      // Tellurium.dll -> Authentication
      // LavishClient.dll -> Unreal Engine Patcher

      // Copy originals
      copyFile('Tellurium.dll', 'Tellurium.dll');
      copyFile('LavishGS.dll', 'LavishGS.dll');
      copyFile('LavishClient.dll', 'LavishClient.dll');

      // Create Proxy (Hook) - usually version.dll or xinput1_3.dll
      // Common practice: Rename the "Patcher" to version.dll so it loads automatically.
      copyFile('LavishClient.dll', 'version.dll');

    } else {
      sendLog('WARNING: "dlls" folder not found in launcher directory.');
    }


    // Arguments provided by user
    const args = [
      '-log',
      '-skippatchcheck',
      '-epicapp=Fortnite',
      '-epicenv=Prod',
      '-epicportal',
      '-nobe',
      '-fromfl=eac',
      '-fltoken=h1cdh1-3u68s-rl164-32az',
      `-AUTH_LOGIN=${email}`,
      `-AUTH_PASSWORD=${password}`,
      '-AUTH_TYPE=epic',
      '-backend=http://leilos.leilos.qzz.io:80',
      '-host=http://leilos.leilos.qzz.io:7777',
    ];

    // 3. Launch
    sendLog('Launching Fortnite...');
    console.log('Attempting to spawn:', exePath);
    console.log('With args:', args);
    console.log('CWD:', binariesPath);

    const child = spawn(exePath, args, {
      cwd: binariesPath,
      detached: true,
      stdio: 'ignore'
    });

    child.on('error', (err) => {
      console.error('Spawn Error:', err);
      sendLog('Spawn Error: ' + err.message);
    });

    child.on('exit', (code, signal) => {
      console.log(`Game exited with code ${code} and signal ${signal}`);
      sendLog(`Game closed (Code: ${code})`);
      mainWindow.webContents.send('launch-status', 'IDLE');
    });

    child.unref();

    mainWindow.webContents.send('launch-status', 'RUNNING');
    sendLog('Game Process Started!');

    setTimeout(() => {
      mainWindow.webContents.send('launch-status', 'IDLE'); // Reset after a bit since it's detached
    }, 5000);

    return { ok: true };

  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
});

function sendLog(msg) {
  if (mainWindow) {
    mainWindow.webContents.send('log-message', msg);
  }
}
