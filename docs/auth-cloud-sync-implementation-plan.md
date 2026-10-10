# Google Auth + Cloud Sync Implementation Plan

## Repository baseline (Stage 0)

- Repository: `SujalTesting/think-organize`
- Baseline branch: `main`
- Working branch: `feature/google-auth-cloud-sync`
- Frontend: React 19, TypeScript, Vite 6.
- Current package scripts: `dev`, `build` (`tsc -b && vite build`), and `preview`.
- Current app state is browser-local; no Supabase client or backend dependency is present in `package.json`.
- Main app: `src/App.tsx`; entry point: `src/main.tsx`; curriculum data imported from `src/curriculum`.

## Existing persisted learning state

LocalStorage key: `communication-lab-v1`

The persisted object is currently shaped as:

- `done: number[]` — completed lesson/day numbers.
- `answers: Record<number, Record<string, string>>` — lesson exercise answers.
- `reflections: Record<number, string>` — teach-back reflections.
- `notes: string` — learning journal notes.
- `activities: Activity[]` — time records with `id`, `date`, `title`, `minutes`, `category`, `note`, optional `createdAt`, and optional `updatedAt`.

A separate UI preference is stored at `communication-lab-last-category`; the current JSON backup exports the learning-state object, not this UI preference.

Current import validates that the JSON is an object with a `done` array, then normalizes fields. The current app automatically writes its normalized state back to localStorage.

## Implementation decisions

1. Google OAuth only, through Supabase Auth.
2. Supabase PostgreSQL stores user-owned learning state and activities.
3. Row Level Security (RLS) must enforce ownership in the database; frontend filtering is not a security boundary.
4. The frontend may use only the Supabase publishable/anon key. Never place a service-role key in Vite environment variables or browser code.
5. Existing local data must remain untouched until the user explicitly confirms migration.
6. If cloud data already exists, migration must offer explicit choices and must not silently replace it.
7. Keep the existing backup/export path available throughout the migration.

## Stage gates

- Stage 0: baseline and data contract documented; feature branch created.
- Stage 1: add Supabase client and Google sign-in/session UI, with no cloud data writes yet.
- Stage 2: create schema and verify RLS isolation for separate users.
- Stage 3: introduce a repository layer and move signed-in persistence to the cloud.
- Stage 4: implement an explicit, validated, retry-safe local-to-cloud migration.
- Stage 5: regression and deployment verification.

## Stage 0 observations / risks

- No test script or test runner is configured in `package.json`; baseline verification is currently the production build.
- `src/App.tsx` owns UI, local state, normalization, backup/import, and persistence together. Refactoring behind a repository boundary should be incremental to avoid disturbing existing behavior.
- LocalStorage is device/browser-specific. Signing in must not immediately replace or clear the current local state.
