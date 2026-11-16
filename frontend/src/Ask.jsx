import { useState } from 'react';
import { api } from './api.js';
import { Link } from './router.js';
import { PublicShell } from './ui.jsx';

// Public page at /ask: customers need no account.
export default function Ask() {
  const empty = { name: '', email: '', subject: '', message: '', website: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSent(await api('/api/public/tickets', { method: 'POST', body: form }));
      setForm(empty);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <PublicShell>
        <div className="hero">
          <p className="eyebrow">Question received</p>
          <h1>Thank you</h1>
          <p className="lead">A member of our team will review your question and reply.</p>
        </div>
        <div className="card narrow">
          {sent.id > 0 && (
            <>
              <p className="muted">Your reference number</p>
              <p className="reference">#{sent.id}</p>
              <p>Keep it, together with the email address you used. You can read our reply on the{' '}
                <Link to={`/status?ref=${sent.id}`}>status page</Link>.</p>
            </>
          )}
          <button className="secondary" onClick={() => setSent(null)}>Ask another question</button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="hero">
        <p className="eyebrow">Customer support</p>
        <h1>Ask us a question</h1>
        <p className="lead">Tell us what you need help with. A member of our team reviews every answer before it is sent.</p>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <label>Your name
          <input required maxLength={100} value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label>Email address
          <input type="email" required maxLength={150} value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label>Subject
          <input required maxLength={200} value={form.subject} onChange={set('subject')} />
        </label>
        <label>Your question
          <textarea required rows={6} minLength={10} maxLength={3000} value={form.message} onChange={set('message')} />
        </label>
        <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />
        <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send question'}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </PublicShell>
  );
}
