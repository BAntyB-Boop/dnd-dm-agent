import { ArcGalleryHero } from './components/ui/arc-gallery-hero';

const characterCutouts = [
  '/assets/characters/anuchit/cutout.png',
  '/assets/characters/aurora/cutout.png',
  '/assets/characters/aython/cutout.png',
  '/assets/characters/jen/cutout.png',
  '/assets/characters/kael-veranth/cutout.png',
  '/assets/characters/kael-vorn/cutout.png',
  '/assets/characters/dermogorgon/cutout.png',
];

export default function App() {
  return (
    <div className="w-full">
      <ArcGalleryHero images={characterCutouts} />
    </div>
  );
}
