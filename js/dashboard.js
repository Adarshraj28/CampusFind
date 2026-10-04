/* ============================================================
   CampusFind — dashboard.js
   Student/staff/admin home dashboard: stats, quick actions,
   Smart Match suggestions and recent activity.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;
  const M = () => window.CF.matching;

  function render(root, user) {
    const lost = S().lostReports().filter((r) => r.ownerId === user.id);
    const found = S().foundReports().filter((r) => (r.finderId || r.ownerId) === user.id);
    const myClaims = (S().claims() || []).filter((c) => c.claimantId === user.id);
    const activeClaims = myClaims.filter((c) => ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1);

    const matches = activeMatches(user, lost);
    const activity = recentActivity(user, lost, found, myClaims);

    root.innerHTML = `
      <header class="greeting">
        <div>
          <h1>${U().greeting()}, ${U().escapeHtml(firstName(user.name))}</h1>
          <p>Here's what's happening with your reports, matches and claims today.</p>
        </div>
        <div class="g-date"><i data-lucide="calendar-days" aria-hidden="true"></i>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </header>

      <section class="stat-grid" aria-label="Your statistics">
        ${statCard('Lost Reports', lost.length, 'search', 'red', lostFilterSub(lost))}
        ${statCard('Found Reports', found.length, 'package', 'green', foundSub(found))}
        ${statCard('Potential Matches', matches.length, 'target', 'blue', 'Smart Match Score ≥ 70%')}
        ${statCard('Active Claims', activeClaims.length, 'file-check-2', 'violet', claimsSub(myClaims))}
        ${statCard('Recovery Rate', recoveredPct(found, myClaims), 'badge-check', 'emerald', 'Items returned')}
      </section>

      <section class="dash-section mt-24" aria-labelledby="quick-actions-title">
        <div class="dash-section-head"><h2 id="quick-actions-title"><i data-lucide="zap" aria-hidden="true"></i> Quick actions</h2></div>
        <div class="quick-actions">
          <a class="quick-action" href="report-lost.html">
            <span class="qa-ico"><i data-lucide="search" aria-hidden="true"></i></span>
            <span class="qa-body"><b>Report Lost Item</b><span>Tell campus what you lost</span></span>
            <span class="qa-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>
          </a>
          <a class="quick-action" href="report-found.html">
            <span class="qa-ico"><i data-lucide="package-plus" aria-hidden="true"></i></span>
            <span class="qa-body"><b>Report Found Item</b><span>Return something to its owner</span></span>
            <span class="qa-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>
          </a>
          <a class="quick-action" href="found-items.html">
            <span class="qa-ico"><i data-lucide="package-search" aria-hidden="true"></i></span>
            <span class="qa-body"><b>Browse Found Items</b><span>Check the campus board</span></span>
            <span class="qa-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>
          </a>
          <a class="quick-action" href="claims.html">
            <span class="qa-ico"><i data-lucide="file-check-2" aria-hidden="true"></i></span>
            <span class="qa-body"><b>View Claims</b><span>Track your claim status</span></span>
            <span class="qa-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>
          </a>
          <a class="quick-action" href="notifications.html">
            <span class="qa-ico"><i data-lucide="bell" aria-hidden="true"></i></span>
            <span class="qa-body"><b>Notifications</b><span>See what's new</span></span>
            <span class="qa-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>
          </a>
        </div>
      </section>

      <div class="dash-grid mt-24">
        <div class="dash-col">
          <section class="card" aria-labelledby="matches-title">
            <div class="card-head">
              <div>
                <h2 id="matches-title">Potential Matches</h2>
                <p>Smart Match Score comparing your lost reports with campus found items.</p>
              </div>
              <a class="btn btn-ghost btn-sm" href="lost-items.html">View all <i data-lucide="arrow-right" aria-hidden="true"></i></a>
            </div>
            <div class="card-body" data-matches>
              ${matches.length ? matches.slice(0, 4).map(matchCard).join('') : emptyMatches()}
            </div>
          </section>

          <section class="card" aria-labelledby="claims-title">
            <div class="card-head">
              <div>
                <h2 id="claims-title">Your active claims</h2>
                <p>Track verification and pickup status.</p>
              </div>
              <a class="btn btn-ghost btn-sm" href="claims.html">All claims <i data-lucide="arrow-right" aria-hidden="true"></i></a>
            </div>
            <div class="card-body">
              ${activeClaims.length
                ? `<div class="stack-sm">${activeClaims.map(claimRow).join('')}</div>`
                : `<div class="empty-state" style="padding:30px 20px">
                    <div class="empty-ico" style="width:52px;height:52px"><i data-lucide="file-check-2" aria-hidden="true"></i></div>
                    <h3 style="font-size:15px">No active claims</h3>
                    <p style="font-size:13.5px">When you claim a found item it will appear here with its timeline.</p>
                    <a class="btn btn-secondary btn-sm" href="found-items.html">Browse found items</a>
                  </div>`}
            </div>
          </section>

          <section class="card" aria-labelledby="recent-title">
            <div class="card-head">
              <div>
                <h2 id="recent-title">Recent reports</h2>
                <p>Your most recent lost and found activity.</p>
              </div>
            </div>
            <div class="card-body">
              ${recentReports(user, lost, found).length
                ? `<div class="recent-grid">${recentReports(user, lost, found).map(recentRow).join('')}</div>`
                : `<p class="text-sm text-muted">No recent reports yet.</p>`}
            </div>
          </section>
        </div>

        <div class="dash-col">
          <section class="card" aria-labelledby="activity-title">
            <div class="card-head">
              <div>
                <h2 id="activity-title">Recent Activity</h2>
                <p>Latest events on your cases.</p>
              </div>
            </div>
            <div class="card-body">
              ${activity.length ? `<div class="activity-feed">${activity.map(activityRow).join('')}</div>`
                : `<p class="text-sm text-muted">No activity yet. Submit a report to get started.</p>`}
            </div>
          </section>

          <section class="card card-pad" aria-labelledby="tip-title">
            <div class="row u-row-start">
              <span class="s-ico amber" style="border-radius:12px"><i data-lucide="lightbulb" aria-hidden="true"></i></span>
              <div>
                <h2 id="tip-title" style="font-size:15px">Recovery tip</h2>
                <p class="text-sm text-muted" style="margin-top:4px">Reports with a photo and 3+ specific details recover <strong>2.4×</strong> faster. Add unique marks like scratches, stickers or engravings.</p>
              </div>
            </div>
            <a class="btn btn-soft btn-sm btn-block mt-16" href="my-reports.html"><i data-lucide="pencil" aria-hidden="true"></i> Improve my reports</a>
          </section>
        </div>
      </div>`;

    U().refreshIcons(root);

    U().qsa('[data-page-btn]', root).forEach(() => {});
    U().qsa('[data-review-match]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const lostId = btn.getAttribute('data-lost-id');
        const foundId = btn.getAttribute('data-found-id');
        window.location.href = `item-details.html?id=${encodeURIComponent(foundId)}&from=${encodeURIComponent(lostId)}`;
      });
    });
  }

  function firstName(name) {
    return String(name || '').split(' ')[0] || 'there';
  }

  function recoveredPct(found, claims) {
    const returned = claims.filter((c) => c.status === 'ITEM_RETURNED').length;
    const total = claims.length || 1;
    return Math.round((returned / total) * 100);
  }

  function statCard(label, value, iconName, tone, sub) {
    return `<article class="stat-card">
      <div>
        <div class="s-label">${label}</div>
        <div class="s-value">${value}</div>
        <div class="s-sub">${sub || ''}</div>
      </div>
      <span class="s-ico ${tone}"><i data-lucide="${iconName}" aria-hidden="true"></i></span>
    </article>`;
  }

  function lostFilterSub(lost) {
    const open = lost.filter((r) => r.status === 'open').length;
    return `${open} still open`;
  }
  function foundSub(found) {
    const pending = found.filter((r) => r.status !== 'returned' && r.status !== 'archived').length;
    return `${pending} awaiting recovery`;
  }
  function claimsSub(claims) {
    const pending = claims.filter((c) => c.status === 'PENDING').length;
    return pending ? `${pending} awaiting review` : 'All up to date';
  }

  function activeMatches(user, lost) {
    const threshold = S().getSettings().matchThreshold || 70;
    const found = S().foundReports().filter((f) => f.status !== 'archived' && f.status !== 'returned' && f.finderId !== user.id);
    const lostActive = lost.filter((l) => l.status !== 'archived' && l.status !== 'resolved');
    return M().findPotentialMatches(lostActive, found, { minScore: threshold, limit: 8 });
  }

  function matchCard(m) {
    const thumb = m.found.images && m.found.images[0];
    return `<article class="match-card u-mb-14">
      <div class="match-top">
        <div class="match-ring" style="--pct:${m.score}" role="img" aria-label="${m.score} percent match">${m.score}%</div>
        <div class="m-title">
          <b>${U().escapeHtml(m.found.itemName)}</b>
          <span>${m.score}% potential match with your "${U().escapeHtml(m.lost.itemName)}"</span>
        </div>
        ${thumb ? `<img class="match-thumb" src="${thumb}" alt="" width="52" height="52" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="match-body">
        <div class="item-card-meta is-flush">
          <span><i data-lucide="map-pin" aria-hidden="true"></i>${U().escapeHtml(m.found.location)}</span>
          <span><i data-lucide="calendar" aria-hidden="true"></i>${U().formatDate(m.found.dateFound || m.found.createdAt)}</span>
          <span><i data-lucide="tag" aria-hidden="true"></i>${U().escapeHtml(m.found.category)}</span>
        </div>
        <div class="match-reasons">
          ${(m.reasons || []).slice(0, 3).map((r) => `<span class="match-reason"><i data-lucide="check" aria-hidden="true"></i>${U().escapeHtml(r)}</span>`).join('')}
        </div>
        <div class="row mt-16">
          <button type="button" class="btn btn-primary btn-sm" data-review-match data-lost-id="${U().escapeHtml(m.lost.id)}" data-found-id="${U().escapeHtml(m.found.id)}">
            Review Match <i data-lucide="arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </article>`;
  }

  function emptyMatches() {
    return `<div class="empty-state" style="padding:34px 20px;border:none">
      <div class="empty-ico" style="width:54px;height:54px"><i data-lucide="target" aria-hidden="true"></i></div>
      <h3 style="font-size:15.5px">No potential matches right now</h3>
      <p style="font-size:13.5px">We compare every new found item with your lost reports automatically. Make sure your reports include colour, brand and location for better scores.</p>
      <a class="btn btn-secondary btn-sm" href="report-lost.html">Report a lost item</a>
    </div>`;
  }

  function claimRow(c) {
    const item = S().findReport(c.itemId);
    const meta = window.CF.claims.STATUS_META[c.status] || { label: c.status, badge: 'badge-gray', icon: 'circle' };
    return `<a class="mini-match" href="claim-details.html?id=${encodeURIComponent(c.id)}" style="text-decoration:none;color:inherit">
      <span class="mm-thumb"><i data-lucide="file-check-2" aria-hidden="true"></i></span>
      <span class="mm-body">
        <b>${U().escapeHtml(item ? item.itemName : 'Item')}</b>
        <span><span class="mono">${U().escapeHtml(c.id)}</span> <span>${U().relativeTime(c.createdAt)}</span></span>
      </span>
      <span class="badge ${meta.badge}">${meta.label}</span>
    </a>`;
  }

  function recentReports(user, lost, found) {
    const seen = new Set();
    const list = [];

    const add = (r, tone) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      list.push({ id: r.id, itemName: r.itemName, location: r.location, tone });
    };

    [...lost, ...found].forEach((r) => {
      const status = r.status || 'open';
      if (status === 'archived' || status === 'returned') return;
      add(r, r.type === 'lost' ? 'red' : 'green');
    });

    return list.slice(0, 6);
  }

  function recentRow(r) {
    const isLost = r.tone === 'red';
    return `<article class="recent-row">
      <span class="avatar avatar-sm" style="background:${isLost ? 'var(--ul-rose-soft)' : 'var(--ul-emerald-soft)'}; color:${isLost ? 'var(--ul-rose)' : 'var(--ul-emerald)'}">
        <i data-lucide="${isLost ? 'search' : 'package' }" aria-hidden="true" style="width:16px;height:16px"></i>
      </span>
      <span class="r-body">
        <b>${U().escapeHtml(r.itemName)}</b>
        <span>${U().escapeHtml(r.location)}</span>
      </span>
      <span class="badge ${isLost ? 'badge-red' : 'badge-green'}">${isLost ? 'Lost' : 'Found'}</span>
    </article>`;
  }

  function recentActivity(user, lost, found, claims) {
    const events = [];
    lost.forEach((r) => events.push({
      ts: r.createdAt, icon: 'search', tone: 'danger',
      title: 'Report submitted',
      desc: `Lost report ${r.id} for ${r.itemName}`,
      href: `item-details.html?id=${encodeURIComponent(r.id)}`,
    }));
    found.forEach((r) => events.push({
      ts: r.createdAt, icon: 'package-plus', tone: 'success',
      title: 'Found item published',
      desc: `${r.itemName} at ${r.location}`,
      href: `item-details.html?id=${encodeURIComponent(r.id)}`,
    }));
    claims.forEach((c) => {
      const item = S().findReport(c.itemId);
      const map = {
        PENDING: ['Claim submitted', 'primary'],
        UNDER_REVIEW: ['Claim under review', 'warning'],
        APPROVED: ['Claim approved', 'success'],
        REJECTED: ['Claim rejected', 'danger'],
        ITEM_RETURNED: ['Item returned', 'success'],
        CANCELLED: ['Claim cancelled', ''],
      };
      const entry = map[c.status] || ['Claim updated', ''];
      events.push({
        ts: c.updatedAt || c.createdAt, icon: 'file-check-2', tone: entry[1],
        title: entry[0],
        desc: `${c.id}${item ? ` · ${item.itemName}` : ''}`,
        href: `claim-details.html?id=${encodeURIComponent(c.id)}`,
      });
    });

    (S().notifications() || []).filter((n) => n.userId === user.id).forEach((n) => {
      events.push({ ts: n.createdAt, icon: 'bell', tone: 'primary', title: n.title, desc: n.message, href: n.link || 'notifications.html' });
    });

    events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return events.slice(0, 7);
  }

  function activityRow(e) {
    return `<a class="activity-item" href="${U().escapeHtml(e.href)}" style="text-decoration:none;color:inherit">
      <span class="a-ico ${e.tone || ''}"><i data-lucide="${e.icon}" aria-hidden="true"></i></span>
      <span class="a-body">
        <b>${U().escapeHtml(e.title)}</b>
        <p class="truncate">${U().escapeHtml(e.desc)}</p>
      </span>
      <span class="a-time">${U().relativeTime(e.ts)}</span>
    </a>`;
  }

  /* ============================================================
     Profile page (profile.html)
     ============================================================ */
  function renderProfile(root, user) {
    const fresh = S().findUser(user.id) || user;
    const reports = S().reports().filter((r) => r.ownerId === fresh.id || r.finderId === fresh.id);
    const claims = (S().claims() || []).filter((c) => c.claimantId === fresh.id);
    const returned = claims.filter((c) => c.status === 'ITEM_RETURNED').length;

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Profile</h1>
          <p>Manage your personal details, password and active session.</p>
        </div>
      </div>

      <div class="profile-grid">
        <section class="card profile-card" aria-label="Account summary">
          <span class="avatar avatar-lg">${U().initials(fresh.name)}</span>
          <h2>${U().escapeHtml(fresh.name)}</h2>
          <p class="p-mail">${U().escapeHtml(fresh.email)}</p>
          <div class="p-badges">
            <span class="badge badge-blue capitalize"><i data-lucide="badge" aria-hidden="true"></i>${U().escapeHtml(fresh.role)}</span>
            <span class="badge ${fresh.status === 'active' ? 'badge-green' : 'badge-red'}"><i data-lucide="${fresh.status === 'active' ? 'check-circle-2' : 'ban'}" aria-hidden="true"></i>${fresh.status === 'active' ? 'Active' : 'Deactivated'}</span>
          </div>
          <div class="profile-stats">
            <div><b>${reports.length}</b><span>Reports</span></div>
            <div><b>${claims.length}</b><span>Claims</span></div>
            <div><b>${returned}</b><span>Recovered</span></div>
          </div>
          <dl class="key-value mt-24" style="text-align:left">
            <div class="kv"><dt>Roll Number</dt><dd class="mono">${U().escapeHtml(fresh.collegeId)}</dd></div>
            <div class="kv"><dt>Department</dt><dd>${U().escapeHtml(fresh.department || '—')}</dd></div>
            <div class="kv"><dt>Member since</dt><dd>${U().formatDate(fresh.createdAt)}</dd></div>
            <div class="kv"><dt>Last login</dt><dd>${fresh.lastLogin ? U().formatDateTime(fresh.lastLogin) : '—'}</dd></div>
          </dl>
        </section>

        <div class="stack">
          <section class="card" aria-labelledby="details-title">
            <div class="card-head"><div><h2 id="details-title">Personal details</h2><p>Update the information campus staff see on your claims.</p></div></div>
            <div class="card-body">
              <form data-profile-form novalidate>
                <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
                <div class="form-grid">
                  <div class="field">
                    <label for="pf-name">Full name</label>
                    <input class="input" id="pf-name" name="name" value="${U().escapeHtml(fresh.name)}" maxlength="80">
                    <span class="field-error"></span>
                  </div>
                  <div class="field">
                    <label for="pf-email">College email</label>
                    <input class="input" id="pf-email" value="${U().escapeHtml(fresh.email)}" disabled>
                    <span class="hint">Email changes require administration approval.</span>
                  </div>
                  <div class="field">
                    <label for="pf-id">Roll Number</label>
                    <input class="input" id="pf-id" value="${U().escapeHtml(fresh.collegeId)}" disabled>
                  </div>
                  <div class="field">
                    <label for="pf-phone">Phone number</label>
                    <input class="input" id="pf-phone" name="phone" value="${U().escapeHtml(fresh.phone || '')}" placeholder="+91 98000 00000" maxlength="20">
                    <span class="field-error"></span>
                  </div>
                  <div class="field span-2">
                    <label for="pf-dept">Department</label>
                    <input class="input" id="pf-dept" name="department" value="${U().escapeHtml(fresh.department || '')}" maxlength="60">
                    <span class="field-error"></span>
                  </div>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn btn-primary"><i data-lucide="save" aria-hidden="true"></i> Save changes</button>
                </div>
              </form>
            </div>
          </section>

          <section class="card" aria-labelledby="pw-title">
            <div class="card-head"><div><h2 id="pw-title">Change password</h2><p>Choose a strong password you do not use on any other site.</p></div></div>
            <div class="card-body">
              <form data-password-form novalidate>
                <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
                <div class="form-grid">
                  <div class="field span-2">
                    <label for="pw-current">Current password</label>
                    <div class="input-wrap">
                      <input class="input has-icon has-right" id="pw-current" name="current" type="password" autocomplete="current-password">
                      <i data-lucide="lock" aria-hidden="true"></i>
                      <button type="button" class="input-action" data-pw-toggle="pw-current" aria-label="Show password"><i data-lucide="eye" aria-hidden="true"></i></button>
                    </div>
                    <span class="field-error"></span>
                  </div>
                  <div class="field">
                    <label for="pw-new">New password</label>
                    <div class="input-wrap">
                      <input class="input has-icon has-right" id="pw-new" name="next" type="password" autocomplete="new-password">
                      <i data-lucide="key-round" aria-hidden="true"></i>
                      <button type="button" class="input-action" data-pw-toggle="pw-new" aria-label="Show password"><i data-lucide="eye" aria-hidden="true"></i></button>
                    </div>
                    <span class="hint">Minimum 8 characters with a letter and a number.</span>
                    <span class="field-error"></span>
                  </div>
                  <div class="field">
                    <label for="pw-confirm">Confirm new password</label>
                    <div class="input-wrap">
                      <input class="input has-icon has-right" id="pw-confirm" name="confirm" type="password" autocomplete="new-password">
                      <i data-lucide="key-round" aria-hidden="true"></i>
                      <button type="button" class="input-action" data-pw-toggle="pw-confirm" aria-label="Show password"><i data-lucide="eye" aria-hidden="true"></i></button>
                    </div>
                    <span class="field-error"></span>
                  </div>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn btn-secondary"><i data-lucide="shield-check" aria-hidden="true"></i> Update password</button>
                </div>
              </form>
            </div>
          </section>

          <section class="card" aria-labelledby="session-title">
            <div class="card-head"><div><h2 id="session-title">Session controls</h2></div></div>
            <div class="card-body stack-sm">
              <div class="callout callout-info">
                <i data-lucide="info" aria-hidden="true"></i>
                <div><b>Session stored on this device</b>
                <p>Your sign-in is kept in this browser so you stay signed in between visits. Use a password unique to CampusFind.</p></div>
              </div>
              <div class="row flex-wrap">
                <button type="button" class="btn btn-secondary" data-profile-theme><i data-lucide="moon" aria-hidden="true"></i> Toggle dark mode</button>
                <button type="button" class="btn btn-danger" data-profile-logout><i data-lucide="log-out" aria-hidden="true"></i> Log out</button>
              </div>
            </div>
          </section>
        </div>
      </div>`;

    U().refreshIcons(root);
    bindProfile(root, fresh);
  }

  function bindProfile(root, user) {
    U().qsa('[data-pw-toggle]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        btn.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}" aria-hidden="true"></i>`;
        U().refreshIcons(btn);
      });
    });

    const profileForm = root.querySelector('[data-profile-form]');
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const V = window.CF.validation;
      V.clearAll(profileForm);
      const name = profileForm.querySelector('[name="name"]');
      const phone = profileForm.querySelector('[name="phone"]');
      const dept = profileForm.querySelector('[name="department"]');
      const errors = {
        name: V.validateName(name.value),
        phone: V.validatePhone(phone.value),
      };
      const keys = Object.keys(errors).filter((k) => !errors[k].valid);
      if (keys.length) {
        keys.forEach((k) => V.showError(k === 'name' ? name : phone, errors[k].message));
        window.CF.ui.toast('warning', 'Please complete all required fields.');
        return;
      }
      const result = window.CF.auth.updateProfile(user.id, {
        name: name.value, phone: phone.value, department: dept.value,
      });
      if (!result.ok) { window.CF.ui.toast('error', result.message); return; }
      window.CF.ui.toast('success', 'Profile updated.');
      setTimeout(() => renderProfile(root, user), 500);
    });

    const pwForm = root.querySelector('[data-password-form]');
    pwForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const V = window.CF.validation;
      V.clearAll(pwForm);
      const current = pwForm.querySelector('[name="current"]');
      const next = pwForm.querySelector('[name="next"]');
      const confirm = pwForm.querySelector('[name="confirm"]');

      if (!current.value) { V.showError(current, 'Please enter your password.'); return; }
      const nextCheck = V.validatePassword(next.value);
      if (!nextCheck.valid) { V.showError(next, nextCheck.message); return; }
      if (next.value !== confirm.value) { V.showError(confirm, 'Passwords do not match.'); return; }

      const result = window.CF.auth.changePassword(user.id, current.value, next.value);
      if (!result.ok) {
        V.showError(result.message.includes('Current') ? current : next, result.message);
        window.CF.ui.toast('error', result.message);
        return;
      }
      pwForm.reset();
      window.CF.ui.toast('success', 'Password updated successfully.');
    });

    const themeBtn = root.querySelector('[data-profile-theme]');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const next = U().toggleTheme();
      window.CF.ui.toast('info', next === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.');
    });

    const logoutBtn = root.querySelector('[data-profile-logout]');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      window.CF.ui.confirm({
        title: 'Log out of CampusFind?',
        message: 'Your session will end on this device.',
        confirmLabel: 'Log out',
        tone: 'danger',
        onConfirm: () => {
          window.CF.auth.logoutUser();
          window.location.href = 'index.html';
        },
      });
    });
  }

  window.CF.dashboard = { render, renderProfile };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits.dashboard = render;
  window.CF.pageInits.profile = renderProfile;
})();
