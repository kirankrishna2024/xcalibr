// =============================================================================
// src/utils/toast.jsx — Week 9: Full-featured Toast Notification System
// =============================================================================
// PURPOSE:
//   Provides animated top-right toast notifications. Supports: success, error,
//   warning, info types with auto-dismiss, progress bar, and stacking.
//
// USAGE (imperative — works anywhere, no context needed):
//   import Toast from '../utils/toast';
//   Toast.success('Profile saved!');
//   Toast.error('Failed to delete.', { title: 'Delete Error' });
//   Toast.info('3 new applicants.', { duration: 6000 });
//
// USAGE (React hook inside components):
//   import { useToast } from '../utils/toast';
//   const toast = useToast();
//   toast.success('Done!');
// =============================================================================

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const DURATION_DEFAULT  = 4000;   // ms before auto-dismiss
const ANIM_MS           = 350;    // slide animation duration in ms
const MAX_TOASTS        = 5;      // max simultaneous toasts shown

// ─── Default titles per type ──────────────────────────────────────────────────
const TITLES = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

// ─── SVG icons per type ───────────────────────────────────────────────────────
const ICON = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

// ─── Inline CSS injected once into <head> ─────────────────────────────────────
const CSS = `
  @keyframes _tIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes _tOut { from{transform:translateX(0);opacity:1}    to{transform:translateX(110%);opacity:0} }
  @keyframes _tBar { from{width:100%} to{width:0%} }

  ._tw {
    position:fixed;top:1rem;right:1rem;z-index:99999;
    display:flex;flex-direction:column;gap:.625rem;
    pointer-events:none;max-width:calc(100vw - 2rem);
  }
  ._t {
    display:flex;align-items:flex-start;gap:.625rem;
    padding:.875rem 1rem;border-radius:.75rem;
    box-shadow:0 10px 25px -5px rgba(0,0,0,.15),0 4px 6px -2px rgba(0,0,0,.08);
    width:18rem;pointer-events:auto;position:relative;overflow:hidden;
    background:#fff;animation:_tIn .35s cubic-bezier(.16,1,.3,1) both;
  }
  ._t._x { animation:_tOut .3s ease-in both; }
  ._t.s { border-left:4px solid #10b981; }
  ._t.e { border-left:4px solid #ef4444; }
  ._t.w { border-left:4px solid #f59e0b; }
  ._t.i { border-left:4px solid #3b82f6; }
  ._ti { font-size:1rem;margin-top:2px;font-weight:700;flex-shrink:0; }
  ._t.s ._ti{color:#10b981} ._t.e ._ti{color:#ef4444}
  ._t.w ._ti{color:#f59e0b} ._t.i ._ti{color:#3b82f6}
  ._tb  { flex:1;min-width:0; }
  ._tt  { font-size:.8125rem;font-weight:700;color:#1e293b;line-height:1.3; }
  ._tm  { font-size:.75rem;color:#64748b;margin-top:2px;line-height:1.4; }
  ._tc  { background:none;border:none;cursor:pointer;font-size:1.125rem;
           line-height:1;color:#94a3b8;padding:0;transition:color .15s; }
  ._tc:hover{color:#475569}
  ._tp  { position:absolute;bottom:0;left:0;height:2px;animation:_tBar linear both; }
  ._t.s ._tp{background:#10b981} ._t.e ._tp{background:#ef4444}
  ._t.w ._tp{background:#f59e0b} ._t.i ._tp{background:#3b82f6}
`;

// Inject CSS exactly once
let _cssReady = false;
function ensureCSS() {
  if (_cssReady) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  _cssReady = true;
}

// Get or create the fixed wrapper <div> in the DOM
let _wrap = null;
function getWrap() {
  ensureCSS();
  if (!_wrap || !document.body.contains(_wrap)) {
    _wrap = document.createElement('div');
    _wrap.className = '_tw';
    document.body.appendChild(_wrap);
  }
  return _wrap;
}

// ─── Core imperative show function ───────────────────────────────────────────
/**
 * Show a toast notification.
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} message  Body text
 * @param {{ title?: string, duration?: number }} opts
 * @returns {Function} dismiss — call early to remove
 */
