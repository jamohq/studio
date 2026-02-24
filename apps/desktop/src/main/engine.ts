import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

export interface EngineHandle {
  port: number;
  token: string;
  process: ChildProcess;
}

export function startEngine(): Promise<EngineHandle> {
  return new Promise((resolve, reject) => {
    const engineDir = path.resolve(__dirname, '..', '..', '..', '..', 'engine');

    const proc = spawn('go', ['run', './cmd/jamo-engine'], {
      cwd: engineDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

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

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Engine exited before ready with code ${code}`));
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
