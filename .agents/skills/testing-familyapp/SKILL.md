---
name: testing-familyapp
description: Test the Familien-Reich app (React + Vite + Supabase) end-to-end. Use when verifying auth/login, navigation, roles/permissions, invites, or multi-tab behavior changes.
---

# Testing Familien-Reich

React/Vite SPA backed by Supabase (Auth + Postgres with RLS). German UI. Roles: `admin` (pure manager, no resources/leaderboard), `parent` (player + task/reward/season management), `player`.

## Devin Secrets Needed
- `SUPABASE_DB_URL` — Postgres connection string (used to inspect/clean up test data).
- `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_URL` — already wired into `.env` for the build. Project ref: `aufeffutbmnpjcsafxph`.

## Run a testable instance
The app has no public deployment; serve the prod build and expose it via a tunnel so you can test on the real DB:
```bash
cd ~/repos/Familyapp && npm run build          # tsc + vite build -> dist/
npx -y serve -s dist -l 5000                    # background it
cloudflared tunnel --protocol http2 --url http://localhost:5000   # background; use --protocol http2 (QUIC often times out)
```
Grab the `https://*.trycloudflare.com` URL from cloudflared output. `serve -s dist` reads from disk per request, so after a rebuild the new bundle is served — but **open tabs keep the old JS**; do a hard reload (Ctrl+Shift+R) to pick up a rebuild.

## DB inspection / cleanup (use the IPv4 pooler, not the direct host)
The direct DB host is often IPv6-only and unreachable; rewrite the URL to the pooler:
```bash
POOLER_URL=$(python3 - <<'PY'
import os,urllib.parse as u
p=u.urlparse(os.environ['SUPABASE_DB_URL']); pw=u.quote(p.password,safe='')
print(f"postgresql://postgres.aufeffutbmnpjcsafxph:{pw}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres")
PY
)
psql "$POOLER_URL" -c "select id,name from families where name like 'DevinTest%';"
```
Always name test families `DevinTest-*`. Cleanup = delete the family (cascades members/permissions) **and** the auth users:
```sql
delete from families where id='<fid>';
delete from auth.users where id in ('<member auth_user_id>', ...);
```

## Key flows & where they live
- Landing buttons (PIN only after device binding): `src/pages/LandingPage.tsx`
- Login (PIN vs E-Mail-Admin tabs; `?mode=email`): `src/pages/auth/LoginPage.tsx`
- Join family (parent/player get a PIN step, admin gets email): `src/pages/auth/JoinFamilyPage.tsx`
- Nav + admin sidebar (resources hidden for admin): `src/components/layout/AppShell.tsx`
- Invite role select + admin tabs: `src/pages/admin/AdminMembers.tsx`, `src/pages/admin/AdminPage.tsx`
- Per-tab session isolation uses `sessionStorage`: `src/lib/supabase.ts`

## Gotchas / known failure modes
- **Auth deadlock (fixed, watch for regressions):** doing `await supabase.*` queries directly inside the `onAuthStateChange` callback in `src/lib/auth.tsx` deadlocks the sign-in promise — login hangs on a spinner forever (server-side login still succeeds, so a manual reload shows you logged in). Keep member/family loading deferred out of the callback (`setTimeout(...,0)`). The multi-tab scenario makes this far more likely to trigger. If login ever "hangs but reload fixes it", suspect this pattern.
- **PIN input flakiness via computer-use:** the 4-digit PIN field sometimes doesn't register typed digits on the first click. Click the field, type, then `zoom` into the field region and confirm the DOM shows `text="****"` before clicking Anmelden. The submit button (`type=submit`) won't fire if the layout shifted an error banner; re-check the button's y-coordinate.
- Email confirmation must be OFF in Supabase Auth (players/parents use synthetic non-deliverable emails).

## Adversarial test plan
Reusable plan lives at `test-plan-pr-a.md`. Core assertions: landing shows exactly 3 buttons on an unbound device; admin sidebar shows "Verwaltung" (no Untertanen/Gold/Baumaterial) and Admin area has only 3 tabs; admin absent from leaderboard; parent join uses PIN (step labeled "3. PIN") not email; logout in one tab does not log out another tab; **login navigates to `/app` within ~2s (no spinner hang)**.
</content>
