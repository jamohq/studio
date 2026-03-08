import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Theme, ThemeContext } from './theme';
import WelcomePage, { RecentWorkspace } from './components/WelcomePage';
import ActivityBar, { SidePanel } from './components/ActivityBar';
import ExplorerPanel from './components/ExplorerPanel';
import CreatorPanel from './components/CreatorPanel';
import CanvasPanel from './canvas/CanvasPanel';
import RichTextPanel from './richtext/RichTextPanel';
import TerminalPanel from './components/TerminalPanel';
import RunTerminalPanel from './components/RunTerminalPanel';
import ActionsPanel from './components/ActionsPanel';
import ChangesPanel from './components/ChangesPanel';
import { useSyncStatus } from './hooks/useSyncStatus';
import { createPortfolioScaffold, createEmptyScaffold, ScaffoldResult } from './scaffold';
import { findSection } from './sections';
import { Button } from './components/ui/button';
import { cn } from '@/lib/utils';

/** UTF-8 safe base64 encode (btoa only handles Latin1). */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Send a shell command to a terminal session and press Enter. */
function sendShellCommand(sessionId: string, cmd: string): void {
  window.jamo.sendTerminalInput(sessionId, toBase64(cmd + '\r'));
}

/** Polling interval (ms) for checking action completion via exit-status file. */
const ACTION_POLL_MS = 2000;

const RECENT_WS_KEY = 'jamo-recent-workspaces';
const MAX_RECENT = 10;

