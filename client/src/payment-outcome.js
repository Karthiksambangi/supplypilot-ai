const definitiveCaptureFailures = /INSTRUMENT_DECLINED|PAYER_CANNOT_PAY|TRANSACTION_REFUSED|PAYMENT_DENIED|ORDER_NOT_APPROVED/i;

export function getCaptureOutcome(errorMessage) {
  return definitiveCaptureFailures.test(errorMessage) ? 'failed' : 'pending';
}

export function getCheckoutFailureMessage(errorMessage) {
  if (/Offer approval is missing or expired/i.test(errorMessage)) {
    return 'This reviewed approval is no longer available on the backend; it may have expired or the backend may have restarted. No order was started by this request. Return to Review and approve the offer again before continuing.';
  }
  if (/This approval already created an order/i.test(errorMessage)) {
    return 'This approval has already created a Sandbox order. Do not reuse it; check Sandbox activity before starting another checkout.';
  }
  const safeMessage = typeof errorMessage === 'string' ? errorMessage.trim().slice(0, 240) : '';
  return safeMessage
    ? `PayPal Sandbox checkout could not start: ${safeMessage}`
    : 'PayPal Sandbox checkout could not start. No completed payment was confirmed.';
}
