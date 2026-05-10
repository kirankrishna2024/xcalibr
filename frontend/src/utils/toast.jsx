// =============================================================================
// src/utils/toast.jsx — XCalibr Toast Notification System
// =============================================================================
// PURPOSE:
//   Animated top-right toast notifications. Supports: success, error,
//   warning, info types with auto-dismiss, progress bar, and stacking.
//
// USAGE (imperative — works anywhere outside React tree):
//   import Toast from '../utils/toast';
//   Toast.success('Profile saved!');
//   Toast.error('Failed to delete.', { title: 'Delete Error' });
//   Toast.info('3 new applicants.', { duration: 6000 });
//
// USAGE (React hook inside components):
//   import { useToast } from '../utils/toast';
//   const toast = useToast();
//   toast.success('Done!');
//
// USAGE (Provider — wrap App or a subtree):
//   import { ToastProvider } from '../utils/toast';
//   <ToastProvider><App /></ToastProvider>
// =============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const DURATION_DEFAULT = 4000;  // ms before auto-dismiss
const ANIM_OUT_MS      = 300;   // exit animation duration
const MAX_TOASTS       = 5;     // max simultaneous toasts

// ─── Type config (no obfuscated names) ───────────────────────────────────────
const TYPE_CONFIG = {
  success: { color: '#10b981', icon: '✓', title: 'Success' },
  error:   { color: '#ef4444', icon: '✕', title: 'Error'   },
  warning: { color: '#f59e0b', icon: '⚠', title: 'Warning' },
  info:    { color: '#3b82f6', icon: 'ℹ', title: 'Info'    },
};

// ─── Keyframe animation names (plain readable names) ─────────────────────────
const KEYFRAMES = `
  @keyframes toastSlideIn  {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);   opacity: 1; }
  }
  @keyframes toastSlideOut {
    from { transform: translateX(0);   opacity: 1; }
    to   { transform: translateX(110%); opacity: 0; }
  }
  @keyframes toastProgress {
    from { width: 100%; }
    to   { width: 0%;   }
  }
`;

// =============================================================================
// Styles (plain readable names, all inline — zero DOM injection)
// =============================================================================

const styles = {
  wrapper: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    pointerEvents: 'none',
    maxWidth: 'calc(100vw - 2rem)',
  },
  toast: (color, exiting) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.625rem',
    padding: '0.875rem 1rem',
    borderRadius: '0.75rem',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.08)',
    width: '18rem',
    background: '#ffffff',
    borderLeft: `4px solid ${color}`,
    pointerEvents: 'auto',
    position: 'relative',
    overflow: 'hidden',
    animation: exiting
      ? `toastSlideOut ${ANIM_OUT_MS}ms ease-in both`
      : 'toastSlideIn 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
  }),
  icon: (color) => ({
    color,
    fontSize: '1rem',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: '2px',
  }),
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
    lineHeight: 1.3,
  },
  messageText: {
    fontSize: '0.75rem',
    color: '#64748b',
    margin: '2px 0 0',
    lineHeight: 1.4,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.125rem',
    lineHeight: 1,
    color: '#94a3b8',
    padding: 0,
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  progressBar: (color, duration) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '2px',
    background: color,
    animation: `toastProgress ${duration}ms linear both`,
  }),
};

// =============================================================================
// ToastItem — pure React component, no DOM manipulation
// =============================================================================

