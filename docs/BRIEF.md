# notiz. – Build Brief

Desktop-Notizen-App (macOS + Windows). Schnell hinschreiben in plain text, später mit KI zuverlässig wiederfinden. Die KI handelt **nur auf Befehl**, nie automatisch.

Dazu gehören 7 Design-Screenshots in `docs/design/`. Sie sind die Referenz für das Aussehen:

| Screen | Datei | Inhalt |
|---|---|---|
| 1A | `docs/design/1A-startseite-karten.png` | Startseite, Kartenansicht (**Basis-Layout**) |
| 1B | `docs/design/1B-hauptansicht-strom.png` | Alternative Hauptansicht „Ein Strom“ (Timeline) |
| 2 | `docs/design/2-ki-menue.png` | Text markiert, KI-Menü offen |
| 3 | `docs/design/3-ki-vorschau-diff.png` | KI-Vorschau mit Diff |
| 4 | `docs/design/4-suche.png` | Suche in natürlicher Sprache |
| 5 | `docs/design/5-quick-capture.png` | Quick Capture über einem anderen Programm |
| 6 | `docs/design/6-dark-mode-mehrfachauswahl.png` | Dark Mode, mehrere Notizen ausgewählt |

**Bewusste Abweichungen von den Screenshots** (hier gilt der Text, nicht das Bild):
- Überall „ss“ statt „ß“ („schliesst“, „schliessen“)
- KI-Befehle überall in gleicher Reihenfolge: Verbessern 1, Korrigieren 2, Zusammenfassen 3 (Screen 6 zeigt es umgekehrt)

---

## 1. Grundprinzipien

1. **Schreiben ohne Reibung:** kein Titel, kein Ordner, keine Pflichtfelder, kein Block-Editor. Reiner Plain-Text. Automatisch speichern.
2. **Titel wird abgeleitet:** die erste Zeile bzw. der erste Satz einer Notiz wird in Karten/Listen fett als Titel angezeigt. Der Text selbst bleibt unverändert.
3. **KI nur auf Befehl:** Änderungen am Text erscheinen immer zuerst als Vorschau (Diff) und werden erst nach „Annehmen“ übernommen. Alles ist mit ⌘Z rückgängig zu machen.
4. **Alles per Tastatur bedienbar:** Hover blendet Zusatzaktionen ein, aber jede Funktion hat einen Shortcut.
5. **Ruhig:** Look wie Notion: viel Weissraum, fast keine Farbe. Blau nur für Primäraktion, Auswahl und den Punkt im Logo.

---

## 2. App-Layout (Basis = Screen 1A)

Fenster mit warmem, hellgrauem Rahmen. Darin links die Sidebar direkt auf dem Hintergrund, rechts ein weisses Content-Panel mit grossem Radius und feiner Border.

### Sidebar (ca. 280–300 px)
- Oben: Logo **„notiz.“** (Punkt in Akzentblau), rechts ein Stift-Icon = neue Notiz (⌘N)
- Suchfeld „Suchen oder fragen“ mit Badge **⌘K**
- Navigation mit Icon + Label + Anzahl rechts (grau):
  - Alle Notizen (214), aktiver Eintrag mit hellgrauem Hintergrund
  - Heute (2)
  - Letzte 7 Tage (11)
  - Schnell erfasst (38): Notizen, die per Quick Capture entstanden sind
  - Angeheftet (3)
- Unten: Papierkorb, Einstellungen

