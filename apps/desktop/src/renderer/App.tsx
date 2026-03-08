import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Theme, ThemeContext } from './theme';
import WelcomePage from './components/WelcomePage';
import ActivityBar, { SidePanel } from './components/ActivityBar';
import ExplorerPanel from './components/ExplorerPanel';
import CreatorPanel from './components/CreatorPanel';
import CanvasPanel from './canvas/CanvasPanel';
import RichTextPanel from './richtext/RichTextPanel';
import TerminalPanel from './components/TerminalPanel';
import RunTerminalPanel from './components/RunTerminalPanel';
import ChangesPanel from './components/ChangesPanel';
import CodeEditorPanel from './codeeditor/CodeEditorPanel';
import OnboardingOverlay from './components/OnboardingOverlay';
import SetupDialog from './components/SetupDialog';
import { ToastProvider, useToast } from './components/Toast';
import type { ActionStatus } from './hooks/useActionRunner';
import type { EnvCheckResult } from '../shared/types';
import { useChangeTracking } from './hooks/useChangeTracking';
import { useWorkspace } from './hooks/useWorkspace';
import { useTerminal } from './hooks/useTerminal';
import { useActionRunner } from './hooks/useActionRunner';
import { useRunTerminal } from './hooks/useRunTerminal';
import { useResizable } from './hooks/useResizable';
import { useActivityFeed } from './hooks/useActivityFeed';
import ActivityPanel from './components/ActivityPanel';
import { findSection } from './sections';
import { Button } from './components/ui/button';
import { cn } from '@/lib/utils';

/** Auto-refresh interval (ms) for the design panel while the terminal is active. */
const CREATOR_REFRESH_INTERVAL_MS = 3000;

const ONBOARDING_KEY = 'jamo-has-seen-onboarding';

/** Fires a toast when an action completes or errors. Must be rendered inside ToastProvider. */
function ActionToast({ status, label }: { status: ActionStatus; label: string }) {
  const { toast } = useToast();
  const prevStatus = useRef<ActionStatus>('idle');

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev !== 'running') return;

    if (status === 'done') {
      toast({ title: label, description: 'Completed successfully', variant: 'success' });
    } else if (status === 'error') {
      toast({ title: label, description: 'Something went wrong — check terminal output', variant: 'error' });
    }
  }, [status, label, toast]);

  return null;
}

/** Shared resize handle component. */
function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1.5 shrink-0 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors"
    />
  );
}

