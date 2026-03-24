import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/** Env vars to strip when spawning child processes. */
const STRIP_ENV_VARS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'];

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of STRIP_ENV_VARS) {
    delete env[key];
  }
  return env;
}

export interface ClaudeRunOptions {
  prompt: string;
  cwd: string;
  sessionId?: string;
  systemPrompt?: string;
}

export interface ClaudeRunResult {
  emitter: EventEmitter;
  kill: () => void;
}

/**
 * Spawns `claude -p` as a child process with stream-json output.
 *
 * Emits events on the returned EventEmitter:
 * - `text` (delta: string) — streaming text content
 * - `tool_use` ({ name: string; input: string }) — tool usage for UI display
 * - `file_change` (path: string) — file modified via Edit/Write
 * - `complete` () — process finished successfully
 * - `error` (message: string) — process errored
 */
export function runClaude(opts: ClaudeRunOptions): ClaudeRunResult {
  const emitter = new EventEmitter();

  const args = [
    '-p', opts.prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--max-turns', '50',
  ];

  if (opts.sessionId) {
    args.push('--resume', opts.sessionId);
  }

  if (opts.systemPrompt) {
    args.push('--append-system-prompt', opts.systemPrompt);
  }

  let proc: ChildProcess;
  try {
    proc = spawn('claude', args, {
      cwd: opts.cwd,
      env: cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    // Deferred error emission so caller can attach listeners
    setTimeout(() => emitter.emit('error', err.message || String(err)), 0);
    return { emitter, kill: () => {} };
  }

  let sessionId: string | undefined;
  let buffer = '';

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        handleStreamMessage(emitter, msg, (sid) => { sessionId = sid; }, opts.cwd);
      } catch {
        // Not JSON — ignore
      }
    }
  });

  let stderrOutput = '';
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrOutput += chunk.toString('utf-8');
  });

  proc.on('close', (code) => {
    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer);
        handleStreamMessage(emitter, msg, (sid) => { sessionId = sid; }, opts.cwd);
      } catch { /* ignore */ }
    }

    if (code === 0 || code === null) {
      emitter.emit('complete', sessionId);
    } else {
      const errorMsg = stderrOutput.trim() || `claude process exited with code ${code}`;
      emitter.emit('error', errorMsg);
    }
  });

  proc.on('error', (err) => {
    emitter.emit('error', err.message);
  });

  return {
    emitter,
    kill: () => {
      try {
        proc.kill('SIGINT');
      } catch { /* already dead */ }
    },
  };
}

function handleStreamMessage(
  emitter: EventEmitter,
  msg: any,
  setSessionId: (sid: string) => void,
  cwd: string,
): void {
  // Claude stream-json format has different message types
  // See: https://docs.anthropic.com/en/docs/claude-code/sdk

  if (msg.session_id) {
    setSessionId(msg.session_id);
  }

  switch (msg.type) {
    case 'assistant': {
      // Assistant message with content blocks
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            emitter.emit('text', block.text);
          } else if (block.type === 'tool_use') {
            emitter.emit('tool_use', {
              name: block.name,
              input: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
            });
            // Detect task updates from TodoWrite/TaskCreate/TaskUpdate
            if (block.name === 'TodoWrite' && block.input?.todos) {
              emitter.emit('tasks', block.input.todos);
            }
            if (block.name === 'TaskCreate' && block.input?.subject) {
              emitter.emit('task_create', {
                subject: block.input.subject,
                status: 'pending',
                description: block.input.description,
              });
            }
            if (block.name === 'TaskUpdate' && block.input) {
              emitter.emit('task_update', {
                taskId: block.input.taskId,
                status: block.input.status,
                subject: block.input.subject,
              });
            }

            // Detect file changes from Edit/Write tool calls
            if ((block.name === 'Edit' || block.name === 'Write') && block.input?.file_path) {
              let filePath: string = block.input.file_path;
              // Convert absolute paths to relative (strip cwd prefix)
              const prefix = cwd.endsWith('/') ? cwd : cwd + '/';
              if (filePath.startsWith(prefix)) {
                filePath = filePath.slice(prefix.length);
              }
              emitter.emit('file_change', filePath);
            }
          }
        }
      }
      break;
    }

    case 'content_block_delta': {
      if (msg.delta?.type === 'text_delta' && msg.delta.text) {
        emitter.emit('text', msg.delta.text);
      }
      break;
    }

    case 'result': {
      // Final result message — may contain session_id
      if (msg.session_id) {
        setSessionId(msg.session_id);
      }
      // Result text is already streamed via assistant messages
      break;
    }

    case 'error': {
      emitter.emit('error', msg.error?.message || msg.message || 'Unknown error from Claude');
      break;
    }

    // system, tool_result, etc. — we don't need to surface these
    default:
      break;
  }
}
