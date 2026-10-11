# Vocabattle — mobile app

Expo SDK 57 · React Native · TypeScript · expo-router · TanStack Query · Supabase.

```bash
npm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start                 # i / a / w
npm run check             # typecheck + lint
```

Code map:

- `src/app/` — routes. `(auth)` sign-in/up flows · `onboarding/` profile + assessment intro · `assessment/` adaptive test + results · `(app)/(tabs)` Home, Learn, Battle, Read, Profile · `(app)/arena/` matchmaking, live battle, history · settings, subscription, admin, etc.
- `src/lib/api.ts` — every server call (typed RPC wrappers). The app never computes scores, levels, ratings or quotas.
- `src/hooks/use-battle.ts` — live battle sync (polling heartbeat + Realtime + server clock offset).
- `src/components/ui/` — design system; `src/constants/theme.ts` — tokens (dark navy, violet/blue/green, light & dark).

Project docs: [`../README.md`](../README.md), [`../docs/SETUP.md`](../docs/SETUP.md), [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
