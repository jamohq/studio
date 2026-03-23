import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { DepCheck, EnvCheckResult } from '../shared/types';

/** Env vars to strip when spawning child processes (matches engine cleanEnv). */
const STRIP_ENV_VARS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'];

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of STRIP_ENV_VARS) {
    delete env[key];
  }
  return env;
}

/** Run a command, returning stdout. Tries bare first, falls back to login shell. */
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env: cleanEnv(), timeout: 5000 }, (err, stdout) => {
      if (err) {
        // Fallback: try via login shell to pick up user's PATH
        const shell = process.env.SHELL || '/bin/bash';
        const fullCmd = [cmd, ...args].join(' ');
        execFile(shell, ['-l', '-c', fullCmd], { env: cleanEnv(), timeout: 5000 }, (err2, stdout2) => {
          if (err2) return reject(err2);
          resolve(stdout2.trim());
        });
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function checkClaude(): Promise<DepCheck> {
  const dep: DepCheck = { name: 'claude', found: false };
  try {
    await run('which', ['claude']);
    dep.found = true;
  } catch {
    dep.error = 'Claude CLI not found';
    dep.fix = 'npm install -g @anthropic-ai/claude-code';
    dep.fixUrl = 'https://docs.anthropic.com/en/docs/claude-code';
    return dep;
  }

  try {
    dep.version = await run('claude', ['--version']);
  } catch {
    // version check is non-critical
  }

  return dep;
}

async function checkClaudeAuth(): Promise<boolean> {
  try {
    // Check auth status without requiring bypass permissions.
    // "claude auth status" exits 0 if authenticated, non-zero otherwise.
    const out = await run('claude', ['auth', 'status']);
    // If the output contains "authenticated" or "logged in", we're good
    return true;
  } catch {
    return false;
  }
}

async function checkClaudeBypass(): Promise<boolean> {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);

    // Check for bypassPermissions mode
    if (settings.defaultMode === 'bypassPermissions') return true;

    // Check for autoApprove wildcard
    if (Array.isArray(settings.autoApprove) && settings.autoApprove.includes('*')) return true;

    // Check permissions.allow with Bash(*) style
    if (settings.permissions?.allow) {
      const allow = settings.permissions.allow;
      if (Array.isArray(allow) && (allow.includes('*') || allow.includes('Bash(*)'))) return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function checkGit(): Promise<DepCheck> {
  const dep: DepCheck = { name: 'git', found: false };
  try {
    await run('which', ['git']);
    dep.found = true;
  } catch {
    dep.error = 'Git not found';
    dep.fix = 'Install Git from https://git-scm.com or run: brew install git';
    dep.fixUrl = 'https://git-scm.com/downloads';
    return dep;
  }

  try {
    const out = await run('git', ['--version']);
    dep.version = out.replace('git version ', '');
  } catch { /* non-critical */ }

  return dep;
}

async function checkBash(): Promise<DepCheck> {
  const dep: DepCheck = { name: 'bash', found: false };
  try {
    await run('which', ['bash']);
    dep.found = true;
  } catch {
    dep.error = 'Bash not found';
    dep.fix = 'Bash should be pre-installed on macOS and Linux';
    return dep;
  }

  try {
    const out = await run('bash', ['--version']);
    const match = out.match(/version\s+([\d.]+)/);
    if (match) dep.version = match[1];
  } catch { /* non-critical */ }

  return dep;
}

export async function checkEnvironment(): Promise<EnvCheckResult> {
  const [claude, git, bash] = await Promise.all([
    checkClaude(),
    checkGit(),
    checkBash(),
  ]);

  let claudeAuthenticated = false;
  let claudeBypassMode = false;

  if (claude.found) {
    [claudeAuthenticated, claudeBypassMode] = await Promise.all([
      checkClaudeAuth(),
      checkClaudeBypass(),
    ]);

    if (!claudeAuthenticated) {
      claude.error = 'Claude CLI not authenticated';
      claude.fix = 'Run: claude auth';
    } else if (!claudeBypassMode) {
      claude.warning = 'Permissions bypass not configured — Claude may pause for confirmations';
      claude.fix = 'Run: claude config set -g bypassPermissions true';
    }
  }

  const deps = [claude, git, bash];
  // Ready if claude is found + authenticated, and bash is present. Bypass mode is optional.
  const ready = claude.found && claudeAuthenticated && bash.found;

  return { deps, claudeAuthenticated, claudeBypassMode, ready };
}
