import { useEffect, useRef } from 'react';
import { ensureSharedJsLoaded } from '../lib/sharedJs';

/**
 * Runs a legacy page's original inline <script> bodies against the DOM
 * produced by dangerouslySetInnerHTML, instead of hand-porting each script
 * to React. These scripts are large, self-contained, and only ever touch
 * their own page's DOM by id/class (already guarded on element existence,
 * matching the pattern shared.js itself uses) — re-executing them verbatim
 * is far less error-prone than a manual line-by-line rewrite for pages this
 * size, and behaviour stays pixel/logic-identical to the legacy site.
 *
 * Scripts are appended as real <script> elements (dangerouslySetInnerHTML
 * never executes embedded <script> tags) once the markup is in the DOM, in
 * their original order, mimicking normal top-to-bottom page load.
 *
 * `ran` guards against React StrictMode's dev-only double-invoke of effects
 * — without it, top-level `fetch`/DOM-mutating scripts (e.g. bestiary's
 * monster loader) would run twice on every initial mount.
 */
export function useLegacyScripts(scripts: string[], deps: unknown[]) {
  const ran = useRef(false);

  useEffect(() => {
    ensureSharedJsLoaded();
    if (ran.current) return;
    ran.current = true;

    const appended: HTMLScriptElement[] = [];
    for (const code of scripts) {
      const el = document.createElement('script');
      el.textContent = code;
      document.body.appendChild(el);
      appended.push(el);
    }

    return () => {
      appended.forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
