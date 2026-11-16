import { Link } from './router.js';

export const when = (d) => (d ? new Date(d).toLocaleString() : '');
export const STATUS_LABEL = { new: 'Drafting', draft_ready: 'Awaiting review', escalated: 'Needs a person', replied: 'Replied' };

export const Badge = ({ status }) => <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span>;

export const Brand = () => (
  <span className="brand"><span className="mark" aria-hidden="true">◆</span>Support Copilot</span>
);

// The frame around every page a customer (or a signed-out visitor) sees.
export function PublicShell({ children }) {
  return (
    <div className="public">
      <header className="public-bar">
        <Link to="/ask" className="brand-link"><Brand /></Link>
        <nav aria-label="Customer pages">
          <Link to="/ask">Ask a question</Link>
          <Link to="/status">Check your reply</Link>
          <Link to="/">Staff sign in</Link>
        </nav>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-foot">Every reply is reviewed by a person before it is sent.</footer>
    </div>
  );
}
