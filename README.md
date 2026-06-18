# Familien-Reich – Haushalts-Spielsystem

Eine responsive Webapp / PWA als Familien-Spielsystem für Haushaltsaufgaben.

## Enthalten
- Nutzerwahl / Login
- Rollen: Admin, Eltern, Spieler
- Aufgaben mit privat / offen
- Untertanen als Belohnung
- Reichskarte mit Feldern und angrenzender Eroberung
- Gold und Baumaterial
- Belohnungsshop
- Saisonlogik
- Rangliste
- Admin-Bereich mit manuellen Korrekturen

## Technik
- React
- TypeScript
- Vite
- lokale Persistenz via `localStorage`
- PWA-Metadaten + Service Worker

## Starten
```bash
npm install
npm run dev
```

## Hinweise
- Die App ist als MVP direkt nutzbar.
- Daten werden lokal im Browser gespeichert.
- Ein echter Server / eine Datenbank ist noch nicht eingebaut.
- Für mehrere Geräte wäre als nächster Schritt ein Backend sinnvoll.
