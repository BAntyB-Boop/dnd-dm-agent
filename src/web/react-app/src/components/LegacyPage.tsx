import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseLegacyPage } from '../lib/legacyPage';
import { useLegacyScripts } from '../hooks/useLegacyScripts';
import { useInternalLinkNav } from '../hooks/useInternalLinkNav';

/**
 * Generic host for a legacy static page (bestiary, oneshot, sessions, lore,
 * map): injects its markup verbatim and re-executes its original inline
 * scripts (see useLegacyScripts for why that's safer than a manual port for
 * pages this size). `mountKey` should change whenever the page needs a full
 * re-run despite staying on the same route (not currently needed by any of
 * these pages, but kept as an escape hatch).
 */
export function LegacyPage({ raw, mountKey }: { raw: string; mountKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { markup, scripts } = useMemo(() => parseLegacyPage(raw), [raw]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [mountKey]);

  useLegacyScripts(scripts, [mountKey]);
  useInternalLinkNav(ref, navigate);

  return <div ref={ref} className="legacy-page-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}
