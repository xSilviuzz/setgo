/**
 * @description Gestione completa delle schede di allenamento:
 *              lista, creazione, modifica, eliminazione, duplicazione,
 *              ricerca esercizi Wger, esercizi personalizzati.
 * @module schede
 */

import { ottieniSchede, salvaScheda, eliminaScheda, duplicaScheda,
         ottieniSchedePubbliche, salvaEsercizioPersonalizzato,
         ottieniEserciziPersonalizzati } from './db.js';
import { cercaEsercizi, ottieniImmagineEsercizio, creaDebounce } from './esercizi.js';

// ========================================
// COSTANTI
// ========================================

/** @type {number} Secondi per ogni ripetizione (stima media) */
const SECONDI_PER_REP = 4;

/** @type {number} Recupero default in secondi */
const RECUPERO_DEFAULT = 90;

// ========================================
// STATO MODULO
// ========================================

/** @type {string|null} UID utente corrente */
let _uid = null;

/** @type {Array} Schede dell'utente caricate da Firestore */
let schedeUtente = [];

/** @type {string|null} ID scheda in modifica (null = nuova scheda) */
let schedaInModifica = null;

/** @type {Array} Lista esercizi nel form corrente */
let eserciziForm = [];

// ========================================
// INIZIALIZZAZIONE
// ========================================

/**
 * @description Inizializza il modulo schede per l'utente dato.
 *              Carica le schede e collega tutti gli event listener.
 * @param {string} uid - UID dell'utente Firebase
 * @returns {Promise<void>}
 */
export async function inizializzaSchede(uid) {
  _uid = uid;
  collegaEventListenerSchede();
  await caricaEMostraSchede();
}

// ========================================
// EVENT LISTENER
// ========================================

/**
 * @description Collega tutti gli event listener della sezione Schede.
 */
function collegaEventListenerSchede() {
  // Pulsante nuova scheda
  document.getElementById('btnNuovaScheda')
    ?.addEventListener('click', () => apriFormScheda(null));

  // Torna alla lista dal form
  document.getElementById('btnTornaListaSchede')
    ?.addEventListener('click', tornaAllaLista);

  // Submit form scheda
  document.getElementById('formScheda')
    ?.addEventListener('submit', (e) => { e.preventDefault(); submitFormScheda(); });

  // Aggiungi esercizio
  document.getElementById('btnAggiungiEsercizio')
    ?.addEventListener('click', apriRicercaEsercizi);

  // Chiudi ricerca esercizi
  document.getElementById('btnChiudiRicerca')
    ?.addEventListener('click', chiudiRicercaEsercizi);

  // Overlay chiude la ricerca
  document.getElementById('overlayApp')
    ?.addEventListener('click', chiudiRicercaEsercizi);

  // Ricerca esercizi (debounced)
  const inputRicerca = document.getElementById('inputRicercaEsercizio');
  if (inputRicerca) {
    const cercaDebounced = creaDebounce(eseguiRicercaEsercizi, 200);
    inputRicerca.addEventListener('input', (e) => cercaDebounced(e.target.value));
  }

  // Esercizio personalizzato
  document.getElementById('btnEsercizioPersonalizzato')
    ?.addEventListener('click', apriFormEsercizioPersonalizzato);

  // Submit esercizio personalizzato
  document.getElementById('formEsercizioPersonalizzato')
    ?.addEventListener('submit', (e) => { e.preventDefault(); submitEsercizioPersonalizzato(); });

  // Annulla form personalizzato
  document.getElementById('btnAnnullaPersonalizzato')
    ?.addEventListener('click', chiudiFormEsercizioPersonalizzato);
}

// ========================================
// CARICAMENTO E RENDERING LISTA SCHEDE
// ========================================

/**
 * @description Carica le schede da Firestore e aggiorna la lista nella UI.
 * @returns {Promise<void>}
 */
async function caricaEMostraSchede() {
  const lista = document.getElementById('listaSchedePersonali');
  if (!lista) return;

  // Skeleton
  lista.innerHTML = Array(2).fill('<div class="scheda-card-skeleton skeleton" style="height:80px;border-radius:var(--raggio-xl)"></div>').join('');

  schedeUtente = await ottieniSchede(_uid);
  renderListaSchede(schedeUtente);

  // Carica community in background
  ottieniSchedePubbliche().then(renderSchedeCommunity);
}

