import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getPayPalReturn } from './paypal-return.js';
import { getCaptureOutcome, getCheckoutFailureMessage } from './payment-outcome.js';
import { PaymentScreen } from './payment-screens.js';
import { auditQuotes, getCompatibilityExplanation } from './quote-audit.js';
import { getDemoStepSelector, getDemoStepStatus, selectActiveDemoStep } from './demo-steps.js';
import { getSelectableOffer, OfferPicker } from './offer-picker.js';
import { OfferShortcut, scrollToOfferPicker } from './offer-shortcut.js';
import './style.css';
import './payment-success.css';
import './demo-flow.css';
import './offer-shortcut.css';
import './offer-picker.css';

const sample = `Quote A, Harbor Supply: 500 paper takeaway cups, 12 oz, $58.00. 500 lids, 16 oz, $34.00. Delivery Thursday.\nQuote B, Cedar Goods: 500 paper takeaway cups, 12 oz, $64.00. 500 compatible 12 oz lids, $38.00. Delivery Thursday.`;
async function api(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}
function App() {
  const [quotes, setQuotes] = useState(sample);
  const [analysis, setAnalysis] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [purchase, setPurchase] = useState(null);
  const [catalogOffers, setCatalogOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [result, setResult] = useState('');
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [activeDemoStep, setActiveDemoStep] = useState('compare');
  const offers = auditQuotes(quotes);
  const selectedOffer = getSelectableOffer(catalogOffers, selectedOfferId);
  useEffect(() => {
    api('/api/offers').then(data => {
      if (!Array.isArray(data.offers)) throw new Error('The server returned an invalid offer list.');
      setCatalogOffers(data.offers);
      setOffersError('');
    }).catch(error => setOffersError(error.message)).finally(() => setOffersLoading(false));
  }, []);
  useEffect(() => {
    const sections = ['.compare-card', '.review-card', '.checkout'].map(selector => document.querySelector(selector)).filter(Boolean);
    sections.forEach((section, index) => {
      section.dataset.demoStep = ['compare', 'review', 'approve'][index];
    });
    let frame = 0;
    const update = () => {
      frame = 0;
      const anchorY = window.innerHeight * 0.38;
      const positions = sections.map(section => ({ step: section.dataset.demoStep, rect: section.getBoundingClientRect() }));
      setActiveDemoStep(current => selectActiveDemoStep(positions, current, anchorY));
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const checkout = getPayPalReturn(location.search);
    if (checkout?.status === 'approved') {
      history.replaceState(null, '', '/');
      setBusy(true);
      setPayment(null);
      setPaymentStatus({ type: 'pending', message: 'PayPal returned to the app. We are checking whether the approved payment completed.' });
      api('/api/paypal/capture', { orderId: checkout.orderId }).then(x => { setPayment(x); setPaymentStatus(null); setResult(`Your reviewed ${x.offer.supplier} offer payment is confirmed.`); }).catch(e => {
        const outcome = getCaptureOutcome(e.message);
        setPayment(null);
        setPaymentStatus(outcome === 'failed'
          ? { type: 'failed', message: 'PayPal declined the approved payment. No completed capture was confirmed.' }
          : { type: 'pending', message: 'We could not confirm the capture yet. Check your PayPal Sandbox activity before trying again.' });
      }).finally(() => setBusy(false));
    } else if (checkout?.status === 'missing-token') {
      history.replaceState(null, '', '/');
      setPaymentStatus({ type: 'pending', message: 'PayPal returned without an approval token, so we could not verify or capture the payment. Check your Sandbox activity before trying again.' });
    } else if (checkout?.status === 'cancelled') {
      history.replaceState(null, '', '/');
      setPayment(null);
      setResult('');
      setPaymentStatus({ type: 'cancelled', message: 'Checkout was canceled. No payment was captured.' });
    }
  }, []);
  async function analyze() {
    setError(''); setBusy(true); setAnalysis('');
    try { const x = await api('/api/analyze', { quotes }); setAnalysis(x.analysis); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function approve() {
    setError(''); setResult(''); setPayment(null); setPaymentStatus(null); setBusy(true);
    try { setPurchase(await api('/api/approve', { offerId: selectedOfferId, approved: true })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function checkout() {
    setError(''); setPaymentStatus(null); setPayment(null); setBusy(true);
    try { const x = await api('/api/paypal/create', { approvalId: purchase.approvalId }); location.assign(x.approvalUrl); }
    catch (error) {
      if (/Offer approval is missing or expired/i.test(error.message)) setPurchase(null);
      setPaymentStatus({ type: 'failed', message: getCheckoutFailureMessage(error.message) });
      setBusy(false);
    }
  }
  async function copyReference(field, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(''), 1800);
    } catch {
      setError(`Could not copy the ${field.toLowerCase()}. Select and copy it manually.`);
    }
  }
  function navigateToDemoStep(step) {
    const target = document.querySelector(getDemoStepSelector(step));
    if (!target) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  return <main><header><span className="mark">S</span><div><strong>SupplyPilot AI</strong><small>Sandbox purchasing workspace · synthetic demo</small></div><span className="badge">SANDBOX ONLY</span></header>
    <PaymentScreen payment={payment} paymentStatus={paymentStatus} confirmation={result} copiedField={copiedField} onCopy={copyReference} />
    {!payment && <>
      <section className="hero"><div><p className="eyebrow">SYNTHETIC SUPPLIER SCENARIO</p><h1>Catch the mismatch.<br/><em>Review before you buy.</em></h1><p>Compare the source quotes, review a server-listed synthetic offer, and approve its exact total before PayPal Sandbox.</p></div><OfferShortcut selectedOffer={selectedOffer} onNavigate={() => scrollToOfferPicker(document, window)} /></section>
      <nav className="demo-steps" aria-label="Demo steps">{[['compare', 'Compare'], ['review', 'Review'], ['approve', 'Approve']].map(([step, label], index) => { const status = getDemoStepStatus(step, activeDemoStep); return <button type="button" key={step} className={`demo-step demo-step--${status}`} aria-current={status === 'current' ? 'step' : undefined} onClick={() => navigateToDemoStep(step)}><b aria-hidden="true">{status === 'completed' ? '✓' : index + 1}</b>{label}</button>; })}</nav>
      <section className="card compare-card"><span className="step">01 / COMPARE</span><h2>Compare the supplier evidence</h2><p className="section-intro">These are synthetic sample quotes. The original wording stays visible so you can verify every extracted detail.</p><label htmlFor="quotes">Source quote text · synthetic</label><textarea id="quotes" value={quotes} onChange={e => {setQuotes(e.target.value); setAnalysis(''); setPurchase(null);}}/><button disabled={busy || !quotes.trim()} onClick={analyze}>Summarize evidence with Gemini (optional)</button><p className="hint">Gemini is optional and advisory only. It cannot select an offer, set a price, approve a purchase, or change the server catalog. Review the source text yourself; do not paste private supplier information.</p>
      <div className="supplier-grid">{offers.map((offer, index) => <article className={`supplier-card ${offer.compatible ? 'compatible' : 'mismatch'}`} key={`${offer.label}-${index}`}><div className="supplier-heading"><h3>{offer.label}</h3><span className={`fit-tag ${offer.compatible ? 'fit' : 'not-fit'}`}>{offer.compatible ? 'Sizes match' : 'Compatibility issue'}</span></div><dl className="supplier-facts"><div><dt>Item</dt><dd>{offer.cups && offer.lids ? 'Takeaway cups + lids' : 'Details incomplete'}</dd></div><div><dt>Size</dt><dd>{offer.cups?.size || 'Not stated'} cups / {offer.lids?.size || 'Not stated'} lids</dd></div><div><dt>Quantity</dt><dd>{offer.cups?.quantity ?? 'Not stated'} cups / {offer.lids?.quantity ?? 'Not stated'} lids</dd></div><div><dt>Combined listed price</dt><dd>{offer.price === null ? 'Not stated' : `$${offer.price}`}</dd></div><div><dt>Delivery</dt><dd>{offer.delivery || 'Not stated'}</dd></div></dl>{offer.missingDetails.length > 0 && <p className="missing-details"><strong>Check:</strong> {offer.missingDetails.join(' · ')}</p>}<details><summary>Show source quote</summary><blockquote>{offer.source || 'No source text provided.'}</blockquote></details></article>)}</div>
      </section>
      <section className="card review-card"><span className="step">02 / REVIEW</span><h2>Review and select a supplier offer</h2><div className="recommendation"><strong>Quote-text evidence (advisory)</strong><p>{getCompatibilityExplanation(offers)}</p><p className="recommendation-reason">Gemini may summarize the source quotes, but it cannot select an offer, set a price, or authorize a purchase.</p></div>{analysis ? <div className="analysis" aria-label="Gemini evidence summary">{analysis}</div> : <p className="hint">The quote analysis is optional. Server catalog details below are authoritative for selection and pricing.</p>}<OfferPicker offers={catalogOffers} selectedOfferId={selectedOfferId} disabled={busy} loading={offersLoading} error={offersError} onSelect={offerId => { setSelectedOfferId(offerId); setPurchase(null); }} onClear={() => { setSelectedOfferId(''); setPurchase(null); setResult(''); setPaymentStatus(null); }}/><div className="basket"><div><strong>Human-reviewed selection</strong><span>{selectedOffer ? `${selectedOffer.supplier} · ${selectedOffer.delivery}` : 'Choose a compatible offer above'}</span></div><strong>{selectedOffer ? `$${selectedOffer.total} ${selectedOffer.currency}` : '—'}</strong></div><p className="hint">The browser submits only the selected offer ID and your approval. The server rechecks compatibility, calculates the total, and stores an immutable order snapshot.</p><button className="secondary" disabled={busy || !selectedOffer} onClick={approve}>I reviewed this offer — approve {selectedOffer ? `$${selectedOffer.total} ${selectedOffer.currency}` : 'selected offer'}</button></section>
      <section className="card checkout"><div><span className="step">03 / APPROVE</span><h2>PayPal Sandbox only</h2><p>{purchase ? `Approved: ${purchase.offer.supplier} · $${purchase.offer.total} ${purchase.offer.currency}` : 'After approving the reviewed offer, continue to the PayPal Sandbox approval page.'}</p><p className="hint">Use a Sandbox buyer account. This checkout uses the server-approved offer snapshot; no live payment is possible.</p></div><button disabled={busy || !purchase?.approvalId} onClick={checkout}>Continue to PayPal Sandbox →</button></section>
    </>}{error && <div className="notice bad" role="alert">{error}</div>}{result && !payment && !paymentStatus && <div className="notice" role="status">{result}</div>}<footer>Prototype · synthetic supplier offers · PayPal Sandbox checkout only</footer></main>;
}
createRoot(document.getElementById('root')).render(<App />);
