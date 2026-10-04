/* ============================================================
   CampusFind — reports.js
   Report lost / report found: shared wizard engine, image
   handling, case creation, custody + match notifications.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;
  const V = () => window.CF.validation;

  const CATEGORIES = V().CATEGORIES;
  const LOCATIONS = [
    'Central Library', 'Academic Block A', 'Academic Block B', 'Academic Block C',
    'Computer Lab 1', 'Computer Lab 2', 'Canteen', 'Hostel Block A',
    'Hostel Block B', 'Hostel Block C', 'Sports Complex', 'Gymnasium',
    'Auditorium', 'Bus Stop', 'Parking Lot', 'Health Centre',
    'Registrar Office', 'Admin Block', 'Auditorium Lawn', 'Other',
  ];
  const STORAGE_STATUSES = ['With Finder', 'Handed to Security', 'Stored by Staff'];
  const MAX_IMAGES = 5;
  const MAX_BYTES = 5 * 1024 * 1024;

  function selectOptions(list, placeholder) {
    const head = placeholder ? `<option value="">${U().escapeHtml(placeholder)}</option>` : '';
    return head + list.map((v) => `<option value="${U().escapeHtml(v)}">${U().escapeHtml(v)}</option>`).join('');
  }

  /* ============================================================
     Image handling — preview + client-side downscale so the
     browser store never exceeds quota.
     ============================================================ */
  const imageStore = {
    list: [],
    add(file) {
      return new Promise((resolve) => {
        const typeOk = V().IMAGE_TYPES.indexOf(String(file.type || '').toLowerCase()) !== -1;
        if (!typeOk) { window.CF.ui.toast('error', `"${file.name}" is not a JPEG, PNG or WEBP image.`); resolve(null); return; }
        if (file.size > MAX_BYTES) { window.CF.ui.toast('error', `"${file.name}" is larger than 5MB.`); resolve(null); return; }
        if (this.list.length >= MAX_IMAGES) { window.CF.ui.toast('warning', `You can upload a maximum of ${MAX_IMAGES} images.`); resolve(null); return; }

        const reader = new FileReader();
        reader.onerror = () => { window.CF.ui.toast('error', 'Could not read that image.'); resolve(null); };
        reader.onload = () => {
          downscale(String(reader.result), 900, 0.82).then((dataUrl) => {
            const entry = { id: U().uid('img'), name: file.name, dataUrl };
            this.list.push(entry);
            resolve(entry);
          });
        };
        reader.readAsDataURL(file);
      });
    },
    remove(id) {
      this.list = this.list.filter((i) => i.id !== id);
    },
    reset() { this.list = []; },
    urls() { return this.list.map((i) => i.dataUrl); },
    count() { return this.list.length; },
  };

  function downscale(dataUrl, maxDim, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function renderPreviews(root, onChange) {
    const holder = root.querySelector('[data-previews]');
    if (!holder) return;
    holder.innerHTML = imageStore.list.map((entry) => `
      <div class="upload-thumb">
        <img src="${entry.dataUrl}" alt="Preview of ${U().escapeHtml(entry.name)}">
        <button type="button" class="rm-img" data-rm-img="${U().escapeHtml(entry.id)}" aria-label="Remove image ${U().escapeHtml(entry.name)}">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>`).join('');
    const counter = root.querySelector('[data-img-count]');
    if (counter) counter.textContent = `${imageStore.count()} / ${MAX_IMAGES} images`;
    U().refreshIcons(holder);
    U().qsa('[data-rm-img]', holder).forEach((btn) => {
      btn.addEventListener('click', () => {
        imageStore.remove(btn.getAttribute('data-rm-img'));
        renderPreviews(root, onChange);
        if (onChange) onChange();
      });
    });
    const input = root.querySelector('input[type="file"]');
    if (input) input.disabled = imageStore.count() >= MAX_IMAGES;
  }

  function bindUploadZone(root, onChange) {
    const zone = root.querySelector('[data-upload-zone]');
    const input = root.querySelector('input[type="file"][data-image-input]');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragover', 'dragenter'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', (e) => handleFiles(e.dataTransfer && e.dataTransfer.files, root, onChange));
    input.addEventListener('change', () => { handleFiles(input.files, root, onChange); input.value = ''; });
    renderPreviews(root, onChange);
  }

  async function handleFiles(files, root, onChange) {
    if (!files || !files.length) return;
    for (let i = 0; i < files.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const entry = await imageStore.add(files[i]);
      if (entry) renderPreviews(root, onChange);
    }
    if (onChange) onChange();
  }

  /* ============================================================
     Generic wizard engine
     ============================================================ */
  function initWizard(root, config) {
    const state = { step: 0, values: Object.assign({}, config.values || {}), submitting: false };
    const panels = U().qsa('[data-step-panel]', root);
    const head = root.querySelector('[data-wizard-head]');
    const btnNext = root.querySelector('[data-wizard-next]');
    const btnBack = root.querySelector('[data-wizard-back]');
    const btnSubmit = root.querySelector('[data-wizard-submit]');
    const stepLabel = root.querySelector('[data-step-label]');

    function drawHead() {
      if (!head) return;
      head.innerHTML = config.steps.map((label, i) => `
        <div class="wizard-step ${i === state.step ? 'active' : (i < state.step ? 'done' : '')}" ${i === state.step ? 'aria-current="step"' : ''}>
          <span class="w-num">${i < state.step ? '<i data-lucide="check" aria-hidden="true"></i>' : i + 1}</span>
          <span class="w-label">${U().escapeHtml(label)}</span>
        </div>`).join('');
      U().refreshIcons(head);
    }

    function show(index) {
      state.step = U().clamp(index, 0, panels.length - 1);
      panels.forEach((p, i) => p.classList.toggle('active', i === state.step));
      drawHead();
      if (btnBack) btnBack.style.display = state.step === 0 ? 'none' : '';
      if (btnNext) btnNext.style.display = state.step === panels.length - 1 ? 'none' : '';
      if (btnSubmit) btnSubmit.style.display = state.step === panels.length - 1 ? '' : 'none';
      if (stepLabel) stepLabel.textContent = `Step ${state.step + 1} of ${panels.length}: ${config.steps[state.step]}`;
      const focusTarget = panels[state.step].querySelector('input, select, textarea, button');
      if (focusTarget && state.step > 0) focusTarget.focus({ preventScroll: true });
      panels[state.step].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (config.onStep) config.onStep(state.step, state);
    }

    function validateStep() {
      const errors = config.validate ? config.validate(state.step, state.values) : {};
      // clear first
      V().clearAll(panels[state.step]);
      const keys = Object.keys(errors);
      if (!keys.length) return true;

      keys.forEach((key) => {
        const input = panels[state.step].querySelector(`[name="${key}"]`);
        V().showError(input, errors[key]);
      });
      const summary = panels[state.step].querySelector('.form-error-summary');
      if (summary) {
        summary.querySelector('span').textContent = errors[keys[0]];
        summary.classList.add('show');
      }
      const first = panels[state.step].querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return false;
    }

    function collectValues() {
      panels.forEach((panel) => {
        U().qsa('input[name], select[name], textarea[name]', panel).forEach((input) => {
          if (input.type === 'checkbox') state.values[input.name] = input.checked;
          else if (input.type === 'file') { /* handled separately */ }
          else state.values[input.name] = input.value;
        });
      });
      state.values.images = imageStore.urls();
      return state.values;
    }

    U().qsa('input[name], select[name], textarea[name]', root).forEach((input) => {
      const evt = input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'radio' ? 'change' : 'input';
      input.addEventListener(evt, () => {
        state.values[input.name] = input.type === 'checkbox' ? input.checked : input.value;
        if (input.getAttribute('aria-invalid') === 'true') V().clearError(input);
        if (config.onChange) config.onChange(input, state);
      });
    });

    if (btnNext) btnNext.addEventListener('click', () => {
      if (!validateStep()) return;
      show(state.step + 1);
    });
    if (btnBack) btnBack.addEventListener('click', () => show(state.step - 1));
    if (btnSubmit) btnSubmit.addEventListener('click', async () => {
      if (state.submitting) return;              // guard: duplicate submissions
      if (!validateStep()) return;
      const values = collectValues();
      state.submitting = true;
      btnSubmit.disabled = true;
      const original = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Submitting...';
      try {
        await config.submit(values, state);
      } finally {
        state.submitting = false;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = original;
        U().refreshIcons(btnSubmit);
      }
    });

    show(0);
    bindUploadZone(root, () => { if (config.onImages) config.onImages(imageStore); });

    return { state, collectValues, show, validateStep, root };
  }

  /* ============================================================
     Case creation
     ============================================================ */
  function createLostReport(values, user) {
    const now = new Date().toISOString();
    const report = {
      id: U().generateCaseId('LF'),
      type: 'lost',
      ownerId: user.id,
      itemName: U().sanitizeInput(values.itemName),
      category: values.category,
      color: U().sanitizeInput(values.color || ''),
      brand: U().sanitizeInput(values.brand || ''),
      model: U().sanitizeInput(values.model || ''),
      features: U().sanitizeInput(values.features || ''),
      description: U().sanitizeInput(values.description),
      location: U().sanitizeInput(values.location),
      dateLost: values.dateLost,
      timeLost: values.timeLost || '',
      images: values.images || [],
      status: 'open',
      createdAt: now,
      updatedAt: now,
      custody: [{
        ts: now,
        actor: `${user.name} (${U().capitalize(user.role)})`,
        action: 'Report submitted',
        location: U().sanitizeInput(values.location),
        description: 'Lost report registered in CampusFind.',
      }],
    };
    S().addReport(report);

    S().addNotification({
      id: U().uid('n'), userId: user.id, type: 'report',
      title: 'Lost report published',
      message: `Your lost report ${report.id} for "${report.itemName}" is now live on the campus board.`,
      link: `item-details.html?id=${report.id}`, read: false, createdAt: now,
    });

    S().pushAudit({
      id: U().uid('a'), ts: now, userId: user.id, userName: user.name,
      action: 'Student submitted lost report', caseId: report.id, ip: '10.24.0.1', status: 'Success',
    });

    notifyMatches(report, user);
    return report;
  }

  function createFoundReport(values, user) {
    const now = new Date().toISOString();
    const report = {
      id: U().generateCaseId('FF'),
      type: 'found',
      finderId: user.id,
      ownerId: user.id,
      itemName: U().sanitizeInput(values.itemName),
      category: values.category,
      color: U().sanitizeInput(values.color || ''),
      brand: U().sanitizeInput(values.brand || ''),
      model: U().sanitizeInput(values.model || ''),
      features: U().sanitizeInput(values.features || ''),
      description: U().sanitizeInput(values.description),
      location: U().sanitizeInput(values.location),
      dateFound: values.dateFound,
      timeFound: values.timeFound || '',
      storageStatus: values.storageStatus || 'With Finder',
      /* Private fields — never exposed on public cards */
      privateInfo: {
        serial: U().sanitizeInput(values.serial || ''),
        marks: U().sanitizeInput(values.marks || ''),
        contents: U().sanitizeInput(values.contents || ''),
        deviceId: U().sanitizeInput(values.deviceId || ''),
      },
      images: values.images || [],
      status: 'available',
      createdAt: now,
      updatedAt: now,
      custody: [
        {
          ts: now,
          actor: `${user.name} (${U().capitalize(user.role)})`,
          action: 'Item reported',
          location: U().sanitizeInput(values.location),
          description: 'Found report registered in CampusFind.',
        },
        {
          ts: now,
          actor: `${user.name} (${U().capitalize(user.role)})`,
          action: 'Item received',
          location: values.storageStatus === 'With Finder' ? 'Finder custody' : U().sanitizeInput(values.location),
          description: `Storage status: ${values.storageStatus || 'With Finder'}.`,
        },
      ],
    };
    S().addReport(report);

    S().addNotification({
      id: U().uid('n'), userId: user.id, type: 'report',
      title: 'Found report published',
      message: `Thank you! Your found report ${report.id} for "${report.itemName}" is live and a QR tag is ready.`,
      link: `item-details.html?id=${report.id}`, read: false, createdAt: now,
    });

    S().pushAudit({
      id: U().uid('a'), ts: now, userId: user.id, userName: user.name,
      action: 'Student submitted found report', caseId: report.id, ip: '10.24.0.1', status: 'Success',
    });

    notifyMatches(report, user);
    return report;
  }

  /* Cross-notify owners of plausible matches (Smart Match ≥ threshold) */
  function notifyMatches(newReport, author) {
    const threshold = S().getSettings().matchThreshold || 70;
    const M = window.CF.matching;
    if (!M) return;

    if (newReport.type === 'lost') {
      const found = S().foundReports().filter((f) => f.finderId !== author.id && f.status !== 'archived');
      M.matchesForLost(newReport, found, { minScore: threshold, limit: 3 }).forEach((m) => {
        const message = `A "${m.found.itemName}" was found near ${m.found.location} with a ${m.score}% Smart Match Score.`;
        S().addNotification({
          id: U().uid('n'), userId: author.id, type: 'match',
          title: `Potential match found for your ${newReport.itemName.toLowerCase()}`,
          message,
          link: `item-details.html?id=${m.found.id}&from=${newReport.id}`, read: false, createdAt: new Date().toISOString(),
        });
      });
    } else {
      const lost = S().lostReports().filter((l) => l.ownerId !== author.id && l.status !== 'archived');
      M.matchesForFound(newReport, lost, { minScore: threshold, limit: 3 }).forEach((m) => {
        S().addNotification({
          id: U().uid('n'), userId: m.lost.ownerId, type: 'match',
          title: `Potential match found for your ${m.lost.itemName.toLowerCase()}`,
          message: `Your "${m.lost.itemName}" may have been found near ${newReport.location} (Smart Match ${m.score}%).`,
          link: `item-details.html?id=${newReport.id}&from=${m.lost.id}`, read: false, createdAt: new Date().toISOString(),
        });
      });
    }
  }

  /* ============================================================
     Page scaffolding: report-lost.html
     ============================================================ */
  function initLostWizard(root, user) {
    imageStore.reset();
    root.innerHTML = `
      <div class="page-head">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="dashboard.html">Dashboard</a><i data-lucide="chevron-right" aria-hidden="true"></i><span aria-current="page">Report lost item</span></nav>
          <h1>Report a lost item</h1>
          <p>The more specific the details, the higher your Smart Match Score when someone turns it in.</p>
        </div>
        <span class="badge badge-blue"><i data-lucide="save" aria-hidden="true"></i>Draft saves locally as you type</span>
      </div>

      <form class="card card-pad" data-wizard novalidate>
        <div class="wizard-head" data-wizard-head></div>
        <p class="visually-hidden" data-step-label aria-live="polite"></p>

        <!-- Step 1 -->
        <section class="wizard-panel active" data-step-panel>
          <h2>Item information</h2>
          <p class="panel-sub">Start with the basics. Use the name you would naturally search for.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field">
              <label for="lf-name">Item name <span class="req">*</span></label>
              <input class="input" id="lf-name" name="itemName" placeholder="e.g. Black Backpack" maxlength="90" autocomplete="off">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="lf-category">Category <span class="req">*</span></label>
              <select class="input" id="lf-category" name="category">
                <option value="">Select a category</option>${selectOptions(CATEGORIES)}
              </select>
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <!-- Step 2 -->
        <section class="wizard-panel" data-step-panel>
          <h2>Description</h2>
          <p class="panel-sub">Describe colour, brand and unique features so staff can verify claims confidently.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field">
              <label for="lf-desc">Description <span class="req">*</span></label>
              <textarea class="input" id="lf-desc" name="description" rows="4" maxlength="500" placeholder="e.g. Black Wildcraft backpack with a blue keychain and two textbooks inside..."></textarea>
              <span class="hint"><span data-count-for="description">0</span>/500 characters (minimum 10)</span>
              <span class="field-error"></span>
            </div>
            <div class="stack">
              <div class="field">
                <label for="lf-color">Colour</label>
                <input class="input" id="lf-color" name="color" placeholder="e.g. Black with blue accents" maxlength="40">
                <span class="field-error"></span>
              </div>
              <div class="field">
                <label for="lf-brand">Brand</label>
                <input class="input" id="lf-brand" name="brand" placeholder="e.g. Wildcraft" maxlength="40">
                <span class="field-error"></span>
              </div>
            </div>
            <div class="field">
              <label for="lf-model">Model</label>
              <input class="input" id="lf-model" name="model" placeholder="e.g. Hoodie 35L" maxlength="40">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="lf-features">Unique features</label>
              <input class="input" id="lf-features" name="features" placeholder="e.g. Torn zip pull, star keychain" maxlength="120">
              <span class="hint">These become verification clues.</span>
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <!-- Step 3 -->
        <section class="wizard-panel" data-step-panel>
          <h2>Location &amp; time</h2>
          <p class="panel-sub">Where and when did you last have it? Location carries 15% of the match score.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field span-2">
              <label for="lf-location">Campus location <span class="req">*</span></label>
              <select class="input" id="lf-location" name="location">
                <option value="">Select a campus location</option>${selectOptions(LOCATIONS)}
              </select>
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="lf-date">Date lost <span class="req">*</span></label>
              <input class="input" id="lf-date" name="dateLost" type="date" max="${U().todayISO()}">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="lf-time">Approximate time</label>
              <input class="input" id="lf-time" name="timeLost" type="time">
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <!-- Step 4 -->
        <section class="wizard-panel" data-step-panel>
          <h2>Images</h2>
          <p class="panel-sub">Add up to ${MAX_IMAGES} photos. JPEG, PNG or WEBP · max ${MAX_BYTES / (1024 * 1024)}MB each. Optional but recommended.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="upload-zone" data-upload-zone tabindex="0" role="button" aria-label="Upload images">
            <div class="u-ico"><i data-lucide="image-up" aria-hidden="true"></i></div>
            <b>Drag &amp; drop images here</b>
            <p>or click to browse — <span data-img-count>0 / ${MAX_IMAGES} images</span></p>
            <input type="file" data-image-input accept="image/jpeg,image/png,image/webp" multiple class="visually-hidden" tabindex="-1" aria-label="Upload item photos">
          </div>
          <div class="upload-previews" data-previews></div>
        </section>

        <!-- Step 5 -->
        <section class="wizard-panel" data-step-panel>
          <h2>Review &amp; submit</h2>
          <p class="panel-sub">Check everything below. You can go back to edit any step.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <dl class="review-list" data-review-holder></dl>
          <div class="callout callout-info mt-16">
            <i data-lucide="info" aria-hidden="true"></i>
            <div><b>What happens next</b>
            <p>Your case ID is generated on submission (LF-GU-YYYY-XXXXX). We automatically compare it with campus found items and notify you when a Smart Match Score crosses the threshold.</p></div>
          </div>
        </section>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-wizard-back style="display:none">
            <i data-lucide="arrow-left" aria-hidden="true"></i> Back
          </button>
          <button type="button" class="btn btn-primary" data-wizard-next>
            Continue <i data-lucide="arrow-right" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-primary btn-lg" data-wizard-submit style="display:none">
            <i data-lucide="send" aria-hidden="true"></i> Submit Lost Report
          </button>
        </div>
      </form>`;

    U().refreshIcons(root);
    bindCharCount(root);

    initWizard(root, {
      steps: ['Item Information', 'Description', 'Location', 'Images', 'Review'],
      validate(step, values) {
        if (step === 0) {
          return collectErrors({
            itemName: V().validateItemName(values.itemName),
            category: V().validateCategory(values.category),
          });
        }
        if (step === 1) {
          return collectErrors({ description: V().validateDescription(values.description) });
        }
        if (step === 2) {
          return collectErrors({
            location: V().validateLocation(values.location),
            dateLost: V().validateDate(values.dateLost, { label: 'Date lost' }),
            timeLost: values.timeLost ? V().validateTime(values.timeLost, { label: 'Time lost' }) : { valid: true },
          });
        }
        return {};
      },
      onStep(step, state) {
        if (step === 4) renderReview(root.querySelector('[data-review-holder]'), state.values, 'lost');
      },
      async submit(values) {
        const report = createLostReport(values, user);
        window.CF.ui.toast('success', `Report submitted successfully. Case ID ${report.id}`);
        setTimeout(() => { window.location.href = `item-details.html?id=${encodeURIComponent(report.id)}`; }, 900);
      },
    });
  }

  /* ============================================================
     Page scaffolding: report-found.html
     ============================================================ */
  function initFoundWizard(root, user) {
    imageStore.reset();
    root.innerHTML = `
      <div class="page-head">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="dashboard.html">Dashboard</a><i data-lucide="chevron-right" aria-hidden="true"></i><span aria-current="page">Report found item</span></nav>
          <h1>Report a found item</h1>
          <p>Thank you for helping a classmate. Private details stay hidden from the public listing.</p>
        </div>
        <span class="badge badge-green"><i data-lucide="qr-code" aria-hidden="true"></i>QR tag created automatically</span>
      </div>

      <form class="card card-pad" data-wizard novalidate>
        <div class="wizard-head" data-wizard-head></div>
        <p class="visually-hidden" data-step-label aria-live="polite"></p>

        <section class="wizard-panel active" data-step-panel>
          <h2>Item information</h2>
          <p class="panel-sub">Describe the item and when you found it.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field">
              <label for="ff-name">Item name <span class="req">*</span></label>
              <input class="input" id="ff-name" name="itemName" placeholder="e.g. Brown Leather Wallet" maxlength="90">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-category">Category <span class="req">*</span></label>
              <select class="input" id="ff-category" name="category">
                <option value="">Select a category</option>${selectOptions(CATEGORIES)}
              </select>
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-date">Date found <span class="req">*</span></label>
              <input class="input" id="ff-date" name="dateFound" type="date" max="${U().todayISO()}">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-time">Time found</label>
              <input class="input" id="ff-time" name="timeFound" type="time">
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel>
          <h2>Description</h2>
          <p class="panel-sub">Public description — do not include serial numbers here (next step is private).</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field span-2">
              <label for="ff-desc">Description <span class="req">*</span></label>
              <textarea class="input" id="ff-desc" name="description" rows="4" maxlength="500" placeholder="e.g. Brown leather wallet found near the canteen payment counter..."></textarea>
              <span class="hint"><span data-count-for="description">0</span>/500 characters (minimum 10)</span>
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-color">Colour</label>
              <input class="input" id="ff-color" name="color" placeholder="e.g. Brown" maxlength="40">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-brand">Brand</label>
              <input class="input" id="ff-brand" name="brand" placeholder="e.g. Horizon" maxlength="40">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-model">Model</label>
              <input class="input" id="ff-model" name="model" placeholder="e.g. Bi-fold" maxlength="40">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-features">Unique features</label>
              <input class="input" id="ff-features" name="features" placeholder="e.g. Scratch on lower-right corner" maxlength="120">
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel>
          <h2>Location &amp; storage</h2>
          <p class="panel-sub">Where did you find it, and where is it being kept right now?</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="form-grid">
            <div class="field span-2">
              <label for="ff-location">Location found <span class="req">*</span></label>
              <select class="input" id="ff-location" name="location">
                <option value="">Select a campus location</option>${selectOptions(LOCATIONS)}
              </select>
              <span class="field-error"></span>
            </div>
            <div class="field span-2">
              <label for="ff-storage">Storage status <span class="req">*</span></label>
              <select class="input" id="ff-storage" name="storageStatus">
                ${selectOptions(STORAGE_STATUSES)}
              </select>
              <span class="hint">If you selected "Handed to Security", take the item to the security desk so it is logged.</span>
              <span class="field-error"></span>
            </div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel>
          <h2>Images &amp; private details</h2>
          <p class="panel-sub">Private fields are never shown on public cards — only to the owner, staff and admins.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <div class="callout callout-warning mb-16">
            <i data-lucide="lock" aria-hidden="true"></i>
            <div><b>Private verification information</b>
            <p>Serial numbers, unique marks, personal contents and device IDs stay hidden until staff verify a claim.</p></div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="ff-serial">Serial number</label>
              <input class="input" id="ff-serial" name="serial" placeholder="e.g. WL-35L-77213" maxlength="60">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-marks">Unique marks</label>
              <input class="input" id="ff-marks" name="marks" placeholder="e.g. Scratch near the corner" maxlength="120">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-contents">Personal contents</label>
              <input class="input" id="ff-contents" name="contents" placeholder="e.g. Student ID and metro card" maxlength="160">
              <span class="field-error"></span>
            </div>
            <div class="field">
              <label for="ff-device">Device ID</label>
              <input class="input" id="ff-device" name="deviceId" placeholder="e.g. IMEI or asset tag" maxlength="60">
              <span class="field-error"></span>
            </div>
            <div class="field span-2">
              <label>Images (up to ${MAX_IMAGES})</label>
              <div class="upload-zone" data-upload-zone tabindex="0" role="button" aria-label="Upload images">
                <div class="u-ico"><i data-lucide="image-up" aria-hidden="true"></i></div>
                <b>Drag &amp; drop images here</b>
                <p>or click to browse — <span data-img-count>0 / ${MAX_IMAGES} images</span></p>
                <input type="file" data-image-input accept="image/jpeg,image/png,image/webp" multiple class="visually-hidden" tabindex="-1" aria-label="Upload item photos">
              </div>
              <div class="upload-previews" data-previews></div>
            </div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel>
          <h2>Review &amp; submit</h2>
          <p class="panel-sub">Confirm the details below before publishing to the campus board.</p>
          <div class="form-error-summary" role="alert"><i data-lucide="alert-circle" aria-hidden="true"></i><span></span></div>
          <dl class="review-list" data-review-holder></dl>
          <div class="callout callout-success mt-16">
            <i data-lucide="qr-code" aria-hidden="true"></i>
            <div><b>A QR code is generated automatically</b>
            <p>Your case page gets a printable QR tag (FF-GU-YYYY-XXXXX) so staff can scan and open the live record from storage.</p></div>
          </div>
        </section>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-wizard-back style="display:none">
            <i data-lucide="arrow-left" aria-hidden="true"></i> Back
          </button>
          <button type="button" class="btn btn-primary" data-wizard-next>
            Continue <i data-lucide="arrow-right" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-primary btn-lg" data-wizard-submit style="display:none">
            <i data-lucide="send" aria-hidden="true"></i> Submit Found Report
          </button>
        </div>
      </form>`;

    U().refreshIcons(root);
    bindCharCount(root);

    initWizard(root, {
      steps: ['Item Information', 'Description', 'Location', 'Images & Private', 'Review'],
      validate(step, values) {
        if (step === 0) {
          return collectErrors({
            itemName: V().validateItemName(values.itemName),
            category: V().validateCategory(values.category),
          });
        }
        if (step === 1) return collectErrors({ description: V().validateDescription(values.description) });
        if (step === 2) {
          return collectErrors({
            location: V().validateLocation(values.location),
            dateFound: V().validateDate(values.dateFound, { label: 'Date found' }),
            timeFound: values.timeFound ? V().validateTime(values.timeFound, { label: 'Time found' }) : { valid: true },
          });
        }
        return {};
      },
      onStep(step, state) {
        if (step === 4) renderReview(root.querySelector('[data-review-holder]'), state.values, 'found');
      },
      async submit(values) {
        const report = createFoundReport(values, user);
        window.CF.ui.toast('success', `Found report submitted. Case ID ${report.id}`);
        setTimeout(() => { window.location.href = `item-details.html?id=${encodeURIComponent(report.id)}`; }, 900);
      },
    });
  }

  /* ---------- helpers ---------- */
  function collectErrors(checks) {
    const out = {};
    Object.keys(checks).forEach((key) => {
      if (checks[key] && checks[key].valid === false) out[key] = checks[key].message;
    });
    return out;
  }

  function bindCharCount(root) {
    U().qsa('[data-count-for]', root).forEach((holder) => {
      const name = holder.getAttribute('data-count-for');
      const input = root.querySelector(`[name="${name}"]`);
      if (!input) return;
      input.addEventListener('input', () => {
        holder.textContent = String(input.value.length);
        holder.parentElement.classList.toggle('over', input.value.length > 500);
      });
    });
  }

  function renderReview(holder, values, type) {
    if (!holder) return;
    const rows = [
      ['Item name', values.itemName],
      ['Category', values.category],
      ['Description', values.description],
      ['Colour', values.color || '—'],
      ['Brand', values.brand || '—'],
      ['Model', values.model || '—'],
      ['Unique features', values.features || '—'],
      ['Location', values.location],
      [type === 'lost' ? 'Date lost' : 'Date found', values.dateLost || values.dateFound],
      ['Time', values.timeLost || values.timeFound ? U().formatTime12(values.timeLost || values.timeFound) : '—'],
    ];
    if (type === 'found') {
      rows.push(['Storage status', values.storageStatus || 'With Finder']);
      rows.push(['Private serial', values.serial ? `${U().sanitizeInput(values.serial).slice(0, 3)}•••• (hidden publicly)` : '—']);
      rows.push(['Private marks', values.marks || '—']);
      rows.push(['Private contents', values.contents || '—']);
      rows.push(['Device ID', values.deviceId || '—']);
    }
    rows.push(['Images', values.images && values.images.length ? `${values.images.length} attached` : 'None']);

    holder.innerHTML = rows.map(([label, value]) => `
      <div class="review-row">
        <dt>${U().escapeHtml(label)}</dt>
        <dd>${U().escapeHtml(String(value === undefined || value === null || value === '' ? '—' : value))}</dd>
      </div>`).join('');
  }

  window.CF.reports = {
    CATEGORIES, LOCATIONS, STORAGE_STATUSES, MAX_IMAGES, MAX_BYTES,
    imageStore, initWizard, selectOptions, renderPreviews, bindUploadZone,
    createLostReport, createFoundReport, notifyMatches,
    initLostWizard, initFoundWizard,
  };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits['report-lost'] = initLostWizard;
  window.CF.pageInits['report-found'] = initFoundWizard;
})();
