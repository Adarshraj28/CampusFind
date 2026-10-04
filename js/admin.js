/* ============================================================
   CampusFind — admin.js
   Admin/staff console: overview, report management, claim
   review, user management, audit log, testing dashboard.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;
  const V = () => window.CF.validation;

  const IP_PLACEHOLDER = '10.24.x.x';

  /* ============================================================
     Overview (admin.html)
     ============================================================ */
  function renderOverview(root, user) {
    const users = S().users();
    const reports = S().reports();
    const lost = reports.filter((r) => r.type === 'lost');
    const found = reports.filter((r) => r.type === 'found');
    const claims = S().claims();
    const activeClaims = claims.filter((c) => ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1);
    const pendingClaims = claims.filter((c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW');
    const recovered = reports.filter((r) => r.status === 'returned').length +
      claims.filter((c) => c.status === 'ITEM_RETURNED').length;

    root.innerHTML = `
      <header class="greeting">
        <div>
          <h1>${U().greeting()}, ${U().escapeHtml(user.name.split(' ')[0])}</h1>
          <p>Campus-wide lost &amp; found operations at a glance.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" href="admin-analytics.html"><i data-lucide="bar-chart-3" aria-hidden="true"></i> Analytics</a>
          <a class="btn btn-primary" href="admin-claims.html"><i data-lucide="file-check-2" aria-hidden="true"></i> Review claims</a>
        </div>
      </header>

      <section class="stat-grid" aria-label="System statistics">
        ${stat('Total Users', users.length, 'users', 'blue', `${users.filter((u) => u.status === 'active').length} active`)}
        ${stat('Lost Reports', lost.length, 'search', 'red', `${lost.filter((r) => r.status === 'open').length} open`)}
        ${stat('Found Reports', found.length, 'package', 'green', `${found.filter((r) => r.status === 'available').length} available`)}
        ${stat('Active Claims', activeClaims.length, 'file-check-2', 'violet', `${pendingClaims.length} pending`)}
        ${stat('Recovered Items', recovered, 'badge-check', 'cyan', 'Cases marked returned')}
        ${stat('Pending Claims', pendingClaims.length, 'clock', 'amber', 'Awaiting decision')}
      </section>

      <div class="admin-grid mt-24">
        <div class="stack">
          <section class="card chart-card" aria-labelledby="chart-reports-title">
            <div class="card-head">
              <div><h2 id="chart-reports-title">Reports over time</h2><p>Lost vs found reports created in the last 8 weeks.</p></div>
              <span class="badge badge-blue">Live data</span>
            </div>
            <div class="card-body"><div class="chart-box"><canvas id="chart-reports-time" aria-label="Reports over time chart" role="img"></canvas></div></div>
          </section>

          <div class="chart-grid">
            <section class="card chart-card" aria-labelledby="chart-lf-title">
              <div class="card-head"><div><h2 id="chart-lf-title">Lost vs Found</h2></div></div>
              <div class="card-body"><div class="chart-box sm"><canvas id="chart-lost-found" aria-label="Lost versus found doughnut chart" role="img"></canvas></div></div>
            </section>
            <section class="card chart-card" aria-labelledby="chart-cat-title">
              <div class="card-head"><div><h2 id="chart-cat-title">Reports by category</h2></div></div>
              <div class="card-body"><div class="chart-box sm"><canvas id="chart-categories" aria-label="Reports by category bar chart" role="img"></canvas></div></div>
            </section>
          </div>
        </div>

        <div class="stack">
          <section class="card" aria-labelledby="recent-claims-title">
            <div class="card-head">
              <div><h2 id="recent-claims-title">Claims needing attention</h2></div>
              <a class="btn btn-ghost btn-sm" href="admin-claims.html">All <i data-lucide="arrow-right" aria-hidden="true"></i></a>
            </div>
            <div class="card-body">
              ${pendingClaims.length ? `<div class="recent-rows">${pendingClaims.slice(0, 5).map(claimMini).join('')}</div>`
                : '<p class="text-sm text-muted">No claims awaiting review. Nice work.</p>'}
            </div>
          </section>

          <section class="card" aria-labelledby="quick-links-title">
            <div class="card-head"><div><h2 id="quick-links-title">Administration</h2></div></div>
            <div class="card-body">
              <div class="quick-links">
                ${quickLink('admin-reports.html', 'clipboard-list', 'Manage reports', 'View, edit and archive cases')}
                ${quickLink('admin-users.html', 'users', 'Manage users', 'Deactivate or review accounts')}
                ${quickLink('admin-audit.html', 'scroll-text', 'Audit logs', 'Trace every privileged action')}
                ${quickLink('admin-analytics.html', 'bar-chart-3', 'Analytics', 'Trends, categories and hotspots')}
                <button type="button" class="quick-link" data-open-settings>
                  <i data-lucide="settings" aria-hidden="true"></i>
                  <span><b style="display:block">System settings</b><span class="text-xs text-muted">Sample data, theme, storage</span></span>
                  <span class="ql-arrow"><i data-lucide="chevron-right" aria-hidden="true"></i></span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>`;

    U().refreshIcons(root);
    const settingsBtn = root.querySelector('[data-open-settings]');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

    if (window.CF.analytics && typeof window.CF.analytics.renderAdminOverview === 'function') {
      window.CF.analytics.renderAdminOverview({ lost, found, reports });
    }
  }

  function stat(label, value, iconName, tone, sub) {
    return `<article class="stat-card">
      <div><div class="s-label">${label}</div><div class="s-value">${value}</div><div class="s-sub">${sub || ''}</div></div>
      <span class="s-ico ${tone}"><i data-lucide="${iconName}" aria-hidden="true"></i></span>
    </article>`;
  }

  function quickLink(href, iconName, title, sub) {
    return `<a class="quick-link" href="${href}">
      <i data-lucide="${iconName}" aria-hidden="true"></i>
      <span><b style="display:block">${title}</b><span class="text-xs text-muted">${sub}</span></span>
      <span class="ql-arrow"><i data-lucide="chevron-right" aria-hidden="true"></i></span>
    </a>`;
  }

  function claimMini(c) {
    const item = S().findReport(c.itemId);
    const claimant = S().findUser(c.claimantId);
    return `<div class="recent-row">
      <span class="avatar avatar-sm">${U().initials(claimant ? claimant.name : '?')}</span>
      <span class="r-body">
        <b>${U().escapeHtml(item ? item.itemName : 'Item')}</b>
        <span>${U().escapeHtml(claimant ? claimant.name : 'Unknown')} · <span class="mono">${U().escapeHtml(c.id)}</span></span>
      </span>
      ${c.matchScore ? `<span class="badge badge-blue">${c.matchScore}%</span>` : ''}
      <span class="badge ${window.CF.claims.STATUS_META[c.status].badge}">${window.CF.claims.STATUS_META[c.status].label}</span>
    </div>`;
  }

  /* ============================================================
     Report management (admin-reports.html)
     ============================================================ */
  function renderReports(root, user) {
    const state = { q: '', type: '', status: '', page: 1, tab: 'all' };

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Report management</h1>
          <p>Review, edit and archive every lost &amp; found case. Records are archived, never deleted.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" href="report-lost.html"><i data-lucide="plus" aria-hidden="true"></i> New lost</a>
          <a class="btn btn-primary" href="report-found.html"><i data-lucide="plus" aria-hidden="true"></i> New found</a>
        </div>
      </div>

      <div class="filter-bar" data-filter-form>
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search case ID, item, reporter, location..." aria-label="Search reports">
        </div>
        <select class="input" name="type" aria-label="Filter by type">
          <option value="">All types</option><option value="lost">Lost</option><option value="found">Found</option>
        </select>
        <select class="input" name="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="available">Available</option>
          <option value="in_review">In review</option>
          <option value="approved">Reserved</option>
          <option value="returned">Returned</option>
          <option value="archived">Archived</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" data-reset><i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Case ID</th><th scope="col">Item</th><th scope="col">Type</th>
              <th scope="col">Reporter</th><th scope="col">Location</th><th scope="col">Date</th>
              <th scope="col">Status</th><th scope="col" style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
        <div data-table-empty class="table-empty"></div>
      </div>
      <div data-pagination></div>`;

    const body = root.querySelector('[data-table-body]');
    const empty = root.querySelector('[data-table-empty]');
    const pagerEl = root.querySelector('[data-pagination]');
    const form = root.querySelector('[data-filter-form]');

    function rows() {
      let list = S().reports().slice();
      if (state.type) list = list.filter((r) => r.type === state.type);
      if (state.status) list = list.filter((r) => r.status === state.status);
      const q = state.q.trim().toLowerCase();
      if (q) {
        list = list.filter((r) => {
          const reporter = S().findUser(r.type === 'lost' ? r.ownerId : (r.finderId || r.ownerId));
          return [r.id, r.itemName, r.location, r.category, reporter ? reporter.name : '']
            .some((f) => String(f).toLowerCase().includes(q));
        });
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function draw() {
      const list = rows();
      const pager = U().paginate(list, state.page, 10);
      state.page = pager.page;
      if (!list.length) {
        body.innerHTML = '';
        empty.innerHTML = `<div class="empty-state" style="border:none">
          <div class="empty-ico"><i data-lucide="inbox" aria-hidden="true"></i></div>
          <h3>No reports found.</h3>
          <p>Try changing your search filters.</p>
          <button type="button" class="btn btn-secondary" data-clear-inline>Clear filters</button>
        </div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        const inline = empty.querySelector('[data-clear-inline]');
        if (inline) inline.addEventListener('click', reset);
        return;
      }
      empty.innerHTML = '';
      body.innerHTML = pager.items.map(rowHtml).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      bindRows();
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
    }

    function rowHtml(r) {
      const reporter = S().findUser(r.type === 'lost' ? r.ownerId : (r.finderId || r.ownerId));
      return `<tr>
        <td data-label="Case ID"><span class="mono">${U().escapeHtml(r.id)}</span></td>
        <td data-label="Item"><strong>${U().escapeHtml(r.itemName)}</strong><br><span class="text-xs text-muted">${U().escapeHtml(r.category)}</span></td>
        <td data-label="Type">${window.CF.items.typeBadge(r.type)}</td>
        <td data-label="Reporter">${U().escapeHtml(reporter ? reporter.name : 'Unknown')}</td>
        <td data-label="Location">${U().escapeHtml(r.location)}</td>
        <td data-label="Date">${U().formatDate(r.dateLost || r.dateFound || r.createdAt)}</td>
        <td data-label="Status">${window.CF.items.statusBadge(r)}</td>
        <td data-label="Actions">
          <div class="cell-actions">
            <a class="btn btn-soft" href="item-details.html?id=${encodeURIComponent(r.id)}">View</a>
            <button type="button" class="btn btn-secondary" data-edit="${U().escapeHtml(r.id)}">Edit</button>
            <button type="button" class="btn btn-ghost" data-archive="${U().escapeHtml(r.id)}" ${r.status === 'archived' ? 'disabled' : ''}>Archive</button>
          </div>
        </td>
      </tr>`;
    }

    function bindRows() {
      U().qsa('[data-archive]', body).forEach((btn) => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-archive');
        window.CF.ui.confirm({
          title: 'Archive this report?',
          message: `Case ${id} will be hidden from listings but preserved for auditing. Important records are never permanently deleted.`,
          confirmLabel: 'Archive',
          tone: 'warning',
          onConfirm: () => {
            S().updateReport(id, { status: 'archived' });
            S().pushAudit({
              id: U().uid('a'), ts: new Date().toISOString(), userId: user.id, userName: user.name,
              action: 'Admin archived report', caseId: id, ip: IP_PLACEHOLDER, status: 'Success',
            });
            window.CF.ui.toast('success', `Case ${id} archived.`);
            draw();
          },
        });
      }));

      U().qsa('[data-edit]', body).forEach((btn) => btn.addEventListener('click', () => {
        openReportEdit(btn.getAttribute('data-edit'), user, draw);
      }));
    }

    function reset() {
      state.q = ''; state.type = ''; state.status = ''; state.page = 1;
      U().qsa('input, select', form).forEach((el) => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
      });
      draw();
    }

    const search = form.querySelector('input[name="q"]');
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));
    form.querySelector('select[name="type"]').addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; draw(); });
    form.querySelector('select[name="status"]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; draw(); });
    form.querySelector('[data-reset]').addEventListener('click', reset);

    draw();
  }

  function openReportEdit(id, user, onDone) {
    const report = S().findReport(id);
    if (!report) return;
    const statusOptions = report.type === 'lost'
      ? ['open', 'matched', 'claimed', 'resolved', 'archived']
      : ['available', 'in_review', 'approved', 'returned', 'archived'];
    const storageOptions = ['With Finder', 'Handed to Security', 'Stored by Staff'];

    window.CF.ui.modal({
      title: 'Edit report',
      subtitle: `${report.id} · ${report.itemName}`,
      icon: 'pencil',
      tone: 'primary',
      confirmLabel: 'Save changes',
      body: `
        <div class="stack">
          <div class="field">
            <label for="re-name">Item name</label>
            <input class="input" id="re-name" value="${U().escapeHtml(report.itemName)}" maxlength="90">
            <span class="field-error"></span>
          </div>
          <div class="field">
            <label for="re-status">Status</label>
            <select class="input" id="re-status">
              ${statusOptions.map((s) => `<option value="${s}" ${report.status === s ? 'selected' : ''}>${U().titleCase(s)}</option>`).join('')}
            </select>
          </div>
          ${report.type === 'found' ? `
          <div class="field">
            <label for="re-storage">Storage status</label>
            <select class="input" id="re-storage">
              ${storageOptions.map((s) => `<option value="${U().escapeHtml(s)}" ${(report.storageStatus || '') === s ? 'selected' : ''}>${U().escapeHtml(s)}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="field">
            <label for="re-location">Location</label>
            <input class="input" id="re-location" value="${U().escapeHtml(report.location)}" maxlength="80">
            <span class="field-error"></span>
          </div>
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', () => {
          const nameEl = modalEl.querySelector('#re-name');
          const locEl = modalEl.querySelector('#re-location');
          V().clearAll(modalEl);
          const nameCheck = V().validateItemName(nameEl.value);
          const locCheck = V().validateLocation(locEl.value);
          if (!nameCheck.valid) { V().showError(nameEl, nameCheck.message); return; }
          if (!locCheck.valid) { V().showError(locEl, locCheck.message); return; }

          const patch = {
            itemName: U().sanitizeInput(nameEl.value),
            location: U().sanitizeInput(locEl.value),
            status: modalEl.querySelector('#re-status').value,
          };
          const storage = modalEl.querySelector('#re-storage');
          if (storage) patch.storageStatus = storage.value;

          S().updateReport(id, patch);
          S().pushAudit({
            id: U().uid('a'), ts: new Date().toISOString(), userId: user.id, userName: user.name,
            action: 'Admin edited report', caseId: id, ip: IP_PLACEHOLDER, status: 'Success',
          });
          close();
          window.CF.ui.toast('success', 'Report updated.');
          if (onDone) onDone();
        });
      },
    });
  }

  /* ============================================================
     Claim management (admin-claims.html)
     ============================================================ */
  function renderClaims(root, user) {
    const state = { q: '', status: '', page: 1 };

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Claim management</h1>
          <p>Verify ownership evidence. Approvals require confirmation and rejections require a reason.</p>
        </div>
      </div>

      <div class="filter-bar" data-filter-form>
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search claim ID, item, claimant..." aria-label="Search claims">
        </div>
        <select class="input" name="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${window.CF.claims.STATUSES.map((s) => `<option value="${s}">${window.CF.claims.STATUS_META[s].label}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-ghost btn-sm" data-reset><i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Claim ID</th><th scope="col">Item</th><th scope="col">Claimant</th>
              <th scope="col">Match Score</th><th scope="col">Date</th><th scope="col">Status</th>
              <th scope="col" style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
        <div data-table-empty class="table-empty"></div>
      </div>
      <div data-pagination></div>`;

    const body = root.querySelector('[data-table-body]');
    const empty = root.querySelector('[data-table-empty]');
    const pagerEl = root.querySelector('[data-pagination]');
    const form = root.querySelector('[data-filter-form]');

    function rows() {
      let list = (S().claims() || []).slice();
      if (state.status) list = list.filter((c) => c.status === state.status);
      const q = state.q.trim().toLowerCase();
      if (q) {
        list = list.filter((c) => {
          const claimant = S().findUser(c.claimantId);
          const item = S().findReport(c.itemId);
          return [c.id, item ? item.itemName : '', claimant ? claimant.name : '', c.status]
            .some((f) => String(f).toLowerCase().includes(q));
        });
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function draw() {
      const list = rows();
      const pager = U().paginate(list, state.page, 10);
      state.page = pager.page;
      if (!list.length) {
        body.innerHTML = '';
        empty.innerHTML = `<div class="empty-state" style="border:none">
          <div class="empty-ico"><i data-lucide="inbox" aria-hidden="true"></i></div>
          <h3>No claims found.</h3><p>Try changing your search filters.</p></div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        return;
      }
      empty.innerHTML = '';
      body.innerHTML = pager.items.map(rowHtml).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      bindRows();
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
    }

    function rowHtml(c) {
      const item = S().findReport(c.itemId);
      const claimant = S().findUser(c.claimantId);
      const meta = window.CF.claims.STATUS_META[c.status];
      const canAct = ['PENDING', 'UNDER_REVIEW'].indexOf(c.status) !== -1;
      return `<tr>
        <td data-label="Claim ID"><span class="mono">${U().escapeHtml(c.id)}</span></td>
        <td data-label="Item"><strong>${U().escapeHtml(item ? item.itemName : 'Item removed')}</strong><br><span class="text-xs text-muted mono">${U().escapeHtml(c.itemId)}</span></td>
        <td data-label="Claimant">${U().escapeHtml(claimant ? claimant.name : 'Unknown')}<br><span class="text-xs text-muted">${U().escapeHtml(claimant ? claimant.collegeId : '')}</span></td>
        <td data-label="Match Score">${c.matchScore ? `<span class="badge badge-blue">${c.matchScore}%</span>` : '<span class="text-muted">—</span>'}</td>
        <td data-label="Date">${U().formatDate(c.createdAt)}</td>
        <td data-label="Status"><span class="badge ${meta.badge}">${meta.label}</span>${c.infoRequested ? ' <span class="badge badge-amber">Info sent</span>' : ''}</td>
        <td data-label="Actions">
          <div class="cell-actions">
            <a class="btn btn-soft" href="claim-details.html?id=${encodeURIComponent(c.id)}">Review</a>
            <button type="button" class="btn btn-success" data-approve="${U().escapeHtml(c.id)}" ${canAct ? '' : 'disabled'}>Approve</button>
            <button type="button" class="btn btn-danger" data-reject="${U().escapeHtml(c.id)}" ${canAct ? '' : 'disabled'}>Reject</button>
            <button type="button" class="btn btn-secondary" data-info="${U().escapeHtml(c.id)}" ${canAct ? '' : 'disabled'}>More info</button>
          </div>
        </td>
      </tr>`;
    }

    function bindRows() {
      U().qsa('[data-approve]', body).forEach((btn) => btn.addEventListener('click', () => approveFlow(btn.getAttribute('data-approve'), user, draw)));
      U().qsa('[data-reject]', body).forEach((btn) => btn.addEventListener('click', () => rejectFlow(btn.getAttribute('data-reject'), user, draw)));
      U().qsa('[data-info]', body).forEach((btn) => btn.addEventListener('click', () => infoFlow(btn.getAttribute('data-info'), user, draw)));
    }

    const search = form.querySelector('input[name="q"]');
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));
    form.querySelector('select[name="status"]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; draw(); });
    form.querySelector('[data-reset]').addEventListener('click', () => {
      state.q = ''; state.status = ''; state.page = 1;
      form.querySelector('input').value = '';
      form.querySelector('select').selectedIndex = 0;
      draw();
    });

    draw();
  }

  /* Approve (confirmation required) */
  function approveFlow(claimId, user, onDone) {
    const claim = S().findClaim(claimId);
    if (!claim) return;
    const item = S().findReport(claim.itemId);
    window.CF.ui.confirm({
      title: 'Approve this claim?',
      message: `You are approving claim ${claimId} for "${item ? item.itemName : 'the item'}". The claimant will be notified and staff can then hand over the item.`,
      confirmLabel: 'Approve claim',
      tone: 'success',
      requireConfirmPhrase: false,
      onConfirm: () => {
        const result = window.CF.claims.transitionClaim(claimId, 'APPROVED', user, {
          note: 'Verification answers matched the finder report.',
        });
        if (!result.ok) { window.CF.ui.toast('error', result.message); return; }
        window.CF.ui.toast('success', `Claim ${claimId} approved.`);
        if (onDone) onDone();
      },
    });
  }

  /* Reject (reason required) */
  function rejectFlow(claimId, user, onDone) {
    window.CF.ui.modal({
      title: 'Reject claim',
      subtitle: `Claim ${claimId}`,
      icon: 'x-circle',
      tone: 'danger',
      confirmLabel: 'Reject claim',
      confirmClass: 'btn-danger',
      body: `
        <div class="stack">
          <div class="callout callout-warning">
            <i data-lucide="alert-triangle" aria-hidden="true"></i>
            <div><b>A reason is required</b><p>The claimant will see this reason. Be specific about why the evidence did not match.</p></div>
          </div>
          <div class="field">
            <label for="reject-reason">Rejection reason <span class="req">*</span></label>
            <textarea class="input" id="reject-reason" rows="4" maxlength="400" placeholder="e.g. Verification answers did not match the finder report: the colour and brand were both incorrect."></textarea>
            <span class="field-error"></span>
            <span class="hint">Minimum 10 characters.</span>
          </div>
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', () => {
          const input = modalEl.querySelector('#reject-reason');
          const value = input.value.trim();
          V().clearAll(modalEl);
          if (value.length < 10) {
            V().showError(input, 'Please provide a rejection reason of at least 10 characters.');
            input.focus();
            return;
          }
          const result = window.CF.claims.transitionClaim(claimId, 'REJECTED', user, { reason: value, note: value });
          if (!result.ok) { window.CF.ui.toast('error', result.message); return; }
          close();
          window.CF.ui.toast('success', `Claim ${claimId} rejected. The claimant was notified.`);
          if (onDone) onDone();
        });
      },
    });
  }

  function infoFlow(claimId, user, onDone) {
    window.CF.ui.modal({
      title: 'Request more information',
      subtitle: `Claim ${claimId}`,
      icon: 'message-square-more',
      tone: 'primary',
      confirmLabel: 'Send request',
      body: `
        <div class="field">
          <label for="info-msg">What information do you need? <span class="req">*</span></label>
          <textarea class="input" id="info-msg" rows="4" maxlength="400" placeholder="e.g. Please upload a photo of the unique marking you described."></textarea>
          <span class="field-error"></span>
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', () => {
          const input = modalEl.querySelector('#info-msg');
          const value = input.value.trim();
          V().clearAll(modalEl);
          if (value.length < 10) { V().showError(input, 'Please describe the request in at least 10 characters.'); return; }
          const result = window.CF.claims.requestMoreInfo(claimId, user, value);
          if (!result.ok) { window.CF.ui.toast('error', result.message); return; }
          close();
          window.CF.ui.toast('success', 'Information request sent to the claimant.');
          if (onDone) onDone();
        });
      },
    });
  }

  /* ============================================================
     User management (admin-users.html)
     ============================================================ */
  function renderUsers(root, user) {
    const state = { q: '', role: '', status: '', page: 1 };

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>User management</h1>
          <p>Accounts registered on CampusFind. Passwords are never displayed or stored in plain text.</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-green"><i data-lucide="shield-check" aria-hidden="true"></i>Passwords hidden</span>
        </div>
      </div>

      <div class="filter-bar" data-filter-form>
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search name, email, roll number..." aria-label="Search users">
        </div>
        <select class="input" name="role" aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="student">Student</option><option value="faculty">Faculty</option>
          <option value="staff">Staff</option><option value="admin">Admin</option>
        </select>
        <select class="input" name="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option><option value="inactive">Deactivated</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" data-reset><i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Name</th><th scope="col">Roll No.</th><th scope="col">Email</th>
              <th scope="col">Role</th><th scope="col">Status</th><th scope="col">Registered</th>
              <th scope="col" style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
        <div data-table-empty class="table-empty"></div>
      </div>
      <div data-pagination></div>`;

    const body = root.querySelector('[data-table-body]');
    const empty = root.querySelector('[data-table-empty]');
    const pagerEl = root.querySelector('[data-pagination]');
    const form = root.querySelector('[data-filter-form]');

    function rows() {
      let list = S().users().slice();
      if (state.role) list = list.filter((u) => u.role === state.role);
      if (state.status) list = list.filter((u) => u.status === state.status);
      const q = state.q.trim().toLowerCase();
      if (q) {
        list = list.filter((u) => [u.name, u.email, u.collegeId, u.role]
          .some((f) => String(f).toLowerCase().includes(q)));
      }
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    function draw() {
      const list = rows();
      const pager = U().paginate(list, state.page, 10);
      state.page = pager.page;
      if (!list.length) {
        body.innerHTML = '';
        empty.innerHTML = `<div class="empty-state" style="border:none">
          <div class="empty-ico"><i data-lucide="user-x" aria-hidden="true"></i></div>
          <h3>No users found.</h3><p>Try changing your search filters.</p></div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        return;
      }
      empty.innerHTML = '';
      body.innerHTML = pager.items.map(rowHtml).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      bindRows();
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
    }

    function rowHtml(u) {
      const roleBadge = { student: 'badge-blue', faculty: 'badge-violet', staff: 'badge-cyan', admin: 'badge-red' }[u.role] || 'badge-gray';
      const active = u.status === 'active';
      return `<tr>
        <td data-label="Name">
          <div class="row u-row-sm">
            <span class="avatar avatar-sm">${U().initials(u.name)}</span>
            <div><strong>${U().escapeHtml(u.name)}</strong><br><span class="text-xs text-muted">${U().escapeHtml(u.department || '')}</span></div>
          </div>
        </td>
        <td data-label="Roll No."><span class="mono">${U().escapeHtml(u.collegeId)}</span></td>
        <td data-label="Email">${U().escapeHtml(u.email)}</td>
        <td data-label="Role"><span class="badge ${roleBadge} capitalize">${U().escapeHtml(u.role)}</span></td>
        <td data-label="Status">${active
          ? '<span class="badge badge-green"><i data-lucide="check-circle-2" aria-hidden="true"></i>Active</span>'
          : '<span class="badge badge-red"><i data-lucide="ban" aria-hidden="true"></i>Deactivated</span>'}</td>
        <td data-label="Registered">${U().formatDate(u.createdAt)}</td>
        <td data-label="Actions">
          <div class="cell-actions">
            <button type="button" class="btn btn-soft" data-view="${U().escapeHtml(u.id)}">View</button>
            ${u.id === user.id ? '<span class="badge badge-gray">You</span>' : `
            <button type="button" class="btn ${active ? 'btn-danger' : 'btn-success'}" data-toggle="${U().escapeHtml(u.id)}">
              ${active ? 'Deactivate' : 'Reactivate'}
            </button>`}
          </div>
        </td>
      </tr>`;
    }

    function bindRows() {
      U().qsa('[data-view]', body).forEach((btn) => btn.addEventListener('click', () => viewUser(btn.getAttribute('data-view'))));
      U().qsa('[data-toggle]', body).forEach((btn) => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle');
        const target = S().findUser(id);
        if (!target) return;
        const deactivating = target.status === 'active';
        window.CF.ui.confirm({
          title: deactivating ? 'Deactivate this account?' : 'Reactivate this account?',
          message: deactivating
            ? `${target.name} will no longer be able to sign in. Their reports and claims are preserved.`
            : `${target.name} will be able to sign in again.`,
          confirmLabel: deactivating ? 'Deactivate' : 'Reactivate',
          tone: deactivating ? 'danger' : 'success',
          onConfirm: () => {
            S().updateUser(id, { status: deactivating ? 'inactive' : 'active' });
            S().pushAudit({
              id: U().uid('a'), ts: new Date().toISOString(), userId: user.id, userName: user.name,
              action: deactivating ? 'Admin deactivated user' : 'Admin reactivated user',
              caseId: target.collegeId, ip: IP_PLACEHOLDER, status: 'Success',
            });
            window.CF.ui.toast('success', deactivating ? 'Account deactivated.' : 'Account reactivated.');
            draw();
          },
        });
      }));
    }

    function viewUser(id) {
      const u = S().findUser(id);
      if (!u) return;
      const theirReports = S().reports().filter((r) => r.ownerId === u.id || r.finderId === u.id).length;
      const theirClaims = (S().claims() || []).filter((c) => c.claimantId === u.id).length;
      window.CF.ui.modal({
        title: u.name,
        subtitle: u.collegeId,
        icon: 'user',
        tone: 'primary',
        confirmLabel: 'Close',
        hideCancel: true,
        body: `
          <dl class="key-value">
            <div class="kv"><dt>Email</dt><dd>${U().escapeHtml(u.email)}</dd></div>
            <div class="kv"><dt>Role</dt><dd class="capitalize">${U().escapeHtml(u.role)}</dd></div>
            <div class="kv"><dt>Status</dt><dd>${u.status === 'active' ? 'Active' : 'Deactivated'}</dd></div>
            <div class="kv"><dt>Department</dt><dd>${U().escapeHtml(u.department || '—')}</dd></div>
            <div class="kv"><dt>Phone</dt><dd>${U().escapeHtml(u.phone || '—')}</dd></div>
            <div class="kv"><dt>Registered</dt><dd>${U().formatDate(u.createdAt)}</dd></div>
            <div class="kv"><dt>Last login</dt><dd>${u.lastLogin ? U().formatDateTime(u.lastLogin) : '—'}</dd></div>
            <div class="kv"><dt>Reports filed</dt><dd>${theirReports}</dd></div>
            <div class="kv"><dt>Claims submitted</dt><dd>${theirClaims}</dd></div>
          </dl>
          <div class="callout callout-info mt-16">
            <i data-lucide="lock" aria-hidden="true"></i>
            <div><b>Passwords are never displayed</b><p>Only a one-way digest is stored; the deployed build hashes server-side.</p></div>
          </div>`,
        onOpen: (modalEl, close) => {
          modalEl.querySelector('[data-modal-confirm]').addEventListener('click', close);
        },
      });
    }

    const search = form.querySelector('input[name="q"]');
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));
    form.querySelector('select[name="role"]').addEventListener('change', (e) => { state.role = e.target.value; state.page = 1; draw(); });
    form.querySelector('select[name="status"]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; draw(); });
    form.querySelector('[data-reset]').addEventListener('click', () => {
      state.q = ''; state.role = ''; state.status = ''; state.page = 1;
      form.querySelector('input').value = '';
      form.querySelectorAll('select').forEach((s) => { s.selectedIndex = 0; });
      draw();
    });

    draw();
  }

  /* ============================================================
     Audit log (admin-audit.html)
     ============================================================ */
  function renderAudit(root) {
    const state = { q: '', status: '', page: 1 };

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Audit logs</h1>
          <p>Immutable trail of privileged actions across reports, claims and accounts.</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-blue"><i data-lucide="scroll-text" aria-hidden="true"></i>${S().audit().length} events</span>
        </div>
      </div>

      <div class="filter-bar" data-filter-form>
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search user, action, case ID..." aria-label="Search audit events">
        </div>
        <select class="input" name="status" aria-label="Filter by result">
          <option value="">All results</option>
          <option value="Success">Success</option>
          <option value="Blocked">Blocked</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" data-reset><i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Timestamp</th><th scope="col">User</th><th scope="col">Action</th>
              <th scope="col">Case ID</th><th scope="col">IP</th><th scope="col">Status</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
        <div data-table-empty class="table-empty"></div>
      </div>
      <div data-pagination></div>`;

    const body = root.querySelector('[data-table-body]');
    const empty = root.querySelector('[data-table-empty]');
    const pagerEl = root.querySelector('[data-pagination]');
    const form = root.querySelector('[data-filter-form]');

    function rows() {
      let list = S().audit().slice();
      if (state.status) list = list.filter((a) => a.status === state.status);
      const q = state.q.trim().toLowerCase();
      if (q) list = list.filter((a) => [a.userName, a.action, a.caseId, a.ip]
        .some((f) => String(f).toLowerCase().includes(q)));
      return list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    }

    function draw() {
      const list = rows();
      const pager = U().paginate(list, state.page, 12);
      state.page = pager.page;
      if (!list.length) {
        body.innerHTML = '';
        empty.innerHTML = `<div class="empty-state" style="border:none">
          <div class="empty-ico"><i data-lucide="scroll-text" aria-hidden="true"></i></div>
          <h3>No audit events found.</h3><p>Try changing your search filters.</p></div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        return;
      }
      empty.innerHTML = '';
      body.innerHTML = pager.items.map((a) => `
        <tr>
          <td data-label="Timestamp">${U().formatDateTime(a.ts)}</td>
          <td data-label="User"><div class="row u-row-tight"><span class="avatar avatar-sm">${U().initials(a.userName)}</span><strong>${U().escapeHtml(a.userName)}</strong></div></td>
          <td data-label="Action">${U().escapeHtml(a.action)}</td>
          <td data-label="Case ID"><span class="mono">${U().escapeHtml(a.caseId || '—')}</span></td>
          <td data-label="IP"><span class="mono text-muted">${U().escapeHtml(a.ip || IP_PLACEHOLDER)}</span></td>
          <td data-label="Status">${a.status === 'Blocked'
            ? '<span class="badge badge-red"><i data-lucide="shield-alert" aria-hidden="true"></i>Blocked</span>'
            : '<span class="badge badge-green"><i data-lucide="check" aria-hidden="true"></i>Success</span>'}</td>
        </tr>`).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
    }

    const search = form.querySelector('input[name="q"]');
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));
    form.querySelector('select[name="status"]').addEventListener('change', (e) => { state.status = e.target.value; draw(); });
    form.querySelector('[data-reset]').addEventListener('click', () => {
      state.q = ''; state.status = ''; state.page = 1;
      form.querySelector('input').value = '';
      form.querySelector('select').selectedIndex = 0;
      draw();
    });

    draw();
  }

  /* ============================================================
     System settings modal
     ============================================================ */
  function openSettingsModal() {
    const usage = S().storageUsage();
    window.CF.ui.modal({
      title: 'System settings',
      subtitle: 'Workspace controls',
      icon: 'settings',
      tone: 'primary',
      confirmLabel: 'Done',
      hideCancel: true,
      body: `
        <div class="stack">
          <div class="kv">
            <dt>Records</dt>
            <dd>${S().users().length} users · ${S().reports().length} reports · ${S().claims().length} claims</dd>
          </div>
          <div class="kv">
            <dt>Local storage used</dt>
            <dd>${U().bytesLabel(usage)} of the typical 5MB browser quota</dd>
          </div>
          <div class="kv">
            <dt>Match threshold</dt>
            <dd>${S().getSettings().matchThreshold}% Smart Match Score</dd>
          </div>
          <div class="callout callout-warning">
            <i data-lucide="database" aria-hidden="true"></i>
            <div><b>Local storage</b>
            <p>Records are held in this browser's localStorage. Resetting clears your local changes and restores the shipped sample dataset.</p></div>
          </div>
          <div class="stack-sm">
            <button type="button" class="btn btn-secondary btn-block" data-setting-theme>
              <i data-lucide="moon" aria-hidden="true"></i> Toggle dark mode
            </button>
            <button type="button" class="btn btn-danger btn-block" data-setting-reset>
              <i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset sample data
            </button>
          </div>
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-setting-theme]').addEventListener('click', () => {
          const next = U().toggleTheme();
          window.CF.ui.toast('info', next === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.');
        });
        modalEl.querySelector('[data-setting-reset]').addEventListener('click', () => {
          close();
          window.CF.ui.confirm({
            title: 'Reset sample data?',
            message: 'All local reports, claims, notifications and profile edits will be replaced with the shipped sample dataset. Your session stays signed in.',
            confirmLabel: 'Reset sample data',
            tone: 'danger',
            onConfirm: () => {
              const sessionUser = window.CF.auth.getCurrentUser();
              S().resetSampleData();
              if (sessionUser) {
                const fresh = S().findUserByEmail(sessionUser.email);
                if (fresh) window.CF.auth.saveSession(fresh, true);
              }
              window.CF.ui.toast('success', 'Sample data restored.');
              setTimeout(() => window.location.reload(), 800);
            },
          });
        });
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', close);
      },
    });
  }

  window.CF.admin = {
    renderOverview, renderReports, renderClaims, renderUsers, renderAudit,
    openSettingsModal, approveFlow, rejectFlow, infoFlow, openReportEdit,
  };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits.admin = renderOverview;
  window.CF.pageInits['admin-reports'] = renderReports;
  window.CF.pageInits['admin-claims'] = renderClaims;
  window.CF.pageInits['admin-users'] = renderUsers;
  window.CF.pageInits['admin-audit'] = renderAudit;
})();
