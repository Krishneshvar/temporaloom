'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Upload, Trash2, RefreshCw, ArrowLeft, File, Layers,
  BarChart2, GitFork, Sigma, Maximize2, AlertTriangle, CheckCircle2,
  Loader2, ChevronRight, HardDrive, Network, Search, X
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);       // string[]
  const [stats, setStats]       = useState({});        // name → stats obj
  const [loadingStats, setLoadingStats] = useState({}); // name → bool
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadOk, setUploadOk]   = useState('');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchDatasets = useCallback(async () => {
    const res = await fetch('/api/datasets');
    const data = await res.json();
    if (Array.isArray(data)) setDatasets(data);
  }, []);

  const fetchStats = useCallback(async (name) => {
    if (stats[name]) return; // already loaded
    setLoadingStats(p => ({ ...p, [name]: true }));
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(name)}?stats=1`);
      if (res.ok) {
        const data = await res.json();
        setStats(p => ({ ...p, [name]: data }));
      }
    } catch (_) {}
    setLoadingStats(p => ({ ...p, [name]: false }));
  }, [stats]);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  // Lazy-load stats for visible datasets
  useEffect(() => {
    datasets.forEach(name => fetchStats(name));
  }, [datasets, fetchStats]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploadOk('');
    setUploading(true);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/datasets/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadOk(`✓ "${data.filename}" uploaded (${fmtSize(data.sizeBytes)})`);
        fetchDatasets();
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadError(err.message);
    }
    setUploading(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (name) => {
    setDeleting(name);
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        setDatasets(p => p.filter(d => d !== name));
        setStats(p => { const n = { ...p }; delete n[name]; return n; });
      }
    } catch (_) {}
    setDeleting(null);
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const filtered = datasets.filter(d => d.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans p-6 selection:bg-blue-500/30">
      <div className="max-w-[1100px] mx-auto">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <a href="/" className="p-2.5 bg-[#111] hover:bg-[#1a1a1a] rounded-xl border border-[#222] text-white/50 hover:text-white transition-all">
              <ArrowLeft size={18} />
            </a>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Database size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Dataset Manager</h1>
                <p className="text-[#555] text-xs font-semibold uppercase tracking-widest">
                  {datasets.length} graph{datasets.length !== 1 ? 's' : ''} · Temporaloom Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Filter datasets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-[#111] border border-[#222] text-white pl-8 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all w-52"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            <button onClick={fetchDatasets} className="p-2.5 bg-[#111] hover:bg-[#1a1a1a] rounded-xl border border-[#222] text-white/50 hover:text-white transition-all" title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* ── Upload Zone ───────────────────────────────────────────────── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative mb-8 rounded-2xl border-2 border-dashed transition-all ${dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-[#222] hover:border-[#333]'}`}
        >
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
          <div className="p-8 flex flex-col items-center gap-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className={`p-4 rounded-2xl border transition-all ${dragOver ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-[#111] border-[#222] text-white/30'}`}>
              {uploading ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white/60">
                {uploading ? 'Uploading...' : 'Drop a .txt graph file here, or click to browse'}
              </p>
              <p className="text-[11px] text-[#555] mt-1">Format: first line <code className="text-blue-400/80">N M</code>, then edge pairs <code className="text-blue-400/80">src dst</code> per line. Max 50 MB.</p>
            </div>
          </div>

          {/* Upload feedback */}
          <AnimatePresence>
            {(uploadOk || uploadError) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mx-4 mb-4 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 border ${uploadOk ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
              >
                {uploadOk ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {uploadOk || uploadError}
                <button onClick={() => { setUploadOk(''); setUploadError(''); }} className="ml-auto text-white/40 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Summary bar ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Datasets', value: datasets.length, icon: <Database size={16} />, color: 'text-blue-400' },
            {
              label: 'Total Nodes',
              value: fmtNum(Object.values(stats).reduce((s, d) => s + (d.nodes || 0), 0)),
              icon: <Network size={16} />, color: 'text-purple-400'
            },
            {
              label: 'Total Edges',
              value: fmtNum(Object.values(stats).reduce((s, d) => s + (d.edges || 0), 0)),
              icon: <GitFork size={16} />, color: 'text-emerald-400'
            },
          ].map(s => (
            <div key={s.label} className="p-5 bg-[#111] rounded-2xl border border-[#222]">
              <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 ${s.color}`}>
                {s.icon}{s.label}
              </div>
              <div className="text-3xl font-black font-mono tracking-tighter">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Dataset list ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className="text-center py-20 text-white/10">
              <Database size={40} className="mx-auto mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">
                {search ? 'No datasets match your search' : 'No datasets yet — upload one above'}
              </p>
            </div>
          )}

          <AnimatePresence>
            {filtered.map((name, i) => {
              const s = stats[name];
              const isLoading = loadingStats[name];
              const isDeleting = deleting === name;

              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  className="group p-5 bg-[#111] hover:bg-[#141414] rounded-2xl border border-[#222] hover:border-[#333] transition-all shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-blue-400/60 group-hover:text-blue-400 transition-colors shrink-0">
                      <File size={20} />
                    </div>

                    {/* Name + size */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{name}</p>
                      <p className="text-[11px] text-[#555] font-mono mt-0.5">
                        {s ? fmtSize(s.sizeBytes) : isLoading ? 'Loading...' : '—'}
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div className="hidden lg:grid grid-cols-4 gap-6 text-center shrink-0">
                      <StatPill label="Nodes" value={isLoading ? '…' : fmtNum(s?.nodes)} color="text-blue-400" />
                      <StatPill label="Edges" value={isLoading ? '…' : fmtNum(s?.edges)} color="text-purple-400" />
                      <StatPill label="Avg Deg" value={isLoading ? '…' : s?.avgDegree?.toFixed(1) ?? '—'} color="text-emerald-400" />
                      <StatPill label="Density" value={isLoading ? '…' : s?.density != null ? s.density.toExponential(1) : '—'} color="text-amber-400" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <a
                        href={`/?dataset=${encodeURIComponent(name)}`}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                      >
                        Run <ChevronRight size={12} />
                      </a>
                      <button
                        onClick={() => handleDelete(name)}
                        disabled={isDeleting}
                        className="p-2 bg-red-500/5 hover:bg-red-500/15 text-red-500/40 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 rounded-lg transition-all disabled:opacity-40"
                        title="Delete dataset"
                      >
                        {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Mobile stats row */}
                  {s && (
                    <div className="lg:hidden grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#1e1e1e]">
                      <StatPill label="Nodes" value={fmtNum(s.nodes)} color="text-blue-400" />
                      <StatPill label="Edges" value={fmtNum(s.edges)} color="text-purple-400" />
                      <StatPill label="Avg Deg" value={s.avgDegree?.toFixed(1) ?? '—'} color="text-emerald-400" />
                      <StatPill label="Density" value={s.density?.toExponential(1) ?? '—'} color="text-amber-400" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-[#333] text-[11px] font-bold uppercase tracking-widest">
          Temporaloom Dataset Manager · Graph files in <code className="text-[#444]">/datasets/</code>
        </div>
      </div>
    </main>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${color}`}>{label}</span>
      <span className="text-sm font-black font-mono">{value}</span>
    </div>
  );
}
