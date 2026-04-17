'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Activity, Zap, Cpu, TrendingDown, Trophy, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Dot,
} from 'recharts';

// One distinct color per algorithm mode (up to 6)
const PALETTE = [
  '#3b82f6', // blue       – Sequential
  '#10b981', // emerald    – MPI / CUDA Seq
  '#f59e0b', // amber      – OpenMP / CUDA Par
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
];

// Label map for mode IDs
const MODE_LABELS = {
  cpu_seq: 'Sequential',
  cpu_par: 'MPI',
  cpu_omp: 'OpenMP',
  gpu_seq: 'CUDA Seq',
  gpu_par: 'CUDA Par',
};

// (MODE_SHORT removed — datasets are on the X-axis now)

// ── Custom Tooltip ────────────────────────────────────────────────────────────
// label = dataset name; each payload entry = one algorithm mode
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Strip file extension for a cleaner title
  const title = label?.replace(/\.\w+$/, '') ?? label;
  return (
    <div className="bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--border)] rounded-2xl px-4 py-3 shadow-2xl min-w-[200px]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] mb-2 truncate">{title}</p>
      {payload
        .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity))
        .map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              {entry.dataKey}
            </span>
            <span className="text-[11px] font-mono text-[var(--foreground)] font-black">
              {entry.value != null ? `${entry.value.toFixed(4)}s` : '—'}
            </span>
          </div>
        ))}
    </div>
  );
}

