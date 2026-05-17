/**
 * lib/stacklisPro.js
 * Stacklis Pro entitlement check for physics-sandbox.
 *
 * Activation flow:
 *   1. Landing: stacklis.com/account links to this app with ?stacklis_pro=<email>
 *   2. This module reads that param, hits the entitlement API, and if active:
 *      - persists email + verified-at timestamp in localStorage
 *      - strips the param from the URL (clean history)
 *   3. On subsequent loads, skips the API call if verified within the last 24h.
 *
 * Exposes:  window.stacklisPro = { isActive, getEmail, deactivate }
 * Consumed: app.js Pro.isActive() calls window.stacklisPro.isActive()
 */
(function () {
  'use strict';

  const LS_EMAIL_KEY      = 'stacklisPro';
  const LS_VERIFIED_KEY   = 'stacklisProVerifiedAt';
  const PARAM_NAME        = 'stacklis_pro';
  const ENTITLEMENT_URL   = 'https://stacklis.com/api/entitlement';
  const CACHE_MS          = 24 * 60 * 60 * 1000; // 24 hours

  function _lsGet(k) {
    try { return localStorage.getItem(k); } catch (_) { return null; }
  }
  function _lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (_) {}
  }
  function _lsRemove(k) {
    try { localStorage.removeItem(k); } catch (_) {}
  }

  function isActive() {
    return !!_lsGet(LS_EMAIL_KEY);
  }

  function getEmail() {
    return _lsGet(LS_EMAIL_KEY);
  }

  function deactivate() {
    _lsRemove(LS_EMAIL_KEY);
    _lsRemove(LS_VERIFIED_KEY);
    _removeBadge();
  }

  function _activate(email) {
    _lsSet(LS_EMAIL_KEY, email);
    _lsSet(LS_VERIFIED_KEY, String(Date.now()));
    _renderBadge(email);
  }

  /* ---- badge ---- */
  function _renderBadge(email) {
    if (document.getElementById('stacklis-pro-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'stacklis-pro-badge';
    badge.setAttribute('aria-label', 'Stacklis Pro active');
    badge.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:3px 8px 3px 10px',
      'border-radius:6px',
      'background:linear-gradient(135deg,rgba(106,166,255,0.22),rgba(106,166,255,0.08))',
      'border:1px solid rgba(106,166,255,0.5)',
      'font-size:11px',
      'font-weight:600',
      'color:#6aa6ff',
      'white-space:nowrap',
      'cursor:default',
      'position:relative',
      'z-index:9999',
    ].join(';');
    const label = document.createElement('span');
    label.textContent = 'Stacklis Pro · ' + email;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Deactivate Stacklis Pro';
    x.style.cssText = [
      'background:none',
      'border:none',
      'cursor:pointer',
      'color:inherit',
      'font-size:13px',
      'line-height:1',
      'padding:0 0 0 2px',
      'opacity:0.7',
    ].join(';');
    x.addEventListener('click', function (e) {
      e.stopPropagation();
      deactivate();
      // Reload so Pro gates revert cleanly.
      window.location.reload();
    });
    badge.appendChild(label);
    badge.appendChild(x);

    // Insert into topbar before the Pro buy-link.
    const proBtn = document.querySelector('.pro-btn') || document.querySelector('.topbar');
    if (proBtn && proBtn.parentNode) {
      proBtn.parentNode.insertBefore(badge, proBtn);
    } else {
      // Fallback: append to body top-right.
      badge.style.position = 'fixed';
      badge.style.top = '8px';
      badge.style.right = '8px';
      document.body.appendChild(badge);
    }
  }

  function _removeBadge() {
    const b = document.getElementById('stacklis-pro-badge');
    if (b) b.remove();
  }

  /* ---- init ---- */
  async function _init() {
    // 1. Check URL param first.
    let email = null;
    try {
      const url = new URL(window.location.href);
      const param = url.searchParams.get(PARAM_NAME);
      if (param) {
        email = decodeURIComponent(param).trim().toLowerCase();
        // Strip it from URL immediately.
        url.searchParams.delete(PARAM_NAME);
        window.history.replaceState(null, '', url.toString());
      }
    } catch (_) {}

    if (email) {
      // Always re-verify when arriving with a fresh param.
      await _verifyAndPersist(email);
      return;
    }

    // 2. Already persisted — check cache freshness.
    const storedEmail = _lsGet(LS_EMAIL_KEY);
    if (!storedEmail) return; // not a Pro user

    const verifiedAt = parseInt(_lsGet(LS_VERIFIED_KEY) || '0', 10);
    const age = Date.now() - verifiedAt;
    if (age < CACHE_MS) {
      // Cache still warm — trust it.
      _renderBadge(storedEmail);
      return;
    }

    // Cache stale — re-verify silently.
    await _verifyAndPersist(storedEmail);
  }

  async function _verifyAndPersist(email) {
    try {
      const res = await fetch(ENTITLEMENT_URL + '?email=' + encodeURIComponent(email));
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.active === true) {
        _activate(email);
      } else {
        // Entitlement revoked — clear.
        deactivate();
      }
    } catch (_) {
      // Network error: if already stored, keep it (graceful degradation).
      if (_lsGet(LS_EMAIL_KEY) === email) _renderBadge(email);
    }
  }

  // Expose API before init so app.js can call isActive() synchronously.
  window.stacklisPro = { isActive, getEmail, deactivate };

  // Init: run immediately if DOM is ready, otherwise wait.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
