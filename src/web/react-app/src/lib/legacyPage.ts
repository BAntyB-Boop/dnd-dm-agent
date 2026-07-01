import sharedCss from '../../../public/shared.css?raw';

/**
 * True if the original document declared `<base href="/">` — meaning its
 * author-written relative URLs (e.g. `assets/x.jpg`) were meant to resolve
 * against the SITE ROOT, not the page's own directory.
 */
export function hasRootBase(raw: string): boolean {
  return /<base\s+href=["']\/["']\s*\/?>/i.test(raw);
}

/**
 * Rewrites bare relative `src=`/`href=`/`url()` references to be
 * root-relative, emulating the `<base href="/">` tag that gets dropped when
 * markup is injected via innerHTML (only call this when hasRootBase(raw) is
 * true — see below for why).
 *
 * Pages WITHOUT a `<base href="/">` tag wrote their relative references to
 * resolve against their OWN directory instead (e.g. map/porto-stellare.html's
 * `assets/map-main.jpg`, meant to resolve to `/map/assets/map-main.jpg`).
 * Since our SPA routes mirror each legacy page's original URL path 1:1,
 * those references already resolve correctly untouched — rewriting them to
 * root-relative would be WRONG (this was a real bug: it silently pointed
 * map/porto-stellare.html's local images at the unrelated global
 * `/assets/` folder instead of `/map/assets/`). Callers must gate on
 * hasRootBase() and skip this function entirely for base-tag-less pages.
 */
export function fixAssetPaths(html: string): string {
  html = html.replace(
    /(src|href)(\s*=\s*)(["'])(?!https?:|\/|data:|#|mailto:|javascript:)([^"']+)\3/gi,
    (_m, attr, eq, q, val) => `${attr}${eq}${q}/${val}${q}`,
  );
  html = html.replace(
    /url\(\s*(["']?)(?!https?:|\/|data:)([^"')]+)\1\s*\)/gi,
    (_m, q, val) => `url(${q}/${val}${q})`,
  );
  return html;
}

interface LegacyPage {
  /** `<style>` blocks + body markup, with inline <script src="..."> refs and inline scripts removed. */
  markup: string;
  /** Text content of every inline (non-`src`) `<script>` tag, in document order. */
  scripts: string[];
}

/**
 * Parses a legacy static page into injectable markup + the inline scripts
 * that drove it. External `<script src="/shared.js">` tags are dropped —
 * shared.js is loaded once for the whole app instead (see useSharedJs) so
 * its DM-lock / theme / music-persistence state isn't duplicated per page.
 */
export function parseLegacyPage(raw: string): LegacyPage {
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : raw;
  const styles = (raw.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  const scripts: string[] = [];
  const markup = body.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_m, attrs, code) => {
    if (/\bsrc\s*=/i.test(attrs)) return ''; // shared.js / external — loaded globally instead
    if (code.trim()) scripts.push(code);
    return '';
  });

  let combined = `<style>\n${sharedCss}\n</style>\n${styles}\n${markup}`;
  if (hasRootBase(raw)) combined = fixAssetPaths(combined);
  return { markup: combined, scripts };
}

interface AdvancedLegacyPage {
  markup: string;
  /** External classic `<script src>` tags (anime.js, …), excluding shared.js and any Three.js UMD CDN tag, in order. */
  vendorScripts: string[];
  /** Inline non-module scripts, in order. */
  classicScripts: string[];
  /** Inline `type="module"` scripts, with bare import specifiers already resolved (see below), in order. */
  moduleScripts: string[];
  /**
   * True when the page loaded Three.js as a classic UMD `<script src>`
   * (global `THREE.*` usage) from a CDN. Rather than fetching that CDN
   * script — vendoring arbitrary external JS without a human picking the
   * exact source isn't something we do casually — we self-host by
   * `import()`-ing the ES module build we already vendor locally for
   * story.html and assigning it to `window.THREE`, so the page's existing
   * `THREE.Scene()` etc. calls keep working completely unmodified.
   */
  needsThreeGlobalShim: boolean;
}

const THREE_UMD_PATTERN = /(^|\/)three(\.min)?\.js(\?|$)|three@[\d.]+\/build\/three(\.min)?\.js/i;

/**
 * "three" / "three/addons/" are always forced to our local vendor copy,
 * regardless of what a page's own importmap declares. Every page in this
 * codebase uses the same local paths EXCEPT kael-vorn.html, which (a
 * pre-existing inconsistency in the source content, not introduced by this
 * migration) points straight at a jsdelivr CDN build instead. Honoring that
 * would fetch Three.js from an external CDN at runtime — exactly what we
 * avoid everywhere else (see hero.html's self-host shim) — so these two
 * keys are always pinned locally no matter what any page's importmap says.
 */
const CANONICAL_THREE_MAP: Record<string, string> = {
  three: '/vendor/three/three.module.js',
  'three/addons/': '/vendor/three/addons/',
};

function extractImportMap(raw: string): Record<string, string> {
  const m = raw.match(/<script\s+type=["']importmap["']\s*>([\s\S]*?)<\/script>/i);
  let declared: Record<string, string> = {};
  if (m) {
    try {
      declared = JSON.parse(m[1]).imports || {};
    } catch {
      declared = {};
    }
  }
  return { ...declared, ...CANONICAL_THREE_MAP };
}

/**
 * Rewrites bare module specifiers (`from 'three'`, `import('three/addons/x')`)
 * to the concrete URLs an importmap would have resolved them to. We do this
 * at parse time instead of injecting a live `<script type="importmap">`
 * because a document may only have ONE importmap, and it must be present
 * before the first module script ever runs — both of which break the
 * moment a user re-visits an SPA route a second time.
 */
function resolveModuleSpecifiers(code: string, importMap: Record<string, string>): string {
  const entries = Object.entries(importMap).sort((a, b) => b[0].length - a[0].length);
  if (!entries.length) return code;
  return code.replace(/(from\s+|import\s*\(\s*)(['"])([^'"]+)\2/g, (whole, kw, quote, spec) => {
    for (const [key, val] of entries) {
      if (spec === key) return `${kw}${quote}${val}${quote}`;
      if (key.endsWith('/') && spec.startsWith(key)) {
        return `${kw}${quote}${val}${spec.slice(key.length)}${quote}`;
      }
    }
    return whole;
  });
}

interface ExtractedScripts {
  vendorScripts: string[];
  classicScripts: string[];
  moduleScripts: string[];
  needsThreeGlobalShim: boolean;
}

/**
 * Scans the WHOLE document (not just <body>, since vendor <script src> tags
 * often live in <head>) and buckets every <script> into vendor / classic /
 * module, resolving any importmap-based bare specifiers in module scripts.
 * Shared by parseAdvancedLegacyPage and folio.ts's module-script support.
 */
export function extractScripts(raw: string): ExtractedScripts {
  const importMap = extractImportMap(raw);
  const vendorScripts: string[] = [];
  const classicScripts: string[] = [];
  const moduleScripts: string[] = [];
  let needsThreeGlobalShim = false;

  raw.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_m, attrs: string, code: string) => {
    if (/type=["']importmap["']/i.test(attrs)) return '';
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1];
      if (/shared\.js/i.test(src)) return '';
      if (THREE_UMD_PATTERN.test(src)) {
        needsThreeGlobalShim = true;
        return '';
      }
      vendorScripts.push(src);
      return '';
    }
    if (!code.trim()) return '';
    if (/type=["']module["']/i.test(attrs)) {
      moduleScripts.push(resolveModuleSpecifiers(code, importMap));
    } else {
      classicScripts.push(code);
    }
    return '';
  });

  return { vendorScripts, classicScripts, moduleScripts, needsThreeGlobalShim };
}

/**
 * Like parseLegacyPage, but for pages that also load classic vendor
 * libraries (Three.js, anime.js) and/or ES module scripts with an
 * importmap (hero.html, story.html, sessions/session-1.html).
 */
export function parseAdvancedLegacyPage(raw: string): AdvancedLegacyPage {
  const { vendorScripts, classicScripts, moduleScripts, needsThreeGlobalShim } = extractScripts(raw);

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : raw;
  const bodyNoScripts = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const styles = (raw.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  let markup = `<style>\n${sharedCss}\n</style>\n${styles}\n${bodyNoScripts}`;
  if (hasRootBase(raw)) markup = fixAssetPaths(markup);
  return { markup, vendorScripts, classicScripts, moduleScripts, needsThreeGlobalShim };
}
