import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [showPwd, setShow]  = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
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

        <div className="auth-divider">Sign in to your account</div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">👤</span>
              <input
                id="username" name="username" type="text"
                className="search-input" placeholder="your_username"
                value={form.username} onChange={handle} required autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input
                id="password" name="password"
                type={showPwd ? 'text' : 'password'}
                className="search-input" placeholder="••••••••"
                value={form.password} onChange={handle} required
                style={{ paddingRight: '2.75rem' }}
              />
              <button type="button" className="auth-eye-btn"
                onClick={() => setShow(s => !s)} tabIndex={-1}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.8rem' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div className="auth-links">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create account</Link>
        </div>
      </div>
    </div>
  );
}
