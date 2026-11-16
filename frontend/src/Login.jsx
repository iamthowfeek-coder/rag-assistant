import { useState } from 'react';
import { api } from './api.js';
import { PublicShell } from './ui.jsx';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/api/auth/login', { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="hero">
        <p className="eyebrow">Staff area</p>
        <h1>Sign in</h1>
        <p className="lead">
          Drafts replies from your company documents, shows where each answer came from, and hands
          questions it cannot answer to a person.
        </p>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <label>Email
          <input type="email" required autoComplete="username" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </PublicShell>
  );
}
