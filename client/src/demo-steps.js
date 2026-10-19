const stepOrder = ['compare', 'review', 'approve'];
const stepSelectors = { compare: '.compare-card', review: '.review-card', approve: '.checkout' };

export function getDemoStepSelector(step) {
  return stepSelectors[step] || null;
}

export function selectActiveDemoStep(entries, currentStep, anchorY) {
  const candidates = entries
    .map(entry => {
      const rect = entry.rect || entry.boundingClientRect;
      const distance = anchorY < rect.top ? rect.top - anchorY : anchorY > rect.bottom ? anchorY - rect.bottom : 0;
      return { step: entry.step || entry.target?.dataset?.demoStep, distance };
    })
    .filter(candidate => stepOrder.includes(candidate.step))
    .sort((left, right) => left.distance - right.distance);
  return candidates[0]?.step || currentStep;
}

export function getDemoStepStatus(step, activeStep) {
  const stepIndex = stepOrder.indexOf(step);
  const activeIndex = stepOrder.indexOf(activeStep);
  if (stepIndex === -1 || activeIndex === -1) return 'upcoming';
  if (stepIndex < activeIndex) return 'completed';
  return stepIndex === activeIndex ? 'current' : 'upcoming';
}
