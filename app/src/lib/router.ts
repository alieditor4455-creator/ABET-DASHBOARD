import { useEffect, useState } from 'react';

/** Minimal path router: /section/:id?step=n. Cloudflare Pages serves index.html for every path (public/_redirects). */
export function navigate(to: string) {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute() {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const f = () => setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  const parts = loc.path.split('/').filter(Boolean);
  return { section: parts[0] ?? 'dashboard', id: parts[1] ?? null, params: new URLSearchParams(loc.search) };
}

/** Use on <a> for client-side navigation while keeping real links (open in new tab still works). */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
