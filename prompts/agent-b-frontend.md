# Prompt: Agent B – Frontend

Erst nach Phase 0 starten. Am besten auf eigenem Branch bzw. Git-Worktree (`agent-b-frontend`), parallel zu Agent A. Diesen Text in eine neue Agent-Session kopieren:

---

```
Du bist Agent B (Frontend) im Projekt "notiz.". Lies zuerst:
- AGENTS.md
- docs/BRIEF.md (komplett, vor allem Abschnitte 1–10)
- CONTRACT.md
- die 7 Screenshots in docs/design/ (das ist die Design-Referenz)

Regeln:
- Du arbeitest NUR in src/. Dateien in src-tauri/ fasst du nicht an.
- Du arbeitest gegen die Mock-API in src/lib/api.ts (VITE_USE_MOCK=true).
- CONTRACT.md ist verbindlich. Nicht ändern. Wenn etwas fehlt oder
  unklar ist: in OPEN_QUESTIONS.md eintragen (mit "[Agent B]") und mit
  einer sinnvollen Annahme weitermachen.
- Pixelnah an den Screenshots bauen. Farben/Schrift/Radien aus
  Abschnitt 10 als Design-Tokens (CSS-Variablen + Tailwind-Theme).
- Nach jedem abgeschlossenen Schritt: committen.

Setz der Reihe nach um:
1. Design-Tokens, Light + Dark Mode (inkl. "System").
2. App-Layout: Sidebar mit Navigation + Zahlen, Startseite
   "Alle Notizen" als Karten-Grid mit Neu-Karte, Gruppen
   "Diese Woche"/"Früher", relative Zeitstempel (Screen 1A).
3. Editor mit Autosave, Kopfzeile, Speicherstatus, Anheften,
   Papierkorb (Abschnitt 3).
4. KI-Menü auf Markierung (Screen 2) + Diff-Vorschau mit
   Änderungen/Ergebnis/Original, Annehmen/Verwerfen, Neu generieren,
   Toast mit Rückgängig (Screen 3). Diff wortbasiert im Frontend.
5. Suche: ⌘K, Filter-Chips, Kurzantwort mit Quellen-Badges
   (Streaming), Quellen-Liste mit gelben Highlights, "Weniger passend",
   Vorschau rechts, Tastatur-Navigation (Screen 4).
6. Mehrfachauswahl mit ⌘/⇧-Klick und schwebender Aktionsleiste
   (Screen 6). Zusammenfassen erzeugt eine neue Notiz (mit Vorschau).
7. Quick-Capture-UI als eigene Route /capture (Screen 5):
   Enter speichert, Shift+Enter neue Zeile, Esc schliesst.
8. Einstellungen-Dialog: API-Key, Shortcut, Theme.
9. Alle Shortcuts aus Abschnitt 9 (⌘ auf macOS, Ctrl auf Windows).

Am Ende: kurze Zusammenfassung, was fertig ist, was offen ist.
```
