import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Link } from './router.js';

const minutes = (m) => (m === null ? '–' : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`);
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

const Stat = ({ label, value, to, hint }) => {
  const body = (<><span className="stat-value">{value}</span><span className="stat-label">{label}</span>{hint && <span className="stat-hint">{hint}</span>}</>);
  return to ? <Link to={to} className="stat">{body}</Link> : <div className="stat">{body}</div>;
};

export default function Dashboard({ token }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/api/stats', { token }).then(setS).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!s) return <p className="muted">Loading...</p>;

  const { tickets: t, replies: r } = s;
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
  const maxDay = Math.max(1, ...s.per_day.map((d) => d.count));
  const kinds = [
    ['AI draft sent unchanged', r.unchanged],
    ['AI draft edited by a person', r.edited],
    ['Written by a person', r.written],
  ];

  return (
    <section>
      <div className="page-head"><h2>Dashboard</h2></div>
      <div className="stats">
        <Stat label="Tickets received" value={t.total} to="/tickets" />
        <Stat label="Awaiting review" value={t.draft_ready} to="/tickets?status=draft_ready" hint="A draft is ready for a person" />
        <Stat label="Needs a person" value={t.escalated} to="/tickets?status=escalated" hint="The documents did not answer" />
        <Stat label="Replied" value={t.replied} to="/tickets?status=replied" />
        <Stat label="Average time to reply" value={minutes(s.avg_minutes)} />
        <Stat label="Drafts sent unchanged" value={t.replied ? `${pct(r.unchanged, t.replied)}%` : '–'} hint="Of all replies sent" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Tickets, last 7 days</h3>
          <div className="bars" role="img" aria-label="Tickets per day for the last 7 days">
            {s.per_day.map((d) => (
              <div className="bar-col" key={d.date}>
                <span className="bar-val">{d.count}</span>
                <div className="bar-track"><div className="bar-fill" style={{ height: `${(d.count / maxDay) * 100}%` }} /></div>
                <span className="bar-day">{dayName(d.date)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>How replies were made</h3>
          {t.replied === 0 ? <p className="muted">No replies sent yet.</p> : kinds.map(([label, n]) => (
            <div className="hbar" key={label}>
              <div className="hbar-top"><span>{label}</span><span>{n} ({pct(n, t.replied)}%)</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: `${pct(n, t.replied)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Knowledge base</h3>
        <p>
          <strong>{s.kb.documents}</strong> documents split into <strong>{s.kb.passages}</strong> passages.
          {s.kb.pending_suggestions > 0 && (<> <Link to="/suggestions">{s.kb.pending_suggestions} suggested answer{s.kb.pending_suggestions === 1 ? '' : 's'}</Link> waiting for review.</>)}
        </p>
      </div>
    </section>
  );
}
