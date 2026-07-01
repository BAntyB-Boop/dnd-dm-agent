import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Play once, freeze on the last frame, replay on hover (from legacy index.html).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onEnded = () => {
      v.pause();
      try {
        v.currentTime = Math.max(0, v.duration - 0.05);
      } catch {
        /* ignore */
      }
    };
    const onEnter = () => {
      if (v.ended || v.paused) {
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
        v.play().catch(() => {});
      }
    };

    v.addEventListener('ended', onEnded);
    v.addEventListener('mouseenter', onEnter);
    return () => {
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <section className="hero">
      <video ref={videoRef} className="hero-video" autoPlay muted playsInline>
        <source src="/assets/intro.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-eyebrow">A Chronicle of Borderland</div>
        <h1 className="hero-title">The Veiled Codex</h1>
        <div className="hero-rule">
          <span className="line" />
          <span className="glyph">✦</span>
          <span className="line" />
        </div>
        <p className="hero-sub">
          Seven names. Seven oaths. One unfolding chronicle, indexed in the chapter-house archive.
        </p>
      </div>
      <Link className="hero-scroll" to="/hero">
        <span>Enter the Codex</span>
        <span className="arrow" />
      </Link>
    </section>
  );
}
