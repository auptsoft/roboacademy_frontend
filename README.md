# RoboAcademy

npm workspaces monorepo:

- `apps/web` — the main student/instructor app.
- `apps/admin` — the standalone admin app, with its own login/session, deployed separately from `apps/web`.
- `packages/ui` — shared design system (`Ra*` components, theme tokens, `cn()`, `useThemeSwitcher`), consumed directly from source by both apps (no build step).

## Getting started

```sh
npm install
```

Run an app in dev mode:

```sh
npm run dev:web    # http://localhost:5173
npm run dev:admin  # http://localhost:5174
```

Build an app:

```sh
npm run build:web
npm run build:admin
npm run build       # both
```
