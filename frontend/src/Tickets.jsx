import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Link } from './router.js';
import { Badge, when } from './ui.jsx';

export function TicketList({ token }) {
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get('status') || '');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('q', search);
    return api(`/api/tickets?${params}`, { token }).then((t) => { setTickets(t); setError(''); }).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    const h = setInterval(load, 15000); // the queue refreshes itself
    return () => clearInterval(h);
  }, [status, search]);

  return (
    <section>
      <div className="page-head"><h2>Tickets</h2></div>
      <p className="muted">Customers send questions at <strong>/ask</strong> and check replies at <strong>/status</strong>.</p>
      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); setSearch(typed.trim()); }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All tickets</option>
          <option value="draft_ready">Awaiting review</option>
          <option value="escalated">Needs a person</option>
          <option value="replied">Replied</option>
          <option value="new">Drafting</option>
        </select>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search subject, name or email" aria-label="Search tickets" />
        <button type="submit">Search</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {tickets && tickets.length === 0 && <p className="empty">No tickets match.</p>}
      {tickets && tickets.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Subject</th><th>Customer</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td><Link to={`/tickets/${t.id}`} className="row-link">{t.subject}</Link></td>
                  <td>{t.customer_name}</td>
                  <td><Badge status={t.status} /></td>
                  <td>{when(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const HOW = { draft_unchanged: 'AI draft, sent unchanged', draft_edited: 'AI draft, edited by a person', written: 'Written by a person' };
const EMAIL = { sent: 'Emailed to the customer', failed: 'Email failed (the reply is on the status page)', not_configured: 'Email not set up (the reply is on the status page)' };

export function TicketDetail({ token, id }) {
  const [t, setT] = useState(null);
  const [reply, setReply] = useState('');
  const [touched, setTouched] = useState(false); // true once the person has typed in the editor
  const [suggest, setSuggest] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api(`/api/tickets/${id}`, { token }).then(setT).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => { // a ticket still being drafted refreshes itself
    if (t?.status !== 'new') return;
    const h = setTimeout(load, 3000);
    return () => clearTimeout(h);
  }, [t]);
  useEffect(() => { // put the draft in the editor until the person starts typing
    if (!t || t.status === 'replied' || touched) return;
    setReply(t.ai_draft || '');
    setSuggest(t.status === 'escalated');
  }, [t?.status, t?.ai_draft]);

  const redraft = async () => {
    if (touched && !window.confirm('Your edits will be replaced by a new draft. Continue?')) return;
    setBusy('draft');
    setError('');
    try {
      const r = await api(`/api/tickets/${id}/redraft`, { method: 'POST', token });
      setT(r);
      setReply(r.ai_draft || '');
      setSuggest(r.status === 'escalated');
      setTouched(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    if (!window.confirm(`Send this reply to ${t.customer_email}?`)) return;
    setBusy('send');
    setError('');
    try {
      const r = await api(`/api/tickets/${id}/reply`, { method: 'POST', token, body: { reply, suggest_kb: suggest } });
      setT(r);
      setNotice(r.email_status === 'sent' ? 'Reply sent by email.'
        : r.email_status === 'failed' ? 'Reply saved, but the email could not be sent. The customer can read it on the status page.'
        : `Reply saved. Email is not set up, so the customer reads it on the status page with reference #${r.id}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!t) return <section><Link to="/tickets" className="back">← All tickets</Link>{error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading...</p>}</section>;

  return (
    <section>
      <Link to="/tickets" className="back">← All tickets</Link>
      <div className="page-head"><h2>#{t.id} {t.subject}</h2><Badge status={t.status} /></div>
      <p className="muted">{t.customer_name} · {t.customer_email} · received {when(t.created_at)}</p>

      <div className="split">
        <div>
          <h3>Customer's question</h3>
          <div className="box">{t.message}</div>
          {t.sources.length > 0 && (
            <>
              <h3>Sources the draft used</h3>
              {t.sources.map((s) => (
                <article className="passage" key={s.passage_id}>
                  <p className="source">{s.title} · passage {s.position}</p>
                  <p>{s.content}</p>
                </article>
              ))}
            </>
          )}
        </div>

        <div>
          {t.status === 'replied' ? (
            <>
              <h3>Reply sent</h3>
              {notice && <p className="ok" role="status">{notice}</p>}
              <div className="box reply">{t.reply_text}</div>
              <dl className="facts">
                <div><dt>Sent by</dt><dd>{t.replied_by_name || 'A team member'}</dd></div>
                <div><dt>Sent on</dt><dd>{when(t.replied_at)}</dd></div>
                <div><dt>How</dt><dd>{HOW[t.reply_kind] || '–'}</dd></div>
                <div><dt>Email</dt><dd>{EMAIL[t.email_status] || '–'}</dd></div>
                {t.suggested && <div><dt>Knowledge base</dt><dd>Suggested for the knowledge base</dd></div>}
              </dl>
            </>
          ) : (
            <>
              <h3>{t.status === 'escalated' ? 'Write a reply' : 'Review the draft'}</h3>
              {t.status === 'escalated' && <div className="box escalated">{t.escalation_reason}</div>}
              {t.status === 'new' && <p className="muted">The draft is being prepared. This page refreshes by itself.</p>}
              {t.status === 'draft_ready' && t.drafted_by === 'template' && <p className="muted">This is a basic template draft (no AI key is set). Check it carefully.</p>}
              <label className="editor">Reply to {t.customer_name}
                <textarea rows={12} maxLength={5000} value={reply} onChange={(e) => { setReply(e.target.value); setTouched(true); }} placeholder="Write the reply here" />
              </label>
              <p className="muted counter">{reply.length} / 5000</p>
              <label className="check">
                <input type="checkbox" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} />
                Suggest this answer for the knowledge base (an admin reviews it first)
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="actions">
                <button onClick={send} disabled={!reply.trim() || busy !== '' || t.status === 'new'}>{busy === 'send' ? 'Sending...' : 'Approve and send'}</button>
                <button className="secondary" onClick={redraft} disabled={busy !== ''}>{busy === 'draft' ? 'Drafting...' : 'Draft again'}</button>
              </div>
            </>
          )}
          {t.status === 'replied' && error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}
