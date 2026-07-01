import { useEffect, type RefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';

/**
 * Re-wires the vanilla behaviours the legacy folio pages relied on, run
 * against the innerHTML-injected DOM. Every behaviour guards on element
 * existence (mirroring the old shared.js IIFEs), so this one hook works for
 * any folio regardless of which pieces that folio actually contains.
 */
export function useFolioBehaviors(
  ref: RefObject<HTMLElement>,
  slug: string,
  navigate: NavigateFunction,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];
    const on = (
      target: EventTarget,
      type: string,
      fn: (e: Event) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    // ── Reading progress bar ────────────────────────────────
    const bar = root.querySelector<HTMLElement>('#read-progress');
    if (bar) {
      const onScroll = () => {
        const dh = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (dh > 0 ? (window.scrollY / dh) * 100 : 0) + '%';
      };
      on(window, 'scroll', onScroll, { passive: true });
      onScroll();
    }

    // ── Oath keeper/broken toggle (colours the whole page) ──
    const keep = root.querySelector<HTMLElement>('#btn-keeper');
    const brk = root.querySelector<HTMLElement>('#btn-broken');
    if (keep && brk) {
      const set = (broken: boolean) => {
        document.body.classList.toggle('broken', broken);
        keep.classList.toggle('active', !broken);
        brk.classList.toggle('active', broken);
      };
      on(keep, 'click', () => set(false));
      on(brk, 'click', () => set(true));
      cleanups.push(() => document.body.classList.remove('broken'));
    }

    // ── Scroll-to-top button ────────────────────────────────
    const topBtn = root.querySelector<HTMLElement>('#scroll-top');
    if (topBtn) {
      const onScroll = () => topBtn.classList.toggle('show', window.scrollY > 400);
      on(window, 'scroll', onScroll, { passive: true });
      on(topBtn, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // ── Per-folio music player ──────────────────────────────
    const audio = root.querySelector<HTMLAudioElement>('#bg-audio');
    const musicBtn = root.querySelector<HTMLElement>('#music-btn');
    const musicCtrl = root.querySelector<HTMLElement>('#music-ctrl');
    const iconSound = root.querySelector<HTMLElement>('#icon-sound');
    const iconMute = root.querySelector<HTMLElement>('#icon-mute');
    const volSlider = root.querySelector<HTMLInputElement>('#music-vol');
    if (audio && musicBtn) {
      const volKey = `characters/${slug}/music-vol`;
      const muteKey = `characters/${slug}/music-mute`;
      const updateSlider = () => {
        if (!volSlider) return;
        volSlider.style.setProperty('--fill', Math.round(parseFloat(volSlider.value) * 100) + '%');
      };
      try {
        const sv = localStorage.getItem(volKey);
        const sm = localStorage.getItem(muteKey);
        if (sv !== null) {
          audio.volume = parseFloat(sv);
          if (volSlider) volSlider.value = sv;
        } else audio.volume = 0.3;
        if (sm === 'true' && iconSound && iconMute) {
          audio.muted = true;
          iconSound.style.display = 'none';
          iconMute.style.display = '';
        }
      } catch {
        audio.volume = 0.3;
      }
      updateSlider();

      let started = false;
      const triggers = ['click', 'scroll', 'touchstart', 'keydown', 'mousedown', 'pointermove'];
      const tryStart = () => {
        if (!started) audio.play().catch(() => {});
      };
      const onPlaying = () => {
        if (started) return;
        started = true;
        musicCtrl?.classList.remove('pending');
        triggers.forEach((ev) => document.removeEventListener(ev, tryStart));
      };
      on(audio, 'playing', onPlaying);
      audio.play().then(onPlaying).catch(() => {
        musicCtrl?.classList.add('pending');
        triggers.forEach((ev) =>
          document.addEventListener(ev, tryStart, { passive: true } as AddEventListenerOptions),
        );
        cleanups.push(() => triggers.forEach((ev) => document.removeEventListener(ev, tryStart)));
      });
      on(document, 'visibilitychange', () => {
        if (!document.hidden && !started) tryStart();
      });
      on(musicBtn, 'click', () => {
        if (!started) {
          tryStart();
          return;
        }
        audio.muted = !audio.muted;
        if (iconSound) iconSound.style.display = audio.muted ? 'none' : '';
        if (iconMute) iconMute.style.display = audio.muted ? '' : 'none';
        try {
          localStorage.setItem(muteKey, String(audio.muted));
        } catch {
          /* ignore */
        }
      });
      if (volSlider) {
        on(volSlider, 'input', () => {
          audio.volume = parseFloat(volSlider.value);
          updateSlider();
          if (!started) tryStart();
          if (audio.muted && audio.volume > 0) {
            audio.muted = false;
            if (iconSound) iconSound.style.display = '';
            if (iconMute) iconMute.style.display = 'none';
            try {
              localStorage.setItem(muteKey, 'false');
            } catch {
              /* ignore */
            }
          }
        });
        on(volSlider, 'change', () => {
          try {
            localStorage.setItem(volKey, String(audio.volume));
          } catch {
            /* ignore */
          }
        });
      }
      // Stop this folio's track when leaving the route.
      cleanups.push(() => {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
      });
    }

    // ── M key toggles the folio's music ─────────────────────
    if (musicBtn) {
      const onKey = (evt: Event) => {
        const e = evt as KeyboardEvent;
        if (e.key !== 'm' && e.key !== 'M') return;
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        musicBtn.click();
      };
      on(document, 'keydown', onKey);
    }

    // ── Client-side navigation for internal links ───────────
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
    on(root, 'click', onClick);

    // ── Arrow keys navigate prev/next folio ─────────────────
    const prev = root.querySelector<HTMLAnchorElement>('.folio-nav-link.prev');
    const next = root.querySelector<HTMLAnchorElement>('.folio-nav-link.next');
    if (prev || next) {
      const onKey = (evt: Event) => {
        const e = evt as KeyboardEvent;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const link = e.key === 'ArrowLeft' ? prev : next;
        const href = link?.getAttribute('href');
        if (href) {
          e.preventDefault();
          navigate(href);
        }
      };
      on(document, 'keydown', onKey);
    }

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
}
