/* ==========================================================
   Eurovilla.lt — app.js (v5, “anti-doublon+meta”)
   - LocalStorage complet des champs (form / session)
   - Inscription + doublons (auto-reconnaissance UX)
   - Dédup côté serveur (email/tel) + enrichissement IP/appareil
   - Pré-contrôle client (hash email+tel) pour éviter la resoumission immédiate
   - Polling points (5s) + barre de progression
   - Lien court de parrainage r/z/sn + partages (WA/Email/Copie)
   - Log de clic à l’atterrissage
   - Countdown + thème + modales + UTM/campaign/source
   ========================================================== */

const API = {
  // ⚠️ Mets ici l’URL de ton déploiement Apps Script WebApp (exécuter en tant que propriétaire, accès “Tout le monde”)
  BASE: "https://script.google.com/macros/s/AKfycbx0PahxiURVZ_110-KaOsJEdP0DduSqwz0dxTgQ1R3eS4uX0TKiW3HI6k_beXLrsyJFig/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};

const DRAW_DATE = new Date("2025-10-31T23:59:59Z"); // ISO pour éviter TZ issues
const POLL_MS = 5000;
const POINTS_MAX_VISUAL = 50;

/* ------------------ Helpers ------------------ */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const pad2 = n => String(n).padStart(2,"0");
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const nowISO = ()=> new Date().toISOString();

function setLS(k,v){ try{ localStorage.setItem(k, typeof v==="string"?v:JSON.stringify(v)); }catch{} }
function getLS(k,def=null){ try{ const v=localStorage.getItem(k); if(v==null) return def; if(v.startsWith("{")||v.startsWith("[")) return JSON.parse(v); return v; }catch{return def;} }
function delLS(k){ try{ localStorage.removeItem(k);}catch{} }

function uid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }
function hashString(s){
  try{ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return "h_"+Math.abs(h).toString(36); }
  catch{return "h_"+Math.random().toString(36).slice(2,10);}
}
function shortId(uidStr){
  try { let h=0; for (let i=0;i<uidStr.length;i++){ h=((h<<5)-h)+uidStr.charCodeAt(i); h|=0; }
        return Math.abs(h).toString(36).slice(-8);
  } catch { return uidStr.slice(-8); }
}

/* --------- Fingerprint + IP + UTM --------- */
function simpleFingerprint(){
  try{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const parts = [
      navigator.userAgent || "",
      navigator.language || "",
      (screen && (screen.width+"x"+screen.height)) || "",
      tz,
      navigator.platform || "",
      (navigator.hardwareConcurrency || 0),
      (navigator.deviceMemory || 0)
    ];
    const data = parts.join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_"+Math.abs(h);
  }catch{ return "fp_unknown"; }
}
async function getPublicIP(timeout=2500){
  const CTRL = new AbortController();
  const t = setTimeout(()=>CTRL.abort(), timeout);
  try{
    const res = await fetch("https://api.ipify.org?format=json", {signal: CTRL.signal});
    clearTimeout(t);
    if(!res.ok) throw new Error("ipify HTTP "+res.status);
    const j = await res.json();
    return j && j.ip || "";
  }catch{
    clearTimeout(t);
    // fallback 2
    try{
      const CTRL2 = new AbortController();
      const t2 = setTimeout(()=>CTRL2.abort(), timeout);
      const res2 = await fetch("https://ifconfig.me/ip", {signal: CTRL2.signal});
      clearTimeout(t2);
      if(res2.ok){ return (await res2.text()).trim(); }
    }catch{}
    return "";
  }
}
function getUTM(){
  const u = new URL(location.href);
  return {
    utm_source: u.searchParams.get("utm_source") || "",
    utm_medium: u.searchParams.get("utm_medium") || "",
    utm_campaign: u.searchParams.get("utm_campaign") || "",
    utm_content: u.searchParams.get("utm_content") || "",
    utm_term: u.searchParams.get("utm_term") || ""
  };
}
function acqChannelFromUTM(utm){
  if(utm.utm_source) return utm.utm_source;
  const ref = document.referrer || "";
  if(/facebook|instagram|meta/i.test(ref)) return "meta";
  if(/t\.co|twitter|x\.com/i.test(ref)) return "twitter";
  if(/wa\.me|whatsapp/i.test(ref)) return "whatsapp";
  if(/mail|gmail|outlook/i.test(ref)) return "email";
  if(ref) return "referrer";
  return "direct";
}

