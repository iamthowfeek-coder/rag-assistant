import { useState } from 'react';
import { api } from './api.js';
import { PublicShell, when } from './ui.jsx';

// Public page at /status: the customer enters the reference number and the email used on the form.
export default function Status() {
  const [form, setForm] = useState({ id: new URLSearchParams(window.location.search).get('ref') || '', email: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api('/api/public/status', { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="hero">
        <p className="eyebrow">Customer support</p>
        <h1>Check your reply</h1>
        <p className="lead">Enter the reference number you were given and the email address you used.</p>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <label>Reference number
          <input required inputMode="numeric" placeholder="12" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        </label>
        <label>Email address
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Looking...' : 'Check'}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {result && (
        <div className="card narrow" role="status">
          <p className="muted">#{result.id} · {result.subject}</p>
          {result.answered ? (
            <>
              <h2>Our reply</h2>
              <div className="box reply">{result.reply}</div>
              <p className="muted">Sent {when(result.replied_at)}</p>
            </>
          ) : (
            <>
              <h2>We have your question</h2>
              <p>A member of our team is reviewing it. Check back later; your reply will appear here.</p>
              <p className="muted">Received {when(result.submitted_at)}</p>
            </>
          )}
        </div>
      )}
    </PublicShell>
  );
}
