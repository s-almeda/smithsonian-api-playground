# API Playground — plan

Client-only (API is CORS `*`). Vite + React + TS + Tailwind v4. Keep it plain and minimal: white bg, thin borders, no extra UI.

## Files
- `src/api.ts` — fetch, error parsing, code snippets, record helpers, API key hook
- `src/tabs.tsx` — Panel layout, live CodeBox, Raw response, tabs + Stats
- `src/App.tsx` — header, tab state, layout

## Layout (max-w-7xl)
Full-width dark header (S^ithsonian logo, key input). Below, two identical fixed-height (75vh) panels, each `[form + live code snippet | results | raw response]`:
1. Tabbed panel (Search / Item / Terms). Code snippet updates live as form fields change.
2. Stats panel (same 3 columns).

## Tabs
- Search: q, category (→ /category/:cat/search), type, sort, rows, fqs (raw JSON textarea, validated). Card grid + numbered pages. Card → Item.
- Item: /content/:id → title, image, freetext label/value list.
- Terms: category + starts_with → term list; click → search with that fq.
- Stats: one bar per unit (CC0 records), hover title for details, click → search unit.

## Key
localStorage key overrides `VITE_SI_API_KEY` (.env). Public builds: build without .env.
