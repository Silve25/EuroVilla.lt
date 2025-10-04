/* ==========================================================
   Eurovilla.lt — app.js (v5 final)
   - Anti-doublon : front + backend
   - Parrainage r/z/sn + resolve(r) côté backend
   - Lien perso basé sur publicId (propre & stable)
   - Polling points 5s + compteur participants
   - CTA bounce subtil, modales, thème
   ========================================================== */

/* ================== CONFIG ================== */
const API = {
  // ⚠️ Colle ici l’URL de ton dernier déploiement Apps Script WebApp:
  BASE: "https://script.google.com/macros/s/REPLACE_WITH_YOUR_WEBAPP_URL/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};
// date tirage (front, FOMO visuel) — côté API aussi (stats.drawISO)
const DRAW_DATE = new Date("2025-10-31T23:59:59Z");

// Polling / UI
const POLL_MS = 5000;
const POINTS_MAX_VISUAL = 50;

/* ================== Helpers génériques ================== */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

const pad2 = n => String(n).padStart(2,"0");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nowISO = () => new Date().toISOString();

function setLS(k, v){ try{ localStorage.setItem(k, typeof v==="string" ? v : JSON.stringify(v)); }catch{} }
function getLS(k, def=null){
  try{
    const raw = localStorage.getItem(k);
    if(raw==null) return def;
    if(raw.startsWith("{") || raw.startsWith("[")) return JSON.parse(raw);
    return raw;
  }catch{ return def; }
}
function delLS(k){ try{ localStorage.removeItem(k); }catch{} }

// mini ID local pour fallback
function localUid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }

// simple empreinte (indicatif)
function simpleFingerprint(){
  try{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const data = [navigator.userAgent, navigator.language, screen.width+"x"+screen.height, tz, window.devicePixelRatio||1].join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_" + Math.abs(h);
  }catch{ return "fp_unknown"; }
}

function getParam(name){ try{ return new URL(location.href).searchParams.get(name); }catch{ return null; }}

/* --------- network utils (GET/POST urlencoded sans CORS preflight) ---------- */
function toUrlParams(obj){
  const p = new URLSearchParams();
  Object.keys(obj||{}).forEach(k=>{
    const v = obj[k];
    if(v == null) return;
    if(Array.isArray(v)) v.forEach(x=> p.append(k, String(x)));
    else p.append(k, String(v));
  });
  return p;
}
async function fetchJSON(url, opts={}, retries=API.RETRIES){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
  try{
    const res = await fetch(url, { ...opts, signal: ctrl.signal, mode:"cors", redirect:"follow", credentials:"omit" });
    clearTimeout(t);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json().catch(()=> ({}));
  }catch(err){
    clearTimeout(t);
    if(retries>0){ await sleep(300*(API.RETRIES-retries+1)); return fetchJSON(url, opts, retries-1); }
    throw err;
  }
}
async function postForm(url, data, retries=API.RETRIES){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
  try{
    const res = await fetch(url, {
      method: "POST",
      body: toUrlParams(data),
      mode: "cors",
      redirect: "follow",
      signal: ctrl.signal,
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }
    });
    clearTimeout(t);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json().catch(()=> ({}));
  }catch(err){
    clearTimeout(t);
    if(retries>0){ await sleep(300*(API.RETRIES-retries+1)); return postForm(url, data, retries-1); }
    throw err;
  }
}

/* ================== Base64URL (pour z) ================== */
function b64urlEncode(str){
  try{
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }catch{ return ""; }
}
function b64urlDecode(str){
  try{
    const pad = str.length%4===2 ? "==" : str.length%4===3 ? "=" : "";
    const s = String(str||"").replace(/-/g,"+").replace(/_/g,"/") + pad;
    return decodeURIComponent(escape(atob(s)));
  }catch{ return ""; }
}
function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ const csv=b64urlDecode(z||""); return csv? csv.split(",").map(s=>s.trim()).filter(Boolean) : []; }

