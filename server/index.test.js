import test from 'node:test';
import assert from 'node:assert/strict';
import React from '../client/node_modules/react/index.js';
import ReactDOMServer from '../client/node_modules/react-dom/server.js';
import { createAppServer, validateSandboxApprovalUrl } from './index.js';
import { OFFER_CATALOG, createOfferSnapshot, getOfferTotalCents, toPublicOffer, validateOffer } from './offers.js';
import { getPayPalReturn } from '../client/src/paypal-return.js';
import { getCaptureOutcome, getCheckoutFailureMessage } from '../client/src/payment-outcome.js';
import { PaymentScreen } from '../client/src/payment-screens.js';
import { auditQuotes, getCompatibilityExplanation, getQuoteRecommendation } from '../client/src/quote-audit.js';
import { getDemoStepSelector, getDemoStepStatus, selectActiveDemoStep } from '../client/src/demo-steps.js';
import { getSelectableOffer, OfferPicker } from '../client/src/offer-picker.js';
import { OfferShortcut, scrollToOfferPicker } from '../client/src/offer-shortcut.js';

const renderPaymentScreen = props => ReactDOMServer.renderToStaticMarkup(React.createElement(PaymentScreen, props));

function mockPayPal({ captureResponses = [] } = {}) {
  const calls = [];
  let orderPayload;
  let captureIndex = 0;
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api-m.sandbox.paypal.com');
    calls.push({ url: parsed.href, options });
    if (parsed.pathname === '/v1/oauth2/token') return new Response(JSON.stringify({ access_token: 'sandbox-mock-token' }), { status: 200 });
    if (parsed.pathname === '/v2/checkout/orders' && !parsed.pathname.endsWith('/capture')) {
      orderPayload = JSON.parse(options.body);
      const unit = orderPayload.purchase_units[0];
      return new Response(JSON.stringify({
        id: 'SANDBOX-ORDER-001', status: 'CREATED',
        purchase_units: [{ reference_id: unit.reference_id, amount: unit.amount }],
        links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=SANDBOX-ORDER-001' }],
      }), { status: 201 });
    }
    if (parsed.pathname.endsWith('/capture')) {
      const candidate = captureResponses[captureIndex++] || captureResponses.at(-1);
      return new Response(JSON.stringify(candidate), { status: 201 });
    }
    throw new Error('Unexpected mocked PayPal endpoint.');
  };
  return { fetchImpl, calls, getOrderPayload: () => orderPayload };
}

