/* ============================================================
   CampusFind — analytics.js
   Chart.js dashboards: reports over time, lost vs found,
   recovery rate, reports by category and location.
   ============================================================ */
(function () {
  'use strict';

  window.CF = window.CF || {};
  const S = () => window.CF.storage;
  const U = () => window.CF.utils;

  const charts = [];

  function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    const token = (name, fallback) => (styles.getPropertyValue(name).trim() || fallback);
    return {
      text: token('--text-secondary', '#4A4A4A'),
      grid: token('--border', '#E4E4E4'),
      surface: token('--surface', '#FFFFFF'),
      primary: token('--ul-primary', '#BC1820'),
      success: token('--ul-emerald', '#1F7A4D'),
      danger: token('--ul-rose', '#BC1820'),
      warning: token('--ul-amber', '#B8860B'),
      info: token('--ul-indigo', '#BC1820'),
      violet: token('--ul-primary-deep', '#8E1218'),
    };
  }

  function destroyAll() {
    charts.forEach((c) => { try { c.destroy(); } catch (e) { /* noop */ } });
    charts.length = 0;
  }

  function baseOptions(colors, extra) {
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, titleFont: { size: 13 }, bodyFont: { size: 12.5 } },
      },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 11.5 } }, grid: { color: 'transparent' }, border: { display: false } },
        y: { ticks: { color: colors.text, font: { size: 11.5 }, precision: 0 }, grid: { color: colors.grid }, border: { display: false } },
      },
    }, extra || {});
  }

  function mount(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || !window.Chart) return null;
    return el.getContext('2d');
  }

  /* ---------- Helpers over the current dataset ---------- */
  function weeksSeries(reports, weeks) {
    const labels = [];
    const lostData = [];
    const foundData = [];
    const total = weeks || 8;
    for (let i = total - 1; i >= 0; i -= 1) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      labels.push(start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      const inRange = (r) => {
        const ts = new Date(r.createdAt).getTime();
        return ts >= start.getTime() && ts <= end.getTime();
      };
      lostData.push(reports.filter((r) => r.type === 'lost' && inRange(r)).length);
      foundData.push(reports.filter((r) => r.type === 'found' && inRange(r)).length);
    }
    return { labels, lostData, foundData };
  }

  function countBy(list, keyFn, limit) {
    const map = {};
    list.forEach((item) => {
      const key = keyFn(item) || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return limit ? entries.slice(0, limit) : entries;
  }

  /* ---------- Admin overview charts ---------- */
  function renderAdminOverview(data) {
    if (!window.Chart) {
      markChartFallback();
      return;
    }
    destroyAll();
    const colors = themeColors();
    const reports = data.reports || S().reports();
    const series = weeksSeries(reports, 8);

    const timeCtx = mount('chart-reports-time');
    if (timeCtx) {
      charts.push(new window.Chart(timeCtx, {
        type: 'line',
        data: {
          labels: series.labels,
          datasets: [
            { label: 'Lost reports', data: series.lostData, borderColor: colors.danger, backgroundColor: 'rgba(220,38,38,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: colors.danger },
            { label: 'Found reports', data: series.foundData, borderColor: colors.success, backgroundColor: 'rgba(22,163,74,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: colors.success },
          ],
        },
        options: baseOptions(colors),
      }));
    }

    const lfCtx = mount('chart-lost-found');
    if (lfCtx) {
      const lost = reports.filter((r) => r.type === 'lost').length;
      const found = reports.filter((r) => r.type === 'found').length;
      charts.push(new window.Chart(lfCtx, {
        type: 'doughnut',
        data: {
          labels: ['Lost reports', 'Found reports'],
          datasets: [{ data: [lost, found], backgroundColor: [colors.danger, colors.success], borderColor: colors.surface, borderWidth: 3, hoverOffset: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: { legend: { position: 'bottom', labels: { color: colors.text, usePointStyle: true, boxWidth: 8, padding: 16 } } },
        },
      }));
    }

    const catCtx = mount('chart-categories');
    if (catCtx) {
      const cats = countBy(reports, (r) => r.category, 7);
      charts.push(new window.Chart(catCtx, {
        type: 'bar',
        data: {
          labels: cats.map((c) => c[0]),
          datasets: [{ label: 'Reports', data: cats.map((c) => c[1]), backgroundColor: colors.primary, borderRadius: 6, maxBarThickness: 34 }],
        },
        options: baseOptions(colors, { plugins: { legend: { display: false } } }),
      }));
    }
  }

  /* ---------- Full analytics page ---------- */
  function renderAnalyticsPage() {
    if (!window.Chart) { markChartFallback(); return; }
    destroyAll();
    const colors = themeColors();
    const reports = S().reports();
    const claims = S().claims();
    const users = S().users();

    const kpis = countBy(reports, () => 'total');
    const recovered = reports.filter((r) => r.status === 'returned').length + claims.filter((c) => c.status === 'ITEM_RETURNED').length;
    const foundTotal = reports.filter((r) => r.type === 'found').length || 1;
    const recoveryRate = Math.round((recovered / foundTotal) * 100);

    const kpiRoot = document.querySelector('[data-analytics-kpis]');
    if (kpiRoot) {
      kpiRoot.innerHTML = [
        kpi('Total reports', kpis[0] ? kpis[0][1] : reports.length, 'clipboard-list', 'blue', `${reports.filter((r) => r.type === 'lost').length} lost · ${reports.filter((r) => r.type === 'found').length} found`),
        kpi('Recovery rate', `${recoveryRate}%`, 'trending-up', 'green', `${recovered} items recovered`),
        kpi('Registered users', users.length, 'users', 'violet', `${users.filter((u) => u.status === 'active').length} active`),
        kpi('Claims resolved', claims.filter((c) => ['APPROVED', 'REJECTED', 'ITEM_RETURNED'].indexOf(c.status) !== -1).length, 'file-check-2', 'amber', `${claims.length} claims total`),
      ].join('');
      U().refreshIcons(kpiRoot);
    }

    const series = weeksSeries(reports, 8);
    const timeCtx = mount('chart-a-time');
    if (timeCtx) {
      charts.push(new window.Chart(timeCtx, {
        type: 'bar',
        data: {
          labels: series.labels,
          datasets: [
            { label: 'Lost', data: series.lostData, backgroundColor: colors.danger, borderRadius: 5, maxBarThickness: 26 },
            { label: 'Found', data: series.foundData, backgroundColor: colors.success, borderRadius: 5, maxBarThickness: 26 },
          ],
        },
        options: baseOptions(colors),
      }));
    }

    const lfCtx = mount('chart-a-lf');
    if (lfCtx) {
      charts.push(new window.Chart(lfCtx, {
        type: 'doughnut',
        data: {
          labels: ['Lost', 'Found'],
          datasets: [{ data: [reports.filter((r) => r.type === 'lost').length, reports.filter((r) => r.type === 'found').length], backgroundColor: [colors.danger, colors.success], borderColor: colors.surface, borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom', labels: { color: colors.text, usePointStyle: true, boxWidth: 8, padding: 14 } } } },
      }));
    }

    const rateCtx = mount('chart-a-rate');
    if (rateCtx) {
      charts.push(new window.Chart(rateCtx, {
        type: 'doughnut',
        data: {
          labels: ['Recovered', 'Still open'],
          datasets: [{ data: [recovered, Math.max(0, foundTotal - recovered)], backgroundColor: [colors.success, colors.grid], borderColor: colors.surface, borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'bottom', labels: { color: colors.text, usePointStyle: true, boxWidth: 8, padding: 14 } } } },
      }));
    }

    const rateHolder = document.querySelector('[data-recovery-ring]');
    if (rateHolder) rateHolder.innerHTML = `<div class="rate-ring" style="--pct:${recoveryRate}" role="img" aria-label="${recoveryRate} percent recovery rate">
      <div class="rr-inner"><b>${recoveryRate}%</b><span>Recovery rate</span></div></div>`;

    const catCtx = mount('chart-a-cat');
    if (catCtx) {
      const cats = countBy(reports, (r) => r.category, 8);
      charts.push(new window.Chart(catCtx, {
        type: 'bar',
        data: {
          labels: cats.map((c) => c[0]),
          datasets: [{ label: 'Reports', data: cats.map((c) => c[1]), backgroundColor: colors.primary, borderRadius: 6, maxBarThickness: 30 }],
        },
        options: Object.assign(baseOptions(colors), { indexAxis: 'y', plugins: { legend: { display: false } } }),
      }));
    }

    const locCtx = mount('chart-a-loc');
    if (locCtx) {
      const locs = countBy(reports, (r) => r.location, 8);
      charts.push(new window.Chart(locCtx, {
        type: 'polarArea',
        data: {
          labels: locs.map((l) => l[0]),
          datasets: [{ data: locs.map((l) => l[1]), backgroundColor: [
            'rgba(37,99,235,0.75)', 'rgba(22,163,74,0.75)', 'rgba(245,158,11,0.75)',
            'rgba(14,165,233,0.75)', 'rgba(124,58,237,0.75)', 'rgba(220,38,38,0.75)',
            'rgba(20,184,166,0.75)', 'rgba(100,116,139,0.75)',
          ], borderColor: colors.surface, borderWidth: 2 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: colors.text, usePointStyle: true, boxWidth: 8, font: { size: 11.5 } } } },
          scales: { r: { grid: { color: colors.grid }, ticks: { display: false } } },
        },
      }));
    }

    // Top categories / locations tables
    const topCat = document.querySelector('[data-top-categories]');
    if (topCat) {
      topCat.innerHTML = countBy(reports, (r) => r.category, 6).map((c, i) => `
        <div class="recent-row">
          <span class="avatar avatar-sm" style="background:var(--surface-2);color:var(--text-secondary)">${i + 1}</span>
          <span class="r-body"><b>${U().escapeHtml(c[0])}</b></span>
          <span class="badge badge-blue">${c[1]}</span>
        </div>`).join('');
    }
    const topLoc = document.querySelector('[data-top-locations]');
    if (topLoc) {
      topLoc.innerHTML = countBy(reports, (r) => r.location, 6).map((c, i) => `
        <div class="recent-row">
          <span class="avatar avatar-sm" style="background:var(--surface-2);color:var(--text-secondary)">${i + 1}</span>
          <span class="r-body"><b>${U().escapeHtml(c[0])}</b><span>reports</span></span>
          <span class="badge badge-green">${c[1]}</span>
        </div>`).join('');
    }
  }

  function kpi(label, value, iconName, tone, sub) {
    return `<article class="stat-card">
      <div><div class="s-label">${label}</div><div class="s-value">${value}</div><div class="s-sub">${sub}</div></div>
      <span class="s-ico ${tone}"><i data-lucide="${iconName}" aria-hidden="true"></i></span>
    </article>`;
  }

  function markChartFallback() {
    U().qsa('.chart-box').forEach((box) => {
      if (box.querySelector('.chart-fallback')) return;
      box.innerHTML = `<div class="chart-fallback" style="height:100%;display:grid;place-items:center;text-align:center;padding:20px;border:1px dashed var(--border-strong);border-radius:12px;color:var(--text-muted)">
        <div><i data-lucide="bar-chart-3" aria-hidden="true" style="width:32px;height:32px;margin:0 auto 10px"></i>
        <p class="text-sm">Charts could not load. The Chart.js CDN is unreachable — check your connection. The tables below still show the same data.</p></div>
      </div>`;
      U().refreshIcons(box);
    });
  }

  window.CF.analytics = { renderAdminOverview, renderAnalyticsPage, destroyAll, countBy, weeksSeries };

  window.CF.pageInits = window.CF.pageInits || {};
  window.CF.pageInits['admin-analytics'] = renderAnalyticsPage;
})();
