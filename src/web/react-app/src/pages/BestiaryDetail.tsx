import { LegacyPage } from '../components/LegacyPage';
import raw from '../../../public/bestiary/detail.html?raw';

/** Monster is picked via ?m=<index>, read by the page's own legacy script. */
export default function BestiaryDetail() {
  return <LegacyPage raw={raw} />;
}