### Startseite „Alle Notizen“ (Screen 1A)
- Grosser, fetter Titel „Alle Notizen“
- Oben rechts: Sortierung „Neueste zuerst“ + Segment-Toggle **Karten | Liste**
- Gruppen mit kleiner grauer Überschrift: „Diese Woche“, „Früher“ (später ggf. nach Monat)
- Grid mit 4 Spalten (responsive weniger), gleich grosse Karten
- **Erste Karte ist immer die Neu-Karte:** gestrichelte Border, runder „+“-Button, Text „Einfach losschreiben“, darunter klein „⌘N · ohne Titel, ohne Ordner“
- **Notiz-Karte:**
  - Abgeleiteter Titel fett (max. 2 Zeilen)
  - Vorschau des restlichen Texts (max. 3 Zeilen, abgeschnitten)
  - Unten grau der Zeitstempel, relativ: „Heute, 09:14“, „Gestern, 22:47“, „Mo, 16:05“, „Fr, 20. Nov“, ältere nur „12. Nov“
  - Klick öffnet die Notiz im Editor

### Alternative „Ein Strom“ (Screen 1B)
Optional bzw. als Inspiration für die Ansicht „Liste“:
- Schmale Icon-Leiste links statt Sidebar (Menü, Angeheftet, Schnell erfasst, unten Papierkorb, Einstellungen)
- Mittige Spalte (~1100 px):
  - Grosses Suchfeld oben: „Frag deine Notizen … z. B. ‚wo war das mit dem Risotto?‘“ + ⌘K
  - Darunter direkt ein Inline-Eingabefeld (gestrichelt): links grau „jetzt“, Platzhalter „Einfach losschreiben …“, Cursor steht beim Start schon drin
  - Notizen chronologisch, gruppiert nach Tag („Heute · Mittwoch, 25. November“, „Gestern“, „Montag, 23. November“). Jede Notiz als Karte mit Uhrzeit links (grau) und vollem Text rechts
- Rechts eine Zeitleiste zum Springen: Jahr oben (2026), Monate darunter (Nov, Okt, Sep …). Die Länge des Strichs neben dem Monat zeigt, wie viele Notizen er hat. Der aktuelle Monat ist fett mit dunklem Strich.

> **Entscheidung:** Screens 2–6 bauen auf 1A auf. Starte mit 1A. 1B kann später die „Liste“-Ansicht werden.

---

## 3. Editor (Screen 2 + 3)

- Kopfzeile im Content-Panel:
  - Links: Pill-Button „← Alle Notizen“, daneben grau „Heute, 09:14 · Gespeichert“ (Speicherstatus live)
  - Rechts: Icons Anheften, Seitenleiste ein/aus (vorerst Platzhalter für späteres Kontext-Panel), „…“-Menü (Löschen, Duplizieren, Kopieren)
- Text zentriert, max. ca. 980 px breit, grosszügiger Zeilenabstand (~1.7), keine Formatierung
- Statuszeile unten rechts (grau, klein), nur bei Markierung: „14 Wörter markiert · esc schliesst“

---

## 4. KI auf Markierung (Screen 2)

Text markieren → schwebendes Menü direkt unter der Markierung:

| Befehl | Icon | Taste |
|---|---|---|
| Verbessern | Zauberstab | 1 |
| Korrigieren | Häkchen | 2 |
| Zusammenfassen | Textzeilen | 3 |

- Trennlinie, darunter ein Eingabefeld „Eigene Anweisung … z. B. ‚als To-do-Liste‘“ mit ↵
- Fusszeile grau: „Ändert nichts, bevor du die Vorschau annimmst“
- Pfeiltasten wählen, ↵ führt aus, Zahlentasten 1–3 direkt, esc schliesst
- Markierung bleibt blau hinterlegt

**Bedeutung der Befehle:**
- **Korrigieren:** nur Rechtschreibung, Grammatik, Zeichensetzung. Inhalt und Stil bleiben gleich.
- **Verbessern:** klarer und lesbarer formulieren, Inhalt bleibt gleich, nichts erfinden.
- **Zusammenfassen:** kürzer, die Kernpunkte bleiben.
- **Eigene Anweisung:** Freitext an die KI.

---

## 5. KI-Vorschau mit Diff (Screen 3)

- Der markierte Bereich wird zu einer umrandeten Box mit Inline-Diff:
  - Entfernt: rot hinterlegt + durchgestrichen
  - Eingefügt: grün hinterlegt + unterstrichen
