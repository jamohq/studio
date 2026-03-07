import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

interface WelcomePageProps {
  onOpenFolder: () => void;
  onCreateProject: (parentPath: string, name: string) => void;
  recentWorkspaces: RecentWorkspace[];
  onOpenRecent: (path: string) => void;
}

export type { RecentWorkspace };

export default function WelcomePage({ onOpenFolder, onCreateProject, recentWorkspaces, onOpenRecent }: WelcomePageProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);

  const handlePickLocation = async () => {
    const dir = await window.jamo.selectDirectory();
    if (!dir) return;
    setParentPath(dir);
    setShowCreate(true);
    setProjectName('');
  };

  const handleCreate = () => {
    const name = projectName.trim();
    if (!name || !parentPath) return;
    setShowCreate(false);
    onCreateProject(parentPath, name);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-10">
      {/* Logo / Title */}
      <div className="text-center mb-4">
        <div className="text-5xl font-bold tracking-tight text-foreground">J</div>
        <div className="text-[22px] font-semibold text-foreground mt-1">Jamo Studio</div>
      </div>

      {/* Primary actions */}
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <Button onClick={handlePickLocation} className="w-full text-[15px] font-semibold">
          Create New Project
        </Button>
        <Button onClick={onOpenFolder} variant="outline" className="w-full text-[15px] font-semibold">
          Open Folder
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

      {/* Create project dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              A new folder will be created at: {parentPath ? <span className="font-mono text-foreground">{parentPath}/</span> : '...'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!projectName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