/**
 * @description Renderizza la lista delle schede personali dell'utente.
 * @param {Array} schede - Lista schede Firestore
 */
function renderListaSchede(schede) {
  const lista = document.getElementById('listaSchedePersonali');
  if (!lista) return;

  if (!schede.length) {
    lista.innerHTML = `
      <div class="stato-vuoto">
        <i data-lucide="clipboard-list" aria-hidden="true"></i>
        <p>Non hai ancora nessuna scheda.<br>Creane una!</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  lista.innerHTML = schede.map(s => creaHtmlCardScheda(s)).join('');
  lista.querySelectorAll('.scheda-card-inner').forEach(card => {
    inizializzaSwipeCard(card);
  });
  collegaAzioniCard(lista);
  lucide.createIcons();
}

/**
 * @description Genera l'HTML di una card scheda.
 * @param {Object} scheda - Dati scheda Firestore
 * @returns {string} HTML della card
 */
function creaHtmlCardScheda(scheda) {
  const nEsercizi  = scheda.esercizi?.length || 0;
  const ultimoUso  = scheda.ultimoUtilizzo?.toDate?.();
  const dataStr    = ultimoUso
    ? ultimoUso.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
    : 'Mai usata';

  return `
    <div class="scheda-card-wrapper" data-scheda-id="${scheda.id}">
      <div class="scheda-card-azioni" aria-hidden="true">
        <button class="btn-azione btn-azione--modifica" data-azione="modifica" aria-label="Modifica scheda ${scheda.nome}">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn-azione btn-azione--duplica" data-azione="duplica" aria-label="Duplica scheda ${scheda.nome}">
          <i data-lucide="copy"></i>
        </button>
        <button class="btn-azione btn-azione--elimina" data-azione="elimina" aria-label="Elimina scheda ${scheda.nome}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="scheda-card-inner">
        <div class="scheda-card-info">
          <span class="scheda-nome">${scheda.nome}</span>
          <span class="scheda-meta">${nEsercizi} esercizi · ${dataStr}</span>
        </div>
        <i data-lucide="chevron-right" class="scheda-freccia" aria-hidden="true"></i>
      </div>
    </div>`;
}

/**
 * @description Collega i pulsanti azione (modifica, duplica, elimina) alle card.
 * @param {HTMLElement} contenitore - Elemento contenitore della lista
 */
function collegaAzioniCard(contenitore) {
  contenitore.querySelectorAll('[data-azione]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wrapper  = btn.closest('[data-scheda-id]');
      const schedaId = wrapper?.dataset.schedaId;
      const azione   = btn.dataset.azione;
      if (!schedaId || !azione) return;
      await gestisciAzioneCard(azione, schedaId);
    });
  });

  // Tap sulla card per modificarla
  contenitore.querySelectorAll('.scheda-card-inner').forEach(card => {
    card.addEventListener('click', () => {
      const wrapper  = card.closest('[data-scheda-id]');
      const schedaId = wrapper?.dataset.schedaId;
      if (schedaId && !card.classList.contains('scheda-card--aperta')) {
        apriFormScheda(schedaId);
      }
    });
  });
}

/**
 * @description Esegue l'azione selezionata (modifica, duplica, elimina) su una scheda.
 * @param {string} azione   - Tipo azione: 'modifica' | 'duplica' | 'elimina'
 * @param {string} schedaId - ID scheda target
 * @returns {Promise<void>}
 */
async function gestisciAzioneCard(azione, schedaId) {
  if (azione === 'modifica') {
    apriFormScheda(schedaId);
  } else if (azione === 'duplica') {
    await duplicaScheda(_uid, schedaId);
    await caricaEMostraSchede();
  } else if (azione === 'elimina') {
    if (!confirm('Vuoi eliminare questa scheda? L\'azione è irreversibile.')) return;
    await eliminaScheda(_uid, schedaId);
    schedeUtente = schedeUtente.filter(s => s.id !== schedaId);
    renderListaSchede(schedeUtente);
  }
}

/**
 * @description Renderizza le schede pubbliche della community.
 * @param {Array} schede - Lista schede community
 */
function renderSchedeCommunity(schede) {
  const lista = document.getElementById('listaSchedeCommunity');
  if (!lista) return;

  if (!schede.length) {
    lista.innerHTML = '<p class="testo-tenue">Nessuna scheda pubblica ancora.</p>';
    return;
  }

  lista.innerHTML = schede.map(s => `
    <div class="scheda-card-wrapper scheda-card--community">
      <div class="scheda-card-inner">
        <div class="scheda-card-info">
          <span class="scheda-nome">${s.nome}</span>
          <span class="scheda-meta">${s.esercizi?.length || 0} esercizi</span>
        </div>
        <span class="badge-community">Community</span>
      </div>
    </div>`).join('');
}

// ========================================
// SWIPE GESTURE SU CARD
// ========================================

/**
 * @description Inizializza il gesto swipe-sinistra su una card scheda
 *              per rivelare i pulsanti azione (modifica, duplica, elimina).
 * @param {HTMLElement} card - Elemento .scheda-card-inner
 */
function inizializzaSwipeCard(card) {
  let inizioX  = 0;
  let deltaX   = 0;
  let inGesto  = false;
  const SOGLIA = 60;
  const MAX    = 120;

  card.addEventListener('pointerdown', (e) => {
    inizioX = e.clientX;
    inGesto = true;
    deltaX  = 0;
    card.setPointerCapture(e.pointerId);
    // Chiudi tutte le altre card aperte
    document.querySelectorAll('.scheda-card--aperta').forEach(altra => {
      if (altra !== card) chiudiSwipeCard(altra);
    });
  });

  card.addEventListener('pointermove', (e) => {
    if (!inGesto) return;
    deltaX = e.clientX - inizioX;
    if (deltaX < 0) {
      const trasla = Math.max(deltaX, -MAX);
      card.style.transform = `translateX(${trasla}px)`;
      card.style.transition = 'none';
    }
  });

  card.addEventListener('pointerup', () => {
    inGesto = false;
    card.style.transition = '';
    if (deltaX < -SOGLIA) {
      card.style.transform = `translateX(-${MAX}px)`;
      card.classList.add('scheda-card--aperta');
    } else {
      chiudiSwipeCard(card);
    }
    deltaX = 0;
  });
}

/**
 * @description Chiude lo stato swipe di una card riportandola alla posizione originale.
 * @param {HTMLElement} card - Elemento .scheda-card-inner da chiudere
 */
function chiudiSwipeCard(card) {
  card.style.transform = '';
  card.classList.remove('scheda-card--aperta');
}

// ========================================
// NAVIGAZIONE PANNELLI
// ========================================

/**
 * @description Apre il form di creazione/modifica scheda.
 * @param {string|null} schedaId - ID scheda da modificare, null per nuova
 */
function apriFormScheda(schedaId) {
  schedaInModifica = schedaId;

  const scheda = schedaId ? schedeUtente.find(s => s.id === schedaId) : null;
  eserciziForm  = scheda ? JSON.parse(JSON.stringify(scheda.esercizi || [])) : [];

  // Titolo form
  const titolo = document.getElementById('titoloFormScheda');
  if (titolo) titolo.textContent = scheda ? `Modifica: ${scheda.nome}` : 'Nuova Scheda';

  // Nome scheda
  const inputNome = document.getElementById('inputNomeScheda');
  if (inputNome) inputNome.value = scheda?.nome || '';

  // Pubblica
  const checkPubblica = document.getElementById('checkSchedaPubblica');
  if (checkPubblica) checkPubblica.checked = scheda?.pubblica || false;

  renderEserciziForm();
  aggiornaDurataStimata();

  // Mostra pannello form, nascondi lista
  document.getElementById('schedePanelLista').hidden = true;
  document.getElementById('schedePanelForm').hidden  = false;
  lucide.createIcons();
}

/**
 * @description Torna alla lista schede dal form di modifica.
 */
function tornaAllaLista() {
  document.getElementById('schedePanelForm').hidden  = true;
  document.getElementById('schedePanelLista').hidden = false;
  schedaInModifica = null;
  eserciziForm     = [];
}

// ========================================
// FORM SCHEDA — ESERCIZI
// ========================================

/**
 * @description Renderizza la lista degli esercizi nel form scheda.
 */
function renderEserciziForm() {
  const lista = document.getElementById('listaEserciziScheda');
  if (!lista) return;

  if (!eserciziForm.length) {
    lista.innerHTML = '<p class="testo-tenue" id="msgNessunoEsercizio">Nessun esercizio aggiunto.</p>';
    return;
  }

  lista.innerHTML = eserciziForm.map((es, idx) => creaHtmlEsercizioForm(es, idx)).join('');
  lista.querySelectorAll('[data-idx]').forEach(card => {
    collegaEventListenerEsercizioForm(card);
  });
  lucide.createIcons();
}

/**
 * @description Genera l'HTML di un esercizio nel form scheda.
 * @param {Object} esercizio - Dati esercizio
 * @param {number} idx       - Indice nell'array eserciziForm
 * @returns {string} HTML esercizio form
 */
function creaHtmlEsercizioForm(esercizio, idx) {
  const gifHtml = esercizio.gifUrl
    ? `<img src="${esercizio.gifUrl}" alt="${esercizio.nome}" class="es-gif" loading="lazy" width="56" height="56">`
    : `<div class="es-gif-placeholder"><i data-lucide="dumbbell" aria-hidden="true"></i></div>`;

  return `
    <div class="es-form-card" data-idx="${idx}">
      <div class="es-form-top">
        ${gifHtml}
        <div class="es-form-info">
          <span class="es-nome">${esercizio.nome}</span>
          <span class="es-muscolo">${esercizio.gruppoMuscolare || '—'}</span>
        </div>
        <button type="button" class="btn-rimuovi-es" data-azione="rimuovi" aria-label="Rimuovi ${esercizio.nome}">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <div class="es-form-campi">
        <div class="es-campo">
          <label>Serie</label>
          <input type="number" class="input-es" data-campo="serie" value="${esercizio.serie || 3}" min="1" max="20">
        </div>
        <div class="es-campo">
          <label>Reps</label>
          <input type="number" class="input-es" data-campo="ripetizioni" value="${esercizio.ripetizioni || 10}" min="1" max="100">
        </div>
        <div class="es-campo">
          <label>Peso (kg)</label>
          <input type="number" class="input-es" data-campo="pesoSuggerito" value="${esercizio.pesoSuggerito || ''}" min="0" step="0.5" placeholder="—">
        </div>
        <div class="es-campo">
          <label>Rec. (s)</label>
          <input type="number" class="input-es" data-campo="recuperoSecondi" value="${esercizio.recuperoSecondi || 90}" min="0" max="600">
        </div>
      </div>

      <div class="es-form-extra">
        <label class="toggle-superset">
          <input type="checkbox" data-campo="superset" ${esercizio.superset ? 'checked' : ''}>
          <span>Superset con il prossimo</span>
        </label>
        <input type="text" class="input-note" data-campo="noteEsercizio"
               value="${esercizio.noteEsercizio || ''}" placeholder="Note (opzionale)">
      </div>

      <div class="es-form-ordine">
        <button type="button" data-azione="su"  aria-label="Sposta su"  ${idx === 0 ? 'disabled' : ''}>
          <i data-lucide="chevron-up" aria-hidden="true"></i>
        </button>
        <button type="button" data-azione="giu" aria-label="Sposta giù" ${idx === eserciziForm.length - 1 ? 'disabled' : ''}>
          <i data-lucide="chevron-down" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}

/**
 * @description Collega gli event listener a una card esercizio nel form.
 * @param {HTMLElement} card - Elemento .es-form-card
 */
function collegaEventListenerEsercizioForm(card) {
  const idx = parseInt(card.dataset.idx);

  // Rimuovi esercizio
  card.querySelector('[data-azione="rimuovi"]')?.addEventListener('click', () => {
    eserciziForm.splice(idx, 1);
    renderEserciziForm();
    aggiornaDurataStimata();
  });

  // Sposta su
  card.querySelector('[data-azione="su"]')?.addEventListener('click', () => {
    if (idx === 0) return;
    [eserciziForm[idx - 1], eserciziForm[idx]] = [eserciziForm[idx], eserciziForm[idx - 1]];
    renderEserciziForm();
  });

  // Sposta giù
  card.querySelector('[data-azione="giu"]')?.addEventListener('click', () => {
    if (idx >= eserciziForm.length - 1) return;
    [eserciziForm[idx + 1], eserciziForm[idx]] = [eserciziForm[idx], eserciziForm[idx + 1]];
    renderEserciziForm();
  });

  // Aggiorna campi numerici e testo
  card.querySelectorAll('[data-campo]').forEach(input => {
    input.addEventListener('change', () => {
      const campo = input.dataset.campo;
      const valore = input.type === 'checkbox' ? input.checked
                   : input.type === 'number'   ? (parseFloat(input.value) || 0)
                   : input.value;
      eserciziForm[idx][campo] = valore;
      if (['serie', 'ripetizioni', 'recuperoSecondi'].includes(campo)) aggiornaDurataStimata();
    });
  });
}

/**
 * @description Calcola e aggiorna la durata stimata della scheda.
 *              Formula: somma per esercizio di (serie × reps × SECONDI_PER_REP + serie × recupero)
 */
function aggiornaDurataStimata() {
  const el = document.getElementById('durataStimata');
  if (!el) return;
  if (!eserciziForm.length) { el.textContent = 'Durata stimata: —'; return; }

  const totaleSecondi = eserciziForm.reduce((acc, es) => {
    const serie    = es.serie         || 3;
    const reps     = es.ripetizioni   || 10;
    const recupero = es.recuperoSecondi ?? 90;
    return acc + (serie * reps * SECONDI_PER_REP) + (serie * recupero);
  }, 0);

  const minuti = Math.round(totaleSecondi / 60);
  el.textContent = `Durata stimata: ~${minuti} min`;
}

// ========================================
// SALVATAGGIO SCHEDA
// ========================================

/**
 * @description Gestisce il submit del form scheda: valida, costruisce l'oggetto
 *              e lo salva su Firestore. Torna alla lista al completamento.
 * @returns {Promise<void>}
 */
async function submitFormScheda() {
  const nome = document.getElementById('inputNomeScheda')?.value.trim();
  if (!nome) {
    alert('Inserisci un nome per la scheda.');
    return;
  }

  const btnSalva = document.getElementById('btnSalvaScheda');
  if (btnSalva) { btnSalva.disabled = true; btnSalva.textContent = 'Salvataggio...'; }

  try {
    const datiScheda = {
      nome,
      pubblica: document.getElementById('checkSchedaPubblica')?.checked || false,
      esercizi: eserciziForm,
    };
    await salvaScheda(_uid, datiScheda, schedaInModifica);
    tornaAllaLista();
    await caricaEMostraSchede();
  } catch (errore) {
    console.error('Errore salvataggio scheda:', errore);
    alert('Errore durante il salvataggio. Riprova.');
  } finally {
    if (btnSalva) { btnSalva.disabled = false; btnSalva.textContent = 'Salva Scheda'; }
  }
}

// ========================================
// RICERCA ESERCIZI — BOTTOM SHEET
// ========================================

/**
 * @description Apre il bottom sheet per la ricerca esercizi.
 */
function apriRicercaEsercizi() {
  const sheet  = document.getElementById('ricercaEserciziSheet');
  const overlay = document.getElementById('overlayApp');
  if (!sheet || !overlay) return;
  sheet.hidden   = false;
  overlay.hidden = false;
  document.getElementById('inputRicercaEsercizio')?.focus();
  document.getElementById('risultatiRicerca').innerHTML = '';
  document.getElementById('formEsercizioPersonalizzato').hidden = true;
  lucide.createIcons();
}

/**
 * @description Chiude il bottom sheet della ricerca esercizi.
 */
function chiudiRicercaEsercizi() {
  document.getElementById('ricercaEserciziSheet').hidden = true;
  document.getElementById('overlayApp').hidden           = true;
  const input = document.getElementById('inputRicercaEsercizio');
  if (input) input.value = '';
}

/**
 * @description Cerca esercizi nel dataset locale e aggiorna i risultati nella UI.
 *              La ricerca è sincrona — nessun loading indicator necessario.
 * @param {string} termine - Testo di ricerca
 */
function eseguiRicercaEsercizi(termine) {
  const contenitore = document.getElementById('risultatiRicerca');
  if (!contenitore) return;

  if (!termine || termine.trim().length < 2) {
    contenitore.innerHTML = '';
    return;
  }

  const risultati = cercaEsercizi(termine);

  if (!risultati.length) {
    contenitore.innerHTML = `
      <div class="stato-vuoto stato-vuoto--piccolo">
        <p>Nessun risultato per "${termine}"</p>
      </div>`;
    return;
  }

  contenitore.innerHTML = risultati.map(r => `
    <button type="button" class="risultato-ricerca" data-id="${r.id}" data-nome="${r.nome}" data-muscolo="${r.gruppoMuscolare}">
      ${r.thumbnail
        ? `<img src="${r.thumbnail}" alt="" class="risultato-thumb" width="40" height="40" loading="lazy">`
        : `<div class="risultato-thumb-placeholder"><i data-lucide="dumbbell" aria-hidden="true"></i></div>`}
      <div class="risultato-info">
        <span class="risultato-nome">${r.nome}</span>
        <span class="risultato-muscolo">${r.gruppoMuscolare}</span>
      </div>
      <i data-lucide="plus-circle" aria-hidden="true"></i>
    </button>`).join('');

  contenitore.querySelectorAll('.risultato-ricerca').forEach(btn => {
    btn.addEventListener('click', () => aggiungiEsercizioAlForm({
      id:              `wger-${btn.dataset.id}`,
      nome:            btn.dataset.nome,
      idWger:          parseInt(btn.dataset.id) || null,
      gruppoMuscolare: btn.dataset.muscolo,
      gifUrl:          null,
    }, btn.dataset.id));
  });
  lucide.createIcons();
}

/**
 * @description Aggiunge un esercizio alla lista del form e carica la sua immagine.
 * @param {Object}      esercizio - Dati base dell'esercizio
 * @param {string|null} wgerId    - ID Wger per caricare l'immagine
 * @returns {Promise<void>}
 */
async function aggiungiEsercizioAlForm(esercizio, wgerId = null) {
  eserciziForm.push({
    ...esercizio,
    serie:           3,
    ripetizioni:     10,
    pesoSuggerito:   null,
    recuperoSecondi: RECUPERO_DEFAULT,
    superset:        false,
    noteEsercizio:   '',
  });
  renderEserciziForm();
  aggiornaDurataStimata();
  chiudiRicercaEsercizi();

  // Carica immagine in background
  if (wgerId) {
    const gifUrl = await ottieniImmagineEsercizio(parseInt(wgerId));
    if (gifUrl) {
      const idx = eserciziForm.findIndex(e => e.id === esercizio.id);
      if (idx !== -1) {
        eserciziForm[idx].gifUrl = gifUrl;
        const img = document.querySelector(`[data-idx="${idx}"] .es-gif`);
        if (img) img.src = gifUrl;
        const placeholder = document.querySelector(`[data-idx="${idx}"] .es-gif-placeholder`);
        if (placeholder) {
          placeholder.outerHTML = `<img src="${gifUrl}" alt="${esercizio.nome}" class="es-gif" loading="lazy" width="56" height="56">`;
        }
      }
    }
  }
}

// ========================================
// ESERCIZIO PERSONALIZZATO
// ========================================

/**
 * @description Mostra il form per aggiungere un esercizio personalizzato.
 */
function apriFormEsercizioPersonalizzato() {
  const form = document.getElementById('formEsercizioPersonalizzato');
  if (form) form.hidden = false;
}

/**
 * @description Nasconde il form esercizio personalizzato senza salvare.
 */
function chiudiFormEsercizioPersonalizzato() {
  const form = document.getElementById('formEsercizioPersonalizzato');
  if (form) { form.hidden = true; form.reset(); }
}

/**
 * @description Salva un esercizio personalizzato su Firestore e lo aggiunge al form.
 * @returns {Promise<void>}
 */
async function submitEsercizioPersonalizzato() {
  const nome    = document.getElementById('inputNomePersonalizzato')?.value.trim();
  const muscolo = document.getElementById('inputMuscoloPersonalizzato')?.value.trim() || '—';
  const gifUrl  = document.getElementById('inputGifPersonalizzato')?.value.trim() || null;

  if (!nome) { alert('Inserisci il nome dell\'esercizio.'); return; }

  const id = await salvaEsercizioPersonalizzato(_uid, { nome, gruppoMuscolare: muscolo, gifUrl });
  aggiungiEsercizioAlForm({ id, nome, idWger: null, gruppoMuscolare: muscolo, gifUrl });
  chiudiFormEsercizioPersonalizzato();
}