async function startMockedServer(fetchImpl) {
  const server = createAppServer({ fetchImpl, getCredentials: () => ({ clientId: 'sandbox-test-client', clientSecret: 'sandbox-test-secret' }) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const postJson = (url, payload) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

function captureFixture({ offerId = 'cedar-matching-cups-lids-12', amount = '102.00', currency = 'USD', status = 'COMPLETED' } = {}) {
  return {
    id: 'SANDBOX-ORDER-001', status: 'COMPLETED',
    purchase_units: [{
      reference_id: offerId,
      amount: { currency_code: currency, value: amount },
      payments: { captures: [{ id: 'SANDBOX-CAPTURE-001', status, amount: { currency_code: currency, value: amount } }] },
    }],
  };
}

test('server catalog exposes synthetic offers and approves only a complete compatible human selection', async () => {
  assert.equal(OFFER_CATALOG.length, 2);
  assert.deepEqual(validateOffer(OFFER_CATALOG[0]), ['Cup and lid sizes and quantities must match.']);
  assert.deepEqual(validateOffer(OFFER_CATALOG[1]), []);
  assert.equal(getOfferTotalCents(OFFER_CATALOG[1]), 10200);
  const mock = mockPayPal();
  const { server, url } = await startMockedServer(mock.fetchImpl);
  try {
    const catalogResponse = await fetch(`${url}/api/offers`);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.offers.find(offer => offer.id === 'harbor-cups-12-lids-16').compatible, false);
    assert.equal(catalog.offers.find(offer => offer.id === 'cedar-matching-cups-lids-12').total, '102.00');
    const rejected = await postJson(`${url}/api/approve`, { offerId: 'harbor-cups-12-lids-16', approved: true });
    assert.equal(rejected.status, 400);
    const unapproved = await postJson(`${url}/api/approve`, { offerId: 'cedar-matching-cups-lids-12', approved: false });
    assert.equal(unapproved.status, 400);
    const response = await postJson(`${url}/api/approve`, { offerId: 'cedar-matching-cups-lids-12', approved: true });
    const approval = await response.json();
    assert.equal(response.status, 200);
    assert.equal(approval.offer.total, '102.00');
    assert.equal(mock.calls.length, 0);
  } finally { server.close(); }
});

test('GET /api/offers returns the server catalog with compatibility and price details', async () => {
  const mock = mockPayPal();
  const { server, url } = await startMockedServer(mock.fetchImpl);
  try {
    const response = await fetch(`${url}/api/offers`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.offers.length, OFFER_CATALOG.length);
    assert.deepEqual(data.offers.map(offer => [offer.id, offer.compatible, offer.total]), [
      ['harbor-cups-12-lids-16', false, null],
      ['cedar-matching-cups-lids-12', true, '102.00'],
    ]);
    assert.equal(data.offers[1].items.length, 2);
    assert.equal(mock.calls.length, 0);
  } finally { server.close(); }
});

test('server ignores client totals and creates the Sandbox order from the selected offer snapshot', async () => {
  const mock = mockPayPal();
  const { server, url } = await startMockedServer(mock.fetchImpl);
  try {
    const approvalResponse = await postJson(`${url}/api/approve`, {
      offerId: 'cedar-matching-cups-lids-12', approved: true, amount: '0.01', totalCents: 1,
    });
    const approval = await approvalResponse.json();
    assert.equal(approval.offer.total, '102.00');
    const orderResponse = await postJson(`${url}/api/paypal/create`, {
      approvalId: approval.approvalId, offerId: 'harbor-cups-12-lids-16', amount: '0.01',
    });
    const order = await orderResponse.json();
    assert.equal(orderResponse.status, 200, order.error);
    assert.equal(order.orderId, 'SANDBOX-ORDER-001');
    const unit = mock.getOrderPayload().purchase_units[0];
    assert.equal(unit.reference_id, 'cedar-matching-cups-lids-12');
    assert.equal(unit.amount.value, '102.00');
    assert.equal(unit.amount.currency_code, 'USD');
    assert.deepEqual(unit.items.map(item => item.unit_amount.value), ['64.00', '38.00']);
    const createCall = mock.calls.find(call => new URL(call.url).pathname === '/v2/checkout/orders');
    assert.equal(createCall.options.headers.Prefer, 'return=representation');
    assert.ok(mock.calls.every(call => new URL(call.url).hostname === 'api-m.sandbox.paypal.com'));
  } finally { server.close(); }
});

test('capture validates the immutable approved offer, amount, currency, and order snapshot', async () => {
  const snapshot = createOfferSnapshot(OFFER_CATALOG.find(offer => offer.id === 'cedar-matching-cups-lids-12'));
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.items));
  assert.ok(Object.isFrozen(snapshot.items[0]));
  assert.throws(() => { snapshot.items[0].lineAmountCents = 1; }, TypeError);
  const mock = mockPayPal({ captureResponses: [
    captureFixture({ offerId: 'harbor-cups-12-lids-16' }),
    captureFixture({ amount: '99.00' }),
    captureFixture({ currency: 'EUR' }),
    captureFixture(),
  ] });
  const { server, url } = await startMockedServer(mock.fetchImpl);
  try {
    const approvalResponse = await postJson(`${url}/api/approve`, { offerId: 'cedar-matching-cups-lids-12', approved: true });
    const approval = await approvalResponse.json();
    const createResponse = await postJson(`${url}/api/paypal/create`, { approvalId: approval.approvalId });
    assert.equal(createResponse.status, 200, (await createResponse.clone().json()).error);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const invalidCapture = await postJson(`${url}/api/paypal/capture`, { orderId: 'SANDBOX-ORDER-001', offerId: 'tampered-client-offer', amount: '0.01' });
      assert.equal(invalidCapture.status, 400);
      assert.match((await invalidCapture.json()).error, /reviewed offer and total/);
    }
    const validResponse = await postJson(`${url}/api/paypal/capture`, { orderId: 'SANDBOX-ORDER-001' });
    const captured = await validResponse.json();
    assert.equal(validResponse.status, 200);
    const captureCall = mock.calls.find(call => new URL(call.url).pathname.endsWith('/capture'));
    assert.equal(captureCall.options.headers.Prefer, 'return=representation');
    assert.equal(captured.offer.offerId, approval.offer.id);
    assert.equal(captured.offer.total, '102.00');
    assert.equal(captured.offer.currency, 'USD');
  } finally { server.close(); }
});

