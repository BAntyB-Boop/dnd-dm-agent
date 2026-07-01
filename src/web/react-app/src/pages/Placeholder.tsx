import { Link, useLocation } from 'react-router-dom';

/** Temporary page for routes not yet migrated from the legacy static HTML. */
export default function Placeholder() {
  const { pathname } = useLocation();
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          fontFamily: '"Cinzel", serif',
          fontSize: '11px',
          letterSpacing: '.5em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
        }}
      >
        Not yet transcribed
      </div>
      <h1
        style={{
          fontFamily: '"Cinzel", serif',
          fontWeight: 600,
          fontSize: 'clamp(28px,5vw,56px)',
          color: 'var(--ink-soft)',
          margin: 0,
        }}
      >
        {pathname}
      </h1>
      <p style={{ fontStyle: 'italic', color: 'var(--ink-faint)', maxWidth: 460 }}>
        This page is still being migrated into the codex. Its scribes are at work.
      </p>
      <Link
        to="/"
        style={{
          fontFamily: '"Cinzel", serif',
          fontSize: '10.5px',
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          textDecoration: 'none',
          borderBottom: '1px solid var(--gold-dim)',
          paddingBottom: '3px',
        }}
      >
        ← Return home
      </Link>
    </section>
  );
}
