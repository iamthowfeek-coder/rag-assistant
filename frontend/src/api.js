// One place for every request to the server. Throws an Error with the server's message.
export async function api(path, { method = 'GET', body, token } = {}) {
  const isForm = body instanceof FormData; // file uploads: the browser sets the Content-Type itself
  const res = await fetch(path, {
    method,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) window.dispatchEvent(new Event('session-expired')); // the app signs the person out
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}
