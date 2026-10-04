/* ============================================================
   CampusFind — auth.js
   Browser-side session handling for the current build.
   The deployed build MUST move this to the server /
   Supabase Auth: HTTPS-only session cookies, server-side
   rate limiting, bcrypt/argon2 hashing, CSRF protection.
   No plaintext password is ever stored here.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;
  const V = () => window.CF.validation;

  const SESSION_KEY = 'session';
  const REMEMBER_KEY = 'remember_email';
  const ATTEMPT_KEY = 'login_attempts';
  const MAX_ATTEMPTS = 5;
  const LOCK_MINUTES = 5;
  const SESSION_HOURS = 12;

  const PUBLIC_PAGES = ['index.html', 'login.html', 'register.html', 'forgot-password.html', 'lost-items.html', 'found-items.html', 'item-details.html', '404.html', '403.html', ''];

  /* ---------- Password digest ---------- */
  function hashPassword(email, password) {
    if (window.CF.seed && window.CF.seed.digestPassword) {
      return window.CF.seed.digestPassword(email, password);
    }
    return `cf1$${String(password).length}`;
  }

  function passwordsMatch(user, password) {
    if (!user) return false;
    return hashPassword(user.email, password) === user.passwordHash;
  }

  /* ---------- Session ---------- */
  function saveSession(user, remember) {
    const session = {
      userId: user.id,
      token: U().uid('tok'),
      remember: !!remember,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
    };
    const storage = remember ? window.localStorage : window.sessionStorage;
    try {
      clearSession();
      storage.setItem(SESSION_KEY, JSON.stringify(session));
      if (remember) localStorage.setItem(REMEMBER_KEY, user.email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) { /* storage unavailable */ }
    return session;
  }

  function readSession() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    } catch (e) { return null; }
    if (!raw) return null;
    const session = U().safeParse(raw, null);
    if (!session || !session.userId) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session) return null;
    const user = S().findUser(session.userId);
    if (!user || user.status === 'inactive') {
      clearSession();
      return null;
    }
    return user;
  }

  function isAuthenticated() {
    return getCurrentUser() !== null;
  }

  function getUserRole() {
    const user = getCurrentUser();
    return user ? user.role : null;
  }

  /* ---------- Attempt limiter ---------- */
  function attemptStore() {
    return U().safeParse(localStorage.getItem(ATTEMPT_KEY), { attempts: [], lockedUntil: 0 }) ||
      { attempts: [], lockedUntil: 0 };
  }

  function writeAttemptStore(store) {
    try { localStorage.setItem(ATTEMPT_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  function lockRemainingMs() {
    const store = attemptStore();
    const remaining = (store.lockedUntil || 0) - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  function recordFailedAttempt() {
    const store = attemptStore();
    const cutoff = Date.now() - LOCK_MINUTES * 60 * 1000;
    store.attempts = (store.attempts || []).filter((t) => t > cutoff);
    store.attempts.push(Date.now());
    if (store.attempts.length >= MAX_ATTEMPTS) {
      store.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
      store.attempts = [];
    }
    writeAttemptStore(store);
    return store.lockedUntil && store.lockedUntil > Date.now();
  }

  function clearAttempts() {
    writeAttemptStore({ attempts: [], lockedUntil: 0 });
  }

  function attemptsRemaining() {
    const store = attemptStore();
    return Math.max(0, MAX_ATTEMPTS - (store.attempts || []).length);
  }

  /* ---------- Login ---------- */
  function authenticate(email, password) {
    const lock = lockRemainingMs();
    if (lock > 0) {
      return { ok: false, code: 'locked', message: `Too many attempts. Please try again in ${Math.ceil(lock / 60000)} minute(s).` };
    }
    const user = S().findUserByEmail(email);
    if (!user || !passwordsMatch(user, password)) {
      const locked = recordFailedAttempt();
      const attemptsLeft = attemptsRemaining();
      return {
        ok: false,
        code: 'credentials',
        // Generic message: never reveal which field was wrong or whether the account exists.
        message: 'Incorrect email or password.',
        attemptsLeft,
        locked,
      };
    }
    if (user.status === 'inactive') {
      return { ok: false, code: 'inactive', message: 'This account has been deactivated. Contact campus administration.' };
    }
    clearAttempts();
    return { ok: true, user };
  }

  /* Async wrapper used by the login form (simulates network latency) */
  async function loginUser(email, password, options) {
    await U().sleep(650);
    const result = authenticate(email, password);
    if (result.ok) {
      saveSession(result.user, options && options.remember);
      S().updateUser(result.user.id, { lastLogin: new Date().toISOString() });
      S().pushAudit({
        id: U().uid('a'),
        ts: new Date().toISOString(),
        userId: result.user.id,
        userName: result.user.name,
        action: 'User logged in',
        caseId: '—',
        ip: '10.24.0.1',
        status: 'Success',
      });
    } else if (result.code === 'credentials' && result.attemptsLeft <= 1) {
      S().pushAudit({
        id: U().uid('a'),
        ts: new Date().toISOString(),
        userId: 'anonymous',
        userName: 'Unknown user',
        action: 'Repeated failed login attempt',
        caseId: '—',
        ip: '10.24.0.1',
        status: 'Blocked',
      });
    }
    return result;
  }

  function logoutUser() {
    const user = getCurrentUser();
    if (user) {
      S().pushAudit({
        id: U().uid('a'),
        ts: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        action: 'User logged out',
        caseId: '—',
        ip: '10.24.0.1',
        status: 'Success',
      });
    }
    clearSession();
    return true;
  }

  /* ---------- Registration ---------- */
  function registerUser(data) {
    const name = V().validateName(data.name);
    if (!name.valid) return { ok: false, field: 'name', message: name.message };

    const email = V().validateEmail(data.email, { collegeOnly: true });
    if (!email.valid) return { ok: false, field: 'email', message: email.message };
    if (S().findUserByEmail(data.email)) {
      return { ok: false, field: 'email', message: 'An account with this email already exists.' };
    }

    const collegeId = V().validateCollegeId(data.collegeId);
    if (!collegeId.valid) return { ok: false, field: 'collegeId', message: collegeId.message };

    const password = V().validatePassword(data.password);
    if (!password.valid) return { ok: false, field: 'password', message: password.message };

    if (String(data.password) !== String(data.confirmPassword)) {
      return { ok: false, field: 'confirmPassword', message: 'Passwords do not match.' };
    }

    if (data.phone) {
      const phone = V().validatePhone(data.phone);
      if (!phone.valid) return { ok: false, field: 'phone', message: phone.message };
    }

    const terms = V().validateTerms(!!data.agreeTerms);
    if (!terms.valid) return { ok: false, field: 'agreeTerms', message: terms.message };

    const now = new Date().toISOString();
    const user = {
      id: U().uid('u'),
      name: String(data.name).trim(),
      email: String(data.email).trim().toLowerCase(),
      collegeId: String(data.collegeId).trim().toUpperCase(),
      // Role is NOT freely selectable: default student.
      // Faculty/staff accounts require admin creation or invitation.
      role: 'student',
      status: 'active',
      phone: data.phone ? String(data.phone).trim() : '',
      department: 'B.Tech Computer Science & Engineering',
      passwordHash: hashPassword(String(data.email).trim().toLowerCase(), String(data.password)),
      createdAt: now,
      lastLogin: null,
      invited: false,
    };

    S().addUser(user);
    S().pushAudit({
      id: U().uid('a'),
      ts: now,
      userId: user.id,
      userName: user.name,
      action: 'Student registered account',
      caseId: '—',
      ip: '10.24.0.1',
      status: 'Success',
    });
    return { ok: true, user };
  }

  /* ---------- Guards ---------- */
  function currentFile() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function redirectAfterLogin(user) {
    const target = user && user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    const next = U().param('next', '');
    const safe = next && /^[a-z0-9\-\.]+\.html/i.test(next) ? next : target;
    // Admins may land on a student page only if explicitly requested and allowed
    if (user.role !== 'admin' && safe.indexOf('admin') === 0) {
      window.location.href = target;
      return target;
    }
    window.location.href = safe;
    return safe;
  }

  function redirectToLogin() {
    const file = currentFile();
    const next = file && file !== 'login.html' ? `?next=${encodeURIComponent(file + window.location.search)}` : '';
    window.location.replace(`login.html${next}`);
  }

  /* requireAuth(): called by protected pages; returns user or redirects */
  function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
      redirectToLogin();
      return null;
    }
    return user;
  }

  /* requireRole('admin', ...): role guard — never rely on hidden UI alone */
  function requireRole(...roles) {
    const user = getCurrentUser();
    if (!user) {
      redirectToLogin();
      return null;
    }
    if (roles.length && roles.indexOf(user.role) === -1) {
      window.location.replace('403.html');
      return null;
    }
    return user;
  }

  /* Pure authorisation predicate — unit-testable */
  function canUserAccess(role, pageKey) {
    const MATRIX = {
      admin: ['admin'],
      'admin-overview': ['admin'],
      dashboard: ['student', 'faculty', 'staff', 'admin'],
      'report-lost': ['student', 'faculty', 'staff', 'admin'],
      'report-found': ['student', 'faculty', 'staff', 'admin'],
      'lost-items': ['student', 'faculty', 'staff', 'admin', 'guest'],
      'found-items': ['student', 'faculty', 'staff', 'admin', 'guest'],
      'item-details': ['student', 'faculty', 'staff', 'admin', 'guest'],
      'my-reports': ['student', 'faculty', 'staff', 'admin'],
      claims: ['student', 'faculty', 'staff', 'admin'],
      'claim-details': ['student', 'faculty', 'staff', 'admin'],
      notifications: ['student', 'faculty', 'staff', 'admin'],
      profile: ['student', 'faculty', 'staff', 'admin'],
      'admin-overview': ['admin'],
      'admin-reports': ['staff', 'admin'],
      'admin-claims': ['staff', 'admin'],
      'admin-users': ['admin'],
      'admin-analytics': ['admin'],
      'admin-audit': ['admin'],
    };
    // Own-property check only: never fall through to Object.prototype keys
    if (!Object.prototype.hasOwnProperty.call(MATRIX, pageKey)) return false;
    const allowed = MATRIX[pageKey];
    if (!Array.isArray(allowed)) return false;
    return allowed.indexOf(role) !== -1;
  }

  function getRememberedEmail() {
    try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch (e) { return ''; }
  }

  /* ---------- Profile ---------- */
  function updateProfile(userId, patch) {
    const clean = {};
    if (patch.name !== undefined) {
      const check = V().validateName(patch.name);
      if (!check.valid) return { ok: false, message: check.message };
      clean.name = String(patch.name).trim();
    }
    if (patch.phone !== undefined && patch.phone !== '') {
      const check = V().validatePhone(patch.phone);
      if (!check.valid) return { ok: false, message: check.message };
      clean.phone = String(patch.phone).trim();
    }
    if (patch.department !== undefined) clean.department = String(patch.department).trim().slice(0, 60);
    S().updateUser(userId, clean);
    return { ok: true, user: S().findUser(userId) };
  }

  function changePassword(userId, currentPassword, newPassword) {
    const user = S().findUser(userId);
    if (!user) return { ok: false, message: 'Account not found.' };
    if (!passwordsMatch(user, currentPassword)) {
      return { ok: false, message: 'Current password is incorrect.' };
    }
    const check = V().validatePassword(newPassword);
    if (!check.valid) return { ok: false, message: check.message };
    if (String(currentPassword) === String(newPassword)) {
      return { ok: false, message: 'New password must be different from the current password.' };
    }
    S().updateUser(userId, {
      passwordHash: hashPassword(user.email, String(newPassword)),
      passwordChangedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  /* ============================================================
     Page bindings: login.html / register.html / forgot-password.html
     Static markup lives in the HTML; this only wires behaviour.
     ============================================================ */
  function showAlert(el, tone, message) {
    if (!el) return;
    el.className = `auth-alert show ${tone}`;
    const iconName = tone === 'success' ? 'check-circle-2' : (tone === 'warning' ? 'alert-triangle' : 'alert-circle');
    el.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i><span>${window.CF.utils.escapeHtml(message)}</span>`;
    window.CF.utils.refreshIcons(el);
  }

  function hideAlert(el) {
    if (!el) return;
    el.classList.remove('show');
  }

  function setLoading(button, loading, loadingLabel) {
    if (!button) return;
    if (loading) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${loadingLabel}`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.label || button.innerHTML;
      window.CF.utils.refreshIcons(button);
    }
  }

  function bindPasswordToggles(scope) {
    window.CF.utils.qsa('[data-pw-toggle]', scope).forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        btn.setAttribute('title', showing ? 'Show password' : 'Hide password');
        btn.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}" aria-hidden="true"></i>`;
        window.CF.utils.refreshIcons(btn);
      });
    });
  }

  /* ---------- Login page ---------- */
  function initLoginPage() {
    const existing = getCurrentUser();
    if (existing) {
      window.location.replace(existing.role === 'admin' ? 'admin.html' : 'dashboard.html');
      return;
    }

    const U = window.CF.utils;
    const V = window.CF.validation;
    const form = document.getElementById('login-form');
    if (!form) return;

    const email = document.getElementById('login-email');
    const password = document.getElementById('login-password');
    const remember = document.getElementById('login-remember');
    const submit = document.getElementById('login-submit');
    const alertBox = document.getElementById('login-alert');
    const caps = document.getElementById('caps-warning');

    /* Prefill: remembered email, or ?as= query from a landing link */
    const sample = U.param('as', '');
    const SAMPLE_ACCOUNTS = {
      student: { email: 'aarav.sharma@galgotiasuniversity.edu.in', password: 'Student@123' },
      staff: { email: 'neha.gupta@galgotiasuniversity.edu.in', password: 'Staff@123' },
      admin: { email: 'r.menon@galgotiasuniversity.edu.in', password: 'Admin@123' },
    };
    if (sample && SAMPLE_ACCOUNTS[sample]) {
      email.value = SAMPLE_ACCOUNTS[sample].email;
      password.value = SAMPLE_ACCOUNTS[sample].password;
      showAlert(alertBox, 'info', 'Sample credentials filled. Press Sign In to continue.');
    } else {
      const remembered = getRememberedEmail();
      if (remembered) {
        email.value = remembered;
        remember.checked = true;
      }
    }

    if (U.param('registered', '') === '1') {
      showAlert(alertBox, 'success', 'Account created successfully. Sign in with your new credentials.');
    }

    /* Password visibility (dedicated eye button) */
    const toggle = document.getElementById('login-pw-toggle');
    toggle.addEventListener('click', () => {
      const showing = password.type === 'text';
      password.type = showing ? 'password' : 'text';
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      toggle.setAttribute('title', showing ? 'Show password' : 'Hide password');
      toggle.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}" aria-hidden="true"></i>`;
      U.refreshIcons(toggle);
    });

    /* Caps Lock warning */
    ['keydown', 'keyup'].forEach((evt) => password.addEventListener(evt, (e) => {
      if (typeof e.getModifierState === 'function') {
        caps.classList.toggle('show', e.getModifierState('CapsLock'));
      }
    }));
    password.addEventListener('blur', () => caps.classList.remove('show'));

    /* Clear inline errors while typing */
    [email, password].forEach((input) => input.addEventListener('input', () => V.clearError(input)));

    /* Reference profile fill (never auto-signs-in) */
    window.CF.utils.qsa('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const account = SAMPLE_ACCOUNTS[btn.getAttribute('data-sample')];
        if (!account) return;
        email.value = account.email;
        password.value = account.password;
        V.clearError(email);
        V.clearError(password);
        hideAlert(alertBox);
        showAlert(alertBox, 'info', 'Sample credentials filled — now press Sign In.');
        submit.focus();
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return; // guard: duplicate submissions
      hideAlert(alertBox);
      V.clearAll(form);

      const emailCheck = V.validateEmail(email.value);
      if (!emailCheck.valid) {
        V.showError(email, emailCheck.message);
        email.focus();
        return;
      }
      if (!password.value) {
        V.showError(password, 'Please enter your password.');
        password.focus();
        return;
      }

      const lock = lockRemainingMs();
      if (lock > 0) {
        showAlert(alertBox, 'error', `Too many attempts. Please try again in ${Math.ceil(lock / 60000)} minute(s).`);
        return;
      }

      setLoading(submit, true, 'Signing in...');
      const result = await loginUser(email.value.trim(), password.value, { remember: remember.checked });
      setLoading(submit, false);

      if (!result.ok) {
        if (result.code === 'locked') {
          showAlert(alertBox, 'error', 'Too many attempts. Please try again later.');
        } else if (result.code === 'inactive') {
          showAlert(alertBox, 'warning', result.message);
        } else {
          // Generic message: never reveal which field is wrong or whether the account exists.
          const attemptsLeft = result.attemptsLeft;
          const suffix = (attemptsLeft !== undefined && attemptsLeft > 0 && attemptsLeft <= 3)
            ? ` ${U.plural(attemptsLeft, 'attempt')} remaining before a temporary lockout.`
            : '';
          showAlert(alertBox, 'error', `Incorrect email or password.${suffix}`);
        }
        password.value = '';
        password.focus();
        return;
      }

      showAlert(alertBox, 'success', 'Signed in successfully. Redirecting...');
      setTimeout(() => redirectAfterLogin(result.user), 450);
    });
  }

  /* ---------- Register page ---------- */
  function initRegisterPage() {
    const existing = getCurrentUser();
    if (existing) {
      window.location.replace(existing.role === 'admin' ? 'admin.html' : 'dashboard.html');
      return;
    }

    const U = window.CF.utils;
    const V = window.CF.validation;
    const form = document.getElementById('register-form');
    if (!form) return;

    const alertBox = document.getElementById('register-alert');
    const submit = document.getElementById('register-submit');
    const fields = {
      name: document.getElementById('reg-name'),
      email: document.getElementById('reg-email'),
      collegeId: document.getElementById('reg-college-id'),
      phone: document.getElementById('reg-phone'),
      password: document.getElementById('reg-password'),
      confirmPassword: document.getElementById('reg-confirm'),
      agreeTerms: document.getElementById('reg-terms'),
    };

    bindPasswordToggles(form);

    /* Live password strength */
    const strength = document.getElementById('pw-strength');
    const strengthLabel = document.getElementById('pw-strength-label');
    fields.password.addEventListener('input', () => {
      const value = fields.password.value;
      let score = 0;
      if (value.length >= 8) score += 1;
      if (/[A-Za-z]/.test(value) && /[0-9]/.test(value)) score += 1;
      if (value.length >= 12) score += 1;
      if (/[^A-Za-z0-9]/.test(value)) score += 1;
      const classes = ['weak', 'weak', 'fair', 'good', 'strong'];
      const labels = ['—', 'Weak', 'Fair', 'Good', 'Strong'];
      strength.className = `pw-strength ${value ? classes[score] : ''}`;
      strengthLabel.textContent = value ? labels[score] : '—';
      V.clearError(fields.password);
    });

    Object.keys(fields).forEach((key) => {
      const el = fields[key];
      if (!el) return;
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => V.clearError(el));
    });

    /* Roll numbers are typed in lower case by habit (24scse1010457).
       Normalise to upper case as they type and strip spaces, so the
       value is correct before validation ever runs. */
    fields.collegeId.addEventListener('input', () => {
      const cleaned = fields.collegeId.value.toUpperCase().replace(/\s+/g, '');
      if (fields.collegeId.value !== cleaned) fields.collegeId.value = cleaned;
    });

    /* Confirm the two passwords match while typing, so the user is
       told before they press submit rather than after. */
    const confirmError = document.getElementById('reg-confirm-error');
    fields.confirmPassword.addEventListener('input', () => {
      const a = fields.password.value;
      const b = fields.confirmPassword.value;
      if (!b) { V.clearError(fields.confirmPassword); return; }
      if (a !== b) {
        V.showError(fields.confirmPassword, 'Passwords do not match.');
      } else {
        V.clearError(fields.confirmPassword);
        if (confirmError) confirmError.textContent = '';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return; // guard: duplicate submissions
      hideAlert(alertBox);
      V.clearAll(form);

      const checks = {
        name: V.validateName(fields.name.value),
        email: V.validateEmail(fields.email.value, { collegeOnly: true }),
        collegeId: V.validateCollegeId(fields.collegeId.value),
        password: V.validatePassword(fields.password.value),
        confirmPassword: fields.confirmPassword.value === fields.password.value
          ? { valid: true, message: '' }
          : { valid: false, message: 'Passwords do not match.' },
        phone: V.validatePhone(fields.phone.value),
        agreeTerms: V.validateTerms(fields.agreeTerms.checked),
      };

      const failed = Object.keys(checks).filter((key) => !checks[key].valid);
      if (failed.length) {
        failed.forEach((key) => V.showError(fields[key], checks[key].message));
        showAlert(alertBox, 'error', checks[failed[0]].message);
        fields[failed[0]].focus();
        return;
      }

      setLoading(submit, true, 'Creating account...');
      await U.sleep(650);
      const result = registerUser({
        name: fields.name.value,
        email: fields.email.value,
        collegeId: fields.collegeId.value,
        phone: fields.phone.value,
        password: fields.password.value,
        confirmPassword: fields.confirmPassword.value,
        agreeTerms: fields.agreeTerms.checked,
      });
      setLoading(submit, false);

      if (!result.ok) {
        showAlert(alertBox, 'error', result.message);
        if (result.field && fields[result.field]) fields[result.field].focus();
        return;
      }

      showAlert(alertBox, 'success', 'Account created. Redirecting you to sign in...');
      window.CF.ui.toast('success', 'Account created successfully.');
      setTimeout(() => { window.location.href = 'login.html?registered=1'; }, 900);
    });
  }

  /* ---------- Forgot password page ---------- */
  function initForgotPage() {
    const U = window.CF.utils;
    const V = window.CF.validation;
    const form = document.getElementById('forgot-form');
    if (!form) return;

    const email = document.getElementById('forgot-email');
    const submit = document.getElementById('forgot-submit');
    const alertBox = document.getElementById('forgot-alert');

    email.addEventListener('input', () => V.clearError(email));

    if (U.param('registered', '') === '1') {
      showAlert(alertBox, 'success', 'Account created. You can now sign in with your new credentials.');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      hideAlert(alertBox);
      V.clearAll(form);

      const check = V.validateEmail(email.value);
      if (!check.valid) {
        V.showError(email, check.message);
        email.focus();
        return;
      }

      setLoading(submit, true, 'Sending...');
      await U.sleep(800);
      setLoading(submit, false);

      /* Neutral response — never reveals whether the account exists */
      showAlert(alertBox, 'success', 'If this email is registered, password reset instructions have been sent.');
      form.reset();
    });
  }

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits.login = initLoginPage;
  window.CF.pageInits.register = initRegisterPage;
  window.CF.pageInits['forgot-password'] = initForgotPage;

  window.CF.auth = {
    MAX_ATTEMPTS, LOCK_MINUTES,
    hashPassword, passwordsMatch,
    loginUser, authenticate, logoutUser, registerUser,
    getCurrentUser, isAuthenticated, getUserRole,
    requireAuth, requireRole, canUserAccess, redirectAfterLogin, redirectToLogin,
    saveSession, clearSession, lockRemainingMs, attemptsRemaining, clearAttempts,
    getRememberedEmail, updateProfile, changePassword,
    PUBLIC_PAGES,
  };
})();
