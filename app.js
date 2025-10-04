/* ==========================================================
   Eurovilla.lt — app.js (liens courts + polling + multi-niveaux)
   ========================================================== */

const API = {
  BASE: "https://script.google.com/macros/s/AKfycbx0PahxiURVZ_110-KaOsJEdP0DduSqwz0dxTgQ1R3eS4uX0TKiW3HI6k_beXLrsyJFig/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};

const DRAW_DATE = new Date("2025-10-31T23:59:59");

/* -------------------- Utils -------------------- */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const pad2 = n => String(n).padStart(2,"0");
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function setLS(k,v){ try{ localStorage.setItem(k, typeof v==="string"?v:JSON.stringify(v)); }catch{} }
function getLS(k,def=null){ try{ const v=localStorage.getItem(k); return v==null?def:(v.startsWith("{")||v.startsWith("[")?JSON.parse(v):v);}catch{return def;} }

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

// Encodage URL-encoded SANS headers -> pas de préflight
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
      body: toUrlParams(data), // PAS de headers -> simple request
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

function uid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }
function shortId(uid){
  // Id court esthétique (8 chars) basé sur uid
  try{
    let h=0; for(let i=0;i<uid.length;i++){ h=((h<<5)-h)+uid.charCodeAt(i); h|=0; }
    const base = Math.abs(h).toString(36);
    return base.slice(-8);
  }catch{ return uid.slice(-8); }
}
function simpleFingerprint(){
  try{
    const data=[navigator.userAgent,navigator.language,screen.width+"x"+screen.height,(Intl.DateTimeFormat().resolvedOptions().timeZone||"")].join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_"+Math.abs(h);
  }catch{ return "fp_unknown"; }
}
function getParam(name){ const u=new URL(location.href); return u.searchParams.get(name); }

/* -------- Base64url pour compresser la chaîne multi-niveaux -------- */
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

/* --------- UE --------- */
function countryIsEU(label){
  return [
    "Allemagne","Autriche","Belgique","Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande",
    "France","Grèce","Hongrie","Irlande","Italie","Lettonie","Lituanie","Luxembourg","Malte","Pays-Bas",
    "Pologne","Portugal","Roumanie","Slovaquie","Slovénie","Suède"
  ].includes((label||"").trim());
}

/* -------------------- Thème -------------------- */
(function themeInit(){
  const root=document.documentElement, btn=$("#toggle-theme");
  const saved=getLS("theme"); if(saved==="light"||saved==="dark") root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", ()=>{
    const cur=root.getAttribute("data-theme")==="light"?"dark":"light";
    root.setAttribute("data-theme", cur); setLS("theme", cur);
  });
})();

/* -------------------- Countdown -------------------- */
(function countdown(){
  const d=$("#d"),h=$("#h"),m=$("#m"),s=$("#s"); if(!d||!h||!m||!s) return;
  const tick=()=>{
    const diff=Math.max(0, DRAW_DATE - new Date());
    const D=Math.floor(diff/86400000), H=Math.floor((diff/3600000)%24), M=Math.floor((diff/60000)%60), S=Math.floor((diff/1000)%60);
    d.textContent=D; h.textContent=pad2(H); m.textContent=pad2(M); s.textContent=pad2(S);
  };
  tick(); setInterval(tick,1000);
})();

/* -------------------- Modale 360° -------------------- */
(function modal360(){
  const modal=$("#modal-360"), body=$("#modal-360-body");
  const openBtns=$$("[data-open='modal-360']"); const closers=$$("[data-action='close-modal']");
  function open(){
    if(!modal) return;
    if(body && !body.dataset.loaded){
      body.innerHTML=`
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;border:1px solid rgba(0,0,0,.1)">
          <iframe src="https://www.youtube.com/embed/VIDEO_360_ID?rel=0"
                  title="Visite 360°"
                  style="position:absolute;inset:0;width:100%;height:100%;border:0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>
        </div>`;
      body.dataset.loaded="1";
    }
    modal.removeAttribute("hidden"); modal.setAttribute("aria-hidden","false");
  }
  function close(){ if(!modal) return; modal.setAttribute("aria-hidden","true"); modal.setAttribute("hidden",""); }
  openBtns.forEach(b=>b.addEventListener("click", open));
  closers.forEach(c=>c.addEventListener("click", close));
  document.addEventListener("keydown", e=>e.key==="Escape"&&close());
})();

