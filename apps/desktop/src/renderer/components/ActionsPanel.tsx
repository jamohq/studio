import React, { useState, useCallback } from 'react';
import type { SyncMode } from '../hooks/useSyncStatus';
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
import { cn } from '@/lib/utils';
import { useToast } from './Toast';
import {
  GENERATE_CREATOR_PROMPT,
  UPDATE_CREATOR_PROMPT,
  GENERATE_CODE_PROMPT,
  UPDATE_CODE_PROMPT,
} from '../prompts';

// ---------------------------------------------------------------------------
// Actions panel — simplified 2-button workflow
// ---------------------------------------------------------------------------

interface ActionsPanelProps {
  workspaceId: string;
  onExecuteAction: (prompt: string, label: string) => void;
  terminalReady: boolean;
  syncMode: SyncMode;
  onModeChange: (mode: SyncMode, actionId: string) => void;
}

export default function ActionsPanel({ workspaceId, onExecuteAction, terminalReady, syncMode, onModeChange }: ActionsPanelProps) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{ label: string; description: string; onConfirm: () => void } | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const markSent = useCallback((id: string) => {
    setSentId(id);
    setTimeout(() => setSentId((prev) => (prev === id ? null : prev)), 3000);
  }, []);

  /** Design → Code: auto-detects generate vs update based on whether source files exist. */
  const handleDesignToCode = useCallback(async () => {
    if (syncMode === 'creator_mode') return; // Must save design changes first.

    // Check if design files exist.
    try {
      const res = await window.jamo.listDirectory(workspaceId, '.jamo/creator');
      const hasJson = res.entries.some((e: any) => e.name.endsWith('.json'));
      if (!hasJson) {
        toast({ title: 'No design files found', description: 'Create designs in the Design panel first.', variant: 'error' });
        return;
      }
    } catch {
      alert('No design files found. Create designs in the Design panel first.');
      return;
    }

    // Detect: are there source files already? If yes → update, if no → generate.
    let hasSourceFiles = false;
    try {
      const res = await window.jamo.listDirectory(workspaceId, '');
      hasSourceFiles = res.entries.some((e: any) => e.name !== '.jamo' && e.name !== '.git' && e.name !== '.gitignore');
    } catch { /* ignore */ }

    const isGenerate = !hasSourceFiles;
    const prompt = isGenerate ? GENERATE_CODE_PROMPT : UPDATE_CODE_PROMPT;
    const label = isGenerate ? 'Generating code' : 'Updating code';
    const actionId = isGenerate ? 'generate-code' : 'update-code';

    const execute = async () => {
      try { await window.jamo.gitInit(workspaceId); } catch { /* ignore */ }
      onModeChange('code_mode', actionId);
      onExecuteAction(prompt, label);
      markSent('design-to-code');
    };

    if (isGenerate) {
      setConfirmAction({
        label: 'Design → Code',
        description: 'This will generate application code from your designs. Existing source files may be overwritten.',
        onConfirm: () => { setConfirmAction(null); execute(); },
      });
    } else {
      execute();
    }
  }, [workspaceId, syncMode, onExecuteAction, onModeChange, markSent]);

  /** Code → Design: auto-detects generate vs update based on whether design files exist. */
  const handleCodeToDesign = useCallback(async () => {
    if (syncMode === 'code_mode') return; // Must save code changes first.

    // Check if source files exist.
    try {
      const res = await window.jamo.listDirectory(workspaceId, '');
      const hasFiles = res.entries.some((e: any) => e.name !== '.jamo' && e.name !== '.git' && e.name !== '.gitignore');
      if (!hasFiles) {
        toast({ title: 'No source files found', description: 'Add code files to the project first.', variant: 'error' });
        return;
      }
    } catch { /* ignore */ }

    // Detect: are there design files already? If yes → update, if no → generate.
    let hasDesignFiles = false;
    try {
      const res = await window.jamo.listDirectory(workspaceId, '.jamo/creator');
      hasDesignFiles = res.entries.some((e: any) => e.name.endsWith('.json'));
    } catch { /* ignore */ }

    const isGenerate = !hasDesignFiles;
    const prompt = isGenerate ? GENERATE_CREATOR_PROMPT : UPDATE_CREATOR_PROMPT;
    const label = isGenerate ? 'Generating designs' : 'Updating designs';
    const actionId = isGenerate ? 'generate-creator' : 'update-creator';

    const execute = async () => {
      try { await window.jamo.gitInit(workspaceId); } catch { /* ignore */ }
      onModeChange('creator_mode', actionId);
      onExecuteAction(prompt, label);
      markSent('code-to-design');
    };

    if (isGenerate) {
      setConfirmAction({
        label: 'Code → Design',
        description: 'This will analyze your code and generate design files from scratch. Existing designs will be replaced.',
        onConfirm: () => { setConfirmAction(null); execute(); },
      });
    } else {
      execute();
    }
  }, [workspaceId, syncMode, onExecuteAction, onModeChange, markSent]);

  const designToCodeDisabled = syncMode === 'creator_mode' ? 'Save design changes first' : null;
  const codeToDesignDisabled = syncMode === 'code_mode' ? 'Save code changes first' : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted">
        Build
      </div>

      {/* Two main actions */}
      <div className="flex-1 overflow-auto px-3 pb-2">
        {/* Design → Code */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-foreground mb-1">Design → Code</h3>
          <p className="text-[11px] text-foreground-muted leading-snug mb-2">
            Generate or update your app's code from your designs.
          </p>
          <Button
            onClick={handleDesignToCode}
            disabled={!!designToCodeDisabled}
            title={designToCodeDisabled || undefined}
            size="sm"
            className={cn(
              'w-full text-[11px] font-semibold h-8',
              sentId === 'design-to-code' && 'bg-success hover:bg-success',
              !designToCodeDisabled && sentId !== 'design-to-code' && 'bg-accent hover:bg-accent/90',
            )}
          >
            {designToCodeDisabled || (sentId === 'design-to-code' ? 'Started' : 'Build Code')}
          </Button>
        </div>

        {/* Code → Design */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-foreground mb-1">Code → Design</h3>
          <p className="text-[11px] text-foreground-muted leading-snug mb-2">
            Generate or update your designs from existing code.
          </p>
          <Button
            onClick={handleCodeToDesign}
            disabled={!!codeToDesignDisabled}
            title={codeToDesignDisabled || undefined}
            size="sm"
            className={cn(
              'w-full text-[11px] font-semibold h-8',
              sentId === 'code-to-design' && 'bg-success hover:bg-success',
              !codeToDesignDisabled && sentId !== 'code-to-design' && 'bg-accent hover:bg-accent/90',
            )}
          >
            {codeToDesignDisabled || (sentId === 'code-to-design' ? 'Started' : 'Build Designs')}
          </Button>
        </div>
      </div>

      {/* Confirmation dialog for destructive actions */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction?.onConfirm} className="bg-accent text-white hover:bg-accent/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
