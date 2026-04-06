import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../services/api';

const STEPS = [
  { label: 'Identify' },
  { label: 'Reset' },
  { label: 'Done' },
];

export default function ForgotPassword() {
  const [step, setStep]       = useState(1);
  const [username, setUsername] = useState('');
  const [token, setToken]     = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [showPwd, setShow]    = useState(false);
  const [showConf, setShowC]  = useState(false);

  async function requestToken(e) {
    e.preventDefault();
    setError(''); setMsg('');
    setBusy(true);
    try {
      const res = await forgotPassword({ username });
      setMsg(res.detail);
      if (res.reset_token) setToken(res.reset_token);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function doReset(e) {
    e.preventDefault();
    setError(''); setMsg('');
    if (newPwd !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const res = await resetPassword({ token, new_password: newPwd });
      setMsg(res.detail + ' You can now sign in.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. Token may have expired.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Brand */}
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>CampusOne</h1>
          <p>IIT Bombay Campus Portal</p>
        </div>

        {/* Step indicator */}
        <div className="auth-steps">
          {STEPS.map((s, i) => {
            const num   = i + 1;
            const state = num < step ? 'done' : num === step ? 'active' : '';
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`auth-step ${state}`}>
                  <div className="auth-step-circle">
                    {num < step ? '✓' : num}
                  </div>
                  <span className="auth-step-label">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`auth-step-line ${num < step ? 'done' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}
        {msg && step < 3 && <div className="auth-success">✅ {msg}</div>}

        {/* Step 1 — enter username */}
        {step === 1 && (
          <form onSubmit={requestToken} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-username">Username</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">👤</span>
                <input id="fp-username" type="text" className="search-input"
                  placeholder="Enter your username"
                  value={username} onChange={e => setUsername(e.target.value)}
                  required autoFocus />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                We'll generate a reset token for your account.
              </p>
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Sending…' : 'Get Reset Token →'}
            </button>
          </form>
        )}

        {/* Step 2 — enter token + new password */}
        {step === 2 && (
          <form onSubmit={doReset} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-token">Reset Token</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">🔑</span>
                <input id="fp-token" type="text" className="search-input"
                  placeholder="Paste token here"
                  value={token} onChange={e => setToken(e.target.value)} required />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                In dev mode the token is shown in the message above.
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="fp-newpwd">New Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">🔒</span>
                <input id="fp-newpwd"
                  type={showPwd ? 'text' : 'password'} className="search-input"
                  placeholder="Min. 8 characters"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} required
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" className="auth-eye-btn"
                  onClick={() => setShow(s => !s)} tabIndex={-1}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="fp-confirm">Confirm Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">🔒</span>
                <input id="fp-confirm"
                  type={showConf ? 'text' : 'password'} className="search-input"
                  placeholder="Re-enter new password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" className="auth-eye-btn"
                  onClick={() => setShowC(s => !s)} tabIndex={-1}>
                  {showConf ? '🙈' : '👁️'}
                </button>
              </div>
              {confirm && newPwd !== confirm && (
                <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.3rem' }}>
                  Passwords don't match
                </p>
              )}
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Resetting…' : 'Reset Password →'}
            </button>
          </form>
        )}

        {/* Step 3 — success */}
        {step === 3 && (
          <div className="auth-success-screen">
            <span className="auth-success-icon">🎉</span>
            <h3>Password Reset!</h3>
            <p>Your password has been updated successfully. You can now sign in with your new password.</p>
            <Link to="/login" className="btn btn-primary auth-submit"
              style={{ display: 'inline-block', textDecoration: 'none', lineHeight: '46px', padding: '0 1.5rem' }}>
              Go to Sign In →
            </Link>
          </div>
        )}

        <div className="auth-links" style={{ marginTop: '1rem' }}>
          <Link to="/login" className="auth-link">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
