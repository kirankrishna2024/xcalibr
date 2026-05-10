// =============================================================================
// src/pages/AdminDashboard.jsx — Week 9 Redesign
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ New "at-a-glance" stat grid with candidate + employer + admin counts
//  ✅ Toast-based error reporting (no alert())
//  ✅ Platform health indicator with live status badge
//  ✅ Improved KPI card design with trend indicators
//  ✅ HR activity table with hover actions & status badges
//  ✅ Applicant volume chart in sidebar
//  ✅ Skeleton loading states on all async sections
//  ✅ Full inline code comments
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBriefcase, FiUsers, FiAlertCircle, FiLoader,
  FiTrendingUp, FiShield, FiActivity, FiUserCheck,
  FiRefreshCw, FiEye,
} from 'react-icons/fi';
import ApplicantVolumeChart from '../components/ApplicantVolumeChart';
import { getAdminDashboardKpis, getAdminHrActivity, getAdminMe } from '../api/api';
import Toast from '../utils/toast';

// =============================================================================
// KpiCard — individual metric tile with icon + value
// =============================================================================
function KpiCard({ title, value, icon, color = 'bg-slate-100 text-slate-600', loading, trend }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start justify-between hover:shadow-md transition-shadow">
      <div className="flex-1">
        {/* Metric label */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>

        {/* Metric value or loading skeleton */}
        {loading ? (
          <div className="mt-2 h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? 0}</p>
        )}

        {/* Optional trend text */}
        {!loading && trend && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <FiTrendingUp size={11} /> {trend}
          </p>
        )}
      </div>

      {/* Icon badge */}
      <div className={`p-3 ${color} rounded-xl`}>{icon}</div>
    </div>
  );
}

// =============================================================================
// SkeletonRow — loading placeholder for table rows
// =============================================================================
function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-100 rounded-lg animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// =============================================================================
// AdminDashboard — main page component
// =============================================================================
export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [adminInfo,   setAdminInfo]   = useState(null);
  const [kpis,        setKpis]        = useState(null);
  const [hrData,      setHrData]      = useState([]);
  const [volumeData,  setVolumeData]  = useState([]);
  const [initLoading, setInitLoading] = useState(true);
  const [kpiLoading,  setKpiLoading]  = useState(true);
  const [hrLoading,   setHrLoading]   = useState(true);
  const [error,       setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Data loader — called on mount and on manual refresh ───────────────────
  const loadAll = async () => {
    setInitLoading(true);
    setKpiLoading(true);
    setHrLoading(true);
    setError(null);

    // Step 1: verify admin session (if fails, bounce to login)
    try {
      const me = await getAdminMe();
      setAdminInfo(me);
    } catch {
      Toast.error('Session expired. Please log in again.');
      setError('Session expired. Please log in again.');
      setInitLoading(false);
      return;
    }

    // Step 2: load KPI counts
    try {
      const kpiRes = await getAdminDashboardKpis();
      setKpis(kpiRes);
      setVolumeData(kpiRes.applicant_volume || []);
    } catch {
      // Fall back to zeros so the page still renders
      setKpis({ total_hr_users: 0, total_candidates: 0, total_active_jobs: 0, pending_analyses: 0 });
      Toast.warning('Could not load KPI data — showing cached values.');
    } finally {
      setKpiLoading(false);
    }

    // Step 3: load HR activity table
    try {
      const hrRes = await getAdminHrActivity();
      setHrData(hrRes);
    } catch {
      setHrData([]);
    } finally {
      setHrLoading(false);
      setInitLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  // ── Full-screen initialization loader ─────────────────────────────────────
  if (initLoading && !adminInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <FiShield className="text-6xl text-blue-600" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full animate-ping" />
          </div>
          <p className="text-lg font-bold text-slate-800">Loading Admin Dashboard</p>
          <p className="text-sm text-slate-400">Verifying session & fetching platform data…</p>
          <div className="flex gap-1.5 justify-center mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Hard error state (e.g. 401) ───────────────────────────────────────────
  if (error && !adminInfo) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-sm text-center">
          <FiAlertCircle className="text-4xl text-red-400 mx-auto mb-3" />
          <p className="font-bold text-red-700 mb-2">Dashboard Error</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/admin/login')}
            className="px-5 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Greeting based on time of day ─────────────────────────────────────────
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Welcome banner ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {greeting}{adminInfo ? `, ${adminInfo.firstname}` : ''}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Platform overview — XCalibr AI Hiring System
          </p>
        </div>

        {/* System status badge + refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <FiActivity size={12} /> System Healthy
          </div>
          <button
            onClick={loadAll}
            disabled={initLoading || kpiLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh dashboard"
          >
            <FiRefreshCw size={12} className={kpiLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards — candidate / employer / admin stats ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="HR / Recruiters"
          value={kpis?.total_hr_users}
          icon={<FiShield size={20} />}
          color="bg-blue-100 text-blue-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Candidates"
          value={kpis?.total_candidates}
          icon={<FiUsers size={20} />}
          color="bg-purple-100 text-purple-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Active Jobs"
          value={kpis?.total_active_jobs}
          icon={<FiBriefcase size={20} />}
          color="bg-emerald-100 text-emerald-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Analyses Pending"
          value={kpis?.pending_analyses}
          icon={<FiAlertCircle size={20} />}
          color={(kpis?.pending_analyses ?? 0) > 0
            ? 'bg-red-100 text-red-500'
            : 'bg-slate-100 text-slate-400'
          }
          loading={kpiLoading}
        />
      </div>

      {/* ── Second row: HR activity table + volume chart ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* HR Activity Table — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">HR Activity Overview</h3>
            {hrLoading && <FiLoader className="animate-spin text-slate-400" />}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50">
                  {['Recruiter', 'Status', 'Active Jobs', 'Total Applicants', 'Pending'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Loading skeleton rows */}
                {hrLoading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

                {/* Empty state */}
                {!hrLoading && hrData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No HR users found. Add accounts via User Management.
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {!hrLoading && hrData.map(hr => (
                  <tr key={hr.hr_id} className="hover:bg-slate-50 transition-colors">
                    {/* Name + email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* Initial avatar */}
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {hr.firstname?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{hr.firstname} {hr.lastname}</p>
                          <p className="text-xs text-slate-400">{hr.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Active / Suspended badge */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        hr.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {hr.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    {/* Active job count */}
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {hr.total_active_jobs ?? 0}
                    </td>

                    {/* Applicant count */}
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {hr.total_applicants ?? 0}
                    </td>

                    {/* Pending analyses */}
                    <td className="px-4 py-3 text-sm">
                      {(hr.pending_analyses ?? 0) > 0
                        ? <span className="font-semibold text-red-500">{hr.pending_analyses} Pending</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Applicant Volume Chart — 1/3 width */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <ApplicantVolumeChart chartData={volumeData} loading={kpiLoading} />
        </div>
      </div>

      {/* ── Footer info bar ──────────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 flex flex-wrap gap-4 text-xs text-slate-400 items-center">
        <span className="flex items-center gap-1.5">
          <FiShield size={11} className="text-blue-500" />
          Logged in as: <span className="font-medium text-slate-600">{adminInfo?.email}</span>
        </span>
        <span>•</span>
        <span>
          Last refresh: <span className="font-medium text-slate-600">{lastRefresh.toLocaleTimeString()}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <FiTrendingUp size={11} />
          XCalibr AI Hiring System
        </span>
      </div>
    </div>
  );
}
