import React from 'react';
import { Button } from './ui/button';

interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

interface WelcomePageProps {
  onOpenFolder: () => void;
  recentWorkspaces: RecentWorkspace[];
  onOpenRecent: (path: string) => void;
}

export type { RecentWorkspace };

export default function WelcomePage({ onOpenFolder, recentWorkspaces, onOpenRecent }: WelcomePageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-10">
      {/* Logo / Title */}
      <div className="text-center mb-4">
        <div className="text-5xl font-bold tracking-tight text-foreground">J</div>
        <div className="text-[22px] font-semibold text-foreground mt-1">Jamo Studio</div>
      </div>

      {/* Primary action */}
      <Button onClick={onOpenFolder} className="px-12 min-w-[280px] text-[15px] font-semibold">
        Open Folder
      </Button>

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
    </div>
  );
}
