/* ==========================================================
   Eurovilla.lt — app.js (v4.3 stable)
   - Mode clair/sombre OK
   - Anti-doublons auto (ALREADY_REGISTERED) sans “retrouver mon compte”
   - Polling points 5s + progression lisse
   - Compte à rebours + compteur participants (fallback 0)
   - Partage WhatsApp / Email / Copie (nonce + ack)
   - Liens courts r/z/sn/c
   - Pays par défaut = Lituanie
   - Modales vidéo & félicitations
   ========================================================== */

const API = {
  BASE: "https://script.google.com/macros/s/AKfycbx0PahxiURVZ_110-KaOsJEdP0DduSqwz0dxTgQ1R3eS4uX0TKiW3HI6k_beXLrsyJFig/exec",
  TIMEOUT_MS: 12000,
  RETRIES: 2
};
const DRAW_DATE = new Date("2025-10-31T23:59:59");

const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const pad2 = n => String(n).padStart(2,"0");
const sleep = ms => new Promise(r=>setTimeout(r,ms));

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
    const res = await fetch(url, { method:"POST", body: toUrlParams(data), mode:"cors", redirect:"follow", signal: ctrl.signal });
    clearTimeout(t);
    if(!res.ok) throw new Error("HTTP "+res.status);
    return await res.json().catch(()=> ({}));
  }catch(err){
    clearTimeout(t);
    if(retries>0){ await sleep(350*(API.RETRIES-retries+1)); return postForm(url, data, retries-1); }
    throw err;
  }
}

/* ---------- thème ---------- */
(function themeInit(){
  const root=document.documentElement, btn=$("#toggle-theme");
  // défaut: dark, mais mémorise si on bascule
  const saved=getLS("theme"); if(saved==="light"||saved==="dark") root.setAttribute("data-theme", saved);
  btn?.addEventListener("click", ()=>{
    const cur=root.getAttribute("data-theme")==="light"?"dark":"light";
    root.setAttribute("data-theme", cur); setLS("theme", cur);
  });
})();

/* ---------- compte à rebours + stats ---------- */
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
    else if(c) c.textContent="0";
  }catch{ const c=$("#counter-left"); if(c) c.textContent="0"; }
})();

/* ---------- Modale vidéo 360 + modales génériques ---------- */
(function modals(){
  function open(id){ const m=$(id); if(!m) return; m.removeAttribute("hidden"); }
  function close(el){ el.setAttribute("hidden",""); }
  // vidéo 360
  $$("[data-open='modal-360']").forEach(b=> b.addEventListener("click", ()=> open("#modal-360")));
  document.addEventListener("click",(e)=>{
    const closeBtn = e.target.closest("[data-action='close-modal']");
    if(closeBtn){
      const modal = closeBtn.closest(".modal");
      modal && close(modal);
    }
    if(e.target.classList.contains("modal-backdrop")){
      const modal = e.target.closest(".modal");
      modal && close(modal);
    }
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      $$(".modal:not([hidden])").forEach(m=> m.setAttribute("hidden",""));
    }
  });
})();

/* ---------- toasts ---------- */
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

/* ---------- points UI ---------- */
const POINTS_MAX=50;
function setPointsUI(n){
  const pts=Math.max(1, Number(n||1));
  setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar){ bar.style.transition="width .6s ease"; bar.style.width=pct+"%"; }
  if(lab) lab.textContent=pct+"%";
}

/* ---------- liens & referrals ---------- */
function ownUserId(){ return getLS("userId",""); }
function shortId(userId){ try{ let h=0; for(let i=0;i<userId.length;i++){ h=((h<<5)-h)+userId.charCodeAt(i); h|=0;} return Math.abs(h).toString(36).slice(-5);}catch{return userId.slice(-5);} }
function b64urlEncode(str){ try{ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }catch{return "";}}
function b64urlDecode(str){ try{ const pad=str.length%4===2?"==":str.length%4===3?"=":""; return decodeURIComponent(escape(atob(str.replace(/-/g,"+").replace(/_/g,"/")+pad))); }catch{return "";} }
function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ const csv=b64urlDecode(z||""); return csv? csv.split(",").map(s=>s.trim()).filter(Boolean):[]; }
function prettyOrigin(){ if(location.origin && location.origin.startsWith("http")) return location.origin; return "https://eurovilla.lt"; }
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

