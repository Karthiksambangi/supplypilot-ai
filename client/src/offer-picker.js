import React from 'react';

export function getSelectableOffer(offers, offerId) {
  return offers.find(offer => offer.id === offerId && offer.compatible) || null;
}

export function OfferPicker({ offers, selectedOfferId, disabled = false, loading = false, error = '', onSelect, onClear, onRetry }) {
  const h = React.createElement;
  const children = [
    h('legend', { key: 'legend' }, 'Select a server-listed offer'),
    h('p', { className: 'hint', key: 'help' }, 'Review item, size, quantity, line price, delivery, compatibility, and total. Incompatible offers cannot be approved.'),
  ];
  if (loading) children.push(h('p', { role: 'status', key: 'loading' }, 'Loading server offers…'));
  else if (error) children.push(h('div', { className: 'offer-load-error', key: 'error' }, [
    h('p', { role: 'alert', key: 'message' }, `Supplier offers are unavailable: ${error}`),
    onRetry && h('button', { type: 'button', className: 'retry-offers', onClick: onRetry, key: 'retry' }, 'Retry loading offers'),
  ]));
  else if (!offers.length) children.push(h('p', { role: 'status', key: 'empty' }, 'No supplier offers were returned by the server.'));
  else {
    offers.forEach(offer => children.push(h('label', {
    className: `offer-option ${offer.compatible ? 'offer-option--compatible' : 'offer-option--rejected'}`,
    key: offer.id,
  }, [
    h('input', {
      type: 'radio', name: 'supplier-offer', value: offer.id,
      checked: selectedOfferId === offer.id,
      disabled: !offer.compatible || disabled,
      onChange: () => offer.compatible && onSelect(offer.id),
      key: 'input',
    }),
    h('span', { className: 'offer-option__content', key: 'content' }, [
      h('span', { className: 'offer-option__heading', key: 'heading' }, [
        h('strong', { key: 'supplier' }, offer.supplier),
        h('strong', { key: 'total' }, offer.compatible ? `$${offer.total} ${offer.currency}` : 'Incompatible — not approvable'),
      ]),
      h('span', { className: 'offer-option__items', key: 'items' }, offer.items.map(item => `${item.quantity} × ${item.name} · ${item.size} · $${item.lineAmount}`).join(' | ')),
      h('span', { className: 'offer-option__delivery', key: 'delivery' }, `Delivery: ${offer.delivery}`),
      !offer.compatible && h('span', { className: 'offer-option__reason', key: 'reason' }, `Rejected: ${offer.rejectionReasons.join(' ')}`),
    ]),
    ])));
    if (offers.some(offer => offer.id === selectedOfferId && offer.compatible)) {
      children.push(h('button', { className: 'clear-offer', type: 'button', disabled, onClick: onClear, key: 'clear' }, 'Clear selection'));
    }
  }
  return h('fieldset', { className: 'offer-picker', 'aria-busy': loading }, children);
}
