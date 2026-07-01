# dnd-dm-agent · React App (Hybrid)

React + Vite + Tailwind mini-app that lives alongside the vanilla HTML pages in `../public/`.

## Layout

- **Source**: `src/web/react-app/`
- **Build output**: `src/web/public/app/` (served by Fastify/Vercel at `/app/`)
- **Vanilla pages**: `src/web/public/*.html` — untouched, still work as before

## Commands

```bash
# From this folder (src/web/react-app)
npm install        # first time only
npm run dev        # dev server at http://localhost:5173/app/
npm run build      # writes production build to ../public/app/
```

Or from repo root:

```bash
npm run web:install   # install deps in react-app
npm run web:dev       # dev server
npm run web:build     # build to public/app
```

## Access

- Dev: http://localhost:5173/app/
- Production (after `web:build`): http://localhost:PORT/app/ (served by Fastify static)
- Vercel: /app/

## Adding shadcn / 21st.dev components

Drop `.tsx` files under `src/components/ui/` and import them. Tailwind classes are already configured with the Codex color palette (gold/obsidian/ink).
