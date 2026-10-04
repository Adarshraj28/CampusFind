/* ============================================================
   CampusFind — notifications.js
   Notification centre: dropdown, full page, unread badge,
   mark read / mark all read.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;

  const TYPE_META = {
    match: { icon: 'target', color: 'blue' },
    claim: { icon: 'file-check-2', color: 'violet' },
    approval: { icon: 'check-circle-2', color: 'green' },
    rejection: { icon: 'x-circle', color: 'red' },
    pickup: { icon: 'package-check', color: 'amber' },
    returned: { icon: 'party-popper', color: 'green' },
    report: { icon: 'file-plus-2', color: 'blue' },
    storage: { icon: 'archive', color: 'amber' },
    system: { icon: 'bell', color: 'blue' },
  };

  function forUser(userId) {
    return (S().notifications() || [])
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function unreadCount(userId) {
    return forUser(userId).filter((n) => !n.read).length;
  }

  function markRead(id) {
    const list = S().notifications() || [];
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    list[idx] = Object.assign({}, list[idx], { read: true, readAt: new Date().toISOString() });
    S().saveNotifications(list);
    return true;
  }

  function markAllRead(userId) {
    const list = (S().notifications() || []).map((n) =>
      n.userId === userId && !n.read
        ? Object.assign({}, n, { read: true, readAt: new Date().toISOString() })
        : n
    );
    S().saveNotifications(list);
    return true;
  }

  function clearAll(userId) {
    const list = (S().notifications() || []).filter((n) => n.userId !== userId);
    S().saveNotifications(list);
    return true;
  }

  function meta(type) {
    return TYPE_META[type] || TYPE_META.system;
  }

  /* ---------- Dropdown (rendered by app.js into the topbar) ---------- */
  function dropdownHtml(userId) {
    const list = forUser(userId).slice(0, 6);
    const unread = unreadCount(userId);
    const rows = list.length
      ? list.map((n) => miniRow(n)).join('')
      : `<div class="search-empty"><i data-lucide="bell-off" aria-hidden="true" style="width:26px;height:26px;margin:0 auto 8px"></i><br>No notifications yet.</div>`;

    return `<div class="dropdown-head">
        <span>Notifications</span>
        <button type="button" class="btn btn-ghost btn-sm" data-notif-mark-all ${unread ? '' : 'disabled'}>Mark all read</button>
      </div>
      <div style="max-height:340px;overflow-y:auto">${rows}</div>
      <div class="dropdown-foot"><a href="notifications.html" class="text-sm font-semibold">View all notifications</a></div>`;
  }

  function miniRow(n) {
    const m = meta(n.type);
    return `<a class="notif-mini ${n.read ? '' : 'unread'}" href="${U().escapeHtml(n.link || 'notifications.html')}" data-notif-open="${U().escapeHtml(n.id)}">
      <span class="n-ico"><i data-lucide="${m.icon}" aria-hidden="true"></i></span>
      <span class="n-body">
        <b>${U().escapeHtml(n.title)}</b>
        <p>${U().escapeHtml(n.message)}</p>
        <span class="n-time">${U().relativeTime(n.createdAt)}</span>
      </span>
    </a>`;
  }

  /* ---------- Full page ---------- */
  function renderPage(root, userId) {
    if (!root) return;
    const state = { filter: 'all' };
    const all = forUser(userId);

    function draw() {
      const list = state.filter === 'unread' ? all.filter((n) => !n.read) : all;
      const unread = unreadCount(userId);
      const counts = { all: all.length, unread };

      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>Notifications</h1>
            <p>Updates about your reports, matches, claims and pickups.</p>
          </div>
          <div class="page-actions">
            <button type="button" class="btn btn-secondary" data-notif-clear>
              <i data-lucide="trash-2" aria-hidden="true"></i> Clear all
            </button>
            <button type="button" class="btn btn-primary" data-notif-mark-all ${unread ? '' : 'disabled'}>
              <i data-lucide="check-check" aria-hidden="true"></i> Mark all as read
            </button>
          </div>
        </div>

        <div class="tabs" role="tablist" aria-label="Notification filter">
          <button type="button" class="tab-btn ${state.filter === 'all' ? 'active' : ''}" role="tab" aria-selected="${state.filter === 'all'}" data-notif-filter="all">
            All <span class="tab-count">${counts.all}</span>
          </button>
          <button type="button" class="tab-btn ${state.filter === 'unread' ? 'active' : ''}" role="tab" aria-selected="${state.filter === 'unread'}" data-notif-filter="unread">
            Unread <span class="tab-count">${counts.unread}</span>
          </button>
        </div>

        ${list.length ? `<h2 class="visually-hidden">Your notifications</h2><div class="notif-list">${list.map(row).join('')}</div>` : emptyState(state.filter)}`;

      U().refreshIcons(root);
      bind();
    }

    function emptyState(filter) {
      return `<div class="empty-state">
        <div class="empty-ico"><i data-lucide="bell-off" aria-hidden="true"></i></div>
        <h3>${filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</h3>
        <p>${filter === 'unread'
          ? 'Every notification has been read. Your activity will appear here as you report, match and claim.'
          : 'Activity on your reports, matches and claims will appear here.'}</p>
        <a class="btn btn-primary" href="dashboard.html"><i data-lucide="layout-dashboard" aria-hidden="true"></i> Back to dashboard</a>
      </div>`;
    }

    function row(n) {
      const m = meta(n.type);
      const date = U().formatDateTime(n.createdAt);
      const time = U().relativeTime(n.createdAt);
      return `<article class="notif-row ${n.read ? '' : 'unread'}" data-notif-row="${U().escapeHtml(n.id)}">
        <span class="n-ico"><i data-lucide="${m.icon}" aria-hidden="true"></i></span>
        <div class="n-content">
          <h3>${n.read ? '' : '<span class="unread-dot" aria-label="Unread"></span>'}${U().escapeHtml(n.title)}</h3>
          <p>${U().escapeHtml(n.message)}</p>
          <span class="n-time"><i data-lucide="clock" aria-hidden="true"></i> ${date} · ${time}</span>
        </div>
        <div class="n-actions">
          ${n.link ? `<a class="btn btn-soft btn-sm" href="${U().escapeHtml(n.link)}">Open</a>` : ''}
          ${n.read
            ? '<span class="badge badge-gray"><i data-lucide="check" aria-hidden="true"></i> Read</span>'
            : `<button type="button" class="btn btn-secondary btn-sm" data-notif-read="${U().escapeHtml(n.id)}">Mark read</button>`}
        </div>
      </article>`;
    }

    function bind() {
      U().qsa('[data-notif-filter]', root).forEach((btn) => {
        btn.addEventListener('click', () => { state.filter = btn.getAttribute('data-notif-filter'); draw(); });
      });
      U().qsa('[data-notif-read]', root).forEach((btn) => {
        btn.addEventListener('click', () => {
          markRead(btn.getAttribute('data-notif-read'));
          draw();
          window.CF.ui && window.CF.ui.refreshNotifBadge();
        });
      });
      const markAll = root.querySelector('[data-notif-mark-all]');
      if (markAll) markAll.addEventListener('click', () => {
        markAllRead(userId); draw();
        window.CF.ui && window.CF.ui.refreshNotifBadge();
        window.CF.ui && window.CF.ui.toast('success', 'All notifications marked as read.');
      });
      const clear = root.querySelector('[data-notif-clear]');
      if (clear) clear.addEventListener('click', () => {
        window.CF.ui && window.CF.ui.confirm({
          title: 'Clear all notifications?',
          message: 'This removes every notification from your list. It cannot be undone.',
          confirmLabel: 'Clear all',
          tone: 'danger',
          onConfirm: () => {
            clearAll(userId); draw();
            window.CF.ui && window.CF.ui.refreshNotifBadge();
            window.CF.ui && window.CF.ui.toast('success', 'Notifications cleared.');
          },
        });
      });
    }

    draw();
  }

  window.CF.notifications = {
    forUser, unreadCount, markRead, markAllRead, clearAll,
    dropdownHtml, renderPage, meta, TYPE_META,
  };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits.notifications = (root, user) => renderPage(root, user.id);
})();
