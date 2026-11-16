// A tiny router built on the browser's history API, so every page has its own address
// (for example /tickets/12) and refreshing or sharing a link keeps you on the same page.
import { createElement, useEffect, useState } from 'react';

export const cleanPath = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';
const currentPath = () => cleanPath(window.location.pathname);

export function navigate(to, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
  window.dispatchEvent(new Event('navigate'));
  if (!replace) window.scrollTo(0, 0);
}

export function usePath() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('popstate', update);
    window.addEventListener('navigate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('navigate', update);
    };
  }, []);
  return path;
}

export function Link({ to, children, ...props }) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return createElement('a', { href: to, onClick, ...props }, children);
}
