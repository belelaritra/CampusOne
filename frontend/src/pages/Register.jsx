import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ username: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [showPwd, setShow]    = useState(false);
  const [showConf, setShowC]  = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await register({ username: form.username, email: form.email, phone: form.phone, password: form.password });
      await login({ username: form.username, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        setError(Object.values(data).flat().join(' '));
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const pwdMatch = form.confirm && form.password === form.confirm;
  const pwdMismatch = form.confirm && form.password !== form.confirm;

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">

        {/* Brand */}
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>CampusOne</h1>
          <p>IIT Bombay Campus Portal</p>
        </div>

        <div className="auth-divider">Create your account</div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form onSubmit={submit} className="auth-form">
          {/* Username */}
          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">👤</span>
              <input id="reg-username" name="username" type="text" className="search-input"
                placeholder="Choose a username"
                value={form.username} onChange={handle} required autoFocus />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✉️</span>
              <input id="reg-email" name="email" type="email" className="search-input"
                placeholder="you@iitb.ac.in"
                value={form.email} onChange={handle} required />
            </div>
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="reg-phone">
              Phone <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">📱</span>
              <input id="reg-phone" name="phone" type="tel" className="search-input"
                placeholder="10-digit mobile number"
                value={form.phone} onChange={handle} />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input id="reg-password" name="password"
                type={showPwd ? 'text' : 'password'} className="search-input"
                placeholder="Min. 8 characters"
                value={form.password} onChange={handle} required
                style={{ paddingRight: '2.75rem' }} />
              <button type="button" className="auth-eye-btn"
                onClick={() => setShow(s => !s)} tabIndex={-1}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">{pwdMatch ? '✅' : pwdMismatch ? '❌' : '🔒'}</span>
              <input id="reg-confirm" name="confirm"
                type={showConf ? 'text' : 'password'} className="search-input"
                placeholder="Re-enter password"
                value={form.confirm} onChange={handle} required
                style={{
                  paddingRight: '2.75rem',
                  borderColor: pwdMismatch ? '#fca5a5' : pwdMatch ? '#86efac' : undefined,
                }} />
              <button type="button" className="auth-eye-btn"
                onClick={() => setShowC(s => !s)} tabIndex={-1}>
                {showConf ? '🙈' : '👁️'}
              </button>
            </div>
            {pwdMismatch && (
              <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.3rem' }}>
                Passwords don't match
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <div className="auth-links">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