function loadRecentWorkspaces(): RecentWorkspace[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_WS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentWorkspace(path: string) {
  const name = path.split('/').pop() || path;
  const existing = loadRecentWorkspaces().filter((w) => w.path !== path);
  const updated = [{ path, name, openedAt: Date.now() }, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_WS_KEY, JSON.stringify(updated));
  return updated;
}

export default function App() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel | null>('explorer');
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [creatorRefreshKey, setCreatorRefreshKey] = useState(0);
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(null);
  const pendingActionRef = useRef<string | null>(null);
  const [runState, setRunState] = useState<'idle' | 'running'>('idle');
  const [runSessionId, setRunSessionId] = useState<string | null>(null);
  const [runTerminalMounted, setRunTerminalMounted] = useState(false);
  const [activeTerminalTab, setActiveTerminalTab] = useState<'claude' | 'run'>('claude');
  const pendingRunRef = useRef(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);
  const { mode: syncMode, lastAction, setMode: setSyncMode } = useSyncStatus(workspaceId);
  const [actionStatus, setActionStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [actionLabel, setActionLabel] = useState('');

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('jamo-theme') as Theme) || 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jamo-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  // Set initial dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const themeCtx = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  const openWorkspace = useCallback(async (dirPath?: string) => {
    try {
      const path = dirPath || await window.jamo.selectDirectory();
      if (!path) return;
      const res = await window.jamo.openWorkspace(path);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);
      setActivePanel('explorer');
    } catch (err: any) {
      console.error('Failed to open workspace:', err);
    }
  }, []);

  const scaffoldAndOpen = useCallback(async (dirPath: string, scaffold: ScaffoldResult) => {
    try {
      const res = await window.jamo.openWorkspace(dirPath);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);
      setActivePanel('creator');

      for (const file of scaffold.files) {
        await window.jamo.writeFile(res.workspaceId, file.path, JSON.stringify(file.content, null, 2));
      }

      // Write binary files (images, etc.)
      for (const bin of scaffold.binaryFiles) {
        try {
          const resp = await fetch(bin.fetchUrl);
          const blob = await resp.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const b64 = btoa(binary);
          await window.jamo.writeFileBinary(res.workspaceId, bin.path, b64);
        } catch (err) {
          console.warn(`Failed to write binary file ${bin.path}:`, err);
        }
      }

      await window.jamo.gitInit(res.workspaceId);
      await window.jamo.gitCommit(res.workspaceId, 'Initial project scaffold');

      setCreatorRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('Failed to create project:', err);
    }
  }, []);

  const createEmptyProject = useCallback((dirPath: string) => {
    return scaffoldAndOpen(dirPath, createEmptyScaffold());
  }, [scaffoldAndOpen]);

  const createSampleProject = useCallback((dirPath: string) => {
    return scaffoldAndOpen(dirPath, createPortfolioScaffold());
  }, [scaffoldAndOpen]);


  const handleOpenCreatorFile = useCallback((relPath: string) => {
    setOpenFile(relPath);
  }, []);

  const handleCloseFile = useCallback(() => {
    setOpenFile(null);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileRenamed = useCallback((oldPath: string, newPath: string) => {
    setOpenFile(newPath);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileDeleted = useCallback((relPath: string) => {
    if (openFile === relPath || openFile?.startsWith(relPath + '/')) {
      setOpenFile(null);
    }
    setCreatorRefreshKey((k) => k + 1);
  }, [openFile]);

  const handleToggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => {
      if (!prev) setTerminalMounted(true);
      return !prev;
    });
  }, []);

  const handleSessionReady = useCallback((sessionId: string) => {
    setTerminalSessionId(sessionId);
  }, []);

  const handleSessionEnd = useCallback(() => {
    setTerminalSessionId(null);
  }, []);

  const handleModeChange = useCallback((mode: 'synced' | 'creator_mode' | 'code_mode', actionId: string) => {
    setSyncMode(mode, actionId);
  }, [setSyncMode]);

  const handleCommit = useCallback(() => {
    setSyncMode('synced', null);
  }, [setSyncMode]);

  const handleRun = useCallback(() => {
    setActiveTerminalTab('run');
    if (!terminalOpen) {
      setTerminalMounted(true);
      setTerminalOpen(true);
    }
    if (runState === 'running' && runSessionId) {
      // Rerun: Ctrl+C, wait, then make run
      window.jamo.sendTerminalInput(runSessionId, btoa('\x03'));
      setTimeout(() => {
        if (runSessionId) {
          window.jamo.sendTerminalInput(runSessionId, btoa('make run\r'));
        }
      }, 300);
      return;
    }
    if (runSessionId) {
      window.jamo.sendTerminalInput(runSessionId, btoa('make run\r'));
      setRunState('running');
    } else {
      // Need to mount run terminal first, queue command
      pendingRunRef.current = true;
      setRunTerminalMounted(true);
    }
  }, [runState, runSessionId, terminalOpen]);

  const handleStop = useCallback(() => {
    if (runSessionId) {
      window.jamo.sendTerminalInput(runSessionId, btoa('\x03'));
    }
    setRunState('idle');
  }, [runSessionId]);

  const handleRunSessionReady = useCallback((sessionId: string) => {
    setRunSessionId(sessionId);
    if (pendingRunRef.current) {
      pendingRunRef.current = false;
      setTimeout(() => {
        window.jamo.sendTerminalInput(sessionId, btoa('make run\r'));
        setRunState('running');
      }, 500);
    }
  }, []);

  const handleRunSessionEnd = useCallback(() => {
    setRunSessionId(null);
    setRunState('idle');
  }, []);

  // The command:
  // 1. Removes any stale exit-status file
  // 2. Passes the prompt as a system-prompt addition so it's hidden from the TUI
  // 3. Short user message triggers execution
  // 4. Writes exit code to .jamo/.exit_status for polling
  const CLAUDE_CMD =
    'rm -f .jamo/.exit_status; claude --append-system-prompt "$(cat .jamo/.prompt)" "Begin."; echo $? > .jamo/.exit_status';

  const sendActionToTerminal = useCallback(async (prompt: string, label: string) => {
    if (!workspaceId) return;

    // Write the prompt to a hidden file — never shown in terminal.
    await window.jamo.writeFile(workspaceId, '.jamo/.prompt', prompt);
    // Clean up any stale exit status.
    try { await window.jamo.deleteFile(workspaceId, '.jamo/.exit_status'); } catch { /* ignore */ }

    setActiveTerminalTab('claude');
    setActionStatus('running');
    setActionLabel(label);

    if (!terminalOpen) {
      pendingActionRef.current = CLAUDE_CMD;
      setTerminalMounted(true);
      setTerminalOpen(true);
    } else if (terminalSessionId) {
      // Ctrl+C to kill any running process, then send the command.
      window.jamo.sendTerminalInput(terminalSessionId, toBase64('\x03'));
      setTimeout(() => sendShellCommand(terminalSessionId, CLAUDE_CMD), 200);
    } else {
      pendingActionRef.current = CLAUDE_CMD;
    }
  }, [terminalOpen, terminalSessionId, workspaceId]);

  // When terminal session becomes ready and there's a pending action, send it.
  useEffect(() => {
    if (terminalSessionId && pendingActionRef.current) {
      const cmd = pendingActionRef.current;
      pendingActionRef.current = null;
      const timer = setTimeout(() => {
        sendShellCommand(terminalSessionId, cmd);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [terminalSessionId]);

  // Poll .jamo/.exit_status to detect when the action finishes.
  useEffect(() => {
    if (actionStatus !== 'running' || !workspaceId) return;

    const interval = setInterval(async () => {
      try {
        const res = await window.jamo.readFile(workspaceId, '.jamo/.exit_status');
        const code = parseInt(res.content.trim(), 10);
        if (!isNaN(code)) {
          setActionStatus(code === 0 ? 'done' : 'error');
          setTimeout(() => setActionStatus((s) => (s === 'done' || s === 'error' ? 'idle' : s)), 6000);
        }
      } catch {
        // File doesn't exist yet — action still running.
      }
    }, ACTION_POLL_MS);

    return () => clearInterval(interval);
  }, [actionStatus, workspaceId]);

  // Auto-refresh creator panel while terminal is active
  useEffect(() => {
    if (!terminalSessionId) return;
    const interval = setInterval(() => {
      setCreatorRefreshKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [terminalSessionId]);

  // No workspace -> welcome screen
  if (!workspaceId) {
    return (
      <ThemeContext.Provider value={themeCtx}>
        <div className="flex h-screen bg-background text-foreground">
          <WelcomePage
            onOpenFolder={() => openWorkspace()}
            onCreateEmpty={createEmptyProject}
            onCreateSample={createSampleProject}
            recentWorkspaces={recentWorkspaces}
            onOpenRecent={(path) => openWorkspace(path)}
          />
        </div>
      </ThemeContext.Provider>
    );
  }

  // Workspace open -> VS Code-like layout
  return (
    <ThemeContext.Provider value={themeCtx}>
      <div className="flex h-screen bg-background text-foreground">
        {/* Activity Bar */}
        <ActivityBar activePanel={activePanel} onPanelChange={(p) => setActivePanel(activePanel === p ? null : p)} />

        {/* Side Panel */}
        {activePanel && activePanel !== 'changes' && (
          <div className="w-60 border-r overflow-hidden shrink-0">
            {activePanel === 'explorer' && <ExplorerPanel workspaceId={workspaceId} />}
            {activePanel === 'creator' && <CreatorPanel workspaceId={workspaceId} activeFile={openFile} onOpenFile={handleOpenCreatorFile} onFileDeleted={handleFileDeleted} refreshKey={creatorRefreshKey} />}
            {activePanel === 'actions' && <ActionsPanel workspaceId={workspaceId} onExecuteAction={sendActionToTerminal} terminalReady={!!terminalSessionId} syncMode={syncMode} onModeChange={handleModeChange} />}
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top bar */}
          <div className="flex items-center px-3 py-1 border-b gap-2 shrink-0">
            <span className="text-xs text-foreground-muted">
              {openFile
                ? (findSection(openFile)?.label ?? openFile.split('/').pop()?.replace(/\.json$/, ''))
                : 'Jamo Studio'}
            </span>

            {/* Action running indicator */}
            {actionStatus === 'running' && (
              <span className="flex items-center gap-1.5 text-[11px] text-accent font-medium ml-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                {actionLabel}...
              </span>
            )}

            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              title={runState === 'running' ? 'Rerun (make run)' : 'Run (make run)'}
              className="text-foreground-muted text-[11px] h-7"
            >
              {runState === 'running' ? '▶ Rerun' : '▶ Run'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              disabled={runState === 'idle'}
              title="Stop running process"
              className="text-foreground-muted text-[11px] h-7"
            >
              ■ Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openWorkspace()}
              title="Open Folder"
              className="text-foreground-muted text-[11px] h-7"
            >
              Open Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleTerminal}
              title={terminalOpen ? 'Close terminal' : 'Open terminal'}
              className={cn(
                'text-[11px] h-7',
                terminalOpen && 'text-accent',
              )}
            >
              Terminal
            </Button>
          </div>

          {/* Editor + Terminal side-by-side */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor / Changes */}
            <div className="flex-1 overflow-hidden">
              {activePanel === 'changes' ? (
                <ChangesPanel workspaceId={workspaceId} syncMode={syncMode} lastAction={lastAction} onCommit={handleCommit} />
              ) : openFile ? (
                findSection(openFile)?.editorType === 'richtext' ? (
                  <RichTextPanel workspaceId={workspaceId} filePath={openFile} onClose={handleCloseFile} readOnly={syncMode === 'code_mode' && openFile.startsWith('.jamo/creator/')} />
                ) : (
                  <CanvasPanel workspaceId={workspaceId} filePath={openFile} onClose={handleCloseFile} onFileRenamed={handleFileRenamed} readOnly={syncMode === 'code_mode' && openFile.startsWith('.jamo/creator/')} />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-foreground-dim text-[13px]">
                  Select a file from the sidebar to get started
                </div>
              )}
            </div>

            {/* Terminal (right side - stays mounted once opened to preserve session) */}
            {terminalMounted && (
              <div
                className={cn('shrink-0 overflow-hidden flex flex-col', !terminalOpen && 'hidden')}
                style={{ width: 480 }}
              >
                {/* Tab bar */}
                <div className="px-2 py-1 border-b border-l flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setActiveTerminalTab('claude')}
                    className={cn(
                      'px-2 py-0.5 text-[11px] font-semibold uppercase rounded',
                      activeTerminalTab === 'claude' ? 'text-foreground bg-background-deep' : 'text-foreground-dim hover:text-foreground-muted',
                    )}
                  >
                    Terminal
                  </button>
                  {runTerminalMounted && (
                    <button
                      onClick={() => setActiveTerminalTab('run')}
                      className={cn(
                        'px-2 py-0.5 text-[11px] font-semibold uppercase rounded',
                        activeTerminalTab === 'run' ? 'text-foreground bg-background-deep' : 'text-foreground-dim hover:text-foreground-muted',
                      )}
                    >
                      Run
                      {runState === 'running' && <span className="ml-1 text-success">●</span>}
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => setTerminalOpen(false)}
                    title="Close terminal"
                    className="h-6 w-6 flex items-center justify-center text-foreground-muted hover:text-foreground"
                  >
                    <span className="text-sm leading-none">&times;</span>
                  </button>
                </div>
                {/* Claude terminal */}
                <div className={cn('flex-1 overflow-hidden', activeTerminalTab !== 'claude' && 'hidden')}>
                  <TerminalPanel workspaceId={workspaceId} onClose={() => setTerminalOpen(false)} onSessionReady={handleSessionReady} onSessionEnd={handleSessionEnd} showHeader={false} />
                </div>
                {/* Run terminal */}
                {runTerminalMounted && (
                  <div className={cn('flex-1 overflow-hidden', activeTerminalTab !== 'run' && 'hidden')}>
                    <RunTerminalPanel workspaceId={workspaceId} onSessionReady={handleRunSessionReady} onSessionEnd={handleRunSessionEnd} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Action completion toast */}
        {(actionStatus === 'done' || actionStatus === 'error') && (
          <div
            className={cn(
              'fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border',
              actionStatus === 'done' && 'bg-background border-success/40 text-success',
              actionStatus === 'error' && 'bg-background border-destructive/40 text-destructive',
            )}
          >
            <span>{actionStatus === 'done' ? '✓' : '✗'}</span>
            <span>{actionLabel} {actionStatus === 'done' ? 'completed' : 'failed'}</span>
            <button
              onClick={() => setActionStatus('idle')}
              className="ml-2 opacity-60 hover:opacity-100 text-foreground-muted"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}