/* Atterrissage : mémoriser la chaîne + log click */
(function referralLanding(){
  const url = new URL(location.href);
  const z  = url.searchParams.get("z");
  const rc = url.searchParams.get("rc");
  const ref= url.searchParams.get("ref");
  let chain = [];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];
  if(chain.length){ setLS("upline", chain); }

  const refKey = (chain[0]||"") + ":" + (z||rc||ref||"");
  const key = "click_logged_"+refKey;
  if(getLS(key)) return;

  postForm(API.BASE, {
    action: "click",
    timestamp: new Date().toISOString(),
    referrerId: chain[0] || "",
    refChain: chain.slice(1).join(","),
    fingerprint: simpleFingerprint(),
    pageUrl: location.href,
    userAgent: navigator.userAgent
  }).then(()=> setLS(key,1)).catch(()=>{});
})();

function simpleFingerprint(){
  try{
    const data=[navigator.userAgent,navigator.language,screen.width+"x"+screen.height,(Intl.DateTimeFormat().resolvedOptions().timeZone||"")].join("|");
    let h=0; for(let i=0;i<data.length;i++){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return "fp_"+Math.abs(h);
  }catch{ return "fp_unknown"; }
}

/* ---------- partage ---------- */
async function shareStart(channel){
  const uid = ownUserId();
  const nonce = (uid? uid+"_":"") + "sn_" + Date.now().toString(36);
  setLS("last_share_nonce", nonce);

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

/* ---------- snapshot (polling) ---------- */
async function fetchUserSnapshot(userId){
  try{
    const u=new URL(API.BASE); u.searchParams.set("action","user"); u.searchParams.set("userId", userId);
    const r = await fetchJSON(u.toString(), { method:"GET" });
    return r && r.ok ? r : null;
  }catch{ return null; }
}
function updateUserUI(snapshot){
  if(!snapshot) return;
  if(snapshot.points != null) setPointsUI(Number(snapshot.points));
}
let pollTimer=null;
function startUserPolling(){
  const uid = ownUserId(); if(!uid) return;
  const tick = async ()=> updateUserUI(await fetchUserSnapshot(uid));
  if(pollTimer) clearInterval(pollTimer);
  tick(); pollTimer = setInterval(tick, 5000);
}

/* ---------- validation visuelle formulaire ---------- */
function setInvalid(el, invalid){
  const wrap = el.closest(".has-validation");
  if(!wrap) return;
  if(invalid) wrap.classList.add("invalid"); else wrap.classList.remove("invalid");
}
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||"").trim()); }
function validPhone(v){ return /^\+?\d[\d\s.-]{5,}$/.test(String(v||"").trim()); }

