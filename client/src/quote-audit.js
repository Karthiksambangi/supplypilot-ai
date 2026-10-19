function parseOffer(label, source) {
  const cup = source.match(/(\d+)\s+(?:paper\s+)?(?:takeaway\s+)?cups?\s*,?\s*(\d+(?:\.\d+)?)\s*oz/i);
  const lids = source.match(/(\d+)\s+lids?\s*,?\s*(\d+(?:\.\d+)?)\s*oz/i)
    || source.match(/(\d+)\s+(?:compatible\s+)?(\d+(?:\.\d+)?)\s*oz\s+lids?/i);
  const prices = [...source.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)].map(match => Number(match[1]));
  const delivery = source.match(/delivery\s+([^.!;\n]+)/i)?.[1]?.trim() || null;
  const missingDetails = [];

  if (!cup) missingDetails.push('Cup quantity or size not specified');
  if (!lids) missingDetails.push('Lid quantity or size not specified');
  if (cup && lids && Number(cup[1]) !== Number(lids[1])) missingDetails.push('Cup and lid quantities differ');
  if (cup && lids && cup[2] !== lids[2]) missingDetails.push('Cup and lid sizes differ');
  if (!delivery) missingDetails.push('Delivery timing not specified');
  if (prices.length < 2) missingDetails.push('Separate cup and lid prices not both specified');

  return {
    label,
    source: source.trim(),
    cups: cup ? { quantity: Number(cup[1]), size: `${cup[2]} oz` } : null,
    lids: lids ? { quantity: Number(lids[1]), size: `${lids[2]} oz` } : null,
    price: prices.length ? prices.reduce((sum, price) => sum + price, 0).toFixed(2) : null,
    delivery,
    compatible: Boolean(cup && lids && cup[2] === lids[2] && Number(cup[1]) === Number(lids[1])),
    missingDetails,
  };
}

export function auditQuotes(quotes) {
  if (typeof quotes !== 'string' || !quotes.trim()) return [];
  const offers = [...quotes.matchAll(/(?:^|\n)\s*Quote\s*[^,\n]*,\s*([^:\n]+):([\s\S]*?)(?=\n\s*Quote\s*[^,\n]*,|$)/gi)];
  if (!offers.length) return [parseOffer('Supplier not identified', quotes)];
  return offers.map((offer, index) => parseOffer(offer[1].trim() || `Supplier ${index + 1}`, offer[2]));
}

export function getQuoteRecommendation(offers) {
  const compatible = offers.filter(offer => offer.compatible);
  if (compatible.length === 1) {
    const offer = compatible[0];
    return `${offer.label} is the only offer with matching cup and lid sizes and quantities. Review its source details before approving.`;
  }
  if (compatible.length > 1) {
    const lowest = compatible.filter(offer => offer.price !== null).sort((left, right) => Number(left.price) - Number(right.price))[0];
    return lowest
      ? `${lowest.label} is compatible and has the lowest listed combined price. Confirm delivery and source details before approving.`
      : 'Multiple offers appear compatible. Compare their source details and delivery before approving.';
  }
  return 'No offer can yet be recommended as compatible. Review the source details and resolve missing or mismatched specifications.';
}

export function getCompatibilityExplanation(offers) {
  const mismatch = offers.find(offer => offer.cups && offer.lids && offer.cups.size !== offer.lids.size);
  const compatible = offers.find(offer => offer.compatible);
  if (mismatch && compatible) {
    return `${mismatch.label} lists ${mismatch.cups.size} cups with ${mismatch.lids.size} lids, so sizes do not match. ${compatible.label} lists matching ${compatible.cups.size} cups and lids; review the source and price before deciding.`;
  }
  if (mismatch) return `${mismatch.label} lists ${mismatch.cups.size} cups with ${mismatch.lids.size} lids, so sizes do not match. No matching offer is currently identified.`;
  return 'Confirm that item sizes and quantities are compatible in the source text before deciding.';
}
