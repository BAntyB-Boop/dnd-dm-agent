import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MusicProvider } from '../lib/music';

/**
 * App shell used by the navbar/footer routes: fixed navbar on top, routed
 * page content in the middle, footer at the bottom, one persistent <audio>
 * for cross-page background music.
 *
 * Folio pages are NOT nested under this layout — they bring their own
 * bare page chrome (back-link, per-folio music player) ported from the
 * legacy static HTML, so mounting the navbar/global music here would
 * double up both the header and the audio element.
 */
export function Layout() {
  return (
    <MusicProvider>
      <ScrollRestoration />
      <Navbar />
      <Outlet />
      <Footer />
    </MusicProvider>
  );
}
