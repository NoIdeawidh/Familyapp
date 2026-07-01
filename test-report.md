# Testbericht — PR A (Nav/Rollen/Login) + PR #7 (Login-Deadlock-Fix)

Getestet end-to-end im Browser gegen den öffentlichen Tunnel (Produktionsbuild, echte Supabase-DB). Test-Familie `DevinTest-PRA` angelegt und nach dem Test inkl. Auth-Usern wieder gelöscht.

## Wichtigste Erkenntnis (Eskalation)
Beim ersten Durchlauf von PR A (gemergt in `main`) **hing die Anmeldung**: Nach Eingabe der PIN (und ebenso bei E-Mail-Login) drehte sich der Spinner 60+ Sekunden und es erfolgte **keine Weiterleitung**. Die Anmeldung war serverseitig erfolgreich (nach manuellem Reload war man eingeloggt), aber das `signInWithPassword`-Promise löste nie auf — klassischer supabase-js-Deadlock durch `await`-Queries im `onAuthStateChange`-Callback. Das Mehr-Tab-Szenario von PR A (P1) verschärft das.

→ Behoben in **PR #7**: Member-/Family-Queries werden aus dem Callback herausgeschoben (`setTimeout(…,0)`), damit die Auth-Lock freigegeben wird. Nach dem Fix neu getestet: Anmeldung leitet sofort weiter.

## Ergebnisse
- T1 — Startbildschirm zeigt nur 3 Buttons (keine PIN) auf ungebundenem Gerät: **passed**
- T2 — Admin = reiner Verwalter (keine Ressourcen in Sidebar, Admin-Bereich nur 3 Tabs): **passed**
- T3 — Admin nicht in der Rangliste: **passed**
- T4 — Einladen mit Rollenauswahl + Eltern-Beitritt per PIN (nicht E-Mail), Eltern ohne Admin-Menü, mit Ressourcen + Aufgaben-Verwaltung: **passed**
- T5 — Multi-Tab-Isolation: Logout im Eltern-Tab loggt Admin-Tab nicht aus: **passed**
- T6 — PIN-Schnellanmeldung erscheint nach Gerätebindung: **passed**
- FIX — PIN-Login leitet ohne Hänger weiter (vorher 60s+ Spinner): **passed**
- FIX — Admin-E-Mail-Login leitet ohne Hänger weiter: **passed**

## Belege

### Bug → Fix (Login-Hänger)
| 🔴 BUG (vor Fix) | 🟢 FIX (PR #7) |
|---|---|
| ![BUG: PIN-Login 59s Spinner](/home/ubuntu/screenshots/ss_2fb19601.png) | ![FIX: PIN-Login leitet zum Dashboard](/home/ubuntu/screenshots/ss_b68e9efe.png) |
| PIN-Login hing 59s auf Spinner, keine Weiterleitung | Nach Fix: sofortige Weiterleitung zum Eltern-Dashboard |

### T1 — Startbildschirm (3 Buttons, keine PIN)
![T1 Landing](/home/ubuntu/screenshots/ss_8f4fd938.png)

### T2 — Admin reiner Verwalter
| Sidebar „Verwaltung" statt Ressourcen | Admin-Bereich nur 3 Tabs |
|---|---|
| ![T2 Admin Dashboard](/home/ubuntu/screenshots/ss_004bf028.png) | ![T2 Admin 3 Tabs](/home/ubuntu/screenshots/ss_bec0fc0e.png) |

### T3 — Admin nicht in Rangliste
![T3 Leaderboard](/home/ubuntu/screenshots/ss_acaebbe0.png)

### T4 — Einladen mit Rolle + Eltern-PIN-Beitritt
| Rollenauswahl + Code | Eltern Schritt 3 = PIN | Eltern-Dashboard (kein Admin) |
|---|---|---|
| ![T4 Invite](/home/ubuntu/screenshots/ss_10635134.png) | ![T4 PIN](/home/ubuntu/screenshots/ss_426c5f95.png) | ![T4 Parent](/home/ubuntu/screenshots/ss_35b145a3.png) |

### T5 — Multi-Tab-Isolation
![T5 Admin tab still logged in](/home/ubuntu/screenshots/ss_a1d6c64e.png)

### T6 — PIN-Schnellanmeldung nach Bindung
![T6 Quick login](/home/ubuntu/screenshots/ss_2800b97f.png)

### FIX — E-Mail-Login ohne Hänger
![Email login fixed](/home/ubuntu/screenshots/ss_b06a0ff8.png)
