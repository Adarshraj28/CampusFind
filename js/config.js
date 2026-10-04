/* ============================================================
   CampusFind — config.js
   Environment configuration contract.

   HOW IT WORKS
   ------------
   1. Copy `.env.example` to `.env`.
   2. Fill in the four values from your Supabase project
      (Project Settings → API).
   3. Nothing else needs editing — every module reads from
      `window.CF.config`.

   WHY IT IS SAFE TO SHIP EMPTY
   ----------------------------
   With no values set, `mode` resolves to 'local' and the app
   runs entirely on localStorage, exactly as before. The app
   never throws just because the backend is not connected.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  /* Values injected by the host environment. On a static host
     you either edit the two empty strings below once, or let
     your build step write `window.CF_ENV` before this file. */
  const ENV = window.CF_ENV || {};

  const config = {
    /* Supabase project URL, e.g. https://abcdefghijklm.supabase.co */
    supabaseUrl: ENV.SUPABASE_URL || '',

    /* Supabase anon (public) key. Safe to ship: row-level
       security in Postgres is what protects the data. */
    supabaseAnonKey: ENV.SUPABASE_ANON_KEY || '',

    /* Storage bucket for item photos. */
    photosBucket: ENV.SUPABASE_PHOTOS_BUCKET || 'campusfind-photos',

    /* 'auto'  → use Supabase when configured, else localStorage
       'local' → always localStorage (offline / review build)
       'supabase' → require Supabase and fail loudly if absent */
    mode: ENV.CAMPUSFIND_MODE || 'auto',
  };

  config.isSupabaseConfigured = function isSupabaseConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  };

  config.mode = (function resolveMode() {
    if (ENV.CAMPUSFIND_MODE === 'local') return 'local';
    if (ENV.CAMPUSFIND_MODE === 'supabase') return 'supabase';
    return config.isSupabaseConfigured() ? 'supabase' : 'local';
  }());

  window.CF.config = config;
})();