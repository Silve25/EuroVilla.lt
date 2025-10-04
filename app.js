/* ==========================================================
   Eurovilla.lt — app.js (v4.2)
   - Liens courts r/z/sn/c
   - Anti-doublons (email/téléphone) + “login doux”
   - Polling points 5s + progression lisse
   - Partage WhatsApp / Email / Copie (nonce + ack)
   - Upline multi-niveaux illimitée (L1/L2/L3 côté scoring)
   - Préremplissage & mémoire locale
   - Pays par défaut = Lituanie (si non choisi)
   - Modales vidéo 360° et Félicitations
   - Hooks compatibles avec Code.gs v3.1
   ========================================================== */

const API = {
  // ⚠️ Utilise ton dernier déploiement Apps Script (fourni par toi : Version 2)
  BASE: "https://script.google.com/macros/s/AKfycbx0PahxiURVZ_110-KaOsJEdP0DduSqwz0dxTgQ1R3eS4uX0TKiW3HI6k_beXLrsyJFig/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};

const DRAW_DATE = new Date("2025-10-31T23:59:59");

/* -------------------- Helpers DOM/async/storage -------------------- */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const pad2 = n => String(n).padStart(2,"0");
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function setLS(k,v){ try{ localStorage.setItem(k, typeof v==="string"?v:JSON.stringify(v)); }catch{} }
function getLS(k,def=null){ try{ const v=localStorage.getItem(k); return v==null?def:(v.startsWith("{")||v.startsWith("[")?JSON.parse(v):v);}catch{return def;} }
function delLS(k){ try{ localStorage.removeItem(k);}catch{} }

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
    if(retries>0){ await sleep(350*(API.RETRIES-retries+1)); return fetchJSON(url, opts, retries-1); }
    throw err;
  }
}
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
async function postForm(url, data, retries=API.RETRIES){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), API.TIMEOUT_MS);
  try{
    const res = await fetch(url, {
      method: "POST",
      body: toUrlParams(data), // Pas de headers -> évite le preflight
      mode: "cors",
      redirect: "follow",
      signal: ctrl.signal
    });
    clearTimeout(t);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json().catch(()=> ({}));
  }catch(err){
    clearTimeout(t);
    if(retries>0){ await sleep(350*(API.RETRIES-retries+1)); return postForm(url, data, retries-1); }
    throw err;
  }
}

/* -------------------- Identité & empreintes -------------------- */
function uid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }
/** id court esthétique (5 chars) pour r= */
function shortId(userId){
  try{
    let h=0; for(let i=0;i<userId.length;i++){ h=((h<<5)-h)+userId.charCodeAt(i); h|=0; }
    const base = Math.abs(h).toString(36);
    return base.slice(-5);
  }catch{ return userId.slice(-5); }
}
function simpleFingerprint(){
  try{
    const data=[navigator.userAgent,navigator.language,screen.width+"x"+screen.height,(Intl.DateTimeFormat().resolvedOptions().timeZone||"")].join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_"+Math.abs(h);
  }catch{ return "fp_unknown"; }
}
function getParam(name){ const u=new URL(location.href); return u.searchParams.get(name); }

/* -------------------- Base64url pour upline multi-niveaux -------------------- */
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
function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ const csv=b64urlDecode(z||""); return csv? csv.split(",").map(s=>s.trim()).filter(Boolean) : []; }

/* -------------------- UE & thème -------------------- */
function countryIsEU(label){
  return [
    "Allemagne","Autriche","Belgique","Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande",
    "France","Grèce","Hongrie","Irlande","Italie","Lettonie","Lituanie","Luxembourg","Malte","Pays-Bas",
    "Pologne","Portugal","Roumanie","Slovaquie","Slovénie","Suède"
  ].includes((label||"").trim());
}
(function themeInit(){
  const root=document.documentElement, btn=$("#toggle-theme");
  const saved=getLS("theme"); if(saved==="light"||saved==="dark") root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", ()=>{
    const cur=root.getAttribute("data-theme")==="light"?"dark":"light";
    root.setAttribute("data-theme", cur); setLS("theme", cur);
  });
})();

/* -------------------- Countdown & FOMO live counter -------------------- */
(function countdown(){
  const d=$("#d"),h=$("#h"),m=$("#m"),s=$("#s"); if(!d||!h||!m||!s) return;
  const tick=()=>{
    const diff=Math.max(0, DRAW_DATE - new Date());
    const D=Math.floor(diff/86400000), H=Math.floor((diff/3600000)%24), M=Math.floor((diff/60000)%60), S=Math.floor((diff/1000)%60);
    d.textContent=D; h.textContent=pad2(H); m.textContent=pad2(M); s.textContent=pad2(S);
  };
  tick(); setInterval(tick,1000);
})();
(async function syncStats(){
  try{
    const u=new URL(API.BASE); u.searchParams.set("action","stats");
    const r=await fetchJSON(u.toString(), {method:"GET"});
    const c=$("#counter-left"); if(c && r && r.totalParticipants!=null) c.textContent=r.totalParticipants.toLocaleString("fr-FR");
  }catch{}
})();

