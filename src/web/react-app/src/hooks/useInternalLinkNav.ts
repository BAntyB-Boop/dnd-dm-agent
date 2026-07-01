import { useEffect, type RefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';

/** Intercepts clicks on same-origin absolute links inside `ref` and routes them through react-router. */
export function useInternalLinkNav(ref: RefObject<HTMLElement>, navigate: NavigateFunction) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (evt: Event) => {
      const e = evt as MouseEvent;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as HTMLElement)?.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/') || a.target === '_blank') return;
      e.preventDefault();
      navigate(href);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current]);
}
