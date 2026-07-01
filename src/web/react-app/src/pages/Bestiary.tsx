import { LegacyPage } from '../components/LegacyPage';
import raw from '../../../public/bestiary/index.html?raw';

export default function Bestiary() {
  return <LegacyPage raw={raw} />;
}
