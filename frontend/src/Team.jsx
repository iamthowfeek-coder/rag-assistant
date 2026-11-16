import { useEffect, useState } from 'react';
import { api } from './api.js';
import { when } from './ui.jsx';

export default function Team({ token, me }) {
  const empty = { name: '', email: '', password: '', role: 'agent' };
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState({ text: '', type: '' });

  const load = () => api('/api/users', { token }).then(setUsers).catch((e) => setMessage({ text: e.message, type: 'error' }));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/api/users', { method: 'POST', token, body: form });
      setForm(empty);
      setMessage({ text: 'Team member added.', type: 'ok' });
      load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const setActive = async (u, active) => {
    try {
      await api(`/api/users/${u.id}`, { method: 'PATCH', token, body: { active } });
      setMessage({ text: `${u.name} was ${active ? 'reactivated' : 'deactivated'}.`, type: 'ok' });
      load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  return (
    <section>
      <div className="page-head"><h2>Team</h2></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                <td>{u.active ? 'Active' : 'Deactivated'}</td>
                <td>{when(u.created_at)}</td>
                <td>{u.id !== me.id && (
                  <button className="plain" onClick={() => setActive(u, !u.active)}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={add}>
        <h3>Add a team member</h3>
        <div className="row">
          <input placeholder="Name" aria-label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="email" placeholder="Email" aria-label="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input type="password" placeholder="Password (8+ characters)" aria-label="Password" required minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit">Add member</button>
        </div>
        {message.text && <p className={message.type} role="status">{message.text}</p>}
      </form>
    </section>
  );
}
