import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Link } from './router.js';
import { when } from './ui.jsx';

function Suggestion({ s, token, onDone }) {
  const [title, setTitle] = useState(s.title);
  const [content, setContent] = useState(`Question: ${s.question}\n\nAnswer: ${s.answer}`);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const act = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      await api(`/api/suggestions/${s.id}/${kind}`, { method: 'POST', token, body: kind === 'approve' ? { title, content } : undefined });
      onDone(kind === 'approve' ? `"${title}" was added to the knowledge base.` : 'Suggestion rejected.');
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <article className="card stack">
      <p className="muted">From ticket <Link to={`/tickets/${s.ticket_id}`}>#{s.ticket_id}</Link> · suggested by {s.suggested_by_name || 'a team member'} · {when(s.created_at)}</p>
      <label>Title
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>Text to add
        <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button onClick={() => act('approve')} disabled={busy !== '' || !title.trim() || !content.trim()}>{busy === 'approve' ? 'Adding...' : 'Add to knowledge base'}</button>
        <button className="secondary" onClick={() => act('reject')} disabled={busy !== ''}>Reject</button>
      </div>
    </article>
  );
}

export default function Suggestions({ token }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api('/api/suggestions', { token }).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="page-head"><h2>Suggested answers</h2></div>
      <p className="muted">
        When a person answers a question the documents could not, they can suggest the answer for the knowledge base.
        Edit the text if needed and remove any personal details before you add it.
      </p>
      {notice && <p className="ok" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {list && list.length === 0 && <p className="empty">No suggestions waiting.</p>}
      {list && list.map((s) => (
        <Suggestion key={s.id} s={s} token={token} onDone={(msg) => { setNotice(msg); load(); }} />
      ))}
    </section>
  );
}
