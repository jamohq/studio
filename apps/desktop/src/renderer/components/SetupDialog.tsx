import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import type { EnvCheckResult, DepCheck } from '../../shared/types';

interface SetupDialogProps {
  open: boolean;
  result: EnvCheckResult;
  onRecheck: () => void;
  onDismiss: () => void;
}

function StatusIcon({ status }: { status: 'ok' | 'error' | 'warning' }) {
  if (status === 'ok') return <span className="text-success">{'\u2713'}</span>;
  if (status === 'warning') return <span className="text-warning">{'\u26A0'}</span>;
  return <span className="text-destructive">{'\u2717'}</span>;
}

function DepRow({ dep }: { dep: DepCheck }) {
  const hasError = !!dep.error;
  const hasWarning = !hasError && !!dep.warning;
  const status = hasError ? 'error' : hasWarning ? 'warning' : 'ok';
  const message = dep.error || dep.warning;
  const showFix = hasError || hasWarning;

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="font-medium text-sm">{dep.name}</span>
        {dep.version && (
          <span className="text-xs text-foreground-dim ml-auto">{dep.version}</span>
        )}
      </div>
      {message && (
        <div className="ml-6 text-xs text-foreground-muted">{message}</div>
      )}
      {dep.fix && showFix && (
        <div className="ml-6">
          <code className="text-xs bg-background-deep px-1.5 py-0.5 rounded select-all">
            {dep.fix}
          </code>
        </div>
      )}
      {dep.fixUrl && showFix && (
        <button
          onClick={() => window.jamo.openExternal(dep.fixUrl!)}
          className="ml-6 text-xs text-accent hover:underline text-left w-fit"
        >
          Installation guide
        </button>
      )}
    </div>
  );
}

export default function SetupDialog({ open, result, onRecheck, onDismiss }: SetupDialogProps) {
  const [checking, setChecking] = useState(false);

  const handleRecheck = async () => {
    setChecking(true);
    try {
      onRecheck();
    } finally {
      // Parent will update result; small delay for UX
      setTimeout(() => setChecking(false), 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Environment Setup</DialogTitle>
          <DialogDescription>
            Some dependencies need to be configured before running actions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          {result.deps.map((dep) => (
            <DepRow key={dep.name} dep={dep} />
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={handleRecheck} disabled={checking}>
            {checking ? 'Checking...' : 'Recheck'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
