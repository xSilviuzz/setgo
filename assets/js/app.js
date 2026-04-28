/**
 * @description Controller principale dell'app: gestione auth, router,
 *              dark mode e rendering della vista Home.
 * @module app
 */

import { auth, db }          from './firebase-config.js';
import { inizializzaSchede } from './schede.js';
import { onAuthStateChanged }    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { signOut }               from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  doc, getDoc,
  collection, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ========================================
// COSTANTI
// ========================================

/** @type {string[]} Nomi abbreviati giorni della settimana (Lun → Dom) */
const NOMI_GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** @type {string} Chiave localStorage per preferenza tema */
const CHIAVE_TEMA = 'setgo-tema';

// ========================================
// STATO GLOBALE
// ========================================

/** @type {import("firebase/auth").User|null} Utente Firebase corrente */
let utenteCorrente = null;

/** @type {Object|null} Profilo utente da Firestore */
let profiloUtente = null;

/** @type {string} Vista attualmente visualizzata */
let vistaAttiva = 'Home';

// ========================================
// DARK MODE
// ========================================

/**
 * @description Applica un tema all'elemento <html> e aggiorna l'icona del toggle.
 * @param {string} tema - 'chiaro' oppure 'scuro'
 */
function applicaTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  const btn   = document.getElementById('btnToggleTema');
  if (!btn) return;
  const icona = btn.querySelector('i');
  if (!icona) return;
  icona.setAttribute('data-lucide', tema === 'scuro' ? 'sun' : 'moon');
  btn.setAttribute('aria-label', tema === 'scuro' ? 'Passa alla modalità chiara' : 'Passa alla modalità scura');
  lucide.createIcons();
}

// ========================================
// ROUTER — NAVIGAZIONE TRA VISTE
// ========================================

/**
 * @description Inizializza il router collegando i pulsanti della nav bottom.
 */
function inizializzaRouter() {
  const voci = document.querySelectorAll('.nav-voce');
  voci.forEach(voce => {
    voce.addEventListener('click', () => {
      const destinazione = voce.dataset.vista;
      if (destinazione) navigaA(destinazione);
    });
  });

  // Il pulsante "Inizia Allenamento" porta alle schede
  const btnIniziaAllenamento = document.getElementById('btnIniziaAllenamento');
  if (btnIniziaAllenamento) {
    btnIniziaAllenamento.addEventListener('click', () => navigaA('Schede'));
  }
}

/**
 * @description Mostra la vista richiesta e nasconde tutte le altre.
 *              Aggiorna lo stato attivo nella navigazione bottom.
 * @param {string} nomeVista - Nome della vista: 'Home' | 'Schede' | 'Progressi' | 'Profilo'
 */
/** @type {Set<string>} Viste già inizializzate */
const visteInizializzate = new Set();

function navigaA(nomeVista) {
  if (nomeVista === vistaAttiva) return;
  vistaAttiva = nomeVista;

  // Mostra/nascondi sezioni
  const viste = document.querySelectorAll('.vista');
  viste.forEach(sezione => {
    const corrisponde = sezione.id === `vista${nomeVista}`;
    sezione.hidden = !corrisponde;
    if (corrisponde) sezione.removeAttribute('hidden');
  });

  // Aggiorna nav bottom
  const voci = document.querySelectorAll('.nav-voce');
  voci.forEach(voce => {
    const attiva = voce.dataset.vista === nomeVista;
    voce.classList.toggle('nav-voce--attiva', attiva);
    voce.setAttribute('aria-current', attiva ? 'page' : 'false');
  });

  // Inizializza moduli al primo accesso
  if (!visteInizializzate.has(nomeVista) && utenteCorrente) {
    visteInizializzate.add(nomeVista);
    if (nomeVista === 'Schede') inizializzaSchede(utenteCorrente.uid);
  }
}

// ========================================
// CARICAMENTO DATI UTENTE
// ========================================