/* -------------------- Modale vidéo 360° -------------------- */
(function modal360(){
  const modal=$("#modal-360"), body=$("#modal-360-body");
  const openBtns=$$("[data-open='modal-360']"); const closers=$$("[data-action='close-modal']");
  function open(){
    if(!modal) return;
    // Si tu préfères YouTube, décommente la partie iFrame et commente la balise <video> de l'HTML.
    modal.removeAttribute("hidden"); modal.setAttribute("aria-hidden","false");
  }
  function close(){ if(!modal) return; modal.setAttribute("aria-hidden","true"); modal.setAttribute("hidden",""); }
  openBtns.forEach(b=>b.addEventListener("click", open));
  closers.forEach(c=>c.addEventListener("click", close));
  document.addEventListener("keydown", e=>e.key==="Escape"&&close());
})();

/* -------------------- Toasts -------------------- */
function toast(msg){
  let t=$("#toast-hint");
  if(!t){
    t=document.createElement("div"); t.id="toast-hint";
    Object.assign(t.style,{position:"fixed",left:"50%",bottom:"24px",transform:"translateX(-50%)",background:"rgba(0,0,0,.85)",color:"#fff",padding:"10px 14px",borderRadius:"10px",zIndex:"9999",fontWeight:"700",backdropFilter:"blur(4px)",maxWidth:"90%",textAlign:"center"});
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; t.style.transition="none";
  setTimeout(()=>{ t.style.transition="opacity .5s"; t.style.opacity="0"; }, 1800);
}

/* -------------------- Points UI -------------------- */
const POINTS_MAX=50;
function setPointsUI(n){
  const prev = Number(getLS("points_ui", 1));
  const pts  = Math.max(1, Number(n||1));
  setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar){ bar.style.transition="width .6s ease"; bar.style.width=pct+"%"; }
  if(lab) lab.textContent=pct+"%";
  // Animation optionnelle lorsqu'on gagne des points :
  // if(pts>prev){ confetti(); }
}
function confetti(){
  const el=document.createElement("div");
  el.innerHTML="🎉";
  Object.assign(el.style,{position:"fixed",left:Math.random()*100+"%",top:"-20px",fontSize:"24px",animation:"fall 2s linear forwards"});
  document.body.appendChild(el); setTimeout(()=>el.remove(),2000);
}

/* -------------------- Référents & liens courts -------------------- */
function ownUserId(){ return getLS("userId",""); }
function prettyOrigin(){
  if(location.origin && location.origin.startsWith("http")) return location.origin;
  return "https://eurovilla.lt";
}
/** Lien court :
 *  r = id court esthétique (5 chars)
 *  z = upline compressée (base64url)
 *  c = canal (wa|em|cp)
 *  sn = nonce (ajouté dynamiquement)
 */
