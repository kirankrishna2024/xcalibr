// =============================================================================
// src/pages/ProfilePage.jsx — Week 9 Redesign (Candidate Portal)
// =============================================================================
// WEEK 9 IMPROVEMENTS:
//  ✅ Toast notifications (top-right) replace inline toast component
//  ✅ Candidate stats bar: score display, profile completion %, upload status
//  ✅ Resume "Open in new window" fixed — uses authenticated blob fetch
//  ✅ Form validation: required fields highlighted before submit
//  ✅ Better section layout with clear visual grouping
//  ✅ Skills displayed as tag chips instead of plain text
//  ✅ Unsaved-changes indicator on the Save button
//  ✅ Inline comments throughout
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getMe,
  updateCandidateProfile,
  uploadCandidateResume,
  uploadCandidateLinkedinPdf,
  getResumePreviewUrl,
  getResumeDownloadUrl,
  BASE_URL,
} from '../api/api';
import {
  FiUser, FiBriefcase, FiUploadCloud, FiLink, FiCheckCircle,
  FiAlertCircle, FiEye, FiDownload, FiX, FiPlus, FiSave,
} from 'react-icons/fi';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import Toast from '../utils/toast';

// =============================================================================
// ProfileCompletionBar — visual indicator of how complete the profile is
// =============================================================================
function ProfileCompletionBar({ fields }) {
  // Count how many fields have values
  const filled = fields.filter(Boolean).length;
  const pct    = Math.round((filled / fields.length) * 100);

  // Pick colour based on completion percentage
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600">Profile Completion</span>
          <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
            {pct}%
          </span>
        </div>
        {/* Progress track */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {pct < 100 && (
        <p className="text-xs text-slate-400 flex-shrink-0">
          {fields.length - filled} fields remaining
        </p>
      )}
    </div>
  );
}

// =============================================================================
// SkillTag — individual skill chip with remove button
// =============================================================================
function SkillTag({ skill, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2.5 py-1 rounded-full">
      {skill}
      {/* X button removes this skill from the list */}
      <button
        type="button"
        onClick={() => onRemove(skill)}
        className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors"
        aria-label={`Remove skill ${skill}`}
      >
        <FiX size={11} />
      </button>
    </span>
  );
}

