/* ==========================================================
   Eurovilla.lt — app.js (v5 smart)
   - Anti-doublon (via backend) + fingerprint + IP + UA
   - Inscription: log complet (date, pays, ip, device, referrer, campaign, canal)
   - publicId secret (5-10 car.) utilisé dans ?r=
   - Polling points (5s) + progression + L1/L2 + derniers filleuls + publicId
   - Partage r/z/sn (nonce) + click logging d’arrivée
   - Thème, countdown, modales, toasts
   ========================================================== */

const API = {
  // ⚠️ Mets ici l’URL de ton déploiement Apps Script WebApp:
  BASE: "https://script.google.com/macros/s/AKfycbx0PahxiURVZ_110-KaOsJEdP0DduSqwz0dxTgQ1R3eS4uX0TKiW3HI6k_beXLrsyJFig/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};

const DRAW_DATE = new Date("2025-10-31T23:59:59");
const POLL_MS = 5000;
const POINTS_MAX_VISUAL = 50;

/* ------------------ Helpers ------------------ */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const pad2 = n => String(n).padStart(2,"0");
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const nowISO = ()=> new Date().toISOString();
const originRef = () => (document.referrer || "");

/* localStorage helpers */
function setLS(k,v){ try{ localStorage.setItem(k, typeof v==="string"?v:JSON.stringify(v)); }catch{} }
function getLS(k,def=null){ try{ const v=localStorage.getItem(k); if(v==null) return def; if((v.startsWith("{")||v.startsWith("["))) return JSON.parse(v); return v; }catch{return def;} }

/* IDs, fingerprint */
function uid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }
function simpleFingerprint(){
  try{
    const data=[navigator.userAgent,navigator.language,screen.width+"x"+screen.height,(Intl.DateTimeFormat().resolvedOptions().timeZone||"")].join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_"+Math.abs(h);
  }catch{ return "fp_unknown"; }
}