function buildReferralLinkShort(userId, channel){
  const chain = [userId].concat(getLS("upline", []));
  const z = chainTokenFromUpline(chain);
  const r = shortId(userId);
  const base = new URL(prettyOrigin() + location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
  base.searchParams.set("r", r);
  base.searchParams.set("z", z);
  base.searchParams.set("c", channel);
  return base.toString();
}

/* -------------------- Atterrissage avec r/z/rc/ref + log click -------------------- */
(function referralLanding(){
  const url = new URL(location.href);
  const z  = url.searchParams.get("z");
  const rc = url.searchParams.get("rc");
  const ref= url.searchParams.get("ref");
  const r  = url.searchParams.get("r"); // publicId esthétique
  const c  = url.searchParams.get("c") || ""; // canal transporté

  let chain = [];
  if(z){ chain = uplineFromChainToken(z); }
  else if(rc){ chain = rc.split(",").filter(Boolean); }
  else if(ref){ chain = [ref]; }
  // Si on a uniquement r (publicId), le backend résout dans action=click
  if(chain.length){ setLS("upline", chain); }

  const refKey = (chain[0]||"") + ":" + (z||rc||ref||r||"");
  const key = "click_logged_"+refKey;
  if(getLS(key)) return; // ne log pas 2x le même clic

  postForm(API.BASE, {
    action: "click",
    timestamp: new Date().toISOString(),
    referrerId: chain[0] || "",
    refChain: chain.slice(1).join(","),
    fingerprint: simpleFingerprint(),
    pageUrl: location.href,
    userAgent: navigator.userAgent
    // (r/c/sn sont lus côté backend à partir de pageUrl)
  }).then(()=> setLS(key,1)).catch(()=>{});
})();

/* -------------------- Nonces de partage + ack -------------------- */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

  // Construit lien court + ajoute le nonce
  const base = uid ? buildReferralLinkShort(uid, channel) : (()=>{
    const url=new URL(prettyOrigin() + location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
    const chain = getLS("upline", []);
    if(chain.length){ url.searchParams.set("z", chainTokenFromUpline(chain)); }
    url.searchParams.set("c", channel);
    return url.toString();
  })();
  const u = new URL(base); u.searchParams.set("sn", nonce);

  postForm(API.BASE, { action:"share-start", nonce, userId:uid||"", channel, pageUrl:location.href }).catch(()=>{});

  return { nonce, url: u.toString() };
}
async function pollAck(nonce, ms=6000){
  const start=Date.now();
  while(Date.now()-start < ms){
    try{
      const q=new URL(API.BASE); q.searchParams.set("action","share-ack"); q.searchParams.set("nonce", nonce);
      const r=await fetchJSON(q.toString(), {method:"GET"});
      if(r && r.ok && r.ack===true) return true;
    }catch{}
    await sleep(800);
  }
  return false;
}

/* -------------------- Partages -------------------- */
async function shareWhatsApp(){
  const { nonce, url } = await shareStart("wa");
  const text = `Je participe à Eurovilla.lt pour gagner une villa d’exception ! Inscris-toi ici (ça me donne des points) : ${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;

  if(navigator.share){
    try{ await navigator.share({ text, url }); pollAck(nonce).then(ok=> ok && toast("Lien WhatsApp ouvert ✅")); }
    catch{ window.open(wa,"_blank"); }
  }else{
    window.open(wa,"_blank");
  }
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

/* -------------------- Snapshot utilisateur (polling 5s) -------------------- */
async function fetchUserSnapshot(userId){
  try{
    const u=new URL(API.BASE);
    u.searchParams.set("action","user");
    u.searchParams.set("userId", userId);
    const r = await fetchJSON(u.toString(), { method:"GET" });
    return r && r.ok ? r : null;
  }catch{ return null; }
}
function updateUserUI(snapshot){
  if(!snapshot) return;
  if(snapshot.points != null) setPointsUI(Number(snapshot.points));
  const elPts=$("#me-points"); if(elPts) elPts.textContent = snapshot.points ?? "";
  $("#me-referrals-l1")?.textContent = snapshot.referralsL1 ?? 0;
  $("#me-referrals-l2")?.textContent = snapshot.referralsL2 ?? 0;
  $("#me-referrals-l3")?.textContent = snapshot.referralsL3 ?? 0;

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
  const tick = async ()=> updateUserUI(await fetchUserSnapshot(uid));
  if(pollTimer) clearInterval(pollTimer);
  tick(); pollTimer = setInterval(tick, 5000);
}

/* -------------------- Mémoire identité & login doux -------------------- */
function rememberIdentity({email, phone, country, channels}){
  if(email) setLS("email", email);
  if(phone) setLS("phone", phone);
  if(country) setLS("country", country);
  if(channels) setLS("channels", channels);
}
function prefillFormIfAny(form){
  if(!form) return;
  const email = getLS("email",""); if(email && form.elements.email) form.elements.email.value = email;
  const phone = getLS("phone",""); if(phone && form.elements.phone) form.elements.phone.value = phone;
  const country = getLS("country",""); if(country && form.elements.country) form.elements.country.value = country;
  const channels = (getLS("channels","")||"").split(",").filter(Boolean);
  if(channels.length){
    channels.forEach(val=>{
      const box = form.querySelector(`input[name="contact"][value="${val}"]`);
      if(box) box.checked = true;
    });
  }
}
async function softLogin(email, phone){
  if(!email && !phone){ toast("Entre un email ou un téléphone."); return; }
  const payload = {
    action: "register",
    firstName: "—",
    lastName: "—",
    email: email||"",
    phone: phone||"",
    country: getLS("country","Lituanie") || "Lituanie",
    contactAll: getLS("channels","email"),
    userAgent: navigator.userAgent
  };
  const res = await postForm(API.BASE, payload).catch(()=>null);
  if(res && res.ok){
    setLS("userId", res.userId);
    rememberIdentity({email, phone});
    startUserPolling();
    toast("Compte synchronisé ✅");
  }else if(res && res.code==="ALREADY_REGISTERED"){
    setLS("userId", res.userId);
    rememberIdentity({email, phone});
    startUserPolling();
    toast("Bienvenue, on a retrouvé ton compte ✅");
  }else{
    toast("Impossible de retrouver un compte avec ces infos.");
  }
}

/* -------------------- Formulaire d’inscription -------------------- */
(function formInit(){
  const form=$("#signup-form"); 
  if(!form){ startUserPolling(); return; }

  // Upline depuis URL (z/rc/ref) → LS
  const url = new URL(location.href);
  const z  = url.searchParams.get("z");
  const rc = url.searchParams.get("rc");
  const ref= url.searchParams.get("ref");
  let chain = [];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];
  if(chain.length){
    setLS("upline", chain);
    $("#referrerId") && ($("#referrerId").value = chain[0]); // compat si le champ existe
  }

  // Pays par défaut = Lituanie si rien choisi
  if(form.elements.country && !form.elements.country.value){
    form.elements.country.value = "Lituanie";
  }

  // Préremplir (email, phone, country, channels)
  prefillFormIfAny(form);

  // Bind partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // Login doux (si la modale existe dans ton HTML)
  $("[data-action='login']")?.addEventListener("click", async (e)=>{
    e.preventDefault();
    const email = ($("#login-form input[name='email']")||{}).value || "";
    const phone = ($("#login-form input[name='phone']")||{}).value || "";
    await softLogin(email.trim(), phone.trim());
  });

  // Anti double-submit
  let submitting=false;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(submitting) return;
    submitting=true;

    const success=$("#signup-success"), error=$("#signup-error");
    success?.setAttribute("hidden",""); error?.setAttribute("hidden","");

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // Canaux (cases)
    const channels = $$("input[name='contact']:checked", form).map(x=>x.value);
    payload.contactAll = channels.join(",");

    if(!countryIsEU(payload.country)){
      error.textContent="Pays de résidence non éligible (UE uniquement).";
      error?.removeAttribute("hidden");
      submitting=false; 
      return;
    }

    const upline = getLS("upline", []);
    const resPayload = {
      action: "register",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      country: payload.country,
      contactAll: payload.contactAll,
      referrerId: (upline[0]||""),
      refChain: (upline.slice(1)||[]).join(","),
      fingerprint: simpleFingerprint(),
      campaign: payload.campaign || "",
      userAgent: navigator.userAgent,
      ip: ""
    };

    try{
      const res = await postForm(API.BASE, resPayload);
      if(res && res.ok){
        const serverUserId = res.userId || uid();
        setLS("userId", serverUserId);
        rememberIdentity({ 
          email: payload.email, 
          phone: payload.phone, 
          country: payload.country,
          channels: payload.contactAll
        });
        setPointsUI(Number(res.points||1));
        const refInput=$("#ref-link");
        if(refInput){ refInput.value = buildReferralLinkShort(serverUserId,"cp"); }
        success?.removeAttribute("hidden");
        // Ouvre la modale de félicitations si présente
        $("#congrats-modal") ? $("#congrats-modal").removeAttribute("hidden") : null;
        // Scroll vers la zone points
        location.hash="#points";
        toast("Inscription réussie ✅");
        startUserPolling();
      }else if(res && res.code==="ALREADY_REGISTERED"){
        // Anti-doublon UX douce : on récupère l'user et on sync
        setLS("userId", res.userId);
        rememberIdentity({ 
          email: payload.email, 
          phone: payload.phone, 
          country: payload.country,
          channels: payload.contactAll
        });
        setPointsUI(Number(res.points||1));
        success?.removeAttribute("hidden");
        toast("Tu es déjà inscrit(e) — points synchronisés ✅");
        startUserPolling();
      }else{
        error.textContent = (res && res.message) ? res.message : "Impossible d’enregistrer pour le moment.";
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

/* -------------------- Hydrate, polling & interactions globales -------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // Préparer le lien court si déjà loggé
  const uid = ownUserId();
  const refInput=$("#ref-link");
  if(refInput && uid){ refInput.value = buildReferralLinkShort(uid,"cp"); }

  setPointsUI(getLS("points_ui", 1));
  startUserPolling();

  // Boutons de partage (header/ailleurs)
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  // CTA modale “Gagner plus de points”
  $("#cta-more-points")?.addEventListener("click", ()=>{
    $("#congrats-modal")?.setAttribute("hidden","");
    document.querySelector("#section-points")?.scrollIntoView({behavior:"smooth"});
  });

  // Online / offline feedback
  window.addEventListener("offline", ()=> toast("Connexion perdue. Certaines actions seront en attente."));
  window.addEventListener("online",  ()=> toast("Connexion rétablie ✅"));

  // Rafraîchit le snapshot quand l’onglet revient au 1er plan
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState==="visible"){
      const uid = ownUserId();
      if(uid) fetchUserSnapshot(uid).then(updateUserUI).catch(()=>{});
    }
  });
});
