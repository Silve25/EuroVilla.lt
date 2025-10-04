/***********************
 * Eurovilla.lt - Front
 * app.js (complet)
 ***********************/

(() => {
  const API_BASE = "https://script.google.com/macros/s/AKfycbzg4gJyB7KcKFyARVKbtoYewdEFB9qHwvpl7tAF4qIp-oOSFNvxi2_8Em6dLXbImb7Dew/exec";

  /* ========= Helpers DOM ========= */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const qs = (key) => new URLSearchParams(location.search).get(key);

  /* ========= Web Animations: subtle bounce on buttons ========= */
  function attachBounce() {
    const all = $$(".btn, .cta, .play360");
    all.forEach(btn => {
      btn.addEventListener("click", () => {
        try {
          btn.animate(
            [
              { transform: "translateY(0) scale(1)" },
              { transform: "translateY(-3px) scale(0.98)" },
              { transform: "translateY(0) scale(1)" },
            ],
            { duration: 260, easing: "cubic-bezier(.2,.7,.3,1.1)" }
          );
        } catch (_) { /* no-op */ }
      }, { passive: true });
    });
  }

  /* ========= Fingerprint très léger (sans dépendances) ========= */
  function tinyFingerprint() {
    const d = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      navigator.platform || "",
    ].join("|");
    // hash simple
    let h = 0;
    for (let i = 0; i < d.length; i++) { h = (h << 5) - h + d.charCodeAt(i); h |= 0; }
    return "fp_" + Math.abs(h).toString(36);
  }

  /* ========= Fetch util ========= */
  async function apiFetch(url, opts = {}, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP_" + res.status);
      const json = await res.json();
      return json;
    } finally {
      clearTimeout(t);
    }
  }

  async function apiPost(action, payload) {
    const body = JSON.stringify({ action, ...payload });
    return apiFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
  }

  async function apiGet(params) {
    const url = API_BASE + "?" + new URLSearchParams(params).toString();
    return apiFetch(url);
  }

  /* ========= Countdown ========= */
  function initCountdown() {
    // 2025-10-31 23:59:59Z
    const target = new Date("2025-10-31T23:59:59Z").getTime();
    const elD = byId("d"), elH = byId("h"), elM = byId("m"), elS = byId("s");

    function tick() {
      const now = Date.now();
      let diff = Math.max(0, target - now);
      const d = Math.floor(diff / (1000 * 60 * 60 * 24)); diff -= d * 86400000;
      const h = Math.floor(diff / (1000 * 60 * 60));     diff -= h * 3600000;
      const m = Math.floor(diff / (1000 * 60));          diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      setText(elD, String(d));
      setText(elH, String(h).padStart(2, "0"));
      setText(elM, String(m).padStart(2, "0"));
      setText(elS, String(s).padStart(2, "0"));
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ========= Theme toggle ========= */
  function initTheme() {
    const btn = byId("toggle-theme");
    if (!btn) return;
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);

    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      const next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  /* ========= Modales (360 & Congrats) ========= */
  function initModals() {
    $$("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open");
        const m = byId(id);
        if (m) {
          m.removeAttribute("hidden");
          m.setAttribute("aria-hidden", "false");
        }
      });
    });

    $$("[data-action='close-modal'], .modal-backdrop").forEach(el => {
      el.addEventListener("click", () => {
        const modal = el.closest(".modal") || el.previousElementSibling;
        if (modal) {
          modal.setAttribute("hidden", "");
          modal.setAttribute("aria-hidden", "true");
        }
      });
    });

    const more = byId("cta-more-points");
    if (more) {
      more.addEventListener("click", () => {
        location.hash = "#points";
        // fermer la modale
        const m = byId("congrats-modal");
        if (m) { m.setAttribute("hidden",""); m.setAttribute("aria-hidden","true"); }
      });
    }
  }

  /* ========= Counter / Stats ========= */
  async function refreshStats() {
    const counter = byId("counter-left");
    try {
      const data = await apiGet({ action: "stats" });
      if (data && data.ok) {
        setText(counter, String(data.totalParticipants));
      } else {
        if (counter && counter.textContent.includes("Chargement")) {
          setText(counter, "—");
        }
      }
    } catch {
      if (counter && counter.textContent.includes("Chargement")) {
        setText(counter, "—");
      }
    }
  }

  /* ========= Progress UI ========= */
  function updateProgressUI(points) {
    const max = 50; // seuil visuel
    const pct = Math.max(0, Math.min(100, Math.round((points / max) * 100)));
    const bar = byId("progress-bar");
    const label = byId("progress-label");
    const score = byId("score-points");
    if (bar) bar.style.width = pct + "%";
    if (label) label.textContent = pct + "%";
    if (score) score.textContent = String(points);
  }

  /* ========= Snapshot polling ========= */
  let SNAP_TIMER = null;
  function startSnapshotPolling(userId) {
    if (!userId) return;
    const run = async () => {
      try {
        const snap = await apiGet({ action: "user", userId });
        if (snap && snap.ok) {
          updateProgressUI(Number(snap.points || 0));
          // update referral link with publicId if present
          if (snap.publicId) {
            const rl = byId("ref-link");
            if (rl) rl.value = `${location.origin}${location.pathname}?r=${encodeURIComponent(snap.publicId)}`;
          }
        }
      } catch { /* ignore */ }
    };
    clearInterval(SNAP_TIMER);
    run();
    SNAP_TIMER = setInterval(run, 5000);
  }

  /* ========= Referral helpers ========= */
  function parseReferralParams() {
    const r = qs("r");  // publicId court
    const z = qs("z");  // base64url chain
    const rc = qs("rc"); // chain csv
    const c = qs("c");  // canal
    return { r, z, rc, c };
  }

  async function resolvePublicIdToUserId(publicId) {
    try {
      const res = await apiGet({ action: "resolve", r: publicId });
      if (res && res.ok) return res.userId || "";
    } catch { /* no-op */ }
    return "";
  }

  /* ========= Click tracking (landing) ========= */
  async function logLandingClick(fp, ua, pageUrl) {
    const { r, z, rc, c } = parseReferralParams();
    try {
      await apiPost("click", {
        pageUrl,
        nonce: qs("sn") || "", // si présent
        refChain: rc || "",
        fingerprint: fp,
        userAgent: ua,
        ip: "",     // côté client on laisse vide (backend peut compléter via doPost e).
        channel: c || ""
      });
    } catch { /* pas bloquant */ }
  }

  /* ========= Partages ========= */
  function initShare(userPublicId = "") {
    const wl = $("[data-action='share-whatsapp']");
    const el = $("[data-action='share-email']");
    const refInput = byId("ref-link");

    function currentRef() {
      if (refInput && refInput.value) return refInput.value.trim();
      // fallback
      return `${location.origin}${location.pathname}${userPublicId ? `?r=${encodeURIComponent(userPublicId)}` : ""}`;
    }

    if (wl) {
      wl.addEventListener("click", async () => {
        const url = currentRef();
        const text = `Je participe au tirage Eurovilla.lt 🏡🇫🇷\nInscris-toi ici : ${url}`;
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, "_blank", "noopener");
      });
    }

    if (el) {
      el.addEventListener("click", async () => {
        const url = currentRef();
        const subject = "Eurovilla.lt — je tente ma chance 🏡";
        const body = `Hello,\n\nJe participe à un tirage pour gagner une villa à Mougins.\nInscris-toi (gratuit) : ${url}\n\nBonne chance !`;
        const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        location.href = href;
      });
    }

    const copyBtn = $("[data-action='copy-ref']");
    if (copyBtn && refInput) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(refInput.value.trim());
          copyBtn.textContent = "Copié ✓";
          setTimeout(() => (copyBtn.textContent = "Copier"), 1200);
        } catch {
          refInput.select(); document.execCommand("copy");
          copyBtn.textContent = "Copié ✓";
          setTimeout(() => (copyBtn.textContent = "Copier"), 1200);
        }
      });
    }
  }

  /* ========= Formulaire ========= */
  function gatherContacts() {
    // concatène les canaux cochés
    const arr = [];
    $$("input[name='contact']:checked").forEach(cb => arr.push(cb.value));
    return arr.join(",");
  }

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
  }
  function validatePhone(v) {
    return /^[+]?[\d\s().-]{7,}$/.test(v || "");
  }

  function setFormBusy(form, busy) {
    const btn = form.querySelector("button[type='submit']");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function showMessage(kind) {
    // kind: "success" | "already" | "error"
    const ok = byId("signup-success");
    const al = byId("signup-already");
    const er = byId("signup-error");
    hide(ok); hide(al); hide(er);
    if (kind === "success") show(ok);
    else if (kind === "already") show(al);
    else show(er);
  }

  async function submitForm(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = {
      firstName: byId("firstName").value.trim(),
      lastName: byId("lastName").value.trim(),
      email: byId("email").value.trim(),
      phone: byId("phone").value.trim(),
      country: byId("country").value,
      contactAll: gatherContacts(),
      acceptRules: byId("acceptRules").checked
    };

    // validations rapides
    let valid = true;
    if (!f.firstName) valid = false;
    if (!f.lastName) valid = false;
    if (!validateEmail(f.email)) valid = false;
    if (!validatePhone(f.phone)) valid = false;
    if (!f.country) valid = false;
    if (!f.acceptRules) valid = false;
    if (!valid) { showMessage("error"); return; }

    setFormBusy(form, true);

    try {
      const fp = byId("fingerprint").value || tinyFingerprint();
      const { r, z, rc, c } = parseReferralParams();
      let referrerId = byId("referrerId").value;
      if (!referrerId && r) {
        // on essaie de résoudre r -> userId (facultatif, le backend sait gérer r côté click)
        referrerId = await resolvePublicIdToUserId(r);
        byId("referrerId").value = referrerId || "";
      }

      const payload = {
        firstName: f.firstName,
        lastName: f.lastName,
        email: f.email,
        phone: f.phone,
        country: f.country,
        contactAll: f.contactAll,
        referrerId: referrerId || "",

        // refChain: on laisse tel quel, le backend accepte rc/z
        refChain: rc || "",
        fingerprint: fp,
        campaign: byId("campaign").value || "",
        acqChannel: c || "",
        userAgent: navigator.userAgent,
        pageUrl: location.href,
        source: "web"
      };

      const res = await apiPost("register", payload);

      // IMPORTANT : on ne confond plus les erreurs réseau avec ALREADY_REGISTERED
      if (res && res.ok && res.code === "REGISTERED") {
        showMessage("success");
        // lien de parrainage
        if (res.publicId) {
          const rl = byId("ref-link");
          if (rl) rl.value = `${location.origin}${location.pathname}?r=${encodeURIComponent(res.publicId)}`;
        }
        // points + polling
        updateProgressUI(Number(res.points || 0));
        startSnapshotPolling(res.userId);
        // ouvrir modale félicitations
        const cm = byId("congrats-modal");
        if (cm) { cm.removeAttribute("hidden"); cm.setAttribute("aria-hidden","false"); }
        refreshStats();
      } else if (res && res.ok && res.code === "ALREADY_REGISTERED") {
        // anti-doublon : message dédié + synchro
        showMessage("already");
        if (res.publicId) {
          const rl = byId("ref-link");
          if (rl) rl.value = `${location.origin}${location.pathname}?r=${encodeURIComponent(res.publicId)}`;
        }
        updateProgressUI(Number(res.points || 0));
        if (res.userId) startSnapshotPolling(res.userId);
      } else if (res && res.code === "COUNTRY_NOT_ELIGIBLE") {
        const er = byId("signup-error");
        if (er) er.textContent = "Pays non éligible (UE uniquement).";
        showMessage("error");
      } else {
        // autre réponse inattendue
        const er = byId("signup-error");
        if (er) er.textContent = "Oups, un contretemps côté serveur. Réessaie.";
        showMessage("error");
      }
    } catch (err) {
      // Cas véritablement réseau indisponible
      const er = byId("signup-error");
      if (er) er.textContent = "Réseau indisponible. Merci de réessayer dans un instant.";
      showMessage("error");
    } finally {
      setFormBusy(form, false);
    }
  }

  function initForm() {
    const form = byId("signup-form");
    if (!form) return;
    form.addEventListener("submit", submitForm);

    // champs cachés
    const fp = tinyFingerprint();
    if (byId("fingerprint")) byId("fingerprint").value = fp;

    // si param r présent, on peut tenter de le résoudre en amont (facultatif)
    const r = qs("r");
    if (r) {
      resolvePublicIdToUserId(r).then(uid => {
        if (uid && byId("referrerId")) byId("referrerId").value = uid;
      }).catch(() => {});
    }
  }

  /* ========= Header “play 360” bouton en carte media ========= */
  function tuneHeroPlayButton() {
    const btn = $(".media-card .play360");
    if (!btn) return;
    // Le bouton est déjà un .btn dans le HTML final
  }

  /* ========= On load ========= */
  window.addEventListener("DOMContentLoaded", async () => {
    attachBounce();
    initTheme();
    initModals();
    initCountdown();
    initForm();
    tuneHeroPlayButton();

    // Init share bloc (le publicId sera injecté après inscription via polling)
    initShare();

    // compteur
    refreshStats();
    setInterval(refreshStats, 20000);

    // click log
    const fp = byId("fingerprint")?.value || tinyFingerprint();
    logLandingClick(fp, navigator.userAgent, location.href);

    // si l’utilisateur revient avec un userId en mémoire, on relance le polling
    const storedUser = sessionStorage.getItem("eu_userId");
    if (storedUser) startSnapshotPolling(storedUser);
  });

  /* ========= Stockage userId depuis polling ========= */
  // hook dans startSnapshotPolling (on garde ici pour clarté)
  const origStart = startSnapshotPolling;
  startSnapshotPolling = function(userId) {
    try { sessionStorage.setItem("eu_userId", userId); } catch {}
    return origStart(userId);
  };

})();
