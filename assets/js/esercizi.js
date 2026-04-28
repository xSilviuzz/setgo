/**
 * @description Ricerca esercizi tramite dataset locale (1723 esercizi, 873 con GIF).
 *              Fonti: free-exercise-db + Wger EN.
 *              Ricerca in-memory — istantanea, nessuna chiamata API.
 *              Le GIF degli esercizi free-exercise-db sono già nel dataset.
 * @module esercizi
 */

import { ESERCIZI_DATASET } from './esercizi-dataset.js';

// ========================================
// COSTANTI
// ========================================

/** @type {number} Numero massimo risultati per ricerca */
const MAX_RISULTATI = 15;

/** @type {string} URL base API Wger (usata solo per esercizi senza gifUrl nel dataset) */
const WGER_IMG_BASE = 'https://wger.de/api/v2/exerciseimage';

// ========================================
// RICERCA IN-MEMORY
// ========================================

/**
 * @description Cerca esercizi nel dataset locale.
 *              Tutte le parole del termine devono essere presenti nel nome.
 *              Priorità: nomi che iniziano con il termine > nomi che lo contengono.
 * @param {string} termine - Testo di ricerca
 * @returns {Array<{id:string|number, nome:string, gruppoMuscolare:string, gifUrl:string|null}>}
 */
export function cercaEsercizi(termine) {
  if (!termine || termine.trim().length < 2) return [];

  const parole  = termine.trim().toLowerCase().split(/\s+/);
  const inizioT = termine.trim().toLowerCase();

  const risultati = ESERCIZI_DATASET.filter(es => {
    const nomeMin = es.nome.toLowerCase();
    return parole.every(p => nomeMin.includes(p));
  });

  // Ordina: prima quelli che iniziano con il termine
  risultati.sort((a, b) => {
    const aInizio = a.nome.toLowerCase().startsWith(inizioT) ? 0 : 1;
    const bInizio = b.nome.toLowerCase().startsWith(inizioT) ? 0 : 1;
    return aInizio - bInizio || a.nome.localeCompare(b.nome);
  });

  return risultati.slice(0, MAX_RISULTATI).map(es => ({
    id:              es.id,
    nome:            es.nome,
    gruppoMuscolare: es.categoria,
    gifUrl:          es.gifUrl || null,
  }));
}

// ========================================
// IMMAGINI LAZY (solo per esercizi Wger senza GIF nel dataset)
// ========================================

/** @type {Map<string|number, string|null>} Cache immagini Wger */
const cacheImmagini = new Map();

/**
 * @description Prova a recuperare un'immagine da Wger per gli esercizi
 *              che non hanno una gifUrl nel dataset (esercizi Wger aggiunti).
 *              Non chiamare per gli esercizi free-exercise-db (id inizia con "fe-").
 * @param {string|number} idEs - ID esercizio
 * @returns {Promise<string|null>} URL immagine o null
 */
export async function ottieniImmagineEsercizio(idEs) {
  if (!idEs || String(idEs).startsWith('fe-')) return null;
  if (cacheImmagini.has(idEs)) return cacheImmagini.get(idEs);

  try {
    const url  = `${WGER_IMG_BASE}/?exercise_base=${idEs}&format=json`;
    const risp = await fetch(url);
    if (!risp.ok) { cacheImmagini.set(idEs, null); return null; }
    const dati    = await risp.json();
    const imgs    = dati.results || [];
    const imgUrl  = (imgs.find(i => i.is_main) || imgs[0])?.image || null;
    cacheImmagini.set(idEs, imgUrl);
    return imgUrl;
  } catch {
    cacheImmagini.set(idEs, null);
    return null;
  }
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
