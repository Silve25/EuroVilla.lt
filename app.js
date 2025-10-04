/******************************************************
 * Eurovilla.lt — Front (app.js) v4.1
 * - Requêtes form-encoded (pas de préflight CORS)
 * - Détection doublons: message clair + synchro des points
 * - Compteur participants + points live + lien de parrainage
 * - CTA bounce subtil + états de chargement
 ******************************************************/

// 👉 Mets ici l’URL /exec de ton déploiement Apps Script si tu en changes
const API_BASE = "https://script.google.com/macros/s/AKfycbzg4gJyB7KcKFyARVKbtoYewdEFB9qHwvpl7tAF4qIp-oOSFNvxi2_8Em6dLXbImb7Dew/exec";

/* ---------- Helpers DOM ---------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const show = (el) => el && (el.hidden = false);
const hide = (el) => el && (el.hidden = true);

/* ---------- CTA bounce subtil ---------- */
function setupBounce() {
  $$(".btn, .cta").forEach(b=>{
    b.addEventListener("click", ()=>{
      b.classList.add("bouncing");
      setTimeout(()=> b.classList.remove("bouncing"), 220);
    });
  });
}

/* ---------- Requêtes sans CORS preflight ---------- */
async function postForm(dataObj){
  const body = new URLSearchParams(dataObj);
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, code:"BAD_JSON", raw:text }; }
}
async function getJSON(params){
  const url = new URL(API_BASE);
  Object.entries(params||{}).forEach(([k,v])=> url.searchParams.set(k,v));
  const res = await fetch(url.toString(), { method:"GET" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, code:"BAD_JSON", raw:text }; }
}

/* ---------- Fingerprint léger ---------- */
function tinyFingerprint(){
  const ua = navigator.userAgent || "";
  const lang = navigator.language || "";
  const plat = navigator.platform || "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const scr = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const seed = [ua,lang,plat,tz,scr].join("|");
  let h=0; for(let i=0;i<seed.length;i++){ h=((h<<5)-h)+seed.charCodeAt(i); h|=0; }
  return "fp_" + Math.abs(h).toString(36);
}

/* ---------- Countdown ---------- */
function setupCountdown(){
  const target = new Date("2025-10-31T23:59:59Z").getTime();
  const dEl=$("#d"), hEl=$("#h"), mEl=$("#m"), sEl=$("#s");
  function tick(){
    const now = Date.now();
    let diff = Math.max(0, target - now);
    const d = Math.floor(diff/86400000); diff-=d*86400000;
    const h = Math.floor(diff/3600000);  diff-=h*3600000;
    const m = Math.floor(diff/60000);    diff-=m*60000;
    const s = Math.floor(diff/1000);
    dEl.textContent = d;
    hEl.textContent = String(h).padStart(2,"0");
    mEl.textContent = String(m).padStart(2,"0");
    sEl.textContent = String(s).padStart(2,"0");
  }
  tick(); setInterval(tick, 1000);
}

/* ---------- Participants live counter ---------- */
async function refreshStats(){
  const out = await getJSON({action:"stats"});
  if(out && out.ok){
    const n = out.totalParticipants || 0;
    $("#counter-left").textContent = n.toLocaleString("fr-FR");
  }
}

/* ---------- Points UI ---------- */
function applyPointsUI(points=1){
  $("#score-points").textContent = points;
  const pct = Math.max(0, Math.min(100, Math.round(Math.min(points,50)/50*100)));
  $("#progress-bar").style.width = pct + "%";
  $("#progress-label").textContent = pct + "%";
}

/* ---------- Snapshot utilisateur ---------- */
let currentUserId = localStorage.getItem("ev_userId") || "";
async function pollUser(){
  if(!currentUserId) return;
  const out = await getJSON({action:"user", userId: currentUserId});
  if(out && out.ok){
    applyPointsUI(out.points||1);
    const refInput = $("#ref-link");
    if (refInput && out.publicId){
      const url = new URL(location.href);
      url.searchParams.set("r", out.publicId);
      refInput.value = url.toString();
    }
  }
}

/* ---------- Share & copy ---------- */
function setupShareButtons(){
  const copyBtn = $('[data-action="copy-ref"]');
  copyBtn?.addEventListener("click", ()=>{
    const input = $("#ref-link");
    input?.select();
    document.execCommand("copy");
    copyBtn.textContent = "Copié ✓";
    setTimeout(()=> copyBtn.textContent="Copier", 1400);
  });
  $('[data-action="share-whatsapp"]')?.addEventListener("click", ()=>{
    const link = $("#ref-link")?.value || location.href;
    const text = encodeURIComponent("Je participe au tirage Eurovilla.lt pour gagner une villa ! Viens t’inscrire : " + link);
    window.open("https://wa.me/?text="+text, "_blank","noopener");
  });
  $('[data-action="share-email"]')?.addEventListener("click", ()=>{
    const link = $("#ref-link")?.value || location.href;
    const subject = encodeURIComponent("Tirage Eurovilla.lt — je participe !");
    const body = encodeURIComponent("Hello,\n\nJe me suis inscrit(e) au tirage Eurovilla.lt pour gagner une villa à Mougins. Rejoins-moi ici : "+link+"\n\nBonne chance !");
    location.href = `mailto:?subject=${subject}&body=${body}`;
  });
}

