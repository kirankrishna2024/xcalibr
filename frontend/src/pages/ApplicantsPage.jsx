// =============================================================================
// src/pages/ApplicantsPage.jsx — Week 9: Toast notifications + UI fixes
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ All alert() replaced with Toast.success/error/warning/info
//  ✅ Resume "open in new window" fixed with authenticated blob fetch
//  ✅ Shortlist / Reject toast confirmations with feedback hint
//  ✅ Analysis queue toast with count summary
//  ✅ Full inline comments on all new code sections
// =============================================================================
// src/pages/ApplicantsPage.jsx — Week 8
// KEY FIXES & NEW FEATURES:
//   ✅ Multi-job isolation: jobDataMap scopes ALL state per job_id
//   ✅ No cross-job score bleed — switching jobs resets cleanly
//   ✅ Resume inline preview modal (PDF iframe + fallback)
//   ✅ Real-time pipeline: 3s polling per-job, only for that job's active apps
//   ✅ Enhanced AI profile parsing: skills, experience, JD match, certs
//   ✅ Improved fraud detection logic
//   ✅ Concurrent analysis: multiple jobs can have active analysis simultaneously
//   ✅ Better score display with quality color coding
//   ✅ WEEK 8: Dedicated Shortlist endpoint (POST /applications/{id}/shortlist)
//   ✅ WEEK 8: Dedicated Reject endpoint (POST /applications/{id}/reject)

import { useEffect, useState, useCallback, useRef } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import {
  getJobsByHr,
  getRankedApplicantsForJob,
  retryAnalysis,
  checkOllamaHealth,
  getAnalysisStatus,
  updateApplicationStatus,
  shortlistApplication,  // Week 8
  rejectApplication,     // Week 8
  getCvPreviewUrl,       // CV preview via authenticated endpoint
  BASE_URL,
} from "../api/api";
import {
  FiLoader, FiRefreshCw, FiAlertCircle, FiCheckCircle,
  FiXCircle, FiClock, FiAlertTriangle, FiChevronDown, FiChevronUp,
  FiZap, FiFileText, FiEye, FiUser, FiCode, FiAward, FiUsers,
  FiThumbsUp, FiThumbsDown,
} from "react-icons/fi";
import Toast from '../utils/toast';


// ─── Pipeline configuration ───────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: "careerscore",    label: "Career Readiness", max: 100, color: "bg-emerald-500",  track: "bg-emerald-100",  icon: "🎓" },
  { key: "trustscore",     label: "Trust Index",       max: 50,  color: "bg-purple-500",   track: "bg-purple-100",   icon: "🛡" },
  { key: "linkedinscore",  label: "LinkedIn",          max: 50,  color: "bg-sky-500",      track: "bg-sky-100",      icon: "💼" },
  { key: "githubscore",    label: "GitHub",            max: 100, color: "bg-slate-700",    track: "bg-slate-100",    icon: "🐙" },
  { key: "leetcodescore",  label: "LeetCode",          max: 100, color: "bg-orange-500",   track: "bg-orange-100",   icon: "⚡" },
  { key: "jd_match_score", label: "JD Match",          max: 100, color: "bg-blue-500",     track: "bg-blue-100",     icon: "📋" },
];
const TOTAL_MAX = PIPELINE_STEPS.reduce((a, s) => a + s.max, 0); // 500

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeParseJson(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return null; }
}

function detectFraud(app) {
  if (app.fraud_flagged) return { isFraud: true, reason: app.fraud_reason || "Flagged by system." };
  const { trustscore: t = 0, careerscore: c = 0, overall_score: o = 0, analysis_status: s } = app;
  if (s === "Completed") {
    if (t <= 5 && c <= 10 && o <= 20) return { isFraud: true, reason: "Extremely low Trust & Career scores — profile unverifiable." };
    if (t === 0 && o === 0) return { isFraud: true, reason: "Zero trust & overall score — likely fabricated profile." };
  }
  return { isFraud: false, reason: null };
}

function scoreQuality(pct) {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-500";
}

