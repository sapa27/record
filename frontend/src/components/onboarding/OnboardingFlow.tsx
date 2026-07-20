import React from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  WelcomeStep,
  DownloadProgressStep,
  SetupOverviewStep,
} from './steps';

export function OnboardingFlow() {
  const { currentStep } = useOnboarding();

  return (
    <div className="onboarding-flow">
      {currentStep === 1 && <WelcomeStep />}
      {currentStep === 2 && <SetupOverviewStep />}
      {currentStep === 3 && <DownloadProgressStep />}
    </div>
  );
}
