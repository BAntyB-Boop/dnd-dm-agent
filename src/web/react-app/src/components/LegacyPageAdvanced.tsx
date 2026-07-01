import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAdvancedLegacyPage } from '../lib/legacyPage';
import { useAdvancedLegacyScripts } from '../hooks/useAdvancedLegacyScripts';
import { useInternalLinkNav } from '../hooks/useInternalLinkNav';

/**
 * Host for legacy pages that also need vendor libraries and/or ES module
 * scripts (hero.html's Three.js sigil + ember canvas, story.html's Three.js
 * galaxy/ship scenes). See useAdvancedLegacyScripts / parseAdvancedLegacyPage.
 *
 * Known limitation: these pages run continuous requestAnimationFrame loops
 * (particle systems, WebGL renders) that are never explicitly torn down —
 * the legacy static site relied on a full page unload to kill them. Here,
 * navigating away only removes the injected DOM/script tags; already-running
 * closures keep executing until they hit a removed canvas and error out
 * internally (each loop is expected to guard on element existence, same as
 * everywhere else in this codebase, but this hasn't been visually verified
 * in a browser). Flagged for follow-up if it turns out to leak CPU/GPU.
 */
export function LegacyPageAdvanced({ raw, mountKey }: { raw: string; mountKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { markup, vendorScripts, classicScripts, moduleScripts, needsThreeGlobalShim } = useMemo(
    () => parseAdvancedLegacyPage(raw),
    [raw],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [mountKey]);

  useAdvancedLegacyScripts(vendorScripts, classicScripts, moduleScripts, needsThreeGlobalShim, [mountKey]);
  useInternalLinkNav(ref, navigate);

  return <div ref={ref} className="legacy-page-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}
