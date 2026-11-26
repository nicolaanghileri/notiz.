# Offene Fragen

Hier tragen die Agents alles ein, was im Brief oder im Vertrag fehlt oder unklar ist. Nicola entscheidet und schreibt die Antwort darunter.

Format:

```
## [Agent A|B] Kurzer Titel
Frage / Problem:
Meine Annahme (womit ich vorerst weitermache):
Entscheidung (Nicola):
```

---

## [Setup] Einheit der `highlights`
Frage / Problem: „Zeichen-Bereiche“ ist mehrdeutig. JavaScript zählt UTF-16-Einheiten, Rust Bytes oder Unicode-Zeichen. Bei Emojis verschieben sich die Markierungen.
Meine Annahme (womit ich vorerst weitermache): UTF-16-Einheiten, damit `text.slice(start, end)` im Frontend direkt stimmt. Agent A rechnet um.
Entscheidung (Nicola): bestätigt

## [Setup] Parametername von `settings_set`
Frage / Problem: Der Vertrag nennt nur den Typ `Partial<Settings>`, keinen Namen. Tauri braucht auf beiden Seiten denselben.
Meine Annahme (womit ich vorerst weitermache): `partial` (wie im Brief, Abschnitt 15): `invoke('settings_set', { partial })`.
Entscheidung (Nicola): bestätigt

## [Setup] Kurzantwort: Reihenfolge von Events und Rückgabe
Frage / Problem: Das Backend erzeugt `answerRequestId`. Das Frontend kennt sie erst nach der Antwort von `search`, `ai://`-Events könnten vorher eintreffen.
Meine Annahme (womit ich vorerst weitermache): Das Frontend meldet die Listener vor `search` an und puffert unbekannte IDs kurz. Der Mock startet das Streaming 500 ms nach der Suche.
Entscheidung (Nicola): Das Frontend erzeugt die ID und gibt sie bei `search` als `requestId` mit, wie bei den anderen KI-Befehlen. Kein Puffern nötig. CONTRACT.md ist angepasst; `answerRequestId` ist jetzt die übergebene ID oder `null`.

## [Setup] Quellen-Badges im Text
Frage / Problem: Wie die Badges im Antworttext codiert sind, steht nicht im Vertrag.
Meine Annahme (womit ich vorerst weitermache): Als `[1]`, `[2]`, `[3]` im Text, 1-basiert nach Reihenfolge der `hits`. `sources` enthält die zugehörigen Note-IDs.
Entscheidung (Nicola): bestätigt

## [Setup] `ai_cancel`
Frage / Problem: Kommt nach dem Abbrechen noch ein Event?
Meine Annahme (womit ich vorerst weitermache): Nein, weder `ai://done` noch `ai://error`.
Entscheidung (Nicola): bestätigt

## [Setup] Sortierung und Zeiträume
Frage / Problem: „Neueste zuerst“ nach `createdAt` oder `updatedAt`? Wo beginnen „Heute“, „Letzte 7 Tage“, „Letzter Monat“?
Meine Annahme (womit ich vorerst weitermache): `createdAt`, lokale Zeitzone. Heute = ab Mitternacht, 7 Tage = heute + 6 Tage davor, letzter Monat = letzte 30 Tage, dieses Jahr = Kalenderjahr.
Entscheidung (Nicola): bestätigt

## [Setup] Wann kommt `notes://changed`?
Frage / Problem: Nur bei Quick Capture oder auch bei Löschen, Wiederherstellen usw.?
Meine Annahme (womit ich vorerst weitermache): Nur wenn die Notiz nicht aus der aktuellen Ansicht stammt. Der Mock sendet es bei `note_create` mit `source = 'quick'`.
Entscheidung (Nicola): bestätigt

## [Setup] Quick-Capture-Fenster schliessen
Frage / Problem: Esc und ↵ müssen das Fenster schliessen. Dafür gibt es keinen Command.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `getCurrentWindow().hide()` auf, Agent A erlaubt das in `src-tauri/capabilities/`.
Entscheidung (Nicola): bestätigt

## [Setup] Mehrfachauswahl: Korrigieren, Verbessern, eigene Anweisung
Frage / Problem: Für mehrere Notizen gibt es nur `ai_summarize_notes`, und das ohne Anweisung.
Meine Annahme (womit ich vorerst weitermache): Das Frontend ruft `ai_transform` pro Notiz auf, mit je eigener `requestId`.
Entscheidung (Nicola): bestätigt

## [Setup] Reihenfolge der Tasten 1/2/3
Frage / Problem: Screen 2: Verbessern 1, Korrigieren 2, Zusammenfassen 3. Screen 6: Zusammenfassen 1, Korrigieren 2, Verbessern 3.
Meine Annahme (womit ich vorerst weitermache): Genau wie in den Screenshots, also unterschiedlich.
Entscheidung (Nicola): Überall gleich: Verbessern 1, Korrigieren 2, Zusammenfassen 3.