/* ------------------ fetch utils (GET/POST urlencoded) ------------------ */
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
async function fetchJSON(url, opts={}, retries=API.RETRIES){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
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
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
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

/* ------------------ Base64URL (r/z) ------------------ */
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

/* ------------------ Progress UI ------------------ */
function setPointsUI(n){
  const pts=Math.max(1, Number(n||1)); setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX_VISUAL*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar) bar.style.width=pct+"%"; if(lab) lab.textContent=pct+"%";
}
setPointsUI(getLS("points_ui", 1));

/* ------------------ Referral (r/z/sn) ------------------ */
function ownUserId(){ return getLS("userId",""); }
function getParam(name){ try{ return new URL(location.href).searchParams.get(name); }catch{return null} }

function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ const csv=b64urlDecode(z||""); return csv? csv.split(",").map(s=>s.trim()).filter(Boolean) : []; }

function prettyOrigin(){
  if(location.origin && /^https?:\/\//i.test(location.origin)) return location.origin;
  return "https://eurovilla.lt"; // fallback esthétique
}
function buildReferralLinkShort(userId, channel){
  const chain = [userId].concat(getLS("upline", [])); // chaîne illimitée
  const z = chainTokenFromUpline(chain);
  const r = shortId(userId);
  const basePath = location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1");
  const base = new URL(prettyOrigin() + basePath);
  base.searchParams.set("r", r);
  base.searchParams.set("z", z);
  if(channel) base.searchParams.set("c", channel);
  return base.toString();
}

/* Landing: capte r/z et log le click une seule fois */
(function referralLanding(){
  const u = new URL(location.href);
  const r  = u.searchParams.get("r");
  const z  = u.searchParams.get("z");
  const rc = u.searchParams.get("rc"); // compat ancien
  const ref= u.searchParams.get("ref"); // compat ancien
  const c  = u.searchParams.get("c") || "";

  let chain=[];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").map(s=>s.trim()).filter(Boolean);
  else if(ref) chain = [ref];

  if(chain.length) setLS("upline", chain);

  // log 1 seul click pour cette combinaison (ref L1 + token chaîne)
  const refKey = (chain[0]||"") + ":" + (z||rc||"") + ":" + (c||"");
  const key = "click_logged_"+refKey;
  if(!getLS(key)){
    postForm(API.BASE, {
      action: "click",
      timestamp: nowISO(),
      pageUrl: location.href,
      fingerprint: simpleFingerprint(),
      userAgent: navigator.userAgent
    }).then(()=> setLS(key,1)).catch(()=>{});
  }
})();

/* Nonces de partage & partages */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

  // Lien court + nonce
  const base = uid ? buildReferralLinkShort(uid, channel) : (()=>{
    const url=new URL(prettyOrigin() + location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
    const chain = getLS("upline", []);
    if(chain.length) url.searchParams.set("z", chainTokenFromUpline(chain));
    url.searchParams.set("c", channel);
    return url.toString();
  })();
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

/* --------------- Snapshot utilisateur (points + filleuls) --------------- */
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
  const elPts=$("#me-points"); if(elPts) elPts.textContent = snapshot.points ?? "";
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

/* Polling doux (toutes les 5s, + relances opportunistes) */
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
  window.addEventListener("scroll", ()=> { if(Math.random()<0.02) run(); });
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

  // cases à cocher (contact)
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

/* ------------------ Pré-contrôle anti-double (client) ------------------ */
function preDupKey(email, phone){
  const e = (email||"").trim().toLowerCase();
  const p = (phone||"").replace(/[^+\d]/g,"");
  return hashString(e+"|"+p);
}

/* ------------------ Formulaire (REGISTER) ------------------ */
(function formInit(){
  const form=$("#signup-form");
  persistFormFields();

  // Récup upline à l’arrivée
  const z  = getParam("z");
  const rc = getParam("rc");
  const ref= getParam("ref");
  let chain=[];
  if(z) chain=uplineFromChainToken(z); else if(rc) chain=rc.split(",").map(s=>s.trim()).filter(Boolean); else if(ref) chain=[ref];
  if(chain.length){ setLS("upline", chain); $("#referrerId") && ($("#referrerId").value = chain[0]); }

  // fingerprint
  const fp = $("#fingerprint"); if(fp) fp.value = simpleFingerprint();

  // bind partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // si user déjà connu → hydrate son lien et démarre polling
  const known = ownUserId();
  const refInput=$("#ref-link");
  if(known && refInput) refInput.value = buildReferralLinkShort(known,"cp");
  if(known) startUserPolling();

  if(!form) return;

  let submitting=false;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(submitting) return;
    submitting=true;

    const success=$("#signup-success"), error=$("#signup-error");
    success?.setAttribute("hidden",""); error?.setAttribute("hidden","");

    // récup champs
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // contacts = checkboxes (au moins email)
    const contacts = $$("input[name='contact']:checked").map(x=>x.value);
    if(!contacts.length){ contacts.push("email"); }

    // pays UE obligatoire (validation légère)
    const EU = ["Allemagne","Autriche","Belgique","Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande","France","Grèce","Hongrie","Irlande","Italie","Lettonie","Lituanie","Luxembourg","Malte","Pays-Bas","Pologne","Portugal","Roumanie","Slovaquie","Slovénie","Suède"];
    if(!EU.includes((payload.country||"").trim())){
      error.textContent="Pays de résidence non éligible (UE uniquement).";
      error?.removeAttribute("hidden");
      submitting=false; return;
    }

    // Pré-dup client (évite spam immédiat sur même email/tel)
    const dupKey = preDupKey(payload.email, payload.phone);
    if(getLS("dup_key_last") === dupKey){
      error.textContent="Tu es déjà inscrit(e) avec ces informations (détection locale).";
      error?.removeAttribute("hidden");
      submitting=false; return;
    }

    // UTM & canal
    const utm = getUTM();
    const acqChannel = acqChannelFromUTM(utm);

    // IP publique (en parallèle)
    const ipPromise = getPublicIP();

    // Upline L1/L2…
    const upline = getLS("upline", []);
    const referrerId = (upline[0]||"");
    const refChain   = (upline.slice(1)||[]).join(",");

    // fingerprint
    const fingerprint = simpleFingerprint();

    // Compose requête
    const reqBase = {
      action: "register",
      firstName: (payload.firstName||"").trim(),
      lastName:  (payload.lastName||"").trim(),
      email:     (payload.email||"").trim(),
      phone:     (payload.phone||"").trim(),
      country:   (payload.country||"").trim(),
      contactAll: contacts.join(","),              // ex: "email,whatsapp,sms"
      referrerId,                                  // L1
      refChain,                                    // L2+
      fingerprint,
      campaign: payload.campaign || utm.utm_campaign || "display_q4_2025",
      userAgent: navigator.userAgent,
      acqChannel,
      source: "web",
      pageUrl: location.href,
      timestamp: nowISO()
    };

    // Ajout IP (si récupérée)
    const ip = await ipPromise.catch(()=> "");
    if(ip) reqBase.ip = ip;

    try{
      const res = await postForm(API.BASE, reqBase);

      if(res && res.ok){
        // cas: nouvel inscrit OU doublon (ALREADY_REGISTERED) — le serveur renvoie userId+points
        const serverUserId = res.userId || ownUserId() || uid();
        setLS("userId", serverUserId);
        setPointsUI(Number(res.points||1));
        setLS("dup_key_last", dupKey); // on marque localement

        // prépare lien
        if(refInput){ refInput.value = buildReferralLinkShort(serverUserId,"cp"); }

        // UX
        success?.removeAttribute("hidden");
        $("#congrats-modal")?.removeAttribute("hidden");
        $("#congrats-modal")?.setAttribute("aria-hidden","false");
        $("#cta-more-points")?.addEventListener("click", ()=>{
          location.hash="#points";
          $("#congrats-modal")?.setAttribute("aria-hidden","true");
          $("#congrats-modal")?.setAttribute("hidden","");
        });

        // on démarre / redémarre le polling
        startUserPolling();
        // garde la session “ouverte” côté client
        setLS("session_active", true);
        toast( res.code==="ALREADY_REGISTERED" ? "Déjà inscrit(e) — points synchronisés ✅" : "Inscription synchronisée ✅" );
        location.hash="#points";
      }else{
        // Codes serveur explicites
        if(res && res.code === "COUNTRY_NOT_ELIGIBLE"){
          error.textContent="Pays de résidence non éligible (UE uniquement).";
        }else if(res && res.code === "MISSING_FIELDS"){
          error.textContent="Champs requis manquants. Merci de compléter le formulaire.";
        }else{
          error.textContent = (res && res.message) ? res.message : "Impossible d’enregistrer pour le moment.";
        }
        error?.removeAttribute("hidden");
      }
    }catch(err){
      console.error(err);
      error.textContent="Réseau indisponible. Merci de réessayer.";
      error?.removeAttribute("hidden");
    }finally{
      submitting=false;
    }
  });
})();

/* --------------- Bind global --------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // boutons partages (fallback au cas où)
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // si déjà loggé, prépare le lien court
  const uid = ownUserId();
  const refInput=$("#ref-link");
  if(refInput && uid){ refInput.value = buildReferralLinkShort(uid,"cp"); }

  // si session déjà active → polling direct
  if(uid && getLS("session_active")) startUserPolling();
});
