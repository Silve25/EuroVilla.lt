/******************************************************
 * Eurovilla.lt — Frontend app.js (v4)
 * - Anti-doublon (email/tel) via backend
 * - Points live (polling snapshot)
 * - Parrainage: resolve ?r= (publicId) -> userId
 * - Journal de clics / partage avec nonce
 ******************************************************/

/** ================== CONFIG ================== **/
const API = {
  BASE: "https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID/exec", // <-- À remplacer
  DRAW_ISO: "2025-10-31T23:59:59Z",
  POLL_MS: 5000
};

const DOM = {
  countdown: {
    d: () => document.getElementById("d"),
    h: () => document.getElementById("h"),
    m: () => document.getElementById("m"),
    s: () => document.getElementById("s"),
  },
  counterLeft: () => document.getElementById("counter-left"),
  form: () => document.getElementById("signup-form"),
  success: () => document.getElementById("signup-success"),
  error: () => document.getElementById("signup-error"),
  score: () => document.getElementById("score-points"),
  progressBar: () => document.getElementById("progress-bar"),
  progressLabel: () => document.getElementById("progress-label"),
  refLink: () => document.getElementById("ref-link"),
  toggleTheme: () => document.getElementById("toggle-theme"),
};

/** ================== UTIL ================== **/
const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function getParams() {
  const out = {};
  const q = location.search.slice(1).split("&").filter(Boolean);
  q.forEach(kv=>{
    const [k,v=""] = kv.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g," "));
  });
  return out;
}

function b64urlDecode(str=""){
  try{
    // web-safe: -_ au lieu de +/
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(s)));
  }catch(_){ return ""; }
}

function uuid(){
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function hashString(s){
  let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;}
  return Math.abs(h).toString(36);
}

function deviceFingerprint(){
  const localId = localStorage.getItem("ev_localId") || (function(){
    const v = "l_" + uuid();
    localStorage.setItem("ev_localId", v);
    return v;
  })();

  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width + "x" + screen.height,
    String(Intl.DateTimeFormat().resolvedOptions().timeZone||""),
    localId
  ].join("|");
  return hashString(parts);
}

function setHidden(id, val){ const el=document.getElementById(id); if(el) el.value = val||""; }

/** ================== STORAGE ================== **/
const store = {
  getUser(){ try{ return JSON.parse(localStorage.getItem("ev_user")||"null"); }catch(_){ return null; } },
  setUser(u){ localStorage.setItem("ev_user", JSON.stringify(u||null)); },
  clearUser(){ localStorage.removeItem("ev_user"); }
};