test('demo step tracking selects the visible section and distinguishes completed steps', () => {
  const entry = (step, top, bottom = top + 300) => ({ step, rect: { top, bottom } });
  assert.equal(selectActiveDemoStep([entry('compare', 0, 900), entry('review', 920, 1700), entry('approve', 1720, 2300)], 'approve', 340), 'compare');
  assert.equal(selectActiveDemoStep([entry('compare', -900, -20), entry('review', 0, 900), entry('approve', 920, 1700)], 'compare', 340), 'review');
  assert.equal(selectActiveDemoStep([entry('compare', -1800, -920), entry('review', -900, -20), entry('approve', 0, 800)], 'review', 340), 'approve');
  assert.equal(getDemoStepStatus('compare', 'review'), 'completed');
  assert.equal(getDemoStepStatus('review', 'review'), 'current');
  assert.equal(getDemoStepStatus('approve', 'review'), 'upcoming');
  assert.equal(getDemoStepSelector('compare'), '.compare-card');
  assert.equal(getDemoStepSelector('review'), '.review-card');
  assert.equal(getDemoStepSelector('approve'), '.checkout');
  assert.equal(getDemoStepSelector('unknown'), null);
});

test('offer picker renders server offers and only exposes compatible offers for selection', () => {
  const offers = OFFER_CATALOG.map(toPublicOffer);
  const selected = getSelectableOffer(offers, 'cedar-matching-cups-lids-12');
  assert.equal(selected.supplier, 'Cedar Goods');
  assert.equal(getSelectableOffer(offers, 'harbor-cups-12-lids-16'), null);
  const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(OfferPicker, {
    offers, selectedOfferId: selected.id, onSelect() {},
  }));
  assert.match(markup, /Cedar Goods/);
  assert.match(markup, /500 × Paper takeaway cups · 12 oz · \$64\.00/);
  assert.match(markup, /500 × Compatible cup lids · 12 oz · \$38\.00/);
  assert.match(markup, /Delivery: Thursday/);
  assert.match(markup, /\$102\.00 USD/);
  assert.match(markup, /Harbor Supply/);
  assert.match(markup, /Incompatible — not approvable/);
  assert.match(markup, /disabled=""/);
});

test('offer picker clear selection resets the chosen offer and approval eligibility', () => {
  const offers = OFFER_CATALOG.map(toPublicOffer);
  let selectedOfferId = 'cedar-matching-cups-lids-12';
  const picker = OfferPicker({
    offers,
    selectedOfferId,
    onSelect() {},
    onClear: () => { selectedOfferId = ''; },
  });
  const clearButton = picker.props.children.find(child => child?.type === 'button' && child.props.className === 'clear-offer');
  assert.ok(clearButton);
  assert.equal(clearButton.props.children, 'Clear selection');
  clearButton.props.onClick();
  assert.equal(selectedOfferId, '');
  assert.equal(getSelectableOffer(offers, selectedOfferId), null);
  assert.equal(offers.find(offer => offer.id === 'harbor-cups-12-lids-16').compatible, false);

  const unselectedPicker = OfferPicker({ offers, selectedOfferId: '', onSelect() {}, onClear() {} });
  assert.equal(unselectedPicker.props.children.some(child => child?.props?.className === 'clear-offer'), false);
});