export default function App() {
  // -- Theme ------------------------------------------------------------------
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const themeCtx = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  // -- Workspace --------------------------------------------------------------
  const workspace = useWorkspace();

  // -- Panels -----------------------------------------------------------------
  const [activePanel, setActivePanel] = useState<SidePanel | null>('explorer');

  // -- Resizable sidebar & terminal -------------------------------------------
  const sidebar = useResizable({ defaultWidth: 240, minWidth: 160, maxWidth: 600, storageKey: 'jamo-sidebar-width' });
  const terminalResize = useResizable({ defaultWidth: 480, minWidth: 200, maxWidth: 900, storageKey: 'jamo-terminal-width' });

  // -- Change tracking (replaces useSyncStatus) -------------------------------
  const changeTracking = useChangeTracking(workspace.workspaceId);

  const handleCommit = useCallback(() => {
    changeTracking.resetAfterCommit();
  }, [changeTracking.resetAfterCommit]);

  // -- Terminal ---------------------------------------------------------------
  const terminal = useTerminal();

  // -- Action runner ----------------------------------------------------------
  const { actionStatus, actionLabel, sendActionToTerminal } = useActionRunner(
    workspace.workspaceId,
    terminal.terminalSessionId,
    terminal.terminalOpen,
    terminal.openTerminal,
  );

  // -- Activity feed -----------------------------------------------------------
  const activityFeed = useActivityFeed(workspace.workspaceId, actionStatus, actionLabel);

  // Mark action ran when it completes successfully.
  useEffect(() => {
    if (actionStatus === 'done') {
      changeTracking.markActionRan();
    }
  }, [actionStatus, changeTracking.markActionRan]);

  // -- Run terminal -----------------------------------------------------------
  const run = useRunTerminal(terminal.terminalOpen, terminal.openTerminal);

  // -- Mount terminal (hidden) when action starts so session stays alive ------
  useEffect(() => {
    if (actionStatus === 'running') {
      terminal.mountTerminal();
    }
  }, [actionStatus, terminal.mountTerminal]);

  // -- Auto-refresh design panel while terminal is active ---------------------
  useEffect(() => {
    if (!terminal.terminalSessionId) return;
    const interval = setInterval(workspace.refreshCreator, CREATOR_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [terminal.terminalSessionId, workspace.refreshCreator]);

  // -- Onboarding -------------------------------------------------------------
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  }, []);

  // -- Environment setup dialog ------------------------------------------------
  const [setupResult, setSetupResult] = useState<EnvCheckResult | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const pendingRetryRef = useRef<{ prompt: string; label: string } | null>(null);

  const gatedSendAction = useCallback(async (prompt: string, label: string) => {
    const result = await sendActionToTerminal(prompt, label);
    if (result) {
      // Env check failed — show dialog and remember the action for retry
      setSetupResult(result);
      setSetupOpen(true);
      pendingRetryRef.current = { prompt, label };
    }
  }, [sendActionToTerminal]);

  const handleSetupRecheck = useCallback(async () => {
    const result = await window.jamo.checkEnvironment();
    setSetupResult(result);
    if (result.ready) {
      setSetupOpen(false);
      // Retry the pending action
      if (pendingRetryRef.current) {
        const { prompt, label } = pendingRetryRef.current;
        pendingRetryRef.current = null;
        sendActionToTerminal(prompt, label);
      }
    }
  }, [sendActionToTerminal]);

  const handleSetupDismiss = useCallback(() => {
    setSetupOpen(false);
    pendingRetryRef.current = null;
  }, []);

  // -- Action props shared by CreatorPanel and ExplorerPanel -------------------
  const actionRunning = actionStatus === 'running';
  const terminalReady = !!terminal.terminalSessionId;

  // -- No workspace → welcome screen -----------------------------------------
  if (!workspace.workspaceId) {
    return (
      <ThemeContext.Provider value={themeCtx}>
        <ToastProvider>
          <div className="flex h-screen bg-background text-foreground">
            <WelcomePage
              onOpenFolder={() => workspace.openWorkspace()}
              onCreateEmpty={workspace.createEmptyProject}
              onCreateSample={workspace.createSampleProject}
              recentWorkspaces={workspace.recentWorkspaces}
              onOpenRecent={(path) => workspace.openWorkspace(path)}
            />
          </div>
        </ToastProvider>
      </ThemeContext.Provider>
    );
  }

  const showSidebar = activePanel && activePanel !== 'changes';
  const showActivityPanel = activityFeed.visible;
  const showTerminalPanel = terminal.terminalMounted && terminal.terminalOpen && !showActivityPanel;
  const showRightPanel = showActivityPanel || showTerminalPanel;

  // -- Main layout ------------------------------------------------------------
  return (
    <ThemeContext.Provider value={themeCtx}>
      <ToastProvider>
        <div className="flex h-screen bg-background text-foreground">
          {/* Activity Bar */}
          <ActivityBar
            activePanel={activePanel}
            onPanelChange={(p) => setActivePanel(activePanel === p ? null : p)}
          />

          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top bar */}
            <div className="flex items-center px-3 py-1 border-b gap-2 shrink-0">
              <span className="text-xs text-foreground-muted">
                {workspace.openFile
                  ? (findSection(workspace.openFile)?.label ?? workspace.openFile.split('/').pop()?.replace(/\.json$/, ''))
                  : 'Jamo Studio'}
              </span>

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
              <Button variant="ghost" size="sm" onClick={run.handleRun} title={run.runState === 'running' ? 'Rerun (make run)' : 'Run (make run)'} className="text-foreground-muted text-[11px] h-7">
                {run.runState === 'running' ? '▶ Rerun' : '▶ Run'}
              </Button>
              <Button variant="ghost" size="sm" onClick={run.handleStop} disabled={run.runState === 'idle'} title="Stop running process" className="text-foreground-muted text-[11px] h-7">
                ■ Stop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => workspace.openWorkspace()} title="Open Project" className="text-foreground-muted text-[11px] h-7">
                Open Project
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (showActivityPanel) { activityFeed.dismiss(); terminal.openTerminal(); } else { terminal.toggleTerminal(); } }} title={terminal.terminalOpen ? 'Close terminal' : 'Open terminal'} className={cn('text-[11px] h-7', (terminal.terminalOpen || showActivityPanel) && 'text-accent')}>
                Terminal
              </Button>
            </div>

            {/* Main content row: sidebar | resize | editor | resize | terminal */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              {showSidebar && (
                <>
                  <div className="shrink-0 overflow-hidden border-r" style={{ width: sidebar.width }}>
                    {activePanel === 'explorer' && (
                      <ExplorerPanel
                        workspaceId={workspace.workspaceId}
                        onOpenFile={workspace.handleOpenFile}
                        onFileDeleted={workspace.handleFileDeleted}
                        activeFile={workspace.openFile}
                        onExecuteAction={gatedSendAction}
                        terminalReady={terminalReady}
                        actionRunning={actionRunning}
                      />
                    )}
                    {activePanel === 'creator' && (
                      <CreatorPanel
                        workspaceId={workspace.workspaceId}
                        activeFile={workspace.openFile}
                        onOpenFile={workspace.handleOpenCreatorFile}
                        onFileDeleted={workspace.handleFileDeleted}
                        refreshKey={workspace.creatorRefreshKey}
                        onExecuteAction={gatedSendAction}
                        terminalReady={terminalReady}
                        actionRunning={actionRunning}
                      />
                    )}
                  </div>
                  <ResizeHandle onMouseDown={(e) => sidebar.startDrag(e, 1)} />
                </>
              )}

              {/* Editor / Changes */}
              <div className="flex-1 overflow-hidden relative min-w-0">
                {activePanel === 'changes' ? (
                  <ChangesPanel
                    workspaceId={workspace.workspaceId}
                    files={changeTracking.files}
                    isClean={changeTracking.isClean}
                    loading={changeTracking.loading}
                    derivedMode={changeTracking.derivedMode}
                    actionRanSinceLastCommit={changeTracking.actionRanSinceLastCommit}
                    onCommit={handleCommit}
                    onRefresh={changeTracking.refresh}
                  />
                ) : workspace.openFile ? (
                  findSection(workspace.openFile)?.editorType === 'richtext' ? (
                    <RichTextPanel
                      workspaceId={workspace.workspaceId}
                      filePath={workspace.openFile}
                      onClose={workspace.handleCloseFile}
                    />
                  ) : workspace.openFile.startsWith('.jamo/creator/') ? (
                    <CanvasPanel
                      workspaceId={workspace.workspaceId}
                      filePath={workspace.openFile}
                      onClose={workspace.handleCloseFile}
                      onFileRenamed={workspace.handleFileRenamed}
                    />
                  ) : (
                    <CodeEditorPanel
                      workspaceId={workspace.workspaceId}
                      filePath={workspace.openFile}
                      onClose={workspace.handleCloseFile}
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-foreground-dim text-[13px]">
                    Select a file from the sidebar to get started
                  </div>
                )}
              </div>

              {/* Right panel: Activity or Terminal */}
              {showRightPanel && (
                <>
                  <ResizeHandle onMouseDown={(e) => terminalResize.startDrag(e, -1)} />
                  <div className="shrink-0 overflow-hidden flex flex-col" style={{ width: terminalResize.width }}>
                    {showActivityPanel && (
                      <ActivityPanel
                        entries={activityFeed.entries}
                        phase={activityFeed.phase}
                        summaryMessage={activityFeed.summaryMessage}
                        actionLabel={actionLabel}
                        onFileClick={workspace.handleOpenFile}
                        onDismiss={activityFeed.dismiss}
                      />
                    )}
                    {terminal.terminalMounted && (
                      <div className={cn('flex-1 flex flex-col overflow-hidden', showActivityPanel && 'hidden')}>
                        {/* Tab bar */}
                        <div className="px-2 py-1 border-b border-l flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => terminal.setActiveTerminalTab('claude')}
                            className={cn(
                              'px-2 py-0.5 text-[11px] font-semibold uppercase rounded',
                              terminal.activeTerminalTab === 'claude'
                                ? 'text-foreground bg-background-deep'
                                : 'text-foreground-dim hover:text-foreground-muted',
                            )}
                          >
                            Terminal
                          </button>
                          {run.runTerminalMounted && (
                            <button
                              onClick={() => terminal.setActiveTerminalTab('run')}
                              className={cn(
                                'px-2 py-0.5 text-[11px] font-semibold uppercase rounded',
                                terminal.activeTerminalTab === 'run'
                                  ? 'text-foreground bg-background-deep'
                                  : 'text-foreground-dim hover:text-foreground-muted',
                              )}
                            >
                              Run
                              {run.runState === 'running' && <span className="ml-1 text-success">●</span>}
                            </button>
                          )}
                          <div className="flex-1" />
                          <button
                            onClick={terminal.closeTerminal}
                            title="Close terminal"
                            className="h-6 w-6 flex items-center justify-center text-foreground-muted hover:text-foreground"
                          >
                            <span className="text-sm leading-none">&times;</span>
                          </button>
                        </div>

                        {/* Claude terminal */}
                        <div className={cn('flex-1 overflow-hidden', terminal.activeTerminalTab !== 'claude' && 'hidden')}>
                          <TerminalPanel
                            workspaceId={workspace.workspaceId}
                            onClose={terminal.closeTerminal}
                            onSessionReady={terminal.handleSessionReady}
                            onSessionEnd={terminal.handleSessionEnd}
                            showHeader={false}
                          />
                        </div>

                        {/* Run terminal */}
                        {run.runTerminalMounted && (
                          <div className={cn('flex-1 overflow-hidden', terminal.activeTerminalTab !== 'run' && 'hidden')}>
                            <RunTerminalPanel
                              workspaceId={workspace.workspaceId}
                              onSessionReady={run.handleRunSessionReady}
                              onSessionEnd={run.handleRunSessionEnd}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action completion toast */}
        <ActionToast status={actionStatus} label={actionLabel} />

        {/* Environment setup dialog */}
        {setupResult && (
          <SetupDialog
            open={setupOpen}
            result={setupResult}
            onRecheck={handleSetupRecheck}
            onDismiss={handleSetupDismiss}
          />
        )}

        {/* First-run onboarding */}
        {showOnboarding && <OnboardingOverlay onComplete={handleOnboardingComplete} />}
      </ToastProvider>
    </ThemeContext.Provider>
  );
}
