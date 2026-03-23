import { useState, useCallback, useEffect, useRef } from 'react';
import type { SidePanel } from '../components/ActivityBar';

// ---------------------------------------------------------------------------
// Tour step definitions
// ---------------------------------------------------------------------------

export interface TourStep {
  /** Unique step identifier. */
  id: string;
  /** CSS selector for the element to spotlight. */
  targetSelector: string;
  /** Short title displayed in the popover. */
  title: string;
  /** Longer explanation text. */
  body: string;
  /** Preferred popover placement relative to the target. */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** If set, the tour will switch to this panel before showing the step. */
  requiresPanel?: SidePanel;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'creator-panel',
    targetSelector: '[data-tour="creator-btn"]',
    title: 'Design Panel',
    body: 'Start here — describe your app using text and drawings. This is the blueprint AI uses to generate code.',
    placement: 'right',
  },
  {
    id: 'sections',
    targetSelector: '[data-tour="sections"]',
    title: 'Design Sections',
    body: 'Fill in Main (what your app does), Tech (tools & platforms), Brand (colors & style), and User Stories.',
    placement: 'right',
    requiresPanel: 'creator',
  },
  {
    id: 'build-code',
    targetSelector: '[data-tour="build-code"]',
    title: 'Build Code',
    body: 'Once your designs are ready, click Build Code to generate the full application from your descriptions.',
    placement: 'top',
    requiresPanel: 'creator',
  },
  {
    id: 'explorer',
    targetSelector: '[data-tour="explorer-btn"]',
    title: 'File Explorer',
    body: 'Browse and edit the generated source files here. You can also create new files and folders.',
    placement: 'right',
  },
  {
    id: 'run-btn',
    targetSelector: '[data-tour="run-btn"]',
    title: 'Run Your App',
    body: 'Click Run to preview your project. It executes "make run" in the terminal.',
    placement: 'bottom',
  },
  {
    id: 'chat-btn',
    targetSelector: '[data-tour="chat-btn"]',
    title: 'Chat with AI',
    body: 'Ask questions about your code, request changes, or get explanations — the AI has full context of your project.',
    placement: 'bottom',
  },
  {
    id: 'source-control',
    targetSelector: '[data-tour="source-control-btn"]',
    title: 'Source Control',
    body: 'Stage files, commit changes, and browse history. Jamo auto-commits after AI actions, but you can also commit manually here.',
    placement: 'right',
  },
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'jamo-guided-tour';

interface TourState {
  completed: boolean;
  dismissed: boolean;
}

function loadTourState(): TourState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { completed: false, dismissed: false };
}

function saveTourState(state: TourState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface GuidedTourAPI {
  /** Whether the tour is currently active (visible). */
  active: boolean;
  /** The current step object, or null if tour is not active. */
  currentStep: TourStep | null;
  /** Zero-based index of the current step. */
  stepIndex: number;
  /** Total number of steps. */
  totalSteps: number;
  /** Advance to the next step, or complete the tour if at the end. */
  next: () => void;
  /** Go back one step. */
  back: () => void;
  /** Skip/dismiss the tour entirely. */
  skip: () => void;
  /** Start the tour (e.g. from a "Replay tour" button). */
  start: () => void;
  /** Whether the tour has been completed or dismissed before. */
  hasSeenTour: boolean;
}

interface UseGuidedTourOptions {
  /** Callback to switch the active side panel (for steps that need a specific panel visible). */
  setActivePanel: (panel: SidePanel) => void;
}

export function useGuidedTour({ setActivePanel }: UseGuidedTourOptions): GuidedTourAPI {
  const [tourState, setTourState] = useState<TourState>(loadTourState);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const startedRef = useRef(false);

  // Auto-start on first mount if the user hasn't seen the tour.
  // We also check for the legacy onboarding key — if they've already
  // completed the old onboarding, don't force the new tour.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const legacySeen = localStorage.getItem('jamo-has-seen-onboarding');
    if (legacySeen) {
      // Migrate: mark new tour as completed so it doesn't re-show.
      const migrated = { completed: true, dismissed: false };
      saveTourState(migrated);
      setTourState(migrated);
      return;
    }

    if (!tourState.completed && !tourState.dismissed) {
      setActive(true);
      setStepIndex(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = active ? (TOUR_STEPS[stepIndex] ?? null) : null;

  // Switch panel when the step requires it.
  useEffect(() => {
    if (currentStep?.requiresPanel) {
      setActivePanel(currentStep.requiresPanel);
    }
  }, [currentStep, setActivePanel]);

  const complete = useCallback(() => {
    setActive(false);
    const next = { completed: true, dismissed: false };
    setTourState(next);
    saveTourState(next);
    // Also set legacy key so old OnboardingOverlay stays hidden.
    localStorage.setItem('jamo-has-seen-onboarding', '1');
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      complete();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, complete]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    setActive(false);
    const next = { completed: false, dismissed: true };
    setTourState(next);
    saveTourState(next);
    localStorage.setItem('jamo-has-seen-onboarding', '1');
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  return {
    active,
    currentStep,
    stepIndex,
    totalSteps: TOUR_STEPS.length,
    next,
    back,
    skip,
    start,
    hasSeenTour: tourState.completed || tourState.dismissed,
  };
}
