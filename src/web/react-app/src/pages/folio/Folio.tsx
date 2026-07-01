import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildFolioHtml } from '../../lib/folio';
import { useFolioBehaviors } from '../../hooks/useFolioBehaviors';
import { useAdvancedLegacyScripts } from '../../hooks/useAdvancedLegacyScripts';
import Placeholder from '../Placeholder';

// Each entry is its own dynamic import, so opening a folio only downloads
// that one character's HTML/CSS chunk instead of bundling all 7 together
// (previously ~695KB shipped no matter which folio a visitor opened).
const LOADERS: Record<string, () => Promise<{ default: string }>> = {
  anuchit: () => import('../../../../public/folio/anuchit.html?raw'),
  aurora: () => import('../../../../public/folio/aurora.html?raw'),
  aython: () => import('../../../../public/folio/aython.html?raw'),
  dermogorgon: () => import('../../../../public/folio/dermogorgon.html?raw'),
  jen: () => import('../../../../public/folio/jen.html?raw'),
  'kael-veranth': () => import('../../../../public/folio/kael-veranth.html?raw'),
  'kael-vorn': () => import('../../../../public/folio/kael-vorn.html?raw'),
};

function Folio({ raw, slug }: { raw: string; slug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { markup, vendorScripts, moduleScripts } = useMemo(() => buildFolioHtml(raw), [raw]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useFolioBehaviors(ref, slug, navigate);
  // Optional decorative Three.js intro sequences some folios have (aython,
  // dermogorgon, jen, kael-vorn) — classicScripts is [] because folio's
  // known interactive behaviours are hand-ported by useFolioBehaviors
  // instead of replayed verbatim (see buildFolioHtml for why: replaying them
  // both would double up event listeners). needsThreeGlobalShim is false —
  // no folio uses classic-UMD Three, they all import it as an ES module.
  useAdvancedLegacyScripts(vendorScripts, [], moduleScripts, false, [slug]);

  return <div ref={ref} className="folio-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}

/** Route handler for `/folio/:slug` — lazily loads and renders any migrated folio. */
export default function FolioRoute() {
  const { slug = '' } = useParams();
  const [raw, setRaw] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loader = LOADERS[slug];
    if (!loader) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setRaw(null);
    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) setRaw(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) return <Placeholder />;
  if (raw === null) return null; // brief gap while this folio's chunk downloads
  return <Folio raw={raw} slug={slug} />;
}
