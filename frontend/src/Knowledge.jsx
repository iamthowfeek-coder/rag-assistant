import { useEffect, useState } from 'react';
import { api } from './api.js';

const ALLOWED = /\.(txt|md|pdf)$/i;
const MAX_FILES = 50;

function Upload({ token, onDone }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [skipped, setSkipped] = useState(0); // files ignored because of their type or the 50-file limit
  const [fileKey, setFileKey] = useState(0); // changing the key clears the file inputs
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const pick = (e) => {
    const all = Array.from(e.target.files || []);
    const ok = all.filter((f) => ALLOWED.test(f.name)).slice(0, MAX_FILES);
    setFiles(ok);
    setSkipped(all.length - ok.length);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length && !text.trim()) return setMessage({ text: 'Choose files or paste some text.', type: 'error' });
    setBusy(true);
    setMessage({ text: '', type: '' });
    try {
      if (!files.length) {
        const body = new FormData();
        body.append('title', title);
        body.append('text', text);
        const r = await api('/api/documents', { method: 'POST', token, body });
        setMessage({ text: `Added. It was split into ${r.passages} passage${r.passages === 1 ? '' : 's'}.`, type: 'ok' });
      } else {
        let added = 0;
        const failed = [];
        for (let i = 0; i < files.length; i++) { // one request per file, so one bad file does not stop the rest
          setMessage({ text: `Uploading ${i + 1} of ${files.length}: ${files[i].name}`, type: '' });
          const body = new FormData();
          if (files.length === 1) body.append('title', title); // with many files, each uses its own file name
          body.append('file', files[i]);
          try {
            await api('/api/documents', { method: 'POST', token, body });
            added++;
          } catch (err) {
            failed.push(`${files[i].name}: ${err.message}`);
          }
        }
        setMessage(failed.length
          ? { text: `Added ${added} of ${files.length}. Not added:\n${failed.join('\n')}`, type: 'error' }
          : { text: `Added ${added} document${added === 1 ? '' : 's'}.`, type: 'ok' });
      }
      setTitle(''); setText(''); setFiles([]); setSkipped(0); setFileKey((k) => k + 1);
      onDone();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack card" onSubmit={submit}>
      <h3>Add documents</h3>
      <label>Files (.txt, .md or .pdf, 5 MB each, up to {MAX_FILES} at once)
        <input key={`f${fileKey}`} type="file" multiple accept=".txt,.md,.pdf" onChange={pick} />
      </label>
      <label>Or a whole folder (other file types inside it are skipped)
        <input key={`d${fileKey}`} type="file" webkitdirectory="true" multiple onChange={pick} />
      </label>
      {files.length > 0 && (
        <p className="muted">
          {files.length} file{files.length === 1 ? '' : 's'} selected{skipped > 0 ? `, ${skipped} skipped (wrong type or over the limit)` : ''}.
        </p>
      )}
      {files.length === 0 && skipped > 0 && <p className="error">No .txt, .md or .pdf files were found in that selection.</p>}
      {files.length <= 1 && (
        <label>Title (optional for files)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Return policy" />
        </label>
      )}
      {files.length === 0 && (
        <label>Or paste text
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      <button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add'}</button>
      {message.text && <p className={message.type} style={{ whiteSpace: 'pre-line' }} role="status">{message.text}</p>}
    </form>
  );
}

function Search({ token }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setResults(await api(`/api/search?q=${encodeURIComponent(q)}`, { token }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h3>Search the knowledge base</h3>
      <form className="searchbar" onSubmit={submit}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: refund window" aria-label="Search" />
        <button type="submit">Search</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {results && results.length === 0 && <p className="muted">No matching passages. Try other words from the document.</p>}
      {results && results.map((r) => (
        <article className="passage" key={r.id}>
          <p className="source">{r.title} · passage {r.position}</p>
          <p>{r.content}</p>
        </article>
      ))}
    </div>
  );
}

export default function Knowledge({ token, canEdit }) {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');

  const load = () => api('/api/documents', { token }).then(setDocs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.title}" and its passages?`)) return;
    try {
      await api(`/api/documents/${d.id}`, { method: 'DELETE', token });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <div className="page-head"><h2>Knowledge base</h2></div>
      {error && <p className="error" role="alert">{error}</p>}
      {docs.length === 0
        ? <p className="empty">No documents yet.{canEdit ? ' Add one below.' : ' An admin needs to add some.'}</p>
        : (
          <div className="table-wrap"><table>
            <thead><tr><th>Title</th><th>Passages</th><th>Added</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.passage_count}</td>
                  <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  {canEdit && <td><button className="plain" onClick={() => remove(d)}>Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      {canEdit && <Upload token={token} onDone={load} />}
      <Search token={token} />
    </section>
  );
}