- Der restliche Notiztext wird ausgegraut (geringere Deckkraft)
- Darunter das Vorschau-Panel (Karte mit Schatten):
  - Titel „Vorschau: Verbessern“, darunter grau „5 Änderungen · nur die Markierung“
  - Segment-Toggle **Änderungen | Ergebnis | Original**
  - Icon „Neu generieren“ (↻)
  - Buttons: **Verwerfen** (esc, sekundär) und **Annehmen** (↵, primär blau)
- Kleine Legende unten: „entfernt“ / „eingefügt“
- Nach dem Annehmen: dunkler Toast unten mittig: „‚Verbessern‘ übernommen“ + Button „↶ Rückgängig ⌘Z“. Verschwindet nach ein paar Sekunden.
- Während die KI arbeitet: dezenter Ladezustand in der Box (z. B. pulsierender Text oder Streaming).

---

## 6. Suche in natürlicher Sprache (Screen 4)

Öffnen per ⌘K oder Klick ins Suchfeld. Belegt das Content-Panel, zweispaltig.

**Linke Spalte:**
- Grosses Suchfeld mit der Frage, rechts „esc“
- Filter-Chips: **Alle Zeiträume** (aktiv) | Letzter Monat | Dieses Jahr
- Rechts daneben grau: „Wörter + Bedeutung · 5 Treffer“
- **Kurzantwort-Box** (hellgrau hinterlegt):
  - Label „Kurzantwort aus 3 Notizen“, rechts „Ausblenden“
  - KI-Antwort in Fliesstext mit nummerierten Quellen-Badges (1, 2, 3) direkt im Text
- **Quellen:** nummerierte Karten (Nummer im grauen Kreis links), Datum + Uhrzeit grau, Notiztext mit gelb markierten Treffer-Stellen. Die ausgewählte Karte hat eine dunklere Border.
- **Weniger passend:** schlichte Liste (eine Zeile, Datum rechts)
- Fussleiste: ↑ ↓ auswählen · ↵ öffnen

**Rechte Spalte (Vorschau):**
- Voller Text der ausgewählten Notiz, Treffer gelb markiert
- Oben: volles Datum „Dienstag, 24. November 2026 · 17:20“ + Button „Öffnen ↵“

**Logik:**
- Hybrid-Suche: Volltext (Wörter) + semantische Suche (Bedeutung, Embeddings)
- Die Kurzantwort darf nur Infos aus den gefundenen Notizen verwenden und muss jede Aussage mit einer Quelle belegen
- Ohne Frage, nur mit Stichwort: reine Trefferliste, keine Kurzantwort nötig

---

## 7. Quick Capture (Screen 5)

- Globaler Shortcut öffnet ein schwebendes Fenster über jedem Programm, **auch wenn das Hauptfenster geschlossen ist** (App läuft im Hintergrund bzw. im Tray/Menüleiste)
- Default macOS: **⌥ Leertaste**. Unter Windows ist Alt+Leertaste vom System belegt → Default **Ctrl+Shift+Leertaste**. In den Einstellungen änderbar.
- Weisse Karte mit grossem Radius und starkem Schatten, oben mittig auf dem Bildschirm
- Stift-Icon links, grosser Text (ca. 28 px), mehrzeilig, Cursor sofort drin
- Fusszeile: links grau „Neue Notiz in notiz.“, rechts Hinweise: ↵ sichern · ⇧↵ neue Zeile · esc schliessen
- Speichern → Fenster schliesst, Notiz landet in „Schnell erfasst“ und „Alle Notizen“, Quelle = quick

---

## 8. Mehrfachauswahl (Screen 6)