/* ================== Thème ================== */
(function themeInit(){
  const root = document.documentElement, btn = $("#toggle-theme");
  const saved = getLS("theme");
  if(saved==="light" || saved==="dark") root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", ()=>{
    const cur = root.getAttribute("data-theme")==="light" ? "dark" : "light";
    root.setAttribute("data-theme", cur);
    setLS("theme", cur);
  });
})();

/* ================== CTA bounce (subtil au clic) ================== */
(function wireBounce(){
  const bounce = (el)=>{
    if(!el) return;
    el.style.transition = el.style.transition ? el.style.transition : "transform 120ms cubic-bezier(.2,.8,.2,1)";
    el.addEventListener("click", ()=>{
      el.style.transform = "translateY(0) scale(0.98)";
      requestAnimationFrame(()=>{
        setTimeout(()=>{ el.style.transform = "translateY(-1px) scale(1.0)"; }, 85);
        setTimeout(()=>{ el.style.transform = ""; }, 180);
      });
    });
  };
  $$(".btn").forEach(bounce);
})();

/* ================== Countdown ================== */
(function countdown(){
  const d=$("#d"),h=$("#h"),m=$("#m"),s=$("#s");
  if(!d||!h||!m||!s) return;
  const tick=()=>{
    const diff = Math.max(0, DRAW_DATE - new Date());
    const D = Math.floor(diff/86400000);
    const H = Math.floor((diff/3600000)%24);
    const M = Math.floor((diff/60000)%60);
    const S = Math.floor((diff/1000)%60);
    d.textContent=D; h.textContent=pad2(H); m.textContent=pad2(M); s.textContent=pad2(S);
  };
  tick(); setInterval(tick,1000);
})();

/* ================== Modale 360 ================== */
(function modal360(){
  const modal=$("#modal-360");
  if(!modal) return;
  const openBtns=$$("[data-open='modal-360']");
  const closers=$$("[data-action='close-modal']");
  const open = ()=>{ modal.removeAttribute("hidden"); modal.setAttribute("aria-hidden","false"); };
  const close= ()=>{ modal.setAttribute("aria-hidden","true"); modal.setAttribute("hidden",""); };
  openBtns.forEach(b=> b.addEventListener("click", open));
  closers.forEach(c=> c.addEventListener("click", close));
  document.addEventListener("keydown", e=> e.key==="Escape" && close());
})();