function ToastItem({ toast, onRemove }) {
  const { id, type, message, title, duration, exiting } = toast;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  // Auto-dismiss timer
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={styles.toast(config.color, exiting)}
    >
      {/* Icon */}
      <span style={styles.icon(config.color)} aria-hidden="true">
        {config.icon}
      </span>

      {/* Text body */}
      <div style={styles.body}>
        <p style={styles.titleText}>{title}</p>
        {message ? (
          <p style={styles.messageText}>{message}</p>
        ) : null}
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(id)}
        style={styles.closeButton}
        aria-label="Dismiss notification"
        type="button"
      >
        &times;
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div
          style={styles.progressBar(config.color, duration)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// =============================================================================
// ToastStack — renders the keyframes + list of ToastItems via a React portal
// =============================================================================

function ToastStack({ toasts, onRemove }) {
  return createPortal(
    <div style={styles.wrapper} aria-label="Notifications">
      {/* Keyframes injected as a React style element — no document.head manipulation */}
      <style>{KEYFRAMES}</style>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

// =============================================================================
// ToastProvider + useToast hook
// =============================================================================

const ToastContext = createContext(null);

/**
 * Wrap your app (or a subtree) with <ToastProvider> to enable useToast().
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const addToast = useCallback((type, message, opts = {}) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const id = nextId.current++;

    const entry = {
      id,
      type,
      message: message || '',
      title:    opts.title    || config.title,
      duration: opts.duration !== undefined ? opts.duration : DURATION_DEFAULT,
      exiting:  false,
    };

    setToasts((prev) => {
      const trimmed = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...trimmed, entry];
    });

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    // Mark as exiting first (triggers exit animation)
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove from state after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ANIM_OUT_MS);
  }, []);

  const contextValue = {
    success: (msg, opts) => addToast('success', msg, opts),
    error:   (msg, opts) => addToast('error',   msg, opts),
    warning: (msg, opts) => addToast('warning', msg, opts),
    info:    (msg, opts) => addToast('info',    msg, opts),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook — use inside any component wrapped by <ToastProvider>.
 * Falls back to the imperative API if called outside the provider.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback: won't crash, uses imperative API
    return Toast;
  }
  return ctx;
}

// =============================================================================
// Imperative API — works outside the React tree (no context required)
// Uses a single React root rendered into a dedicated container div.
// =============================================================================

let _imperativeRoot    = null;
let _imperativeToasts  = [];
let _imperativeNextId  = 1;
let _imperativeSetState = null;

function _getOrCreateRoot() {
  if (_imperativeRoot) return;

  const container = document.createElement('div');
  container.setAttribute('id', 'xcalibr-toast-root');
  document.body.appendChild(container);

  // Dynamically import ReactDOM to create a React root
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(container);

    function ImperativeToastHost() {
      const [toasts, setToasts] = useState(_imperativeToasts);
      _imperativeSetState = setToasts;

      const remove = useCallback((id) => {
        _imperativeToasts = _imperativeToasts.map((t) =>
          t.id === id ? { ...t, exiting: true } : t
        );
        setToasts([..._imperativeToasts]);
        setTimeout(() => {
          _imperativeToasts = _imperativeToasts.filter((t) => t.id !== id);
          setToasts([..._imperativeToasts]);
        }, ANIM_OUT_MS);
      }, []);

      return <ToastStack toasts={toasts} onRemove={remove} />;
    }

    root.render(<ImperativeToastHost />);
    _imperativeRoot = root;
  });
}

function _imperativeShow(type, message, opts = {}) {
  _getOrCreateRoot();

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const id = _imperativeNextId++;
  const entry = {
    id,
    type,
    message: message || '',
    title:    opts.title    || config.title,
    duration: opts.duration !== undefined ? opts.duration : DURATION_DEFAULT,
    exiting:  false,
  };

  if (_imperativeToasts.length >= MAX_TOASTS) {
    _imperativeToasts = _imperativeToasts.slice(1);
  }
  _imperativeToasts = [..._imperativeToasts, entry];

  if (_imperativeSetState) {
    _imperativeSetState([..._imperativeToasts]);
  }

  // Return a dismiss function
  return () => {
    if (_imperativeSetState) {
      _imperativeToasts = _imperativeToasts.map((t) =>
        t.id === id ? { ...t, exiting: true } : t
      );
      _imperativeSetState([..._imperativeToasts]);
      setTimeout(() => {
        _imperativeToasts = _imperativeToasts.filter((t) => t.id !== id);
        _imperativeSetState([..._imperativeToasts]);
      }, ANIM_OUT_MS);
    }
  };
}

/**
 * Imperative Toast API
 * @example
 *   import Toast from '../utils/toast';
 *   Toast.success('Saved!');
 *   Toast.error('Something went wrong.', { duration: 6000 });
 */
const Toast = {
  success: (message, opts) => _imperativeShow('success', message, opts),
  error:   (message, opts) => _imperativeShow('error',   message, opts),
  warning: (message, opts) => _imperativeShow('warning', message, opts),
  info:    (message, opts) => _imperativeShow('info',    message, opts),
};

export default Toast;
export { Toast };

/**
 * Legacy named export — kept for backward compatibility with existing files
 * that call showToast(message, type, duration).
 */
export const showToast = (message, type = 'success', duration = DURATION_DEFAULT) =>
  _imperativeShow(type, message, { duration });
