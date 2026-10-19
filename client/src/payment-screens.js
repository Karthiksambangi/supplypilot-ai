import React from 'react';

const element = React.createElement;

function PaymentReference({ label, value, copiedField, onCopy }) {
  return element('div', { className: 'payment-reference' },
    element('span', null, label),
    element('div', null,
      element('code', null, value),
      element('button', {
        type: 'button',
        className: 'copy-button',
        'aria-label': `Copy ${label.toLowerCase()}`,
        onClick: () => onCopy(label, value),
      }, copiedField === label ? 'Copied' : 'Copy'),
    ),
  );
}

export function PaymentSuccess({ payment, confirmation, copiedField, onCopy }) {
  return element('section', { className: 'payment-success', role: 'status', 'aria-labelledby': 'payment-success-title' },
    element('span', { className: 'success-check', 'aria-hidden': 'true' }, '✓'),
    element('p', { className: 'success-label' }, 'PAYPAL SANDBOX'),
    element('h2', { id: 'payment-success-title' }, 'Payment successful'),
    element('p', { className: 'success-amount' }, `$${payment.offer.total} `, element('span', null, payment.offer.currency)),
    element('p', { className: 'success-supplier' }, `${payment.offer.supplier} · reviewed synthetic offer`),
    element('p', { className: 'success-confirmation' }, confirmation),
    element('div', { className: 'payment-references' },
      element(PaymentReference, { label: 'Order ID', value: payment.orderId, copiedField, onCopy }),
      element(PaymentReference, { label: 'Capture ID', value: payment.captureId, copiedField, onCopy }),
    ),
  );
}

export function PaymentOutcome({ type, message }) {
  const labels = { failed: 'Payment failed', cancelled: 'Payment canceled', pending: 'Payment pending' };
  const icons = { failed: '×', cancelled: '↩', pending: '…' };
  return element('section', { className: `payment-outcome payment-outcome--${type}`, role: 'status', 'aria-labelledby': 'payment-outcome-title' },
    element('span', { className: 'outcome-icon', 'aria-hidden': 'true' }, icons[type]),
    element('p', { className: 'success-label' }, 'PAYPAL SANDBOX'),
    element('h2', { id: 'payment-outcome-title' }, labels[type]),
    element('p', { className: 'outcome-message' }, message),
  );
}

export function PaymentScreen({ payment, paymentStatus, confirmation, copiedField, onCopy }) {
  if (payment) return element(PaymentSuccess, { payment, confirmation, copiedField, onCopy });
  if (paymentStatus) return element(PaymentOutcome, { type: paymentStatus.type, message: paymentStatus.message });
  return null;
}