// ── Custom Legend — shows one entry per mode ─────────────────────────────────
function CustomLegend({ modes }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center mt-2">
      {modes.map(({ label, color }) => (
        <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)]">
          <span className="w-6 h-1.5 rounded-full inline-block" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Custom Dot (highlight errors) ─────────────────────────────────────────────
function CustomDot(props) {
  const { cx, cy, value } = props;
  if (value == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={props.stroke} stroke={props.stroke} strokeWidth={2} />;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BenchmarkChart({ data, loading }) {

  // data shape: [{ dataset, results: [{id, name, data:{execution_time}, error}] }]
  //
  // Axis layout:
  //   X-axis  = datasets            (one tick per dataset)
  //   Lines   = algorithm modes     (one colored line per mode)
  //   Tooltip = hover a dataset → see ALL its algorithm timings
  const { chartData, modeMeta, fastest, slowest } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], modeMeta: [], fastest: null, slowest: null };

    // Collect mode IDs from the first dataset that has results
    const firstResults = data.find(d => d.results?.length)?.results ?? [];
    const modeIds = firstResults.map(r => r.id);

    // modeMeta: one entry per algorithm mode (becomes a Line in the chart)
    const modeMeta = modeIds.map((id, i) => ({
      id,
      label: MODE_LABELS[id] ?? id,
      color: PALETTE[i % PALETTE.length],
    }));

    // chartData: one row per dataset
    // { _dataset, _short, 'Sequential': 1.23, 'MPI': 0.45, … }
    const chartData = data.map(d => {
      const row = {
        _dataset: d.dataset,
        _short: d.dataset.replace(/\.\w+$/, ''),
      };
      (d.results ?? []).forEach(r => {
        const label = MODE_LABELS[r.id] ?? r.id;
        if (!r.error && r.data?.execution_time != null) row[label] = r.data.execution_time;
      });
      return row;
    });

    // Fastest / slowest across all datasets × modes
    let fastest = null, slowest = null, minT = Infinity, maxT = -Infinity;
    data.forEach(d => {
      (d.results ?? []).forEach(r => {
        const t = r.data?.execution_time;
        if (!r.error && t != null) {
          if (t < minT) { minT = t; fastest = { dataset: d.dataset, mode: MODE_LABELS[r.id] ?? r.id, time: t }; }
          if (t > maxT) { maxT = t; slowest = { dataset: d.dataset, mode: MODE_LABELS[r.id] ?? r.id, time: t }; }
        }
      });
    });

    return { chartData, modeMeta, fastest, slowest };
  }, [data]);

  const isMulti = (data?.length ?? 0) > 1;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && (!data || data.length === 0)) {
    return (
      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full border-t-2 border-blue-500 animate-spin" />
          <Activity size={32} className="text-blue-500 animate-pulse" />
        </div>
        <span className="mt-8 text-[var(--foreground)]/70 font-bold uppercase tracking-widest text-sm">Running Benchmark Suite...</span>
        <p className="text-xs text-[var(--text-muted)] mt-2 max-w-sm text-center">Executing hardware modes sequentially. Results appear as each dataset completes.</p>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] border-dashed flex flex-col items-center justify-center gap-3 text-[var(--text-dim)] min-h-[400px] hover:border-[var(--text-muted)] transition-all">
        <BarChart size={32} className="opacity-40" />
        <span className="text-xs font-bold uppercase tracking-widest">Select datasets and run a benchmark</span>
      </div>
    );
  }

  // isMulti already derived above

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl p-6 flex flex-col gap-6"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="text-[var(--foreground)] font-black text-base leading-tight">
              Hardware Benchmark {isMulti ? 'Comparison' : 'Profile'}
            </h3>
            <p className="text-[var(--text-muted)] text-[11px] font-semibold mt-0.5">
              {isMulti
                ? `${data.length} datasets · one line per algorithm mode`
                : `${data[0]?.dataset} · execution time per mode`}
            </p>
          </div>
        </div>

        {/* Partial-load badge */}
        {loading && data.length > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full animate-pulse shrink-0">
            <Activity size={11} /> Running...
          </span>
        )}
      </div>

      {/* ── Line Chart — X = datasets, Lines = algorithm modes ── */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="_short"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              fontWeight="bold"
              tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(2)}s`}
            />
            <Tooltip content={<CustomTooltip />} />
            {modeMeta.map(({ label, color }) => (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={color}
                strokeWidth={2.5}
                dot={<CustomDot />}
                activeDot={{ r: 6, strokeWidth: 2, stroke: color }}
                connectNulls
                isAnimationActive
                animationDuration={700}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — one entry per algorithm mode */}
      <CustomLegend modes={modeMeta} />

      {/* ── Summary callout row ── */}
      {(fastest || slowest) && (
        <div className="grid grid-cols-2 gap-4">
          {fastest && (
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
              <Trophy size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70 block">Fastest Overall</span>
                <p className="text-[11px] font-bold text-[var(--foreground)] truncate">{fastest.dataset}</p>
                <p className="text-[10px] text-emerald-400 font-mono">{fastest.mode} · {fastest.time.toFixed(4)}s</p>
              </div>
            </div>
          )}
          {slowest && slowest.dataset !== fastest?.dataset && (
            <div className="p-4 bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl flex items-start gap-3">
              <TrendingDown size={16} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)] block">Slowest Overall</span>
                <p className="text-[11px] font-bold text-[var(--foreground)] truncate">{slowest.dataset}</p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">{slowest.mode} · {slowest.time.toFixed(4)}s</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Per-dataset result table ── */}
      <div className="flex flex-col gap-3">
        {data.map((d, di) => {
          const headerDot = PALETTE[di % PALETTE.length];
          const hasError = !!d.error;

          return (
            <motion.div
              key={d.dataset}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: di * 0.06 }}
              className="bg-[var(--background)]/40 rounded-2xl border border-[var(--border)] overflow-hidden"
            >
              {/* Dataset header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: headerDot }} />
                <span className="text-[11px] font-black font-mono text-[var(--foreground)] flex-1 truncate">{d.dataset}</span>
                {hasError && (
                  <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                    <AlertCircle size={11} /> Error
                  </span>
                )}
              </div>

              {/* Mode bars */}
              {!hasError && d.results && d.results.length > 0 && (() => {
                const maxT = Math.max(...d.results.filter(r => !r.error && r.data?.execution_time != null).map(r => r.data.execution_time), 0.0001);
                return (
                  <div className="p-5 flex flex-col gap-3">
                    {d.results.map(r => {
                      const failed = !!r.error;
                      const t = r.data?.execution_time;
                      const pct = !failed && t != null ? (t / maxT) * 100 : 0;
                      // Use the same color as the mode's line in the chart
                      const modeColor = modeMeta.find(m => m.id === r.id)?.color ?? '#6366f1';
                      return (
                        <div key={r.id} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--foreground)]/80">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: modeColor }} />
                              {r.name}
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${failed ? 'text-red-400' : 'text-[var(--text-dim)]'}`}>
                              {failed ? 'FAILED' : t != null ? `${t.toFixed(4)}s` : '—'}
                            </span>
                          </div>
                          <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
                            {!failed && t != null && (
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(pct, 2)}%` }}
                                transition={{ duration: 0.8, delay: di * 0.1 }}
                                className="h-full rounded-full"
                                style={{ background: modeColor, opacity: 0.8 }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
