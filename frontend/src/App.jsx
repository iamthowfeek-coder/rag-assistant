import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Link, navigate, usePath } from './router.js';
import { Brand } from './ui.jsx';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import { TicketList, TicketDetail } from './Tickets.jsx';
import Knowledge from './Knowledge.jsx';
import Suggestions from './Suggestions.jsx';
import Team from './Team.jsx';
import Ask from './Ask.jsx';
import Status from './Status.jsx';

function NavItem({ to, path, children }) {
  const active = path === to || path.startsWith(`${to}/`);
  return <Link to={to} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>{children}</Link>;
}

function Staff({ path }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('token')));

  const logout = () => {
    sessionStorage.removeItem('token');
    setToken('');
    setUser(null);
    setChecking(false);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!token || user) return;
    api('/api/auth/me', { token }).then(setUser).catch(logout).finally(() => setChecking(false));
  }, [token]);

  useEffect(() => { // any request that comes back "please sign in again" ends the session
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, []);

  const isAdmin = user?.role === 'admin';
  const segs = path.split('/').filter(Boolean);
  const section = segs[0] || '';
  const home = isAdmin ? '/dashboard' : '/tickets';
  const allowed = { dashboard: isAdmin, tickets: true, knowledge: true, suggestions: isAdmin, team: isAdmin };
  const valid = Boolean(allowed[section]) && (section === 'tickets'
    ? segs.length === 1 || (segs.length === 2 && /^\d+$/.test(segs[1]))
    : segs.length === 1);
  useEffect(() => { if (user && !valid) navigate(home, { replace: true }); }, [user, path]);

  const onLogin = ({ token: t, user: u }) => {
    sessionStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    setChecking(false);
  };

  if (checking) return <p className="loading">Loading...</p>;
  if (!user) return <Login onLogin={onLogin} />;
  if (!valid) return <p className="loading">Loading...</p>;

  return (
    <>
      <header className="topbar">
        <Link to={home} className="brand-link"><Brand /></Link>
        <div className="user">
          <span className="user-name">{user.name}</span>
          <span className="role">{user.role}</span>
          <button className="plain" onClick={logout}>Sign out</button>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        {isAdmin && <NavItem to="/dashboard" path={path}>Dashboard</NavItem>}
        <NavItem to="/tickets" path={path}>Tickets</NavItem>
        <NavItem to="/knowledge" path={path}>Knowledge base</NavItem>
        {isAdmin && <NavItem to="/suggestions" path={path}>Suggestions</NavItem>}
        {isAdmin && <NavItem to="/team" path={path}>Team</NavItem>}
      </nav>
      <main className="page">
        {section === 'dashboard' && <Dashboard token={token} />}
        {section === 'tickets' && (segs[1] ? <TicketDetail key={segs[1]} token={token} id={segs[1]} /> : <TicketList token={token} />)}
        {section === 'knowledge' && <Knowledge token={token} canEdit={isAdmin} />}
        {section === 'suggestions' && <Suggestions token={token} />}
        {section === 'team' && <Team token={token} me={user} />}
      </main>
    </>
  );
}

// Customers use /ask and /status without logging in; everyone else gets the staff app.
export default function App() {
  const path = usePath();
  if (path === '/ask') return <Ask />;
  if (path === '/status') return <Status />;
  return <Staff path={path} />;
}
