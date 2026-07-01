# Test Plan — PR A (Navigation, Rollen, Login-Sicherheit, Multi-Tab)

Target: https://surgeon-scripting-colour-cart.trycloudflare.com (prod build, real Supabase DB)
Test family name: `DevinTest-PRA` (deleted after).

Code paths grounding the plan:
- Landing buttons: `src/pages/LandingPage.tsx:23-45` (PIN button only if `rememberedFamily`)
- Login PIN gating: `src/pages/auth/LoginPage.tsx:26-31,106-115`
- Join PIN for parent: `src/pages/auth/JoinFamilyPage.tsx:39,247-296`
- Nav + admin sidebar: `src/components/layout/AppShell.tsx:14-22,85-107`
- Admin tabs reduced to 3: `src/pages/admin/AdminPage.tsx:8-14`
- Invite role select: `src/pages/admin/AdminMembers.tsx:110-126`
- Leaderboard exclusion: `LeaderboardPage` `.neq('role','admin')`

## T1 — Landing shows only 3 buttons on an unbound device (P6)
Steps: Open site root in a fresh browser profile (no localStorage binding).
PASS: Exactly these buttons visible: "Familie erstellen", "Familie beitreten", "Mit E-Mail anmelden". NO "Schnellanmeldung"/PIN button.
FAIL if any PIN/Schnellanmeldung button is present.

## T2 — Admin is a pure manager (P5, P12)
Steps: Click "Familie erstellen", create family `DevinTest-PRA` with admin email `devin-pra@example.com` / password. Land in `/app`.
Check sidebar nav + sidebar stats + Admin area.
PASS:
- Sidebar nav contains top-level: Dashboard, Aufgaben, Belohnungen, Saisons, Reichskarte, Rangliste, Admin.
- Sidebar shows role block "Rolle / Verwaltung" — NO Untertanen/Gold/Baumaterial numbers.
- Open Admin → exactly 3 tabs: Übersicht, Familienverwaltung, Regeln & Einstellungen (NO Aufgaben/Belohnungen/Saisons tabs).
FAIL if resources shown for admin, or Admin still contains Aufgaben/Belohnungen/Saisons tabs.

## T3 — Admin excluded from leaderboard (P12)
Steps: Click "Rangliste" in nav.
PASS: The admin profile (its name) does NOT appear in the ranking list.
FAIL if admin name appears in the ranking.

## T4 — Invite with role selection + parent PIN login (P10, P8, P5)
Steps:
1. Admin → Admin → Familienverwaltung. In invite control select role "Elternteil", click "Einladungscode erstellen". Note the 6-char code.
2. In a SECOND browser tab, go to root → "Familie beitreten" → enter code → Step "Profil" name `TestEltern` → Step 3 must show **PIN festlegen** (NOT email/password). Set PIN 1234, confirm, Beitreten.
PASS:
- Invite UI offers Spieler/Elternteil/Administrator choices and produces a code.
- Parent join step 3 asks for a 4-digit PIN (proves P8 — parent uses PIN, not email).
- After join, parent lands in `/app`; sidebar shows resources (Untertanen/Gold/Baumaterial) AND nav does NOT contain "Admin" (parent has no access_admin). Parent CAN see "Aufgaben" with a create form (P5).
FAIL if parent join asks for email/password, or parent sees Admin nav item.

## T5 — Multi-tab session isolation (P1)
Precondition: Tab A = admin logged in (from T2). Tab B = parent logged in (from T4).
Steps: In Tab B click "Abmelden". Switch to Tab A and reload.
PASS: Tab A remains logged in as admin (still shows `/app`, admin name in topbar) after Tab B logout + Tab A reload.
FAIL if Tab A is bounced to landing/login after Tab B logout.

## T6 — PIN quick-login appears after device binding (P6)
Steps: In Tab B (now logged out, device bound by the join in T4), go to site root.
PASS: Landing now shows a "Schnellanmeldung · DevinTest-PRA" button; clicking it opens PIN profile picker listing `TestEltern`.
FAIL if no PIN/Schnellanmeldung button after binding.

## Cleanup
Delete the `DevinTest-PRA` family + members + auth users from the DB after testing.
