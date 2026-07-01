import { LegacyPageAdvanced } from '../components/LegacyPageAdvanced';
import raw from '../../../public/story.html?raw';

export default function Story() {
  return <LegacyPageAdvanced raw={raw} />;
}