/** ================== API helpers ================== **/
async function apiPost(body){
  const res = await fetch(API.BASE, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body||{})
  });
  return res.json();
}
async function apiGet(params){
  const url = API.BASE + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

/** ================== REF / CLICKS ================== **/
function parseRefChainFromParams(params){
  // Priorité: z (b64url "id1,id2,.."), sinon rc (csv), sinon ref (legacy userId)
  if (params.z){
    const csv = b64urlDecode(params.z);
    if (csv) return csv.split(",").map(s=>s.trim()).filter(Boolean);
  }
  if (params.rc){
    return String(params.rc).split(",").map(s=>s.trim()).filter(Boolean);
  }
  if (params.ref){
    return [String(params.ref).trim()];
  }
  return [];
}

async function resolveReferrerUserIdFromPublicId(pid){
  if (!pid) return "";
  try{
    const data = await apiGet({ action:"resolve", r: pid });
    return (data && data.ok && data.userId) ? data.userId : "";
  }catch(_){ return ""; }
}

async function logLandingClick(params, fp){
  const pageUrl = location.href;
  const userAgent = navigator.userAgent || "";
  const channel = params.c || ""; // canal s’il est passé
  const nonce   = params.sn || "";

  // refChain depuis z/rc/ref
  let chain = parseRefChainFromParams(params);

  // Si ?r= (publicId court), on ne connaît pas le userId -> le backend gère déjà,
  // mais on l’envoie quand même côté "pageUrl" pour traçabilité. (referrerId sera résolu côté serveur)
  await apiPost({
    action: "click",
    pageUrl,
    nonce,
    refChain: chain.join(","),
    fingerprint: fp,
    userAgent,
    ip: "",            // IP mieux captée côté serveur (headers)
  }).catch(()=>{});
}

/** ================== THEME ================== **/
function setupThemeToggle(){
  const btn = DOM.toggleTheme();
  if (!btn) return;
  const KEY="ev_theme";
  const root = document.documentElement;

  function apply(t){
    root.setAttribute("data-theme", t);
    localStorage.setItem(KEY, t);
  }
  const saved = localStorage.getItem(KEY);
  if (saved){ apply(saved); }

  btn.addEventListener("click", ()=>{
    const cur = root.getAttribute("data-theme") || "dark";
    apply(cur==="dark" ? "light" : "dark");
  });
}

/** ================== COUNTDOWN & STATS ================== **/
function startCountdown(drawISO){
  const end = new Date(drawISO || API.DRAW_ISO).getTime();
  function tick(){
    const now = Date.now();
    let diff = Math.max(0, end - now);
    const d = Math.floor(diff/(24*3600e3)); diff -= d*24*3600e3;
    const h = Math.floor(diff/(3600e3));     diff -= h*3600e3;
    const m = Math.floor(diff/(60e3));       diff -= m*60e3;
    const s = Math.floor(diff/1000);
    if (DOM.countdown.d()) DOM.countdown.d().textContent = String(d);
    if (DOM.countdown.h()) DOM.countdown.h().textContent = String(h).padStart(2,"0");
    if (DOM.countdown.m()) DOM.countdown.m().textContent = String(m).padStart(2,"0");
    if (DOM.countdown.s()) DOM.countdown.s().textContent = String(s).padStart(2,"0");
  }
  tick();
  setInterval(tick, 1000);
}

async function loadStats(){
  try{
    const data = await apiGet({ action:"stats" });
    if (data && data.ok){
      if (DOM.counterLeft()) DOM.counterLeft().textContent = String(data.totalParticipants||0);
      startCountdown(data.drawISO || API.DRAW_ISO);
    } else {
      startCountdown(API.DRAW_ISO);
    }
  }catch(_){
    startCountdown(API.DRAW_ISO);
  }
}

/** ================== MODALS ================== **/
function setupModals(){
  qsa("[data-open]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-open");
      const m = document.getElementById(id);
      if (!m) return;
      m.hidden = false;
      m.setAttribute("aria-hidden","false");
    });
  });
  qsa("[data-action='close-modal'], .modal-backdrop").forEach(el=>{
    el.addEventListener("click", ()=>{
      const modal = el.closest(".modal");
      if(!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden","true");
      // Stopper la vidéo si c’est l’iframe 360
      const ifr = modal.querySelector("iframe");
      if (ifr){ ifr.src = ifr.src; }
    });
  });
}

/** ================== SHARE ================== **/
function buildReferralURL(publicId, opts={}){
  const base = location.origin + location.pathname; // URL “propre” de la page
  const u = new URL(base, location.href);
  if (publicId) u.searchParams.set("r", publicId);
  if (opts.channel) u.searchParams.set("c", opts.channel);
  if (opts.nonce)   u.searchParams.set("sn", opts.nonce);
  return u.toString();
}

async function shareStart(nonce, userId, channel){
  try{
    await apiPost({
      action:"share-start",
      nonce,
      userId,
      channel,
      pageUrl: location.href
    });
  }catch(_){}
}