## [Setup] Abgeleiteter Titel
Frage / Problem: „Erste Zeile bzw. erster Satz“ passt nicht überall: In 1B steht „Zahnarzt verschoben auf Do 14:30, Dr. Keller …“ in einer Zeile, in 1A endet der Titel nach „14:30“. Texte weichen zwischen den Screens auch leicht ab.
Meine Annahme (womit ich vorerst weitermache): Erster Satz der ersten Zeile. Die Mock-Notizen haben dort einen Zeilenumbruch, damit die Titel wie in 1A aussehen.
Entscheidung (Nicola): bestätigt

## [Setup] ss oder ß in UI-Texten
Frage / Problem: Die Screenshots zeigen „schließt“/„schließen“, AGENTS.md erlaubt „ss“, aber einheitlich.
Meine Annahme (womit ich vorerst weitermache): UI wie in den Screenshots mit ß. Notiztexte bleiben wie vorgegeben („heisst“).
Entscheidung (Nicola): Überall „ss“.

## [Setup] Wem gehören die Dateien im Root?
Frage / Problem: `package.json`, `vite.config.ts`, `index.html`, `.env.development` liegen ausserhalb von `src/` und `src-tauri/`. Agent B braucht z. B. das npm-Paket `diff`.
Meine Annahme (womit ich vorerst weitermache): Agent B darf sie ändern, Agent A nicht.
Entscheidung (Nicola): bestätigt

## [Setup] Bundle-Identifier und App-Icon
Frage / Problem: Beides ist nicht vorgegeben. Der Identifier bestimmt u. a. das App-Data-Verzeichnis und sollte vor dem ersten echten Einsatz feststehen.
Meine Annahme (womit ich vorerst weitermache): `app.notiz.desktop`, `productName` „notiz“ ohne Punkt (Windows mag keine Pfade mit Punkt am Ende), Fenstertitel „notiz.“. Icons sind die Tauri-Platzhalter.
Entscheidung (Nicola): bestätigt

## [Agent A] `sources` der Kurzantwort: nur zitierte Notizen
Frage / Problem: Der Vertrag sagt „Note-IDs, auf die sich eine Kurzantwort stützt“. Zitiert die Antwort nur [1] und [3], ist unklar, ob `sources` alle mitgeschickten Notizen enthält oder nur die zitierten.
Meine Annahme (womit ich vorerst weitermache): Nur die zitierten, aufsteigend nach Nummer (`[id1, id3]`). Badge `[n]` gehört immer zu `hits[n-1]`, **nicht** zu `sources[n-1]`. Das Frontend sollte also über `hits` auflösen. Ungültige Nummern entfernt das Backend aus dem Text. Hat die Antwort gar keine gültige Quelle, ersetzt das Backend sie in `ai://done` durch „Dazu habe ich in deinen Notizen nichts gefunden.“ mit `sources: []` (die gestreamten Chunks können davon abweichen, massgebend ist `done.text`). In die Kurzantwort gehen höchstens die ersten 5 `match`-Treffer.
Entscheidung (Nicola):

## [Agent A] Neue Suchfrage bricht die vorherige Kurzantwort ab
Frage / Problem: Tippt man eine Frage und sucht erneut, laufen sonst mehrere Kurzantworten parallel (Kosten, Notiztext geht mehrfach raus).
Meine Annahme (womit ich vorerst weitermache): Jede neue `search` mit Kurzantwort bricht die vorherige ab, wie `ai_cancel`: Für die alte `requestId` kommt kein Event mehr. Das Frontend sollte `search` bei Fragen trotzdem nicht pro Tastendruck aufrufen, sondern debounced oder erst bei ↵.
Entscheidung (Nicola):

## [Agent A] Eingabefehler bei KI-Befehlen als Command-Fehler
Frage / Problem: Leere Markierung, leere eigene Anweisung oder `ai_summarize_notes` ohne IDs bzw. mit unbekannter ID.
Meine Annahme (womit ich vorerst weitermache): Das Command selbst gibt einen Fehler-String zurück, es kommt kein `ai://`-Event. `ai://error` gibt es nur für Fehler während der Anfrage (kein API-Key, Netz, Limit, Abbruch durch Claude).
Entscheidung (Nicola):

## [Agent A] Modelle
Frage / Problem: Der Brief verlangt ein schnelles Modell für Textbefehle und ein stärkeres für Kurzantworten, nennt aber keine Namen.
Meine Annahme (womit ich vorerst weitermache): `claude-haiku-5-5` für Verbessern/Korrigieren/Zusammenfassen/eigene Anweisung (eine Markierung). `claude-opus-5-5` für die Kurzantwort und `ai_summarize_notes` (mehrere Notizen), mit serverseitigem Fallback auf ein anderes Modell, falls Claude aus Sicherheitsgründen ablehnt. Konstanten in `src-tauri/src/ai.rs`.
Entscheidung (Nicola):

