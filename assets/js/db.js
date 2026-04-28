/**
 * @description Tutte le funzioni di lettura/scrittura Firestore per SetGo.
 * @module db
 */

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, collectionGroup, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ========================================
// SCHEDE
// ========================================

/**
 * @description Recupera tutte le schede dell'utente ordinate per ultimo utilizzo.
 * @param {string} uid - UID dell'utente
 * @returns {Promise<Array>} Lista schede
 */
export async function ottieniSchede(uid) {
  const ref  = collection(db, 'utenti', uid, 'schede');
  const q    = query(ref, orderBy('creatoIl', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * @description Salva una scheda (crea se schedaId è null, aggiorna altrimenti).
 * @param {string}      uid        - UID dell'utente
 * @param {Object}      datiScheda - Dati della scheda da salvare
 * @param {string|null} schedaId   - ID scheda da aggiornare, null per crearne una nuova
 * @returns {Promise<string>} ID della scheda salvata
 */
export async function salvaScheda(uid, datiScheda, schedaId = null) {
  const ref = collection(db, 'utenti', uid, 'schede');
  if (schedaId) {
    await setDoc(doc(ref, schedaId), { ...datiScheda, ultimoUtilizzo: serverTimestamp() }, { merge: true });
    return schedaId;
  }
  const nuovo = await addDoc(ref, {
    ...datiScheda,
    creatoIl:      serverTimestamp(),
    ultimoUtilizzo: serverTimestamp()
  });
  return nuovo.id;
}

/**
 * @description Elimina una scheda dell'utente da Firestore.
 * @param {string} uid      - UID dell'utente
 * @param {string} schedaId - ID della scheda da eliminare
 * @returns {Promise<void>}
 */
export async function eliminaScheda(uid, schedaId) {
  await deleteDoc(doc(db, 'utenti', uid, 'schede', schedaId));
}

/**
 * @description Duplica una scheda esistente aggiungendo "— Copia" al nome.
 * @param {string} uid      - UID dell'utente
 * @param {string} schedaId - ID della scheda da duplicare
 * @returns {Promise<string>} ID della nuova scheda
 */
export async function duplicaScheda(uid, schedaId) {
  const snap = await getDoc(doc(db, 'utenti', uid, 'schede', schedaId));
  if (!snap.exists()) throw new Error('Scheda non trovata');
  const dati = snap.data();
  return await salvaScheda(uid, { ...dati, nome: `${dati.nome} — Copia`, pubblica: false });
}

/**
 * @description Recupera le schede pubbliche di tutti gli utenti (community).
 *              Richiede regola Firestore collectionGroup.
 * @returns {Promise<Array>} Lista schede pubbliche
 */
export async function ottieniSchedePubbliche() {
  try {
    const q    = query(collectionGroup(db, 'schede'), where('pubblica', '==', true), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ========================================
// ESERCIZI PERSONALIZZATI
// ========================================

/**
 * @description Salva un esercizio personalizzato dell'utente su Firestore.
 * @param {string} uid            - UID dell'utente
 * @param {Object} datiEsercizio  - Dati dell'esercizio personalizzato
 * @returns {Promise<string>} ID dell'esercizio creato
 */
export async function salvaEsercizioPersonalizzato(uid, datiEsercizio) {
  const ref   = collection(db, 'utenti', uid, 'eserciziPersonalizzati');
  const nuovo = await addDoc(ref, { ...datiEsercizio, creatoIl: serverTimestamp() });
  return nuovo.id;
}

/**
 * @description Recupera tutti gli esercizi personalizzati dell'utente.
 * @param {string} uid - UID dell'utente
 * @returns {Promise<Array>} Lista esercizi personalizzati
 */
export async function ottieniEserciziPersonalizzati(uid) {
  const ref  = collection(db, 'utenti', uid, 'eserciziPersonalizzati');
  const snap = await getDocs(query(ref, orderBy('creatoIl', 'desc')));
  return snap.docs.map(d => ({ id: d.id, idWger: null, ...d.data() }));
}
