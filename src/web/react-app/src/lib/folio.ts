import sharedCss from '../../../public/shared.css?raw';
import { hasRootBase, fixAssetPaths, extractScripts } from './legacyPage';

/**
 * Some folios (aython, kael-vorn) gate their ENTIRE content behind a
 * full-screen cinematic intro overlay (e.g. `.kv-intro{position:fixed;
 * inset:0;z-index:9999;opacity:1}`) that only their own `<script
 * type="module">` ever hides (by adding a `.done` class once the Three.js
 * sequence finishes). Folio pages hand-port a small, known set of
 * behaviours (see useFolioBehaviors) instead of blindly replaying every
 * original script, so unless that module script is also wired up and
 * succeeds, the overlay is left in its default, fully-opaque state —
 * permanently hiding the whole page behind a black (or curtained) screen.
 * One of the two known instances (kael-vorn) imports a Three.js addon file
 * that isn't vendored locally, so its script is guaranteed to fail.
 *
 * Rather than leave page visibility hostage to whether a decorative intro
 * animation happens to load, we detect any such overlay (a CSS class ending
 * in "-intro" whose rule includes `position:fixed`) and force it hidden
 * unconditionally. The cinematic intro is a nice-to-have; the folio content
 * underneath must always be visible.
 */
function detectIntroOverlayClasses(raw: string): string[] {
  const found = new Set<string>();
  const re = /\.([\w-]+-intro)\s*\{([^}]*)\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (/position\s*:\s*fixed/i.test(m[2])) found.add(m[1]);
  }
  return [...found];
}

interface FolioParseResult {
  markup: string;
  vendorScripts: string[];
  moduleScripts: string[];
}

/**
 * Turn a raw legacy folio HTML document into an injectable fragment plus
 * the vendor/module scripts (if any) that drive its optional Three.js
 * decorations:
 *  - keep the head `<style>` blocks (they carry the page's whole look)
 *  - prepend shared.css so base/back-link/folio-nav/scroll-top styles exist
 *  - force-hide any full-screen cinematic intro overlay (see above)
 *  - take the `<body>` inner markup, minus its classic `<script>` tags
 *    (those are hand-ported to React — see useFolioBehaviors) but WITH its
 *    vendor/module scripts extracted for the caller to execute
 *  - fix relative asset paths (every folio has `<base href="/">`, so this
 *    always applies — see legacyPage.ts's fixAssetPaths for why that check
 *    matters for OTHER legacy pages that don't have the base tag)
 *
 * The `<style>` rides inside the mounted node, so it is removed automatically
 * when the route unmounts — no manual CSS scoping needed.
 */
export function buildFolioHtml(raw: string): FolioParseResult {
  const { vendorScripts, moduleScripts } = extractScripts(raw);

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : raw;
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  const styles = (raw.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  const introOverrides = detectIntroOverlayClasses(raw)
    .map((cls) => `.${cls}{display:none !important}`)
    .join('\n');

  let combined = `<style>\n${sharedCss}\n</style>\n${styles}\n<style>\n${introOverrides}\n</style>\n${body}`;
  if (hasRootBase(raw)) combined = fixAssetPaths(combined);
  return { markup: combined, vendorScripts, moduleScripts };
}