/* ---------- Modales vidéo 360 ---------- */
function setupModals(){
  $$("[data-open]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-open");
      const modal = document.getElementById(id);
      if(modal){ modal.hidden=false; modal.setAttribute("aria-hidden","false"); }
    });
  });
  $$("[data-action='close-modal']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const modal = btn.closest(".modal");
      if(modal){ modal.hidden=true; modal.setAttribute("aria-hidden","true"); }
    });
  });
}

/* ---------- Thème ---------- */
function setupTheme(){
  $("#toggle-theme")?.addEventListener("click", ()=>{
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme") || "dark";
    root.setAttribute("data-theme", cur==="dark" ? "light" : "dark");
  });
}

/* ---------- Formulaire inscription ---------- */
function serializeContacts(){
  const vals = [];
  $$("input[name='contact']:checked").forEach(i=> vals.push(i.value));
  return vals.join(",");
}

async function onSubmitSignup(e){
  e.preventDefault();
  const form = e.currentTarget;
  const btn  = form.querySelector("button[type='submit']");
  hide($("#signup-success"));
  hide($("#signup-error"));

  if(!$("#acceptRules").checked){
    $("#signup-error").textContent = "Merci d’accepter le règlement et la politique de confidentialité.";
    show($("#signup-error"));
    return;
  }

  const fingerprint = $("#fingerprint").value || tinyFingerprint();
  $("#fingerprint").value = fingerprint;

  const payload = {
    action: "register",
    firstName: $("#firstName").value.trim(),
    lastName:  $("#lastName").value.trim(),
    email:     $("#email").value.trim(),
    phone:     $("#phone").value.trim(),
    country:   $("#country").value,
    contactAll: serializeContacts(),
    referrerId: $("#referrerId").value || "",
    refChain:   "",
    fingerprint,
    campaign:   $("#campaign").value || "",
    acqChannel: "web",
    userAgent:  navigator.userAgent || "",
    ip:         "",     // laissé vide côté client
    ipCountry:  "",
    source:     "web"
  };

  form.classList.add("is-loading");
  btn?.setAttribute("disabled","disabled");

  let out;
  try{
    out = await postForm(payload);
  }catch(err){
    $("#signup-error").textContent = "Réseau indisponible. Merci de réessayer dans un instant.";
    show($("#signup-error"));
    form.classList.remove("is-loading");
    btn?.removeAttribute("disabled");
    return;
  }

  form.classList.remove("is-loading");
  btn?.removeAttribute("disabled");

  if(!out || out.ok !== true){
    $("#signup-error").textContent = "Oups, un petit contretemps. Réessaie dans un instant.";
    show($("#signup-error"));
    return;
  }

  if (out.code === "ALREADY_REGISTERED"){
    currentUserId = out.userId || "";
    if (currentUserId) localStorage.setItem("ev_userId", currentUserId);
    applyPointsUI(out.points || 1);
    $("#signup-error").textContent = "Tu es déjà inscrit(e) — nous avons synchronisé tes points 👍";
    show($("#signup-error"));
    await pollUser();
    return;
  }

  if (out.code === "REGISTERED"){
    currentUserId = out.userId || "";
    if (currentUserId) localStorage.setItem("ev_userId", currentUserId);
    show($("#signup-success"));
    applyPointsUI(out.points || 1);
    await refreshStats();
    await pollUser();
    // modale “Félicitations”
    const modal = $("#congrats-modal");
    if(modal){ modal.hidden=false; modal.setAttribute("aria-hidden","false"); }
    return;
  }

  // message par défaut
  $("#signup-error").textContent = out.message || "Oups, un petit contretemps. Réessaie dans un instant.";
  show($("#signup-error"));
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  setupBounce();
  setupTheme();
  setupModals();
  setupShareButtons();
  setupCountdown();

  // Ref publicId via ?r=XXX
  const url = new URL(location.href);
  const r = url.searchParams.get("r");
  if (r) $("#referrerId").value = r;

  // Reprise de session
  currentUserId = localStorage.getItem("ev_userId") || "";
  if(currentUserId) await pollUser();

  await refreshStats();
  setInterval(refreshStats, 60000);
  setInterval(pollUser, 20000);

  $("#signup-form")?.addEventListener("submit", onSubmitSignup);
});