/* ================== Toast rapide ================== */
function toast(msg){
  let t=$("#toast-hint");
  if(!t){
    t=document.createElement("div"); t.id="toast-hint";
    Object.assign(t.style,{position:"fixed",left:"50%",bottom:"24px",transform:"translateX(-50%)",
      background:"rgba(0,0,0,.78)",color:"#fff",padding:"10px 14px",borderRadius:"10px",zIndex:"9999",
      fontWeight:"700",backdropFilter:"blur(4px)",maxWidth:"92%",textAlign:"center"});
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; t.style.transition="none";
  setTimeout(()=>{ t.style.transition="opacity .45s"; t.style.opacity="0"; }, 1600);
}

/* ================== UI Points ================== */
function setPointsUI(n){
  const pts = Math.max(1, Number(n||1));
  setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct = Math.round(Math.min(100, pts/POINTS_MAX_VISUAL*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar) bar.style.width=pct+"%";
  if(lab) lab.textContent=pct+"%";
}
setPointsUI(getLS("points_ui", 1));

/* ================== Parrainage (r/z/sn) ================== */
function ownUserId(){ return getLS("userId",""); }
function ownPublicId(){ return getLS("publicId",""); }

// Belle origine
function prettyOrigin(){
  if(location.origin && /^https?:\/\//i.test(location.origin)) return location.origin;
  return "https://eurovilla.lt";
}

// Lien court basé sur **publicId** si connu (sinon fallback userId haché local)
function buildReferralURL(channel="cp"){
  const pid = ownPublicId();
  const uid = ownUserId();
  const chain = [];
  // si on a un userId local, on le place aussi dans la chaîne z (côté admin, audit multi-niveaux)
  if(uid) chain.push(uid);
  const z = chain.length ? chainTokenFromUpline(chain) : "";

  const base = new URL(prettyOrigin() + location.pathname);
  if(pid) base.searchParams.set("r", pid);
  if(z)   base.searchParams.set("z", z);
  if(channel) base.searchParams.set("c", channel);
  return base.toString();
}

/* À l’atterrissage : lecture r/z et log 1 seul click */
(function referralLanding(){
  const u = new URL(location.href);
  const r  = u.searchParams.get("r");       // publicId court
  const z  = u.searchParams.get("z");       // upline encodée
  const rc = u.searchParams.get("rc");      // compat
  const ref= u.searchParams.get("ref");     // compat

  let chain=[];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];

  if(chain.length) setLS("upline", chain);
  if(r) setLS("arrival_r", r);

  // Log 1 seul click par combi r+z
  const sig = (r||"") + "|" + (z||"") + "|" + (rc||"") + "|" + (ref||"");
  const key = "click_logged_"+sig;
  if(!getLS(key)){
    postForm(API.BASE, {
      action: "click",
      pageUrl: location.href,
      nonce: u.searchParams.get("sn") || "",
      fingerprint: simpleFingerprint(),
      userAgent: navigator.userAgent
    }).then(()=> setLS(key, 1)).catch(()=>{});
  }
})();

/* ================== Partages (WhatsApp / Email / Copie) ================== */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

  // lien court
  const url = new URL(buildReferralURL(channel));
  url.searchParams.set("sn", nonce);

  postForm(API.BASE, { action:"share-start", nonce, userId: uid||"", channel, pageUrl: location.href }).catch(()=>{});
  return { nonce, url: url.toString() };
}
async function pollAck(nonce, ms=6000){
  const start=Date.now();
  while(Date.now()-start<ms){
    try{
      const q=new URL(API.BASE); q.searchParams.set("action","share-ack"); q.searchParams.set("nonce",nonce);
      const r=await fetchJSON(q.toString(), {method:"GET"});
      if(r && r.ok && r.ack===true) return true;
    }catch{}
    await sleep(700);
  }
  return false;
}
async function shareWhatsApp(){
  const { nonce, url } = await shareStart("wa");
  const text = `Je participe à Eurovilla.lt pour gagner une villa d’exception ! Inscris-toi (ça me donne des points) : ${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if(navigator.share){
    try{ await navigator.share({ text, url }); pollAck(nonce).then(ok=> ok && toast("Lien WhatsApp ouvert ✅")); }
    catch{ window.open(wa,"_blank"); }
  }else{ window.open(wa,"_blank"); }
}
async function shareEmail(){
  const { nonce, url } = await shareStart("em");
  const subject="Rejoins-moi sur Eurovilla.lt (villa à gagner)";
  const body   =`Hello,\n\nJe participe à Eurovilla.lt pour gagner une villa d’exception.\nInscris-toi ici (ça me donne des points) : ${url}\n\nC’est gratuit et le tirage est supervisé.\n`;
  const mailto =`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  pollAck(nonce).then(ok=> ok && toast("Lien email ouvert ✅"));
}
async function copyReferral(){
  const { nonce, url } = await shareStart("cp");
  try{ await navigator.clipboard.writeText(url); toast("Lien copié 👍"); }
  catch{
    const input=$("#ref-link");
    if(input){ input.value=url; input.select(); document.execCommand("copy"); toast("Lien copié 👍"); }
  }
  pollAck(nonce).then(ok=> ok && toast("Premier clic détecté ✅"));
}

/* ================== Stats (participants) ================== */
async function refreshStats(){
  try{
    const u = new URL(API.BASE); u.searchParams.set("action","stats");
    const r = await fetchJSON(u.toString(), { method:"GET" });
    const c = $("#counter-left");
    if(c && r && r.ok && r.totalParticipants!=null){
      c.textContent = Number(r.totalParticipants).toLocaleString("fr-FR");
      if(r.drawISO){
        // Optionnel : on pourrait aussi mettre à jour la date tirage
      }
    }
  }catch{
    // laisse le placeholder "Chargement…" si échec
  }
}
setInterval(refreshStats, 30000); // rafraîchit toutes les 30s
refreshStats();

/* ================== Snapshot utilisateur (points + filleuls) ================== */
async function fetchUserSnapshot(userId){
  try{
    const u=new URL(API.BASE);
    u.searchParams.set("action","user");
    u.searchParams.set("userId", userId);
    return await fetchJSON(u.toString(), { method:"GET" });
  }catch{ return null; }
}
function updateUserUI(snapshot){
  if(!snapshot || !snapshot.ok) return;
  if(snapshot.points != null) setPointsUI(Number(snapshot.points));
  const l1=$("#me-referrals-l1"); if(l1) l1.textContent = snapshot.referralsL1 ?? 0;
  const l2=$("#me-referrals-l2"); if(l2) l2.textContent = snapshot.referralsL2 ?? 0;
  const list=$("#me-referrals-list");
  if(list && Array.isArray(snapshot.latestReferrals)){
    list.innerHTML = snapshot.latestReferrals.map(r=>{
      const name = r.firstName ? (r.firstName + (r.lastInitial? " "+r.lastInitial+"." : "")) : "Inscrit";
      const emailMasked = r.emailMasked || "";
      return `<li>${name} <small>${emailMasked}</small></li>`;
    }).join("") || `<li><em>Pas encore de filleuls</em></li>`;
  }
}
let pollTimer=null;
function startUserPolling(){
  const uid = ownUserId();
  if(!uid) return;
  const run = async ()=> updateUserUI(await fetchUserSnapshot(uid));
  clearInterval(pollTimer);
  run();
  pollTimer = setInterval(run, POLL_MS);
  document.addEventListener("visibilitychange", ()=> document.visibilityState==="visible" && run());
  window.addEventListener("focus", run);
}

/* ================== Persistance formulaire ================== */
function persistFormFields(){
  const ids = ["firstName","lastName","email","phone","country"];
  ids.forEach(id=>{
    const el = $("#"+id);
    if(!el) return;
    const saved = getLS("form_"+id);
    if(saved!=null) el.value = saved;
    const evt = el.tagName==="SELECT" ? "change" : "input";
    el.addEventListener(evt, ()=> setLS("form_"+id, el.value));
  });

  // checkboxes contact
  const boxes = $$("input[name='contact']");
  const saved = getLS("form_contacts", []);
  if(saved?.length) boxes.forEach(cb=> cb.checked = saved.includes(cb.value));
  boxes.forEach(cb=> cb.addEventListener("change", ()=>{
    const values = $$("input[name='contact']:checked").map(x=>x.value);
    setLS("form_contacts", values);
  }));
}

/* ================== Validation simple front ================== */
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||"").trim()); }
function isValidPhone(p){ return /^[+]?[\d\s().-]{6,}$/.test(String(p||"").trim()); }