/* URL params & base64url */
function getParam(name){ const u = new URL(location.href); return u.searchParams.get(name); }
function toUrlParams(obj){
  const p = new URLSearchParams();
  Object.keys(obj).forEach(k=>{
    const v = obj[k];
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach(x=> p.append(k, String(x)));
    else p.append(k, String(v));
  });
  return p;
}
function b64urlEncode(str){
  try{ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
  catch{ return ""; }
}
function b64urlDecode(str){
  try{
    const pad = str.length%4===2 ? "==" : str.length%4===3 ? "=" : "";
    const s = str.replace(/-/g,"+").replace(/_/g,"/") + pad;
    return decodeURIComponent(escape(atob(s)));
  }catch{ return ""; }
}

/* fetch utils (GET/POST sans preflight via urlencoded) */
async function fetchJSON(url, opts={}, retries=API.RETRIES){
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
  try{
    const res = await fetch(url, { ...opts, signal: ctrl.signal, mode:"cors", redirect:"follow" });
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
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
  try{
    const res = await fetch(url, {
      method: "POST",
      body: toUrlParams(data),
      mode: "cors",
      redirect: "follow",
      signal: ctrl.signal
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

/* ------------------ IP publique (client) ------------------ */
let CURRENT_IP = getLS("my_ip",""); // cache local
async function resolveIP(){
  if (CURRENT_IP) return CURRENT_IP;
  try{
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 3000);
    const res = await fetch("https://api.ipify.org?format=json", {signal: ctrl.signal});
    clearTimeout(t);
    if(res.ok){
      const j = await res.json();
      CURRENT_IP = (j && j.ip) ? String(j.ip) : "";
      if (CURRENT_IP) setLS("my_ip", CURRENT_IP);
      return CURRENT_IP;
    }
  }catch(e){}
  return "";
}

/* ------------------ Theme ------------------ */
(function themeInit(){
  const root=document.documentElement, btn=$("#toggle-theme");
  const saved=getLS("theme");
  if(saved==="light"||saved==="dark") root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", ()=>{
    const cur=root.getAttribute("data-theme")==="light"?"dark":"light";
    root.setAttribute("data-theme", cur); setLS("theme", cur);
  });
})();

/* ------------------ Countdown ------------------ */
(function countdown(){
  const d=$("#d"),h=$("#h"),m=$("#m"),s=$("#s"); if(!d||!h||!m||!s) return;
  const tick=()=>{
    const diff=Math.max(0, DRAW_DATE - new Date());
    const D=Math.floor(diff/86400000), H=Math.floor((diff/3600000)%24), M=Math.floor((diff/60000)%60), S=Math.floor((diff/1000)%60);
    d.textContent=D; h.textContent=pad2(H); m.textContent=pad2(M); s.textContent=pad2(S);
  };
  tick(); setInterval(tick,1000);
})();

/* ------------------ Modale 360° ------------------ */
(function modal360(){
  const modal=$("#modal-360");
  const openBtns=$$("[data-open='modal-360']");
  const closers=$$("[data-action='close-modal']");
  function open(){ if(!modal) return; modal.removeAttribute("hidden"); modal.setAttribute("aria-hidden","false"); }
  function close(){ if(!modal) return; modal.setAttribute("aria-hidden","true"); modal.setAttribute("hidden",""); }
  openBtns.forEach(b=>b.addEventListener("click", open));
  closers.forEach(c=>c.addEventListener("click", close));
  document.addEventListener("keydown", e=>e.key==="Escape"&&close());
})();

/* ------------------ Toast ------------------ */
function toast(msg){
  let t=$("#toast-hint");
  if(!t){
    t=document.createElement("div"); t.id="toast-hint";
    Object.assign(t.style,{position:"fixed",left:"50%",bottom:"24px",transform:"translateX(-50%)",background:"rgba(0,0,0,.75)",color:"#fff",padding:"10px 14px",borderRadius:"10px",zIndex:"9999",fontWeight:"700",backdropFilter:"blur(4px)",maxWidth:"90%",textAlign:"center"});
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; t.style.transition="none";
  setTimeout(()=>{ t.style.transition="opacity .5s"; t.style.opacity="0"; }, 1600);
}

/* ------------------ Points UI ------------------ */
function setPointsUI(n){
  const pts=Math.max(1, Number(n||1)); setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const me=$("#me-points"); if(me) me.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX_VISUAL*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar) bar.style.width=pct+"%"; if(lab) lab.textContent=pct+"%";
}
setPointsUI(getLS("points_ui", 1));

/* ------------------ Referral (r/z/sn) ------------------ */
function ownUserId(){ return getLS("userId",""); }
function ownPublicId(){ return getLS("publicId",""); }

function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ const csv=b64urlDecode(z||""); return csv? csv.split(",").map(s=>s.trim()).filter(Boolean) : []; }

function prettyOrigin(){
  if(location.origin && /^https?:\/\//i.test(location.origin)) return location.origin;
  return "https://eurovilla.lt"; // fallback esthétique
}
function buildReferralLinkShort(channel){
  // Utilise le publicId secret pour ?r=  (fiable côté backend)
  const uid = ownUserId();
  const pid = ownPublicId();
  const chain = uid ? [uid].concat(getLS("upline", [])) : getLS("upline", []);
  const z = chainTokenFromUpline(chain);
  const basePath = location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1");
  const base = new URL(prettyOrigin() + basePath);
  if (pid) base.searchParams.set("r", pid);
  base.searchParams.set("z", z);
  base.searchParams.set("c", channel || "");
  return base.toString();
}

/* Landing: capte r/z/rc/ref et log le click (une seule fois par ref) */
(function referralLanding(){
  const u = new URL(location.href);
  const r  = u.searchParams.get("r");   // publicId court si présent
  const z  = u.searchParams.get("z");
  const rc = u.searchParams.get("rc");  // compat ancien
  const ref= u.searchParams.get("ref"); // compat ancien

  let chain=[];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];

  if(chain.length) setLS("upline", chain);

  // log click 1x
  const refKey = (chain[0]||"") + ":" + (z||rc||ref||"") + ":" + (r||"");
  const key = "click_logged_"+refKey;
  if((chain.length || r) && !getLS(key)){
    postForm(API.BASE, {
      action: "click",
      timestamp: nowISO(),
      referrerId: chain[0] || "",
      refChain: chain.slice(1).join(","),
      fingerprint: simpleFingerprint(),
      pageUrl: location.href,
      userAgent: navigator.userAgent
    }).then(()=> setLS(key,1)).catch(()=>{});
  }
})();

/* ------------------ Shares (nonces) & partages  ------------------ */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

  // Lien court + nonce
  const base = buildReferralLinkShort(channel || "cp");
  const u = new URL(base); u.searchParams.set("sn", nonce);

  postForm(API.BASE, { action:"share-start", nonce, userId: uid||"", channel, pageUrl: location.href }).catch(()=>{});
  return { nonce, url: u.toString() };
}
async function pollAck(nonce, ms=6000){
  const start=Date.now();
  while(Date.now()-start<ms){
    try{
      const q=new URL(API.BASE); q.searchParams.set("action","share-ack"); q.searchParams.set("nonce",nonce);
      const r=await fetchJSON(q.toString(), {method:"GET"});
      if(r && r.ok && r.ack===true) return true;
    }catch{}
    await sleep(800);
  }
  return false;
}
async function shareWhatsApp(){
  const { nonce, url } = await shareStart("wa");
  const text = `Je participe à Eurovilla.lt pour gagner une villa d’exception ! Inscris-toi ici (ça me donne des points) : ${url}`;
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
    const input=$("#ref-link"); if(input){ input.value=url; input.select(); document.execCommand("copy"); toast("Lien copié 👍"); }
  }
  pollAck(nonce).then(ok=> ok && toast("Premier clic détecté ✅"));
}