- ⌘-Klick oder ⇧-Klick wählt mehrere Karten. Hinweis oben rechts: „⌘-Klick oder ⇧-Klick wählt mehrere“
- Jede Karte hat oben rechts einen runden Auswahl-Kreis (bei Hover sichtbar, bei Auswahl blau mit Häkchen)
- Ausgewählte Karte: blaue Border + leicht blau getönter Hintergrund
- Schwebende Aktionsleiste unten mittig:
  „3 ausgewählt“ | Verbessern 1 | Korrigieren 2 | Zusammenfassen 3 | Feld „Eigene Anweisung …“ ↵ | ✕
- **Verhalten (Vorschlag, im Design nicht gezeigt):**
  - **Zusammenfassen:** erstellt eine **neue** Notiz aus den ausgewählten (Originale bleiben), vorher Vorschau
  - **Korrigieren / Verbessern:** Diff-Vorschau pro Notiz, nacheinander durchklicken, „Alle annehmen“ möglich

---

## 9. Shortcuts

| Aktion | macOS | Windows |
|---|---|---|
| Neue Notiz | ⌘N | Ctrl+N |
| Suche / Fragen | ⌘K | Ctrl+K |
| Quick Capture (global) | ⌥ Space | Ctrl+Shift+Space |
| KI-Befehl im Menü | 1 / 2 / 3 | 1 / 2 / 3 |
| Vorschau annehmen | ↵ | Enter |
| Vorschau verwerfen / schliessen | esc | Esc |
| Rückgängig | ⌘Z | Ctrl+Z |
| In Suchergebnissen navigieren | ↑ ↓ ↵ | ↑ ↓ Enter |
| Mehrfachauswahl | ⌘-Klick / ⇧-Klick | Ctrl-Klick / Shift-Klick |

---

## 10. Stil (Design Tokens)

Werte sind aus den Screenshots abgeleitet, Feinabstimmung gerne nach Gefühl.

**Schrift:** Inter (Fallback: SF Pro / Segoe UI / system-ui)
- Seitentitel: 40 px, semibold
- Kartentitel: 18–20 px, semibold
- Fliesstext/Editor: 18–20 px, regular, Zeilenhöhe ~1.7
- Meta/Labels: 14–15 px, grau

**Light Mode:**
| Token | Wert |
|---|---|
| Fenster-Hintergrund / Sidebar | `#F7F6F3` |
| Content-Panel, Karten | `#FFFFFF` |
| Border | `#E9E9E7` |
| Text | `#37352F` |
| Text sekundär | `#787774` |
| Hover / aktiver Nav-Eintrag | `#EFEFED` |
| Akzent (Primär-Button, Auswahl, Logo-Punkt) | `#2383E2` |
| Markierung Suchtreffer | `#FBF3DB` |
| Diff entfernt | Hintergrund `#FDEBEC`, Text `#C4554D` |
| Diff eingefügt | Hintergrund `#EDF3EC`, Text `#448361` |
| Toast | `#2F2F2F`, Text weiss |

**Dark Mode:**
| Token | Wert |
|---|---|
| Fenster-Hintergrund / Sidebar | `#191919` |
| Content-Panel | `#1F1F1F` |
| Karten | `#252525` |
| Border | `#2F2F2F` |
| Text | `#E6E6E5` |
| Text sekundär | `#9B9A97` |
| Auswahl | Border `#2383E2`, Hintergrund `#1C2A3A` |

**Formen:**
- Radius: Content-Panel 16 px, Karten 14 px, Buttons/Inputs 10–12 px, Chips/Toggle voll rund
- Schatten nur für schwebende Elemente (KI-Menü, Vorschau-Panel, Quick Capture, Aktionsleiste, Toast)
- Icons: dünne Outline-Icons (z. B. Lucide), 18 px, grau
- Shortcut-Badges: kleine Box mit Border, 12 px, grau

---

## 11. Daten & Technik

**Datenmodell (Notiz):**
```
id, text, created_at, updated_at, pinned (bool),
source ('app' | 'quick'), deleted_at (null oder Datum → Papierkorb)
```
Titel und Vorschau werden aus `text` abgeleitet, nicht gespeichert.

