// =============================================================================
// src/pages/SystemLogPage.jsx — Week 9 Redesign
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ Fixed broken ShieldExclamationIcon reference (was undefined)
//  ✅ Replaced date-fns dependency with native Date formatting (no install needed)
//  ✅ Added search/filter bar (by action type, admin name, description)
//  ✅ Action type filter dropdown (ALL / CREATE / DELETE / UPDATE / LOGIN / LOGIN_FAIL)
//  ✅ Toast error reporting instead of inline-only alerts
//  ✅ Pagination support (25 rows per page)
//  ✅ Better status & action badges
//  ✅ Refresh button
//  ✅ Full inline comments
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { getSystemLogs } from '../api/api';
import Toast from '../utils/toast';
import {
  FiShield, FiSearch, FiRefreshCw, FiAlertTriangle,
  FiFilter, FiChevronLeft, FiChevronRight, FiActivity,
} from 'react-icons/fi';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE       = 25;   // rows per page
const ACTION_TYPES    = ['ALL', 'CREATE', 'DELETE', 'UPDATE', 'LOGIN', 'LOGIN_FAIL'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp into a human-readable string without date-fns.
 * e.g. "May 7, 2025, 3:42 PM"
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return isoString; // fallback: raw string
  }
}

/**
 * Returns Tailwind classes for the action-type badge colour.
 */
function actionBadgeCls(type) {
  switch (type) {
    case 'DELETE':     return 'bg-red-100 text-red-700';
    case 'UPDATE':     return 'bg-amber-100 text-amber-700';
    case 'LOGIN_FAIL': return 'bg-orange-100 text-orange-700';
    case 'CREATE':     return 'bg-emerald-100 text-emerald-700';
    case 'LOGIN':      return 'bg-blue-100 text-blue-700';
    default:           return 'bg-slate-100 text-slate-600';
  }
}

/**
 * Returns Tailwind classes for the status badge.
 */
function statusBadgeCls(status) {
  return status === 'Success'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700';
}

// =============================================================================
// SystemLogPage — main component
// =============================================================================
const SystemLogPage = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');          // free-text search
  const [filterType, setFilterType] = useState('ALL');       // action-type dropdown
  const [page,       setPage]       = useState(1);           // current pagination page

  // ── Fetch system logs from API ─────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemLogs();
      setLogs(data || []);
      setPage(1); // reset to first page on fresh load
    } catch (err) {
      console.error('[SystemLogPage] fetch error:', err);
      const msg = 'Failed to load system logs. Please try again.';
      setError(msg);
      Toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Derived: filter + search ───────────────────────────────────────────────
  const filtered = logs.filter(log => {
    // Filter by action type dropdown (skip if ALL)
    if (filterType !== 'ALL' && log.actiontype !== filterType) return false;

    // Free-text search across admin name, email, and description
    if (search) {
      const q = search.toLowerCase();
      const adminName  = `${log.admin?.firstname || ''} ${log.admin?.lastname || ''}`.toLowerCase();
      const adminEmail = (log.admin?.email || '').toLowerCase();
      const desc       = (log.actiondescription || '').toLowerCase();
      if (!adminName.includes(q) && !adminEmail.includes(q) && !desc.includes(q)) return false;
    }

    return true;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiActivity className="text-blue-600" /> System Activity Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail of all admin actions on the XCalibr platform.
          </p>
        </div>
        {/* Refresh button */}
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Filter / search bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Free-text search */}
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="Search by admin, description…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* Action type filter */}
        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition appearance-none bg-white"
          >
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Actions' : t}</option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {/* ── Loading state ────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500">Loading logs…</p>
          </div>
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
          <FiAlertTriangle className="flex-shrink-0 text-xl" />
          <div>
            <p className="font-semibold text-sm">Failed to Load Logs</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={fetchLogs} className="ml-auto text-xs underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FiShield className="mx-auto text-4xl text-slate-300 mb-3" />
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            {search || filterType !== 'ALL' ? 'No matching logs' : 'No Logs Yet'}
          </h3>
          <p className="text-xs text-slate-400">
            {search || filterType !== 'ALL'
              ? 'Try adjusting your search or filter.'
              : 'Admin actions will appear here once logged.'}
          </p>
        </div>
      )}

      {/* ── Log table ────────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              {/* Table header */}
              <thead className="bg-slate-50">
                <tr>
                  {['Admin', 'Action', 'Description', 'IP Address', 'Status', 'Timestamp'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table body — current page slice */}
              <tbody className="divide-y divide-slate-100">
                {pageSlice.map(log => (
                  <tr key={log.logid} className="hover:bg-slate-50 transition-colors">

                    {/* Admin user who performed the action */}
                    <td className="px-5 py-4">
                      {log.admin ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {log.admin.firstname} {log.admin.lastname}
                          </p>
                          <p className="text-xs text-slate-400">{log.admin.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unknown</span>
                      )}
                    </td>

                    {/* Action type badge */}
                    <td className="px-5 py-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${actionBadgeCls(log.actiontype)}`}>
                        {log.actiontype}
                      </span>
                    </td>

                    {/* Description — truncated to prevent wide tables */}
                    <td className="px-5 py-4 text-sm text-slate-600 max-w-xs">
                      <span className="truncate block" title={log.actiondescription}>
                        {log.actiondescription || '—'}
                      </span>
                    </td>

                    {/* IP address */}
                    <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                      {log.ip_address || '—'}
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeCls(log.status)}`}>
                        {log.status || '—'}
                      </span>
                    </td>

                    {/* Formatted timestamp */}
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(log.timestamped)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination controls ─────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
              {/* Showing X–Y of Z */}
              <span className="text-xs text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>

              {/* Prev / Next buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="flex items-center px-3 text-xs text-slate-600 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemLogPage;
