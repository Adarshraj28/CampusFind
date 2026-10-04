/* ============================================================
   CampusFind — items.js
   Listings (lost/found), item detail page, claim form,
   Smart Match explanation, chain of custody, QR panel.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;
  const V = () => window.CF.validation;
  const M = () => window.CF.matching;

  const LOST_STATUS = {
    open: { label: 'Open', badge: 'badge-blue', icon: 'search' },
    matched: { label: 'Match Found', badge: 'badge-amber', icon: 'target' },
    claimed: { label: 'Claimed', badge: 'badge-violet', icon: 'file-check-2' },
    resolved: { label: 'Resolved', badge: 'badge-green', icon: 'check-circle-2' },
    archived: { label: 'Archived', badge: 'badge-gray', icon: 'archive' },
  };
  const FOUND_STATUS = {
    available: { label: 'Available', badge: 'badge-green', icon: 'package' },
    in_review: { label: 'Claim In Review', badge: 'badge-amber', icon: 'search' },
    approved: { label: 'Reserved For Pickup', badge: 'badge-blue', icon: 'package-check' },
    returned: { label: 'Item Returned', badge: 'badge-violet', icon: 'badge-check' },
    archived: { label: 'Archived', badge: 'badge-gray', icon: 'archive' },
  };

  function statusMeta(report) {
    const map = report.type === 'lost' ? LOST_STATUS : FOUND_STATUS;
    return map[report.status] || { label: U().titleCase(report.status || 'Unknown'), badge: 'badge-gray', icon: 'circle' };
  }

  function statusBadge(report) {
    const meta = statusMeta(report);
    return `<span class="badge ${meta.badge}"><i data-lucide="${meta.icon}" aria-hidden="true"></i>${meta.label}</span>`;
  }

  function typeBadge(type) {
    return type === 'lost'
      ? '<span class="badge badge-red"><i data-lucide="search" aria-hidden="true"></i>Lost</span>'
      : '<span class="badge badge-green"><i data-lucide="package-check" aria-hidden="true"></i>Found</span>';
  }

  function ownerOf(report) {
    return report.type === 'lost' ? S().findUser(report.ownerId) : S().findUser(report.finderId || report.ownerId);
  }

  function canViewPrivate(user, report) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'staff') return true;
    const ownerId = report.type === 'lost' ? report.ownerId : (report.finderId || report.ownerId);
    return ownerId === user.id;
  }

  /* ============================================================
     Listing page (lost-items.html / found-items.html)
     ============================================================ */
  function initListing(root, type, options) {
    const opts = options || {};
    const state = {
      query: U().param('q', ''), category: '', location: '', status: '', sort: 'newest',
      date: '', page: 1,
    };

    const listEl = root.querySelector('[data-item-list]');
    const filterForm = root.querySelector('[data-filter-form]');
    const countEl = root.querySelector('[data-result-count]');
    const pagerEl = root.querySelector('[data-pagination]');
    const emptyEl = root.querySelector('[data-empty-state]');

    /* Populate filter selects from the canonical option lists */
    const catSel = filterForm ? filterForm.querySelector('select[name="category"]') : null;
    if (catSel && catSel.options.length <= 1) {
      catSel.insertAdjacentHTML('beforeend', V().CATEGORIES
        .map((c) => `<option value="${U().escapeHtml(c)}">${U().escapeHtml(c)}</option>`).join(''));
    }
    const locSel = filterForm ? filterForm.querySelector('select[name="location"]') : null;
    if (locSel && locSel.options.length <= 1) {
      locSel.insertAdjacentHTML('beforeend', window.CF.reports.LOCATIONS
        .map((l) => `<option value="${U().escapeHtml(l)}">${U().escapeHtml(l)}</option>`).join(''));
    }
    const statusSel = filterForm ? filterForm.querySelector('select[name="status"]') : null;
    if (statusSel && statusSel.options.length <= 1) {
      const map = type === 'lost' ? LOST_STATUS : FOUND_STATUS;
      statusSel.insertAdjacentHTML('beforeend', Object.keys(map)
        .map((k) => `<option value="${k}">${map[k].label}</option>`).join(''));
    }
    const dateSel = filterForm ? filterForm.querySelector('select[name="date"]') : null;
    if (dateSel && dateSel.options.length <= 1) {
      dateSel.insertAdjacentHTML('beforeend',
        '<option value="1">Last 24 hours</option>' +
        '<option value="7">Last 7 days</option>' +
        '<option value="30">Last 30 days</option>' +
        '<option value="90">Last 3 months</option>');
    }

    function source() {
      const all = type === 'lost' ? S().lostReports() : S().foundReports();
      return all.filter((r) => r.status !== 'archived' || (window.CF.auth.getUserRole() === 'admin'));
    }

    function filtered() {
      let list = source();
      const q = state.query.trim().toLowerCase();
      if (q) {
        list = list.filter((r) =>
          [r.itemName, r.description, r.category, r.location, r.id, r.color, r.brand]
            .some((field) => String(field || '').toLowerCase().includes(q))
        );
      }
      if (state.category) list = list.filter((r) => r.category === state.category);
      if (state.location) list = list.filter((r) => r.location === state.location);
      if (state.status) list = list.filter((r) => r.status === state.status);
      if (state.date) {
        const days = Number(state.date);
        const cutoff = Date.now() - days * 86400000;
        list = list.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
      }

      const dir = state.sort === 'oldest' ? 1 : -1;
      list = list.slice().sort((a, b) => {
        if (state.sort === 'updated') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
      });
      return list;
    }

    function draw() {
      const list = filtered();
      const pager = U().paginate(list, state.page, U().PAGE_SIZE);
      state.page = pager.page;

      if (countEl) countEl.textContent = `${list.length} ${type} report${list.length === 1 ? '' : 's'}`;
      if (!list.length) {
        listEl.innerHTML = '';
        if (emptyEl) {
          emptyEl.style.display = '';
          emptyEl.innerHTML = `
            <div class="empty-ico"><i data-lucide="search-x" aria-hidden="true"></i></div>
            <h3>No ${type} reports found.</h3>
            <p>Try changing your search filters${type === 'found' ? ', or report an item you found to help a classmate.' : ', or post a lost report so finders can reach you.'}</p>
            <div class="row u-row" style="justify-content:center">
              <button type="button" class="btn btn-secondary" data-clear-filters>
                <i data-lucide="rotate-ccw" aria-hidden="true"></i> Clear filters
              </button>
              <a class="btn btn-primary" href="${type === 'lost' ? 'report-lost.html' : 'report-found.html'}">
                <i data-lucide="plus" aria-hidden="true"></i> Report ${type === 'lost' ? 'a lost' : 'a found'} item
              </a>
            </div>`;
        }
        if (pagerEl) pagerEl.innerHTML = '';
        U().refreshIcons(root);
        bindClear();
        return;
      }

      if (emptyEl) { emptyEl.style.display = 'none'; emptyEl.innerHTML = ''; }
      listEl.innerHTML = pager.items.map(card).join('');
      if (pagerEl) pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(listEl);
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => {
        btn.addEventListener('click', () => {
          state.page = Number(btn.getAttribute('data-page-btn'));
          draw();
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    function card(r) {
      const img = r.images && r.images[0];
      const meta = statusMeta(r);
      const note = type === 'found'
        ? `<div class="item-card-note"><i data-lucide="shield-check" aria-hidden="true"></i><span>Some identifying information has been hidden for verification.</span></div>`
        : '';
      return `<article class="item-card">
        <div class="item-thumb">
          ${img
            ? `<img src="${img}" alt="${U().escapeHtml(r.itemName)}" loading="lazy" width="400" height="260">`
            : `<span class="thumb-ico"><i data-lucide="${type === 'lost' ? 'search' : 'package'}" aria-hidden="true"></i></span>`}
          <span class="thumb-badge">${typeBadge(r.type)}</span>
          <span class="thumb-id">${U().escapeHtml(r.id)}</span>
        </div>
        <div class="item-card-body">
          <div class="row-between">
            <h3>${U().escapeHtml(r.itemName)}</h3>
            <span class="badge ${meta.badge}">${U().escapeHtml(meta.label)}</span>
          </div>
          <p class="text-sm text-muted u-mt-6">${U().escapeHtml(truncate(r.description, 92))}</p>
          <div class="item-card-meta">
            <span><i data-lucide="tag" aria-hidden="true"></i>${U().escapeHtml(r.category)}</span>
            <span><i data-lucide="map-pin" aria-hidden="true"></i>${U().escapeHtml(r.location)}</span>
            <span><i data-lucide="calendar" aria-hidden="true"></i>${U().formatDate(r.dateLost || r.dateFound || r.createdAt)}</span>
          </div>
          ${note}
          <div class="item-card-foot">
            <a class="btn btn-soft btn-sm grow" href="item-details.html?id=${encodeURIComponent(r.id)}">
              View Details <i data-lucide="arrow-right" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </article>`;
    }

    function truncate(text, n) {
      const s = String(text || '');
      return s.length > n ? `${s.slice(0, n).trim()}…` : s;
    }

    function bindClear() {
      const btn = root.querySelector('[data-clear-filters]');
      if (btn) btn.addEventListener('click', clearFilters);
    }

    function clearFilters() {
      state.query = ''; state.category = ''; state.location = ''; state.status = '';
      state.date = ''; state.sort = 'newest'; state.page = 1;
      if (filterForm) {
        const inputs = U().qsa('input, select', filterForm);
        inputs.forEach((el) => {
          if (el.type === 'search' || el.type === 'text') el.value = '';
          else if (el.tagName === 'SELECT') el.selectedIndex = 0;
        });
      }
      draw();
    }

    if (filterForm) {
      const search = filterForm.querySelector('input[type="search"], input[name="q"]');
      // A ?q= in the URL (the landing hero search) pre-fills the filter
      // box so the user can see what was searched and clear it.
      if (search && state.query) {
        search.value = state.query;
        const heading = root.querySelector('[data-filter-form]');
        if (heading) heading.classList.add('has-query');
      }
      if (search) search.addEventListener('input', U().debounce(() => { state.query = search.value; state.page = 1; draw(); }, 300));
      U().qsa('select', filterForm).forEach((sel) => {
        sel.addEventListener('change', () => { state[sel.name] = sel.value; state.page = 1; draw(); });
      });
      const clearBtn = filterForm.querySelector('[data-reset]');
      if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    }

    draw();
    return { draw, clearFilters, state };
  }

  /* ============================================================
     Item detail page
     ============================================================ */
  function initDetail(root) {
    const user = window.CF.auth.getCurrentUser();
    const params = U().getParams();
    const id = params.id || '';
    const report = id ? S().findReport(id) : null;

    if (!report) {
      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>Case not found</h1>
            <p>The case ID "${U().escapeHtml(id || '—')}" does not exist, or it was archived.</p>
          </div>
        </div>
        <div class="empty-state">
          <div class="empty-ico"><i data-lucide="file-question" aria-hidden="true"></i></div>
          <h2>Nothing to show here</h2>
          <p>Check the link, or browse the board to find the item you are after.</p>
          <div class="row u-row" style="justify-content:center">
            <a class="btn btn-secondary" href="found-items.html">Browse found items</a>
            <a class="btn btn-primary" href="dashboard.html">Return to dashboard</a>
          </div>
        </div>`;
      U().refreshIcons(root);
      return;
    }

    const owner = ownerOf(report);
    const showPrivate = canViewPrivate(user, report);
    const fromLost = params.from ? S().findReport(params.from) : null;
    const match = fromLost && report.type === 'found'
      ? M().calculateMatchScore(fromLost, report)
      : null;

    const galleryImgs = report.images || [];
    let activeImage = galleryImgs.length ? galleryImgs[0] : null;

    function heroHtml() {
      if (activeImage) {
        return `<img src="${activeImage}" alt="${U().escapeHtml(report.itemName)}" id="detail-active-img" width="800" height="520" decoding="async">`;
      }
      return `<span class="thumb-ico"><i data-lucide="${report.type === 'lost' ? 'search' : 'package'}" aria-hidden="true"></i></span>`;
    }

    root.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="index.html">Home</a><i data-lucide="chevron-right" aria-hidden="true"></i>
        <a href="${report.type === 'lost' ? 'lost-items.html' : 'found-items.html'}">${report.type === 'lost' ? 'Lost items' : 'Found items'}</a>
        <i data-lucide="chevron-right" aria-hidden="true"></i>
        <span aria-current="page">${U().escapeHtml(report.id)}</span>
      </nav>

      <div class="detail-grid">
        <div class="stack">
          <section class="card" aria-labelledby="detail-title">
            <div class="detail-hero">
              ${heroHtml()}
              <div class="hero-badges">${typeBadge(report.type)}${statusBadge(report)}</div>
            </div>
            ${galleryImgs.length > 1 ? `<div class="detail-gallery" role="tablist" aria-label="Item images">
              ${galleryImgs.map((src, i) => `
                <button type="button" role="tab" aria-selected="${i === 0}" class="${i === 0 ? 'active' : ''}" data-gallery-img="${i}" aria-label="Image ${i + 1}">
                  <img src="${src}" alt="Thumbnail ${i + 1} of ${U().escapeHtml(report.itemName)}" loading="lazy" decoding="async" width="120" height="80">
                </button>`).join('')}
            </div>` : ''}

            <div class="detail-section">
              <div class="row-between" style="align-items:flex-start">
                <div>
                  <h1 id="detail-title" style="font-size:26px">${U().escapeHtml(report.itemName)}</h1>
                  <p class="text-sm text-muted u-mt-6">
                    ${report.type === 'lost' ? 'Lost' : 'Found'} near <strong>${U().escapeHtml(report.location)}</strong>
                    · ${U().formatDate(report.dateLost || report.dateFound || report.createdAt)}
                  </p>
                </div>
                ${owner ? `<span class="storage-pill"><i data-lucide="user" aria-hidden="true"></i>${U().escapeHtml(owner.name)}</span>` : ''}
              </div>
            </div>

            <div class="detail-section">
              <h2><i data-lucide="align-left" aria-hidden="true"></i> Description</h2>
              <p class="detail-desc">${U().escapeHtml(report.description || 'No description provided.')}</p>
            </div>

            <div class="detail-section">
              <h2><i data-lucide="list" aria-hidden="true"></i> Item details</h2>
              <dl class="attr-grid">
                <div class="attr"><dt>Category</dt><dd>${U().escapeHtml(report.category)}</dd></div>
                <div class="attr"><dt>Colour</dt><dd>${U().escapeHtml(report.color || 'Not specified')}</dd></div>
                <div class="attr"><dt>Brand</dt><dd>${U().escapeHtml(report.brand || 'Not specified')}</dd></div>
                <div class="attr"><dt>Model</dt><dd>${U().escapeHtml(report.model || 'Not specified')}</dd></div>
                <div class="attr"><dt>Date ${report.type === 'lost' ? 'lost' : 'found'}</dt><dd>${U().formatDate(report.dateLost || report.dateFound)}</dd></div>
                <div class="attr"><dt>Time</dt><dd>${report.timeLost ? U().formatTime12(report.timeLost) : (report.timeFound ? U().formatTime12(report.timeFound) : 'Not specified')}</dd></div>
              </dl>
              ${report.features ? `<div class="callout callout-info mt-16"><i data-lucide="sparkles" aria-hidden="true"></i><div><b>Unique features</b><p>${U().escapeHtml(report.features)}</p></div></div>` : ''}
            </div>

            ${report.type === 'found' ? privateSection(report, showPrivate) : ''}

            ${match ? matchSection(fromLost, report, match, user) : ''}

            ${actionsHtml(report, user, match)}
          </section>

          <section class="card" aria-labelledby="custody-title">
            <div class="card-head">
              <div>
                <h2 id="custody-title">Chain of custody</h2>
                <p>Every handover is recorded with timestamp, actor, location and description.</p>
              </div>
            </div>
            <div class="card-body">${custodyHtml(report)}</div>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card card-pad" aria-labelledby="case-title">
            <h2 id="case-title" style="font-size:16px;margin-bottom:14px">Case overview</h2>
            <dl class="case-meta">
              <div class="case-meta-row"><dt>Case ID</dt><dd class="mono">${U().escapeHtml(report.id)}</dd></div>
              <div class="case-meta-row"><dt>Type</dt><dd>${report.type === 'lost' ? 'Lost report' : 'Found report'}</dd></div>
              <div class="case-meta-row"><dt>Status</dt><dd>${statusBadge(report)}</dd></div>
              <div class="case-meta-row"><dt>Location</dt><dd>${U().escapeHtml(report.location)}</dd></div>
              <div class="case-meta-row"><dt>${report.type === 'lost' ? 'Lost on' : 'Found on'}</dt><dd>${U().formatDate(report.dateLost || report.dateFound || report.createdAt)}</dd></div>
              ${report.storageStatus ? `<div class="case-meta-row"><dt>Storage</dt><dd>${U().escapeHtml(report.storageStatus)}</dd></div>` : ''}
              <div class="case-meta-row"><dt>Submitted</dt><dd>${U().formatDateTime(report.createdAt)}</dd></div>
              ${report.returnedAt ? `<div class="case-meta-row"><dt>Returned</dt><dd>${U().formatDateTime(report.returnedAt)}</dd></div>` : ''}
            </dl>
            <div class="divider"></div>
            <div class="stack-sm">
              ${lostOwnerGuidance(report, user)}
              ${detailActionButtons(report, user, match)}
            </div>
          </section>

          ${report.type === 'found' ? qrSection(report) : ''}

          <section class="card card-pad" aria-labelledby="help-title">
            <h2 id="help-title" style="font-size:15px;margin-bottom:8px">Need help?</h2>
            <p class="text-sm text-muted">Campus security desk is open 8 AM–8 PM. Bring your college ID card for any handover.</p>
            <a class="btn btn-secondary btn-sm mt-16" href="profile.html"><i data-lucide="user" aria-hidden="true"></i> Contact my profile</a>
          </section>
        </aside>
      </div>`;

    U().refreshIcons(root);
    bindDetail(root, report, user, {
      setMainImage(src, index) {
        activeImage = src;
        const img = root.querySelector('#detail-active-img');
        if (img) img.src = src;
        else {
          const hero = root.querySelector('.detail-hero');
          if (hero) hero.insertAdjacentHTML('afterbegin', `<img src="${src}" alt="${U().escapeHtml(report.itemName)}" id="detail-active-img" width="800" height="520" decoding="async">`);
        }
        U().qsa('[data-gallery-img]', root).forEach((b, i) => {
          b.classList.toggle('active', i === index);
          b.setAttribute('aria-selected', String(i === index));
        });
      },
    });
  }

  function privateSection(report, showPrivate) {
    const info = report.privateInfo || {};
    if (!showPrivate) {
      return `<div class="detail-section">
        <h2><i data-lucide="lock" aria-hidden="true"></i> Verification details</h2>
        <div class="private-lock">
          <i data-lucide="shield-alert" aria-hidden="true"></i>
          <div><b>Some identifying information has been hidden for verification.</b>
          Serial numbers, unique marks and personal contents are visible only to the finder, campus staff and administrators.</div>
        </div>
      </div>`;
    }
    const rows = [
      ['Serial number', info.serial],
      ['Unique marks', info.marks],
      ['Personal contents', info.contents],
      ['Device ID', info.deviceId],
    ].filter((r) => r[1]);
    if (!rows.length) return '';
    return `<div class="detail-section">
      <h2><i data-lucide="key-round" aria-hidden="true"></i> Private verification details</h2>
      <div class="private-lock">
        <i data-lucide="eye" aria-hidden="true"></i>
        <div>Visible only to you, campus staff and administrators. Never shown on public cards.</div>
      </div>
      <dl class="attr-grid">
        ${rows.map((r) => `<div class="attr"><dt>${U().escapeHtml(r[0])}</dt><dd>${U().escapeHtml(r[1])}</dd></div>`).join('')}
      </dl>
      ${report.storageStatus ? `<p class="text-sm text-muted mt-16"><strong>Storage status:</strong> ${U().escapeHtml(report.storageStatus)}</p>` : ''}
    </div>`;
  }

  function matchSection(lost, found, match, user) {
    return `<div class="detail-section">
      <h2><i data-lucide="target" aria-hidden="true"></i> Smart Match Score</h2>
      <div class="match-card" style="border:none">
        <div class="match-top">
          <div class="match-ring" style="--pct:${match.score}" role="img" aria-label="${match.score} percent match">${match.score}%</div>
          <div class="m-title">
            <b>${match.score}% Potential Match</b>
            <span>Comparing your report "${U().escapeHtml(lost.itemName)}" with this found item</span>
          </div>
        </div>
        <div class="match-body">
          ${breakdownHtml(match.breakdown)}
          <div class="match-reasons">
            ${match.reasons.length
              ? match.reasons.map((r) => `<span class="match-reason"><i data-lucide="check" aria-hidden="true"></i>${U().escapeHtml(r)}</span>`).join('')
              : '<span class="text-sm text-muted">No strong signals yet — review the details manually.</span>'}
          </div>
          <div class="callout callout-info mt-16">
            <i data-lucide="info" aria-hidden="true"></i>
            <div><b>How this works</b>
            <p>The Smart Match Score is a transparent rule-based calculation across category, description, colour, brand, location and date. It is not machine learning and it is not proof of ownership — staff verification is still required.</p></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function breakdownHtml(breakdown) {
    const rows = [
      ['Category', breakdown.category],
      ['Description', breakdown.description],
      ['Colour', breakdown.color],
      ['Brand', breakdown.brand],
      ['Location', breakdown.location],
      ['Date', breakdown.date],
    ];
    return `<div class="match-breakdown">${rows.map((r) => `
      <div class="mb-row">
        <span class="mb-label">${r[0]}</span>
        <span class="mb-bar" role="progressbar" aria-valuenow="${r[1]}" aria-valuemin="0" aria-valuemax="100" aria-label="${r[0]} similarity"><i style="width:${r[1]}%"></i></span>
        <span class="mb-val">${r[1]}%</span>
      </div>`).join('')}</div>`;
  }

  function actionsHtml(report, user, match) {
    if (report.type !== 'found') return '';
    if (!user) {
      return `<div class="detail-section">
        <div class="callout callout-info"><i data-lucide="log-in" aria-hidden="true"></i>
        <div><b>Sign in to claim this item</b>
        <p>Claims require a campus account so staff can verify ownership safely.</p></div></div>
        <div class="row mt-16"><a class="btn btn-primary" href="login.html?next=${encodeURIComponent(`item-details.html?id=${report.id}`)}">Sign in to claim</a></div>
      </div>`;
    }
    if (report.status === 'returned') {
      return `<div class="detail-section">
        <div class="callout callout-success"><i data-lucide="badge-check" aria-hidden="true"></i>
        <div><b>ITEM RETURNED</b><p>This item has been handed back to its owner and the case is closed.</p></div></div>
      </div>`;
    }
    if (report.status === 'archived') {
      return `<div class="detail-section"><div class="callout callout-warning"><i data-lucide="archive" aria-hidden="true"></i>
      <div><b>This case is archived</b><p>Archived cases are kept for auditing but are closed to new claims.</p></div></div></div>`;
    }
    const mine = (S().claims() || []).filter((c) => c.itemId === report.id && c.claimantId === user.id);
    if (mine.length) {
      const active = mine.find((c) => ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1);
      if (active) {
        return `<div class="detail-section">
          <div class="callout callout-info"><i data-lucide="file-check-2" aria-hidden="true"></i>
          <div><b>You already submitted a claim</b><p>Claim ${U().escapeHtml(active.id)} is currently ${U().escapeHtml(active.status.replace('_', ' ').toLowerCase())}.</p></div></div>
          <div class="row mt-16"><a class="btn btn-primary" href="claim-details.html?id=${encodeURIComponent(active.id)}">Track my claim</a></div>
        </div>`;
      }
    }
    if (user.role !== 'student' && user.id !== report.finderId && user.role !== 'admin' && user.role !== 'staff') {
      return '';
    }
    return `<div class="detail-section">
      <h2><i data-lucide="file-check-2" aria-hidden="true"></i> Think this item is yours?</h2>
      <p class="text-sm text-muted" style="margin-bottom:16px">Answer five verification questions. Staff compare your answers with the finder's report — the match score helps but never auto-approves.</p>
      <button type="button" class="btn btn-primary btn-lg" data-open-claim>
        <i data-lucide="send" aria-hidden="true"></i> Submit Claim
      </button>
    </div>`;
  }

  function detailActionButtons(report, user, match) {
    const owner = ownerOf(report);
    const isOwner = user && owner && owner.id === user.id;
    const isStaff = user && (user.role === 'admin' || user.role === 'staff');
    const buttons = [];

    if (report.type === 'found' && user && report.status !== 'returned' && report.status !== 'archived') {
      const hasClaim = (S().claims() || []).some((c) => c.itemId === report.id && c.claimantId === user.id && ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1);
      if (!hasClaim) {
        buttons.push(`<button type="button" class="btn btn-primary btn-block" data-open-claim><i data-lucide="send" aria-hidden="true"></i> Submit Claim</button>`);
      }
    }
    if (isOwner || isStaff) {
      buttons.push(`<button type="button" class="btn btn-secondary btn-block" data-edit-report><i data-lucide="pencil" aria-hidden="true"></i> Edit report</button>`);
    }
    if (isOwner || (isStaff && report.status === 'resolved')) {
      buttons.push(`<button type="button" class="btn btn-ghost btn-block" data-archive-report><i data-lucide="archive" aria-hidden="true"></i> Archive case</button>`);
    }
    if (report.type === 'lost' && user && !isOwner) {
      buttons.push(`<a class="btn btn-soft btn-block" href="found-items.html"><i data-lucide="package-search" aria-hidden="true"></i> Browse found items</a>`);
    }
    if (!buttons.length) return '';
    return buttons.join('');
  }

  /* ---------- Guidance for the person who LOST the item ----------
     Mirrors the claim next-step panel so both directions of the
     journey tell the user exactly what to do next. */
  function lostOwnerGuidance(report, user) {
    if (report.type !== 'lost' || !user) return '';

    const owner = ownerOf(report);
    if (!owner || owner.id !== user.id) return '';

    const lostClaims = (S().claims() || []).filter((c) => c.lostReportId === report.id);
    if (lostClaims.length) {
      const latest = lostClaims[0];
      const step = window.CF.claims.NEXT_STEP[latest.status];
      if (step) {
        return `<div class="callout callout-${step.tone} next-step-callout">
          <i data-lucide="${step.icon}" aria-hidden="true"></i>
          <div><b>${U().escapeHtml(step.title)}</b><p>${U().escapeHtml(step.body)}</p>
          <a class="btn btn-soft btn-sm u-mt-10" href="claim-details.html?id=${encodeURIComponent(latest.id)}">View claim ${U().escapeHtml(latest.id)}</a></div>
        </div>`;
      }
    }

    const matches = window.CF.matching.matchesForLost(report, S().foundReports(), {
      minScore: S().getSettings().matchThreshold || 70, limit: 3,
    });

    if (matches.length) {
      return `<div class="callout callout-success next-step-callout">
        <i data-lucide="sparkles" aria-hidden="true"></i>
        <div><b>We found ${matches.length} likely match${matches.length > 1 ? 'es' : ''} for you</b>
        <p>The best candidate scored ${matches[0].score}%. Open it to review the details and submit a claim — staff will confirm ownership before anything is handed over.</p>
        <a class="btn btn-primary btn-sm u-mt-10" href="item-details.html?id=${encodeURIComponent(matches[0].found.id)}">Review the ${matches[0].score}% match</a></div>
      </div>`;
    }

    return `<div class="callout callout-info next-step-callout">
      <i data-lucide="radar" aria-hidden="true"></i>
      <div><b>We are watching for this item</b>
      <p>Every time someone hands in a found item, CampusFind compares it against your report. If the Smart Match Score crosses your threshold you will be notified automatically — there is nothing else to do.</p></div>
    </div>`;
  }

  function qrSection(report) {
    return `<section class="card card-pad qr-card" aria-labelledby="qr-title">
      <h2 id="qr-title" class="u-center-col" style="font-size:15px">
        <i data-lucide="qr-code" aria-hidden="true"></i> Case QR tag
      </h2>
      <div class="qr-holder" data-qr-holder aria-label="QR code for case ${U().escapeHtml(report.id)}"></div>
      <p class="qr-caption"><b>${U().escapeHtml(report.id)}</b>Scan to open this case record. Staff can attach a printed tag to the stored item.</p>
      ${report.status === 'returned' ? '<div class="mt-16"><span class="badge badge-violet badge-lg"><i data-lucide="badge-check" aria-hidden="true"></i>ITEM RETURNED</span></div>' : ''}
    </section>`;
  }

  function custodyHtml(report) {
    const events = (report.custody || []).slice().reverse();
    if (!events.length) return '<p class="text-sm text-muted">No custody events recorded yet.</p>';
    return `<div class="timeline">${events.map((e) => `
      <div class="timeline-item${e.action === 'Report submitted' ? ' muted' : ''}">
        <div class="t-title">${U().escapeHtml(e.action)}</div>
        <div class="t-meta">
          <span><i data-lucide="clock" aria-hidden="true"></i>${U().formatDateTime(e.ts)}</span>
          <span><i data-lucide="user" aria-hidden="true"></i>${U().escapeHtml(e.actor || 'System')}</span>
          <span><i data-lucide="map-pin" aria-hidden="true"></i>${U().escapeHtml(e.location || '—')}</span>
        </div>
        ${e.description ? `<div class="t-desc">${U().escapeHtml(e.description)}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  function bindDetail(root, report, user, api) {
    U().qsa('[data-gallery-img]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = Number(btn.getAttribute('data-gallery-img'));
        api.setMainImage(report.images[index], index);
      });
    });

    // QR
    const qrHolder = root.querySelector('[data-qr-holder]');
    if (qrHolder) window.CF.qr.renderQR(qrHolder, report.id, { size: 148 });

    // Claim modal
    U().qsa('[data-open-claim]', root).forEach((btn) => {
      btn.addEventListener('click', () => openClaimModal(report, user, root));
    });

    // Archive
    const archiveBtn = root.querySelector('[data-archive-report]');
    if (archiveBtn) archiveBtn.addEventListener('click', () => {
      window.CF.ui.confirm({
        title: 'Archive this case?',
        message: `Case ${report.id} will be hidden from listings but kept for auditing. This does not delete the record.`,
        confirmLabel: 'Archive case',
        tone: 'warning',
        onConfirm: () => {
          S().updateReport(report.id, { status: 'archived' });
          S().pushAudit({
            id: U().uid('a'), ts: new Date().toISOString(),
            userId: user.id, userName: user.name,
            action: user.role === 'admin' ? 'Admin archived report' : 'Owner archived report',
            caseId: report.id, ip: '10.24.0.1', status: 'Success',
          });
          window.CF.ui.toast('success', 'Case archived.');
          setTimeout(() => window.location.reload(), 700);
        },
      });
    });

    // Edit (lightweight: opens a modal with name + description)
    const editBtn = root.querySelector('[data-edit-report]');
    if (editBtn) editBtn.addEventListener('click', () => openEditModal(report, user, root));
  }

  function openEditModal(report, user, root) {
    window.CF.ui.modal({
      title: 'Edit report',
      subtitle: `Case ${report.id}`,
      icon: 'pencil',
      tone: 'primary',
      body: `
        <div class="stack">
          <div class="field">
            <label for="edit-name">Item name</label>
            <input class="input" id="edit-name" name="itemName" value="${U().escapeHtml(report.itemName)}" maxlength="90" required>
            <span class="field-error"></span>
          </div>
          <div class="field">
            <label for="edit-desc">Description</label>
            <textarea class="input" id="edit-desc" name="description" rows="4" maxlength="500" required>${U().escapeHtml(report.description)}</textarea>
            <span class="hint"><span data-char-count>${(report.description || '').length}</span>/500 characters</span>
            <span class="field-error"></span>
          </div>
          <div class="field">
            <label for="edit-loc">Location</label>
            <input class="input" id="edit-loc" name="location" value="${U().escapeHtml(report.location)}" maxlength="80" required>
            <span class="field-error"></span>
          </div>
        </div>`,
      confirmLabel: 'Save changes',
      onOpen: (modalEl, close) => {
        const desc = modalEl.querySelector('#edit-desc');
        const counter = modalEl.querySelector('[data-char-count]');
        desc.addEventListener('input', () => { counter.textContent = String(desc.value.length); });
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', () => {
          const nameEl = modalEl.querySelector('#edit-name');
          const locEl = modalEl.querySelector('#edit-loc');
          const checks = {
            itemName: V().validateItemName(nameEl.value),
            description: V().validateDescription(desc.value),
            location: V().validateLocation(locEl.value),
          };
          V().clearAll(modalEl);
          const keys = Object.keys(checks).filter((k) => !checks[k].valid);
          if (keys.length) {
            keys.forEach((k) => {
              const map = { itemName: nameEl, description: desc, location: locEl };
              V().showError(map[k], checks[k].message);
            });
            return;
          }
          S().updateReport(report.id, {
            itemName: U().sanitizeInput(nameEl.value),
            description: U().sanitizeInput(desc.value),
            location: U().sanitizeInput(locEl.value),
          });
          close();
          window.CF.ui.toast('success', 'Report updated.');
          setTimeout(() => window.location.reload(), 600);
        });
      },
    });
  }

  /* ---------- Claim modal ---------- */
  function openClaimModal(report, user, root) {
    const lostMine = S().lostReports().filter((l) => l.ownerId === user.id && l.status !== 'archived');
    const Q = window.CF.claims.CLAIM_QUESTIONS;

    window.CF.ui.modal({
      title: 'Submit a claim',
      subtitle: `Case ${report.id} · ${report.itemName}`,
      icon: 'file-check-2',
      tone: 'primary',
      wide: true,
      confirmLabel: 'Submit claim',
      body: `
        <div class="stack">
          <div class="callout callout-info">
            <i data-lucide="info" aria-hidden="true"></i>
            <div><b>Answer from memory — do not peek</b>
            <p>Staff compare your answers with the finder's report. Your answers stay private and are never shown on public pages.</p></div>
          </div>
          ${lostMine.length ? `
          <div class="field">
            <label for="claim-lost">Link to one of your lost reports <span class="hint">(optional)</span></label>
            <select class="input" id="claim-lost" name="lostReportId">
              <option value="">Not linked</option>
              ${lostMine.map((l) => `<option value="${U().escapeHtml(l.id)}">${U().escapeHtml(l.id)} — ${U().escapeHtml(l.itemName)}</option>`).join('')}
            </select>
          </div>` : ''}
          ${Q.map((q) => `
            <div class="field">
              <label for="claim-${q.key}">${U().escapeHtml(q.label)} <span class="req">*</span></label>
              <textarea class="input" id="claim-${q.key}" name="${q.key}" rows="2" maxlength="300" placeholder="${U().escapeHtml(q.placeholder)}" required></textarea>
              <span class="field-error"></span>
            </div>`).join('')}
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', async (event) => {
          const btn = event.currentTarget;
          if (btn.disabled) return;
          const answers = {};
          Q.forEach((q) => { answers[q.key] = modalEl.querySelector(`#claim-${q.key}`).value; });
          const lostSelect = modalEl.querySelector('#claim-lost');
          const matchScore = lostSelect && lostSelect.value
            ? window.CF.matching.calculateMatchScore(S().findReport(lostSelect.value), report).score
            : null;

          V().clearAll(modalEl);
          const check = V().validateClaim(answers);
          if (!check.valid) {
            const summary = modalEl.querySelector('.form-error-summary');
            if (summary) { summary.querySelector('span').textContent = check.message; summary.classList.add('show'); }
            window.CF.ui.toast('warning', check.message);
            return;
          }

          btn.disabled = true;
          btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processing...';
          await U().sleep(550);
          const result = window.CF.claims.submitClaim({
            itemId: report.id,
            lostReportId: lostSelect ? lostSelect.value : '',
            answers,
            matchScore,
          });
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="send" aria-hidden="true"></i> Submit claim';
          U().refreshIcons(btn);

          if (!result.ok) {
            window.CF.ui.toast('error', result.message);
            return;
          }
          close();
          window.CF.ui.toast('success', 'Claim submitted successfully. Status: Pending.');
          setTimeout(() => { window.location.href = `claim-details.html?id=${encodeURIComponent(result.claim.id)}`; }, 800);
        });
      },
    });
  }

  /* ============================================================
     My reports page (my-reports.html)
     ============================================================ */
  function initMyReports(root, user) {
    const state = { tab: 'all', page: 1, q: '' };

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>My reports</h1>
          <p>Everything you have reported — track status, edit details or archive closed cases.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" href="report-found.html"><i data-lucide="package-plus" aria-hidden="true"></i> Found item</a>
          <a class="btn btn-primary" href="report-lost.html"><i data-lucide="plus" aria-hidden="true"></i> Lost item</a>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Report filter">
        <button type="button" class="tab-btn active" role="tab" aria-selected="true" data-tab="all">All <span class="tab-count" data-count="all">0</span></button>
        <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="lost">Lost <span class="tab-count" data-count="lost">0</span></button>
        <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="found">Found <span class="tab-count" data-count="found">0</span></button>
        <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="closed">Closed <span class="tab-count" data-count="closed">0</span></button>
      </div>

      <div class="filter-bar">
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search your reports..." aria-label="Search your reports">
        </div>
      </div>

      <h2 class="visually-hidden">Your reports</h2>
      <div class="item-grid" data-my-list></div>
      <div data-my-empty></div>
      <div data-pagination></div>`;

    const listEl = root.querySelector('[data-my-list]');
    const emptyEl = root.querySelector('[data-my-empty]');
    const pagerEl = root.querySelector('[data-pagination]');
    const search = root.querySelector('input[name="q"]');

    function mine() {
      return S().reports().filter((r) => r.ownerId === user.id || r.finderId === user.id);
    }

    function counts(all) {
      return {
        all: all.length,
        lost: all.filter((r) => r.type === 'lost').length,
        found: all.filter((r) => r.type === 'found').length,
        closed: all.filter((r) => ['returned', 'resolved', 'archived'].indexOf(r.status) !== -1).length,
      };
    }

    function filtered() {
      let list = mine();
      if (state.tab === 'lost') list = list.filter((r) => r.type === 'lost');
      if (state.tab === 'found') list = list.filter((r) => r.type === 'found');
      if (state.tab === 'closed') list = list.filter((r) => ['returned', 'resolved', 'archived'].indexOf(r.status) !== -1);
      const q = state.q.trim().toLowerCase();
      if (q) list = list.filter((r) => [r.id, r.itemName, r.location, r.category]
        .some((f) => String(f || '').toLowerCase().includes(q)));
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function draw() {
      const all = mine();
      const c = counts(all);
      Object.keys(c).forEach((key) => {
        const holder = root.querySelector(`[data-count="${key}"]`);
        if (holder) holder.textContent = String(c[key]);
      });
      U().qsa('[data-tab]', root).forEach((btn) => {
        const active = btn.getAttribute('data-tab') === state.tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
      });

      const list = filtered();
      const pager = U().paginate(list, state.page, 6);
      state.page = pager.page;

      if (!list.length) {
        listEl.innerHTML = '';
        emptyEl.innerHTML = `<div class="empty-state">
          <div class="empty-ico"><i data-lucide="clipboard-list" aria-hidden="true"></i></div>
          <h3>No reports found.</h3>
          <p>${state.q || state.tab !== 'all' ? 'Try changing your search or tab filter.' : 'You have not reported anything yet. Start by telling campus what you lost.'}</p>
          <div class="row u-row" style="justify-content:center">
            <button type="button" class="btn btn-secondary" data-clear>Clear filters</button>
            <a class="btn btn-primary" href="report-lost.html">Report lost item</a>
          </div>
        </div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        const clear = emptyEl.querySelector('[data-clear]');
        if (clear) clear.addEventListener('click', () => {
          state.q = ''; state.tab = 'all'; state.page = 1; search.value = ''; draw();
        });
        return;
      }

      emptyEl.innerHTML = '';
      listEl.innerHTML = pager.items.map(card).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
      bindCards();
    }

    function card(r) {
      const img = r.images && r.images[0];
      const meta = statusMeta(r);
      const claimsOnIt = (S().claims() || []).filter((cl) => cl.itemId === r.id && ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(cl.status) !== -1);
      return `<article class="item-card">
        <div class="item-thumb">
          ${img
            ? `<img src="${img}" alt="${U().escapeHtml(r.itemName)}" loading="lazy" decoding="async" width="400" height="260">`
            : `<span class="thumb-ico"><i data-lucide="${r.type === 'lost' ? 'search' : 'package'}" aria-hidden="true"></i></span>`}
          <span class="thumb-badge">${typeBadge(r.type)}</span>
          <span class="thumb-id">${U().escapeHtml(r.id)}</span>
        </div>
        <div class="item-card-body">
          <div class="row-between">
            <h3>${U().escapeHtml(r.itemName)}</h3>
            <span class="badge ${meta.badge}">${meta.label}</span>
          </div>
          <div class="item-card-meta">
            <span><i data-lucide="map-pin" aria-hidden="true"></i>${U().escapeHtml(r.location)}</span>
            <span><i data-lucide="calendar" aria-hidden="true"></i>${U().formatDate(r.dateLost || r.dateFound || r.createdAt)}</span>
            <span><i data-lucide="image" aria-hidden="true"></i>${(r.images || []).length} img</span>
          </div>
          ${claimsOnIt.length
            ? `<div class="item-card-note" style="background:var(--primary-soft);color:var(--primary)"><i data-lucide="file-check-2" aria-hidden="true"></i><span>${U().plural(claimsOnIt.length, 'active claim')} on this item</span></div>`
            : ''}
          <div class="item-card-foot">
            <a class="btn btn-soft btn-sm grow" href="item-details.html?id=${encodeURIComponent(r.id)}">View</a>
            ${['returned', 'resolved', 'archived'].indexOf(r.status) === -1
              ? `<button type="button" class="btn btn-ghost btn-sm" data-archive-my="${U().escapeHtml(r.id)}">Archive</button>`
              : ''}
          </div>
        </div>
      </article>`;
    }

    function bindCards() {
      U().qsa('[data-archive-my]', listEl).forEach((btn) => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-archive-my');
        window.CF.ui.confirm({
          title: 'Archive this report?',
          message: `Case ${id} will stop appearing in public listings. The record is kept for auditing.`,
          confirmLabel: 'Archive',
          tone: 'warning',
          onConfirm: () => {
            S().updateReport(id, { status: 'archived' });
            window.CF.ui.toast('success', 'Report archived.');
            draw();
          },
        });
      }));
    }

    U().qsa('[data-tab]', root).forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-tab');
      state.page = 1;
      draw();
    }));
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));

    draw();
  }

  window.CF.items = {
    LOST_STATUS, FOUND_STATUS, statusMeta, statusBadge, typeBadge, lostOwnerGuidance,
    initListing, initDetail, initMyReports, canViewPrivate, ownerOf, openClaimModal,
    breakdownHtml, custodyHtml,
  };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits['lost-items'] = (root) => initListing(root, 'lost');
  window.CF.pageInits['found-items'] = (root) => initListing(root, 'found');
  window.CF.pageInits['item-details'] = initDetail;
  window.CF.pageInits['my-reports'] = initMyReports;
})();