/* --------------- Stats Live (participants) --------------- */
(async function syncStats(){
  try{
    const u=new URL(API.BASE); u.searchParams.set("action","stats");
    const r=await fetchJSON(u.toString(), {method:"GET"});
    const c=$("#counter-left"); if(c && r && r.totalParticipants!=null) c.textContent=r.totalParticipants.toLocaleString("fr-FR");
  }catch{}
})();

/* --------------- Snapshot utilisateur (points + filleuls + publicId) --------------- */
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

  // afficher publicId (secret) pour debug/UX
  if (snapshot.publicId) {
    setLS("publicId", snapshot.publicId);
    const pidEl = $("#my-public-id");
    if (pidEl) pidEl.textContent = snapshot.publicId;
    // maj champ lien si présent
    const refInput=$("#ref-link");
    if (refInput) refInput.value = buildReferralLinkShort("cp");
  }

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

/* Polling (5s) */
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

/* ------------------ Persistance formulaire ------------------ */
function persistFormFields(){
  const ids = ["firstName","lastName","email","phone","country"];
  ids.forEach(id=>{
    const el = $("#"+id);
    if(!el) return;
    const saved = getLS("form_"+id);
    if(saved!=null) el.value = saved;
    el.addEventListener("input", ()=> setLS("form_"+id, el.value));
    if(el.tagName==="SELECT"){ el.addEventListener("change", ()=> setLS("form_"+id, el.value)); }
  });

  // cases contact
  const contactBoxes = $$("input[name='contact']");
  const savedContacts = getLS("form_contacts", []);
  if(savedContacts && savedContacts.length){
    contactBoxes.forEach(cb=> cb.checked = savedContacts.includes(cb.value));
  }
  contactBoxes.forEach(cb=> cb.addEventListener("change", ()=>{
    const values = $$("input[name='contact']:checked").map(x=>x.value);
    setLS("form_contacts", values);
  }));
}

