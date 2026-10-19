export function getPayPalReturn(search) {
  const params = new URLSearchParams(search);
  const checkout = params.get('checkout');

  if (checkout === 'cancelled') return { status: 'cancelled' };
  if (checkout !== 'approved') return null;

  const orderId = params.get('token')?.trim();
  return orderId ? { status: 'approved', orderId } : { status: 'missing-token' };
}
