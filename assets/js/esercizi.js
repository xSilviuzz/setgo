/**
 * @description Ricerca esercizi bilingue (italiano + inglese) su dataset locale.
 *              Logica: alias IT→EN → ricerca nel dataset → unione senza duplicati.
 *              1701 esercizi, ricerca in-memory istantanea.
 * @module esercizi
 */

import { ESERCIZI_DATASET } from './esercizi-dataset.js';

// ========================================
// MAPPA ALIAS ITALIANO → INGLESE
// ========================================

/**
 * @description Termini comuni da palestra in italiano mappati al corrispettivo inglese.
 *              La chiave è in minuscolo. Il valore è il termine da cercare nel dataset.
 * @type {Object<string, string>}
 */
const ALIAS_IT_EN = {
  "panca": "bench press",
  "panca piana": "bench press",
  "panca inclinata": "incline bench press",
  "panca declinata": "decline bench press",
  "croci": "dumbbell fly",
  "croci ai cavi": "cable fly",
  "chest press": "chest press",
  "aperture": "dumbbell fly",
  "parallele": "dips",
  "dip": "dips",
  "push up": "push up",
  "piegamenti": "push up",
  "flessioni": "push up",
  "lat machine": "lat pulldown",
  "lat": "lat pulldown",
  "trazioni": "pull up",
  "rematore": "row",
  "rematore bilanciere": "barbell row",
  "rematore manubri": "dumbbell row",
  "low row": "seated cable rows",
  "pulley basso": "seated cable rows",
  "pulley alto": "lat pulldown",
  "tirate al petto": "lat pulldown",
  "stacchi": "deadlift",
  "stacco": "deadlift",
  "stacco rumeno": "romanian deadlift",
  "iperextension": "back extension",
  "iperestensioni": "back extension",
  "lento avanti": "overhead press",
  "lento dietro": "behind neck press",
  "shoulder press": "shoulder press",
  "military press": "overhead press",
  "alzate laterali": "lateral raise",
  "alzate frontali": "front raise",
  "tirate al mento": "upright row",
  "alzate posteriori": "rear delt",
  "face pull": "face pull",
  "curl": "bicep curl",
  "curl bilanciere": "barbell curl",
  "curl manubri": "dumbbell curl",
  "curl alternato": "alternating curl",
  "curl martello": "hammer curl",
  "curl ai cavi": "cable curl",
  "curl concentrazione": "concentration curl",
  "curl panca scott": "preacher curl",
  "scott": "preacher curl",
  "french press": "tricep",
  "tricep machine": "tricep",
  "estensioni tricipiti": "tricep extension",
  "pushdown": "tricep pushdown",
  "kickback": "tricep kickback",
  "tricipiti ai cavi": "cable tricep",
  "skull crusher": "skull crusher",
  "squat": "squat",
  "squat bilanciere": "barbell squat",
  "leg press": "leg press",
  "pressa": "leg press",
  "affondi": "lunges",
  "lunge": "lunges",
  "leg extension": "leg extension",
  "leg curl": "leg curl",
  "curl femorali": "leg curl",
  "stacchi gambe tese": "straight leg deadlift",
  "sumo": "sumo deadlift",
  "hip thrust": "hip thrust",
  "glute bridge": "glute bridge",
  "calf": "calf raise",
  "alzate polpacci": "calf raise",
  "addominali": "crunch",
  "crunch": "crunch",
  "plank": "plank",
  "russian twist": "russian twist",
  "leg raise": "leg raise",
  "alzate gambe": "leg raise",
  "crunch obliqui": "oblique crunch",
  "mountain climber": "mountain climber",
  "sit up": "sit up",
  "burpee": "burpee",
  "jumping jack": "jumping jack",
  "corsa": "running",
  "cyclette": "stationary bike",
  "ellittica": "elliptical",
  "vogatore": "rowing machine"
};

// ========================================
// COSTANTI
// ========================================

/** @type {number} Risultati massimi mostrati */
const MAX_RISULTATI = 12;

// ========================================
// RICERCA BILINGUE
// ========================================

/**
 * @description Cerca nel dataset locale con supporto italiano + inglese.
 *              Prima prova alias italiani, poi ricerca diretta per parole chiave.
 *              I risultati sono uniti e deduplicati per ID.
 * @param {string} termine - Testo inserito dall'utente (IT o EN)
 * @returns {Array<{id:string|number, nome:string, gruppoMuscolare:string}>}
 */
export function cercaEsercizi(termine) {
  if (!termine || termine.trim().length < 2) return [];

  const termineMin = termine.trim().toLowerCase();
  const risultatiId = new Set();
  const risultati   = [];

  /**
   * @param {string} query - Termine di ricerca in inglese
   * @param {number} priorita - 0 = risultati alias (mostrati prima)
   */
  function aggiungiRisultati(query, priorita) {
    const parole = query.toLowerCase().split(/\s+/);
    ESERCIZI_DATASET.forEach(es => {
      if (risultatiId.has(es.id)) return;
      const nomeMin = es.nome.toLowerCase();
      if (parole.every(p => nomeMin.includes(p))) {
        risultatiId.add(es.id);
        risultati.push({ ...es, _priorita: priorita });
      }
    });
  }

  // 1. Cerca alias esatti prima (maggior priorità)
  if (ALIAS_IT_EN[termineMin]) {
    aggiungiRisultati(ALIAS_IT_EN[termineMin], 0);
  }

  // 2. Cerca alias parziali (es. "curl bil" trova "curl bilanciere" → "barbell curl")
  Object.entries(ALIAS_IT_EN).forEach(([it, en]) => {
    if (it.includes(termineMin) || termineMin.includes(it.split(' ')[0])) {
      aggiungiRisultati(en, 1);
    }
  });

  // 3. Ricerca diretta nel dataset (funziona anche per nomi inglesi)
  aggiungiRisultati(termineMin, 2);

  // Ordina: prima alias esatti, poi parziali, poi diretti
  // All'interno di ogni gruppo, preferisci nomi che iniziano col termine
  risultati.sort((a, b) => {
    if (a._priorita !== b._priorita) return a._priorita - b._priorita;
    const aInizio = a.nome.toLowerCase().startsWith(termineMin) ? 0 : 1;
    const bInizio = b.nome.toLowerCase().startsWith(termineMin) ? 0 : 1;
    return aInizio - bInizio || a.nome.localeCompare(b.nome);
  });

  return risultati.slice(0, MAX_RISULTATI).map(es => ({
    id:              es.id,
    nome:            es.nome,
    gruppoMuscolare: es.categoria,
    gifUrl:          null,
  }));
}

// ========================================
// UTILITÀ DEBOUNCE
// ========================================

/**
 * @description Crea una versione debounced di una funzione.
 * @param {Function} fn      - Funzione da ritardare
 * @param {number}   ritardo - Millisecondi (default 200ms)
 * @returns {Function} Funzione debounced
 */
export function creaDebounce(fn, ritardo = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ritardo);
  };
}
