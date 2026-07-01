import { NavLink, Link } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { useMusic } from '../lib/music';

export function Navbar() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { playing, toggle: toggleMusic } = useMusic();

  return (
    <nav className="vc-nav" aria-label="Primary">
      <Link className="vc-nav-brand" to="/">
        <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="30" cy="30" r="26" />
          <circle cx="30" cy="30" r="14" />
          <line x1="30" y1="2" x2="30" y2="58" />
          <line x1="2" y1="30" x2="58" y2="30" />
          <circle cx="30" cy="30" r="2.5" fill="currentColor" stroke="none" />
        </svg>
        <span>The Veiled Codex</span>
      </Link>

      <ul className="vc-nav-links">
        <li>
          <NavLink to="/" end>
            Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/hero">Hero</NavLink>
        </li>
        <li className="has-sub">
          <a href="#" onClick={(e) => e.preventDefault()}>
            Story
          </a>
          <ul className="vc-nav-sub">
            <li>
              <NavLink to="/story">Chronicle</NavLink>
            </li>
            <li>
              <NavLink to="/sessions/session-1">Sessions</NavLink>
            </li>
            <li>
              <NavLink to="/lore/porto-stellare">Lore</NavLink>
            </li>
            <li>
              <NavLink to="/bestiary">Monster</NavLink>
            </li>
          </ul>
        </li>
        <li className="has-sub">
          <a href="#" onClick={(e) => e.preventDefault()}>
            World
          </a>
          <ul className="vc-nav-sub">
            <li>
              <NavLink to="/map/porto-stellare">Map Portostella</NavLink>
            </li>
          </ul>
        </li>
        <li className="has-sub">
          <a href="#" onClick={(e) => e.preventDefault()}>
            DM
          </a>
          <ul className="vc-nav-sub">
            <li>
              <NavLink to="/oneshot/porto-arrival">One-Shot</NavLink>
            </li>
          </ul>
        </li>
      </ul>

      <div className="vc-nav-actions">
        <button
          className="vc-icon-btn vc-music-btn"
          data-state={playing ? 'on' : 'off'}
          aria-label="Toggle music"
          onClick={toggleMusic}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M9 17V6l10-2v11" />
            <circle cx="6.5" cy="17" r="2.5" />
            <circle cx="16.5" cy="15" r="2.5" />
          </svg>
        </button>
        <button
          className="vc-icon-btn vc-theme-toggle"
          data-mode={theme}
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
          <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