/* ------------------ Formulaire (REGISTER) ------------------ */
(function formInit(){
  const form=$("#signup-form");
  persistFormFields();

  // Récupère éventuelle upline à l’arrivée
  const z  = getParam("z");
  const rc = getParam("rc");
  const ref= getParam("ref");
  let chain=[];
  if(z) chain=b64urlDecode(z).split(",").filter(Boolean);
  else if(rc) chain=rc.split(",").filter(Boolean);
  else if(ref) chain=[ref];
  if(chain.length){ setLS("upline", chain); $("#referrerId") && ($("#referrerId").value = chain[0]); }

  // fingerprint
  const fp = $("#fingerprint"); if(fp) fp.value = simpleFingerprint();

  // bind partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // si user déjà connu → hydrate le lien et démarre polling
  const knownUid = ownUserId();
  const refInput=$("#ref-link");
  if(knownUid && refInput) refInput.value = buildReferralLinkShort("cp");
  if(knownUid) startUserPolling();

  if(!form) return;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const success=$("#signup-success"), error=$("#signup-error");
    success?.setAttribute("hidden",""); error?.setAttribute("hidden","");

    // récup champs
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // contacts = checkboxes
    const contacts = $$("input[name='contact']:checked").map(x=>x.value);
    if(!contacts.length){ contacts.push("email"); }

    // pays UE (même liste que backend)
    const EU = ["Allemagne","Autriche","Belgique","Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande","France","Grèce","Hongrie","Irlande","Italie","Lettonie","Lituanie","Luxembourg","Malte","Pays-Bas","Pologne","Portugal","Roumanie","Slovaquie","Slovénie","Suède"];
    if(!EU.includes((payload.country||"").trim())){
      error.textContent="Pays de résidence non éligible (UE uniquement).";
      return error.removeAttribute("hidden");
    }

    // upline / attribution multi-niveaux
    const upline = getLS("upline", []);

    // canal d’acquisition (si présent dans l’URL)
    const acqChannel = getParam("c") || "";

    // IP (meilleur effort, non bloquant)
    const ip = await resolveIP().catch(()=> "");

    const req = {
      action: "register",
      firstName: (payload.firstName||"").trim(),
      lastName:  (payload.lastName||"").trim(),
      email:     (payload.email||"").trim(),
      phone:     (payload.phone||"").trim(),
      country:   (payload.country||"").trim(),
      contactAll: contacts.join(","),

      // attribution
      referrerId: (upline[0]||""),
      refChain: (upline.slice(1)||[]).join(","),

      // signaux appareil
      fingerprint: simpleFingerprint(),
      userAgent: navigator.userAgent,

      // contexte marketing
      campaign: payload.campaign || "display_q4_2025",
      acqChannel,                      // <- nouveau

      // logs
      ip,                              // <- côté client (meilleur effort)
      source: "web",
      timestamp: nowISO(),

      // bonus debug
      pageReferrer: originRef()
    };

    try{
      const res = await postForm(API.BASE, req);

      if(res && res.ok){
        // Nouvel inscrit: code=REGISTERED
        // Doublon reconnu: code=ALREADY_REGISTERED (backend renvoie userId, publicId, points)
        const serverUserId = res.userId || ownUserId() || uid();
        setLS("userId", serverUserId);

        if (res.publicId) setLS("publicId", res.publicId);
        if (res.points != null) setPointsUI(Number(res.points));

        // prépare lien (avec publicId si dispo)
        const refInput=$("#ref-link");
        if(refInput){ refInput.value = buildReferralLinkShort("cp"); }

        // affiche publicId si retour (pour debug/UX)
        if (res.publicId && $("#my-public-id")) $("#my-public-id").textContent = res.publicId;

        // UX succès + ancre points
        success?.removeAttribute("hidden");
        $("#congrats-modal")?.removeAttribute("hidden");
        $("#congrats-modal")?.setAttribute("aria-hidden","false");
        $("#cta-more-points")?.addEventListener("click", ()=>{
          location.hash="#points";
          $("#congrats-modal")?.setAttribute("aria-hidden","true");
          $("#congrats-modal")?.setAttribute("hidden","");
        });

        // démarre polling
        startUserPolling();

        // session “ouverte”
        setLS("session_active", true);
        toast(res.code==="ALREADY_REGISTERED" ? "Déjà inscrit : synchro de tes points ✅" : "Inscription synchronisée ✅");
        location.hash="#points";
      }else{
        // message backend explicite le cas échéant
        error.textContent = (res && (res.message || res.code)) ? (res.message || ("Erreur: "+res.code)) : "Impossible d’enregistrer pour le moment.";
        error?.removeAttribute("hidden");
      }
    }catch(err){
      console.error(err);
      error.textContent="Réseau indisponible. Merci de réessayer.";
      error?.removeAttribute("hidden");
    }
  });
})();

/* --------------- Bind global --------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // boutons partages (fallback)
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // si déjà loggé, prépare le lien court (publicId si dispo)
  const uid = ownUserId();
  const refInput=$("#ref-link");
  if(refInput && uid){ refInput.value = buildReferralLinkShort("cp"); }

  // afficher publicId si déjà connu
  const pid = ownPublicId();
  if (pid && $("#my-public-id")) $("#my-public-id").textContent = pid;

  // session active → polling
  if(uid && getLS("session_active")) startUserPolling();
});