test('hero offer button shows the current selection and scrolls to the picker on activation', () => {
  const noSelection = ReactDOMServer.renderToStaticMarkup(React.createElement(OfferShortcut, { selectedOffer: null, onNavigate() {} }));
  assert.match(noSelection, /Choose an offer/);
  assert.match(noSelection, /<button[^>]*type="button"/);
  const cedar = { supplier: 'Cedar Goods', total: '102.00' };
  const selected = ReactDOMServer.renderToStaticMarkup(React.createElement(OfferShortcut, { selectedOffer: cedar, onNavigate() {} }));
  assert.match(selected, /Cedar Goods · \$102\.00/);

  let scrollArgs;
  const button = OfferShortcut({
    selectedOffer: cedar,
    onNavigate: () => scrollToOfferPicker(
      { querySelector: selector => selector === '.offer-picker' ? { scrollIntoView: args => { scrollArgs = args; } } : null },
      { matchMedia: () => ({ matches: false }) },
    ),
  });
  button.props.onClick();
  assert.deepEqual(scrollArgs, { behavior: 'smooth', block: 'start' });
});

test('quote audit extracts source facts, flags Harbor size mismatch, and recommends compatible Cedar offer', () => {
  const offers = auditQuotes('Quote A, Harbor Supply: 500 paper takeaway cups, 12 oz, $58.00. 500 lids, 16 oz, $34.00. Delivery Thursday.\nQuote B, Cedar Goods: 500 paper takeaway cups, 12 oz, $64.00. 500 compatible 12 oz lids, $38.00. Delivery Thursday.');
  assert.equal(offers.length, 2);
  assert.equal(offers[0].label, 'Harbor Supply');
  assert.equal(offers[0].cups.size, '12 oz');
  assert.equal(offers[0].lids.size, '16 oz');
  assert.equal(offers[0].price, '92.00');
  assert.equal(offers[0].compatible, false);
  assert.ok(offers[0].missingDetails.includes('Cup and lid sizes differ'));
  assert.equal(offers[1].price, '102.00');
  assert.equal(offers[1].compatible, true);
  assert.match(getQuoteRecommendation(offers), /Cedar Goods is the only offer/);
  assert.match(getCompatibilityExplanation(offers), /Harbor Supply lists 12 oz cups with 16 oz lids/);
  assert.match(getCompatibilityExplanation(offers), /Cedar Goods lists matching 12 oz cups and lids/);
});

test('quote audit reports unspecified evidence and avoids recommending incompatible offers', () => {
  const offers = auditQuotes('Quote A, Harbor Supply: 500 paper cups.');
  assert.equal(offers[0].cups, null);
  assert.equal(offers[0].price, null);
  assert.ok(offers[0].missingDetails.length > 0);
  assert.match(getQuoteRecommendation(offers), /No offer can yet be recommended/);
});

test('PayPal return distinguishes approved, missing-token, cancelled, and unrelated URLs', () => {
  assert.deepEqual(getPayPalReturn('?checkout=approved&token=ORDER-123'), { status: 'approved', orderId: 'ORDER-123' });
  assert.deepEqual(getPayPalReturn('?checkout=approved'), { status: 'missing-token' });
  assert.deepEqual(getPayPalReturn('?checkout=approved&token=%20%20'), { status: 'missing-token' });
  assert.deepEqual(getPayPalReturn('?checkout=cancelled'), { status: 'cancelled' });
  assert.equal(getPayPalReturn(''), null);
});

test('capture errors distinguish explicit declines from unconfirmed pending outcomes', () => {
  assert.equal(getCaptureOutcome('PayPal Sandbox returned UNPROCESSABLE_ENTITY (INSTRUMENT_DECLINED)'), 'failed');
  assert.equal(getCaptureOutcome('PayPal capture was not confirmed for the approved amount.'), 'pending');
  assert.equal(getCaptureOutcome('Capture is already in progress.'), 'pending');
  assert.equal(getCaptureOutcome('Connection timed out.'), 'pending');
});

