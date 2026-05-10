// src/components/ApplicantModal.jsx
// Week 6: Full score breakdown, error reason display, resume link

import { useState, useEffect } from 'react';
import { getAnalysisStatus } from '../api/api';

const ScoreBar = ({ label, score, maxScore, color = "bg-primary" }) => {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-dark">{score ?? 'N/A'} / {maxScore}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const cls = {
    Completed: 'bg-green-100 text-green-800',
    Pending:   'bg-blue-100  text-blue-800',
    'In Progress': 'bg-yellow-100 text-yellow-800',
    Failed:    'bg-red-100   text-red-800',
  }[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
};

export default function ApplicantModal({ applicantData, onClose }) {
  const [statusData, setStatusData] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!applicantData) return;

    // If in-progress, poll for updates
    if (
      applicantData.analysis_status === 'In Progress' ||
      applicantData.analysis_status === 'Pending'
    ) {
      setPolling(true);
      const interval = setInterval(async () => {
        try {
          const data = await getAnalysisStatus(applicantData.application_id);
          setStatusData(data);
          if (data.analysis_status === 'Completed' || data.analysis_status === 'Failed') {
            clearInterval(interval);
            setPolling(false);
          }
        } catch {
          clearInterval(interval);
          setPolling(false);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [applicantData]);

  if (!applicantData) return null;

  const liveStatus = statusData?.analysis_status || applicantData.analysis_status;
  const liveScore  = statusData?.overall_score  ?? applicantData.overall_score;
  const errorReason = statusData?.error_reason  || null;

  const getFileName = (path) => {
    if (!path) return null;
    return path.split('/').pop() || path.split('\\').pop() || 'View File';
  };

  const isCompleted = liveStatus === 'Completed';

  // Score config for bars
  const scores = [
    { label: 'Career Readiness',  value: applicantData.careerscore,   max: 100, color: 'bg-emerald-500' },
    { label: 'JD Match',          value: applicantData.jd_match_score, max: 100, color: 'bg-blue-500' },
    { label: 'GitHub',            value: applicantData.githubscore,    max: 100, color: 'bg-gray-700' },
    { label: 'LeetCode',          value: applicantData.leetcodescore,  max: 100, color: 'bg-orange-500' },
    { label: 'LinkedIn',          value: applicantData.linkedinscore,  max: 50,  color: 'bg-sky-500' },
    { label: 'Trust Index',       value: applicantData.trustscore,     max: 50,  color: 'bg-purple-500' },
  ];

  const totalPossible = scores.reduce((acc, s) => acc + (s.value != null ? s.max : 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-y-auto max-h-[92vh]">

        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{applicantData.candidate_name}</h3>
            <p className="text-sm text-slate-500">{applicantData.candidate_email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">

          {/* Status Row */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Analysis Status</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={liveStatus} />
                {polling && (
                  <span className="text-xs text-yellow-600 animate-pulse">Updating…</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Applied</p>
              <p className="text-sm font-medium text-dark">
                {new Date(applicantData.applied_on).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Ollama Error Banner */}
          {liveStatus === 'Failed' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-700 mb-1">⚠ Analysis Failed</p>
              {errorReason ? (
                <p className="text-xs text-red-600 font-mono break-words">{errorReason}</p>
              ) : (
                <p className="text-xs text-red-600">
                  The AI analysis could not complete. Ensure Ollama is running
                  (<code className="bg-red-100 px-1 rounded">ollama serve</code>) and
                  llama3 is pulled (<code className="bg-red-100 px-1 rounded">ollama pull llama3</code>),
                  then click "Retry" from the applicants list.
                </p>
              )}
            </div>
          )}

          {/* Pending / In Progress Banner */}
          {(liveStatus === 'Pending' || liveStatus === 'In Progress') && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Analysis is running. Scores will appear once Ollama finishes processing this CV.
              </p>
            </div>
          )}

          {/* Overall Score Hero */}
          {isCompleted && liveScore != null && (
            <div className="bg-gradient-to-br from-primary/10 to-emerald-50 rounded-2xl p-5 text-center border border-primary/20">
              <p className="text-sm text-slate-500 mb-1">Overall Score</p>
              <p className="text-5xl font-black text-primary">{liveScore}</p>
              <p className="text-xs text-slate-400 mt-1">out of {totalPossible} possible points</p>
              {applicantData.rank && (
                <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-sm font-bold text-white ${
                  applicantData.rank === 1 ? 'bg-yellow-400' :
                  applicantData.rank === 2 ? 'bg-slate-400' :
                  applicantData.rank === 3 ? 'bg-yellow-600' : 'bg-slate-300'
                }`}>
                  Rank #{applicantData.rank}
                </div>
              )}
            </div>
          )}

          {/* Score Breakdown Bars */}
          {isCompleted && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-bold text-dark mb-4">Score Breakdown</h4>
              {scores.map((s) =>
                s.value != null ? (
                  <ScoreBar
                    key={s.label}
                    label={s.label}
                    score={s.value}
                    maxScore={s.max}
                    color={s.color}
                  />
                ) : null
              )}
            </div>
          )}

          {/* Resume Link */}
          {applicantData.cv_path && (
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-semibold text-dark mb-2 text-sm">Submitted Resume</h4>
              <a
                href={`http://127.0.0.1:8000/${applicantData.cv_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                📄 {getFileName(applicantData.cv_path)}
              </a>
            </div>
          )}

          {/* Basic Info */}
          <div className="text-xs text-slate-400 border-t pt-3">
            <p>Application ID: {applicantData.application_id}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
