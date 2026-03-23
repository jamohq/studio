import React, { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import type { TourStep } from '../hooks/useGuidedTour';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuidedTourProps {
  active: boolean;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PopoverPosition {
  top: number;
  left: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const SPOTLIGHT_PADDING = 6;
const POPOVER_GAP = 12;
const POPOVER_WIDTH = 320;

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - SPOTLIGHT_PADDING,
    left: r.left - SPOTLIGHT_PADDING,
    width: r.width + SPOTLIGHT_PADDING * 2,
    height: r.height + SPOTLIGHT_PADDING * 2,
  };
}

function computePopoverPosition(
  target: Rect,
  placement: TourStep['placement'],
  popoverHeight: number,
): PopoverPosition {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'right':
      top = target.top + target.height / 2 - popoverHeight / 2;
      left = target.left + target.width + POPOVER_GAP;
      break;
    case 'left':
      top = target.top + target.height / 2 - popoverHeight / 2;
      left = target.left - POPOVER_WIDTH - POPOVER_GAP;
      break;
    case 'bottom':
      top = target.top + target.height + POPOVER_GAP;
      left = target.left + target.width / 2 - POPOVER_WIDTH / 2;
      break;
    case 'top':
      top = target.top - popoverHeight - POPOVER_GAP;
      left = target.left + target.width / 2 - POPOVER_WIDTH / 2;
      break;
  }

  // Clamp to viewport
  if (left + POPOVER_WIDTH > viewW - 16) left = viewW - POPOVER_WIDTH - 16;
  if (left < 16) left = 16;
  if (top + popoverHeight > viewH - 16) top = viewH - popoverHeight - 16;
  if (top < 16) top = 16;

  return { top, left };
}

// ---------------------------------------------------------------------------
// Spotlight SVG overlay
// ---------------------------------------------------------------------------

function SpotlightOverlay({ target }: { target: Rect }) {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const r = 6; // border-radius of the cutout

  return (
    <svg
      className="fixed inset-0 z-[60] pointer-events-none"
      width={viewW}
      height={viewH}
      style={{ width: viewW, height: viewH }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          {/* White = visible (overlay shows), black = hidden (cutout) */}
          <rect x="0" y="0" width={viewW} height={viewH} fill="white" />
          <rect
            x={target.left}
            y={target.top}
            width={target.width}
            height={target.height}
            rx={r}
            ry={r}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={viewW}
        height={viewH}
        fill="rgba(0,0,0,0.55)"
        mask="url(#tour-spotlight-mask)"
      />
      {/* Highlight ring around the target */}
      <rect
        x={target.left}
        y={target.top}
        width={target.width}
        height={target.height}
        rx={r}
        ry={r}
        fill="none"
        stroke="hsl(240 33% 50%)"
        strokeWidth="2"
        opacity="0.7"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// GuidedTour component
// ---------------------------------------------------------------------------

export default function GuidedTour({
  active,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: GuidedTourProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Re-measure target element whenever the step changes or window resizes.
  const measure = useCallback(() => {
    if (!step) {
      setTargetRect(null);
      setReady(false);
      return;
    }

    const rect = getTargetRect(step.targetSelector);
    setTargetRect(rect);

    if (rect) {
      const popoverH = popoverRef.current?.offsetHeight ?? 160;
      setPopoverPos(computePopoverPosition(rect, step.placement, popoverH));
      setReady(true);
    } else {
      setReady(false);
    }
  }, [step]);

  // Measure on step change (with retries to allow DOM to settle after panel switch).
  useEffect(() => {
    if (!active || !step) return;

    setReady(false);
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 5;

    const tryMeasure = () => {
      if (cancelled) return;
      measure();
      attempts++;
      if (!document.querySelector(step.targetSelector) && attempts < maxAttempts) {
        setTimeout(tryMeasure, 100);
      }
    };

    // Initial delay so that panel switch has time to render.
    const timer = setTimeout(tryMeasure, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, step, measure]);

  // Re-measure on resize.
  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, measure]);

  // Keyboard navigation.
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      else if (e.key === 'ArrowLeft' && stepIndex > 0) onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onSkip, onNext, onBack, stepIndex]);

  // Re-measure after popover renders (to get correct height).
  useEffect(() => {
    if (ready && popoverRef.current && targetRect) {
      const popoverH = popoverRef.current.offsetHeight;
      setPopoverPos(computePopoverPosition(targetRect, step!.placement, popoverH));
    }
  }, [ready, targetRect, step]);

  if (!active || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <>
      {/* Clickable backdrop (clicking advances or dismisses) */}
      <div
        className="fixed inset-0 z-[59]"
        onClick={onNext}
        style={{ cursor: 'pointer' }}
      />

      {/* SVG spotlight overlay */}
      {targetRect && <SpotlightOverlay target={targetRect} />}

      {/* Popover card */}
      <div
        ref={popoverRef}
        className={cn(
          'fixed z-[61] rounded-lg border border-border bg-background shadow-xl',
          'transition-opacity duration-200',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          width: POPOVER_WIDTH,
        }}
      >
        <div className="p-4">
          {/* Step counter */}
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-dim mb-1">
            {stepIndex + 1} of {totalSteps}
          </p>

          {/* Title */}
          <h3 className="text-[15px] font-semibold text-foreground mb-1.5">
            {step.title}
          </h3>

          {/* Body */}
          <p className="text-[13px] leading-relaxed text-foreground-muted mb-4">
            {step.body}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              className="text-[11px] text-foreground-dim hover:text-foreground-muted transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onBack(); }}
                  className="text-[12px] h-7"
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                className="text-[12px] h-7 bg-accent hover:bg-accent/90"
              >
                {isLast ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i === stepIndex ? 'bg-accent' : 'bg-foreground-dim/30',
              )}
            />
          ))}
        </div>
      </div>
    </>
  );
}