// ─── Resume Preview Modal ─────────────────────────────────────────────────────
// Fetches the CV with the HR auth token, then creates a local blob URL for the
// iframe — avoids CORS/auth issues when the endpoint is protected.
function ResumeModal({ url, name, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fetchingBlob, setFetchingBlob] = useState(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    let objectUrl = null;
    const fetchBlob = async () => {
      setFetchingBlob(true);
      setLoadError(null);
      try {
        const token = localStorage.getItem("hr_token");
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Server returned ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        setLoadError(e.message || "Could not load resume.");
      } finally {
        setFetchingBlob(false);
      }
    };
    if (url) fetchBlob();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]); // eslint-disable-line

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${(name || "resume").replace(/[^a-z0-9]/gi, "_")}.pdf`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl h-[88vh] shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-bold text-dark flex items-center gap-2 truncate">
            <FiFileText className="text-primary flex-shrink-0" />
            <span className="truncate">{name || "Resume Preview"}</span>
          </h3>
          <div className="flex gap-2 flex-shrink-0">
            {blobUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition"
              >
                ⬇ Download
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100 rounded-b-2xl">
          {fetchingBlob ? (
            <div className="flex items-center justify-center h-full gap-3 text-slate-500">
              <FiLoader className="animate-spin" size={20} /> Loading resume…
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiAlertCircle size={28} className="text-red-500" />
                </div>
                <p className="text-red-600 font-semibold">Could not load resume</p>
                <p className="text-slate-400 text-sm mt-1">{loadError}</p>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe src={blobUrl} className="w-full h-full border-0" title="Resume Preview" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, isFraud }) {
  if (isFraud) return (
    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1 whitespace-nowrap">
      <FiAlertTriangle size={10} /> Fraud
    </span>
  );
  const map = {
    Completed:     { cls: "bg-green-100 text-green-700",   ic: <FiCheckCircle size={10} /> },
    Pending:       { cls: "bg-blue-100 text-blue-700",     ic: <FiClock size={10} /> },
    "In Progress": { cls: "bg-yellow-100 text-yellow-700", ic: <FiLoader className="animate-spin" size={10} /> },
    Failed:        { cls: "bg-red-100 text-red-700",       ic: <FiXCircle size={10} /> },
  };
  const s = map[status] || { cls: "bg-slate-100 text-slate-600", ic: null };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap ${s.cls}`}>
      {s.ic} {status}
    </span>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────
