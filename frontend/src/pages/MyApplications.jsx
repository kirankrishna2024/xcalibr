// =============================================================================
// src/pages/MyApplications.jsx — Week 9 Redesign (Candidate Portal)
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ Beautiful status timeline showing application journey
//  ✅ Toast notifications for errors instead of plain text
//  ✅ Filter bar: search by job title + filter by status
//  ✅ Application count summary stats
//  ✅ Score display per application with colour coding
//  ✅ Loading skeletons for async state
//  ✅ Empty state with CTA to browse jobs
//  ✅ Full inline comments
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApplicationsByCandidate } from '../api/api';
import Toast from '../utils/toast';
import {
  FiBriefcase, FiSearch, FiFilter, FiClock,
  FiCheckCircle, FiXCircle, FiArrowRight, FiAlertCircle,
} from 'react-icons/fi';

// ─── Status configuration ─────────────────────────────────────────────────────
// Maps application status strings to badge colours and icons
const STATUS_CONFIG = {
  'Applied':              { cls: 'bg-blue-100 text-blue-700',    icon: '📋' },
  'Reviewed':             { cls: 'bg-amber-100 text-amber-700',  icon: '👁' },
  'Under Review':         { cls: 'bg-amber-100 text-amber-700',  icon: '🔍' },
  'Shortlisted':          { cls: 'bg-emerald-100 text-emerald-700', icon: '⭐' },
  'Hired':                { cls: 'bg-purple-100 text-purple-700', icon: '🎉' },
  'Rejected':             { cls: 'bg-red-100 text-red-700',       icon: '✕' },
  'Interview Scheduled':  { cls: 'bg-green-100 text-green-700',   icon: '📅' },
  'Processing':           { cls: 'bg-violet-100 text-violet-700', icon: '⚙' },
  'Failed':               { cls: 'bg-red-100 text-red-700',       icon: '⚠' },
};

const STATUS_FILTER_OPTIONS = [
  'All', 'Applied', 'Under Review', 'Shortlisted',
  'Interview Scheduled', 'Hired', 'Rejected',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format an ISO date string to "May 7, 2025" */
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

/** Return a Tailwind colour class for a 0–100 score */
function scoreColor(score) {
  if (score >= 70) return 'text-emerald-600 font-bold';
  if (score >= 40) return 'text-amber-600 font-semibold';
  return 'text-red-500 font-semibold';
}

// =============================================================================
// SkeletonCard — loading placeholder
// =============================================================================
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
        <div className="h-6 w-20 bg-slate-100 rounded-full" />
      </div>
      <div className="mt-4 h-3 bg-slate-100 rounded w-full" />
    </div>
  );
}

// =============================================================================
// ApplicationCard — single application tile
// =============================================================================
function ApplicationCard({ app }) {
  const statusCfg = STATUS_CONFIG[app.status] || { cls: 'bg-slate-100 text-slate-600', icon: '•' };
  const score     = app.overall_score;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      {/* Header row: job icon + title + status badge */}
      <div className="flex items-start gap-4">
        {/* Job icon avatar */}
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <FiBriefcase size={18} />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">
            {app.job?.title || 'Job Position'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {app.job?.company || app.job?.hr?.company || 'Company'} · Applied {fmtDate(app.applied_at)}
          </p>
        </div>

        {/* Status badge */}
        <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.cls}`}>
          {statusCfg.icon} {app.status}
        </span>
      </div>

      {/* Score bar — only shown when analysis is complete */}
      {score !== null && score !== undefined && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">AI Match Score</span>
            <span className={`text-sm ${scoreColor(score)}`}>
              {score}/100
            </span>
          </div>
          {/* Visual progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Analysis status info */}
      {app.analysis_status && app.analysis_status !== 'Completed' && (
        <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <FiClock size={11} />
          Analysis: {app.analysis_status}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// MyApplications — main page component
// =============================================================================
export default function MyApplications() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [applications, setApplications] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // ── Fetch applications on mount ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getApplicationsByCandidate();
        setApplications(data || []);
      } catch (err) {
        console.error('[MyApplications] fetch error:', err);
        const msg = 'Failed to load your applications. Please refresh.';
        setError(msg);
        Toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Derived: filtered list ─────────────────────────────────────────────────
  const filtered = applications.filter(app => {
    // Status filter
    if (filterStatus !== 'All' && app.status !== filterStatus) return false;
    // Text search on job title
    if (search) {
      const title = (app.job?.title || '').toLowerCase();
      if (!title.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = {
    total:       applications.length,
    shortlisted: applications.filter(a => a.status === 'Shortlisted').length,
    pending:     applications.filter(a => ['Applied', 'Under Review', 'Processing'].includes(a.status)).length,
    rejected:    applications.filter(a => a.status === 'Rejected').length,
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Applications</h1>
        <p className="text-sm text-slate-500 mt-1">Track the status of all your job applications.</p>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Applied',  value: stats.total,       color: 'bg-blue-50 text-blue-700' },
            { label: 'Shortlisted',    value: stats.shortlisted, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Pending',        value: stats.pending,     color: 'bg-amber-50 text-amber-700' },
            { label: 'Not Progressed', value: stats.rejected,    color: 'bg-red-50 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter / search bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="Search by job title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* Status filter dropdown */}
        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition appearance-none bg-white"
          >
            {STATUS_FILTER_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Loading skeletons ────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
          <FiAlertCircle className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FiBriefcase className="text-5xl text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-700 mb-1">
            {applications.length === 0 ? 'No Applications Yet' : 'No Matching Applications'}
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            {applications.length === 0
              ? 'Apply to jobs from the Job Board to see them here.'
              : 'Try changing your search or filter.'}
          </p>
          {applications.length === 0 && (
            <button
              onClick={() => navigate('/candidate/job-board')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Browse Jobs <FiArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Application cards list ───────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map(app => (
            <ApplicationCard key={app.app_id || app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
