import { LegacyPageAdvanced } from '../components/LegacyPageAdvanced';
import raw from '../../../public/hero.html?raw';

export default function Hero() {
  return <LegacyPageAdvanced raw={raw} />;
}
