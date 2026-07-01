import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface MusicCtx {
  playing: boolean;
  toggle: () => void;
}

const Ctx = createContext<MusicCtx | null>(null);

const TRACK = '/assets/codex-of-stars.mp3';

/**
 * Single persistent background-audio element for the whole SPA.
 * Because it lives in the shell (above the router outlet) it survives
 * route changes, so the cross-page sessionStorage dance from the old
 * shared.js is no longer needed.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
  function pause() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
  }
  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) play();
    else pause();
  }

  // Attempt autoplay; if blocked, resume on the first user gesture.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.35;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      a.play()
        .then(() => !cancelled && setPlaying(true))
        .catch(() => {
          const once = () => {
            document.removeEventListener('click', once);
            document.removeEventListener('keydown', once);
            a.play().then(() => setPlaying(true)).catch(() => {});
          };
          document.addEventListener('click', once, { once: true });
          document.addEventListener('keydown', once, { once: true });
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // "M" key toggles music (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      toggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ playing, toggle }}>
      <audio ref={audioRef} src={TRACK} loop preload="auto" />
      {children}
    </Ctx.Provider>
  );
}

export function useMusic(): MusicCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMusic must be used within MusicProvider');
  return ctx;
}
