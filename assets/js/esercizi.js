/**
 * @description Ricerca esercizi tramite dataset locale pre-generato (896 esercizi Wger EN).
 *              La ricerca avviene in-memory — nessuna chiamata API, risultati istantanei.
 *              Le immagini vengono caricate lazily da Wger quando si seleziona un esercizio.
 * @module esercizi
 */

import { ESERCIZI_DATASET } from './esercizi-dataset.js';

// ========================================
// COSTANTI
// ========================================

/** @type {number} Numero massimo di risultati mostrati per ricerca */
const MAX_RISULTATI = 12;

/** @type {string} URL base API Wger per le immagini */
const WGER_IMG_BASE = 'https://wger.de/api/v2/exerciseimage';

// ========================================
// RICERCA IN-MEMORY
// ========================================

/**
 * @description Cerca esercizi nel dataset locale tramite corrispondenza nel nome.
 *              La ricerca è case-insensitive e considera qualsiasi parola del termine.
 * @param {string} termine - Testo di ricerca (in inglese, es. "bench press", "curl")
 * @returns {Array<{id:number, nome:string, gruppoMuscolare:string, thumbnail:null}>}
 */
export function cercaEsercizi(termine) {
  if (!termine || termine.trim().length < 2) return [];

  const parole = termine.trim().toLowerCase().split(/\s+/);

  const risultati = ESERCIZI_DATASET.filter(es => {
    const nomeMin = es.nome.toLowerCase();
    return parole.every(p => nomeMin.includes(p));
  });

  return risultati
    .slice(0, MAX_RISULTATI)
    .map(es => ({
      id:              es.id,
      nome:            es.nome,
      gruppoMuscolare: es.categoria,
      thumbnail:       null,
    }));
}

// ========================================
// IMMAGINI WGER (lazy on selection)
// ========================================

/** @type {Map<number, string|null>} Cache immagini: wgerId → url */
const cacheImmagini = new Map();

/**
 * @description Recupera l'URL della prima immagine disponibile per un esercizio Wger.
 *              Usa una cache in-memory per evitare chiamate duplicate.
 * @param {number} wgerId - ID base esercizio su Wger
 * @returns {Promise<string|null>} URL immagine oppure null
 */
export async function ottieniImmagineEsercizio(wgerId) {
  if (!wgerId) return null;
  if (cacheImmagini.has(wgerId)) return cacheImmagini.get(wgerId);

  try {
    const url  = `${WGER_IMG_BASE}/?exercise_base=${wgerId}&format=json`;
    const risp = await fetch(url);
    if (!risp.ok) { cacheImmagini.set(wgerId, null); return null; }

    const dati = await risp.json();
    const imgs = dati.results || [];
    const principale = imgs.find(i => i.is_main) || imgs[0];
    const imgUrl = principale?.image || null;
    cacheImmagini.set(wgerId, imgUrl);
    return imgUrl;
  } catch {
    cacheImmagini.set(wgerId, null);
    return null;
  }
}

// ========================================
// UTILITÀ DEBOUNCE
// ========================================

/**
 * @description Crea una versione debounced di una funzione.
 * @param {Function} fn      - Funzione da ritardare
 * @param {number}   ritardo - Millisecondi di attesa (default 250ms)
 * @returns {Function} Funzione debounced
 */
export function creaDebounce(fn, ritardo = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ritardo);
  };
}