/**
 * @description Carica il profilo utente e le sessioni recenti da Firestore.
 *              Gestisce il caso in cui i dati non esistano ancora.
 * @param {string} uid - UID dell'utente Firebase
 * @returns {Promise<{profilo: Object|null, sessioni: Array}>}
 */
async function caricaDatiUtente(uid) {
  try {
    // Profilo
    const profiloSnap = await getDoc(doc(db, 'utenti', uid));
    const profilo     = profiloSnap.exists() ? profiloSnap.data() : null;

    // Ultime sessioni (max 30 per calcolo streak + calendario)
    const sessioniRef  = collection(db, 'utenti', uid, 'sessioni');
    const sessioniQ    = query(sessioniRef, orderBy('completataAlle', 'desc'), limit(30));
    const sessioniSnap = await getDocs(sessioniQ);
    const sessioni     = sessioniSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { profilo, sessioni };
  } catch (errore) {
    console.error('Errore caricamento dati utente:', errore);
    return { profilo: null, sessioni: [] };
  }
}

// ========================================
// RENDERING VISTA HOME
// ========================================

/**
 * @description Aggiorna il saluto nella home con il nome dell'utente.
 * @param {string|null} nome - Nome dell'utente, o null se non disponibile
 */
function renderSaluto(nome) {
  const el = document.getElementById('homeSaluto');
  if (!el) return;
  el.textContent = nome ? `Ciao, ${nome}! 💪` : 'Bentornato! 💪';
}

/**
 * @description Aggiorna la card "Ultima sessione" con i dati dell'ultima sessione.
 * @param {Object|null} ultimaSessione - Oggetto sessione Firestore, o null se nessuna
 */
function renderUltimaSessione(ultimaSessione) {
  const el = document.getElementById('valoreUltimaSessione');
  if (!el) return;

  if (!ultimaSessione) {
    el.textContent = 'Nessuna ancora';
    return;
  }

  const data = ultimaSessione.completataAlle?.toDate?.() || new Date();
  el.textContent = data.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

/**
 * @description Calcola la streak settimanale consecutiva e aggiorna la card.
 *              Una settimana conta se contiene almeno una sessione completata.
 * @param {Array} sessioni - Lista sessioni Firestore ordinate per data desc
 */
function renderStreak(sessioni) {
  const el = document.getElementById('valoreStreak');
  if (!el) return;

  if (!sessioni.length) {
    el.textContent = '0 sett.';
    return;
  }

  // Raggruppa sessioni per numero settimana ISO
  const settimaneConSessione = new Set();
  sessioni.forEach(s => {
    const data = s.completataAlle?.toDate?.();
    if (!data) return;
    const chiave = chiaveSettimana(data);
    settimaneConSessione.add(chiave);
  });

  // Conta settimane consecutive partendo da quella corrente
  let streak       = 0;
  const settCorrente = chiaveSettimana(new Date());
  let settDaControllo = settCorrente;

  while (settimaneConSessione.has(settDaControllo)) {
    streak++;
    settDaControllo = settimanaPrec(settDaControllo);
  }

  el.textContent = `${streak} sett.`;
}

/**
 * @description Genera una chiave stringa univoca per una settimana (formato YYYY-WNN).
 * @param {Date} data - Data di riferimento
 * @returns {string} Chiave settimana, es. "2026-W17"
 */
function chiaveSettimana(data) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const anno      = d.getUTCFullYear();
  const inizio    = new Date(Date.UTC(anno, 0, 1));
  const numSettimana = Math.ceil(((d - inizio) / 86400000 + 1) / 7);
  return `${anno}-W${String(numSettimana).padStart(2, '0')}`;
}

/**
 * @description Restituisce la chiave della settimana precedente.
 * @param {string} chiave - Chiave settimana formato YYYY-WNN
 * @returns {string} Chiave settimana precedente
 */