/* ================== Submit (REGISTER) ================== */
(function formInit(){
  const form = $("#signup-form");
  persistFormFields();

  // fingerprint
  const fpEl = $("#fingerprint"); if(fpEl) fpEl.value = simpleFingerprint();

  // bind partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // si user déjà connu → hydrate son lien et démarre polling
  const knownUid = ownUserId();
  const knownPid = ownPublicId();
  const refInput = $("#ref-link");
  if((knownUid || knownPid) && refInput) refInput.value = buildReferralURL("cp");
  if(knownUid) startUserPolling();

  if(!form) return;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    // reset messages
    $("#signup-success")?.setAttribute("hidden","");
    $("#signup-already")?.setAttribute("hidden","");
    $("#signup-error")?.setAttribute("hidden","");

    // collecte
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    const contacts = $$("input[name='contact']:checked").map(x=>x.value);
    if(!contacts.length) contacts.push("email");

    // validations simples front
    if(!payload.firstName?.trim() || !payload.lastName?.trim()){
      const err=$("#signup-error"); err.textContent="Merci d’indiquer prénom et nom."; return err.removeAttribute("hidden");
    }
    if(!isValidEmail(payload.email)){
      const err=$("#signup-error"); err.textContent="Email invalide."; return err.removeAttribute("hidden");
    }
    if(!isValidPhone(payload.phone)){
      const err=$("#signup-error"); err.textContent="Téléphone invalide."; return err.removeAttribute("hidden");
    }
    if(!payload.country){
      const err=$("#signup-error"); err.textContent="Merci de choisir un pays (UE)."; return err.removeAttribute("hidden");
    }
    if(!$("#acceptRules")?.checked){
      const err=$("#signup-error"); err.textContent="Merci d’accepter le règlement et la politique de confidentialité."; return err.removeAttribute("hidden");
    }

    // upline captée à l’arrivée
    const upline = getLS("upline", []);
    const req = {
      action: "register",
      firstName: (payload.firstName||"").trim(),
      lastName:  (payload.lastName||"").trim(),
      email:     (payload.email||"").trim(),
      phone:     (payload.phone||"").trim(),
      country:   (payload.country||"").trim(),
      contactAll: contacts.join(","),

      // attributions
      referrerId: (upline[0]||""),
      refChain: (upline.slice(1)||[]).join(","),

      // audit
      fingerprint: simpleFingerprint(),
      campaign: payload.campaign || "q4_site_main",
      acqChannel: getParam("c") || "",
      userAgent: navigator.userAgent,
      pageUrl: location.href,
      timestamp: nowISO()
      // IP est vue côté Apps Script (e.source, etc.) — inutile de faker côté front
    };

    try{
      const res = await postForm(API.BASE, req);
      if(!res){ throw new Error("Empty response"); }

      // NORMALISATION : le backend renvoie toujours userId + points (REGISTERED ou ALREADY_REGISTERED)
      if(res.ok){
        // stocke identifiants
        if(res.userId) setLS("userId", res.userId);
        if(res.publicId) setLS("publicId", res.publicId);

        // hydrate le lien perso basé sur publicId
        if(refInput) refInput.value = buildReferralURL("cp");

        // points
        setPointsUI(Number(res.points||1));

        // messages
        if(res.code === "ALREADY_REGISTERED"){
          const already=$("#signup-already");
          if(already){
            already.textContent = "Tu es déjà inscrit(e) ✅ On synchronise tes points et ton lien de parrainage.";
            already.removeAttribute("hidden");
          }
          toast("Déjà inscrit(e) — session synchronisée ✅");
        }else{
          $("#signup-success")?.removeAttribute("hidden");
          $("#congrats-modal")?.removeAttribute("hidden");
          $("#congrats-modal")?.setAttribute("aria-hidden","false");
          $("#cta-more-points")?.addEventListener("click", ()=>{
            location.hash="#points";
            $("#congrats-modal")?.setAttribute("aria-hidden","true");
            $("#congrats-modal")?.setAttribute("hidden","");
          });
          toast("Inscription validée 🎉");
        }

        // démarre/relance polling
        startUserPolling();
        setLS("session_active", true);
        location.hash="#points";
        return;
      }

      // Erreurs contrôlées (ex: pays hors UE)
      if(res.code === "COUNTRY_NOT_ELIGIBLE"){
        const err=$("#signup-error"); err.textContent=res.message || "Pays non éligible (UE uniquement).";
        return err.removeAttribute("hidden");
      }

      // Fallback erreur
      const err=$("#signup-error"); err.textContent="Impossible d’enregistrer pour le moment.";
      err.removeAttribute("hidden");
    }catch(ex){
      console.error(ex);
      const err=$("#signup-error"); err.textContent="Réseau indisponible. Merci de réessayer dans un instant.";
      err.removeAttribute("hidden");
    }
  });
})();

/* ================== Bind global & état initial ================== */
document.addEventListener("DOMContentLoaded", ()=>{
  // Boutons de partage (fallback au cas où)
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // Lien perso si session existante
  const refInput = $("#ref-link");
  if(refInput && (ownUserId() || ownPublicId())) refInput.value = buildReferralURL("cp");

  // Session active → polling direct
  if(ownUserId() && getLS("session_active")) startUserPolling();

  // Placeholder compteur (évite “0 participants”)
  const c=$("#counter-left"); if(c && !c.textContent.trim()) c.textContent="Chargement…";
});