## [Agent A] Embedding-Modell wird beim ersten Start heruntergeladen
Frage / Problem: fastembed lädt multilingual-e5-small (ca. 470 MB) einmalig von Hugging Face ins App-Data-Verzeichnis (`models/`). Dabei geht kein Notiztext raus. Bis das Modell bereit ist (oder offline), läuft die Suche nur über Wörter. Der Vertrag hat kein Feld, um diesen Zustand anzuzeigen.
Meine Annahme (womit ich vorerst weitermache): Kein UI-Hinweis, die Suche funktioniert einfach schrittweise besser. Neuer Download-Versuch alle 10 Minuten bzw. nach dem nächsten Speichern.
Entscheidung (Nicola):

## [Agent A] Grenzen der semantischen Suche
Frage / Problem: Am echten Modell gemessen (8 Fragen auf den Beispielnotizen, siehe `embedder::tests::calibrate`): 6 liefern genau die richtigen Notizen, keine falschen Treffer. Synonyme kennt das kleine Modell aber schlecht: „Fahrrad“ findet „Velo“ nicht, „Geschenkidee Geburtstag“ nicht „Lenas Geburi“. „Brunner … Ventil im Bad“ erscheint zur Heizungsfrage nur unter „Weniger passend“ (Screen 4 zeigt es als Quelle).
Meine Annahme (womit ich vorerst weitermache): So lassen. Besser würde es mit multilingual-e5-base (ca. 1.1 GB Download, langsamer). Die Konstante lässt sich in `embedder.rs` ändern, die Vektoren werden dann automatisch neu berechnet. Die Schwellen müssten danach neu kalibriert werden.
Entscheidung (Nicola):

## [Agent A] Highlights bei Bedeutungs-Treffern
Frage / Problem: Screen 4 markiert auch Stellen, die nicht wörtlich zur Frage passen.
Meine Annahme (womit ich vorerst weitermache): Wort-Treffer markieren ganze Wörter (aufeinanderfolgende werden zu einem Bereich zusammengefasst, z. B. „Heizung Bad“). Notizen, die nur über die Bedeutung „passend“ sind, bekommen den ähnlichsten Satz markiert (bei einzeiligen Notizen keine Markierung). „Weniger passend“ ohne Wort-Treffer hat keine Markierung.
Entscheidung (Nicola):

## [Agent A] Quick-Capture-Fenster
Frage / Problem: Grösse, Transparenz und Fokus sind nicht festgelegt.
Meine Annahme (womit ich vorerst weitermache): Rahmenloses, **transparentes** Fenster 760×300 (logisch) oben mittig auf dem Bildschirm mit dem Mauszeiger, immer im Vordergrund, auch über Vollbild-Spaces. Die Karte samt Schatten zeichnet das Frontend, der Rest muss transparent bleiben (`html, body { background: transparent }`). Das Frontend darf die Höhe per `setSize` anpassen (`capabilities/capture.json`). Für Transparenz auf macOS ist `macOSPrivateApi` aktiv, das schliesst einen Mac-App-Store-Vertrieb aus. Der Shortcut schaltet das Fenster ein und aus. Klick daneben schliesst es nicht. Nach `hide()` gibt macOS den Fokus ans vorherige Programm zurück, wenn das Hauptfenster nicht offen ist. Beim Öffnen sendet das Backend kein Event. Das Frontend kann Fokus-Events des Fensters nutzen (`onFocusChanged`), um das Feld zu leeren bzw. den Cursor zu setzen.
Entscheidung (Nicola):

## [Agent A] Format von `captureShortcut`
Frage / Problem: Welche Schreibweise akzeptiert `settings_set`?
Meine Annahme (womit ich vorerst weitermache): Die Syntax des Tauri-Shortcut-Plugins: Modifier `Alt`/`Option`, `Ctrl`/`Control`, `Shift`, `Cmd`/`Super`, `CmdOrCtrl`, Taste z. B. `Space`, `N`, `F5`, mit „+“ verbunden („Alt+Space“). Mindestens ein Modifier ist Pflicht. Ist das Kürzel ungültig oder schon belegt, kommt ein Fehler-String, und der alte Shortcut bleibt aktiv.
Entscheidung (Nicola):

## [Agent A] Autostart
Frage / Problem: Der Brief (Abschnitt 14) nennt das Autostart-Plugin, die Aufgabe und der Vertrag nicht (keine Einstellung dafür).
Meine Annahme (womit ich vorerst weitermache): Nicht eingebaut. Ohne Autostart funktioniert Quick Capture erst, wenn die App einmal gestartet wurde. Vorschlag: Einstellung `launchAtLogin: boolean` im Vertrag ergänzen.
Entscheidung (Nicola):

## [Agent A] Kleinigkeiten im Verhalten der Notiz-Commands
Frage / Problem: Nicht im Vertrag geregelt.
Meine Annahme (womit ich vorerst weitermache): `note_set_pinned` ändert `updatedAt` nicht (nur Textänderungen). Nochmaliges `note_delete` behält das ursprüngliche `deletedAt`. `note_delete_forever` geht auch für Notizen ausserhalb des Papierkorbs. `note_create` nimmt auch leeren Text an. Bei unbekannter ID kommt „Notiz nicht gefunden“. Leere Notizen bekommen keine Vektoren.
Entscheidung (Nicola):
