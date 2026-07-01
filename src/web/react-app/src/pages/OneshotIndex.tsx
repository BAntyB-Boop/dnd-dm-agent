import { LegacyPage } from '../components/LegacyPage';
import raw from '../../../public/oneshot/index.html?raw';

export default function OneshotIndex() {
  return <LegacyPage raw={raw} />;
}
