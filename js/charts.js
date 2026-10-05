// Thin wrapper over Chart.js: shared theme, P&L colours, lifecycle tracking.
import { getSettings } from './store.js';
import { money, num } from './ui.js';

const Chart = window.Chart;
const live = new Set();

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function palette() {
  const s = getSettings();
  const pos = s.pnlColors === 'blueorange' ? css('--cvd-pos') : css('--pnl-pos');
  const neg = s.pnlColors === 'blueorange' ? css('--cvd-neg') : css('--pnl-neg');
  return {
    series: [1, 2, 3, 4, 5, 6, 7, 8].map(i => css(`--series-${i}`)),
    pos, neg,
    ink: css('--text-2'), muted: css('--text-3'), grid: css('--grid'), axis: css('--axis'),
    surface: css('--surface'), accent: css('--series-1'), neutral: css('--neutral'),
  };
}
export const signColor = (v, p = palette()) => (v >= 0 ? p.pos : p.neg);

export function alpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function applyDefaults() {
  const p = palette();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = p.muted;
  Chart.defaults.borderColor = p.grid;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 250;
  Chart.defaults.transitions.resize = { animation: { duration: 0 } };
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.useBorderRadius = true;
  Chart.defaults.plugins.legend.labels.borderRadius = 2;
  Chart.defaults.plugins.legend.labels.color = p.ink;
  Chart.defaults.plugins.tooltip.backgroundColor = css('--tooltip-bg');
  Chart.defaults.plugins.tooltip.titleColor = css('--text-1');
  Chart.defaults.plugins.tooltip.bodyColor = css('--text-2');
  Chart.defaults.plugins.tooltip.borderColor = css('--border');
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.elements.point.hitRadius = 8;
  Chart.defaults.elements.bar.borderRadius = 3;
  Chart.defaults.elements.arc.borderColor = p.surface;
  Chart.defaults.elements.arc.borderWidth = 2;
}

export function destroyAll() { for (const c of live) c.destroy(); live.clear(); }

// Scale presets
export const moneyAxis = (extra = {}) => ({ grid: { color: palette().grid }, border: { display: false }, ticks: { callback: v => money(v, { compact: true }) }, ...extra });
export const plainAxis = (extra = {}) => ({ grid: { display: false }, border: { color: palette().axis }, ...extra });

export function make(canvas, config) {
  if (!canvas) return null;
  applyDefaults();
  const c = new Chart(canvas, config);
  live.add(c);
  return c;
}

// ------- ready-made chart shapes -------

// Line/area chart for money over time. series: [{label, data:[{x,y}], color, fill}]
export function moneyLine(canvas, { labels, series, zero = false, stepped = false, yExtra = {}, tooltipFmt }) {
  const p = palette();
  return make(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label, data: s.data,
        borderColor: s.color || p.series[i],
        backgroundColor: s.fill ? (typeof s.fill === 'string' ? s.fill : alpha(s.color || p.series[i], 0.12)) : 'transparent',
        fill: s.fill ? (s.fillTarget ?? 'origin') : false,
        tension: s.tension ?? 0.15,
        stepped,
        borderDash: s.dash || [],
        pointRadius: s.points ? 2 : labels.length <= 3 ? 4 : 0,
        segment: s.segment,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: series.length > 1, position: 'top', align: 'end' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${tooltipFmt ? tooltipFmt(ctx.parsed.y) : money(ctx.parsed.y)}` } },
      },
      scales: {
        x: plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }),
        y: moneyAxis({ beginAtZero: zero, ...yExtra }),
      },
    },
  });
}

// Bars coloured by sign. horizontal for category breakdowns.
export function signBars(canvas, { labels, values, horizontal = false, fmt = v => money(v), axisFmt = v => money(v, { compact: true }), extraTooltip, onClick }) {
  const p = palette();
  return make(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: values.map(v => signColor(v, p)), maxBarThickness: horizontal ? 18 : 28, borderSkipped: false, categoryPercentage: 0.8, barPercentage: 0.9 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      onClick: onClick ? (e, els) => els[0] && onClick(els[0].index) : undefined,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(horizontal ? ctx.parsed.x : ctx.parsed.y), afterLabel: extraTooltip ? ctx => extraTooltip(ctx.dataIndex) : undefined } },
      },
      scales: horizontal
        ? { x: { grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => axisFmt(v) } }, y: plainAxis({ ticks: { autoSkip: false } }) }
        : { x: plainAxis({ ticks: { maxRotation: 0, autoSkipPadding: 8 } }), y: { grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => axisFmt(v) } } },
    },
  });
}

// Single-series bars (magnitude, not sign) e.g. counts / histograms
export function plainBars(canvas, { labels, values, colors, fmt = v => num(v, 0), horizontal = false, label = '' }) {
  const p = palette();
  return make(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label, data: values, backgroundColor: colors || p.series[0], maxBarThickness: 32, categoryPercentage: 0.85, barPercentage: 0.92 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${label ? label + ': ' : ''}${fmt(horizontal ? ctx.parsed.x : ctx.parsed.y)}` } } },
      scales: horizontal
        ? { x: { grid: { color: p.grid }, border: { display: false }, beginAtZero: true, ticks: { callback: v => fmt(v) } }, y: plainAxis({ ticks: { autoSkip: false } }) }
        : { x: plainAxis({ ticks: { maxRotation: 0 } }), y: { grid: { color: p.grid }, border: { display: false }, beginAtZero: true, ticks: { callback: v => fmt(v), precision: 0 } } },
    },
  });
}