/* -------------------- Points UI -------------------- */
const POINTS_MAX=50; // barre visuelle
function setPointsUI(n){
  const pts=Math.max(1, Number(n||1)); setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar) bar.style.width=pct+"%"; if(lab) lab.textContent=pct+"%";
}
setPointsUI(getLS("points_ui", 1));

/* -------------------- Toast -------------------- */
function toast(msg){
  let t=$("#toast-hint");
  if(!t){
    t=document.createElement("div"); t.id="toast-hint";
    Object.assign(t.style,{position:"fixed",left:"50%",bottom:"24px",transform:"translateX(-50%)",background:"rgba(0,0,0,.75)",color:"#fff",padding:"10px 14px",borderRadius:"10px",zIndex:"9999",fontWeight:"700",backdropFilter:"blur(4px)",maxWidth:"90%",textAlign:"center"});
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; t.style.transition="none";
  setTimeout(()=>{ t.style.transition="opacity .5s"; t.style.opacity="0"; }, 1900);
}

/* -------------------- Referral utils (lien court) -------------------- */
function ownUserId(){ return getLS("userId",""); }

/** Construit la chaîne multi-niveaux (upline) et la compresse en base64url (z) */
function chainTokenFromUpline(upline){
  // upline: tableau ["uid_L1","uid_L2","uid_L3", ...] (proche -> loin)
  const csv = (upline||[]).join(",");
  return b64urlEncode(csv); // z
}

/** Décode le token z -> tableau upline */
function uplineFromChainToken(z){
  const csv = b64urlDecode(z || "");
  if(!csv) return [];
  return csv.split(",").map(s=>s.trim()).filter(Boolean);
}

/** Détermine un origin "propre" à afficher/coller même en file:// */
function prettyOrigin(){
  if(location.origin && location.origin.startsWith("http")) return location.origin;
  return "https://eurovilla.lt"; // fallback esthétique
}

/** Lien de parrainage court :
 *  - r = id court esthétique du parrain
 *  - z = upline compressée (base64url)
 *  - sn = nonce
 *  - c = canal (wa|em|cp)
 */
function buildReferralLinkShort(userId, channel){
  const chain = [userId].concat(getLS("upline", [])); // on garde la chaîne complète (illimitée)
  const z = chainTokenFromUpline(chain);
  const r = shortId(userId);
  const base = new URL(prettyOrigin() + location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
  base.searchParams.set("r", r);
  base.searchParams.set("z", z);
  base.searchParams.set("c", channel);
  return base.toString();
}

/* -------------------- Landing: click tracking (r/z/sn) -------------------- */
(function referralLanding(){
  const url = new URL(location.href);
  const r  = url.searchParams.get("r");        // id court (esthétique)
  const z  = url.searchParams.get("z");        // chaîne compressée (source de vérité)
  const rc = url.searchParams.get("rc");       // compat (ancien)
  const ref = url.searchParams.get("ref");     // compat (ancien)

  let chain = [];
  if(z){ chain = uplineFromChainToken(z); }
  else if(rc){ chain = rc.split(",").filter(Boolean); }
  else if(ref){ chain = [ref]; }

  if(chain.length){
    setLS("upline", chain); // on mémorise toute la chaîne (illimitée)
  }

  // Anti "double log click"
  const refKey = (chain[0]||"") + ":" + (z||rc||"");
  const key = "click_logged_"+refKey;
  if(!chain.length || getLS(key)) return;

  postForm(API.BASE, {
    action: "click",
    timestamp: new Date().toISOString(),
    referrerId: chain[0] || "",          // L1 réel
    refChain: chain.slice(1).join(","),  // le reste de la chaîne
    fingerprint: simpleFingerprint(),
    pageUrl: location.href,
    userAgent: navigator.userAgent
  }).then(()=> setLS(key,1)).catch(()=>{});
})();

/* -------------------- Nonces de partage (sn) -------------------- */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

  // Construit lien court + ajoute le nonce
  const base = uid ? buildReferralLinkShort(uid, channel) : (()=>{
    const url=new URL(prettyOrigin() + location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
    // s'il y avait déjà une upline (tu arrives via le lien d'un ami et tu n'es pas inscrit)
    const chain = getLS("upline", []);
    if(chain.length){
      url.searchParams.set("z", chainTokenFromUpline(chain));
    }
    url.searchParams.set("c", channel);
    return url.toString();
  })();

  const u = new URL(base); u.searchParams.set("sn", nonce);

  postForm(API.BASE, {
    action: "share-start",
    nonce,
    userId: uid || "",
    channel,
    pageUrl: location.href
  }).catch(()=>{});

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

/* -------------------- Polling: snapshot user (points + referrals) -------------------- */
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
function startUserPolling(){
  const uid = ownUserId();
  if(!uid) return; // pas encore inscrit
  const updateMe = async ()=> updateUserUI(await fetchUserSnapshot(uid));
  updateMe(); setInterval(updateMe, 5000); // toutes les 5s
}

/* -------------------- Formulaire (REGISTER) -------------------- */
(function formInit(){
  const form=$("#signup-form"); if(!form){ startUserPolling(); return; }

  // Récupère z/rc/ref sur la landing pour construire upline
  const url = new URL(location.href);
  const z  = url.searchParams.get("z");
  const rc = url.searchParams.get("rc");
  const ref= url.searchParams.get("ref");

  let chain = [];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];

  if(chain.length){
    setLS("upline", chain);         // chaîne illimitée pour admin
    $("#referrerId") && ($("#referrerId").value = chain[0]); // L1 pour compat
  }

  $("#fingerprint").value = simpleFingerprint();

  // Bind partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const success=$("#signup-success"), error=$("#signup-error");
    success?.setAttribute("hidden",""); error?.setAttribute("hidden","");

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    if(!countryIsEU(payload.country)){
      error.textContent="Pays de résidence non éligible (UE uniquement).";
      return error.removeAttribute("hidden");
    }

    const upline = getLS("upline", []); // toute la chaîne
    const resPayload = {
      action: "register",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      country: payload.country,
      contactAll: payload.contactAll,
      referrerId: (upline[0]||""),               // L1 réel
      refChain: (upline.slice(1)||[]).join(","), // le reste (L2, L3, ...)
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
        setPointsUI(Number(res.points||1));
        // ton champ de copie (facultatif)
        const refInput=$("#ref-link");
        if(refInput){ refInput.value = buildReferralLinkShort(serverUserId,"cp"); }
        success?.removeAttribute("hidden");
        location.hash="#points";
        toast("Inscription réussie ✅");
        startUserPolling();
      }else{
        error.textContent = (res && res.message) ? res.message : "Impossible d’enregistrer pour le moment.";
        error?.removeAttribute("hidden");
      }
    }catch(err){
      console.error(err);
      error.textContent="Réseau indisponible. Merci de réessayer.";
      error?.removeAttribute("hidden");
    }
  });
})();

/* -------------------- Ready: hydrate & polling -------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // si déjà loggé, prépare le lien court à copier
  const uid = ownUserId();
  const refInput=$("#ref-link");
  if(refInput && uid){ refInput.value = buildReferralLinkShort(uid,"cp"); }
  startUserPolling();
});

/* -------------------- Bind boutons global -------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);
});

/* -------------------- Stats live (optionnel) -------------------- */
(async function syncStats(){
  try{
    const u=new URL(API.BASE); u.searchParams.set("action","stats");
    const r=await fetchJSON(u.toString(), {method:"GET"});
    const c=$("#counter-left"); if(c && r && r.totalParticipants!=null) c.textContent=r.totalParticipants.toLocaleString("fr-FR");
  }catch{}
})();