/* ---------- formulaire ---------- */
(function formInit(){
  const form=$("#signup-form"); 
  if(!form){ startUserPolling(); return; }

  // Pays défaut Lituanie si vide
  if(form.elements.country && !form.elements.country.value){ form.elements.country.value = "Lituanie"; }

  // Upline depuis URL
  const u = new URL(location.href);
  const z  = u.searchParams.get("z");
  const rc = u.searchParams.get("rc");
  const ref= u.searchParams.get("ref");
  let chain = [];
  if(z) chain = uplineFromChainToken(z);
  else if(rc) chain = rc.split(",").filter(Boolean);
  else if(ref) chain = [ref];
  if(chain.length){
    setLS("upline", chain);
    $("#referrerId") && ($("#referrerId").value = chain[0]);
  }

  // pré-remplissage simple si déjà visité
  const savedEmail = getLS("email",""); if(savedEmail) form.elements.email.value = savedEmail;
  const savedPhone = getLS("phone",""); if(savedPhone) form.elements.phone.value = savedPhone;

  // partages
  $("[data-action='share-whatsapp']")?.addEventListener("click", shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click", shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click", copyReferral);

  let submitting=false;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(submitting) return;
    submitting=true;

    const success=$("#signup-success"), error=$("#signup-error");
    success?.setAttribute("hidden",""); error?.setAttribute("hidden","");

    const firstName = form.elements.firstName.value.trim();
    const lastName  = form.elements.lastName.value.trim();
    const email     = form.elements.email.value.trim();
    const phone     = form.elements.phone.value.trim();
    const country   = form.elements.country.value.trim();

    setInvalid(form.elements.firstName, !firstName);
    setInvalid(form.elements.lastName,  !lastName);
    setInvalid(form.elements.email,     !validEmail(email));
    setInvalid(form.elements.phone,     !validPhone(phone));
    if(!firstName || !lastName || !validEmail(email) || !validPhone(phone)){
      error.textContent="Merci de compléter correctement les champs requis.";
      error.removeAttribute("hidden");
      submitting=false; return;
    }
    if(!countryIsEU(country)){
      error.textContent="Pays de résidence non éligible (UE uniquement).";
      error.removeAttribute("hidden");
      submitting=false; return;
    }

    const channels = $$("input[name='contact']:checked", form).map(x=>x.value).join(",");
    const upline = getLS("upline", []);
    const payload = {
      action: "register",
      firstName, lastName, email, phone,
      country, contactAll: channels,
      referrerId: (upline[0]||""),
      refChain: (upline.slice(1)||[]).join(","),
      fingerprint: simpleFingerprint(),
      campaign: form.elements.campaign.value || "",
      userAgent: navigator.userAgent,
      ip: ""
    };

    try{
      const res = await postForm(API.BASE, payload);
      if(res && res.ok){
        const uid = res.userId;
        setLS("userId", uid);
        setLS("email", email); setLS("phone", phone);
        setPointsUI(Number(res.points||1));
        const refInput=$("#ref-link"); if(refInput){ refInput.value = buildReferralLinkShort(uid,"cp"); }
        success.removeAttribute("hidden");
        $("#congrats-modal")?.removeAttribute("hidden");
        location.hash="#points";
        startUserPolling();
      }else if(res && res.code==="ALREADY_REGISTERED"){
        // Auto : “vous êtes déjà inscrit” + on affiche ses points
        const uid = res.userId;
        setLS("userId", uid);
        setLS("email", email); setLS("phone", phone);
        setPointsUI(Number(res.points||1));
        const refInput=$("#ref-link"); if(refInput){ refInput.value = buildReferralLinkShort(uid,"cp"); }
        success.textContent = "Vous êtes déjà inscrit(e). Vos points sont synchronisés 🎉";
        success.removeAttribute("hidden");
        $("#congrats-modal")?.removeAttribute("hidden");
        location.hash="#points";
        startUserPolling();
      }else{
        error.textContent = (res && res.message) ? res.message : "Impossible d’enregistrer pour le moment.";
        error.removeAttribute("hidden");
      }
    }catch(err){
      console.error(err);
      error.textContent="Réseau indisponible. Merci de réessayer.";
      error.removeAttribute("hidden");
    }finally{
      submitting=false;
    }
  });
})();

/* ---------- ready ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  const uid = getLS("userId","");
  const refInput=$("#ref-link");
  if(refInput && uid){ refInput.value = buildReferralLinkShort(uid,"cp"); }
  setPointsUI(getLS("points_ui", 1));
  if(uid) startUserPolling();

  // CTA modale “Gagner plus de points”
  $("#cta-more-points")?.addEventListener("click", ()=>{
    $("#congrats-modal")?.setAttribute("hidden","");
    document.querySelector("#points")?.scrollIntoView({behavior:"smooth"});
  });

  // états réseau
  window.addEventListener("offline", ()=> toast("Connexion perdue"));
  window.addEventListener("online",  ()=> toast("Connexion rétablie ✅"));

  // Refresh snapshot au retour onglet
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState==="visible"){
      const uid = getLS("userId","");
      if(uid) fetchUserSnapshot(uid).then(updateUserUI).catch(()=>{});
    }
  });
});

/* ---------- EU check ---------- */
function countryIsEU(label){
  return [
    "Allemagne","Autriche","Belgique","Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande",
    "France","Grèce","Hongrie","Irlande","Italie","Lettonie","Lituanie","Luxembourg","Malte","Pays-Bas",
    "Pologne","Portugal","Roumanie","Slovaquie","Slovénie","Suède"
  ].includes((label||"").trim());
}