// Doughnut for part-to-whole. Items beyond `max` fold into "Other".
export function doughnut(canvas, { labels, values, colors, fmt = v => money(v), max = 7, center }) {
  const p = palette();
  let L = labels.slice(), V = values.slice(), C = colors ? colors.slice() : null;
  if (L.length > max) {
    const idx = V.map((v, i) => i).sort((a, b) => V[b] - V[a]);
    const keep = idx.slice(0, max - 1), rest = idx.slice(max - 1);
    const other = rest.reduce((s, i) => s + V[i], 0);
    L = [...keep.map(i => L[i]), 'Other']; V = [...keep.map(i => V[i]), other];
    C = C ? [...keep.map(i => C[i]), p.neutral] : null;
  }
  const total = V.reduce((a, b) => a + b, 0);
  return make(canvas, {
    type: 'doughnut',
    data: { labels: L, datasets: [{ data: V, backgroundColor: C || L.map((_, i) => p.series[i % 8]), hoverOffset: 4 }] },
    options: {
      cutout: '64%',
      plugins: {
        legend: { position: 'bottom', labels: { generateLabels: ch => Chart.overrides.doughnut.plugins.legend.labels.generateLabels(ch).map((l, i) => ({ ...l, text: `${l.text}  ${total ? Math.round((V[i] / total) * 100) : 0}%` })) } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} (${total ? ((ctx.parsed / total) * 100).toFixed(1) : 0}%)` } },
      },
    },
    plugins: center ? [{
      id: 'center',
      afterDraw(ch) {
        const { ctx } = ch; const a = ch.getDatasetMeta(0).data[0]; if (!a) return;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = css('--text-1'); ctx.font = `600 15px ${Chart.defaults.font.family}`;
        ctx.fillText(center.value, a.x, a.y - 7);
        ctx.fillStyle = css('--text-3'); ctx.font = `11px ${Chart.defaults.font.family}`;
        ctx.fillText(center.label, a.x, a.y + 11);
        ctx.restore();
      },
    }] : [],
  });
}

// Scatter (MAE/MFE etc). groups: [{label, color, points:[{x,y,meta}]}]
export function scatter(canvas, { groups, xLabel, yLabel, fmtX = v => num(v), fmtY = v => num(v), tip, refLines = [] }) {
  const p = palette();
  return make(canvas, {
    type: 'scatter',
    data: { datasets: groups.map(g => ({ label: g.label, data: g.points, backgroundColor: alpha(g.color, 0.7), borderColor: p.surface, borderWidth: 1, pointRadius: 4, pointHoverRadius: 6 })) },
    options: {
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: { callbacks: { label: ctx => ' ' + (tip ? tip(ctx.raw) : `${fmtX(ctx.parsed.x)}, ${fmtY(ctx.parsed.y)}`) } },
      },
      scales: {
        x: { title: { display: true, text: xLabel, color: p.muted }, grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => fmtX(v) } },
        y: { title: { display: true, text: yLabel, color: p.muted }, grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => fmtY(v) } },
      },
    },
    plugins: refLines.length ? [{
      id: 'ref',
      beforeDatasetsDraw(ch) {
        const { ctx, chartArea: a, scales } = ch;
        ctx.save(); ctx.strokeStyle = p.axis; ctx.lineWidth = 1;
        for (const r of refLines) {
          ctx.beginPath();
          if (r.x != null) { const x = scales.x.getPixelForValue(r.x); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); }
          if (r.y != null) { const y = scales.y.getPixelForValue(r.y); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); }
          if (r.diag) { const lo = Math.max(scales.x.min, scales.y.min), hi = Math.min(scales.x.max, scales.y.max); ctx.moveTo(scales.x.getPixelForValue(lo), scales.y.getPixelForValue(lo)); ctx.lineTo(scales.x.getPixelForValue(hi), scales.y.getPixelForValue(hi)); }
          ctx.stroke();
        }
        ctx.restore();
      },
    }] : [],
  });
}

// Tiny inline sparkline (no axes)
export function sparkline(canvas, values, color) {
  const p = palette();
  return make(canvas, {
    type: 'line',
    data: { labels: values.map((_, i) => i), datasets: [{ data: values, borderColor: color || p.accent, borderWidth: 1.5, fill: false, tension: 0.2 }] },
    options: { animation: false, events: [], plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } },
  });
}
