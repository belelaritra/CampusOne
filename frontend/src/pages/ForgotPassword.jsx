import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../services/api';

export default function ForgotPassword() {
  const [step, setStep]   = useState(1); // 1=request token, 2=reset password
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg]     = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  async function requestToken(e) {
    e.preventDefault();
    setError(''); setMsg('');
    setBusy(true);
    try {
      const res = await forgotPassword({ username });
      setMsg(res.detail);
      if (res.reset_token) {
        // Dev mode: backend returns token directly
        setToken(res.reset_token);
      }
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
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>CampusOne</h1>
          <p>IIT Bombay Campus Portal</p>
        </div>

        <h2 className="auth-title">
          {step === 1 ? 'Forgot Password' : step === 2 ? 'Reset Password' : 'Password Reset'}
        </h2>

        {error && <div className="auth-error">{error}</div>}
        {msg   && <div className="auth-success">{msg}</div>}

        {step === 1 && (
          <form onSubmit={requestToken} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-username">Username</label>
              <input id="fp-username" type="text" className="search-input"
                placeholder="Enter your username"
                value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Sending…' : 'Get Reset Token'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={doReset} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-token">Reset Token</label>
              <input id="fp-token" type="text" className="search-input"
                placeholder="Paste token here"
                value={token} onChange={e => setToken(e.target.value)} required />
              <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                In dev mode the token is shown in the message above.
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="fp-newpwd">New Password</label>
              <input id="fp-newpwd" type="password" className="search-input"
                placeholder="Min. 8 characters"
                value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="fp-confirm">Confirm Password</label>
              <input id="fp-confirm" type="password" className="search-input"
                placeholder="Re-enter new password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Go to Sign In
            </Link>
          </div>
        )}

        <div className="auth-links">
          <Link to="/login" className="auth-link">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
