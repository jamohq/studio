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

function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'text-success' : 'text-destructive'}>
      {ok ? '\u2713' : '\u2717'}
    </span>
  );
}

function DepRow({ dep, extraError }: { dep: DepCheck; extraError?: string }) {
  const error = extraError || dep.error;
  const ok = dep.found && !extraError;

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <StatusIcon ok={ok} />
        <span className="font-medium text-sm">{dep.name}</span>
        {dep.version && (
          <span className="text-xs text-foreground-dim ml-auto">{dep.version}</span>
        )}
      </div>
      {error && (
        <div className="ml-6 text-xs text-foreground-muted">{error}</div>
      )}
      {dep.fix && !ok && (
        <div className="ml-6">
          <code className="text-xs bg-background-deep px-1.5 py-0.5 rounded select-all">
            {dep.fix}
          </code>
        </div>
      )}
      {dep.fixUrl && !ok && (
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

  const claudeDep = result.deps.find((d) => d.name === 'claude');

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
          {result.deps.map((dep) => {
            // For claude, show auth/bypass errors even if binary is found
            let extraError: string | undefined;
            if (dep.name === 'claude' && dep.found) {
              if (!result.claudeAuthenticated) {
                extraError = dep.error;
              } else if (!result.claudeBypassMode) {
                extraError = dep.error;
              }
            }
            return <DepRow key={dep.name} dep={dep} extraError={extraError} />;
          })}
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
