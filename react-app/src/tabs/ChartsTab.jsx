import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Chart } from 'chart.js/auto';
import { motion } from 'framer-motion';
import { FILLERS } from '../lib/constants';
import { secToMmSs } from '../lib/format';
import { getChartDataByRole, applyFilters } from '../lib/chartData';
import { FILLER_COLORS, CATS, CAT_COLORS, CAT_GREEN, CAT_RED, boxStats } from '../lib/chartHelpers';
import { loadFromSheets } from '../lib/googleSheets';

function StatGrid({ stats }) {
  return (
    <div className="stat-grid">
      {stats.map((s, i) => (
        <motion.div
          className="stat-box" key={i}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25, delay: i * 0.03 }}
        >
          <div className="stat-val" style={{ fontSize: String(s.v).length > (s.small ? 6 : 8) ? (s.small ? 15 : 12) : 22 }}>{s.v}</div>
          <div className="stat-lbl">{s.l}</div>
        </motion.div>
      ))}
    </div>
  );
}

function MultiSelectDropdown({ label, plural, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const allChecked = selected.length === 0;
  const displayLabel = allChecked ? `All ${plural}` : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  const toggleAll = () => onChange([]);
  const toggleOne = (name) => {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    onChange(next.length === options.length ? [] : next);
  };

  return (
    <div className="fg" style={{ maxWidth: 175, position: 'relative' }} ref={ref}>
      <span className="fl">{label}</span>
      <div className="fs" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 11px', height: 35, userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}>
        <span>{displayLabel}</span><span style={{ fontSize: 10 }}>▾</span>
      </div>
      {open && (
        <div style={{ display: 'block', position: 'absolute', top: 58, left: 0, right: 0, background: 'white', border: '1.5px solid var(--maroon)', borderRadius: 'var(--radius)', zIndex: 50, padding: 8, boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 2px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} /> All {plural}
          </label>
          {options.map((name) => (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 2px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggleOne(name)} /> {name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChartsTab({ history, gsEndpoint, setGsEndpoint }) {
  const [viewMode, setViewMode] = useState('both');
  const [selSpeakers, setSelSpeakers] = useState([]);
  const [selCats, setSelCats] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sheetsData, setSheetsData] = useState([]);
  const [loadStatus, setLoadStatus] = useState(null);

  const radarRef = useRef(null), ahLineRef = useRef(null), boxPlotRef = useRef(null), onTimeRef = useRef(null);
  const chartsRef = useRef({});

  const ahAll = useMemo(() => getChartDataByRole(history, sheetsData, 'ah'), [history, sheetsData]);
  const timerAll = useMemo(() => getChartDataByRole(history, sheetsData, 'timer'), [history, sheetsData]);
  const allSpeakers = useMemo(() => [...new Set([...ahAll, ...timerAll].map((r) => r.speaker))].sort(), [ahAll, timerAll]);
  const allDates = useMemo(() => [...ahAll, ...timerAll].map((r) => r.date).filter(Boolean).sort(), [ahAll, timerAll]);

  const filterOpts = { speakers: selSpeakers, cats: selCats, dateFrom, dateTo };
  const ahRaw = useMemo(() => applyFilters(ahAll, filterOpts), [ahAll, selSpeakers, selCats, dateFrom, dateTo]);
  const timerRaw = useMemo(() => applyFilters(timerAll, filterOpts), [timerAll, selSpeakers, selCats, dateFrom, dateTo]);

  const destroy = (id) => { if (chartsRef.current[id]) { chartsRef.current[id].destroy(); delete chartsRef.current[id]; } };

  // ── Ah Counter charts ──
  const ahStats = useMemo(() => {
    const grandTotal = ahRaw.reduce((s, r) => s + (r.total || 0), 0);
    const sessions = [...new Set(ahRaw.map((r) => r.date))].length;
    const speakers = [...new Set(ahRaw.map((r) => r.speaker))];
    const avgPerSpMtg = speakers.length && sessions ? (grandTotal / (speakers.length * sessions)).toFixed(1) : '--';
    const topFiller = FILLERS.reduce((a, f) => {
      const n = ahRaw.reduce((s, r) => s + (r.counts[f] || 0), 0);
      return n > a.n ? { f, n } : a;
    }, { f: '--', n: 0 });
    let mostImproved = '--', bestDrop = 0;
    speakers.forEach((sp) => {
      const apps = ahRaw.filter((r) => r.speaker === sp).sort((a, b) => (a.date > b.date ? 1 : -1));
      if (apps.length < 2) return;
      const drop = apps[0].total - apps[apps.length - 1].total;
      if (drop > bestDrop) { bestDrop = drop; mostImproved = sp + ' (−' + drop + ')'; }
    });
    const meetingDates = [...new Set(ahRaw.map((r) => r.date))].sort();
    let trend = '--';
    if (meetingDates.length >= 4) {
      const half = Math.floor(meetingDates.length / 2);
      const ra = meetingDates.slice(-half).reduce((s, d) => s + ahRaw.filter((r) => r.date === d).reduce((a, r) => a + r.total, 0), 0) / half;
      const oa = meetingDates.slice(0, half).reduce((s, d) => s + ahRaw.filter((r) => r.date === d).reduce((a, r) => a + r.total, 0), 0) / half;
      trend = ra < oa ? '↓ Improving' : ra > oa ? '↑ More fillers' : '→ Stable';
    }
    return [
      { v: grandTotal, l: 'Total Fillers' }, { v: speakers.length, l: 'Speakers' },
      { v: sessions, l: 'Meetings' }, { v: avgPerSpMtg, l: 'Avg / speaker / meeting' },
      { v: topFiller.n ? topFiller.f : '--', l: 'Most common' },
      { v: mostImproved, l: 'Most improved' }, { v: trend, l: 'Trend' },
    ];
  }, [ahRaw]);

  const timerStats = useMemo(() => {
    const sessions = [...new Set(timerRaw.map((r) => r.date))].length;
    const speakers = [...new Set(timerRaw.map((r) => r.speaker))];
    const withinCount = timerRaw.filter((r) => r.within).length;
    const avgElapsed = timerRaw.length ? Math.round(timerRaw.reduce((s, r) => s + (r.elapsed || 0), 0) / timerRaw.length) : 0;
    return [
      { v: timerRaw.length, l: 'Total speeches' }, { v: speakers.length, l: 'Speakers' },
      { v: sessions, l: 'Meetings' }, { v: withinCount + '/' + timerRaw.length, l: 'Within time' },
      { v: timerRaw.length ? Math.round(withinCount / timerRaw.length * 100) + '%' : '--', l: 'On-time rate' },
      { v: secToMmSs(avgElapsed), l: 'Avg actual time' },
    ];
  }, [timerRaw]);

  useEffect(() => {
    if (viewMode !== 'ah' && viewMode !== 'both') { destroy('radar'); destroy('ahLine'); return; }
    const speakers = [...new Set(ahRaw.map((r) => r.speaker))];
    const speakersByTotal = [...speakers].sort((a, b) =>
      FILLERS.reduce((s, f) => s + ahRaw.filter((r) => r.speaker === b).reduce((a2, r) => a2 + (r.counts[f] || 0), 0), 0)
      - FILLERS.reduce((s, f) => s + ahRaw.filter((r) => r.speaker === a).reduce((a2, r) => a2 + (r.counts[f] || 0), 0), 0));

    destroy('radar');
    chartsRef.current.radar = new Chart(radarRef.current, {
      type: 'bar',
      data: {
        labels: speakersByTotal,
        datasets: FILLERS.map((f) => ({
          label: f,
          data: speakersByTotal.map((sp) => ahRaw.filter((r) => r.speaker === sp).reduce((s, r) => s + (r.counts[f] || 0), 0)),
          backgroundColor: FILLER_COLORS[f],
          borderRadius: 2, borderSkipped: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + ctx.parsed.x } } },
        scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e1e0d9' } },
          y: { stacked: true, ticks: { font: { size: 11 } } } },
      },
    });

    const meetingDates = [...new Set(ahRaw.map((r) => r.date))].sort();
    const vals = meetingDates.map((d) => ahRaw.filter((r) => r.date === d).reduce((s, r) => s + r.total, 0));
    destroy('ahLine');
    chartsRef.current.ahLine = new Chart(ahLineRef.current, {
      type: 'line',
      data: { labels: meetingDates, datasets: [{
        label: 'Total fillers', borderColor: '#772432', backgroundColor: 'rgba(119,36,50,0.07)',
        data: vals, tension: 0.3, fill: true, pointBackgroundColor: '#772432', pointRadius: 5, pointHoverRadius: 7,
      }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: (i) => 'Date: ' + i[0].label,
          label: (ctx) => {
            const v = ctx.parsed.y;
            const avg = vals.slice(0, ctx.dataIndex + 1).reduce((s, x) => s + x, 0) / (ctx.dataIndex + 1);
            return [' Fillers: ' + v, ' Running avg: ' + avg.toFixed(1)];
          },
        } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahRaw, viewMode]);

  useEffect(() => {
    if (viewMode !== 'timer' && viewMode !== 'both') { destroy('boxPlot'); destroy('onTime'); return; }
    const FEW = 4;
    const catStats = {};
    const jitterDatasets = [];
    CATS.forEach((cat) => {
      const catRaw = timerRaw.filter((r) => r.category === cat);
      const vals = catRaw.map((r) => r.elapsed || 0).filter((v) => v > 0);
      const gLine = CAT_GREEN[cat] || 0, rLine = CAT_RED[cat] || 0;
      if (!vals.length) return;
      catStats[cat] = boxStats(vals);
      jitterDatasets.push({
        label: cat,
        data: catRaw.map((r) => ({ x: cat, y: r.elapsed || 0, _sp: r.speaker, _cat: r.category, _within: r.within })),
        backgroundColor: catRaw.map((r) => {
          const e = r.elapsed || 0;
          const g = r.green || gLine, yl = r.yellow || 90, rd = r.red || rLine;
          if (e < g) return '#898781';
          if (e > rd) return '#d03b3b';
          if (e >= yl) return '#fab219';
          return '#0ca30c';
        }),
        pointRadius: 6, pointHoverRadius: 9, type: 'scatter',
      });
    });

    destroy('boxPlot');
    chartsRef.current.boxPlot = new Chart(boxPlotRef.current, {
      type: 'bar',
      data: { datasets: jitterDatasets },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => {
            const p = ctx.raw;
            if (p && p._sp) return [' ' + p._sp, ' Time: ' + secToMmSs(p.y), (p._within ? '✓ Within' : '✗ Outside')];
            return ' ' + secToMmSs(p?.y || 0);
          } } },
        },
        scales: { x: { type: 'category' }, y: { beginAtZero: true, ticks: { callback: (v) => secToMmSs(v), font: { size: 10 } } } },
      },
      plugins: [{
        id: 'refLines',
        beforeDatasetsDraw(chart) {
          const ctx2 = chart.ctx, xScale = chart.scales.x, yScale = chart.scales.y, bw = 35;
          CATS.forEach((cat) => {
            const s = catStats[cat];
            if (!s || s.all.length < FEW) return;
            try {
              const xPos = xScale.getPixelForValue(cat);
              const yMin = yScale.getPixelForValue(s.min), yMax = yScale.getPixelForValue(s.max);
              const yQ1 = yScale.getPixelForValue(s.q1), yQ3 = yScale.getPixelForValue(s.q3);
              const yMed = yScale.getPixelForValue(s.med);
              const color = CAT_COLORS[cat];
              ctx2.save();
              ctx2.strokeStyle = color; ctx2.lineWidth = 1.5; ctx2.setLineDash([]);
              ctx2.beginPath(); ctx2.moveTo(xPos, yMin); ctx2.lineTo(xPos, yQ1); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(xPos, yQ3); ctx2.lineTo(xPos, yMax); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(xPos - bw * 0.4, yMin); ctx2.lineTo(xPos + bw * 0.4, yMin); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(xPos - bw * 0.4, yMax); ctx2.lineTo(xPos + bw * 0.4, yMax); ctx2.stroke();
              ctx2.fillStyle = color + '26';
              ctx2.fillRect(xPos - bw, yQ3, bw * 2, yQ1 - yQ3);
              ctx2.strokeRect(xPos - bw, yQ3, bw * 2, yQ1 - yQ3);
              ctx2.lineWidth = 2.5;
              ctx2.beginPath(); ctx2.moveTo(xPos - bw, yMed); ctx2.lineTo(xPos + bw, yMed); ctx2.stroke();
              ctx2.restore();
            } catch { /* category not on the x-axis for this data slice */ }
          });
        },
        afterDraw(chart) {
          const ctx2 = chart.ctx, xScale = chart.scales.x, yScale = chart.scales.y;
          CATS.forEach((cat) => {
            const catRaw2 = timerRaw.filter((r) => r.category === cat);
            if (!catRaw2.length) return;
            const med2 = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
            const gv = med2(catRaw2.map((r) => r.green || 0).filter((v) => v > 0));
            const rv = med2(catRaw2.map((r) => r.red || 0).filter((v) => v > 0));
            try {
              const xPos = xScale.getPixelForValue(cat), bw = 35;
              if (gv) {
                const yPos = yScale.getPixelForValue(gv);
                ctx2.save(); ctx2.strokeStyle = '#43a047'; ctx2.lineWidth = 2; ctx2.setLineDash([4, 3]);
                ctx2.beginPath(); ctx2.moveTo(xPos - bw, yPos); ctx2.lineTo(xPos + bw, yPos); ctx2.stroke();
                ctx2.restore();
              }
              if (rv) {
                const yPos = yScale.getPixelForValue(rv);
                ctx2.save(); ctx2.strokeStyle = '#e53935'; ctx2.lineWidth = 2; ctx2.setLineDash([4, 3]);
                ctx2.beginPath(); ctx2.moveTo(xPos - bw, yPos); ctx2.lineTo(xPos + bw, yPos); ctx2.stroke();
                ctx2.restore();
              }
            } catch { /* category not on the x-axis for this data slice */ }
          });
        },
      }],
    });

    const speakers = [...new Set(timerRaw.map((r) => r.speaker))];
    const onTime = speakers.map((sp) => {
      const recs = timerRaw.filter((r) => r.speaker === sp);
      return recs.length ? Math.round(recs.filter((r) => r.within).length / recs.length * 100) : 0;
    });
    destroy('onTime');
    chartsRef.current.onTime = new Chart(onTimeRef.current, {
      type: 'bar',
      data: { labels: speakers, datasets: [{
        label: 'On-time %', data: onTime,
        backgroundColor: onTime.map((v) => (v >= 80 ? '#0ca30c' : v >= 50 ? '#fab219' : '#d03b3b')),
        borderRadius: 4, borderSkipped: false,
      }] },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + ctx.parsed.x + '% on time' } } },
        scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRaw, viewMode]);

  useEffect(() => () => { Object.keys(chartsRef.current).forEach(destroy); }, []);

  const handleLoadFromSheets = useCallback(async () => {
    const endpoint = gsEndpoint.trim();
    if (!endpoint) { setLoadStatus({ msg: 'Paste the Google Apps Script URL above.', type: 'err' }); return; }
    setLoadStatus({ msg: 'Loading from Google Sheets…', type: 'info' });
    const rows = await loadFromSheets(endpoint);
    setSheetsData(rows);
    setLoadStatus({ msg: `✓ Loaded ${rows.length} row(s) from Sheets.`, type: 'ok' });
  }, [gsEndpoint]);

  const statusColors = { ok: ['#e8f5e9', '#2e7d32'], err: ['#fce4ec', '#c62828'], info: ['#e3f2fd', '#1565c0'] };

  return (
    <div>
      <div className="section-head">
        <h2>Charts</h2>
        <p>Local history + Google Sheets data{' '}
          <span style={{ color: 'var(--text-light)', fontSize: 12 }}>
            {allDates.length ? `(${allDates[0]} → ${allDates[allDates.length - 1]})` : ''}
          </span>
        </p>
        <div className="maroon-line"></div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', marginBottom: 14, boxShadow: 'var(--shadow)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="fg" style={{ maxWidth: 160 }}>
          <span className="fl">View</span>
          <select className="fs" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="both">Both</option>
            <option value="ah">Ah Counter</option>
            <option value="timer">Timer</option>
          </select>
        </div>
        <MultiSelectDropdown label="Speaker" plural="speakers" options={allSpeakers} selected={selSpeakers} onChange={setSelSpeakers} />
        <MultiSelectDropdown label="Category" plural="categories" options={['Speech', 'Evaluator', 'Table Topics']} selected={selCats} onChange={setSelCats} />
        <div className="fg" style={{ maxWidth: 155 }}>
          <span className="fl">Date from</span>
          <input className="fi" type="date" style={{ fontSize: 12 }} value={dateFrom}
            min={allDates[0]} max={allDates[allDates.length - 1]}
            onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="fg" style={{ maxWidth: 155 }}>
          <span className="fl">Date to</span>
          <input className="fi" type="date" style={{ fontSize: 12 }} value={dateTo}
            min={dateFrom || allDates[0]} max={allDates[allDates.length - 1]}
            onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button className="btn-s" style={{ alignSelf: 'flex-end', height: 35 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>✕ Clear dates</button>
        <div className="fg" style={{ minWidth: 200 }}>
          <span className="fl">Apps Script URL</span>
          <input className="fi" type="text" placeholder="Paste Web App URL" style={{ fontSize: 12 }}
            value={gsEndpoint} onChange={(e) => setGsEndpoint(e.target.value)} />
        </div>
        <button className="btn-b" style={{ alignSelf: 'flex-end' }} onClick={handleLoadFromSheets}>↓ Load from Sheets</button>
      </div>
      {loadStatus && (
        <div style={{ fontSize: 12, fontFamily: 'var(--font-head)', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius)', marginBottom: 12, display: 'block', background: statusColors[loadStatus.type][0], color: statusColors[loadStatus.type][1] }}>
          {loadStatus.msg}
        </div>
      )}

      <div style={{ display: viewMode === 'ah' || viewMode === 'both' ? '' : 'none' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--maroon)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🎙 Ah Counter</span><div style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></div>
        </div>
        <StatGrid stats={ahStats} />
        <div className="chart-wrap">
          <div className="chart-title">Filler breakdown by speaker</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>One bar per speaker, ranked by total fillers. Segment color shows which filler word — segment width shows how many times.</div>
          <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', height: 340 }}><canvas ref={radarRef}></canvas></div>
        </div>
        <div className="chart-wrap">
          <div className="chart-title">Total fillers per meeting</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Each point is one meeting. A downward trend means the club is improving over time.</div>
          <canvas ref={ahLineRef} height="90"></canvas>
        </div>
      </div>

      <div style={{ marginTop: 8, display: viewMode === 'timer' || viewMode === 'both' ? '' : 'none' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⏱ Timer</span><div style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></div>
        </div>
        <StatGrid stats={timerStats} />
        <div className="chart-wrap">
          <div className="chart-title">Speech time distribution by category</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Box shows median and spread of speech times per category. Each dot is one speech. Green band = within time range. When few data points exist, all dots are shown individually.</div>
          <canvas ref={boxPlotRef} height="130"></canvas>
        </div>
        <div className="chart-wrap">
          <div className="chart-title">On-time rate by speaker</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>% of speeches where the speaker finished between green and red. 🟢 ≥80% · 🟡 ≥50% · 🔴 below 50%.</div>
          <canvas ref={onTimeRef} height="90"></canvas>
        </div>
      </div>
    </div>
  );
}
