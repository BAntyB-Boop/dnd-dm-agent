import sharedJsSrc from '../../../public/shared.js?raw';

let loaded = false;

/**
 * Loads the legacy shared.js exactly once for the whole SPA session. It
 * defines window.VCLock (DM passcode gate used by bestiary/oneshot/lore/map
 * pages) plus the theme/live-clock/panel-reveal IIFEs — all idempotent and
 * guarded on element existence, so loading it once globally (instead of
 * once per legacy page, as the static site used to) is safe and avoids
 * re-registering document-level listeners on every navigation.
 */
export function ensureSharedJsLoaded() {
  if (loaded) return;
  loaded = true;
  const script = document.createElement('script');
  script.textContent = sharedJsSrc;
  document.head.appendChild(script);
}
