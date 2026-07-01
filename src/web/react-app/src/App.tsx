import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Placeholder from './pages/Placeholder';

// Every route below is code-split via react-router's route-level `lazy`
// field: each page's module (and everything it only imports, e.g. a
// folio's raw HTML/CSS) is fetched on first navigation to that route
// instead of bundled into the initial JS payload. React Router keeps the
// current page fully rendered while the next route's chunk downloads, so
// slow connections see no blank flash — the old page just stays interactive
// a little longer before the swap.
//
// Routes migrated to React so far: Home ("/"), the 7 folios, the
// bestiary/oneshot/sessions/lore/map content pages, and hero/story. Only
// "game" remains as a Placeholder — it's not static content, it's a live
// WebSocket+REST game client (see project memory), migrating it is a
// separate, much bigger decision than the rest of this static-content pass.
// Folios and legacy content pages sit outside the navbar/footer Layout
// because they ship their own bare page chrome (see Layout.tsx).
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('./pages/Home')).default }),
      },
      { path: 'game', element: <Placeholder /> },
      { path: '*', element: <Placeholder /> },
    ],
  },
  {
    path: '/hero',
    lazy: async () => ({ Component: (await import('./pages/Hero')).default }),
  },
  {
    path: '/story',
    lazy: async () => ({ Component: (await import('./pages/Story')).default }),
  },
  {
    path: '/folio/:slug',
    lazy: async () => ({ Component: (await import('./pages/folio/Folio')).default }),
  },
  {
    path: '/bestiary',
    lazy: async () => ({ Component: (await import('./pages/Bestiary')).default }),
  },
  {
    path: '/bestiary/detail',
    lazy: async () => ({ Component: (await import('./pages/BestiaryDetail')).default }),
  },
  {
    path: '/oneshot',
    lazy: async () => ({ Component: (await import('./pages/OneshotIndex')).default }),
  },
  {
    path: '/oneshot/porto-arrival',
    lazy: async () => ({ Component: (await import('./pages/OneshotPortoArrival')).default }),
  },
  {
    path: '/oneshot/sea-ambush',
    lazy: async () => ({ Component: (await import('./pages/OneshotSeaAmbush')).default }),
  },
  {
    path: '/sessions/session-1',
    lazy: async () => ({ Component: (await import('./pages/Session1')).default }),
  },
  {
    path: '/lore/porto-stellare',
    lazy: async () => ({ Component: (await import('./pages/LorePortoStellare')).default }),
  },
  {
    path: '/map/porto-stellare',
    lazy: async () => ({ Component: (await import('./pages/MapPortoStellare')).default }),
  },
  {
    path: '/map/sea-ambush',
    lazy: async () => ({ Component: (await import('./pages/MapSeaAmbush')).default }),
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