// =============================================================================
// ProfilePage — main page component
// =============================================================================
export default function ProfilePage() {
  // ── Profile field state ────────────────────────────────────────────────────
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [isDirty,    setIsDirty]   = useState(false);   // track unsaved changes
  const [candidateId, setCandidateId] = useState(null);

  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [githubLink,   setGithubLink]   = useState('');
  const [leetcodeLink, setLeetcodeLink] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [experience,   setExperience]   = useState('');
  const [summary,      setSummary]      = useState('');
  const [skillList,    setSkillList]    = useState([]); // array of individual skill strings
  const [skillInput,   setSkillInput]   = useState(''); // controlled input for new skill entry

  const [resumeFileName,     setResumeFileName]     = useState('');
  const [linkedinPdfFileName, setLinkedinPdfFileName] = useState('');
  const [uploadingResume,    setUploadingResume]    = useState(false);
  const [uploadingLinkedin,  setUploadingLinkedin]  = useState(false);

  // Validation error map: { fieldName: errorMessage }
  const [validationErrors, setValidationErrors] = useState({});

  const fileInputRef         = useRef(null);
  const linkedinFileInputRef = useRef(null);

  // Mark form as dirty whenever any controlled field changes
  const markDirty = () => setIsDirty(true);

  // ── Fetch profile data on mount ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getMe();
        setCandidateId(data.candid);
        setFirstName(data.firstname  || '');
        setLastName(data.lastname    || '');
        setEmail(data.email          || '');
        setPhone(data.contactinfo    || '');
        setGithubLink(data.github_link   || '');
        setLeetcodeLink(data.leetcode_link || '');
        setCurrentTitle(data.current_title          || '');
        setExperience(data.years_of_experience       || '');
        setSummary(data.professional_summary         || '');

        // Parse comma-separated skills string into array
        const raw = data.skills || '';
        setSkillList(raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []);

        // Set file name labels from saved links
        setResumeFileName(
          data.resumelink         ? data.resumelink.split('/').pop()         : ''
        );
        setLinkedinPdfFileName(
          data.linkedin_pdf_link  ? data.linkedin_pdf_link.split('/').pop()  : ''
        );
      } catch (err) {
        console.error('[ProfilePage] load error:', err);
        Toast.error('Failed to load profile. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Client-side validation ─────────────────────────────────────────────────
  const validate = () => {
    const errors = {};
    if (!firstName.trim())   errors.firstName    = 'First name is required.';
    if (!lastName.trim())    errors.lastName     = 'Last name is required.';
    if (!email.includes('@')) errors.email       = 'Valid email required.';
    if (!currentTitle.trim()) errors.currentTitle = 'Current title is required.';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0; // true = valid
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) {
      Toast.warning('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    try {
      await updateCandidateProfile({
        firstname:           firstName,
        lastname:            lastName,
        email:               email,
        contactinfo:         phone,
        github_link:         githubLink,
        leetcode_link:       leetcodeLink,
        current_title:       currentTitle,
        years_of_experience: experience,
        professional_summary: summary,
        skills:              skillList.join(', '), // rejoin to comma-separated string
      });
      Toast.success('Profile saved successfully!');
      setIsDirty(false);
    } catch (err) {
      console.error('[ProfilePage] save error:', err);
      Toast.error(err.response?.data?.detail || 'Failed to save profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Skill tag handlers ─────────────────────────────────────────────────────
  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skillList.includes(s)) {
      setSkillList(prev => [...prev, s]);
      markDirty();
    }
    setSkillInput('');
  };

  const removeSkill = (skill) => {
    setSkillList(prev => prev.filter(s => s !== skill));
    markDirty();
  };

  const handleSkillKeyDown = (e) => {
    // Press Enter or comma to add the current input as a tag
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill();
    }
  };

  // ── Resume upload ──────────────────────────────────────────────────────────
  const handleResumeUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingResume(true);
    try {
      const data = await uploadCandidateResume(formData);
      setResumeFileName(data.resumelink?.split('/').pop() || file.name);
      Toast.success('Resume uploaded! Refresh page to preview.');
    } catch (err) {
      Toast.error('Failed to upload resume.');
      setResumeFileName('');
    } finally {
      setUploadingResume(false);
    }
  };

  // ── LinkedIn PDF upload ────────────────────────────────────────────────────
  const handleLinkedinUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingLinkedin(true);
    try {
      const data = await uploadCandidateLinkedinPdf(formData);
      setLinkedinPdfFileName(data.linkedin_pdf_link?.split('/').pop() || file.name);
      Toast.success('LinkedIn PDF uploaded successfully!');
    } catch (err) {
      Toast.error('Failed to upload LinkedIn PDF.');
      setLinkedinPdfFileName('');
    } finally {
      setUploadingLinkedin(false);
    }
  };

  // ── Open resume in new browser tab (authenticated) ─────────────────────────
  // The resume endpoint may require auth — we fetch it as a blob and open a
  // local object URL so the PDF opens in a new tab correctly.
  const handleOpenResume = async () => {
    if (!candidateId) return;
    const url   = getResumePreviewUrl(candidateId);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob      = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      // Open the blob URL in a new tab — works around auth-protected endpoints
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      // Clean up after a short delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      Toast.error('Could not open resume. Please try again.');
    }
  };

  // ── Shared input class ─────────────────────────────────────────────────────
  const inputCls = (field) =>
    `w-full p-3 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
      validationErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200'
    }`;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 text-slate-500 text-sm">Loading profile…</span>
      </div>
    );
  }

  // ── Profile completion fields (used for the completion bar) ───────────────
  const completionFields = [
    firstName, lastName, email, phone, currentTitle,
    experience, summary, skillList.length > 0 ? 'ok' : '',
    resumeFileName, githubLink,
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSave} className="space-y-6 p-4 md:p-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            Keep your information up-to-date to improve your match scores.
          </p>
        </div>

        {/* Save button — highlighted when there are unsaved changes */}
        <button
          type="submit"
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm ${
            isDirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
          ) : (
            <><FiSave size={14} /> {isDirty ? 'Save Changes' : 'Saved'}</>
          )}
        </button>
      </div>

      {/* ── Profile completion bar ───────────────────────────────────────────── */}
      <ProfileCompletionBar fields={completionFields} />

      {/* ── Three-column grid: left sidebar + main content ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Personal Information card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4 uppercase tracking-wide">
              <FiUser size={14} /> Personal Information
            </h3>
            <div className="space-y-3">
              {/* First name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); markDirty(); }}
                  className={inputCls('firstName')}
                  placeholder="John"
                />
                {validationErrors.firstName && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.firstName}</p>
                )}
              </div>

              {/* Last name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); markDirty(); }}
                  className={inputCls('lastName')}
                  placeholder="Doe"
                />
                {validationErrors.lastName && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.lastName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); markDirty(); }}
                  className={inputCls('email')}
                />
                {validationErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <PhoneInput
                  defaultCountry="IN"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={v => { setPhone(v || ''); markDirty(); }}
                  className="phone-input-custom-wrapper"
                />
              </div>
            </div>
          </section>

          {/* Online Presence card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4 uppercase tracking-wide">
              <FiLink size={14} /> Online Presence
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">GitHub Profile</label>
                <input
                  type="url"
                  value={githubLink}
                  onChange={e => { setGithubLink(e.target.value); markDirty(); }}
                  className={inputCls('github')}
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">LeetCode Profile</label>
                <input
                  type="url"
                  value={leetcodeLink}
                  onChange={e => { setLeetcodeLink(e.target.value); markDirty(); }}
                  className={inputCls('leetcode')}
                  placeholder="https://leetcode.com/username"
                />
              </div>
            </div>
          </section>

          {/* Resume & Documents card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4 uppercase tracking-wide">
              <FiUploadCloud size={14} /> Documents
            </h3>

            {/* ── Resume upload zone ─────────────────────────────────────── */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center mb-4 hover:border-blue-300 transition-colors">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => e.target.files[0] && handleResumeUpload(e.target.files[0])}
                className="hidden"
                accept=".pdf,.doc,.docx"
              />
              {/* Icon */}
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                {uploadingResume
                  ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <FiUploadCloud size={20} />
                }
              </div>
              <p className="text-xs font-semibold text-slate-700">Resume / CV</p>
              <p className="text-xs text-slate-400 mt-1 truncate px-2">
                {resumeFileName || 'PDF, DOC, DOCX · Max 10 MB'}
              </p>
              {resumeFileName && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1">
                  <FiCheckCircle size={11} /> Uploaded
                </p>
              )}

              {/* Choose file button */}
              <button
                type="button"
                disabled={uploadingResume}
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-4 py-1.5 text-xs bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                {uploadingResume ? 'Uploading…' : resumeFileName ? 'Replace' : 'Choose File'}
              </button>

              {/* Preview / Download buttons — only shown when resume exists */}
              {resumeFileName && candidateId && (
                <div className="mt-3 flex gap-2 justify-center flex-wrap">
                  {/* Open in new window — uses authenticated blob fetch */}
                  <button
                    type="button"
                    onClick={handleOpenResume}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                    title="Open resume in new browser tab"
                  >
                    <FiEye size={11} /> Preview
                  </button>
                  {/* Direct download link */}
                  <a
                    href={getResumeDownloadUrl(candidateId)}
                    download
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <FiDownload size={11} /> Download
                  </a>
                </div>
              )}
            </div>

            {/* ── LinkedIn PDF upload zone ───────────────────────────────── */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center hover:border-blue-300 transition-colors">
              <input
                type="file"
                ref={linkedinFileInputRef}
                onChange={e => e.target.files[0] && handleLinkedinUpload(e.target.files[0])}
                className="hidden"
                accept=".pdf"
              />
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-3">
                {uploadingLinkedin
                  ? <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  : <FiUploadCloud size={20} />
                }
              </div>
              <p className="text-xs font-semibold text-slate-700">LinkedIn PDF</p>
              <p className="text-xs text-slate-400 mt-1">LinkedIn → More → Save to PDF</p>
              {linkedinPdfFileName && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1">
                  <FiCheckCircle size={11} /> {linkedinPdfFileName}
                </p>
              )}
              <button
                type="button"
                disabled={uploadingLinkedin}
                onClick={() => linkedinFileInputRef.current?.click()}
                className="mt-3 px-4 py-1.5 text-xs bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                {uploadingLinkedin ? 'Uploading…' : linkedinPdfFileName ? 'Replace' : 'Choose File'}
              </button>
            </div>
          </section>
        </div>

        {/* ── Right: Professional info ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Professional Summary card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4 uppercase tracking-wide">
              <FiBriefcase size={14} /> Professional Summary
            </h3>
            <div className="space-y-4">
              {/* Current title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Current Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentTitle}
                  onChange={e => { setCurrentTitle(e.target.value); markDirty(); }}
                  className={inputCls('currentTitle')}
                  placeholder="e.g. Senior Frontend Developer"
                />
                {validationErrors.currentTitle && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.currentTitle}</p>
                )}
              </div>

              {/* Years of experience dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Years of Experience</label>
                <select
                  value={experience}
                  onChange={e => { setExperience(e.target.value); markDirty(); }}
                  className={inputCls('experience')}
                >
                  <option value="">Select experience level</option>
                  <option value="0-1 years">0–1 years (Fresher)</option>
                  <option value="1-3 years">1–3 years</option>
                  <option value="3-5 years">3–5 years</option>
                  <option value="5-10 years">5–10 years</option>
                  <option value="10+ years">10+ years</option>
                </select>
              </div>

              {/* Professional summary textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bio / Summary</label>
                <textarea
                  rows={5}
                  value={summary}
                  onChange={e => { setSummary(e.target.value); markDirty(); }}
                  className={`${inputCls('summary')} resize-none`}
                  placeholder="Write a brief professional summary about your background, goals, and expertise…"
                />
                <p className="text-xs text-slate-400 mt-1">{summary.length} characters</p>
              </div>
            </div>
          </section>

          {/* Skills card — chip-based tag input */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Skills</h3>

            {/* Existing skill chips */}
            {skillList.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {skillList.map(skill => (
                  <SkillTag
                    key={skill}
                    skill={skill}
                    onRemove={removeSkill}
                  />
                ))}
              </div>
            )}

            {/* Skill entry input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter or comma…"
                className="flex-1 p-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1 font-medium"
              >
                <FiPlus size={14} /> Add
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Press Enter or comma after each skill to add it as a tag.</p>
          </section>

          {/* Save button (bottom of right column — mirrors top) */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
          >
            {saving ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : (
              <><FiSave size={16} /> Save All Changes</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
