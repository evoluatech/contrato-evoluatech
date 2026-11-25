import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, getDocs, collection, query, orderBy, limit,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const COL_CONTRATOS = "contratos";
const COL_CONTADORES = "contadores";

/* ---------- Autenticação ---------- */
export const login = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
export const onUser = (cb) => onAuthStateChanged(auth, cb);

/* ---------- Numeração EVT-AAAA-NNNN (transação, sem repetição) ---------- */
export async function nextNumero() {
  const ano = new Date().getFullYear();
  const ref = doc(db, COL_CONTADORES, `contratos_${ano}`);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prox = (snap.exists() ? snap.data().ultimo : 0) + 1;
    tx.set(ref, { ultimo: prox, ano });
    return prox;
  });
  return `EVT-${ano}-${String(seq).padStart(4, "0")}`;
}

/* ---------- Contratos ---------- */
export async function saveContrato(numero, dados, status = "rascunho") {
  const ref = doc(db, COL_CONTRATOS, numero);
  const existente = await getDoc(ref);
  const registro = {
    numero,
    status,
    cliente: dados.k_nome?.trim() || "Sem cliente",
    projeto: dados.projeto_nome?.trim() || "",
    valorTotal: Number(dados.valor_total) || 0,
    dados,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.email ?? null
  };
  if (!existente.exists()) {
    registro.criadoEm = serverTimestamp();
    registro.criadoPor = auth.currentUser?.email ?? null;
  }
  await setDoc(ref, registro, { merge: true });
  return numero;
}

export async function listContratos(max = 50) {
  const q = query(collection(db, COL_CONTRATOS), orderBy("atualizadoEm", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function getContrato(numero) {
  const snap = await getDoc(doc(db, COL_CONTRATOS, numero));
  return snap.exists() ? snap.data() : null;
}
