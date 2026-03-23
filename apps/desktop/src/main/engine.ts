import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export interface EngineHandle {
  port: number;
  token: string;
  process: ChildProcess;
}

/** Callback invoked when the engine crashes after initial startup. */
export type OnEngineCrash = (code: number | null, signal: string | null) => void;

const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BASE_DELAY_MS = 1000;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Resolve the engine binary path.
 * - Production: packaged binary in extraResources (bin/jamo-engine)
 * - Development: uses `go run` instead (see startEngine)
 */
function resolveEngineBinary(): string | null {
  if (isDev) return null;

  const ext = process.platform === 'win32' ? '.exe' : '';
  // electron-builder puts extraResources under process.resourcesPath
  const binPath = path.join(process.resourcesPath, 'bin', `jamo-engine${ext}`);
  if (fs.existsSync(binPath)) return binPath;

  return null;
}

export function startEngine(onCrash?: OnEngineCrash): Promise<EngineHandle> {
  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    const engineBin = resolveEngineBinary();

    if (engineBin) {
      // Production: spawn the pre-built binary directly.
      proc = spawn(engineBin, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      // Development: use go run.
      const engineDir = path.resolve(__dirname, '..', '..', '..', '..', 'engine');
      proc = spawn('go', ['run', './cmd/jamo-engine'], {
        cwd: engineDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    let port: number | null = null;
    let token: string | null = null;
    let resolved = false;

    // Parse stdout for port and token.
    const rl = readline.createInterface({ input: proc.stdout! });
    rl.on('line', (line: string) => {
      if (line.startsWith('JAMO_ENGINE_PORT=')) {
        port = parseInt(line.split('=')[1], 10);
      }
      if (line.startsWith('JAMO_ENGINE_TOKEN=')) {
        token = line.split('=')[1];
      }

      if (port && token && !resolved) {
        resolved = true;
        rl.close();
        resolve({ port, token, process: proc });
      }
    });

    // Forward stderr to console for dev visibility.
    const stderrRl = readline.createInterface({ input: proc.stderr! });
    stderrRl.on('line', (line: string) => {
      console.log('[engine]', line);
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to start engine: ${err.message}`));
      }
    });

    proc.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Engine exited before ready with code ${code}`));
      } else if (onCrash) {
        // Engine crashed after successful startup.
        onCrash(code, signal ? String(signal) : null);
      }
    });

    // Timeout after 30 seconds.
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error('Engine startup timed out (30s)'));
      }
    }, 30000);
  });
}

/**
 * Start the engine with automatic crash recovery (up to MAX_RESTART_ATTEMPTS).
 * Returns the initial handle; onRestart is called with the new handle after each restart.
 */
export async function startEngineWithRecovery(
  onRestart: (handle: EngineHandle) => void,
  onFatalCrash: (error: string) => void,
): Promise<EngineHandle> {
  let restartCount = 0;

  function scheduleRestart() {
    restartCount++;
    if (restartCount > MAX_RESTART_ATTEMPTS) {
      onFatalCrash(`Engine crashed ${MAX_RESTART_ATTEMPTS} times, giving up.`);
      return;
    }
    const delay = RESTART_BASE_DELAY_MS * Math.pow(2, restartCount - 1);
    console.log(`Engine crashed. Restarting in ${delay}ms (attempt ${restartCount}/${MAX_RESTART_ATTEMPTS})...`);
    setTimeout(async () => {
      try {
        const handle = await startEngine(() => scheduleRestart());
        restartCount = 0; // Reset on successful restart.
        onRestart(handle);
      } catch (err: any) {
        console.error('Engine restart failed:', err.message);
        scheduleRestart();
      }
    }, delay);
  }

  return startEngine(() => scheduleRestart());
}
