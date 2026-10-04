/* ============================================================
   CampusFind — claims.js
   Claim lifecycle: submission, state transitions, timeline,
   notifications and chain-of-custody updates.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;

  const CLAIM_QUESTIONS = [
    { key: 'color', label: 'What color was the item?', placeholder: 'e.g. Black with silver zip' },
    { key: 'brand', label: 'What brand/model was it?', placeholder: 'e.g. Wildcraft Hoodie 35L' },
    { key: 'unique', label: 'Describe one unique feature.', placeholder: 'e.g. Blue star keychain on the zip' },
    { key: 'contents', label: 'What was inside the item?', placeholder: 'e.g. Two textbooks and a notebook' },
    { key: 'damage', label: 'Describe any damage or special marking.', placeholder: 'e.g. Torn zip pull on side pocket' },
  ];

  const STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'ITEM_RETURNED'];

  /* Display labels + badge colours */
  const STATUS_META = {
    PENDING: { label: 'Pending', badge: 'badge-amber', icon: 'clock' },
    UNDER_REVIEW: { label: 'Under Review', badge: 'badge-blue', icon: 'search' },
    APPROVED: { label: 'Approved', badge: 'badge-green', icon: 'check-circle-2' },
    REJECTED: { label: 'Rejected', badge: 'badge-red', icon: 'x-circle' },
    CANCELLED: { label: 'Cancelled', badge: 'badge-gray', icon: 'ban' },
    ITEM_RETURNED: { label: 'Item Returned', badge: 'badge-violet', icon: 'package-check' },
  };

  /* Valid state machine (used by unit tests + runtime) */
  const TRANSITIONS = {
    PENDING: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED', 'UNDER_REVIEW'],
    APPROVED: ['ITEM_RETURNED', 'CANCELLED'],
    REJECTED: [],
    CANCELLED: [],
    ITEM_RETURNED: [],
  };

  function isValidClaimTransition(from, to) {
    if (!from || !to) return false;
    const allowed = TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.indexOf(to) !== -1;
  }

  /* Ordered timeline steps shown to users */
  const TIMELINE_STEPS = [
    'Claim Submitted',
    'Under Review',
    'Verification',
    'Approved',
    'Pickup Scheduled',
    'Item Returned',
  ];

  const STATUS_TO_STEP = {
    PENDING: 0,
    UNDER_REVIEW: 1,
    APPROVED: 3,
    ITEM_RETURNED: 5,
    REJECTED: 1,
    CANCELLED: 0,
  };

  function actorLabel(user, fallbackRole) {
    if (!user) return fallbackRole || 'System';
    const role = user.role ? U().capitalize(user.role) : (fallbackRole || 'User');
    return `${user.name} (${role})`;
  }

  /* ---------- Validation of ownership / dedupe ---------- */
  function canUserActOnClaim(user, claim) {
    if (!user || !claim) return false;
    if (user.role === 'admin' || user.role === 'staff') return true;
    return claim.claimantId === user.id;
  }

  function hasExistingClaim(userId, itemId) {
    return (S().claims() || []).some((c) =>
      c.claimantId === userId &&
      c.itemId === itemId &&
      ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1
    );
  }

  /* ---------- Submission ---------- */
  function submitClaim(data) {
    const user = window.CF.auth.getCurrentUser();
    if (!user) return { ok: false, message: 'Please sign in to submit a claim.' };

    const item = S().findReport(data.itemId);
    if (!item || item.type !== 'found') return { ok: false, message: 'The item you are claiming no longer exists.' };
    if (item.status === 'archived') return { ok: false, message: 'This case has been archived.' };

    if (hasExistingClaim(user.id, item.id)) {
      return { ok: false, message: 'You already have an active claim for this item.' };
    }

    const validation = window.CF.validation.validateClaim(data.answers);
    if (!validation.valid) return { ok: false, message: validation.message };

    const now = new Date().toISOString();
    const claim = {
      id: U().generateCaseId('CLM'),
      itemId: item.id,
      lostReportId: data.lostReportId || '',
      claimantId: user.id,
      matchScore: typeof data.matchScore === 'number' ? data.matchScore : null,
      status: 'PENDING',
      answers: {
        color: U().sanitizeInput(data.answers.color),
        brand: U().sanitizeInput(data.answers.brand),
        unique: U().sanitizeInput(data.answers.unique),
        contents: U().sanitizeInput(data.answers.contents),
        damage: U().sanitizeInput(data.answers.damage),
      },
      notes: [],
      timeline: [
        { step: 'Claim Submitted', status: 'done', ts: now, actor: actorLabel(user), note: 'Claim with 5 verification answers.' },
        { step: 'Under Review', status: 'pending', ts: null, actor: '', note: '' },
      ],
      createdAt: now,
      updatedAt: now,
    };

    S().addClaim(claim);

    // Found item moves into review so other claimants see the state
    S().updateReport(item.id, { status: 'in_review' });

    S().pushCustody(item.id, {
      ts: now,
      actor: actorLabel(user),
      action: 'Claim submitted',
      location: 'Online',
      description: `Ownership claim ${claim.id} submitted for verification.`,
    });

    // Notify finder + staff
    S().addNotification({
      id: U().uid('n'), userId: item.finderId || item.ownerId, type: 'claim',
      title: 'New claim for your found item',
      message: `${user.name} submitted a claim for "${item.itemName}". Staff will verify the answers.`,
      link: `claim-details.html?id=${claim.id}`, read: false, createdAt: now,
    });
    (S().users() || []).filter((u) => u.role === 'staff' || u.role === 'admin').forEach((u) => {
      S().addNotification({
        id: U().uid('n'), userId: u.id, type: 'claim',
        title: 'New claim awaiting review',
        message: `Claim ${claim.id} for "${item.itemName}" needs verification.`,
        link: 'admin-claims.html', read: false, createdAt: now,
      });
    });

    S().pushAudit({
      id: U().uid('a'), ts: now, userId: user.id, userName: user.name,
      action: 'Student submitted claim', caseId: claim.id, ip: '10.24.0.1', status: 'Success',
    });

    return { ok: true, claim };
  }

  /* ---------- Transitions ---------- */
  function transitionClaim(claimId, nextStatus, actor, options) {
    const opts = options || {};
    const claim = S().findClaim(claimId);
    if (!claim) return { ok: false, message: 'Claim not found.' };
    if (!isValidClaimTransition(claim.status, nextStatus)) {
      return { ok: false, message: `Invalid status change: ${claim.status} → ${nextStatus}.` };
    }
    if (nextStatus === 'REJECTED' && !String(opts.reason || '').trim()) {
      return { ok: false, message: 'A rejection reason is required.' };
    }

    const now = new Date().toISOString();
    const item = S().findReport(claim.itemId);
    const claimant = S().findUser(claim.claimantId);
    const actorName = actor ? actorLabel(actor) : 'System';
    const stepMeta = STATUS_META[nextStatus] || { label: nextStatus };
    const patch = { status: nextStatus, updatedAt: now };
    const timelineEntry = {
      step: stepMeta.label, status: nextStatus === 'REJECTED' || nextStatus === 'CANCELLED' ? 'failed' : 'done',
      ts: now, actor: actorName, note: opts.reason || opts.note || '',
    };

    if (nextStatus === 'REJECTED') patch.rejectionReason = String(opts.reason || '').trim();

    const claimTimeline = (claim.timeline || []).slice();
    // Collapse the "current" marker onto the newest entry
    claimTimeline.forEach((entry) => { if (entry.status === 'current') entry.status = 'done'; });
    if (nextStatus === 'UNDER_REVIEW') {
      const pending = claimTimeline.findIndex((e) => e.step === 'Under Review');
      if (pending !== -1) {
        claimTimeline[pending] = { step: 'Under Review', status: 'current', ts: now, actor: actorName, note: opts.note || 'Review started.' };
      } else {
        claimTimeline.push(Object.assign({}, timelineEntry, { status: 'current' }));
      }
    } else {
      const entry = Object.assign({}, timelineEntry);
      entry.status = nextStatus === 'REJECTED' || nextStatus === 'CANCELLED' ? 'failed' : 'current';
      claimTimeline.push(entry);
    }
    patch.timeline = claimTimeline;
    if (opts.note) patch.notes = (claim.notes || []).concat([{ ts: now, actor: actorName, text: opts.note }]);

    S().updateClaim(claimId, patch);

    /* Side effects per transition */
    const notifyClaimant = (type, title, message) => {
      if (!claimant) return;
      S().addNotification({
        id: U().uid('n'), userId: claimant.id, type, title, message,
        link: `claim-details.html?id=${claim.id}`, read: false, createdAt: now,
      });
    };

    if (nextStatus === 'UNDER_REVIEW') {
      notifyClaimant('claim', 'Your claim is under review', `Staff started reviewing claim ${claim.id} for "${item ? item.itemName : 'your item'}".`);
    } else if (nextStatus === 'APPROVED') {
      notifyClaimant('approval', 'Your claim has been approved', `Claim ${claim.id} was approved. A staff member will schedule your pickup.`);
      if (item) S().updateReport(item.id, { status: 'approved' });
      if (item) {
        S().pushCustody(item.id, {
          ts: now, actor: actorName, action: 'Claim approved', location: 'Online',
          description: opts.note || `Claim ${claim.id} approved after verification.`,
        });
      }
    } else if (nextStatus === 'REJECTED') {
      notifyClaimant('rejection', 'Your claim was rejected', `Claim ${claim.id} was rejected: ${patch.rejectionReason}`);
      if (item && !hasOtherActiveClaim(claim.claimantId, item.id, claim.id)) {
        S().updateReport(item.id, { status: 'available' });
      }
    } else if (nextStatus === 'CANCELLED') {
      notifyClaimant('claim', 'Your claim was cancelled', `Claim ${claim.id} has been cancelled.`);
      if (item && !hasOtherActiveClaim(claim.claimantId, item.id, claim.id)) {
        S().updateReport(item.id, { status: 'available' });
      }
    } else if (nextStatus === 'ITEM_RETURNED') {
      const nowLabel = U().formatDateTime(now);
      notifyClaimant('returned', 'Item returned — case closed', `Your item for claim ${claim.id} was handed over on ${nowLabel}.`);
      if (item) {
        S().updateReport(item.id, { status: 'returned', returnedAt: now, returnedBy: actorName });
        S().pushCustody(item.id, {
          ts: now, actor: actorName, action: 'Item handed over',
          location: opts.location || 'Security Desk',
          description: opts.note || 'Item released to the verified owner.',
        });
      }
      if (claimant && item && item.lostOwnerReportId) { /* no-op: kept for future linkage */ }
    }

    S().pushAudit({
      id: U().uid('a'), ts: now,
      userId: actor ? actor.id : 'system', userName: actor ? actor.name : 'System',
      action: auditAction(nextStatus), caseId: claim.id, ip: '10.24.0.1', status: 'Success',
    });

    return { ok: true, claim: S().findClaim(claimId) };
  }

  function hasOtherActiveClaim(exceptUserId, itemId, exceptClaimId) {
    return (S().claims() || []).some((c) =>
      c.itemId === itemId &&
      c.claimantId !== exceptUserId &&
      c.id !== exceptClaimId &&
      ['PENDING', 'UNDER_REVIEW', 'APPROVED'].indexOf(c.status) !== -1
    );
  }

  function auditAction(status) {
    switch (status) {
      case 'UNDER_REVIEW': return 'Staff started claim review';
      case 'APPROVED': return 'Admin approved claim';
      case 'REJECTED': return 'Admin rejected claim';
      case 'CANCELLED': return 'Claimant cancelled claim';
      case 'ITEM_RETURNED': return 'Staff marked item returned';
      default: return `Claim status set to ${status}`;
    }
  }

  /* Convenience wrappers */
  const startReview = (id, actor, note) => transitionClaim(id, 'UNDER_REVIEW', actor, { note: note || 'Review started.' });
  const approveClaim = (id, actor, note) => transitionClaim(id, 'APPROVED', actor, { note: note || 'Verification answers matched the report.' });
  const rejectClaim = (id, actor, reason) => transitionClaim(id, 'REJECTED', actor, { reason });
  const cancelClaim = (id, actor, note) => transitionClaim(id, 'CANCELLED', actor, { note: note || 'Cancelled by claimant.' });
  const markReturned = (id, actor, opts) => transitionClaim(id, 'ITEM_RETURNED', actor, opts || {});

  function requestMoreInfo(claimId, actor, message) {
    const claim = S().findClaim(claimId);
    if (!claim) return { ok: false, message: 'Claim not found.' };
    if (claim.status !== 'PENDING' && claim.status !== 'UNDER_REVIEW') {
      return { ok: false, message: 'More information can only be requested while a claim is under review.' };
    }
    const now = new Date().toISOString();
    const actorName = actorLabel(actor);
    const claimant = S().findUser(claim.claimantId);

    // Re-open PENDING into UNDER_REVIEW first
    let result = { ok: true, claim };
    if (claim.status === 'PENDING') result = transitionClaim(claimId, 'UNDER_REVIEW', actor, { note: 'Review started — additional information requested.' });
    if (!result.ok) return result;

    const fresh = S().findClaim(claimId);
    S().updateClaim(claimId, {
      infoRequested: true,
      notes: (fresh.notes || []).concat([{ ts: now, actor: actorName, text: message || 'Additional verification information requested.' }]),
      updatedAt: now,
    });
    if (claimant) {
      S().addNotification({
        id: U().uid('n'), userId: claimant.id, type: 'claim',
        title: 'More information needed for your claim',
        message: message || 'Staff requested additional details for your claim.',
        link: `claim-details.html?id=${claimId}`, read: false, createdAt: now,
      });
    }
    return { ok: true, claim: S().findClaim(claimId) };
  }

  /* ---------- Rendering helpers ---------- */
  function statusBadge(status) {
    const meta = STATUS_META[status] || { label: status, badge: 'badge-gray', icon: 'circle' };
    return `<span class="badge ${meta.badge}"><i data-lucide="${meta.icon}" aria-hidden="true"></i>${meta.label}</span>`;
  }

  /* ============================================================
     Next-step guidance
     Tells the claimant exactly what happens now and what they must do,
     so the journey from "I found a match" to "I have my item back"
     never goes quiet. Staff get a different voice: their panel tells
     them what THEY must do next, not what the claimant is doing.
     ============================================================ */
  const NEXT_STEP = {
    PENDING: {
      icon: 'clock', tone: 'info',
      title: 'Your claim is queued',
      body: 'Campus lost & found staff will start reviewing your answers. You will be notified the moment they do — nothing more is needed from you right now.',
    },
    UNDER_REVIEW: {
      icon: 'search', tone: 'info',
      title: 'Staff are checking your answers',
      body: 'A staff member is comparing your answers with the finder’s report. If they need proof of ownership they will ask you to add a photo or a unique detail.',
    },
    MORE_INFO: {
      icon: 'message-square-more', tone: 'warning',
      title: 'We need more information from you',
      body: 'Open your notifications to read exactly what staff asked for, then reply. Your claim stays open until you respond.',
    },
    APPROVED: {
      icon: 'badge-check', tone: 'success',
      title: 'Approved — come and collect it',
      body: 'Your claim was approved. Bring your college ID card to the Security Desk during working hours (8 AM – 8 PM) and quote your claim ID. Staff will confirm your identity and hand the item over.',
    },
    ITEM_RETURNED: {
      icon: 'package-check', tone: 'success',
      title: 'Collected — case closed',
      body: 'This item has been returned to you and the handover is recorded in the chain of custody. There is nothing else to do.',
    },
    REJECTED: {
      icon: 'x-circle', tone: 'danger',
      title: 'This claim was not accepted',
      body: 'The answers did not match the finder’s report. The item has been released for other claimants to claim. If you believe this is wrong, contact the lost & found desk with your college ID.',
    },
    CANCELLED: {
      icon: 'ban', tone: 'info',
      title: 'Claim cancelled',
      body: 'You cancelled this claim, so it is no longer being reviewed. You can submit a fresh claim any time while the item is still listed.',
    },
  };

  /* Staff-facing variant: what the reviewer needs to do to keep the case moving */
  const NEXT_STEP_REVIEWER = {
    PENDING: {
      icon: 'inbox', tone: 'warning',
      title: 'Waiting for you to start the review',
      body: 'Compare the answers below with the finder’s report, then start the review or reject the claim outright. Until you pick it up the claimant sees nothing.',
    },
    UNDER_REVIEW: {
      icon: 'search', tone: 'info',
      title: 'Your review is in progress',
      body: 'Decide this claim: approve it if the answers are convincing, request more information if you need proof, or reject it with a reason the claimant can act on.',
    },
    MORE_INFO: {
      icon: 'message-square-more', tone: 'warning',
      title: 'Waiting on the claimant',
      body: 'You have asked for more information. The claim cannot be decided until the claimant replies — you will be notified when they do.',
    },
    APPROVED: {
      icon: 'package-check', tone: 'success',
      title: 'Hand the item over to close this case',
      body: 'Check the claimant’s college ID against the roll number on this case, then mark the item as handed over. That records the custody entry and notifies the claimant.',
    },
    ITEM_RETURNED: {
      icon: 'circle-check-big', tone: 'success',
      title: 'Handover recorded',
      body: 'This case is closed. The custody chain and audit trail are complete — nothing further is needed.',
    },
    REJECTED: {
      icon: 'x-circle', tone: 'danger',
      title: 'Rejected — item released for other claimants',
      body: 'The item has been made available again automatically. No further action is needed unless the claimant appeals at the desk.',
    },
    CANCELLED: {
      icon: 'ban', tone: 'info',
      title: 'Cancelled by the claimant',
      body: 'Nothing to do. The item stays listed so other claimants can still come forward.',
    },
  };

  /* requestMoreInfo keeps the status at PENDING/UNDER_REVIEW and sets infoRequested,
     so the MORE_INFO copy is selected from that flag rather than from claim.status. */
  function resolveStepKey(claim) {
    if (claim.infoRequested && (claim.status === 'PENDING' || claim.status === 'UNDER_REVIEW')) {
      return 'MORE_INFO';
    }
    return claim.status;
  }

  function nextStepHtml(claim, viewer) {
    const role = viewer && viewer.role;
    const isReviewer = role === 'staff' || role === 'admin';
    const map = isReviewer ? NEXT_STEP_REVIEWER : NEXT_STEP;
    const key = resolveStepKey(claim);
    const step = map[key];
    if (!step) return '';
    const label = isReviewer ? 'Reviewer next step' : 'Next step';
    return `<div class="callout callout-${step.tone} next-step-callout">
      <span class="visually-hidden">${U().escapeHtml(label)}</span>
      <i data-lucide="${step.icon}" aria-hidden="true"></i>
      <div><b>${U().escapeHtml(step.title)}</b><p>${U().escapeHtml(step.body)}</p></div>
    </div>`;
  }

  function progressHtml(claim) {
    const currentStep = STATUS_TO_STEP[claim.status] !== undefined ? STATUS_TO_STEP[claim.status] : 0;
    const failed = claim.status === 'REJECTED' || claim.status === 'CANCELLED';
    return `<div class="claim-progress" role="list" aria-label="Claim progress">` +
      TIMELINE_STEPS.map((step, i) => {
        let state = '';
        if (failed && i === currentStep) state = 'failed';
        else if (i < currentStep) state = 'done';
        else if (i === currentStep) state = 'current';
        const iconName = state === 'done' ? 'check' : (state === 'failed' ? 'x' : String(i + 1));
        return `<div class="claim-step ${state}" role="listitem"${state === 'current' ? ' aria-current="step"' : ''}>
          <span class="c-dot">${state === 'done' || state === 'failed' ? `<i data-lucide="${iconName}" aria-hidden="true"></i>` : iconName}</span>
          <span class="c-label">${step}</span>
        </div>`;
      }).join('') +
      `</div>`;
  }

  function timelineHtml(claim) {
    const entries = (claim.timeline || []).slice().reverse();
    if (!entries.length) return '<p class="text-sm text-muted">No timeline events yet.</p>';
    return `<div class="timeline">` + entries.map((entry) => {
      const muted = entry.status === 'pending' ? ' muted' : '';
      return `<div class="timeline-item${muted}">
        <div class="t-title">${U().escapeHtml(entry.step)}${entry.status === 'current' ? ' <span class="badge badge-blue" style="margin-left:6px">Current</span>' : ''}</div>
        <div class="t-meta">
          <span><i data-lucide="clock" aria-hidden="true"></i>${entry.ts ? U().formatDateTime(entry.ts) : 'Pending'}</span>
          ${entry.actor ? `<span><i data-lucide="user" aria-hidden="true"></i>${U().escapeHtml(entry.actor)}</span>` : ''}
        </div>
        ${entry.note ? `<div class="t-desc">${U().escapeHtml(entry.note)}</div>` : ''}
      </div>`;
    }).join('') + `</div>`;
  }

  /* ============================================================
     Claims list page (claims.html)
     ============================================================ */
  function renderListPage(root, user) {
    const state = { tab: 'mine', q: '', status: '', page: 1 };
    const isReviewer = user.role === 'staff' || user.role === 'admin';

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Claims</h1>
          <p>Ownership claims you submitted${isReviewer ? ', plus claims awaiting your review' : ''}.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" href="found-items.html"><i data-lucide="package-search" aria-hidden="true"></i> Find an item to claim</a>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Claim filter">
        <button type="button" class="tab-btn active" role="tab" aria-selected="true" data-tab="mine">My claims <span class="tab-count" data-count="mine">0</span></button>
        ${isReviewer ? `<button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="review">Awaiting review <span class="tab-count" data-count="review">0</span></button>` : ''}
        <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="all">All <span class="tab-count" data-count="all">0</span></button>
      </div>

      <div class="filter-bar">
        <div class="search-field">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" type="search" name="q" placeholder="Search claim ID, item, claimant..." aria-label="Search claims">
        </div>
        <select class="input" name="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${STATUSES.map((s) => `<option value="${s}">${STATUS_META[s].label}</option>`).join('')}
        </select>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th scope="col">Claim ID</th><th scope="col">Item</th><th scope="col">Claimant</th>
            <th scope="col">Match</th><th scope="col">Date</th><th scope="col">Status</th>
            <th scope="col" style="text-align:right">Actions</th>
          </tr></thead>
          <tbody data-claims-body></tbody>
        </table>
        <div data-claims-empty class="table-empty"></div>
      </div>
      <div data-pagination></div>`;

    const body = root.querySelector('[data-claims-body]');
    const empty = root.querySelector('[data-claims-empty]');
    const pagerEl = root.querySelector('[data-pagination]');

    function baseList() {
      const all = (S().claims() || []);
      if (state.tab === 'mine') return all.filter((c) => c.claimantId === user.id);
      if (state.tab === 'review') return all.filter((c) => ['PENDING', 'UNDER_REVIEW'].indexOf(c.status) !== -1);
      return all;
    }

    function rows() {
      let list = baseList();
      if (state.status) list = list.filter((c) => c.status === state.status);
      const q = state.q.trim().toLowerCase();
      if (q) list = list.filter((c) => {
        const item = S().findReport(c.itemId);
        const claimant = S().findUser(c.claimantId);
        return [c.id, item ? item.itemName : '', claimant ? claimant.name : '', c.status]
          .some((f) => String(f).toLowerCase().includes(q));
      });
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function draw() {
      const all = (S().claims() || []);
      const counts = {
        mine: all.filter((c) => c.claimantId === user.id).length,
        review: all.filter((c) => ['PENDING', 'UNDER_REVIEW'].indexOf(c.status) !== -1).length,
        all: all.length,
      };
      Object.keys(counts).forEach((key) => {
        const holder = root.querySelector(`[data-count="${key}"]`);
        if (holder) holder.textContent = String(counts[key]);
      });
      U().qsa('[data-tab]', root).forEach((btn) => {
        const active = btn.getAttribute('data-tab') === state.tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
      });

      const list = rows();
      const pager = U().paginate(list, state.page, 10);
      state.page = pager.page;

      if (!list.length) {
        body.innerHTML = '';
        empty.innerHTML = `<div class="empty-state" style="border:none">
          <div class="empty-ico"><i data-lucide="file-x-2" aria-hidden="true"></i></div>
          <h3>No claims found.</h3>
          <p>${state.q ? 'Try changing your search filters.' : 'Claims you submit on found items appear here with their verification timeline.'}</p>
          <a class="btn btn-primary" href="found-items.html">Browse found items</a>
        </div>`;
        pagerEl.innerHTML = '';
        U().refreshIcons(root);
        return;
      }

      empty.innerHTML = '';
      body.innerHTML = pager.items.map((c) => {
        const item = S().findReport(c.itemId);
        const claimant = S().findUser(c.claimantId);
        const meta = STATUS_META[c.status];
        return `<tr>
          <td data-label="Claim ID"><span class="mono">${U().escapeHtml(c.id)}</span></td>
          <td data-label="Item"><strong>${U().escapeHtml(item ? item.itemName : 'Item removed')}</strong><br><span class="text-xs text-muted mono">${U().escapeHtml(c.itemId)}</span></td>
          <td data-label="Claimant">${U().escapeHtml(claimant ? claimant.name : 'Unknown')}</td>
          <td data-label="Match">${c.matchScore ? `<span class="badge badge-blue">${c.matchScore}%</span>` : '<span class="text-muted">—</span>'}</td>
          <td data-label="Date">${U().formatDate(c.createdAt)}</td>
          <td data-label="Status">${statusBadge(c.status)}</td>
          <td data-label="Actions"><div class="cell-actions">
            <a class="btn btn-soft" href="claim-details.html?id=${encodeURIComponent(c.id)}">${isReviewer && ['PENDING', 'UNDER_REVIEW'].indexOf(c.status) !== -1 ? 'Review' : 'View'}</a>
          </div></td>
        </tr>`;
      }).join('');
      pagerEl.innerHTML = U().paginationControls(pager);
      U().refreshIcons(root);
      U().qsa('[data-page-btn]', pagerEl).forEach((btn) => btn.addEventListener('click', () => {
        state.page = Number(btn.getAttribute('data-page-btn'));
        draw();
      }));
    }

    U().qsa('[data-tab]', root).forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-tab');
      state.page = 1;
      draw();
    }));
    const search = root.querySelector('input[name="q"]');
    search.addEventListener('input', U().debounce(() => { state.q = search.value; state.page = 1; draw(); }, 300));
    root.querySelector('select[name="status"]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; draw(); });

    draw();
  }

  /* ============================================================
     Claim detail page (claim-details.html)
     ============================================================ */
  function renderDetailPage(root, user) {
    const id = U().param('id', '');
    const claim = id ? S().findClaim(id) : null;

    if (!claim) {
      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>Claim not found</h1>
            <p>The claim "${U().escapeHtml(id || '—')}" does not exist, or it belongs to another account.</p>
          </div>
        </div>
        <div class="empty-state">
          <div class="empty-ico"><i data-lucide="file-question" aria-hidden="true"></i></div>
          <h2>Nothing to show here</h2>
          <p>Claims you submit are always listed under My claims.</p>
          <a class="btn btn-primary" href="claims.html">Back to claims</a>
        </div>`;
      U().refreshIcons(root);
      return;
    }

    /* Authorization: claimants may read their own claim; staff/admin read all */
    if (claim.claimantId !== user.id && user.role !== 'staff' && user.role !== 'admin') {
      window.location.replace('403.html');
      return;
    }

    const item = S().findReport(claim.itemId);
    const claimant = S().findUser(claim.claimantId);
    const lost = claim.lostReportId ? S().findReport(claim.lostReportId) : null;
    const isReviewer = user.role === 'staff' || user.role === 'admin';
    const isClaimant = claim.claimantId === user.id;
    const canReview = isReviewer && ['PENDING', 'UNDER_REVIEW'].indexOf(claim.status) !== -1;
    const canReturn = isReviewer && claim.status === 'APPROVED';
    const canCancel = isClaimant && ['PENDING', 'UNDER_REVIEW'].indexOf(claim.status) !== -1;

    root.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="dashboard.html">Dashboard</a><i data-lucide="chevron-right" aria-hidden="true"></i>
        <a href="claims.html">Claims</a><i data-lucide="chevron-right" aria-hidden="true"></i>
        <span aria-current="page">${U().escapeHtml(claim.id)}</span>
      </nav>

      <div class="page-head">
        <div>
          <div class="row u-row">
            <h1 style="margin:0">Claim ${U().escapeHtml(claim.id)}</h1>
            ${statusBadge(claim.status)}
            ${claim.matchScore ? `<span class="badge badge-blue"><i data-lucide="target" aria-hidden="true"></i>${claim.matchScore}% Smart Match</span>` : ''}
          </div>
          <p>Submitted ${U().formatDateTime(claim.createdAt)} by ${U().escapeHtml(claimant ? claimant.name : 'Unknown')}${claimant ? ` · ${U().escapeHtml(claimant.collegeId)}` : ''}</p>
        </div>
        <div class="page-actions">
          ${item ? `<a class="btn btn-secondary" href="item-details.html?id=${encodeURIComponent(item.id)}"><i data-lucide="external-link" aria-hidden="true"></i> View item</a>` : ''}
        </div>
      </div>

      <section class="card card-pad" aria-label="Claim progress">
        ${progressHtml(claim)}
      </section>

      ${nextStepHtml(claim, user)}

      ${claim.status === 'REJECTED' && claim.rejectionReason ? `
        <div class="callout callout-danger mt-24">
          <i data-lucide="x-circle" aria-hidden="true"></i>
          <div><b>Claim rejected</b><p>${U().escapeHtml(claim.rejectionReason)}</p></div>
        </div>` : ''}
      ${claim.infoRequested && ['PENDING', 'UNDER_REVIEW'].indexOf(claim.status) !== -1 ? `
        <div class="callout callout-warning mt-24">
          <i data-lucide="message-square-more" aria-hidden="true"></i>
          <div><b>More information requested</b><p>Staff are waiting for additional verification details. Check your notifications.</p></div>
        </div>` : ''}

      <div class="dash-grid mt-24">
        <div class="dash-col">
          <section class="card" aria-labelledby="answers-title">
            <div class="card-head">
              <div>
                <h2 id="answers-title">Verification answers</h2>
                <p>${isReviewer ? 'Compare these answers with the finder report before deciding.' : 'Your answers are private and never shown on public pages.'}</p>
              </div>
              <span class="badge ${isReviewer ? 'badge-amber' : 'badge-gray'}"><i data-lucide="${isReviewer ? 'eye' : 'lock'}" aria-hidden="true"></i>${isReviewer ? 'Reviewer view' : 'Private'}</span>
            </div>
            <div class="card-body">
              <div class="claim-answers">
                ${CLAIM_QUESTIONS.map((q) => `
                  <div class="claim-answer">
                    <div class="ca-q">${U().escapeHtml(q.label)}</div>
                    <div class="ca-a">${U().escapeHtml(claim.answers[q.key] || '—')}</div>
                  </div>`).join('')}
              </div>
            </div>
          </section>

          <section class="card" aria-labelledby="timeline-title">
            <div class="card-head">
              <div><h2 id="timeline-title">Claim timeline</h2><p>Every status change is recorded with actor and timestamp.</p></div>
            </div>
            <div class="card-body">${timelineHtml(claim)}</div>
          </section>

          ${(claim.notes || []).length ? `
          <section class="card" aria-labelledby="notes-title">
            <div class="card-head"><div><h2 id="notes-title">Reviewer notes</h2></div></div>
            <div class="card-body">
              <div class="timeline">
                ${claim.notes.slice().reverse().map((n) => `
                  <div class="timeline-item">
                    <div class="t-title">${U().escapeHtml(n.actor)}</div>
                    <div class="t-meta"><span><i data-lucide="clock" aria-hidden="true"></i>${U().formatDateTime(n.ts)}</span></div>
                    <div class="t-desc">${U().escapeHtml(n.text)}</div>
                  </div>`).join('')}
              </div>
            </div>
          </section>` : ''}
        </div>

        <aside class="side-panel">
          <section class="card card-pad" aria-labelledby="pair-title">
            <h2 id="pair-title" style="font-size:16px;margin-bottom:14px">Matched records</h2>
            <div class="match-pair">
              <div class="pair-card">
                <div class="p-label">Lost report</div>
                <b>${U().escapeHtml(lost ? lost.itemName : 'Not linked')}</b>
                <span class="mono text-xs">${U().escapeHtml(lost ? lost.id : '—')}</span>
              </div>
              <div class="pair-link"><i data-lucide="link-2" aria-hidden="true"></i></div>
              <div class="pair-card">
                <div class="p-label">Found item</div>
                <b>${U().escapeHtml(item ? item.itemName : 'Removed')}</b>
                <span class="mono text-xs">${U().escapeHtml(claim.itemId)}</span>
              </div>
            </div>
            <div class="divider"></div>
            <dl class="case-meta">
              <div class="case-meta-row"><dt>Claimant</dt><dd>${U().escapeHtml(claimant ? claimant.name : 'Unknown')}</dd></div>
              <div class="case-meta-row"><dt>Email</dt><dd>${U().escapeHtml(claimant ? claimant.email : '—')}</dd></div>
              <div class="case-meta-row"><dt>Smart Match</dt><dd>${claim.matchScore ? `${claim.matchScore}%` : '—'}</dd></div>
              <div class="case-meta-row"><dt>Submitted</dt><dd>${U().formatDate(claim.createdAt)}</dd></div>
              <div class="case-meta-row"><dt>Last update</dt><dd>${U().formatDate(claim.updatedAt || claim.createdAt)}</dd></div>
            </dl>
          </section>

          <section class="card card-pad" aria-labelledby="actions-title">
            <h2 id="actions-title" style="font-size:16px;margin-bottom:14px">Actions</h2>
            <div class="stack-sm">
              ${canReview ? `
                <button type="button" class="btn btn-primary btn-block" data-act="approve"><i data-lucide="check-circle-2" aria-hidden="true"></i> Approve claim</button>
                <button type="button" class="btn btn-secondary btn-block" data-act="info"><i data-lucide="message-square-more" aria-hidden="true"></i> Request more info</button>
                <button type="button" class="btn btn-danger btn-block" data-act="reject"><i data-lucide="x-circle" aria-hidden="true"></i> Reject claim</button>` : ''}
              ${canReturn ? `
                <button type="button" class="btn btn-success btn-block" data-act="return"><i data-lucide="package-check" aria-hidden="true"></i> Mark item handed over</button>` : ''}
              ${canCancel ? `
                <button type="button" class="btn btn-ghost btn-block" data-act="cancel"><i data-lucide="ban" aria-hidden="true"></i> Cancel my claim</button>` : ''}
              ${!canReview && !canReturn && !canCancel ? `
                <div class="callout callout-info">
                  <i data-lucide="info" aria-hidden="true"></i>
                  <div><b>No actions available</b><p>This claim is ${U().escapeHtml(STATUS_META[claim.status].label)}. You will be notified when its status changes.</p></div>
                </div>` : ''}
            </div>
          </section>
        </aside>
      </div>`;

    U().refreshIcons(root);
    bindActions();

    function bindActions() {
      const map = {
        approve: () => window.CF.admin.approveFlow(claim.id, user, () => renderDetailPage(root, user)),
        reject: () => window.CF.admin.rejectFlow(claim.id, user, () => renderDetailPage(root, user)),
        info: () => window.CF.admin.infoFlow(claim.id, user, () => renderDetailPage(root, user)),
        cancel: () => window.CF.ui.confirm({
          title: 'Cancel your claim?',
          message: `Claim ${claim.id} will be marked as cancelled. You can submit a new claim later if the item is still available.`,
          confirmLabel: 'Cancel claim',
          tone: 'danger',
          onConfirm: () => {
            const res = cancelClaim(claim.id, user, 'Cancelled by claimant.');
            if (!res.ok) { window.CF.ui.toast('error', res.message); return; }
            window.CF.ui.toast('success', 'Claim cancelled.');
            renderDetailPage(root, user);
          },
        }),
        return: () => handoverModal(claim, user, () => renderDetailPage(root, user)),
      };
      U().qsa('[data-act]', root).forEach((btn) => {
        const handler = map[btn.getAttribute('data-act')];
        if (handler) btn.addEventListener('click', handler);
      });
    }
  }

  function handoverModal(claim, user, onDone) {
    const item = S().findReport(claim.itemId);
    window.CF.ui.modal({
      title: 'Hand over the item',
      subtitle: `${claim.id} · ${item ? item.itemName : ''}`,
      icon: 'package-check',
      tone: 'success',
      confirmLabel: 'Mark as returned',
      confirmClass: 'btn-success',
      body: `
        <div class="stack">
          <div class="callout callout-success">
            <i data-lucide="badge-check" aria-hidden="true"></i>
            <div><b>This closes the case</b><p>Confirm the claimant's identity and roll number before releasing the item. The handover is written to the chain of custody.</p></div>
          </div>
          <div class="field">
            <label for="handover-location">Handover location <span class="req">*</span></label>
            <select class="input" id="handover-location">
              <option value="Security Desk">Security Desk</option>
              <option value="Lost &amp; Found Office">Lost &amp; Found Office</option>
              <option value="Registrar Counter">Registrar Counter</option>
              <option value="Hostel Reception">Hostel Reception</option>
            </select>
          </div>
          <div class="field">
            <label for="handover-note">Handover note</label>
            <textarea class="input" id="handover-note" rows="3" maxlength="300" placeholder="e.g. Released after ID verification at the security desk."></textarea>
            <span class="field-error"></span>
          </div>
        </div>`,
      onOpen: (modalEl, close) => {
        modalEl.querySelector('[data-modal-confirm]').addEventListener('click', () => {
          const note = modalEl.querySelector('#handover-note').value.trim();
          const location = modalEl.querySelector('#handover-location').value;
          if (note && note.length < 5) {
            window.CF.validation.showError(modalEl.querySelector('#handover-note'), 'Note must be at least 5 characters.');
            return;
          }
          const res = markReturned(claim.id, user, {
            location,
            note: note || `Item handed over at ${location} after ID verification.`,
          });
          if (!res.ok) { window.CF.ui.toast('error', res.message); return; }
          close();
          window.CF.ui.toast('success', 'ITEM RETURNED — case closed.');
          if (onDone) onDone();
        });
      },
    });
  }

  window.CF.claims = {
    CLAIM_QUESTIONS, STATUSES, STATUS_META, TRANSITIONS, TIMELINE_STEPS,
    isValidClaimTransition, submitClaim, transitionClaim,
    startReview, approveClaim, rejectClaim, cancelClaim, markReturned,
    requestMoreInfo, hasExistingClaim, canUserActOnClaim,
    statusBadge, progressHtml, timelineHtml, actorLabel, nextStepHtml, NEXT_STEP, NEXT_STEP_REVIEWER, resolveStepKey,
    renderListPage, renderDetailPage,
  };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits.claims = renderListPage;
  window.CF.pageInits['claim-details'] = renderDetailPage;
})();
