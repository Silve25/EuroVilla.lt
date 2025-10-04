/* ==========================================================
   Eurovilla.lt — app.js (réf. courtes + anti-doublons + gamification)
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

function uid(prefix="u_"){ return prefix + Math.random().toString(36).slice(2,10); }
function shortId(uid){
  // Id très court esthétique (5-6 chars)
  try{
    let h=0; for(let i=0;i<uid.length;i++){ h=((h<<5)-h)+uid.charCodeAt(i); h|=0; }
    const base = Math.abs(h).toString(36);
    return base.slice(-6);
  }catch{ return uid.slice(-6); }
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

/* -------------------- Points UI + confettis -------------------- */
const POINTS_MAX=50;
function setPointsUI(n){
  const pts=Math.max(1, Number(n||1)); setLS("points_ui", pts);
  const score=$("#score-points"); if(score) score.textContent=pts;
  const pct=Math.round(Math.min(100, pts/POINTS_MAX*100));
  const bar=$("#progress-bar"), lab=$("#progress-label");
  if(bar){ bar.style.width=pct+"%"; bar.style.transition="width .6s"; }
  if(lab) lab.textContent=pct+"%";
}
setPointsUI(getLS("points_ui", 1));

function confetti(){
  const el=document.createElement("div");
  el.innerHTML="🎉";
  Object.assign(el.style,{position:"fixed",left:Math.random()*100+"%",top:"-20px",fontSize:"24px",animation:"fall 2s linear forwards"});
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),2000);
}
setInterval(confetti,6000);

/* -------------------- Toast -------------------- */
function toast(msg){
  let t=$("#toast-hint");
  if(!t){
    t=document.createElement("div"); t.id="toast-hint";
    Object.assign(t.style,{position:"fixed",left:"50%",bottom:"24px",transform:"translateX(-50%)",background:"rgba(0,0,0,.8)",color:"#fff",padding:"10px 14px",borderRadius:"10px",zIndex:"9999",fontWeight:"700"});
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; t.style.transition="none";
  setTimeout(()=>{ t.style.transition="opacity .5s"; t.style.opacity="0"; }, 1900);
}

/* -------------------- Referral utils -------------------- */
function ownUserId(){ return getLS("userId",""); }
function chainTokenFromUpline(upline){ return b64urlEncode((upline||[]).join(",")); }
function uplineFromChainToken(z){ return (b64urlDecode(z||"")||"").split(",").filter(Boolean); }
function prettyOrigin(){ return (location.origin.startsWith("http")?location.origin:"https://eurovilla.lt"); }
function buildReferralLinkShort(userId, channel){
  const chain=[userId].concat(getLS("upline",[]));
  const z=chainTokenFromUpline(chain);
  const r=shortId(userId);
  const base=new URL(prettyOrigin()+location.pathname.replace(/^file:.*?\/([^/]+)$/, "/$1"));
  base.searchParams.set("r",r); base.searchParams.set("z",z); base.searchParams.set("c",channel);
  return base.toString();
}

/* -------------------- Polling user -------------------- */
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
  $("#me-points")?.textContent = snapshot.points ?? "";
  $("#me-referrals-l1")?.textContent = snapshot.referralsL1 ?? 0;
  $("#me-referrals-l2")?.textContent = snapshot.referralsL2 ?? 0;
  $("#me-referrals-l3")?.textContent = snapshot.referralsL3 ?? 0;
}
function startUserPolling(){
  const uid = ownUserId(); if(!uid) return;
  const updateMe=async()=>updateUserUI(await fetchUserSnapshot(uid));
  updateMe(); setInterval(updateMe,5000);
}

/* -------------------- Partages -------------------- */
async function shareWhatsApp(){
  const uid=ownUserId(); if(!uid){toast("Inscris-toi d’abord !"); return;}
  const url=buildReferralLinkShort(uid,"wa");
  const text=`Je participe à Eurovilla.lt pour gagner une villa 🏡 ! Rejoins-moi ici : ${url}`;
  window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");
}
async function shareEmail(){
  const uid=ownUserId(); if(!uid){toast("Inscris-toi d’abord !"); return;}
  const url=buildReferralLinkShort(uid,"em");
  const subject="Rejoins-moi sur Eurovilla.lt 🏡";
  const body=`Participe gratuitement et tente ta chance pour gagner la villa : ${url}`;
  window.location.href=`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
async function copyReferral(){
  const uid=ownUserId(); if(!uid){toast("Inscris-toi d’abord !"); return;}
  const url=buildReferralLinkShort(uid,"cp");
  await navigator.clipboard.writeText(url);
  toast("Lien copié 👍");
}

/* -------------------- Formulaire inscription -------------------- */
(function formInit(){
  const form=$("#signup-form"); if(!form){ startUserPolling(); return; }

  // défaut pays = Lituanie
  const countrySelect=form.querySelector("select[name='country']");
  if(countrySelect) countrySelect.value="Lituanie";

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const payload=Object.fromEntries(fd.entries());

    // récupère les cases cochées (canaux)
    payload.contactAll=$$("input[name='contact']:checked",form).map(x=>x.value).join(",");

    if(!countryIsEU(payload.country)){
      toast("Pays non éligible (UE uniquement)."); return;
    }

    try{
      const res=await postForm(API.BASE,{
        action:"register",
        firstName:payload.firstName,
        lastName:payload.lastName,
        email:payload.email,
        phone:payload.phone,
        country:payload.country,
        contactAll:payload.contactAll,
        referrerId:(getLS("upline")||[])[0]||"",
        refChain:(getLS("upline")||[]).slice(1).join(","),
        fingerprint:simpleFingerprint(),
        userAgent:navigator.userAgent
      });

      if(res && res.ok){
        setLS("userId",res.userId);
        setPointsUI(Number(res.points||1));
        startUserPolling();
        toast("Inscription réussie ✅");
        $("#congrats-modal")?.removeAttribute("hidden");
      }else if(res && res.code==="ALREADY_REGISTERED"){
        toast("Déjà inscrit ✅ Continue à partager ton lien !");
        setLS("userId",res.userId); startUserPolling();
      }else{
        toast("Erreur: "+(res.message||"Impossible."));
      }
    }catch{ toast("Problème réseau, réessaie."); }
  });
})();

/* -------------------- Bind boutons -------------------- */
document.addEventListener("DOMContentLoaded",()=>{
  $("[data-action='share-whatsapp']")?.addEventListener("click",shareWhatsApp);
  $("[data-action='share-email']")?.addEventListener("click",shareEmail);
  $("[data-action='copy-ref']")?.addEventListener("click",copyReferral);
  startUserPolling();
});

/* -------------------- Stats live -------------------- */
(async function syncStats(){
  try{
    const u=new URL(API.BASE); u.searchParams.set("action","stats");
    const r=await fetchJSON(u.toString(), {method:"GET"});
    const c=$("#counter-left"); if(c && r && r.totalParticipants!=null) c.textContent=r.totalParticipants.toLocaleString("fr-FR");
  }catch{}
})();
