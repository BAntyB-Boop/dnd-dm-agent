import { useEffect, useRef } from 'react';
import { ensureSharedJsLoaded } from '../lib/sharedJs';
import { loadVendorScript, loadThreeGlobalShim } from '../lib/vendorScript';

/**
 * Like useLegacyScripts, but first awaits the page's vendor libraries
 * (Three.js, anime.js) before replaying its classic + ES module inline
 * scripts, so the retry/guard code those scripts already contain
 * (`if (typeof THREE === 'undefined') …`) has the best chance of finding
 * the library ready on the first pass.
 *
 * `ran` guards the async work itself against React StrictMode's dev-only
 * double-invoke — but the returned cleanup is intentionally NOT tied to a
 * `cancelled` flag closed over that same run: StrictMode fires that cleanup
 * synchronously, before `await Promise.all(vendorScripts…)` (a real network
 * fetch) has any chance to resolve, which would otherwise cancel the append
 * step before it ever runs and silently drop the page's Three.js/anime
 * scenes in dev. Instead every effect invocation returns the same
 * ref-backed cleanup, which reads `appendedRef.current` live at call time —
 * so whichever cleanup call actually fires at real-unmount time still finds
 * and removes whatever ended up appended, however late that was.
 */
export function useAdvancedLegacyScripts(
  vendorScripts: string[],
  classicScripts: string[],
  moduleScripts: string[],
  needsThreeGlobalShim: boolean,
  deps: unknown[],
) {
  const ran = useRef(false);
  const appendedRef = useRef<HTMLScriptElement[]>([]);

  useEffect(() => {
    ensureSharedJsLoaded();

    if (!ran.current) {
      ran.current = true;
      (async () => {
        const tasks: Promise<unknown>[] = vendorScripts.map(loadVendorScript);
        if (needsThreeGlobalShim) tasks.push(loadThreeGlobalShim());
        await Promise.all(tasks);

        for (const code of classicScripts) {
          const el = document.createElement('script');
          el.textContent = code;
          document.body.appendChild(el);
          appendedRef.current.push(el);
        }
        for (const code of moduleScripts) {
          const el = document.createElement('script');
          el.type = 'module';
          el.textContent = code;
          document.body.appendChild(el);
          appendedRef.current.push(el);
        }
      })();
    }

    return () => {
      appendedRef.current.forEach((el) => el.remove());
      appendedRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
