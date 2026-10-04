/* ============================================================
   CampusFind — storage.js
   localStorage data layer + domain repositories.
   Reads and writes are synchronous so every module shares
   one source of truth. The deployed build swaps this layer
   for Supabase (see js/api.js and process.md).
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const U = () => window.CF.utils;

  const PREFIX = 'campusfind.';
  const KEYS = {
    users: 'users',
    reports: 'reports',
    claims: 'claims',
    notifications: 'notifications',
    audit: 'audit',
    session: 'session',
    meta: 'meta',
    login: 'login_attempts',
    settings: 'settings',
  };

  /* ---------- Generic key/value API (required by spec §13) ---------- */
  function saveData(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      // Quota exceeded → retry without embedded images
      try {
        const stripped = stripImages(value);
        localStorage.setItem(PREFIX + key, JSON.stringify(stripped));
        window.__cfImageDropped = true;
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  function getData(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback === undefined ? null : fallback;
      return U().safeParse(raw, fallback === undefined ? null : fallback);
    } catch (err) {
      return fallback === undefined ? null : fallback;
    }
  }

  function updateData(key, value) {
    return saveData(key, value);
  }

  function deleteData(key) {
    try { localStorage.removeItem(PREFIX + key); return true; } catch (e) { return false; }
  }

  function clearData() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0 && k !== PREFIX + KEYS.theme) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
      return true;
    } catch (e) { return false; }
  }

  function stripImages(value) {
    if (Array.isArray(value)) return value.map(stripImages);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((k) => {
        out[k] = (k === 'images' && Array.isArray(value[k]))
          ? []
          : stripImages(value[k]);
      });
      return out;
    }
    return value;
  }

  function storageUsage() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) {
          total += (k.length + (localStorage.getItem(k) || '').length) * 2;
        }
      }
    } catch (e) { /* ignore */ }
    return total;
  }

  /* ---------- Repositories ---------- */
  const list = (key) => getData(key, []) || [];
  const users = () => list(KEYS.users);
  const reports = () => list(KEYS.reports);
  const claims = () => list(KEYS.claims);
  const notifications = () => list(KEYS.notifications);
  const audit = () => list(KEYS.audit);

  const lostReports = () => reports().filter((r) => r.type === 'lost');
  const foundReports = () => reports().filter((r) => r.type === 'found');

  function findUser(id) { return users().find((u) => u.id === id) || null; }
  function findUserByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    return users().find((u) => String(u.email).toLowerCase() === e) || null;
  }
  function findReport(id) { return reports().find((r) => r.id === id) || null; }
  function findClaim(id) { return claims().find((c) => c.id === id) || null; }

  function saveUsers(arr) { return saveData(KEYS.users, arr); }
  function saveReports(arr) { return saveData(KEYS.reports, arr); }
  function saveClaims(arr) { return saveData(KEYS.claims, arr); }
  function saveNotifications(arr) { return saveData(KEYS.notifications, arr); }
  function saveAudit(arr) { return saveData(KEYS.audit, arr); }

  function addUser(user) {
    const arr = users();
    arr.push(user);
    saveUsers(arr);
    return user;
  }

  function updateUser(id, patch) {
    const arr = users();
    const idx = arr.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: new Date().toISOString() });
    saveUsers(arr);
    return arr[idx];
  }

  function addReport(report) {
    const arr = reports();
    arr.push(report);
    saveReports(arr);
    return report;
  }

  function updateReport(id, patch) {
    const arr = reports();
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: new Date().toISOString() });
    saveReports(arr);
    return arr[idx];
  }

  function addClaim(claim) {
    const arr = claims();
    arr.push(claim);
    saveClaims(arr);
    return claim;
  }

  function updateClaim(id, patch) {
    const arr = claims();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: new Date().toISOString() });
    saveClaims(arr);
    return arr[idx];
  }

  function addNotification(notification) {
    const arr = notifications();
    arr.unshift(notification);
    saveNotifications(arr.slice(0, 300));
    return notification;
  }

  function pushAudit(entry) {
    const arr = audit();
    arr.unshift(entry);
    saveAudit(arr.slice(0, 300));
    return entry;
  }

  /* Chain of custody: append an event to a report */
  function pushCustody(reportId, event) {
    const report = findReport(reportId);
    if (!report) return null;
    const custody = Array.isArray(report.custody) ? report.custody.slice() : [];
    custody.push(event);
    return updateReport(reportId, { custody });
  }

  /* ---------- Session / meta ---------- */
  function getMeta() {
    const raw = getData(KEYS.meta, null);
    if (!raw || typeof raw !== 'object') {
      return { seeded: false, seededAt: null, version: 1 };
    }
    return Object.assign({ seeded: false, seededAt: null, version: 1 }, raw);
  }
  function setMeta(patch) {
    return saveData(KEYS.meta, Object.assign(getMeta(), patch));
  }

  function getSettings() {
    return getData(KEYS.settings, { notifyEmail: true, matchThreshold: 70 }) ||
      { notifyEmail: true, matchThreshold: 70 };
  }
  function saveSettings(patch) {
    return saveData(KEYS.settings, Object.assign(getSettings(), patch));
  }

  /* ---------- Initial dataset & reset ---------- */
  function ensureSeeded() {
    const meta = getMeta();
    if (!meta.seeded || users().length === 0) seedInitialData();
  }

  function seedInitialData() {
    const seed = window.CF.seed;
    if (!seed) return false;
    saveUsers(seed.buildUsers());
    saveReports(seed.buildReports());
    saveClaims(seed.buildClaims());
    saveNotifications(seed.buildNotifications());
    saveAudit(seed.buildAudit());
    setMeta({ seeded: true, seededAt: new Date().toISOString(), version: 1 });
    saveSettings({ notifyEmail: true, matchThreshold: 70 });
    return true;
  }

  function resetSampleData() {
    clearData();
    return seedInitialData();
  }

  window.CF.storage = {
    KEYS,
    saveData, getData, updateData, deleteData, clearData, storageUsage,
    users, reports, claims, notifications, audit,
    lostReports, foundReports,
    findUser, findUserByEmail, findReport, findClaim,
    saveUsers, saveReports, saveClaims, saveNotifications, saveAudit,
    addUser, updateUser, addReport, updateReport,
    addClaim, addClaimRecord: addClaim, updateClaim,
    addNotification, pushAudit, pushCustody,
    getMeta, setMeta, getSettings, saveSettings,
    ensureSeeded, seedInitialData, resetSampleData,
  };
})();
