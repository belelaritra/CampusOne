import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]   = useState({ username: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    setBusy(true);
    try {
      await register({ username: form.username, email: form.email, phone: form.phone, password: form.password });
      // Auto-login after register
      await login({ username: form.username, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.values(data).flat().join(' ');
        setError(msgs);
      } else {
        setError('Registration failed. Please try again.');
      }
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

        <h2 className="auth-title">Create Account</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <input id="reg-username" name="username" type="text" className="search-input"
              placeholder="Choose a username" value={form.username} onChange={handle} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" name="email" type="email" className="search-input"
              placeholder="you@iitb.ac.in" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-phone">Phone <span style={{ color: 'var(--text-secondary)' }}>(optional)</span></label>
            <input id="reg-phone" name="phone" type="tel" className="search-input"
              placeholder="10-digit mobile number" value={form.phone} onChange={handle} />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" name="password" type="password" className="search-input"
              placeholder="Min. 8 characters" value={form.password} onChange={handle} required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input id="reg-confirm" name="confirm" type="password" className="search-input"
              placeholder="Re-enter password" value={form.confirm} onChange={handle} required />
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
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
