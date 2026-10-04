/* ============================================================
   CampusFind — matching.js
   Smart Match Score engine (rule-based, transparent weights).
   NOT machine learning — the label shown to users is
   "Smart Match Score". The API is deliberately isolated so a
   real ML service can replace calculateMatchScore() later
   (see MatchingEngine.score()).
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};

  /* Weights sum to 100 */
  const WEIGHTS = {
    category: 0.20,
    description: 0.30,
    color: 0.15,
    brand: 0.10,
    location: 0.15,
    date: 0.10,
  };

  const DEFAULT_THRESHOLD = 70;

  /* Campus locations mapped to zones for proximity scoring */
  const LOCATION_ZONES = {
    'central library': 'north', library: 'north', 'reading hall': 'north',
    'academic block a': 'academic', 'academic block b': 'academic',
    'academic block c': 'academic', 'seminar hall': 'academic',
    'computer lab 1': 'academic', 'computer lab 2': 'academic',
    'registrar office': 'admin', 'admin block': 'admin', 'health centre': 'admin',
    'canteen': 'central', 'food court': 'central', 'student centre': 'central',
    'hostel block a': 'hostel', 'hostel block b': 'hostel', 'hostel block c': 'hostel',
    'hostel reception': 'hostel', 'mess': 'hostel',
    'sports complex': 'sports', 'gymnasium': 'sports', 'basketball court': 'sports',
    'tennis court': 'sports', 'swimming pool': 'sports',
    'auditorium': 'south', 'auditorium lawn': 'south',
    'bus stop': 'gate', 'main gate': 'gate', 'parking': 'gate', 'parking lot': 'gate',
  };

  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for',
    'with', 'my', 'is', 'it', 'this', 'that', 'near', 'found', 'lost', 'was', 'by',
  ]);

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(text) {
    return normalize(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  /* ---------- Text similarity (Dice coefficient on token bigrams) ---------- */
  function calculateTextSimilarity(a, b) {
    const textA = normalize(a);
    const textB = normalize(b);
    if (!textA && !textB) return 0;
    if (textA === textB) return 100;
    if (!textA || !textB) return 0;

    const setA = new Set(tokens(a));
    const setB = new Set(tokens(b));
    if (setA.size === 0 || setB.size === 0) return 0;

    // Word overlap (Jaccard-like recall against the smaller set)
    let shared = 0;
    setA.forEach((w) => { if (setB.has(w)) shared += 1; });
    const wordScore = (shared * 2) / (setA.size + setB.size);

    // Bigram overlap captures word order / phrases
    const gramsA = bigrams(textA);
    const gramsB = bigrams(textB);
    let gramShared = 0;
    gramsA.forEach((g) => { if (gramsB.has(g)) gramShared += 1; });
    const gramScore = gramsA.size && gramsB.size
      ? (gramShared * 2) / (gramsA.size + gramsB.size)
      : 0;

    const score = (wordScore * 0.6) + (gramScore * 0.4);
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }

  function bigrams(text) {
    const words = text.split(' ').filter(Boolean);
    const set = new Set();
    for (let i = 0; i < words.length - 1; i += 1) set.add(`${words[i]} ${words[i + 1]}`);
    if (words.length === 1 && words[0]) set.add(words[0]);
    return set;
  }

  /* ---------- Location scoring ---------- */
  function zoneOf(location) {
    const key = normalize(location);
    if (LOCATION_ZONES[key]) return LOCATION_ZONES[key];
    const partial = Object.keys(LOCATION_ZONES).find((k) => key.includes(k) || k.includes(key));
    return partial ? LOCATION_ZONES[partial] : null;
  }

  function calculateLocationScore(locA, locB) {
    const a = normalize(locA);
    const b = normalize(locB);
    if (!a || !b) return 40; // unknown location → neutral
    if (a === b) return 100;

    const zoneA = zoneOf(a);
    const zoneB = zoneOf(b);
    if (zoneA && zoneB && zoneA === zoneB) return 80;

    // Shared word (e.g. "Central Library Reading Hall" vs "Central Library")
    const wordsA = new Set(tokens(a));
    const wordsB = new Set(tokens(b));
    let shared = 0;
    wordsA.forEach((w) => { if (wordsB.has(w)) shared += 1; });
    if (shared > 0) {
      const overlap = (shared * 2) / (wordsA.size + wordsB.size);
      return Math.round(55 + overlap * 25); // 55–80
    }
    return 25;
  }

  /* ---------- Date scoring (exponential decay by day gap) ---------- */
  function daysApart(dateA, dateB) {
    const dA = new Date(`${String(dateA).slice(0, 10)}T00:00:00`);
    const dB = new Date(`${String(dateB).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dA.getTime()) || Number.isNaN(dB.getTime())) return null;
    return Math.abs(dA.getTime() - dB.getTime()) / 86400000;
  }

  function calculateDateScore(dateA, dateB) {
    const gap = daysApart(dateA, dateB);
    if (gap === null) return 40;
    if (gap === 0) return 100;
    if (gap <= 1) return 95;
    if (gap <= 3) return 85;
    if (gap <= 7) return 70;
    if (gap <= 14) return 55;
    if (gap <= 30) return 35;
    return 15;
  }

  /* ---------- Attribute scoring (color / brand / model) ---------- */
  function calculateAttributeScore(attrA, attrB) {
    const a = normalize(attrA);
    const b = normalize(attrB);
    if (!a && !b) return 50;     // neither specified → neutral
    if (!a || !b) return 55;     // only one specified → slight lean
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 85;

    const wordsA = new Set(tokens(a));
    const wordsB = new Set(tokens(b));
    let shared = 0;
    wordsA.forEach((w) => { if (wordsB.has(w)) shared += 1; });
    if (shared === 0) return 25;
    const overlap = (shared * 2) / (wordsA.size + wordsB.size);
    return Math.round(50 + overlap * 35);
  }

  /* ---------- Category scoring ---------- */
  function categoryScore(catA, catB) {
    const a = normalize(catA);
    const b = normalize(catB);
    if (!a || !b) return 40;
    if (a === b) return 100;
    const GROUPS = [
      ['electronics', 'books'],
      ['bag', 'accessories'],
      ['documents', 'wallet'],
      ['clothing', 'accessories'],
    ];
    for (let i = 0; i < GROUPS.length; i += 1) {
      if (GROUPS[i].includes(a) && GROUPS[i].includes(b)) return 60;
    }
    return 20;
  }

  /* ---------- Main score ---------- */
  function calculateMatchScore(lostReport, foundItem) {
    if (!lostReport || !foundItem) {
      return { score: 0, breakdown: { category: 0, description: 0, color: 0, brand: 0, location: 0, date: 0 }, reasons: [] };
    }

    const category = categoryScore(lostReport.category, foundItem.category);
    const description = calculateTextSimilarity(
      `${lostReport.itemName || ''} ${lostReport.description || ''} ${lostReport.features || ''}`,
      `${foundItem.itemName || ''} ${foundItem.description || ''} ${foundItem.features || ''}`
    );
    const color = calculateAttributeScore(lostReport.color, foundItem.color);
    const brand = calculateAttributeScore(
      `${lostReport.brand || ''} ${lostReport.model || ''}`,
      `${foundItem.brand || ''} ${foundItem.model || ''}`
    );
    const location = calculateLocationScore(lostReport.location, foundItem.location);
    const date = calculateDateScore(
      lostReport.dateLost || lostReport.createdAt,
      foundItem.dateFound || foundItem.createdAt
    );

    const breakdown = { category, description, color, brand, location, date };
    const score = Math.round(
      category * WEIGHTS.category +
      description * WEIGHTS.description +
      color * WEIGHTS.color +
      brand * WEIGHTS.brand +
      location * WEIGHTS.location +
      date * WEIGHTS.date
    );

    return { score: Math.max(0, Math.min(100, score)), breakdown, reasons: buildReasons(breakdown, lostReport, foundItem) };
  }

  function buildReasons(b, lost, found) {
    const reasons = [];
    if (b.category >= 90) reasons.push('Same category');
    else if (b.category >= 60) reasons.push('Related category');
    if (b.description >= 70) reasons.push('Similar description');
    else if (b.description >= 45) reasons.push('Some shared details');
    if (b.color >= 85) reasons.push('Matching colour');
    if (b.brand >= 85) reasons.push('Matching brand/model');
    if (b.location >= 90) reasons.push('Same location');
    else if (b.location >= 75) reasons.push('Nearby location');
    if (b.date >= 85) reasons.push('Similar date');
    else if (b.date >= 65) reasons.push('Close dates');
    if (lost.category === found.category && b.category === 100 && reasons.length === 0) {
      reasons.push('Same category');
    }
    return reasons;
  }

  /* ---------- Candidate finder ---------- */
  function findPotentialMatches(lostList, foundList, options) {
    const opts = options || {};
    const minScore = opts.minScore || 50;
    const limit = opts.limit || 10;
    const results = [];
    (lostList || []).forEach((lost) => {
      if (lost.status === 'archived' || lost.status === 'resolved') return;
      (foundList || []).forEach((found) => {
        if (found.status === 'archived' || found.status === 'returned') return;
        const match = calculateMatchScore(lost, found);
        if (match.score >= minScore) {
          results.push({ lost, found, score: match.score, breakdown: match.breakdown, reasons: match.reasons });
        }
      });
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /* Matches relevant to one lost report */
  function matchesForLost(lostReport, foundList, options) {
    const opts = options || {};
    return findPotentialMatches([lostReport], foundList, opts);
  }

  /* Matches relevant to one found report (for its detail page) */
  function matchesForFound(foundReport, lostList, options) {
    const opts = options || {};
    const results = [];
    (lostList || []).forEach((lost) => {
      const match = calculateMatchScore(lost, foundReport);
      if (match.score >= (opts.minScore || 50)) {
        results.push({ lost, found: foundReport, score: match.score, breakdown: match.breakdown, reasons: match.reasons });
      }
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.limit || 6);
  }

  window.CF.matching = {
    WEIGHTS, DEFAULT_THRESHOLD,
    calculateMatchScore, calculateTextSimilarity, calculateLocationScore,
    calculateDateScore, calculateAttributeScore, categoryScore,
    findPotentialMatches, matchesForLost, matchesForFound,
    normalize, tokens, zoneOf,
  };
})();