**Speicherung:** lokal (z. B. SQLite), kein Account nötig. Sync ist kein Thema im MVP.

**KI:**
- Claude per API, API-Key wird in den Einstellungen eingegeben und sicher gespeichert (System-Keychain)
- Notiztext geht nur an die KI, wenn ich aktiv einen Befehl ausführe oder eine Frage in der Suche stelle
- Semantische Suche braucht Embeddings. Am besten lokal berechnen, damit nicht alle Notizen ständig in die Cloud gehen.

**Plattform:** Desktop für macOS + Windows mit globalem Shortcut und Hintergrund-Prozess. Ein reiner Browser-Build reicht deshalb nicht. Vorschlag: Tauri oder Electron mit React + TypeScript. Andere Wahl ist okay, wenn das gleiche Ergebnis rauskommt.

**Einstellungen (einfacher Dialog):** API-Key, Quick-Capture-Shortcut, Hell/Dunkel/System.

---

## 12. MVP-Umfang

**Drin:**
- Startseite mit Karten (1A), Sidebar-Filter, Papierkorb
- Editor mit Autosave
- KI-Menü auf Markierung + Diff-Vorschau + Undo
- Suche (Wörter + Bedeutung) mit Kurzantwort und Quellen
- Quick Capture mit globalem Shortcut
- Mehrfachauswahl mit KI-Aktionen
- Light + Dark Mode

**Nicht im MVP:**
- Kontext-Panel rechts im Editor (automatisch erkannte Personen, Themen, Aufgaben). Der Button ist schon da, bleibt aber vorerst leer.
- Kalender oder andere Datenquellen
- Mobile App, Sync, Teilen
- Push-Nachrichten oder ungefragte Vorschläge (sind ausdrücklich unerwünscht)

---

## 13. Reihenfolge-Vorschlag

1. App-Gerüst, Datenmodell, Sidebar + Karten-Startseite + Editor mit Autosave
2. Quick Capture mit globalem Shortcut
3. Volltextsuche, dann semantische Suche + Kurzantwort
4. KI-Menü + Diff-Vorschau + Undo
5. Mehrfachauswahl, Dark Mode, Einstellungen
6. Feinschliff gegen die Screenshots

Mit realistischen deutschen Beispielnotizen testen, wie in den Screenshots (kurze, chaotische Schnipsel).

---

## 14. Tech-Stack (entschieden)

**Tauri 2**: Backend in Rust, UI als Web-Frontend im System-Webview (kein gebündeltes Chromium wie bei Electron).

| Bereich | Wahl |
|---|---|
| App-Shell | Tauri 2 (+ Plugins: global-shortcut, single-instance, autostart, Tray) |
| Frontend | React + TypeScript + Vite, Tailwind CSS, Lucide-Icons, Schrift Inter (lokal gebündelt) |
| Diff-Anzeige | im Frontend, wortbasiert (z. B. npm `diff` → `diffWords`) |
| Datenbank | SQLite (`rusqlite` oder `sqlx`), Volltext über **FTS5** |
| Semantische Suche | Embeddings lokal mit `fastembed` (mehrsprachiges Modell, z. B. multilingual-e5-small), Vektoren als BLOB in SQLite, Cosine-Ähnlichkeit per Brute Force (reicht für einige tausend Notizen) |
| KI | Claude Messages API per `reqwest` mit Streaming. Schneller, günstiger Model für Korrigieren/Verbessern, stärkerer Model für Kurzantworten. Model-Namen als Konstante, leicht änderbar. |
| API-Key | System-Keychain via `keyring` crate, nie im Klartext auf Disk |

---

## 15. Aufteilung auf 2 Agents

Ein Repo, zwei Bereiche, **keine gemeinsamen Dateien**:

- **Agent A – Rust-Backend:** arbeitet nur in `src-tauri/`
- **Agent B – Frontend/UI:** arbeitet nur in `src/`

