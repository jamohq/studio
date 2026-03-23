import { execFile } from 'child_process';

/** Check if the `claude` CLI is available on the system. */
export async function isClaudeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('which', ['claude'], { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
}
