# Familien-Reich – Familien-Spielsystem

Eine moderne, responsive Web-App, die Haushaltsaufgaben für Familien in ein
Spielsystem verwandelt. Mehrere Familien nutzen die App vollständig getrennt
voneinander – jede mit eigenen Mitgliedern, Aufgaben, Belohnungen, Karte,
Statistiken und Einstellungen.

## Funktionen

- **Mehrere getrennte Familien** – Daten werden auf Datenbankebene per
  Row-Level-Security (RLS) isoliert; Familien sehen sich gegenseitig nie.
- **Familie erstellen** – Admin legt Familie + eigenes Konto (E-Mail/Passwort) an.
- **Familie beitreten** – über einen einmaligen, ablaufenden Einladungscode.
  Eltern legen E-Mail + Passwort fest, Spieler eine 4-stellige PIN.
- **Login** – E-Mail/Passwort für Admin & Eltern, Charakterauswahl + PIN für
  Spieler (mehrgerätefähig).
- **Granulares Rechtesystem** – Rollen sind nur Vorlagen; einzelne
  Berechtigungen lassen sich pro Mitglied per Checkbox setzen.
- **Aufgaben, Belohnungen, Reichskarte, Saisons, Rangliste**.
- **Admin-Dashboard** mit Tabs (Übersicht, Mitglieder, Aufgaben, Belohnungen,
  Saisons, Regeln).

## Technik

- React + TypeScript + Vite
- React Router (geschützte Routen)
- Supabase (PostgreSQL, Auth, Row-Level Security) als Backend
- Konsistentes CSS-Design-System

## Einrichtung

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Umgebungsvariablen setzen

Lege eine `.env.local` an (Vorlage: `.env.example`):

```bash
VITE_SUPABASE_URL=https://<dein-projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<dein-anon-key>
```

Beide Werte findest du im Supabase-Dashboard unter **Settings → API**. Der
Anon-Key ist für den Frontend-Einsatz vorgesehen; der Schutz erfolgt über RLS.

### 3. Datenbankschema einspielen

Die Migration unter `supabase/migrations/001_initial_schema.sql` legt alle
Tabellen, RLS-Policies und Hilfsfunktionen an. Möglichkeiten:

- **Supabase SQL Editor:** Inhalt der Datei einfügen und ausführen, **oder**
- **Supabase CLI:**
  ```bash
  supabase link --project-ref <dein-projekt-ref>
  supabase db push
  ```

### 4. Supabase-Auth konfigurieren (wichtig)

Unter **Authentication → Providers → Email** muss **"Confirm email" deaktiviert**
sein. Spieler verwenden synthetische, nicht zustellbare E-Mail-Adressen, und die
Flows „Familie erstellen/beitreten" benötigen direkt nach der Registrierung eine
aktive Session.

### 5. Entwicklung starten

```bash
npm run dev
```

## Skripte

```bash
npm run dev        # Entwicklungsserver
npm run build      # Typecheck + Production-Build
npm run typecheck  # Nur Typprüfung
npm run preview    # Production-Build lokal ansehen
```