function StepBar({ step, score, analysisStatus, currentStep, isFailed, onRetry, retrying }) {
  const hasScore = score !== null && score !== undefined;
  const isActive = currentStep && currentStep.toLowerCase().includes(step.label.toLowerCase());
  const pct = hasScore ? Math.min((score / step.max) * 100, 100) : 0;
  const isPending = analysisStatus === "Pending" || analysisStatus === "In Progress";

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1.5 gap-2">
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5 min-w-0">
          <span>{step.icon}</span>
          <span className="truncate">{step.label}</span>
          {hasScore && analysisStatus !== "Completed" && (
            <span className="text-xs text-emerald-600 font-semibold ml-1 flex-shrink-0">✓</span>
          )}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!hasScore && isPending && (
            isActive
              ? <span className="text-xs text-yellow-600 flex items-center gap-1"><FiLoader className="animate-spin" size={10} /> Running…</span>
              : <span className="text-xs text-slate-400">Queued</span>
          )}
          {!hasScore && isFailed && <span className="text-xs text-red-500">—</span>}
          <span className={`font-bold text-sm ${hasScore ? scoreQuality(pct) : "text-slate-400"}`}>
            {hasScore ? score : (isFailed ? "0" : "—")} / {step.max}
            {hasScore && <span className="text-xs text-slate-400 ml-1">({pct.toFixed(0)}%)</span>}
          </span>
          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-full font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {retrying ? <FiLoader className="animate-spin" size={10} /> : <FiRefreshCw size={10} />} Retry
            </button>
          )}
        </div>
      </div>
      <div className={`w-full ${step.track} rounded-full h-2.5 overflow-hidden`}>
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${
            !hasScore && isFailed ? "bg-red-300" :
            !hasScore && isPending ? (isActive ? `${step.color} animate-pulse` : "bg-slate-200") :
            step.color
          }`}
          style={{ width: hasScore ? `${pct}%` : isActive ? "15%" : "0%" }}
        />
      </div>
    </div>
  );
}

// ─── AI Summary Section ───────────────────────────────────────────────────────
function AISummarySection({ remarks }) {
  const data = safeParseJson(remarks);
  if (!data) return null;
  if (!data.candidate_name && !Array.isArray(data.technical_skill)) return null;

  const skills = Array.isArray(data.technical_skill) ? data.technical_skill : [];
  const soft = Array.isArray(data.soft_skill) ? data.soft_skill : [];
  const exp = Array.isArray(data.experience) ? data.experience : [];
  const certs = Array.isArray(data.certifications) ? data.certifications : [];
  const edu = Array.isArray(data.degree) ? data.degree : [];
  const jdMatch = data.jd_match;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
        <FiUser size={11} /> AI Parsed Candidate Profile
      </p>

      {/* Identity */}
      {(data.candidate_name || data.email || edu.length > 0) && (
        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
          {data.candidate_name && <p className="font-bold text-dark text-sm">{data.candidate_name}</p>}
          {data.email && <p className="text-slate-500">{data.email}</p>}
          {edu.length > 0 && (
            <p className="text-slate-600 flex items-center gap-1">
              <FiAward size={11} className="text-amber-500" />
              {edu.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Technical Skills */}
      {skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <FiCode size={11} /> Technical Skills ({skills.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 20).map((s, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{s}</span>
            ))}
            {skills.length > 20 && <span className="text-xs text-slate-400 px-1">+{skills.length - 20} more</span>}
          </div>
        </div>
      )}

      {/* Soft Skills */}
      {soft.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Soft Skills</p>
          <div className="flex flex-wrap gap-1">
            {soft.slice(0, 8).map((s, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {exp.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Experience ({exp.length} roles)</p>
          <div className="space-y-1.5">
            {exp.slice(0, 4).map((e, i) => (
              <div key={i} className="text-xs text-slate-600 flex gap-1.5 items-start">
                <span className="text-slate-300 mt-0.5">▸</span>
                <span>
                  <strong>{e.title || e.role || "Role"}</strong>
                  {e.company && <span className="text-slate-400"> @ {e.company}</span>}
                  {e.duration_months && (
                    <span className="text-slate-400"> · {Math.round(e.duration_months)}mo</span>
                  )}
                </span>
              </div>
            ))}
            {exp.length > 4 && <p className="text-xs text-slate-400 pl-4">+{exp.length - 4} more roles</p>}
          </div>
        </div>
      )}

      {/* Certifications */}
      {certs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {certs.slice(0, 6).map((c, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">🏅 {c}</span>
          ))}
          {certs.length > 6 && <span className="text-xs text-slate-400">+{certs.length - 6}</span>}
        </div>
      )}

      {/* JD Match */}
      {jdMatch && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-blue-700 text-sm">📋 JD Match Score</p>
            <p className={`font-black text-lg ${scoreQuality((jdMatch.match_score ?? 0))}`}>
              {jdMatch.match_score ?? "—"}%
            </p>
          </div>
          {jdMatch.matched_skills?.length > 0 && (
            <div>
              <p className="text-emerald-600 font-semibold mb-1">✓ Matched ({jdMatch.matched_skills.length}):</p>
              <div className="flex flex-wrap gap-1">
                {jdMatch.matched_skills.slice(0, 8).map((s, i) => (
                  <span key={i} className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs">{s}</span>
                ))}
                {jdMatch.matched_skills.length > 8 && <span className="text-emerald-500">+{jdMatch.matched_skills.length - 8}</span>}
              </div>
            </div>
          )}
          {jdMatch.missing_skills?.length > 0 && (
            <div>
              <p className="text-red-500 font-semibold mb-1">✗ Missing ({jdMatch.missing_skills.length}):</p>
              <div className="flex flex-wrap gap-1">
                {jdMatch.missing_skills.slice(0, 8).map((s, i) => (
                  <span key={i} className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-xs">{s}</span>
                ))}
                {jdMatch.missing_skills.length > 8 && <span className="text-red-400">+{jdMatch.missing_skills.length - 8}</span>}
              </div>
            </div>
          )}
          {jdMatch.summary && (
            <p className="text-blue-600 italic leading-relaxed">{jdMatch.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline card (one applicant) ───────────────────────────────────────────
function PipelineCard({ app, liveData, onRetry, retryingId, onPreviewResume, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Merge live polling data over stored data
  const merged = { ...app, ...(liveData || {}) };
  const { isFraud, reason: fraudReason } = detectFraud(merged);
  const status = merged.analysis_status;
  const isCompleted = status === "Completed";
  const isPending   = status === "Pending" || status === "In Progress";
  const isFailed    = status === "Failed";
  const currentStep = liveData?.current_step || null;
  const isRejection = liveData?.is_rejection || false;

  const completedSteps = PIPELINE_STEPS.filter(s => merged[s.key] != null).length;
  const partialTotal   = PIPELINE_STEPS.reduce((a, s) => a + (merged[s.key] || 0), 0);
  const overallScore   = merged.overall_score ?? (isPending ? partialTotal : 0);
  const overallPct     = Math.min((overallScore / TOTAL_MAX) * 100, 100);

  const rankColors = ["", "bg-yellow-400 text-white", "bg-slate-400 text-white", "bg-amber-600 text-white"];
  const rankBg = rankColors[merged.rank] || "bg-slate-200 text-slate-500";

  // Card border & bg
  const cardClass = isFraud
    ? "border-red-400 bg-red-50"
    : isCompleted
    ? "border-slate-200 bg-white hover:border-primary/40 hover:shadow-md"
    : isPending
    ? "border-blue-200 bg-blue-50/20"
    : isFailed
    ? "border-orange-200 bg-orange-50/10"
    : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${cardClass}`}>

      {/* Banners */}
      {isFraud && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-bold">
          <FiAlertTriangle size={16} /> ⚠ FRAUD DETECTED — Profile flagged for review
        </div>
      )}
      {isFailed && isRejection && !isFraud && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-bold">
          <FiXCircle size={14} /> REJECTED — Does not meet minimum criteria
        </div>
      )}
      {isPending && currentStep && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium">
          <FiLoader className="animate-spin flex-shrink-0" size={12} />
          <span className="truncate flex-1">{currentStep}</span>
          <span className="ml-auto text-blue-200 flex-shrink-0">{completedSteps}/{PIPELINE_STEPS.length} steps</span>
        </div>
      )}

      <div className="p-4">
        {/* Top row: rank + identity + score + actions */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Rank badge or status indicator */}
            {isCompleted && merged.rank && !isFraud ? (
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${rankBg}`}>
                #{merged.rank}
              </div>
            ) : (
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                isFraud ? "bg-red-200 text-red-700" :
                isPending ? "bg-blue-100 text-blue-500" :
                isFailed ? "bg-orange-100 text-orange-500" :
                "bg-slate-100 text-slate-400"
              }`}>
                {isFraud ? "❌" : isPending ? <FiLoader className="animate-spin" size={14} /> : isFailed ? "!" : "—"}
              </div>
            )}

            <div className="min-w-0">
              <p className="font-bold text-dark">{merged.candidate_name}</p>
              <p className="text-sm text-slate-500 truncate">{merged.candidate_email}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Applied: {new Date(merged.applied_on).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={status} isFraud={isFraud} />

            {/* Score badge */}
            {(isCompleted || (isPending && completedSteps > 0)) && (
              <div className={`text-center px-3 py-1.5 rounded-xl min-w-[60px] ${
                isFraud ? "bg-red-100" :
                isPending ? "bg-blue-50 border border-blue-200" :
                "bg-primary/10"
              }`}>
                <p className={`text-xl font-black leading-none ${
                  isFraud ? "text-red-600" :
                  isPending ? "text-blue-600" :
                  "text-primary"
                }`}>{overallScore}</p>
                <p className="text-xs text-slate-400 mt-0.5">{isPending ? "so far" : `/ ${TOTAL_MAX}`}</p>
              </div>
            )}

            {/* CV preview button */}
            {merged.cv_path && (
              <button
                onClick={() => onPreviewResume(getCvPreviewUrl(merged.application_id), merged.candidate_name)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                title="Preview Resume"
              >
                <FiFileText size={12} /> CV
              </button>
            )}

            <button
              onClick={() => setExpanded(v => !v)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>

            {(isFailed || isFraud) && (
              <button
                onClick={() => onRetry(merged.application_id)}
                disabled={retryingId === merged.application_id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 text-sm font-semibold rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
              >
                {retryingId === merged.application_id ? <FiLoader className="animate-spin" size={13} /> : <FiRefreshCw size={13} />}
                Retry
              </button>
            )}

            {/* ── Shortlist / Reject actions ── */}
            {isCompleted && !isFraud && (
              <>
                {merged.status !== "Shortlisted" && (
                  <button
                    onClick={async () => {
                      setStatusUpdating(true);
                      await onStatusChange(merged.application_id, "Shortlisted");
                      setStatusUpdating(false);
                    }}
                    disabled={statusUpdating || merged.status === "Rejected"}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-200 transition disabled:opacity-50"
                    title="Shortlist this candidate"
                  >
                    {statusUpdating ? <FiLoader className="animate-spin" size={13} /> : <FiThumbsUp size={13} />}
                    Shortlist
                  </button>
                )}
                {merged.status === "Shortlisted" && (
                  <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg">
                    <FiCheckCircle size={13} /> Shortlisted
                  </span>
                )}
                {merged.status !== "Rejected" && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Reject ${merged.candidate_name}? This will also send an automated rejection notification.`)) return;
                      setStatusUpdating(true);
                      await onStatusChange(merged.application_id, "Rejected");
                      setStatusUpdating(false);
                    }}
                    disabled={statusUpdating || merged.status === "Shortlisted"}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                    title="Reject this candidate"
                  >
                    {statusUpdating ? <FiLoader className="animate-spin" size={13} /> : <FiThumbsDown size={13} />}
                    Reject
                  </button>
                )}
                {merged.status === "Rejected" && (
                  <span className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-lg">
                    <FiXCircle size={13} /> Rejected
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Overall progress bar (completed only) */}
        {isCompleted && (
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-1000 ${
                  isFraud ? "bg-red-400" :
                  overallPct >= 60 ? "bg-emerald-500" :
                  overallPct >= 35 ? "bg-amber-500" :
                  "bg-red-400"
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 text-right">
              {overallScore} / {TOTAL_MAX} ({overallPct.toFixed(0)}%)
            </p>
          </div>
        )}

        {/* Fraud & rejection reason */}
        {isFraud && fraudReason && (
          <p className="mt-2 text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">🔍 {fraudReason}</p>
        )}
        {isFailed && isRejection && liveData?.error_reason && (
          <p className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            ℹ️ {liveData.error_reason}
          </p>
        )}

        {/* Expanded section */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Score Breakdown
              {isPending && <span className="text-blue-500 normal-case font-normal ml-2">— live updates every 3s</span>}
            </p>

            {PIPELINE_STEPS.map(step => (
              <StepBar
                key={step.key}
                step={step}
                score={merged[step.key]}
                analysisStatus={status}
                currentStep={currentStep}
                isFailed={isFailed && merged[step.key] == null}
                onRetry={() => onRetry(merged.application_id)}
                retrying={retryingId === merged.application_id}
              />
            ))}

            {/* Technical failure message */}
            {isFailed && !isRejection && liveData?.error_reason && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
                <p className="font-semibold mb-1">Technical Failure</p>
                <p className="font-mono break-words leading-relaxed">{liveData.error_reason}</p>
                <p className="mt-2">Make sure Ollama is running: <code className="bg-orange-100 px-1.5 py-0.5 rounded">ollama serve</code></p>
              </div>
            )}

            {/* AI parsed profile */}
            {isCompleted && merged.remarks && (
              <AISummarySection remarks={merged.remarks} />
            )}

            {/* Resume links */}
            {merged.cv_path && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => onPreviewResume(getCvPreviewUrl(merged.application_id), merged.candidate_name)}
                  className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition font-semibold"
                >
                  <FiEye size={12} /> Preview Resume
                </button>
                <a
                  href={getCvPreviewUrl(merged.application_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  📄 Open in New Tab
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ollama health banner ─────────────────────────────────────────────────────
function OllamaBanner({ health }) {
  if (!health) return null;
  const ok = health.ollama_running && health.model_available;
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3 text-sm border ${ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
      {ok
        ? <FiCheckCircle className="mt-0.5 flex-shrink-0" />
        : <FiAlertCircle className="mt-0.5 flex-shrink-0" />}
      <span>{health.status_message}</span>
    </div>
  );
}

// ─── Pipeline legend ──────────────────────────────────────────────────────────
function PipelineLegend() {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="text-xs text-slate-400 font-medium">Pipeline:</span>
      {PIPELINE_STEPS.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500">
          <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
          {s.icon} {s.label}
          {i < PIPELINE_STEPS.length - 1 && <span className="ml-1 text-slate-300">→</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ApplicantsPage() {
  const location = useLocation();
  const { user } = useOutletContext();
  const hr_id = user?.hr_id;

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobTitle, setSelectedJobTitle] = useState("");

  // ⭐ WEEK 7 CORE FIX: Each job gets its own isolated slice
  // { [job_id]: { applicants[], liveMap{app_id: liveData}, isLoading, pageError } }
  const [jobDataMap, setJobDataMap] = useState({});

  const [ollamaHealth, setOllamaHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [resumeModal, setResumeModal] = useState(null); // { url, name }

  // One poll interval ref PER job — we manage them in a map
  const pollRefs = useRef({});

  const EMPTY = { applicants: [], liveMap: {}, isLoading: false, pageError: null };

  const currentData = selectedJobId ? (jobDataMap[selectedJobId] || EMPTY) : EMPTY;
  const { applicants, liveMap, isLoading, pageError } = currentData;

  // Patch only one job's slice without touching others
  const patchJob = useCallback((jobId, patch) => {
    setJobDataMap(prev => ({
      ...prev,
      [jobId]: { ...(prev[jobId] || EMPTY), ...patch },
    }));
  }, []); // eslint-disable-line

  // Load applicants for a specific job
  const loadApplicants = useCallback(async (jobId, jobTitle) => {
    setSelectedJobId(jobId);
    setSelectedJobTitle(jobTitle);
    patchJob(jobId, { isLoading: true, pageError: null });
    try {
      const res = await getRankedApplicantsForJob(jobId);
      patchJob(jobId, { applicants: res.rankings || [], liveMap: {}, isLoading: false });
    } catch {
      patchJob(jobId, { pageError: "Failed to load applicants for this job.", isLoading: false });
    }
  }, [patchJob]);

  // Load jobs on mount + handle pre-selection from navigation state
  useEffect(() => {
    if (!hr_id) return;
    (async () => {
      try {
        const myJobs = await getJobsByHr(hr_id);
        setJobs(myJobs);
        const preId    = location.state?.preSelectedJobId;
        const preTitle = location.state?.preSelectedJobTitle;
        if (preId) {
          const match = myJobs.find(j => j.job_id === preId);
          if (match) { loadApplicants(preId, preTitle || match.title); return; }
        }
        if (myJobs.length > 0) loadApplicants(myJobs[0].job_id, myJobs[0].title);
      } catch { /* silent */ }
    })();
  }, [hr_id]); // eslint-disable-line

  // ⭐ POLLING: Start/stop polling for a job when its active app count changes.
  //    Key insight: we track the poll interval by jobId, so MULTIPLE jobs can
  //    be polling concurrently — each job's interval only updates that job's slice.
  useEffect(() => {
    if (!selectedJobId) return;

    const jobApps = jobDataMap[selectedJobId]?.applicants || [];
    const activeApps = jobApps.filter(
      a => a.analysis_status === "Pending" || a.analysis_status === "In Progress"
    );

    // Clear existing poll for this job
    if (pollRefs.current[selectedJobId]) {
      clearInterval(pollRefs.current[selectedJobId]);
      delete pollRefs.current[selectedJobId];
    }

    if (activeApps.length === 0) return;

    const capturedJobId    = selectedJobId;
    const capturedJobTitle = selectedJobTitle;

    pollRefs.current[capturedJobId] = setInterval(async () => {
      const results = await Promise.allSettled(
        activeApps.map(a => getAnalysisStatus(a.application_id))
      );

      // Build updated live map and applicant list for THIS job only
      setJobDataMap(prev => {
        const jobSlice = prev[capturedJobId] || EMPTY;
        const snapLiveMap = { ...jobSlice.liveMap };
        let anyDone = false;

        results.forEach((r, i) => {
          if (r.status !== "fulfilled") return;
          snapLiveMap[activeApps[i].application_id] = r.value;
          if (r.value.analysis_status === "Completed" || r.value.analysis_status === "Failed") {
            anyDone = true;
          }
        });

        const updatedApps = jobSlice.applicants.map(app => {
          const idx = activeApps.findIndex(a => a.application_id === app.application_id);
          if (idx === -1 || results[idx]?.status !== "fulfilled") return app;
          const d = results[idx].value;
          return {
            ...app,
            analysis_status:  d.analysis_status,
            careerscore:       d.careerscore       ?? app.careerscore,
            trustscore:        d.trustscore        ?? app.trustscore,
            linkedinscore:     d.linkedinscore     ?? app.linkedinscore,
            githubscore:       d.githubscore       ?? app.githubscore,
            leetcodescore:     d.leetcodescore     ?? app.leetcodescore,
            jd_match_score:    d.jd_match_score    ?? app.jd_match_score,
            overall_score:     d.overall_score     ?? app.overall_score,
          };
        });

        if (anyDone) {
          // Stop this job's polling and schedule a full reload
          clearInterval(pollRefs.current[capturedJobId]);
          delete pollRefs.current[capturedJobId];
          setTimeout(() => loadApplicants(capturedJobId, capturedJobTitle), 1500);
        }

        return {
          ...prev,
          [capturedJobId]: { ...jobSlice, liveMap: snapLiveMap, applicants: updatedApps },
        };
      });
    }, 3000);

    return () => {
      if (pollRefs.current[capturedJobId]) {
        clearInterval(pollRefs.current[capturedJobId]);
        delete pollRefs.current[capturedJobId];
      }
    };
  // Re-run when the set of active application IDs or their statuses changes
  }, [selectedJobId, selectedJobTitle,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify((jobDataMap[selectedJobId]?.applicants || []).map(a => `${a.application_id}:${a.analysis_status}`))
  ]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(id => clearInterval(id));
    };
  }, []);

  const handleCheckOllama = async () => {
    setHealthLoading(true);
    try {
      setOllamaHealth(await checkOllamaHealth());
    } catch {
      setOllamaHealth({ ollama_running: false, model_available: false, status_message: "Could not reach backend." });
    } finally {
      setHealthLoading(false);
    }
  };

  const handleRetry = async (appId) => {
    setRetryingId(appId);
    try {
      const h = await checkOllamaHealth();
      if (!h.ollama_running || !h.model_available) {
        Toast.error(h.status_message, { title: 'AI Engine Not Ready' });
        return;
      }
      await retryAnalysis(appId);
      patchJob(selectedJobId, {
        applicants: applicants.map(a =>
          a.application_id === appId ? { ...a, analysis_status: "Pending" } : a
        ),
        liveMap: { ...liveMap, [appId]: { current_step: "Queued for retry…", analysis_status: "Pending" } },
      });
    } catch (err) {
      Toast.error(err.response?.data?.detail || err.message, { title: 'Retry Failed' });
    } finally {
      setRetryingId(null);
    }
  };

  // Week 8: use dedicated shortlist/reject endpoints; fall back to generic for others
  const handleStatusChange = async (appId, newStatus) => {
    try {
      if (newStatus === "Shortlisted") {
        await shortlistApplication(appId);
      } else if (newStatus === "Rejected") {
        await rejectApplication(appId);
      } else {
        await updateApplicationStatus(appId, newStatus);
      }
      // Update local state so UI reflects the change immediately
      patchJob(selectedJobId, {
        applicants: applicants.map(a =>
          a.application_id === appId ? { ...a, status: newStatus } : a
        ),
      });
      // Show success toast for shortlist action
      if (newStatus === "Shortlisted") {
        const app = applicants.find(a => a.application_id === appId);
        if (app) Toast.success(`${app.candidate_name} shortlisted!`, { title: "Shortlisted ⭐" });
      }
      // If rejected, prompt to send feedback notification
      if (newStatus === "Rejected") {
        const app = applicants.find(a => a.application_id === appId);
        if (app) {
          // Toast: inform recruiter the action succeeded + hint about feedback
          Toast.success(`${app.candidate_name} marked as Rejected.`, { title: 'Status Updated' });
          Toast.info('Go to Feedback → Send Feedback to notify them.', { duration: 6000 });
        }
      }
    } catch (err) {
      Toast.error(err.response?.data?.detail || err.message, { title: 'Status Update Failed' });
    }
  };

  const handleAnalyzePending = async () => {
    if (!selectedJobId) return;
    setHealthLoading(true);
    let h;
    try { h = await checkOllamaHealth(); setOllamaHealth(h); }
    catch { h = { ollama_running: false, model_available: false }; }
    finally { setHealthLoading(false); }

    if (!h.ollama_running || !h.model_available) {
      Toast.warning(h.status_message, { title: 'AI Engine Not Ready' });
      return;
    }

    const toProcess = applicants.filter(
      a => a.analysis_status === "Pending" || a.analysis_status === "Failed"
    );
    if (!toProcess.length) {
      Toast.info('No pending or failed analyses to run.');
      return;
    }

    setIsAnalyzing(true);
    let ok = 0, fail = 0;
    for (const app of toProcess) {
      try { await retryAnalysis(app.application_id); ok++; }
      catch { fail++; }
    }
    setIsAnalyzing(false);

    if (ok > 0) {
      patchJob(selectedJobId, {
        applicants: applicants.map(a =>
          (a.analysis_status === "Pending" || a.analysis_status === "Failed")
            ? { ...a, analysis_status: "Pending" }
            : a
        ),
      });
    }
    // Toast summary of batch analysis queue results
    if (ok > 0) Toast.success(`Queued ${ok} applicant(s) for analysis.`);
    if (fail > 0) Toast.error(`${fail} applicant(s) failed to queue.`);
  };

  if (!hr_id) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">No HR session found. Please log in.</div>
      </div>
    );
  }

  // Stats for selected job
  const pendingCount   = applicants.filter(a => ["Pending","Failed"].includes(a.analysis_status)).length;
  const activeCount    = applicants.filter(a => ["Pending","In Progress"].includes(a.analysis_status)).length;
  const completedCount = applicants.filter(a => a.analysis_status === "Completed").length;
  const fraudCount     = applicants.filter(a => detectFraud(a).isFraud).length;
  const topScore       = applicants.length > 0 ? Math.max(0, ...applicants.filter(a => a.overall_score).map(a => a.overall_score)) : 0;

  // Count all live analyses across ALL jobs (not just selected)
  const globalActiveCount = Object.values(jobDataMap).reduce((total, jd) => {
    return total + (jd.applicants || []).filter(a =>
      a.analysis_status === "Pending" || a.analysis_status === "In Progress"
    ).length;
  }, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Resume preview modal */}
      {resumeModal && (
        <ResumeModal
          url={resumeModal.url}
          name={resumeModal.name}
          onClose={() => setResumeModal(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-dark">Applicants</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>Job-isolated AI pipeline • Real-time scoring</span>
            {globalActiveCount > 0 && (
              <span className="text-blue-600 font-medium flex items-center gap-1">
                <FiZap size={12} /> {globalActiveCount} analysing globally
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleCheckOllama}
          disabled={healthLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition disabled:opacity-50 shadow-sm"
        >
          {healthLoading ? <FiLoader className="animate-spin" /> : "🤖"} Check AI Status
        </button>
      </div>

      {ollamaHealth && <OllamaBanner health={ollamaHealth} />}
      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <FiAlertCircle className="flex-shrink-0" /> {pageError}
        </div>
      )}

      {/* ─── Job selector ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-dark mb-4">Select Job Posting</h3>
        {jobs.length === 0 ? (
          <p className="text-slate-500 text-sm">No jobs found. Create one in Manage Jobs.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {jobs.map(job => {
              const jd = jobDataMap[job.job_id];
              const jdActive = (jd?.applicants || []).filter(
                a => a.analysis_status === "Pending" || a.analysis_status === "In Progress"
              ).length;

              return (
                <button
                  key={job.job_id}
                  onClick={() => loadApplicants(job.job_id, job.title)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    selectedJobId === job.job_id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className="font-semibold text-dark text-sm">{job.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{job.company_name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">{job.location}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${job.status === "Active" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                      {job.status}
                    </span>
                  </div>
                  {/* Show loaded applicant count + any live analysis */}
                  {jd?.applicants?.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-primary font-semibold">{jd.applicants.length} loaded</p>
                      {jdActive > 0 && (
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
                          <FiLoader className="animate-spin" size={10} /> {jdActive} live
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Applicants panel ─────────────────────────────────────────── */}
      {selectedJobId && (
        <div className="space-y-4">
          {/* Applicants header */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-dark">
                  <span className="text-primary">{selectedJobTitle}</span> — Applicants
                </h3>
                <div className="flex gap-4 mt-2 text-sm flex-wrap">
                  <span className="text-slate-500">📋 {applicants.length} total</span>
                  <span className="text-slate-500">✅ {completedCount} analysed</span>
                  {activeCount > 0 && (
                    <span className="text-blue-600 font-medium flex items-center gap-1">
                      <FiLoader className="animate-spin" size={12} /> {activeCount} live
                    </span>
                  )}
                  {pendingCount > 0 && <span className="text-orange-500">⏳ {pendingCount} pending</span>}
                  {fraudCount > 0 && <span className="text-red-600 font-semibold">🚨 {fraudCount} fraud</span>}
                  {completedCount > 0 && <span className="text-emerald-600 font-medium">🏆 Top: {topScore}/{TOTAL_MAX}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadApplicants(selectedJobId, selectedJobTitle)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition text-sm"
                >
                  <FiRefreshCw className={isLoading ? "animate-spin" : ""} size={14} /> Refresh
                </button>
                <button
                  onClick={handleAnalyzePending}
                  disabled={isAnalyzing || isLoading || pendingCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark disabled:bg-slate-300 disabled:cursor-not-allowed transition text-sm"
                >
                  {isAnalyzing ? <FiLoader className="animate-spin" size={14} /> : <FiZap size={14} />}
                  {isAnalyzing ? "Queueing…" : `Analyse Pending (${pendingCount})`}
                </button>
              </div>
            </div>

            {/* Pipeline legend */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <PipelineLegend />
            </div>
          </div>

          {/* Applicant cards */}
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <FiLoader className="animate-spin text-3xl text-primary" />
            </div>
          ) : applicants.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FiUsers size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-semibold">No applicants yet</p>
              <p className="text-slate-400 text-sm mt-1">Applicants will appear here once candidates apply.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applicants.map(app => (
                <PipelineCard
                  key={`job${selectedJobId}-app${app.application_id}`}
                  app={app}
                  liveData={liveMap[app.application_id] || null}
                  onRetry={handleRetry}
                  retryingId={retryingId}
                  onPreviewResume={(url, name) => setResumeModal({ url, name })}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

