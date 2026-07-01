const loaded = new Map<string, Promise<void>>();

/**
 * Loads a classic (non-module) vendor `<script src>` exactly once per URL
 * for the whole SPA session, so revisiting a page that needs e.g. Three.js
 * doesn't re-fetch or re-register it. Failures resolve instead of reject —
 * the legacy inline scripts that depend on these already guard on the
 * global being undefined (poll-and-retry or graceful skip), so a failed
 * CDN load degrades rather than crashes the page.
 */
export function loadVendorScript(url: string): Promise<void> {
  const cached = loaded.get(url);
  if (cached) return cached;
  const promise = new Promise<void>((resolve) => {
    const el = document.createElement('script');
    el.src = url;
    el.onload = () => resolve();
    el.onerror = () => {
      console.warn(`[vendor] failed to load ${url}`);
      resolve();
    };
    document.head.appendChild(el);
  });
  loaded.set(url, promise);
  return promise;
}

let threeShimPromise: Promise<void> | null = null;

let shimCallbackSeq = 0;

/**
 * Self-hosts Three.js for pages that expect a global `THREE` (classic UMD
 * usage) without fetching a UMD build from a CDN: we already vendor the ES
 * module build locally for story.html, so we import that once and assign it
 * to `window.THREE`. Cached so repeated visits don't re-import.
 *
 * The import is done via an injected `<script type="module">` string rather
 * than a TS-level `import()` call: a dynamic import() written directly in
 * our own source gets seen and rewritten by Vite's dev/build pipeline (it
 * appended a `?import` query and then failed to resolve it against a
 * publicDir asset, even with `@vite-ignore`). Injecting it as a live
 * `<script>` — the same mechanism already proven for story.html's module
 * scripts — is never touched by Vite at all, since it's just a string until
 * the browser executes it at runtime.
 *
 * Completion is signalled by the injected module calling back into a global
 * function directly, NOT via the script element's `load` event: an inline
 * (no `src`) `<script type="module">`'s `load` event turned out to never
 * fire reliably in practice, which silently hung the `Promise.all(...)` that
 * gates hero.html's classic script from ever being appended — Three.js
 * loaded (`window.THREE` got set) but nothing downstream ever ran, so the
 * WebGL canvas was left at its unrendered 300×150 browser default forever.
 */
export function loadThreeGlobalShim(): Promise<void> {
  if (!threeShimPromise) {
    threeShimPromise = new Promise<void>((resolve) => {
      const callbackName = `__vcThreeShimReady${shimCallbackSeq++}__`;
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        delete (window as unknown as Record<string, unknown>)[callbackName];
        resolve();
      };
      const el = document.createElement('script');
      el.type = 'module';
      el.textContent = `
        import * as THREE from '/vendor/three/three.module.js';
        window.THREE = THREE;
        window.${callbackName}();
      `;
      document.head.appendChild(el);
    });
  }
  return threeShimPromise;
}