function settimanaPrec(chiave) {
  const [anno, sett] = chiave.split('-W').map(Number);
  if (sett > 1) return `${anno}-W${String(sett - 1).padStart(2, '0')}`;
  return `${anno - 1}-W52`;
}

/**
 * @description Renderizza il mini-calendario degli ultimi 7 giorni.
 *              Mostra pallini colorati nei giorni in cui c'è stata una sessione.
 * @param {Array} sessioni - Lista sessioni Firestore
 */
function renderCalendario(sessioni) {
  const contenitore = document.getElementById('calendarioGiorni');
  if (!contenitore) return;

  // Costruisce un Set con le date (YYYY-MM-DD) che hanno sessioni
  const giorniConSessione = new Set();
  sessioni.forEach(s => {
    const data = s.completataAlle?.toDate?.();
    if (!data) return;
    giorniConSessione.add(data.toISOString().slice(0, 10));
  });

  contenitore.innerHTML = '';
  const oggi = new Date();

  for (let i = 6; i >= 0; i--) {
    const giorno    = new Date(oggi);
    giorno.setDate(oggi.getDate() - i);
    const chiave    = giorno.toISOString().slice(0, 10);
    const haSessione = giorniConSessione.has(chiave);
    const eOggi      = i === 0;

    const div = document.createElement('div');
    div.className = 'calendario-giorno';
    div.setAttribute('role', 'listitem');
    div.setAttribute('aria-label', `${NOMI_GIORNI[giorno.getDay()]}${haSessione ? ': allenamento completato' : ''}`);

    div.innerHTML = `
      <span class="giorno-nome">${NOMI_GIORNI[giorno.getDay()]}</span>
      <span class="giorno-pallino${haSessione ? ' giorno-pallino--attivo' : ''}${eOggi ? ' giorno-pallino--oggi' : ''}"></span>
    `;

    contenitore.appendChild(div);
  }
}

/**
 * @description Aggiorna l'intera vista Home con i dati caricati da Firestore.
 * @param {Object|null} profilo   - Profilo utente
 * @param {Array}       sessioni  - Lista sessioni
 */
function renderHome(profilo, sessioni) {
  renderSaluto(profilo?.nome || null);
  renderUltimaSessione(sessioni[0] || null);
  renderStreak(sessioni);
  renderCalendario(sessioni);
  lucide.createIcons();
}

// ========================================
// MOSTRA APP
// ========================================

/**
 * @description Rende visibile il contenitore principale dell'app.
 *              Chiamato solo dopo la conferma dell'autenticazione.
 */
function mostraApp() {
  const contenitore = document.getElementById('appContenitore');
  if (contenitore) contenitore.removeAttribute('hidden');
}

// ========================================
// AVVIO — LISTENER AUTH
// ========================================

/**
 * @description Punto di ingresso: osserva lo stato auth Firebase.
 *              Se non autenticato → redirect al login.
 *              Se autenticato → carica dati, mostra app, inizializza UI.
 */
onAuthStateChanged(auth, async (utente) => {
  if (!utente) {
    window.location.replace('index.html');
    return;
  }

  utenteCorrente = utente;

  // Tema salvato
  const temaCorrente = localStorage.getItem(CHIAVE_TEMA) || 'chiaro';
  applicaTema(temaCorrente);

  // Carica dati da Firestore
  const { profilo, sessioni } = await caricaDatiUtente(utente.uid);
  profiloUtente = profilo;

  // Mostra app e inizializza
  mostraApp();
  inizializzaRouter();
  renderHome(profilo, sessioni);

  // Collega il btn tema dopo che l'app è visibile
  const btn = document.getElementById('btnToggleTema');
  if (btn) {
    btn.addEventListener('click', () => {
      const corrente = document.documentElement.getAttribute('data-tema') || 'chiaro';
      const nuovo    = corrente === 'chiaro' ? 'scuro' : 'chiaro';
      applicaTema(nuovo);
      localStorage.setItem(CHIAVE_TEMA, nuovo);
    });
  }
});
