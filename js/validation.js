/* ============================================================
   CampusFind — validation.js
   Central form validation. Every validator returns
   { valid: boolean, message: string }. No inline validation
   logic lives in HTML.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  /* The college domain. Kept as a named constant because every placeholder, the
     sample accounts and the privacy policy all assume it. */
  const COLLEGE_DOMAIN = 'galgotiasuniversity.edu.in';
  /* Must anchor on the domain itself. An earlier version of this was
     /...@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, which matched ANY domain and made the
     collegeOnly branch unreachable — anyone could register with a gmail address. */
  const COLLEGE_EMAIL_RE = new RegExp('^[A-Za-z0-9._%+-]+@' + COLLEGE_DOMAIN.replace(/\./g, '\\.') + '$', 'i');
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  /* Galgotias University roll number: 24SCSE1010457
       2-digit admission year + 4-letter school code
       + 3-digit programme code + 4-digit serial  = 13 characters
   Employee number (staff / faculty / admin): a 4-5 letter
       prefix followed by a 4-digit year and a 4-digit serial,
       e.g. STSEC2019042, FASC2018088, ADMN2015001.
   Both are normalised to upper case and stripped of spaces
   before testing, so "24 scse 1010457" is accepted. */
  const ROLL_RE = /^\d{2}[A-Z]{4}\d{3}\d{4}$/;
  const EMP_RE = /^[A-Z]{4,5}\d{7}$/;
  const PHONE_RE = /^\+?[0-9\s\-()]{7,16}$/;

  const CATEGORIES = [
    'Electronics', 'Documents', 'Wallet', 'Keys', 'Bag',
    'Clothing', 'Jewellery', 'Accessories', 'Books', 'Other',
  ];
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
  const MAX_IMAGES = 5;
  const DESC_MIN = 10;
  const DESC_MAX = 500;
  const PASSWORD_MIN = 8;
  const PASSWORD_MAX = 64;

  const ok = () => ({ valid: true, message: '' });
  const fail = (message) => ({ valid: false, message });

  function validateEmail(value, options) {
    const email = String(value || '').trim();
    if (!email) return fail('Please enter your college email.');
    if (/\s/.test(email)) return fail('Email must not contain spaces.');
    if (!EMAIL_RE.test(email)) return fail('Please enter a valid email address.');
    if (options && options.collegeOnly && !COLLEGE_EMAIL_RE.test(email)) {
      return fail(`Please use your ${COLLEGE_DOMAIN} email address.`);
    }
    if (options && options.unique && options.userExists) {
      return fail('An account with this email already exists.');
    }
    return ok();
  }

  function validatePassword(value, options) {
    const pw = String(value || '');
    if (!pw) return fail('Please enter your password.');
    if (pw.length < PASSWORD_MIN) return fail(`Password must contain at least ${PASSWORD_MIN} characters.`);
    if (pw.length > PASSWORD_MAX) return fail(`Password must be at most ${PASSWORD_MAX} characters.`);
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      return fail('Password must include at least one letter and one number.');
    }
    if (options && options.match !== undefined && options.match !== null) {
      if (pw !== options.match) return fail('Passwords do not match.');
    }
    return ok();
  }

  function validateRequired(value, label) {
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === null || text === undefined || text === '' || (Array.isArray(text) && text.length === 0)) {
      return fail(`Please enter ${label || 'this field'}.`);
    }
    return ok();
  }

  function validateName(value) {
    const name = String(value || '').trim();
    if (!name) return fail('Please enter your full name.');
    if (name.length < 2) return fail('Full name must be at least 2 characters.');
    if (name.length > 80) return fail('Full name must be at most 80 characters.');
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return fail('Full name must contain only letters, spaces, hyphens and apostrophes.');
    return ok();
  }

  function validateCollegeId(value) {
    const id = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!id) return fail('Please enter your roll number or employee ID.');
    if (ROLL_RE.test(id) || EMP_RE.test(id)) return ok();
    if (/^\d{2}[A-Za-z]/.test(id)) {
      return fail('A roll number is 13 characters: year, school, programme and serial — e.g. 24SCSE1010457.');
    }
    return fail('Enter your roll number (e.g. 24SCSE1010457) or employee ID.');
  }

  function validatePhone(value) {
    const phone = String(value || '').trim();
    if (!phone) return ok(); // optional field
    if (!PHONE_RE.test(phone)) return fail('Please enter a valid phone number.');
    return ok();
  }

  function validateDescription(value) {
    const text = String(value === null || value === undefined ? '' : value).trim();
    const length = text.length;
    if (length === 0) return fail('Please provide a description.');
    if (length < DESC_MIN) return fail(`Description must be at least ${DESC_MIN} characters.`);
    if (length > DESC_MAX) return fail(`Description must be at most ${DESC_MAX} characters.`);
    return ok();
  }

  function validateDate(value, options) {
    const date = String(value || '');
    if (!date) return fail((options && options.label ? options.label : 'Date') + ' is required.');
    if (!DATE_RE.test(date)) return fail('Please enter a valid date (YYYY-MM-DD).');
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return fail('Please enter a valid date.');
    // Round-trip check rejects rolled-over calendar dates such as 2026-02-31
    const pad2 = (n) => String(n).padStart(2, '0');
    const roundTrip = `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    if (roundTrip !== date) return fail('Please enter a valid calendar date.');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (options && options.futureAllowed !== true && parsed > today) {
      return fail((options && options.label ? options.label : 'Date') + ' cannot be in the future.');
    }
    if (options && options.notBefore) {
      const floor = new Date(`${options.notBefore}T00:00:00`);
      if (parsed < floor) return fail(`Date cannot be before ${options.notBefore}.`);
    }
    return ok();
  }

  function validateTime(value, options) {
    const time = String(value || '');
    if (!time) return fail((options && options.label ? options.label : 'Time') + ' is required.');
    if (!TIME_RE.test(time)) return fail('Please enter a valid time (HH:MM).');
    return ok();
  }

  function validateCategory(value) {
    if (!value) return fail('Please select a category.');
    if (CATEGORIES.indexOf(value) === -1) return fail('Please select a valid category.');
    return ok();
  }

  function validateLocation(value) {
    const loc = String(value || '').trim();
    if (!loc) return fail('Please select or enter a campus location.');
    if (loc.length < 3) return fail('Location must be at least 3 characters.');
    if (loc.length > 80) return fail('Location must be at most 80 characters.');
    return ok();
  }

  function validateImage(file) {
    if (!file) return fail('Please choose an image.');
    if (IMAGE_TYPES.indexOf(String(file.type || '').toLowerCase()) === -1) {
      return fail('Only JPEG, PNG or WEBP images are allowed.');
    }
    return ok();
  }

  function validateFileSize(file, maxBytes) {
    if (!file) return fail('Please choose an image.');
    const limit = maxBytes || MAX_IMAGE_BYTES;
    if (file.size > limit) {
      return fail(`Image must be smaller than ${(limit / (1024 * 1024)).toFixed(0)}MB.`);
    }
    if (file.size === 0) return fail('The selected file is empty.');
    return ok();
  }

  function validateImageCount(images) {
    const list = Array.isArray(images) ? images : [];
    if (list.length === 0) return fail('Please add at least one image.');
    if (list.length > MAX_IMAGES) return fail(`You can upload a maximum of ${MAX_IMAGES} images.`);
    return ok();
  }

  /* Claim answers: 5 required questions, each 3–300 chars */
  function validateClaim(answers) {
    const data = answers || {};
    const questions = [
      ['color', 'What color was the item?'],
      ['brand', 'What brand/model was it?'],
      ['unique', 'Describe one unique feature.'],
      ['contents', 'What was inside the item?'],
      ['damage', 'Describe any damage or special marking.'],
    ];
    for (let i = 0; i < questions.length; i += 1) {
      const key = questions[i][0];
      const label = questions[i][1];
      const value = String(data[key] === undefined || data[key] === null ? '' : data[key]).trim();
      if (!value) return fail(`Please answer: ${label}`);
      if (value.length < 3) return fail(`Your answer to "${label}" is too short.`);
      if (value.length > 300) return fail(`Your answer to "${label}" must be at most 300 characters.`);
    }
    return ok();
  }

  function validateTerms(accepted) {
    if (!accepted) return fail('You must agree to the Terms and Privacy Policy.');
    return ok();
  }

  function validateItemName(value) {
    const name = String(value || '').trim();
    if (!name) return fail('Please enter the item name.');
    if (name.length < 3) return fail('Item name must be at least 3 characters.');
    if (name.length > 90) return fail('Item name must be at most 90 characters.');
    return ok();
  }

  /* Run a map of { field: validatorResult } and return summary */
  function collect(results) {
    const errors = {};
    let valid = true;
    Object.keys(results).forEach((key) => {
      const res = results[key];
      if (res && res.valid === false) {
        valid = false;
        errors[key] = res.message;
      }
    });
    return { valid, errors };
  }

  /* Display helpers */
  function showError(input, message) {
    if (!input) return;
    const field = input.closest('.field') || input.parentElement;
    const holder = field ? field.querySelector('.field-error') : null;
    input.setAttribute('aria-invalid', 'true');
    if (holder) {
      holder.innerHTML = `<i data-lucide="alert-circle" aria-hidden="true"></i><span>${window.CF.utils.escapeHtml(message)}</span>`;
      holder.classList.add('show');
      window.CF.utils.refreshIcons(holder);
    }
  }

  function clearError(input) {
    if (!input) return;
    const field = input.closest('.field') || input.parentElement;
    const holder = field ? field.querySelector('.field-error') : null;
    input.removeAttribute('aria-invalid');
    if (holder) {
      holder.classList.remove('show');
      holder.innerHTML = '';
    }
  }

  function clearAll(form) {
    if (!form) return;
    window.CF.utils.qsa('[aria-invalid="true"]', form).forEach(clearError);
    const summary = form.querySelector('.form-error-summary');
    if (summary) summary.classList.remove('show');
  }

  window.CF.validation = {
    CATEGORIES, IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES,
    COLLEGE_DOMAIN, EMAIL_RE, COLLEGE_EMAIL_RE,
    DESC_MIN, DESC_MAX, PASSWORD_MIN, PASSWORD_MAX,
    validateEmail, validatePassword, validateRequired, validateName,
    validateCollegeId, validatePhone, validateDescription, validateDate,
    validateTime, validateCategory, validateLocation, validateImage,
    validateFileSize, validateImageCount, validateClaim, validateTerms,
    validateItemName, collect, showError, clearError, clearAll,
  };
})();