Der gemeinsame Vertrag steht in `CONTRACT.md` (Kopie unten) und wird umgesetzt in `src/lib/api.ts` bzw. `src-tauri/src/models.rs`. **Änderungen am Vertrag nur nach Absprache mit Nicola.** Offene Punkte kommen in `OPEN_QUESTIONS.md`.

### Phase 0 – Setup (einmalig, vor dem Split)
1. Tauri-2-Projekt mit React + TS im bestehenden Repo anlegen (Repo existiert schon)
2. `CONTRACT.md` existiert schon, als Grundlage nehmen
3. Typen auf beiden Seiten anlegen (TS-Interfaces + Rust-Structs mit `serde`, camelCase)
4. `src/lib/api.ts` mit **Mock-Implementierung** (Beispielnotizen aus den Screenshots im Speicher), umschaltbar auf echte `invoke()`-Calls

### Phase 1 – parallel
**Agent A:** DB + Migrationen → Notiz-Commands → FTS5-Suche → Embeddings + Hybrid-Ranking → Claude-Streaming → Keychain → globaler Shortcut + Quick-Capture-Fenster + Tray

**Agent B:** Design-Tokens + Light/Dark → Sidebar + Karten-Startseite → Editor mit Autosave → KI-Menü + Diff-Vorschau + Toast/Undo → Suche-Screen → Mehrfachauswahl + Aktionsleiste → Quick-Capture-UI (eigene Route, z. B. `/capture`) → Einstellungen. Alles gegen die Mock-API.

### Phase 2 – Integration
Mock aus, echte Commands an, gemeinsam durchtesten (ein Agent macht das, der andere reviewt).

### Vertrag (Commands, via Tauri `invoke`)

```ts
type Source = 'app' | 'quick';
interface Note { id: string; text: string; createdAt: string; updatedAt: string;
                 pinned: boolean; source: Source; deletedAt: string | null; }
type Filter = 'all' | 'today' | 'last7' | 'quick' | 'pinned' | 'trash';
type Range  = 'all' | 'lastMonth' | 'thisYear';
type AiCommand = 'improve' | 'correct' | 'summarize' | 'custom';

notes_list(filter: Filter): Note[]                 // neueste zuerst
notes_counts(): Record<Filter, number>
note_get(id): Note
note_create(text: string, source: Source): Note
note_update(id, text): Note                        // Autosave, debounced im Frontend
note_set_pinned(id, pinned: boolean): Note
note_delete(id): void                              // → Papierkorb
note_restore(id): void
note_delete_forever(id): void

search(requestId: string, query: string, range: Range): {
  hits: { note: Note; highlights: [number, number][]; score: number;
          tier: 'match' | 'weak' }[];              // 'weak' = "Weniger passend"
  answerRequestId: string | null;                  // = requestId, null bei reinem Stichwort
}

ai_transform(requestId: string, command: AiCommand, text: string,
             instruction?: string): void           // Ergebnis per Events
ai_summarize_notes(requestId: string, ids: string[]): void
ai_cancel(requestId: string): void

settings_get(): { theme: 'light'|'dark'|'system'; captureShortcut: string;
                  hasApiKey: boolean }
settings_set(partial): void
api_key_set(key: string): void
```

### Events (Backend → Frontend)

```ts
'ai://chunk'   { requestId, delta: string }
'ai://done'    { requestId, text: string, sources?: string[] }  // sources = Note-IDs für Kurzantwort
'ai://error'   { requestId, message: string }
'notes://changed' { id }                         // z. B. nach Quick Capture
```

Die Kurzantwort der Suche läuft über dieselben `ai://`-Events mit der `requestId`, die das Frontend bei `search` mitgibt. Das Frontend kennt die ID also, bevor das erste Event eintrifft. Das Frontend rendert Quellen-Badges [1] [2] [3] in Reihenfolge der `hits`.
