// src/pages/ManageJobsPage.jsx
// Week 7: Full CRUD Job Management — Create, Edit, Delete, Toggle Status
// All jobs shown in a rich card grid with per-job applicant count badge
// Replaces PostJobPage — add route: /recruiter/manage-jobs

import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  getJobsByHr,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
} from "../api/api";
import {
  FiPlus, FiEdit2, FiTrash2, FiLoader, FiBriefcase, FiCalendar,
  FiMapPin, FiCpu, FiCheckCircle, FiUsers, FiEye,
  FiToggleLeft, FiToggleRight, FiAlertTriangle, FiDollarSign, FiClock,
  FiSearch, FiFilter,
} from "react-icons/fi";

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ label, isEnabled, onToggle, disabled = false }) {
  return (
    <label className={`flex items-center justify-between gap-3 cursor-pointer select-none ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isEnabled ? "bg-primary" : "bg-slate-300"}`}
        onClick={onToggle}
      >
        <span className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isEnabled ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </label>
  );
}

// ─── Job Modal (Create / Edit) ────────────────────────────────────────────────
function JobModal({ job, hrId, onClose, onSave }) {
  const isEdit = !!job;

  const [form, setForm] = useState({
    title: job?.title || "",
    company_name: job?.company_name || "",
    location: job?.location || "",
    description: job?.description || "",
    requirements: job?.requirements || "",
    salary_range: job?.salary_range || "",
    employment_type: job?.employment_type || "Full-time",
    deadline: job?.deadline ? job.deadline.split("T")[0] : "",
    analyze_github: job?.analyze_github ?? true,
    analyze_leetcode: job?.analyze_leetcode ?? true,
    analyze_linkedin: job?.analyze_linkedin ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => () => setForm((f) => ({ ...f, [key]: !f[key] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, hr_id: hrId, deadline: form.deadline || null };
      if (isEdit) {
        await updateJob(job.job_id, payload);
      } else {
        await createJob(payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save job. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-dark flex items-center gap-2">
            {isEdit ? <><FiEdit2 className="text-primary" /> Edit Job</> : <><FiPlus className="text-primary" /> Post New Job</>}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition text-lg"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              <FiAlertTriangle className="flex-shrink-0" /> {error}
            </div>
          )}

          {/* Title & Company */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
              <input
                required
                value={form.title}
                onChange={set("title")}
                placeholder="e.g., Senior Full-Stack Developer"
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                required
                value={form.company_name}
                onChange={set("company_name")}
                placeholder="e.g., TechFlow Dynamics"
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Description *</label>
            <textarea
              required
              value={form.description}
              onChange={set("description")}
              rows={6}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none resize-none transition"
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Requirements</label>
            <textarea
              value={form.requirements}
              onChange={set("requirements")}
              rows={3}
              placeholder="e.g., Python, React, 3+ years experience..."
              className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none resize-none transition"
            />
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Location *</label>
              <input
                required
                value={form.location}
                onChange={set("location")}
                placeholder="Remote / City"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Salary Range</label>
              <input
                value={form.salary_range}
                onChange={set("salary_range")}
                placeholder="$80k–$100k"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={set("employment_type")}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:outline-none transition"
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={set("deadline")}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none transition"
              />
            </div>
          </div>

          {/* AI Toggles */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-dark flex items-center gap-2 mb-3">
              <FiCpu size={14} className="text-primary" /> AI Analysis Settings
            </h3>
            <div className="space-y-3">
              <ToggleSwitch label="Analyze GitHub Profile" isEnabled={form.analyze_github} onToggle={toggle("analyze_github")} />
              <ToggleSwitch label="Analyze LeetCode Profile" isEnabled={form.analyze_leetcode} onToggle={toggle("analyze_leetcode")} />
              <ToggleSwitch label="Analyze LinkedIn PDF" isEnabled={form.analyze_linkedin} onToggle={toggle("analyze_linkedin")} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
            >
              {saving ? <><FiLoader className="animate-spin" /> Saving…</> : isEdit ? "Save Changes" : "Post Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ job, onClose, onConfirm, loading }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto mb-4">
          <FiTrash2 className="text-red-600" size={24} />
        </div>
        <h2 className="text-lg font-bold text-dark text-center">Delete Job Posting?</h2>
        <p className="text-sm text-slate-500 text-center mt-2">
          <strong>"{job?.title}"</strong> and all its applicant data will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
          >
            {loading ? <FiLoader className="animate-spin" size={14} /> : <FiTrash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onEdit, onDelete, onToggleStatus, onViewApplicants, togglingId }) {
  const isActive = job.status === "Active";
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all duration-200 flex flex-col ${isActive ? "border-slate-200 hover:border-primary/40 hover:shadow-lg" : "border-slate-100 opacity-70"}`}>
      <div className="p-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-dark text-base">{job.title}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{job.company_name}</p>
          </div>
          {/* Applicant badge */}
          <div className="flex-shrink-0 text-center bg-primary/10 rounded-xl px-3 py-2 min-w-[52px]">
            <p className="text-xl font-black text-primary leading-none">{job.applicant_count ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Applicants</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1"><FiMapPin size={11} /> {job.location}</span>
          )}
          {job.employment_type && (
            <span className="flex items-center gap-1"><FiBriefcase size={11} /> {job.employment_type}</span>
          )}
          {job.salary_range && (
            <span className="flex items-center gap-1"><FiDollarSign size={11} /> {job.salary_range}</span>
          )}
          {daysLeft !== null && (
            <span className={`flex items-center gap-1 font-medium ${daysLeft < 3 ? "text-red-500" : daysLeft < 7 ? "text-orange-500" : "text-slate-500"}`}>
              <FiClock size={11} />
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Closes today" : "Expired"}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FiCalendar size={11} /> {new Date(job.date_posted).toLocaleDateString()}
          </span>
        </div>

        {/* AI analysis badges */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {[
            { label: "GitHub", enabled: job.analyze_github },
            { label: "LeetCode", enabled: job.analyze_leetcode },
            { label: "LinkedIn", enabled: job.analyze_linkedin },
          ].map(({ label, enabled }) => (
            <span
              key={label}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"}`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Description preview */}
        <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">{job.description}</p>
      </div>

      {/* Action bar */}
      <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => onViewApplicants(job.job_id, job.title)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition"
          >
            <FiUsers size={12} /> Applicants
          </button>
          <button
            onClick={() => onEdit(job)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
          >
            <FiEdit2 size={12} /> Edit
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleStatus(job)}
            disabled={togglingId === job.job_id}
            title={isActive ? "Pause job" : "Activate job"}
            className={`p-2 rounded-lg text-xs transition disabled:opacity-50 ${isActive ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
          >
            {togglingId === job.job_id
              ? <FiLoader className="animate-spin" size={14} />
              : isActive ? <FiToggleLeft size={14} /> : <FiToggleRight size={14} />}
          </button>
          <button
            onClick={() => onDelete(job)}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ jobs }) {
  const total = jobs.length;
  const active = jobs.filter(j => j.status === "Active").length;
  const closed = jobs.filter(j => j.status !== "Active").length;
  const totalApps = jobs.reduce((a, j) => a + (j.applicant_count ?? 0), 0);

  const stats = [
    { label: "Total Jobs", value: total, color: "text-dark" },
    { label: "Active", value: active, color: "text-green-600" },
    { label: "Closed", value: closed, color: "text-slate-500" },
    { label: "Total Applicants", value: totalApps, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManageJobsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const hr_id = user?.hr_id;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const loadJobs = useCallback(async () => {
    if (!hr_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJobsByHr(hr_id);
      setJobs(data);
    } catch {
      setError("Failed to load jobs. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [hr_id]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleEdit = (job) => { setEditingJob(job); setShowModal(true); };
  const handleCreate = () => { setEditingJob(null); setShowModal(true); };

  const handleModalSave = () => {
    setShowModal(false);
    setEditingJob(null);
    loadJobs();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJob(deleteTarget.job_id);
      setDeleteTarget(null);
      loadJobs();
    } catch {
      Toast.error('Failed to delete job. It may have active applications.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (job) => {
    setTogglingId(job.job_id);
    const newStatus = job.status === "Active" ? "Closed" : "Active";
    try {
      await toggleJobStatus(job.job_id, newStatus);
      setJobs(prev => prev.map(j => j.job_id === job.job_id ? { ...j, status: newStatus } : j));
    } catch {
      Toast.error('Failed to toggle job status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleViewApplicants = (jobId, jobTitle) => {
    navigate("/recruiter/applicants", { state: { preSelectedJobId: jobId, preSelectedJobTitle: jobTitle } });
  };

  const displayedJobs = jobs
    .filter(j => filter === "All" || j.status === filter)
    .filter(j =>
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      j.location?.toLowerCase().includes(search.toLowerCase())
    );

  if (!hr_id) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">No HR session found. Please log in again.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-dark">Manage Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, and manage all your job postings in one place.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition shadow-sm"
        >
          <FiPlus size={18} /> Post New Job
        </button>
      </div>

      {/* Stats */}
      {jobs.length > 0 && <StatsBar jobs={jobs} />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <FiAlertTriangle className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {["All", "Active", "Closed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${filter === f ? "bg-white text-dark shadow-sm" : "text-slate-500 hover:text-dark"}`}
            >
              {f}
              {f !== "All" && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${f === "Active" ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-500"}`}>
                  {jobs.filter(j => j.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-48 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, company, or location…"
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>
      </div>

      {/* Job Grid */}
      {loading ? (
        <div className="flex justify-center items-center p-16">
          <FiLoader className="animate-spin text-3xl text-primary" />
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiBriefcase className="text-slate-400" size={28} />
          </div>
          <p className="text-slate-600 font-semibold">
            {jobs.length === 0 ? "No job postings yet" : "No jobs match your filter"}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {jobs.length === 0 ? "Create your first job posting to start receiving applicants." : "Try adjusting your search or filter."}
          </p>
          {jobs.length === 0 && (
            <button
              onClick={handleCreate}
              className="mt-5 px-6 py-2.5 bg-primary text-white font-semibold rounded-xl text-sm hover:bg-primary-dark transition"
            >
              Post First Job
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedJobs.map(job => (
            <JobCard
              key={job.job_id}
              job={job}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onToggleStatus={handleToggleStatus}
              onViewApplicants={handleViewApplicants}
              togglingId={togglingId}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <JobModal
          job={editingJob}
          hrId={hr_id}
          onClose={() => { setShowModal(false); setEditingJob(null); }}
          onSave={handleModalSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          job={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
