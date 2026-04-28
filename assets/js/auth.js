/**
 * @description Gestione autenticazione: login, logout, controllo sessione.
 *              Importato come modulo da index.html, app.html e admin.html.
 * @module auth
 */

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ========================================
// COSTANTI
// ========================================

/** @type {Object.<string, string>} Mappa codici errore Firebase → messaggi in italiano */
const MESSAGGI_ERRORE = {
  'auth/invalid-credential':     'Email o password non corretti. Riprova.',
  'auth/user-not-found':         'Nessun account trovato con questa email.',
  'auth/wrong-password':         'Password non corretta.',
  'auth/invalid-email':          'Indirizzo email non valido.',
  'auth/user-disabled':          'Questo account è stato disabilitato.',
  'auth/too-many-requests':      'Troppi tentativi falliti. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
};

/** @type {string} Messaggio errore generico di fallback */
const ERRORE_GENERICO = 'Si è verificato un errore. Riprova più tardi.';

// ========================================
// UTILITÀ UI
// ========================================

/**
 * @description Mostra un messaggio di errore inline nel form di login.
 * @param {string} messaggio - Il testo da mostrare.
 */
function mostraErrore(messaggio) {
  const contenitore = document.getElementById('messaggioErrore');
  const testo       = document.getElementById('testoErrore');
  if (!contenitore || !testo) return;
  testo.textContent  = messaggio;
  contenitore.hidden = false;
}

/**
 * @description Nasconde il messaggio di errore inline.
 */
function nascondiErrore() {
  const contenitore = document.getElementById('messaggioErrore');
  if (contenitore) contenitore.hidden = true;
}

/**
 * @description Imposta lo stato di caricamento sul pulsante di accesso.
 * @param {boolean} caricamento - true mostra lo spinner, false ripristina.
 */
function impostaCaricamento(caricamento) {
  const pulsante = document.getElementById('btnAccedi');
  const testo    = document.getElementById('testoPulsante');
  const spinner  = document.getElementById('spinnerPulsante');
  if (!pulsante || !testo || !spinner) return;
  pulsante.disabled = caricamento;
  testo.hidden      = caricamento;
  spinner.hidden    = !caricamento;
}

// ========================================
// LOGIN
// ========================================

/**
 * @description Tenta il login con Firebase Authentication email/password.
 *              Su successo, onAuthStateChanged gestisce il redirect ad app.html.
 *              Su errore mostra il messaggio inline nel form.
 * @param {string} email    - Email inserita.
 * @param {string} password - Password inserita.
 * @returns {Promise<void>}
 */
async function eseguiLogin(email, password) {
  impostaCaricamento(true);
  nascondiErrore();
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (errore) {
    mostraErrore(MESSAGGI_ERRORE[errore.code] || ERRORE_GENERICO);
    impostaCaricamento(false);
  }
}

// ========================================
// TOGGLE VISIBILITÀ PASSWORD
// ========================================

/**
 * @description Alterna il campo password tra tipo "text" e "password".
 *              Aggiorna icona e aria-label del pulsante di conseguenza.
 */
function inizializzaTogglePassword() {
  const btnToggle = document.getElementById('btnTogglePassword');
  const inputPass = document.getElementById('inputPassword');
  if (!btnToggle || !inputPass) return;

  btnToggle.addEventListener('click', () => {
    const visibile = inputPass.type === 'text';
    inputPass.type = visibile ? 'password' : 'text';
    btnToggle.setAttribute('aria-label', visibile ? 'Mostra password' : 'Nascondi password');
    const icona = btnToggle.querySelector('i');
    if (icona) {
      icona.setAttribute('data-lucide', visibile ? 'eye' : 'eye-off');
      lucide.createIcons();
    }
  });
}

// ========================================
// FORM LOGIN
// ========================================

/**
 * @description Inizializza il form di login con validazione e handler submit.
 *              Attivo solo se il form è presente nella pagina (index.html).
 */
function inizializzaFormLogin() {
  const form = document.getElementById('formLogin');
  if (!form) return;

  inizializzaTogglePassword();

  form.addEventListener('input', nascondiErrore);

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const email    = document.getElementById('inputEmail')?.value.trim() || '';
    const password = document.getElementById('inputPassword')?.value     || '';
    if (!email || !password) {
      mostraErrore('Inserisci email e password per continuare.');
      return;
    }
    eseguiLogin(email, password);
  });
}

// ========================================
// CONTROLLO SESSIONE
// ========================================

/**
 * @description Osserva lo stato auth Firebase e gestisce i redirect di sicurezza:
 *              - index.html: se loggato → app.html
 *              - app.html: se non loggato → index.html
 *              - admin.html: se non loggato → index.html; se non admin → app.html
 */
function controllaSessione() {
  const pagina = window.location.pathname.split('/').pop() || 'index.html';

  onAuthStateChanged(auth, async (utente) => {
    if (pagina === 'index.html' || pagina === '') {
      if (utente) window.location.replace('app.html');

    } else if (pagina === 'app.html') {
      if (!utente) window.location.replace('index.html');

    } else if (pagina === 'admin.html') {
      if (!utente) { window.location.replace('index.html'); return; }
      const snap  = await getDoc(doc(db, 'utenti', utente.uid));
      const ruolo = snap.exists() ? snap.data().ruolo : null;
      if (ruolo !== 'admin') window.location.replace('app.html');
    }
  });
}

// ========================================
// LOGOUT — esportato per uso in app.html / admin.html
// ========================================

/**
 * @description Disconnette l'utente da Firebase e reindirizza al login.
 * @returns {Promise<void>}
 */
export async function eseguiLogout() {
  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (errore) {
    console.error('Errore logout:', errore);
  }
}

// ========================================
// AVVIO
// ========================================

controllaSessione();
inizializzaFormLogin();