function _show(type, message, opts = {}) {
  const wrap     = getWrap();
  const title    = opts.title    || TITLES[type];
  const duration = opts.duration !== undefined ? opts.duration : DURATION_DEFAULT;

  // Map type string to short class key
  const cls = { success: 's', error: 'e', warning: 'w', info: 'i' }[type] || 'i';

  // Build toast element
  const el = document.createElement('div');
  el.className = `_t ${cls}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span class="_ti">${ICON[type]}</span>
    <div class="_tb">
      <div class="_tt">${escapeHtml(title)}</div>
      ${message ? `<div class="_tm">${escapeHtml(String(message))}</div>` : ''}
    </div>
    <button class="_tc" aria-label="Dismiss">&times;</button>
    ${duration > 0 ? `<div class="_tp" style="animation-duration:${duration}ms"></div>` : ''}
  `;

  // Enforce max visible count — remove oldest
  while (wrap.children.length >= MAX_TOASTS) wrap.removeChild(wrap.firstChild);
  wrap.appendChild(el);

  // Dismiss: play exit animation then remove from DOM
  const dismiss = () => {
    if (!el.parentNode) return;
    el.classList.add('_x');
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), ANIM_MS);
  };

  // Bind close button
  el.querySelector('._tc').addEventListener('click', dismiss);

  // Auto-dismiss after `duration`
  if (duration > 0) setTimeout(dismiss, duration);

  return dismiss;
}

// Prevent XSS when inserting dynamic text
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// Imperative API (usable without React context — import Toast from './toast')
// =============================================================================
const Toast = {
  success: (message, opts) => _show('success', message, opts),
  error:   (message, opts) => _show('error',   message, opts),
  warning: (message, opts) => _show('warning', message, opts),
  info:    (message, opts) => _show('info',    message, opts),
};

export default Toast;
export { Toast };

// Legacy named export used by some existing files
export const showToast = (message, type = 'success', duration = DURATION_DEFAULT) =>
  _show(type, message, { duration });

// =============================================================================
// React Context — ToastProvider + useToast hook
// =============================================================================
const ToastContext = createContext(null);

/**
 * Wrap your app (or a sub-tree) with <ToastProvider> to enable useToast().
 * All toasts are rendered via a React portal at document.body.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  // Add a new toast entry to state
  const addToast = useCallback((type, message, opts = {}) => {
    const id = nextId.current++;
    const entry = {
      id,
      type,
      message,
      title:    opts.title    || TITLES[type],
      duration: opts.duration !== undefined ? opts.duration : DURATION_DEFAULT,
      exiting:  false,
    };
    setToasts(prev => {
      const trimmed = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...trimmed, entry];
    });
    return id;
  }, []);

  // Animate-out then remove a toast by id
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ANIM_MS);
  }, []);

  const ctx = {
    success: (msg, opts) => addToast('success', msg, opts),
    error:   (msg, opts) => addToast('error',   msg, opts),
    warning: (msg, opts) => addToast('warning', msg, opts),
    info:    (msg, opts) => addToast('info',    msg, opts),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Portal: toast stack rendered outside normal layout stacking context */}
      {createPortal(
        <div
          style={{
            position: 'fixed', top: '1rem', right: '1rem',
            zIndex: 99999, display: 'flex', flexDirection: 'column',
            gap: '0.625rem', pointerEvents: 'none',
            maxWidth: 'calc(100vw - 2rem)',
          }}
          aria-label="Notifications"
        >
          <style>{`
            @keyframes _rIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
            @keyframes _rOut { from{transform:translateX(0);opacity:1}    to{transform:translateX(110%);opacity:0} }
            @keyframes _rBar { from{width:100%} to{width:0%} }
          `}</style>

          {toasts.map(t => (
            <ReactToastItem key={t.id} toast={t} onRemove={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ─── Internal React toast item ────────────────────────────────────────────────
function ReactToastItem({ toast, onRemove }) {
  const { id, type, message, title, duration, exiting } = toast;
  const cls = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  const color = cls[type] || cls.info;

  // Auto-dismiss
  React.useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onRemove]);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '.625rem',
        padding: '.875rem 1rem', borderRadius: '.75rem', width: '18rem',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,.15)',
        background: '#fff', borderLeft: `4px solid ${color}`,
        pointerEvents: 'auto', position: 'relative', overflow: 'hidden',
        animation: exiting
          ? '_rOut .3s ease-in both'
          : '_rIn .35s cubic-bezier(.16,1,.3,1) both',
      }}
      role="alert"
    >
      <span style={{ color, fontSize: '1rem', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
        {ICON[type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '.8125rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{title}</p>
        {message && (
          <p style={{ fontSize: '.75rem', color: '#64748b', margin: '2px 0 0', lineHeight: 1.4 }}>
            {message}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.125rem', color: '#94a3b8', padding: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
      {duration > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: 2,
          background: color, animation: `_rBar ${duration}ms linear both`,
        }} />
      )}
    </div>
  );
}

/**
 * Hook to show toasts from any component inside <ToastProvider>.
 * Falls back gracefully to console if used outside the provider.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback to imperative API so the app doesn't crash
    return Toast;
  }
  return ctx;
}
