/* ============================================================
   CampusFind — api.js
   Supabase data-access layer (the shape every module talks to).

   WHY THIS FILE IS NOT WIRED YET
   -----------------------------
   js/storage.js currently *synchronously* returns arrays from
   localStorage, and 20+ call sites depend on that. Moving to a
   network backend is therefore an async change that must land
   together with the Supabase project. This file defines the
   contract now so the swap is mechanical — see process.md,
   section "Going live with Supabase".

   WHAT IT GIVES YOU
   -----------------
   * config-aware mode (local vs supabase)
   * one repository function per entity, same names as
     js/storage.js (users, reports, claims, notifications, audit)
   * an auth bridge that maps Supabase sessions onto the same
     getCurrentUser() shape the rest of the app expects
   * real row-level-security guidance in the SQL migration
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  const config = () => window.CF.config;
  const S = () => window.CF.storage;

  /* ---------- client ---------- */

  let client = null;

  /**
   * Returns the Supabase client, or null when the project is
   * not configured. Loads the SDK lazily from the CDN so the
   * offline build pays no cost.
   */
  async function getClient() {
    if (client) return client;
    if (!config().isSupabaseConfigured()) return null;

    if (!window.supabase || !window.supabase.createClient) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Supabase SDK failed to load'));
        document.head.appendChild(s);
      });
    }

    client = window.supabase.createClient(config().supabaseUrl, config().supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
  }

  /** True when reads and writes should go to Postgres. */
  function isOnline() {
    return config().mode === 'supabase' || config().mode === 'auto' && config().isSupabaseConfigured();
  }

  /**
   * Single read helper. Every repository goes through this so
   * there is exactly one place where table names live.
   */
  async function from(table, build) {
    const sb = await getClient();
    if (!sb) return build(S()[table]() || [], null);
    const { data, error } = await sb.from(table).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);
    return build(data || [], sb);
  }

  /* ============================================================
     Repositories — names mirror js/storage.js so the callers
     in js/app.js, js/items.js, js/admin.js do not change.
     ============================================================ */

  const api = {
    getClient,
    isOnline,
    isSupabaseConfigured: () => config().isSupabaseConfigured(),
    mode: () => config().mode,

    /* ---------- users ---------- */
    async listUsers() {
      return from('users', (rows) => rows);
    },
    async findUserByEmail(email) {
      const sb = await getClient();
      if (!sb) return S().findUserByEmail(email) || null;
      const { data, error } = await sb.from('users').select('*').eq('email', String(email).toLowerCase()).maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    },
    async saveUser(user) {
      const sb = await getClient();
      if (!sb) return S().addUser(user);
      const { data, error } = await sb.from('users').upsert(user).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    /* ---------- reports ---------- */
    async listReports(filters) {
      const sb = await getClient();
      if (!sb) return S().reports();
      let q = sb.from('reports').select('*').order('created_at', { ascending: false });
      if (filters && filters.type) q = q.eq('type', filters.type);
      if (filters && filters.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    },
    async findReport(id) {
      const sb = await getClient();
      if (!sb) return S().findReport(id) || null;
      const { data, error } = await sb.from('reports').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    },
    async saveReport(report) {
      const sb = await getClient();
      if (!sb) return S().addReport(report);
      const { data, error } = await sb.from('reports').upsert(report).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    /* ---------- claims ---------- */
    async listClaims() {
      return from('claims', (rows) => rows);
    },
    async findClaim(id) {
      const sb = await getClient();
      if (!sb) return S().findClaim(id) || null;
      const { data, error } = await sb.from('claims').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    },
    async saveClaim(claim) {
      const sb = await getClient();
      if (!sb) return S().addClaimRecord(claim);
      const { data, error } = await sb.from('claims').upsert(claim).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    /* ---------- notifications ---------- */
    async listNotifications(userId) {
      const sb = await getClient();
      if (!sb) return S().notifications().filter((n) => n.userId === userId);
      const { data, error } = await sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    async addNotification(row) {
      const sb = await getClient();
      if (!sb) return S().addNotification(row);
      const { data, error } = await sb.from('notifications').insert(row).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    /* ---------- audit ---------- */
    async listAudit(limit) {
      const sb = await getClient();
      if (!sb) return S().audit();
      const { data, error } = await sb.from('audit_events').select('*').order('ts', { ascending: false }).limit(limit || 500);
      if (error) throw new Error(error.message);
      return data || [];
    },
    async pushAudit(row) {
      const sb = await getClient();
      if (!sb) return S().pushAudit(row);
      const { error } = await sb.from('audit_events').insert(row);
      if (error) throw new Error(error.message);
      return true;
    },

    /* ---------- photos ---------- */
    /**
     * Uploads a data-URL to Supabase Storage and returns a
     * public URL. Images stay out of Postgres rows, which keeps
     * the reports table small and fast to query.
     */
    async uploadPhoto(caseId, file) {
      const sb = await getClient();
      if (!sb) return null;
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from(config().photosBucket).upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from(config().photosBucket).getPublicUrl(path);
      return data.publicUrl;
    },

    /* ============================================================
       Auth bridge — maps a Supabase session onto the app's
       existing getCurrentUser() contract.
       ============================================================ */
    async signIn(email, password) {
      const sb = await getClient();
      if (!sb) return window.CF.auth.authenticate(email, password);
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const row = await api.findUserByEmail(email);
      if (row) S().saveUser(row);
      return data.user;
    },
    async signUp(email, password, meta) {
      const sb = await getClient();
      if (!sb) return window.CF.auth.registerUser(email, password, meta);
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: meta || {} } });
      if (error) throw new Error(error.message);
      return data.user;
    },
    async signOut() {
      const sb = await getClient();
      if (sb) await sb.auth.signOut();
      return window.CF.auth.logoutUser();
    },
    /** Refreshes the cached session on tab focus / page load. */
    async refreshSession() {
      const sb = await getClient();
      if (!sb) return window.CF.auth.getCurrentUser();
      const { data } = await sb.auth.getSession();
      return data && data.user ? data.user : null;
    },
  };

  window.CF.api = api;
})();