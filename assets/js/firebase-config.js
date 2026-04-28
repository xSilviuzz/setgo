/**
 * @description Inizializzazione Firebase e esportazione dei servizi principali.
 *              Questo file è nel .gitignore — non viene mai caricato su GitHub.
 * @module firebase-config
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ========================================
// CONFIGURAZIONE — sostituisci con le tue chiavi se ricrei il progetto
// ========================================
const firebaseConfig = {
  apiKey:            "AIzaSyDxYwhMSlmsouvFnpRM4tfeiB6-Wexs2oU",
  authDomain:        "setgo-app-39ed9.firebaseapp.com",
  projectId:         "setgo-app-39ed9",
  storageBucket:     "setgo-app-39ed9.firebasestorage.app",
  messagingSenderId: "1027910520694",
  appId:             "1:1027910520694:web:dacf48e3727cfbdae63457"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
