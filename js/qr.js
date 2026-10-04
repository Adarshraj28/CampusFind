/* ============================================================
   CampusFind — qr.js
   QR generation for found-item cases using the qrcodejs CDN.
   The QR encodes the internal case page URL so campus staff
   can scan a printed tag and open the live record.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const U = () => window.CF.utils;

  function caseUrl(caseId) {
    try {
      const base = window.location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
      return `${base}item-details.html?id=${encodeURIComponent(caseId)}`;
    } catch (e) {
      return `item-details.html?id=${encodeURIComponent(caseId)}`;
    }
  }

  /* Render a QR code into `el`. Falls back to a readable link
     when the CDN library is unavailable (e.g. no network). */
  function renderQR(el, caseId, options) {
    const opts = options || {};
    if (!el) return false;
    const url = opts.url || caseUrl(caseId);
    const size = opts.size || 148;
    el.innerHTML = '';

    if (window.QRCode) {
      try {
        // eslint-disable-next-line no-new
        new window.QRCode(el, {
          text: url,
          width: size,
          height: size,
          colorDark: '#0F172A',
          colorLight: '#FFFFFF',
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0,
        });
        return true;
      } catch (err) { /* fall through to fallback */ }
    }

    el.innerHTML = `<div class="text-sm text-muted" style="text-align:center;max-width:200px">
      <i data-lucide="qr-code" aria-hidden="true" style="width:44px;height:44px;margin:0 auto 8px"></i>
      <b class="mono" style="display:block;color:var(--text)">${U().escapeHtml(caseId)}</b>
      <span style="font-size:12px;word-break:break-all">${U().escapeHtml(url)}</span>
    </div>`;
    U().refreshIcons(el);
    return false;
  }

  window.CF.qr = { caseUrl, renderQR };
})();
