import { LegacyPage } from '../components/LegacyPage';
import raw from '../../../public/map/porto-stellare.html?raw';

export default function MapPortoStellare() {
  return <LegacyPage raw={raw} />;
}
