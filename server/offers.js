export const OFFER_CATALOG = Object.freeze([
  Object.freeze({
    id: 'harbor-cups-12-lids-16',
    supplier: 'Harbor Supply',
    items: Object.freeze([
      Object.freeze({ id: 'paper-cups', name: 'Paper takeaway cups', size: '12 oz', quantity: 500, lineAmountCents: 5800 }),
      Object.freeze({ id: 'cup-lids', name: 'Cup lids', size: '16 oz', quantity: 500, lineAmountCents: 3400 }),
    ]),
    delivery: 'Thursday',
  }),
  Object.freeze({
    id: 'cedar-matching-cups-lids-12',
    supplier: 'Cedar Goods',
    items: Object.freeze([
      Object.freeze({ id: 'paper-cups', name: 'Paper takeaway cups', size: '12 oz', quantity: 500, lineAmountCents: 6400 }),
      Object.freeze({ id: 'cup-lids', name: 'Compatible cup lids', size: '12 oz', quantity: 500, lineAmountCents: 3800 }),
    ]),
    delivery: 'Thursday',
  }),
]);

export function validateOffer(offer) {
  const errors = [];
  if (!offer || !Array.isArray(offer.items) || offer.items.length !== 2) {
    return ['Offer details are incomplete.'];
  }
  if (![offer.id, offer.supplier, offer.delivery].every(value => typeof value === 'string' && value.trim())) {
    errors.push('Offer ID, supplier, and delivery details are required.');
  }
  const cups = offer.items.find(item => item?.id === 'paper-cups');
  const lids = offer.items.find(item => item?.id === 'cup-lids');
  for (const item of [cups, lids]) {
    if (!item || ![item.name, item.size].every(value => typeof value === 'string' && value.trim()) || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.lineAmountCents) || item.lineAmountCents < 1) {
      errors.push('Required item details, quantity, size, and price must be complete.');
      break;
    }
  }
  if (cups && lids && (cups.size !== lids.size || cups.quantity !== lids.quantity)) {
    errors.push('Cup and lid sizes and quantities must match.');
  }
  if (cups && lids && Number.isSafeInteger(cups.lineAmountCents) && Number.isSafeInteger(lids.lineAmountCents)
    && !Number.isSafeInteger(cups.lineAmountCents + lids.lineAmountCents)) {
    errors.push('Offer total exceeds supported currency precision.');
  }
  return errors;
}

export function getOfferTotalCents(offer) {
  return offer.items.reduce((total, item) => total + item.lineAmountCents, 0);
}

export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}

export function toPublicOffer(offer) {
  const errors = validateOffer(offer);
  const totalCents = errors.length ? null : getOfferTotalCents(offer);
  return {
    id: offer.id,
    supplier: offer.supplier,
    items: offer.items.map(item => ({
      id: item.id,
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      lineAmount: formatCents(item.lineAmountCents),
    })),
    delivery: offer.delivery,
    compatible: errors.length === 0,
    rejectionReasons: errors,
    total: totalCents === null ? null : formatCents(totalCents),
    currency: 'USD',
  };
}

export function createOfferSnapshot(offer) {
  const publicOffer = toPublicOffer(offer);
  if (!publicOffer.compatible) throw new Error(publicOffer.rejectionReasons.join(' '));
  const snapshot = {
    offerId: offer.id,
    supplier: offer.supplier,
    items: offer.items.map(item => ({ ...item })),
    delivery: offer.delivery,
    totalCents: getOfferTotalCents(offer),
    currency: 'USD',
  };
  for (const item of snapshot.items) Object.freeze(item);
  Object.freeze(snapshot.items);
  return Object.freeze(snapshot);
}
