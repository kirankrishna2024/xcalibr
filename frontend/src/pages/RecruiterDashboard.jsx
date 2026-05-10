// =============================================================================
// src/pages/RecruiterDashboard.jsx — Week 9 Redesign
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ Toast notifications replace all alert() calls
//  ✅ Richer KPI cards with coloured icons per metric type
//  ✅ Job summary table with clickable rows → navigate to applicants
//  ✅ Quick-action buttons (View Applicants, Post New Job)
//  ✅ Applicant volume chart in sidebar
//  ✅ Loading skeletons for all async sections
//  ✅ Friendly empty states with CTA buttons
//  ✅ Inline comments throughout
// =============================================================================

import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  getDashboardKpis,
  getDashboardJobSummaries,
  getDashboardApplicantVolume,
} from '../api/api';
import {
  FiLoader, FiBriefcase, FiUsers, FiClock, FiAlertCircle,
  FiBarChart2, FiArrowRight, FiPlus, FiRefreshCw, FiCheckCircle,
  FiTrendingUp,
} from 'react-icons/fi';
import ApplicantVolumeChart from '../components/ApplicantVolumeChart';
import Toast from '../utils/toast';

// =============================================================================
// KpiCard — metric display tile
// =============================================================================
function KpiCard({ title, value, icon, color, subtext, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="mt-2 h-8 w-14 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? 0}</p>
        )}
        {!loading && subtext && (
          <p className="text-xs text-slate-400 mt-1">{subtext}</p>
        )}
      </div>
      {/* Icon badge */}
      <div className={`p-3 ${color} rounded-xl`}>{icon}</div>
    </div>
  );
}

// =============================================================================
// SkeletonCard — loading placeholder for KPI tiles
// =============================================================================
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mb-3" />
      <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
    </div>
  );
}

// =============================================================================
// RecruiterDashboard — main page component
// =============================================================================
export default function RecruiterDashboard() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [kpis,         setKpis]         = useState(null);
  const [jobSummaries, setJobSummaries] = useState([]);
  const [volumeData,   setVolumeData]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());

  // Get the authenticated user from the dashboard layout context
  const { user } = useOutletContext();
  const navigate  = useNavigate();

  // ── Data loader ────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!user?.hr_id) {
      setError('Could not load HR user data. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parallel fetch: KPIs, job summaries, applicant volume chart data
      const [kpiData, summaryData, volData] = await Promise.all([
        getDashboardKpis(),
        getDashboardJobSummaries(),
        getDashboardApplicantVolume(),
      ]);
      setKpis(kpiData);
      setJobSummaries(summaryData);
      setVolumeData(volData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[RecruiterDashboard] fetch error:', err);
      const msg = 'Failed to load dashboard data. Please refresh.';
      setError(msg);
      Toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user]); // re-run if user changes

  // ── Navigate to applicants page pre-filtered by job ───────────────────────
  const handleViewApplicants = (jobId) => {
    navigate('/recruiter/applicants', { state: { preSelectedJobId: jobId } });
  };

  // Greeting based on time of day
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {greeting}{user?.firstname ? `, ${user.firstname}` : ''}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's your recruiting activity at a glance.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh dashboard"
          >
            <FiRefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/recruiter/manage-jobs')}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FiPlus size={14} />
            Post New Job
          </button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <FiAlertCircle className="flex-shrink-0" />
          {error}
          <button onClick={fetchAll} className="ml-auto underline text-xs hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {/* ── KPI metric grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          // Skeleton tiles while loading
          [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="Active Jobs"
              value={kpis?.active_jobs}
              icon={<FiBriefcase size={20} />}
              color="bg-blue-100 text-blue-600"
              subtext="Currently open positions"
            />
            <KpiCard
              title="Total Applicants"
              value={kpis?.total_applicants}
              icon={<FiUsers size={20} />}
              color="bg-purple-100 text-purple-600"
              subtext="Across all your jobs"
            />
            <KpiCard
              title="Pending Review"
              value={kpis?.pending_review}
              icon={<FiClock size={20} />}
              color={(kpis?.pending_review ?? 0) > 0
                ? 'bg-amber-100 text-amber-600'
                : 'bg-slate-100 text-slate-400'
              }
              subtext="Awaiting your decision"
            />
            <KpiCard
              title="Shortlisted"
              value={kpis?.shortlisted}
              icon={<FiCheckCircle size={20} />}
              color="bg-emerald-100 text-emerald-600"
              subtext="Ready for interview"
            />
          </>
        )}
      </div>

      {/* ── Main content: job table + volume chart ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Job Summaries Table — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Your Job Postings</h3>
            <button
              onClick={() => navigate('/recruiter/manage-jobs')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              Manage Jobs <FiArrowRight size={12} />
            </button>
          </div>

          {/* Table */}
          {loading ? (
            // Skeleton rows
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : jobSummaries.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <FiBriefcase className="text-4xl text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600 mb-1">No active jobs yet</p>
              <p className="text-xs text-slate-400 mb-4">Post your first job to start receiving applications.</p>
              <button
                onClick={() => navigate('/recruiter/manage-jobs')}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
              >
                <FiPlus size={13} /> Post a Job
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50">
                    {['Job Title', 'Applicants', 'Shortlisted', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobSummaries.map(job => (
                    <tr
                      key={job.job_id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleViewApplicants(job.job_id)}
                    >
                      {/* Job title */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{job.title}</p>
                        <p className="text-xs text-slate-400">{job.location || 'Remote'}</p>
                      </td>

                      {/* Applicant count */}
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                        {job.total_applicants ?? 0}
                      </td>

                      {/* Shortlisted count */}
                      <td className="px-4 py-3 text-sm text-emerald-600 font-semibold">
                        {job.shortlisted ?? 0}
                      </td>

                      {/* Active/Closed badge */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          job.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {job.is_active ? 'Active' : 'Closed'}
                        </span>
                      </td>

                      {/* View applicants button */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewApplicants(job.job_id); }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          View <FiArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Applicant Volume Chart — 1/3 width */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <ApplicantVolumeChart chartData={volumeData} loading={loading} />
        </div>
      </div>

      {/* ── Footer info ───────────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 flex flex-wrap gap-4 text-xs text-slate-400 items-center">
        <span className="flex items-center gap-1.5">
          <FiBarChart2 size={11} />
          Last refreshed: <span className="font-medium text-slate-600 ml-1">{lastRefresh.toLocaleTimeString()}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <FiTrendingUp size={11} /> XCalibr Recruiter Portal
        </span>
      </div>
    </div>
  );
}
