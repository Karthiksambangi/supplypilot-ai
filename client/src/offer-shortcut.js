import React from 'react';

export function scrollToOfferPicker(documentRef, windowRef) {
  const target = documentRef.querySelector('.offer-picker');
  if (!target) return false;
  const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  return true;
}

export function OfferShortcut({ selectedOffer, onNavigate }) {
  const h = React.createElement;
  return h('button', {
    className: 'total total-button',
    type: 'button',
    onClick: onNavigate,
    'aria-label': selectedOffer
      ? `Review ${selectedOffer.supplier} offer, server-calculated total $${selectedOffer.total} USD`
      : 'Choose an offer in the Review section',
  }, [
    h('span', { key: 'label' }, 'Selected offer · USD'),
    h('strong', { key: 'value' }, selectedOffer ? `${selectedOffer.supplier} · $${selectedOffer.total}` : 'Choose an offer'),
    h('small', { key: 'hint' }, 'Review server-calculated basket'),
  ]);
}
