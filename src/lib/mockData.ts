/** Beispielnotizen aus den Screenshots in docs/design/. */
import type { Note, Source } from "./types";

/**
 * Zeitpunkte sind relativ zu heute (Screenshots: Mi, 25. Nov 2026), damit
 * „Heute“/„Gestern“ immer stimmen. Läge ein Zeitpunkt von heute noch in der
 * Zukunft, wird er in die bereits vergangene Tageszeit gestaucht.
 */
function at(daysAgo: number, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  const date = new Date(midnight);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes);
  if (date <= now) return date.toISOString();

  const share = (hours * 60 + minutes) / (24 * 60);
  const elapsed = now.getTime() - midnight.getTime();
  return new Date(midnight.getTime() + elapsed * share).toISOString();
}

function note(
  id: string,
  createdAt: string,
  text: string,
  options: { pinned?: boolean; source?: Source; deletedAt?: string } = {},
): Note {
  return {
    id,
    text,
    createdAt,
    updatedAt: createdAt,
    pinned: options.pinned ?? false,
    source: options.source ?? "app",
    deletedAt: options.deletedAt ?? null,
  };
}

export function createMockNotes(): Note[] {
  return [
    note(
      "lena-geburi",
      at(0, "09:14"),
      "Idee für Lenas Geburi: nicht wieder Restaurant. vllt Kochkurs zu zweit? die in Wiedikon hat Thai-Kurse, Sa nachmittags, ca. 120.– p.P.\n" +
        "oder Wochenende Tessin, aber Hotel muss bald gebucht werden wg. Ostern\n" +
        "Budget max 400\n" +
        "Sie hat mal gesagt sie will Töpfern lernen!! → Atelier am Idaplatz anschauen, haben die Gutscheine?\n\n" +
        "nicht vergessen: Karte schreiben, nicht nur WhatsApp",
      { pinned: true },
    ),
    note(
      "zahnarzt",
      at(0, "08:02"),
      "Zahnarzt verschoben auf Do 14:30\nDr. Keller, Praxis am Stauffacher. Karte mitnehmen, Zahnseide-Ermahnung ignorieren lol",
      { source: "quick" },
    ),
    note(
      "buch-tipp",
      at(1, "22:47"),
      "Buch-Tipp von Marc: Der Hals der Giraffe\nSchalansky – irgendwas mit Biologielehrerin? Marc sagt kurz, gut für Zugfahrten",
      { source: "quick" },
    ),
    note(
      "heizung-bad",
      at(1, "17:20"),
      "Heizung Bad klackert wieder. Brunner anrufen 044 512 77 30 nur vormittags\n" +
        "evtl. Mietzinsreduktion ansprechen?? nachlesen ob das bei Heizung überhaupt geht\n" +
        "Foto vom Thermostat machen bevor die kommen",
    ),
    note(
      "meeting-agentur",
      at(2, "16:05"),
      "Meeting Agentur: Logo zu verspielt\nnochmal mit weniger Farbe, Schrift ok. Deadline 4.12., Rechnung erst nach Freigabe",
    ),
    note(
      "router-passwort",
      at(2, "07:40"),
      "Router-Passwort geändert\nsteht auf Zettel im Schrank (nicht hier!!). Gäste-WLAN heisst jetzt „Wohnung 3“",
      { pinned: true },
    ),
    note(
      "sauerteig",
      at(5, "18:30"),
      "Sauerteig: 100g Starter, 350 Wasser, 500 Mehl\n400 hell / 100 Vollkorn, 10g Salz, über Nacht Kühlschrank, 45 min bei 240°",
      { pinned: true },
    ),
    note(
      "kuerbis-risotto",
      at(6, "21:12"),
      "wo war das Restaurant mit dem Kürbis-Risotto??\nKreis 4, irgendwas mit „Rosso“? Sarah fragen, war mit ihr im Oktober dort",
      { source: "quick" },
    ),
    note(
      "steuererklaerung",
      at(8, "10:20"),
      "Steuererklärung: Belege Säule 3a fehlen noch\nbei Bank anfragen, Frist verlängert bis 30.11. – Spendenquittung Rotes Kreuz auch noch",
    ),
    note(
      "velo-service",
      at(13, "12:15"),
      "Velo-Service: Bremsen hinten, Kette\nLaden Langstrasse sagt 85.–, Do abholen. Licht hinten auch gleich",
      { source: "quick" },
    ),
    note(
      "brunner-monteur",
      at(53, "11:05"),
      "Brunner war da (endlich) – sagt Monteur kommt nächste Woche wegen Ventil im Bad, soll mich melden falls nicht. Waschküche neu: Do ist jetzt unsere",
    ),
    note(
      "nebenkosten",
      at(72, "20:31"),
      "Nebenkostenabrechnung 2025 gekommen. Heizkosten fast 30% höher als letztes Jahr?? mit Nachbarn reden, Abrechnung aufheben",
    ),
    // Text aus Screen 5. Liegt hier im Papierkorb, damit dieser nicht leer ist.
    note(
      "paket-nachbarin",
      at(9, "13:40"),
      "Paket für Nachbarin abholen – Abholschein liegt im Briefkasten, Filiale Kreis 4, bis Sa",
      { source: "quick", deletedAt: at(4, "09:00") },
    ),
  ];
}