function setupSharing(){
  const btnWA = qsa("[data-action='share-whatsapp']");
  const btnEM = qsa("[data-action='share-email']");
  const btnCopy = qsa("[data-action='copy-ref']");

  btnCopy.forEach(b=>{
    b.addEventListener("click", async ()=>{
      const el = DOM.refLink();
      if (!el) return;
      try{
        await navigator.clipboard.writeText(el.value);
        b.textContent = "Copié !";
        setTimeout(()=> b.textContent="Copier", 1200);
      }catch(_){}
    });
  });

  btnWA.forEach(b=>{
    b.addEventListener("click", async ()=>{
      const u = store.getUser();
      if (!u || !u.publicId) return alert("Inscris-toi d’abord pour obtenir ton lien !");
      const nonce = uuid();
      await shareStart(nonce, u.userId, "wa");
      const url = buildReferralURL(u.publicId, { channel:"wa", nonce });
      const text = `Je participe au tirage Eurovilla (villa à Mougins) 🎟️ Viens tenter ta chance : ${url}`;
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
    });
  });

  btnEM.forEach(b=>{
    b.addEventListener("click", async ()=>{
      const u = store.getUser();
      if (!u || !u.publicId) return alert("Inscris-toi d’abord pour obtenir ton lien !");
      const nonce = uuid();
      await shareStart(nonce, u.userId, "em");
      const url = buildReferralURL(u.publicId, { channel:"em", nonce });
      const subject = "Eurovilla — je tente ma chance 🎟️";
      const body = `Hello,\n\nJe participe au tirage Eurovilla (villa à Mougins). Inscris-toi ici : ${url}\n\nBonne chance !`;
      location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  });
}

/** ================== PROGRESSION POINTS ================== **/
function updatePointsUI(points){
  const p = Number(points||0);
  if (DOM.score()) DOM.score().textContent = String(p);

  const steps = [0,5,15,30,50];
  const max = steps[steps.length-1];
  const clamped = Math.max(0, Math.min(p, max));

  // Trouver la tranche
  let i=0; while (i<steps.length-1 && clamped>steps[i+1]) i++;
  const a = steps[i], b = steps[Math.min(i+1, steps.length-1)];
  const pct = (clamped<=a) ? (a/max*100) :
              (clamped>=b) ? (b/max*100) :
              ((a + (clamped-a)*(1/(b-a))*(b-a)) / max * 100);

  if (DOM.progressBar())  DOM.progressBar().style.width = `${(clamped/max*100).toFixed(0)}%`;
  if (DOM.progressLabel())DOM.progressLabel().textContent = `${Math.round((clamped/max)*100)}%`;
}

/** ================== SIGNUP ================== **/
function getContactsSelection(){
  return qsa("input[name='contact']:checked").map(i=>i.value).join(",");
}

async function onSubmitSignup(e){
  e.preventDefault();
  const f = DOM.form();
  if (!f) return;

  // validations HTML5
  if (!f.reportValidity()) return;

  // champs
  const firstName = f.firstName.value.trim();
  const lastName  = f.lastName.value.trim();
  const email     = f.email.value.trim();
  const phone     = f.phone.value.trim();
  const country   = f.country.value.trim();
  const contactAll= getContactsSelection();
  const accept    = qs("#acceptRules").checked;

  if (!accept){
    alert("Merci d’accepter le règlement & la confidentialité.");
    return;
  }

  // referrer / chain (déjà préparés au load)
  const referrerId = f.referrerId.value || "";
  const refChain   = (f.dataset.refChain ? f.dataset.refChain.split(",").filter(Boolean) : []);

  // empreinte + contexte
  const fingerprint= f.fingerprint.value || deviceFingerprint();
  const campaign   = f.campaign.value || "display_q4_2025";
  const userAgent  = navigator.userAgent || "";

  // UX
  DOM.success().hidden = true;
  DOM.error().hidden = true;
  const submitBtn = f.querySelector("button[type='submit']");
  const oldLabel = submitBtn.textContent;
  submitBtn.disabled = true; submitBtn.textContent = "Validation…";

  try{
    const payload = {
      action: "register",
      firstName, lastName, email, phone, country,
      contactAll,
      referrerId,
      refChain,
      fingerprint,
      campaign,
      acqChannel: "", // (optionnel) si tu veux pousser un canal d’acq
      userAgent,
      ip: "",         // IP côté serveur
      source: "web"
    };

    const data = await apiPost(payload);

    if (!data || data.ok !== true){
      throw new Error((data && data.code) || "SERVER_ERROR");
    }

    // Les deux cas "REGISTERED" ou "ALREADY_REGISTERED" sont des réussites
    if (data.code === "REGISTERED" || data.code === "ALREADY_REGISTERED"){
      const user = {
        userId: data.userId,
        publicId: data.publicId || "",
        points: Number(data.points||0)
      };
      store.setUser(user);
      afterLoginOrSignup(user, {showCongrats: data.code==="REGISTERED"});
      return;
    }

    throw new Error(data.code || "UNKNOWN");
  }catch(err){
    DOM.error().hidden = false;
    console.error("Signup error:", err);
  }finally{
    submitBtn.disabled = false; submitBtn.textContent = oldLabel;
  }
}

function afterLoginOrSignup(user, {showCongrats=false}={}){
  // Afficher succès
  DOM.success().hidden = false;

  // Mettre à jour lien de parrainage
  const url = buildReferralURL(user.publicId);
  if (DOM.refLink()) DOM.refLink().value = url;

  // Points init
  updatePointsUI(user.points||0);

  // Lancer le polling
  startUserPolling(user.userId);

  // Ouvrir modale si inscription fraîche
  if (showCongrats){
    const modal = document.getElementById("congrats-modal");
    if (modal){ modal.hidden = false; modal.setAttribute("aria-hidden","false"); }
  }
}

let pollTimer = null;
async function pollUserOnce(userId){
  try{
    const data = await apiGet({ action:"user", userId });
    if (data && data.ok){
      // on maintient le store pour garder points/publicId à jour
      const prev = store.getUser() || {};
      const fresh = { userId: data.userId, publicId: data.publicId||prev.publicId||"", points: Number(data.points||0) };
      store.setUser(fresh);
      updatePointsUI(fresh.points);
      // rafraîchir ref-link si besoin
      if (fresh.publicId && DOM.refLink() && !DOM.refLink().value.includes(fresh.publicId)){
        DOM.refLink().value = buildReferralURL(fresh.publicId);
      }
    }
  }catch(e){
    console.warn("Polling error:", e);
  }
}
function startUserPolling(userId){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(()=> pollUserOnce(userId), API.POLL_MS);
  // tick immédiat
  pollUserOnce(userId);
}

/** ================== INIT ================== **/
async function init(){
  setupThemeToggle();
  setupModals();
  setupSharing();

  // Préremplissage fingerprint
  setHidden("fingerprint", deviceFingerprint());

  // Préparer referrer et refChain
  const params = getParams();
  const fp = deviceFingerprint();

  // Journal de clic d’atterrissage (ne bloque pas)
  logLandingClick(params, fp);

  // Déduire refChain (illimité) depuis URL
  const refChain = parseRefChainFromParams(params);

  // Si ?r=publicId -> résoudre en userId pour le L1
  let referrerId = "";
  if (params.r){
    try{
      referrerId = await resolveReferrerUserIdFromPublicId(params.r);
    }catch(_){}
  }else if (refChain.length){
    // si rc/ref présent et qu’on veut forcer L1 = premier de la chaine
    referrerId = refChain[0] || "";
  }

  // stocker dans le formulaire
  setHidden("referrerId", referrerId);
  const form = DOM.form();
  if (form) form.dataset.refChain = refChain.join(",");

  // Stats + countdown
  loadStats();

  // Restore session utilisateur si déjà inscrit
  const u = store.getUser();
  if (u && u.userId){
    afterLoginOrSignup(u, {showCongrats:false});
  }

  // Soumission formulaire
  if (DOM.form()){
    DOM.form().addEventListener("submit", onSubmitSignup);
  }
}

// Démarrage
document.addEventListener("DOMContentLoaded", init);
