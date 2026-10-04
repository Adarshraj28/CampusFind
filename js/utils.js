/* ============================================================
   CampusFind — utils.js
   Shared helpers: DOM, formatting, escaping, icons, theme,
   debounce, pagination. Attached to window.CF.utils
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  const THEME_KEY = 'campusfind.theme';

  /* ---------- DOM ---------- */
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Safety: escape untrusted text before HTML injection ---------- */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Strip control characters + trim (used when storing user input) */
  function sanitizeInput(value) {
    if (typeof value !== 'string') return value;
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  }

  /* ---------- Timing ---------- */
  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ---------- IDs & counters ---------- */
  function randomDigits(n) {
    let out = '';
    for (let i = 0; i < n; i += 1) out += Math.floor(Math.random() * 10);
    return out;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /* Case IDs: LF-GU-2026-00124 / FF-GU-2026-00124 / CLM-GU-2026-00031 */
  const issuedCaseIds = new Set();

  function generateCaseId(prefix) {
    const year = new Date().getFullYear();
    let id = `${prefix}-GU-${year}-${randomDigits(5)}`;
    let attempts = 0;
    while (issuedCaseIds.has(id) && attempts < 100) {
      id = `${prefix}-GU-${year}-${randomDigits(5)}`;
      attempts += 1;
    }
    issuedCaseIds.add(id);
    return id;
  }

  function isValidCaseId(id) {
    return /^(LF|FF|CLM)-GU-\d{4}-\d{5}$/.test(String(id || ''));
  }

  /* ---------- Formatting ---------- */
  function capitalize(str) {
    const s = String(str || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function titleCase(str) {
    return String(str || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDate(iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const options = opts || { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('en-GB', options);
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatTime12(time) {
    if (!time) return '—';
    const parts = String(time).split(':');
    let h = Number(parts[0]);
    const m = parts[1] || '00';
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const abs = Math.abs(diff);
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    let value;
    if (abs < min) value = 'just now';
    else if (abs < hour) value = `${Math.round(abs / min)} min ago`;
    else if (abs < day) value = `${Math.round(abs / hour)} hr ago`;
    else if (abs < 7 * day) value = `${Math.round(abs / day)} d ago`;
    else return formatDate(iso);
    return diff >= 0 ? value : `in ${value.replace(' ago', '')}`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function maskText(text) {
    const s = String(text || '');
    if (s.length <= 4) return '••••';
    return `${s.slice(0, 2)}${'•'.repeat(Math.min(8, s.length - 4))}${s.slice(-2)}`;
  }

  /* ---------- Icons (Lucide) ---------- */
  function icon(name, cls) {
    return `<i data-lucide="${escapeHtml(name)}"${cls ? ` class="${escapeHtml(cls)}"` : ''} aria-hidden="true"></i>`;
  }

  function refreshIcons(root) {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons(root ? { nodes: qsa('[data-lucide]', root) } : undefined);
      } catch (err) {
        try { window.lucide.createIcons(); } catch (e) { /* icon lib unavailable */ }
      }
    }
  }

  /* ---------- Theme ---------- */
  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  }

  function applyTheme(theme) {
    try { document.documentElement.setAttribute('data-theme', theme); } catch (e) { /* DOM not ready */ }
    try {
      qsa('[data-theme-toggle]').forEach((btn) => {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', theme === 'dark' ? 'Light mode' : 'Dark mode');
        const holder = qs('[data-theme-icon]', btn);
        if (holder) holder.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
      });
    } catch (e) { /* theme toggle unavailable yet */ }
    try { refreshIcons(); } catch (e) { /* icons not loaded yet */ }
  }

  function initTheme() {
    applyTheme(getTheme());
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
    applyTheme(next);
    return next;
  }

  /* ---------- Pagination ---------- */
  const PAGE_SIZE = 9;

  function paginate(list, page, perPage) {
    const size = perPage || PAGE_SIZE;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const current = clamp(Number(page) || 1, 1, pages);
    const start = (current - 1) * size;
    return {
      items: list.slice(start, start + size),
      page: current,
      pages,
      total,
      perPage: size,
      from: total ? start + 1 : 0,
      to: Math.min(start + size, total),
    };
  }

  function paginationControls(pager, attrs) {
    if (pager.pages <= 1) {
      return pager.total ? `<p class="pagination-info">Showing ${pager.from}–${pager.to} of ${pager.total}</p>` : '';
    }
    const attr = attrs || 'data-page-btn';
    const btn = (label, target, disabled, currentCheck, aria) =>
      `<button type="button" class="page-btn${currentCheck ? ' active' : ''}" ${attr}="${target}" ${disabled ? 'disabled' : ''} ${aria || ''}>${label}</button>`;

    let html = `<nav class="pagination" aria-label="Pagination">`;
    html += btn(icon('chevron-left'), String(pager.page - 1), pager.page <= 1, false, 'aria-label="Previous page"');
    const range = [];
    for (let i = 1; i <= pager.pages; i += 1) {
      if (i === 1 || i === pager.pages || Math.abs(i - pager.page) <= 1) range.push(i);
      else if (range[range.length - 1] !== '…') range.push('…');
    }
    range.forEach((p) => {
      if (p === '…') html += `<span class="page-btn" aria-hidden="true" style="border:none;background:none">…</span>`;
      else html += btn(String(p), String(p), false, p === pager.page, `aria-label="Page ${p}"${p === pager.page ? ' aria-current="page"' : ''}`);
    });
    html += btn(icon('chevron-right'), String(pager.page + 1), pager.page >= pager.pages, false, 'aria-label="Next page"');
    html += `</nav><p class="pagination-info">Showing ${pager.from}–${pager.to} of ${pager.total} results</p>`;
    return html;
  }

  /* ---------- Query params ---------- */
  function getParams() {
    const out = {};
    new URLSearchParams(window.location.search).forEach((value, key) => { out[key] = value; });
    return out;
  }

  function param(name, fallback) {
    const value = getParams()[name];
    return value === undefined || value === '' ? (fallback === undefined ? '' : fallback) : value;
  }

  /* ---------- Misc ---------- */
  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : (many || `${one}s`)}`;
  }

  function bytesLabel(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function safeParse(json, fallback) {
    try {
      if (json === null || json === undefined) return fallback;
      const parsed = JSON.parse(json);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) { return fallback; }
  }

  window.CF.utils = {
    qs, qsa, escapeHtml, sanitizeInput, debounce, sleep, uid,
    randomDigits, generateCaseId, isValidCaseId,
    capitalize, titleCase, formatDate, formatDateTime, formatTime12,
    relativeTime, greeting, todayISO, clamp, initials, maskText,
    icon, refreshIcons, getTheme, applyTheme, initTheme, toggleTheme,
    paginate, paginationControls, getParams, param, plural, bytesLabel, safeParse,
    PAGE_SIZE,
  };
})();
