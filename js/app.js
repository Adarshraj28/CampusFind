/* ============================================================
   CampusFind — app.js
   Core bootstrap: UI kit (toasts/modals), layout shell,
   role guards, global search, notifications, page dispatch.
   Loaded last; runs on DOMContentLoaded so every module has
   registered its page initialiser.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const U = () => window.CF.utils;
  const S = () => window.CF.storage;
  const A = () => window.CF.auth;

  /* ============================================================
     Toasts
     ============================================================ */
  let toastRoot = null;

  function ensureToastRoot() {
    if (!toastRoot || !document.body.contains(toastRoot)) {
      toastRoot = document.createElement('div');
      toastRoot.className = 'toast-root';
      toastRoot.setAttribute('role', 'status');
      toastRoot.setAttribute('aria-live', 'polite');
      toastRoot.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastRoot);
    }
    return toastRoot;
  }

  const TOAST_ICONS = {
    success: 'check-circle-2',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
  };
  const TOAST_TITLES = {
    success: 'Success',
    error: 'Something went wrong',
    warning: 'Please check',
    info: 'Notice',
  };

  function toast(type, message, options) {
    const opts = options || {};
    const root = ensureToastRoot();
    const kind = TOAST_ICONS[type] ? type : 'info';
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    const duration = opts.duration || (kind === 'error' ? 5200 : 3800);
    el.innerHTML = `
      <i class="t-ico" data-lucide="${TOAST_ICONS[kind]}" aria-hidden="true"></i>
      <div class="t-body">
        <b>${U().escapeHtml(opts.title || TOAST_TITLES[kind])}</b>
        <p>${U().escapeHtml(message)}</p>
      </div>
      <button type="button" class="t-close" aria-label="Dismiss notification">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
      <span class="t-progress" style="animation-duration:${duration}ms"></span>`;
    root.appendChild(el);
    U().refreshIcons(el);

    let timer = setTimeout(remove, duration);
    function remove() {
      el.classList.add('leaving');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    el.querySelector('.t-close').addEventListener('click', () => { clearTimeout(timer); remove(); });
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(remove, 1600); });
    return el;
  }

  /* ============================================================
     Modals (ESC · close button · click outside · focus trap)
     ============================================================ */
  let openModalEl = null;
  let lastFocused = null;

  function modal(config) {
    closeModal();
    lastFocused = document.activeElement;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const tone = config.tone || 'primary';
    const icon = config.icon || 'info';
    backdrop.innerHTML = `
      <div class="modal ${config.wide ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <div class="row u-row-start-lg">
            <span class="modal-icon ${tone}" style="margin-bottom:0"><i data-lucide="${icon}" aria-hidden="true"></i></span>
            <div>
              <h2 id="modal-title">${U().escapeHtml(config.title || 'Confirm')}</h2>
              ${config.subtitle ? `<p>${U().escapeHtml(config.subtitle)}</p>` : ''}
            </div>
          </div>
          <button type="button" class="btn-icon" data-modal-close aria-label="Close dialog">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <div class="modal-body">
          ${config.bodyHtml || ''}
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
        </div>
        <div class="modal-foot">
          ${config.hideCancel ? '' : `<button type="button" class="btn btn-secondary" data-modal-cancel>${U().escapeHtml(config.cancelLabel || 'Cancel')}</button>`}
          ${config.confirmLabel === false ? '' : `<button type="button" class="btn ${config.confirmClass || 'btn-primary'}" data-modal-confirm>${config.confirmIcon !== false ? '<i data-lucide="check" aria-hidden="true"></i>' : ''}${U().escapeHtml(config.confirmLabel || 'Confirm')}</button>`}
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    openModalEl = backdrop;
    U().refreshIcons(backdrop);

    const close = () => closeModal();
    backdrop.querySelector('[data-modal-close]').addEventListener('click', close);
    const cancelBtn = backdrop.querySelector('[data-modal-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

    // Default confirm closes unless the caller wires its own handler
    const confirmBtn = backdrop.querySelector('[data-modal-confirm]');
    if (confirmBtn && !config.keepDefaultConfirm) {
      confirmBtn.addEventListener('click', () => {
        if (config.onConfirm) config.onConfirm();
        else close();
      });
    }

    if (config.onOpen) config.onOpen(backdrop, close);

    // Focus first meaningful control
    const focusable = getFocusable(backdrop);
    const target = backdrop.querySelector('textarea, input, select') ||
      (cancelBtn || confirmBtn || focusable[0]);
    if (target) setTimeout(() => target.focus(), 40);

    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') trapFocus(e, backdrop);
    });
    return { el: backdrop, close };
  }

  function getFocusable(root) {
    return U().qsa('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])', root)
      .filter((el) => el.offsetParent !== null);
  }

  function trapFocus(event, root) {
    const items = getFocusable(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeModal() {
    if (!openModalEl) return;
    if (openModalEl.parentNode) openModalEl.parentNode.removeChild(openModalEl);
    openModalEl = null;
    document.body.style.overflow = '';
    if (lastFocused && document.contains(lastFocused)) {
      try { lastFocused.focus(); } catch (e) { /* noop */ }
    }
  }

  function confirmDialog(config) {
    return modal({
      title: config.title || 'Are you sure?',
      subtitle: config.subtitle || '',
      icon: config.icon || (config.tone === 'danger' ? 'alert-triangle' : 'help-circle'),
      tone: config.tone || 'warning',
      confirmLabel: config.confirmLabel || 'Confirm',
      confirmClass: config.tone === 'danger' ? 'btn-danger' : (config.tone === 'success' ? 'btn-success' : 'btn-primary'),
      cancelLabel: config.cancelLabel || 'Cancel',
      bodyHtml: `<p class="text-sm" style="color:var(--text-secondary)">${U().escapeHtml(config.message || '')}</p>`,
      onConfirm: () => { closeModal(); if (config.onConfirm) config.onConfirm(); },
      keepDefaultConfirm: false,
    });
  }

  /* ============================================================
     Layout shell
     ============================================================ */
  const NAV_SECTIONS = [
    {
      label: 'Overview',
      items: [
        { href: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'lost-items.html', label: 'Lost Items', icon: 'search', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'found-items.html', label: 'Found Items', icon: 'package-search', roles: ['student', 'faculty', 'staff', 'admin'] },
      ],
    },
    {
      label: 'My work',
      items: [
        { href: 'report-lost.html', label: 'Report Lost', icon: 'file-warning', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'report-found.html', label: 'Report Found', icon: 'file-plus-2', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'my-reports.html', label: 'My Reports', icon: 'clipboard-list', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'claims.html', label: 'Claims', icon: 'file-check-2', roles: ['student', 'faculty', 'staff', 'admin'] },
        { href: 'notifications.html', label: 'Notifications', icon: 'bell', roles: ['student', 'faculty', 'staff', 'admin'], badge: 'notif' },
        { href: 'profile.html', label: 'Profile', icon: 'user', roles: ['student', 'faculty', 'staff', 'admin'] },
      ],
    },
    {
      label: 'Operations',
      roles: ['staff', 'admin'],
      items: [
        { href: 'admin-reports.html', label: 'Manage Reports', icon: 'clipboard-list', roles: ['staff', 'admin'] },
        { href: 'admin-claims.html', label: 'Review Claims', icon: 'file-search', roles: ['staff', 'admin'] },
      ],
    },
    {
      label: 'Administration',
      roles: ['admin'],
      items: [
        { href: 'admin.html', label: 'Overview', icon: 'gauge', roles: ['admin'] },
        { href: 'admin-users.html', label: 'Users', icon: 'users', roles: ['admin'] },
        { href: 'admin-analytics.html', label: 'Analytics', icon: 'bar-chart-3', roles: ['admin'] },
        { href: 'admin-audit.html', label: 'Audit Logs', icon: 'scroll-text', roles: ['admin'] },
        { href: '#settings', label: 'Settings', icon: 'settings', roles: ['admin'], action: 'settings' },
      ],
    },
  ];

  function logoHtml() {
    return `<a class="logo" href="index.html" aria-label="CampusFind home">
      <span class="logo-mark">
        <img src="logo.png" alt="" width="40" height="40" decoding="async">
      </span>
      <span class="logo-text">Campus<span>Find</span></span>
    </a>`;
  }

  /* Galgotias University official lockup — issued on every public
     shell so the app reads as a university-owned service. */
  function galgotiasLockup() {
    return `<a class="brand-lockup" href="https://www.galgotiasuniversity.edu.in" target="_blank" rel="noopener" aria-label="Galgotias University · CampusFind">
      <span class="brand-mark">
        <img src="logo.png" alt="" width="38" height="38" decoding="async">
      </span>
      <span class="brand-txt">
        <span class="brand-cf">Campus<span>Find</span></span>
        <span class="brand-gu">Galgotias University</span>
      </span>
    </a>`;
  }

  function currentFile() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function isActive(href) {
    return currentFile() === href;
  }

  function renderPublicNav(activePage) {
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const user = A().getCurrentUser();
    const links = [
      ['index.html', 'Home'],
      ['index.html#how-it-works', 'How It Works'],
      ['lost-items.html', 'Lost Items'],
      ['found-items.html', 'Found Items'],
      ['index.html#about', 'About'],
    ];
    nav.className = 'site-nav';
    nav.innerHTML = `
      <div class="container site-nav-inner">
        ${logoHtml()}
        <nav class="site-nav-links" aria-label="Primary">
          ${links.map(([href, label]) => {
            const file = href.split('#')[0];
            const hash = href.split('#')[1];
            const current = !hash && file === activePage;
            return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
          }).join('')}
        </nav>
        <div class="site-nav-actions">
          <button type="button" class="btn-icon" data-theme-toggle aria-label="Switch theme">
            <i data-lucide="moon" data-theme-icon aria-hidden="true"></i>
          </button>
          ${user
            ? `<a class="btn btn-secondary btn-desktop" href="${user.role === 'admin' ? 'admin.html' : 'dashboard.html'}">Dashboard</a>
               <button type="button" class="btn btn-primary" data-logout>Logout</button>`
            : `<a class="btn btn-ghost btn-desktop" href="login.html">Login</a>
               <a class="btn btn-primary" href="report-lost.html">Report an Item</a>`}
          <button type="button" class="btn-icon nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
            <i data-lucide="menu" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div class="mobile-menu" id="mobile-menu">
        ${logoHtml()}
        ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
        ${user
          ? `<a href="${user.role === 'admin' ? 'admin.html' : 'dashboard.html'}">Dashboard</a>
             <button type="button" class="btn btn-secondary btn-block" data-logout>Logout</button>`
          : `<a href="login.html">Login</a>
             <a class="btn btn-primary btn-block" href="report-lost.html" style="margin-top:14px">Report an Item</a>`}
      </div>`;
    U().refreshIcons(nav);
    bindNavCommon(nav);
  }

  function renderAppShell(user) {
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    const overlay = document.getElementById('sidebar-overlay');
    const file = currentFile();
    const unread = window.CF.notifications.unreadCount(user.id);

    if (sidebar) {
      sidebar.className = 'sidebar';
      sidebar.id = 'sidebar';
      sidebar.innerHTML = `
        <div class="sidebar-head">
          ${logoHtml()}
          <button type="button" class="btn-icon" data-sidebar-close aria-label="Close menu" style="display:none">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <nav class="sidebar-nav" aria-label="Application">
          ${NAV_SECTIONS.map((section) => {
            const visible = section.items.filter((i) => i.roles.indexOf(user.role) !== -1);
            if (!visible.length) return '';
            if (section.roles && section.roles.indexOf(user.role) === -1) return '';
            return `<div class="nav-label">${section.label}</div>` +
              visible.map((item) => {
                if (item.action === 'settings') {
                  return `<button type="button" data-open-settings><i data-lucide="${item.icon}" aria-hidden="true"></i>${item.label}</button>`;
                }
                const count = item.badge === 'notif' && unread ? `<span class="nav-count" data-notif-count>${unread}</span>` : '';
                return `<a href="${item.href}" class="${isActive(item.href) ? 'active' : ''}"${isActive(item.href) ? ' aria-current="page"' : ''}>
                  <i data-lucide="${item.icon}" aria-hidden="true"></i>${item.label}${count}
                </a>`;
              }).join('');
          }).join('')}
        </nav>
        <div class="sidebar-foot">
          <span class="verified-chip"><i data-lucide="shield-check" aria-hidden="true"></i>Campus verified</span>
          <p style="margin-top:8px">CampusFind v1.0 · Static prototype</p>
        </div>`;
      U().refreshIcons(sidebar);
      const settingsBtn = sidebar.querySelector('[data-open-settings]');
      if (settingsBtn) settingsBtn.addEventListener('click', () => window.CF.admin.openSettingsModal());
      const closeBtn = sidebar.querySelector('[data-sidebar-close]');
      if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    }

    if (topbar) {
      topbar.className = 'topbar';
      topbar.id = 'topbar';
      topbar.innerHTML = `
        <button type="button" class="btn-icon topbar-menu-btn" data-sidebar-open aria-label="Open menu">
          <i data-lucide="menu" aria-hidden="true"></i>
        </button>
        <div class="topbar-search">
          <i data-lucide="search" aria-hidden="true"></i>
          <input type="search" id="global-search" placeholder="Search items, case IDs, locations..."
                 aria-label="Global search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="global-search-results">
          <div data-search-results></div>
        </div>
        <div class="topbar-spacer"></div>
        <div class="topbar-actions">
          <button type="button" class="btn-icon" data-theme-toggle aria-label="Switch theme">
            <i data-lucide="moon" data-theme-icon aria-hidden="true"></i>
          </button>
          <div class="dropdown-wrap">
            <button type="button" class="btn-icon" id="notif-btn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">
              <i data-lucide="bell" aria-hidden="true"></i>
              ${unread ? `<span class="notif-dot" data-notif-count>${unread > 9 ? '9+' : unread}</span>` : ''}
            </button>
            <div class="dropdown" id="notif-dropdown" hidden></div>
          </div>
          <div class="dropdown-wrap">
            <button type="button" class="user-menu-btn" id="user-menu-btn" aria-expanded="false" aria-haspopup="true">
              <span class="avatar">${U().initials(user.name)}</span>
              <span style="text-align:left">
                <span class="uname" style="display:block">${U().escapeHtml(user.name)}</span>
                <span class="urole">${U().escapeHtml(user.role)}</span>
              </span>
              <i data-lucide="chevron-down" aria-hidden="true"></i>
            </button>
            <div class="dropdown" id="user-dropdown" hidden>
              <div class="dropdown-head"><span>${U().escapeHtml(user.email)}</span></div>
              <a class="dropdown-item" href="profile.html"><i data-lucide="user" aria-hidden="true"></i> My profile</a>
              <a class="dropdown-item" href="notifications.html"><i data-lucide="bell" aria-hidden="true"></i> Notifications</a>
              ${user.role === 'admin' ? '<a class="dropdown-item" href="admin.html"><i data-lucide="gauge" aria-hidden="true"></i> Admin console</a>' : ''}
              <button type="button" class="dropdown-item danger dropdown-sep" data-logout>
                <i data-lucide="log-out" aria-hidden="true"></i> Logout
              </button>
            </div>
          </div>
        </div>`;
      U().refreshIcons(topbar);
      bindGlobalSearch(topbar);
      bindDropdowns(topbar);
    }

    if (overlay) {
      overlay.className = 'sidebar-overlay';
      overlay.addEventListener('click', closeSidebar);
    }

    const openBtn = document.querySelector('[data-sidebar-open]');
    if (openBtn) openBtn.addEventListener('click', openSidebar);

    bindNavCommon(document.body);
    bindThemeToggles();
  }

  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
    const closeBtn = sidebar && sidebar.querySelector('[data-sidebar-close]');
    if (closeBtn) closeBtn.style.display = '';
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  function bindThemeToggles() {
    U().qsa('[data-theme-toggle]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const next = U().toggleTheme();
        toast('info', next === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.', { duration: 1800 });
      });
    });
    U().applyTheme(U().getTheme());
  }

  function bindNavCommon(scope) {
    U().qsa('[data-logout]', scope).forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        closeDropdowns();
        confirmDialog({
          title: 'Log out of CampusFind?',
          message: 'Your session will end on this device. Any unsaved form input will be lost.',
          confirmLabel: 'Log out',
          tone: 'danger',
          onConfirm: () => {
            A().logoutUser();
            toast('success', 'You have been logged out.');
            setTimeout(() => { window.location.href = 'index.html'; }, 500);
          },
        });
      });
    });
    const navToggle = scope.querySelector ? scope.querySelector('[data-nav-toggle]') : null;
    if (navToggle && !navToggle.dataset.bound) {
      navToggle.dataset.bound = '1';
      const menu = document.getElementById('mobile-menu');
      navToggle.addEventListener('click', () => {
        const open = menu.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', String(open));
        navToggle.innerHTML = `<i data-lucide="${open ? 'x' : 'menu'}" aria-hidden="true"></i>`;
        U().refreshIcons(navToggle);
      });
    }
    bindThemeToggles();
  }

  function bindDropdowns(scope) {
    const pairs = [
      ['notif-btn', 'notif-dropdown', () => {
        const user = A().getCurrentUser();
        const dd = document.getElementById('notif-dropdown');
        if (!user || !dd) return;
        dd.innerHTML = window.CF.notifications.dropdownHtml(user.id);
        U().refreshIcons(dd);
        U().qsa('[data-notif-mark-all]', dd).forEach((b) => b.addEventListener('click', () => {
          window.CF.notifications.markAllRead(user.id);
          refreshNotifBadge();
          const btn = document.getElementById('notif-btn');
          if (btn) btn.click();
          toast('success', 'All notifications marked as read.');
        }));
        U().qsa('[data-notif-open]', dd).forEach((link) => link.addEventListener('click', () => {
          window.CF.notifications.markRead(link.getAttribute('data-notif-open'));
          setTimeout(refreshNotifBadge, 100);
        }));
      }],
      ['user-menu-btn', 'user-dropdown', null],
    ];

    pairs.forEach(([btnId, ddId, onOpen]) => {
      const btn = scope.querySelector(`#${btnId}`);
      const dd = scope.querySelector(`#${ddId}`);
      if (!btn || !dd) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = dd.hasAttribute('hidden');
        closeDropdowns();
        if (willOpen) {
          if (onOpen) onOpen();
          dd.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
          btn.classList.add('is-active');
        }
      });
      dd.addEventListener('click', (e) => e.stopPropagation());
    });

    document.addEventListener('click', closeDropdowns);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdowns();
        closeSidebar();
        if (openModalEl) closeModal();
      }
    });
  }

  function closeDropdowns() {
    U().qsa('.dropdown').forEach((dd) => dd.setAttribute('hidden', ''));
    U().qsa('[aria-haspopup="true"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      b.classList.remove('is-active');
    });
  }

  function refreshNotifBadge() {
    const user = A().getCurrentUser();
    if (!user) return;
    const count = window.CF.notifications.unreadCount(user.id);
    U().qsa('[data-notif-count]').forEach((el) => {
      if (!count) { el.remove(); return; }
      el.textContent = el.classList.contains('notif-dot') ? (count > 9 ? '9+' : String(count)) : String(count);
    });
    if (count && !document.querySelector('.notif-dot')) {
      const btn = document.getElementById('notif-btn');
      if (btn) btn.insertAdjacentHTML('beforeend', `<span class="notif-dot" data-notif-count>${count > 9 ? '9+' : count}</span>`);
    }
    const navCount = document.querySelector('.sidebar-nav [data-notif-count]');
    if (!navCount && count) {
      const link = document.querySelector('.sidebar-nav a[href="notifications.html"]');
      if (link) link.insertAdjacentHTML('beforeend', `<span class="nav-count" data-notif-count>${count}</span>`);
    }
  }

  /* ============================================================
     Global search (300ms debounce, case-insensitive, partial)
     ============================================================ */
  function bindGlobalSearch(scope) {
    const input = scope.querySelector('#global-search');
    const holder = scope.querySelector('[data-search-results]');
    if (!input || !holder) return;

    const run = U().debounce(() => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { holder.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); return; }
      const results = [];
      S().reports().forEach((r) => {
        const haystack = [r.id, r.itemName, r.description, r.category, r.location, r.color, r.brand]
          .join(' ').toLowerCase();
        if (haystack.includes(q)) results.push(r);
      });
      input.setAttribute('aria-expanded', 'true');
      if (!results.length) {
        holder.innerHTML = `<div class="search-results"><div class="search-empty">
          <i data-lucide="search-x" aria-hidden="true" style="width:24px;height:24px;margin:0 auto 6px"></i><br>
          No matches for "${U().escapeHtml(input.value)}". Try a case ID, item or location.
        </div></div>`;
        U().refreshIcons(holder);
        return;
      }
      holder.innerHTML = `<div class="search-results" role="listbox">${
        results.slice(0, 6).map((r) => `
          <button type="button" class="search-result-item" role="option" data-goto="${encodeURIComponent(r.id)}">
            <span class="sr-ico"><i data-lucide="${r.type === 'lost' ? 'search' : 'package'}" aria-hidden="true"></i></span>
            <span class="sr-body">
              <b>${U().escapeHtml(r.itemName)}</b>
              <span>${U().escapeHtml(r.location)} · ${U().formatDate(r.dateLost || r.dateFound || r.createdAt)}</span>
            </span>
            <span class="sr-tag">${r.type}</span>
          </button>`).join('')}
          <a class="search-result-item" href="found-items.html" style="justify-content:center;color:var(--primary);font-weight:600;font-size:13.5px">
            See all results for "${U().escapeHtml(input.value)}" →
          </a>
        </div>`;
      U().refreshIcons(holder);
      U().qsa('[data-goto]', holder).forEach((btn) => btn.addEventListener('click', () => {
        window.location.href = `item-details.html?id=${btn.getAttribute('data-goto')}`;
      }));
    }, 300);

    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (holder.innerHTML.trim()) input.setAttribute('aria-expanded', 'true'); });
    document.addEventListener('click', (e) => {
      if (!scope.querySelector('.topbar-search').contains(e.target)) {
        holder.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ============================================================
     Page dispatch + guards
     ============================================================ */
  const PAGE_GUARDS = {
    dashboard: { auth: true },
    'report-lost': { auth: true },
    'report-found': { auth: true },
    'my-reports': { auth: true },
    claims: { auth: true },
    'claim-details': { auth: true },
    notifications: { auth: true },
    profile: { auth: true },
    'lost-items': { auth: false },
    'found-items': { auth: false },
    'item-details': { auth: false },
    admin: { auth: true, roles: ['admin'] },
    'admin-reports': { auth: true, roles: ['staff', 'admin'] },
    'admin-claims': { auth: true, roles: ['staff', 'admin'] },
    'admin-users': { auth: true, roles: ['admin'] },
    'admin-analytics': { auth: true, roles: ['admin'] },
    'admin-audit': { auth: true, roles: ['admin'] },
  };

  function renderFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            ${logoHtml()}
            <p>Lost something? Let's find it. CampusFind connects students, faculty, staff and campus support teams to report, discover, verify and recover belongings.</p>
            <div class="footer-lockup">${galgotiasLockup()}</div>
            <span class="footer-note"><i data-lucide="shield-check" aria-hidden="true"></i>Your reports and claims are visible only to you and the campus lost &amp; found team.</span>
          </div>
          <div class="footer-col">
            <h4>Explore</h4>
            <a href="lost-items.html">Lost items</a>
            <a href="found-items.html">Found items</a>
            <a href="index.html#how-it-works">How it works</a>
            <a href="index.html#about">About</a>
          </div>
          <div class="footer-col">
            <h4>Account</h4>
            <a href="login.html">Sign in</a>
            <a href="register.html">Create account</a>
            <a href="dashboard.html">Dashboard</a>
            <a href="notifications.html">Notifications</a>
          </div>
          <div class="footer-col">
            <h4>Campus</h4>
            <a href="report-lost.html">Report a lost item</a>
            <a href="report-found.html">Report a found item</a>
            <a href="forgot-password.html">Reset password</a>
            <a href="privacy.html">Privacy policy</a>
            <a href="403.html">Access policy</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} CampusFind · Campus Lost &amp; Found Management System</span>
          <span>Galgotias University · Built with HTML5, CSS3 and vanilla JavaScript</span>
        </div>
      </div>`;
    U().refreshIcons(footer);
  }

  function init() {
    S().ensureSeeded();
    U().initTheme();

    const body = document.body;
    const page = body.dataset.page || 'index';
    const nav = body.dataset.nav || 'public';
    const guard = PAGE_GUARDS[page] || { auth: false };
    const rolesAttr = body.getAttribute('data-roles');
    const requiredRoles = rolesAttr ? rolesAttr.split(',').map((s) => s.trim()).filter(Boolean) : guard.roles;

    let user = A().getCurrentUser();

    /* --- Authentication guard --- */
    if (guard.auth && !user) {
      renderPublicNav(currentFile());
      A().redirectToLogin();
      return;
    }
    if (requiredRoles && requiredRoles.length && user && requiredRoles.indexOf(user.role) === -1) {
      A().requireRole(...requiredRoles);   // redirects to 403.html
      return;
    }

    /* --- Shell --- */
    const navMode = nav === 'auto' ? (user ? 'app' : 'public') : nav;
    document.body.classList.remove('nav-app', 'nav-public');
    document.body.classList.add(navMode === 'app' && user ? 'nav-app' : 'nav-public');
    if (navMode === 'app' && user) {
      renderAppShell(user);
      const closeBtn = document.querySelector('[data-sidebar-close]');
      if (closeBtn && window.matchMedia('(min-width: 1025px)').matches) closeBtn.style.display = 'none';
    } else {
      renderPublicNav(currentFile());
    }
    if (navMode !== 'app') renderFooter();
    bindThemeToggles();

    /* --- Guest prompt on public pages with app actions --- */
    if (!user && navMode !== 'app') { /* landing/auth behave normally */ }

    /* --- Page initialisation --- */
    const main = document.getElementById('main-content') || document.body;
    const pageInit = (window.CF.pageInits || {})[page];
    if (typeof pageInit === 'function') {
      try {
        pageInit(main, user);
      } catch (err) {
        console.error(`CampusFind: page init failed for "${page}"`, err);
        toast('error', 'Something went wrong while loading this page.');
      }
    }

    refreshNotifBadge();
    U().refreshIcons(document.body);

    // Close mobile menu when navigating
    U().qsa('.mobile-menu a').forEach((a) => a.addEventListener('click', () => {
      const menu = document.getElementById('mobile-menu');
      if (menu) menu.classList.remove('is-open');
    }));
  }

  /* Page registry — modules register before DOMContentLoaded fires */
  window.CF.pageInits = window.CF.pageInits || {};

  /* Landing page: live counters driven by the current dataset */
  function countUp(el, target) {
    if (!target) { el.textContent = '0'; return; }
    const duration = 700;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.CF.pageInits.index = function initLanding(root) {
    const stats = {
      users: S().users().length,
      reports: S().reports().length,
      recovered: S().reports().filter((r) => r.status === 'returned').length +
        S().claims().filter((c) => c.status === 'ITEM_RETURNED').length,
      claims: S().claims().length,
    };
    U().qsa('[data-live-stat]').forEach((el) => {
      const key = el.getAttribute('data-live-stat');
      if (stats[key] !== undefined) countUp(el, stats[key]);
    });

    /* ---------- Hero: live search ---------- */
    const searchForm = document.getElementById('hero-search');
    if (searchForm) {
      const input = document.getElementById('hero-search-input');
      const go = (term) => {
        const q = String(term === undefined ? input.value : term).trim();
        if (!q) return;
        window.location.href = `found-items.html?q=${encodeURIComponent(q)}`;
      };
      searchForm.addEventListener('submit', (e) => { e.preventDefault(); go(); });
      U().qsa('[data-hero-search]').forEach((chip) => {
        chip.addEventListener('click', () => go(chip.getAttribute('data-hero-search')));
      });
    }

    /* ---------- Hero: recently handed in, with photos ---------- */
    const holder = root.querySelector('[data-hero-items]') || document.querySelector('[data-hero-items]');
    if (holder) {
      const recent = S().foundReports()
        .filter((r) => r.status !== 'archived')
        .sort((a, b) => String(b.dateFound || b.createdAt).localeCompare(String(a.dateFound || a.createdAt)))
        .slice(0, 3);
      holder.innerHTML = recent.map((r) => {
        const img = (r.images && r.images[0]) || '';
        const ago = U().relativeTime(r.createdAt);
        return `<a class="hero-item" href="item-details.html?id=${encodeURIComponent(r.id)}">
          <span class="hero-item-thumb">
            ${img ? `<img src="${U().escapeHtml(img)}" alt="${U().escapeHtml(r.itemName)}" width="72" height="72" loading="lazy" decoding="async">` : ''}
          </span>
          <span class="hero-item-body">
            <b>${U().escapeHtml(r.itemName)}</b>
            <span><i data-lucide="map-pin" aria-hidden="true"></i>${U().escapeHtml(r.location)}</span>
            <span class="hero-item-when">Handed in ${U().escapeHtml(ago)}</span>
          </span>
          <span class="hero-item-id">${U().escapeHtml(r.id.slice(-5))}</span>
        </a>`;
      }).join('');
      U().refreshIcons(holder);
    }
    // Role shortcuts on the landing hero
    U().qsa('[data-sample-fill]').forEach((btn) => {
      btn.addEventListener('click', () => { window.location.href = `login.html?as=${btn.getAttribute('data-sample-fill')}`; });
    });
  };

  window.CF.ui = {
    toast, modal, confirm: confirmDialog, closeModal, openModal: modal,
    refreshNotifBadge, closeDropdowns, openSidebar, closeSidebar, renderPublicNav,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
