import React, { useState, useRef } from 'react';
import { useTheme } from '../theme';
import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

interface WelcomePageProps {
  onOpenFolder: () => void;
  onCreateEmpty: (dirPath: string) => void;
  onCreateSample: (dirPath: string) => void;
  recentWorkspaces: RecentWorkspace[];
  onOpenRecent: (path: string) => void;
}

export type { RecentWorkspace };

type CreateMode = 'empty' | 'sample';

export default function WelcomePage({ onOpenFolder, onCreateEmpty, onCreateSample, recentWorkspaces, onOpenRecent }: WelcomePageProps) {
  const { theme, toggleTheme } = useTheme();
  const [warnPath, setWarnPath] = useState<string | null>(null);
  const pendingMode = useRef<CreateMode>('empty');

  const pickAndCreate = async (mode: CreateMode) => {
    const dir = await window.jamo.selectDirectory();
    if (!dir) return;

    const isEmpty = await window.jamo.checkDirEmpty(dir);
    if (isEmpty) {
      (mode === 'sample' ? onCreateSample : onCreateEmpty)(dir);
    } else {
      pendingMode.current = mode;
      setWarnPath(dir);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!warnPath) return;
    const mode = pendingMode.current;
    await window.jamo.clearDir(warnPath);
    setWarnPath(null);
    (mode === 'sample' ? onCreateSample : onCreateEmpty)(warnPath);
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full gap-6 p-10">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-md text-foreground-muted hover:text-foreground hover:bg-accent-bg transition-colors"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Logo / Title */}
      <div className="text-center mb-4 flex flex-col items-center">
        <img src="/icon.png" alt="Jamo" className="w-16 h-16 mb-2" />
        <div className="text-[22px] font-semibold text-foreground mt-1">Jamo Studio</div>
      </div>

      {/* Primary actions */}
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <Button onClick={() => pickAndCreate('empty')} className="w-full text-[15px] font-semibold">
          Create Empty Workspace
        </Button>
        <Button onClick={() => pickAndCreate('sample')} variant="outline" className="w-full text-[15px] font-semibold">
          Create Sample Workspace
        </Button>
        <Button onClick={onOpenFolder} variant="outline" className="w-full text-[15px] font-semibold">
          Open Workspace
        </Button>
      </div>

      {/* Recent workspaces */}
      {recentWorkspaces.length > 0 && (
        <div className="w-full max-w-[400px] mt-4">
          <div className="text-[13px] font-semibold text-foreground-muted mb-3">Workspaces</div>
          <div className="flex flex-col gap-1">
            {recentWorkspaces.map((ws) => {
              const parts = ws.path.split('/');
              const parent = parts.length > 1 ? parts.slice(0, -1).join('/').replace(/^\/Users\/[^/]+/, '~') : '';
              return (
                <button
                  key={ws.path}
                  onClick={() => onOpenRecent(ws.path)}
                  className="flex flex-col items-start px-4 py-2.5 bg-transparent border border-border rounded-md text-foreground cursor-pointer text-left w-full hover:bg-accent-bg transition-colors"
                >
                  <span className="text-[13px] font-medium">{ws.name}</span>
                  <span className="text-[11px] text-foreground-muted mt-0.5">{parent}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-empty directory warning */}
      <AlertDialog open={!!warnPath} onOpenChange={(open) => { if (!open) setWarnPath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Directory is not empty</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{warnPath}</span> contains existing files.
              All files in this directory will be deleted and replaced with a new Jamo project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete &amp; Create Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
