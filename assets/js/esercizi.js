/**
 * @description Integrazione con l'API Wger per la ricerca e il recupero
 *              di esercizi con immagini/GIF.
 * @module esercizi
 */

// ========================================
// COSTANTI
// ========================================

/** @type {string} URL base API Wger */
const WGER_BASE = 'https://wger.de/api/v2';

/** @type {number} Ritardo debounce ricerca in millisecondi */
const DEBOUNCE_MS = 350;

/** @type {number} Numero massimo risultati di ricerca mostrati */
const MAX_RISULTATI = 10;

// ========================================
// RICERCA ESERCIZI
// ========================================

/**
 * @description Cerca esercizi sull'API Wger per termine di ricerca.
 *              Restituisce un array di suggerimenti con nome, id e categoria.
 * @param {string} termine - Testo di ricerca
 * @returns {Promise<Array>} Lista suggerimenti esercizi
 */
export async function cercaEsercizi(termine) {
  if (!termine || termine.trim().length < 2) return [];
  try {
    const url  = `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(termine)}&format=json`;
    const risp = await fetch(url);
    if (!risp.ok) throw new Error(`HTTP ${risp.status}`);
    const dati = await risp.json();
    return (dati.suggestions || []).slice(0, MAX_RISULTATI).map(s => ({
      id:              s.data?.base_id || s.data?.id || null,
      nome:            s.value || 'Esercizio sconosciuto',
      gruppoMuscolare: s.data?.category || '—',
      thumbnail:       s.data?.image_thumbnail || null,
    }));
  } catch (errore) {
    console.warn('Errore ricerca Wger:', errore);
    return [];
  }
}

/**
 * @description Recupera l'URL della prima immagine/GIF disponibile per un esercizio Wger.
 * @param {number} baseId - ID base dell'esercizio su Wger
 * @returns {Promise<string|null>} URL immagine o null se non disponibile
 */
export async function ottieniImmagineEsercizio(baseId) {
  if (!baseId) return null;
  try {
    const url  = `${WGER_BASE}/exerciseimage/?exercise_base=${baseId}&format=json`;
    const risp = await fetch(url);
    if (!risp.ok) return null;
    const dati = await risp.json();
    const imgs = dati.results || [];
    // Preferisce GIF (is_main == true) o prima immagine disponibile
    const principale = imgs.find(i => i.is_main) || imgs[0];
    return principale?.image || null;
  } catch {
    return null;
  }
}

/**
 * @description Recupera i dettagli completi di un esercizio Wger.
 * @param {number} baseId - ID base dell'esercizio su Wger
 * @returns {Promise<Object|null>} Oggetto dettagli esercizio o null
 */
export async function ottieniDettagliEsercizio(baseId) {
  if (!baseId) return null;
  try {
    const url  = `${WGER_BASE}/exerciseinfo/${baseId}/?format=json`;
    const risp = await fetch(url);
    if (!risp.ok) return null;
    const dati = await risp.json();
    const traduzione = dati.translations?.find(t => t.language === 2)
                    || dati.translations?.[0];
    return {
      id:              baseId,
      nome:            traduzione?.name || 'Esercizio',
      gruppoMuscolare: dati.category?.name || '—',
      gifUrl:          dati.images?.[0]?.image || null,
    };
  } catch {
    return null;
  }
}

// ========================================
// UTILITÀ DEBOUNCE
// ========================================

/**
 * @description Crea una versione debounced di una funzione.
 * @param {Function} fn      - Funzione da ritardare
 * @param {number}   ritardo - Millisecondi di attesa
 * @returns {Function} Funzione debounced
 */
export function creaDebounce(fn, ritardo = DEBOUNCE_MS) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ritardo);
  };
}
