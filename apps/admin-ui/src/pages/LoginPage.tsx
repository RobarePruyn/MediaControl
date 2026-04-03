/**
 * Login page for admin authentication.
 * Supports email/password and SSO login.
 * @module admin-ui/pages/LoginPage
 */

import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import './pages.css';

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleSso = () => {
    window.location.href = '/api/auth/sso/okta';
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <h1 className="login-title">SuiteCommand</h1>
        <p className="login-subtitle">Admin Portal</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <label className="form-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="admin@example.com"
            />
          </label>

          <label className="form-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </label>

          <button type="submit" className="btn-primary login-btn" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button className="btn-ghost login-btn" onClick={handleSso}>
          Sign in with SSO
        </button>
      </div>
    </div>
  );
}