test('checkout errors explain stale approvals and prevent unsafe reuse', () => {
  assert.match(getCheckoutFailureMessage('Offer approval is missing or expired. Review and approve the offer again.'), /backend may have restarted/);
  assert.match(getCheckoutFailureMessage('This approval already created an order. Approve the offer again to retry.'), /Do not reuse it/);
  assert.match(getCheckoutFailureMessage('PayPal Sandbox authentication failed. Check your app credentials.'), /authentication failed/);
});

test('payment screens render distinct failed, canceled, pending, and successful states', () => {
  const failure = renderPaymentScreen({ paymentStatus: { type: 'failed', message: 'PayPal declined the payment.' } });
  assert.match(failure, /Payment failed/);
  assert.match(failure, /class="outcome-icon"[^>]*>×</);
  assert.doesNotMatch(failure, /Payment canceled|Payment pending/);

  const cancelled = renderPaymentScreen({ paymentStatus: { type: 'cancelled', message: 'Checkout was canceled.' } });
  assert.match(cancelled, /Payment canceled/);
  assert.match(cancelled, /class="outcome-icon"[^>]*>↩</);
  assert.doesNotMatch(cancelled, /Payment failed/);

  const pending = renderPaymentScreen({ paymentStatus: { type: 'pending', message: 'Capture is still being confirmed.' } });
  assert.match(pending, /Payment pending/);
  assert.match(pending, /class="outcome-icon"[^>]*>…</);
  assert.doesNotMatch(pending, /Payment failed/);

  const success = renderPaymentScreen({
    payment: { orderId: 'ORDER-123', captureId: 'CAPTURE-456', offer: { total: '102.00', currency: 'USD', supplier: 'Cedar Goods' } },
    paymentStatus: { type: 'failed', message: 'Stale status must not replace success.' },
    confirmation: 'Payment confirmed.',
    copiedField: '',
    onCopy() {},
  });
  assert.match(success, /Payment successful/);
  assert.match(success, /\$102\.00/);
  assert.match(success, /Cedar Goods/);
  assert.match(success, /ORDER-123/);
  assert.match(success, /CAPTURE-456/);
  assert.doesNotMatch(success, /Payment failed|Payment canceled|Payment pending/);
});

test('PayPal approval URL accepts only HTTPS Sandbox hosts', () => {
  assert.equal(validateSandboxApprovalUrl('https://sandbox.paypal.com/checkoutnow?token=test'), 'https://sandbox.paypal.com/checkoutnow?token=test');
  assert.equal(validateSandboxApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=test'), 'https://www.sandbox.paypal.com/checkoutnow?token=test');

  for (const href of [
    undefined,
    'not a URL',
    'http://sandbox.paypal.com/checkoutnow',
    'https://paypal.com/checkoutnow',
    'https://sandbox.paypal.com.example/checkoutnow',
    'https://sandbox.paypal.com@paypal.com/checkoutnow',
  ]) {
    assert.throws(() => validateSandboxApprovalUrl(href), {
      message: 'PayPal Sandbox did not return a valid checkout link.',
    });
  }
});

test('approval rejects unknown or unapproved offers without contacting PayPal', async () => {
  const mock = mockPayPal();
  const { server, url } = await startMockedServer(mock.fetchImpl);
  try {
    const unknown = await postJson(`${url}/api/approve`, { offerId: 'not-in-catalog', approved: true });
    assert.equal(unknown.status, 400);
    const unapproved = await postJson(`${url}/api/approve`, { offerId: 'cedar-matching-cups-lids-12', approved: false });
    assert.equal(unapproved.status, 400);
    assert.equal(mock.calls.length, 0);
  } finally { server.close(); }
});

test('catalog validation rejects incomplete offer details', () => {
  const compatible = OFFER_CATALOG.find(offer => offer.id === 'cedar-matching-cups-lids-12');
  const incomplete = { ...compatible, delivery: '', items: compatible.items.map((item, index) => index === 0 ? { ...item, lineAmountCents: 0 } : item) };
  assert.ok(validateOffer(incomplete).length >= 2);
});

