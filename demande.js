/* GLAgency — formulaire public pour les managers */
(() => {
  "use strict";
  const KEY = "gla_requests_v2"; // mode test local uniquement
  const SHIFTS = [
    { id: "matin",       name: "Matin",       s: 5,  e: 13, icon: "sunrise", color: "#c77c02" },
    { id: "apres-midi",  name: "Après-midi",  s: 13, e: 21, icon: "sun",     color: "#4f5bff" },
    { id: "soiree",      name: "Soirée",      s: 18, e: 24, icon: "sunset",  color: "#e2528f" },
    { id: "nuit",        name: "Nuit",        s: 0,  e: 6,  icon: "moon",    color: "#8b5cf6" },
    { id: "nuit-longue", name: "Nuit longue", s: 21, e: 29, icon: "stars",   color: "#0e8fa8" },
  ];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ico = (n) => `<svg class="ico"><use href="#i-${n}"/></svg>`;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hh = (h) => String(h % 24).padStart(2, "0") + "h";
  const getShift = (id) => SHIFTS.find((s) => s.id === id) || SHIFTS[0];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now() + Math.random().toString(16).slice(2));
  const plural = (n, o, m) => `${n} ${n > 1 ? m : o}`;

  const CFG = window.GLA_CONFIG || {};
  const CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const CLOUD = CONFIGURED && !!(window.supabase && window.supabase.createClient);
  const sb = CLOUD ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false } }) : null;

  const notice = $("#notice");
  if (!CONFIGURED) {
    notice.hidden = false; notice.className = "notice notice--warn";
    notice.innerHTML = `${ico("bell")} <span><b>Mode test.</b> La base partagée n'est pas encore configurée : les demandes restent dans ce navigateur et n'arrivent pas chez le formateur.</span>`;
  } else if (!CLOUD) {
    notice.hidden = false; notice.className = "notice notice--warn";
    notice.innerHTML = `${ico("bell")} <span><b>Connexion impossible.</b> Vérifie ta connexion internet puis recharge la page.</span>`;
  }

  const form = $("#requestForm");
  const F = (n) => form.querySelector(`[name="${n}"]`);
  $("#shiftPick").innerHTML = SHIFTS.map((sh) => `
    <div class="pick" data-shift="${sh.id}" style="--c:${sh.color}">
      <label class="pick__main">
        <input type="checkbox" value="${sh.id}" aria-label="Shift ${esc(sh.name)}" />
        <span class="pick__box">${ico("check")}</span>
        <span class="shift__ico">${ico(sh.icon)}</span>
        <span class="pick__info"><b>${esc(sh.name)}</b><small>${hh(sh.s)} – ${hh(sh.e)}</small></span>
      </label>
      <div class="stepper stepper--sm">
        <button type="button" data-pstep="-1" aria-label="Moins" disabled>${ico("minus")}</button>
        <input type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Nombre de chatters ${esc(sh.name)}" disabled />
        <button type="button" data-pstep="1" aria-label="Plus" disabled>${ico("plus")}</button>
      </div>
    </div>`).join("");

  function setPick(pick, on) {
    const cb = $('input[type="checkbox"]', pick), num = $('input[type="number"]', pick);
    cb.checked = on; pick.classList.toggle("is-on", on); num.disabled = !on;
    $$("[data-pstep]", pick).forEach((b) => (b.disabled = !on));
    if (on && !(parseInt(num.value, 10) >= 1)) num.value = 1;
  }
  const selection = () => $$(".pick", form).filter((p) => $('input[type="checkbox"]', p).checked).map((p) => ({
    shift: p.dataset.shift, n: clamp(parseInt($('input[type="number"]', p).value, 10) || 0, 0, 99),
  }));
  const rows = (sel) => sel.map(({ shift, n }) => { const sh = getShift(shift); return `<li style="--c:${sh.color}"><span class="shift__ico">${ico(sh.icon)}</span><b>${esc(sh.name)}</b><em>${n}</em></li>`; }).join("");
  function updateSummary() {
    const sel = selection();
    $("#summaryList").innerHTML = sel.length ? rows(sel) : `<li class="none">Aucun shift sélectionné.</li>`;
    $("#summaryTotal").textContent = sel.reduce((a, s) => a + s.n, 0);
    const name = F("manager").value.trim();
    $("#summaryWho").textContent = name ? `Demande de ${name}` : "Nouvelle demande";
  }

  form.addEventListener("change", (e) => {
    const pick = e.target.closest(".pick");
    if (pick && e.target.type === "checkbox") { setPick(pick, e.target.checked); $("#shiftError").textContent = ""; if (e.target.checked) $('input[type="number"]', pick).select(); }
    if (e.target.name === "priority") $$(".seg__opt", form).forEach((l) => l.classList.toggle("is-selected", $("input", l).checked));
    updateSummary();
  });
  form.addEventListener("input", (e) => {
    if (e.target === F("manager") && F("manager").value.trim().length >= 2) { const f = F("manager").closest(".field"); f.classList.remove("invalid"); $(".error", f).textContent = ""; }
    if (e.target.type === "number") { const v = parseInt(e.target.value, 10); if (v > 99) e.target.value = 99; }
    updateSummary();
  });
  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pstep]"); if (!b) return;
    const num = $('input[type="number"]', b.closest(".pick"));
    num.value = clamp((parseInt(num.value, 10) || 1) + Number(b.dataset.pstep), 1, 99);
    updateSummary();
  });
  $("#pickAll").addEventListener("click", () => {
    const all = $$(".pick", form).every((p) => $('input[type="checkbox"]', p).checked);
    $$(".pick", form).forEach((p) => setPick(p, !all));
    $("#pickAll").textContent = all ? "Tout sélectionner" : "Tout désélectionner";
    $("#shiftError").textContent = ""; updateSummary();
  });

  const btn = $("#submitBtn");
  const btnHtml = btn.innerHTML;
  let lastSent = 0;

  function resetForm() {
    form.reset();
    $$(".pick", form).forEach((p) => setPick(p, false));
    $$(".seg__opt", form).forEach((l) => l.classList.toggle("is-selected", $("input", l).checked));
    $("#pickAll").textContent = "Tout sélectionner";
    updateSummary();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const manager = F("manager").value.trim();
    const sel = selection();
    let ok = true;
    const mf = F("manager").closest(".field");
    if (manager.length < 2) { mf.classList.add("invalid"); $(".error", mf).textContent = "Indique ton nom."; ok = false; F("manager").focus(); }
    else { mf.classList.remove("invalid"); $(".error", mf).textContent = ""; }
    if (!sel.length) { $("#shiftError").textContent = "Choisis au moins un shift."; ok = false; }
    else if (sel.some((s) => s.n < 1)) { $("#shiftError").textContent = "Chaque shift choisi doit avoir au moins 1 chatter."; ok = false; }
    else $("#shiftError").textContent = "";
    if (!ok) return;

    if ((F("website") && F("website").value)) { showDone(sel, manager); return; } // robot : on fait semblant
    if (Date.now() - lastSent < 10000) { $("#shiftError").textContent = "Patiente quelques secondes avant de renvoyer."; return; }
    if (!CONFIGURED) {/* mode test local */}
    else if (!CLOUD) { $("#shiftError").textContent = "Connexion impossible. Recharge la page et réessaie."; return; }

    const req = {
      id: uid(), manager, team: (F("team")?.value || "").trim(),
      priority: form.querySelector('input[name="priority"]:checked').value,
      note: (F("note")?.value || "").trim(), archived: false, created_at: new Date().toISOString(),
      lines: SHIFTS.map((s) => sel.find((x) => x.shift === s.id)).filter(Boolean).map((s) => ({ shift: s.shift, requested: s.n, assigned: 0, history: [] })),
    };

    btn.disabled = true; btn.firstChild.textContent = "Envoi en cours… ";
    try {
      if (CLOUD) {
        const { error } = await sb.from("requests").insert(req);
        if (error) throw error;
      } else {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
        const { created_at, ...rest } = req;
        list.push({ ...rest, createdAt: created_at });
        localStorage.setItem(KEY, JSON.stringify(list));
      }
      lastSent = Date.now();
      showDone(sel, manager);
    } catch (err) {
      console.error(err);
      const why = err && (err.message || err.details || err.code) ? " (" + (err.message || err.details || err.code) + ")" : "";
      $("#shiftError").textContent = "L'envoi a échoué" + why + ". Vérifie ta connexion et réessaie.";
    } finally {
      btn.disabled = false; btn.innerHTML = btnHtml;
    }
  });

  function showDone(sel, manager) {
    const total = sel.reduce((a, s) => a + s.n, 0);
    $("#doneText").textContent = `Merci ${manager} ! Le formateur a reçu ta demande : ${plural(total, "chatter", "chatters")} sur ${plural(sel.length, "shift", "shifts")}.`;
    $("#doneList").innerHTML = rows(sel);
    form.hidden = true; $("#done").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    resetForm();
  }
  $("#again").addEventListener("click", () => { $("#done").hidden = true; form.hidden = false; window.scrollTo({ top: 0 }); });

  updateSummary();
})();
