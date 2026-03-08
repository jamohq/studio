import React, { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const steps = [
  {
    title: 'Design Panel',
    message: 'This is your Design panel — describe your app here.',
    hint: 'Look for the Paintbrush icon in the sidebar on the left.',
  },
  {
    title: 'Build',
    message: 'Click Build to generate code from your designs.',
    hint: 'The Zap icon in the sidebar triggers actions and builds.',
  },
  {
    title: 'Run',
    message: 'Click Run to see your app.',
    hint: 'Use the Run button in the top bar to preview your project.',
  },
];

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        {/* Step label */}
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Title */}
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          {step.title}
        </h2>

        {/* Message */}
        <p className="mb-1 text-sm text-foreground">
          {step.message}
        </p>

        {/* Hint */}
        <p className="mb-6 text-sm text-muted-foreground">
          {step.hint}
        </p>

        {/* Step dots */}
        <div className="mb-4 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                i === currentStep ? 'bg-accent' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={isFirst}
            className={cn(isFirst && 'invisible')}
          >
            Back
          </Button>

          {isLast ? (
            <Button size="sm" onClick={onComplete}>
              Got it!
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
