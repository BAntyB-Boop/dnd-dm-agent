import { LegacyPageAdvanced } from '../components/LegacyPageAdvanced';
import raw from '../../../public/sessions/session-1.html?raw';

// Uses LegacyPageAdvanced (not LegacyPage) because this page has an
// importmap + two <script type="module"> Three.js scenes (hero medallion
// signet, scroll teaser) — the plain LegacyPage host doesn't understand
// module/importmap scripts and would execute the importmap's raw JSON as
// JS, throwing a SyntaxError that halts the rest of the page's scripts.
export default function Session1() {
  return <LegacyPageAdvanced raw={raw} />;
}
