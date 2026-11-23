/* =========================================================
   GLAgency — Dashboard planning chatters
   Données enregistrées dans le navigateur (localStorage).
   Une demande = un manager + une ou plusieurs lignes (shift + nombre).
   ========================================================= */
document.documentElement.classList.add("js");

(() => {
  "use strict";

  /* ---------- Configuration ---------- */
  const DEFAULT_PIN = "1234"; // code formateur par défaut (modifiable dans Outils)
  const KEY = "gla_requests_v2";
  const OLD_KEY = "gla_requests_v1";
  const PIN_KEY = "gla_pin";
  const TRAINER_KEY = "gla_trainer";

  /* ---------- Base partagée (Supabase) : facultative ---------- */
  const CFG = window.GLA_CONFIG || {};
  const CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const CLOUD = CONFIGURED && !!(window.supabase && window.supabase.createClient);
  const sb = CLOUD ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  if (CLOUD) document.body.classList.add("cloud", "locked");

  const SHIFTS = [
    { id: "matin",       name: "Matin",       s: 5,  e: 13, icon: "sunrise", color: "#c77c02" },
    { id: "apres-midi",  name: "Après-midi",  s: 13, e: 21, icon: "sun",     color: "#4f5bff" },
    { id: "soiree",      name: "Soirée",      s: 18, e: 24, icon: "sunset",  color: "#e2528f" },
    { id: "nuit",        name: "Nuit",        s: 0,  e: 6,  icon: "moon",    color: "#8b5cf6" },
    { id: "nuit-longue", name: "Nuit longue", s: 21, e: 29, icon: "stars",   color: "#0e8fa8" },
  ];

  const VIEWS = {
    overview: ["Vue d'ensemble", "Couverture en direct de tes 5 shifts"],
    new:      ["Nouvelle demande", "Choisis les shifts et le nombre de chatters pour chacun"],
    requests: ["Demandes", "Suis chaque demande et enregistre les envois"],
    shifts:   ["Shifts", "Le détail de chaque créneau horaire"],
    activity: ["Activité", "Historique de toutes les demandes et de tous les envois"],
    tools:    ["Outils", "Export, sauvegarde et réglages"],
  };

  /* ---------- Utilitaires ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const ico = (name) => `<svg class="ico"><use href="#i-${name}"/></svg>`;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hh = (h) => String(h % 24).padStart(2, "0") + "h";
  const range = (sh) => `${hh(sh.s)} – ${hh(sh.e)}`;
  const getShift = (id) => SHIFTS.find((s) => s.id === id) || SHIFTS[0];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now() + Math.random().toString(16).slice(2));
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const chatters = (n) => plural(n, "chatter", "chatters");
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const fmtFull = (iso) => `${fmtDate(iso)} à ${fmtTime(iso)}`;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const PALETTE = ["#4f5bff", "#e2528f", "#0e8fa8", "#8b5cf6", "#c77c02", "#12b76a", "#0d10b5"];
  const colorFor = (name) => PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  function rel(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  }

  /* ---------- Stockage ---------- */
  const memory = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return memory[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { memory[k] = v; } },
  };
  const getPin = () => store.get(PIN_KEY) || DEFAULT_PIN;

  // Ancien format (1 shift par demande) -> nouveau format (lignes)
  function migrate(r) {
    if (!Array.isArray(r.lines)) {
      r.lines = [{ shift: r.shift, requested: r.requested, assigned: r.assigned || 0, history: r.history || [] }];
      delete r.shift; delete r.requested; delete r.assigned; delete r.history;
    }
    r.lines.forEach((l) => { l.history = l.history || []; l.assigned = l.assigned || 0; });
    return r;
  }

  function demoData() {
    const mk = (manager, team, priority, minAgo, note, lines) => ({
      id: uid(), manager, team, priority, note, createdAt: ago(minAgo), archived: false, demo: true,
      lines: lines.map(([shift, requested, assigned]) => ({
        shift, requested, assigned,
        history: assigned ? [{ ts: ago(Math.max(minAgo - 35, 4)), n: assigned, names: "" }] : [],
      })),
    });
    return [
      mk("Karim B.", "Team Alpha", "urgent", 190, "Anglais courant exigé.", [["nuit", 6, 4], ["nuit-longue", 4, 1]]),
      mk("Sarah M.", "Team Delta", "normal", 420, "", [["matin", 5, 5], ["apres-midi", 3, 3]]),
      mk("Yanis T.", "Team Orion", "normal", 260, "", [["apres-midi", 8, 3], ["soiree", 4, 0]]),
      mk("Inès D.", "Team Nova", "normal", 95, "", [["soiree", 4, 0]]),
      mk("Mehdi L.", "Team Alpha", "urgent", 140, "Démarrage dès ce soir.", [["nuit-longue", 7, 2], ["nuit", 2, 0]]),
      mk("Lina R.", "Team Sigma", "normal", 330, "", [["matin", 3, 1]]),
    ];
  }

  function load() {
    try {
      for (const k of [KEY, OLD_KEY]) {
        const raw = store.get(k);
        if (raw !== null) { const d = JSON.parse(raw); return Array.isArray(d) ? d.map(migrate) : []; }
      }
      return demoData();
    } catch { return []; }
  }

  const state = {
    requests: CLOUD ? [] : load(),
    seen: null,
    filters: { q: "", shift: "all", status: "active" },
    trainer: false,
    flashId: null,
    view: "overview",
  };
  if (!CLOUD) { try { state.trainer = sessionStorage.getItem(TRAINER_KEY) === "1"; } catch {} }

  /* ---------- Enregistrement : navigateur (local) ou base partagée (cloud) ---------- */
  const toRow = (r) => ({ id: r.id, manager: r.manager, team: r.team || "", priority: r.priority, note: r.note || "", lines: r.lines, archived: !!r.archived, created_at: r.createdAt });
  const fromRow = (d) => migrate({ id: d.id, manager: d.manager, team: d.team || "", priority: d.priority, note: d.note || "", lines: d.lines, archived: !!d.archived, createdAt: d.created_at });

  // changed = la ou les demandes modifiées (cloud : envoyées à la base)
  function save(changed) {
    renderAll();
    if (!CLOUD) { store.set(KEY, JSON.stringify(state.requests)); return Promise.resolve(); }
    const list = changed ? [].concat(changed) : [];
    if (!list.length) return Promise.resolve();
    list.forEach((r) => state.seen && state.seen.add(r.id));
    return sb.from("requests").upsert(list.map(toRow)).then(({ error }) => {
      if (error) { console.error(error); toast("Échec de l'enregistrement. Vérifie ta connexion.", true); pull(); }
    });
  }
  function removeReqs(ids) {
    state.requests = state.requests.filter((r) => !ids.includes(r.id));
    renderAll();
    if (!CLOUD) { store.set(KEY, JSON.stringify(state.requests)); return Promise.resolve(); }
    return sb.from("requests").delete().in("id", ids).then(({ error }) => {
      if (error) { console.error(error); toast("Échec de la suppression.", true); pull(); }
    });
  }

  async function pull() {
    if (!CLOUD || !state.trainer) return;
    const { data, error } = await sb.from("requests").select("*").order("created_at", { ascending: true });
    if (error) { console.error(error); setSync(false); return; }
    setSync(true);
    const incoming = data.map(fromRow);
    if (state.seen) {
      incoming.filter((r) => !state.seen.has(r.id)).forEach((r) => {
        const n = r.lines.reduce((a, l) => a + l.requested, 0);
        toast(`Nouvelle demande de ${r.manager} · ${n} chatter${n > 1 ? "s" : ""}`, true);
      });
    }
    state.seen = new Set(incoming.map((r) => r.id));
    state.requests = incoming;
    renderAll();
  }
  let pullTimer = null, poll = null, channel = null;
  const schedulePull = () => { clearTimeout(pullTimer); pullTimer = setTimeout(pull, 350); };
  function startSync() {
    stopSync();
    channel = sb.channel("requests-sync").on("postgres_changes", { event: "*", schema: "public", table: "requests" }, schedulePull).subscribe();
    poll = setInterval(pull, 30000); // filet de sécurité si le direct est coupé
  }
  function stopSync() {
    clearInterval(poll); clearTimeout(pullTimer);
    if (channel) { sb.removeChannel(channel); channel = null; }
  }
  function setSync(ok) {
    const el = document.getElementById("syncDot");
    if (el) { el.classList.toggle("off", !ok); el.title = ok ? "Synchronisé en direct" : "Connexion perdue : nouvelle tentative…"; }
  }

  /* ---------- Calculs ---------- */
  const lineRem = (l) => Math.max(0, l.requested - l.assigned);
  const lineSent = (l) => Math.min(l.assigned, l.requested);
  function reqTotals(r) {
    let req = 0, sent = 0;
    r.lines.forEach((l) => { req += l.requested; sent += lineSent(l); });
    return { req, sent, rem: req - sent, pct: req ? Math.round((sent / req) * 100) : 0 };
  }
  const statusOf = (r) => {
    if (r.archived) return "archived";
    const t = reqTotals(r);
    return t.sent >= t.req ? "done" : t.sent > 0 ? "partial" : "pending";
  };
  const STATUS_LABEL = { pending: "En attente", partial: "Partiel", done: "Satisfait", archived: "Archivé" };
  const activeReqs = () => state.requests.filter((r) => !r.archived);

  function shiftStats(id) {
    let req = 0, sent = 0, count = 0;
    activeReqs().forEach((r) => r.lines.forEach((l) => {
      if (l.shift === id) { req += l.requested; sent += lineSent(l); count++; }
    }));
    return { req, sent, rem: req - sent, count, pct: req ? Math.round((sent / req) * 100) : 0 };
  }
  function globalStats() {
    const list = activeReqs();
    let req = 0, sent = 0;
    list.forEach((r) => { const t = reqTotals(r); req += t.req; sent += t.sent; });
    return { req, sent, rem: req - sent, pct: req ? Math.round((sent / req) * 100) : 0, open: list.filter((r) => statusOf(r) !== "done").length, all: list.length };
  }

  /* ---------- Rendu : vue d'ensemble ---------- */
  function polar(cx, cy, r, h) { const a = (h / 24) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function arcPath(cx, cy, r, h1, h2) {
    const [x1, y1] = polar(cx, cy, r, h1), [x2, y2] = polar(cx, cy, r, h2);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${h2 - h1 > 12 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  function renderWheel() {
    const c = 130, radii = [108, 93, 78, 63, 48];
    let svg = `<svg viewBox="0 0 260 260" aria-hidden="true"><circle cx="${c}" cy="${c}" r="124" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.14)"/>`;
    [0, 6, 12, 18].forEach((h) => {
      const [x, y] = polar(c, c, 119, h);
      svg += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="rgba(255,255,255,.6)">${hh(h)}</text>`;
    });
    SHIFTS.forEach((sh, i) => {
      const st = shiftStats(sh.id), cov = st.req ? st.sent / st.req : 0;
      svg += `<path d="${arcPath(c, c, radii[i], sh.s, sh.e)}" stroke="rgba(255,255,255,.2)" stroke-width="9" stroke-linecap="round" fill="none"><title>${esc(sh.name)} ${range(sh)} : ${st.sent}/${st.req}</title></path>`;
      if (cov > 0) svg += `<path d="${arcPath(c, c, radii[i], sh.s, sh.s + (sh.e - sh.s) * cov)}" stroke="${sh.id === "matin" ? "#f0a82b" : sh.id === "nuit-longue" ? "#37c5de" : sh.color}" stroke-width="9" stroke-linecap="round" fill="none"/>`;
    });
    svg += `<text x="${c}" y="${c - 2}" text-anchor="middle" font-size="26" font-weight="800" fill="#fff">24h</text><text x="${c}" y="${c + 16}" text-anchor="middle" font-size="9.5" font-weight="600" fill="rgba(255,255,255,.6)">5 shifts</text></svg>`;
    $("#heroWheel").innerHTML = svg;
    $("#wheelLegend").innerHTML = SHIFTS.map((sh) => `<li style="--c:${sh.id === "matin" ? "#f0a82b" : sh.id === "nuit-longue" ? "#37c5de" : sh.color}"><i></i>${esc(sh.name)}<small>${hh(sh.s)}–${hh(sh.e)}</small></li>`).join("");
  }

  function sendBtn(r, l) {
    return `<button class="icon-btn icon-btn--send t-trainer" data-act="send" data-id="${r.id}" data-shift="${l.shift}" title="Envoyer des chatters" aria-label="Envoyer des chatters">${ico("send")}</button>`;
  }

  function renderOverview() {
    const g = globalStats();
    $("#bannerDate").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    $("#bannerText").textContent = g.all
      ? (g.rem ? `${chatters(g.rem)} ${g.rem > 1 ? "restent" : "reste"} à envoyer sur ${plural(g.open, "demande ouverte", "demandes ouvertes")}.` : "Toutes les demandes sont satisfaites, bravo !")
      : "Aucune demande pour le moment.";
    $("#bannerPct").textContent = g.pct + "%";
    $("#bannerRing").style.strokeDashoffset = 163.4 * (1 - g.pct / 100);
    $("#bannerRingText").textContent = `${g.sent} envoyés sur ${g.req} demandés`;
    $("#kpiOpen").textContent = g.open;
    $("#kpiReq").textContent = g.req;
    $("#kpiSent").textContent = g.sent;
    $("#kpiRem").textContent = g.rem;

    // Couverture par shift (liste de jauges, une seule teinte)
    $("#coverageList").innerHTML = SHIFTS.map((sh) => {
      const st = shiftStats(sh.id);
      return `<div class="cov" style="--c:${sh.color}" title="${esc(sh.name)} : ${st.sent} envoyés sur ${st.req} demandés">
        <div class="cov__name"><span class="shift__ico">${ico(sh.icon)}</span><div><b>${esc(sh.name)}</b><small>${range(sh)}</small></div></div>
        <div class="cov__bar"><div class="bar ${st.req && !st.rem ? "bar--done" : ""}"><i style="width:${st.pct}%"></i></div></div>
        <div class="cov__num"><b>${st.sent}/${st.req}</b><small>${st.req ? st.pct + "%" : "—"}</small></div></div>`;
    }).join("");

    renderWheel();

    // À traiter en priorité
    const items = [];
    activeReqs().forEach((r) => r.lines.forEach((l) => { if (lineRem(l) > 0) items.push({ r, l }); }));
    items.sort((a, b) => (b.r.priority === "urgent") - (a.r.priority === "urgent") || lineRem(b.l) - lineRem(a.l) || a.r.createdAt.localeCompare(b.r.createdAt));
    $("#todoList").innerHTML = items.length ? items.slice(0, 6).map(({ r, l }) => {
      const sh = getShift(l.shift);
      return `<div class="row"><span class="av" style="--c:${colorFor(r.manager)}">${esc(initials(r.manager))}</span>
        <div class="row__who"><b>${esc(r.manager)} ${r.priority === "urgent" ? `<span class="urgent">${ico("zap")} Urgent</span>` : ""}</b><small>${esc(sh.name)} · ${range(sh)} · ${rel(r.createdAt)}</small></div>
        <div class="row__rem"><b>${lineRem(l)}</b>à envoyer</div>${sendBtn(r, l)}</div>`;
    }).join("") : `<p class="empty-mini">Rien à traiter : tout est couvert.</p>`;

    // Activité récente
    $("#recentFeed").innerHTML = feedHtml(events().slice(0, 5));
  }

  /* ---------- Activité ---------- */
  function events() {
    const ev = [];
    state.requests.forEach((r) => {
      ev.push({ ts: r.createdAt, type: "created", r });
      let last = r.createdAt;
      r.lines.forEach((l) => l.history.forEach((h) => { ev.push({ ts: h.ts, type: "sent", r, l, h }); if (h.ts > last) last = h.ts; }));
      if (statusOf(r) === "done" || (r.archived && reqTotals(r).rem === 0)) ev.push({ ts: last, type: "done", r });
    });
    const rank = { done: 0, sent: 1, created: 2 };
    return ev.sort((a, b) => b.ts.localeCompare(a.ts) || rank[a.type] - rank[b.type]);
  }
  function feedHtml(list) {
    if (!list.length) return `<li><p class="empty-mini" style="width:100%">Aucune activité pour le moment.</p></li>`;
    return list.map((e) => {
      const r = e.r;
      let icon = "plus", body = "";
      if (e.type === "created") {
        const t = reqTotals(r);
        body = `<b>${esc(r.manager)}</b> a demandé <b>${chatters(t.req)}</b>${r.priority === "urgent" ? ` <span class="urgent">${ico("zap")} Urgent</span>` : ""}
          <span>${r.lines.map((l) => `${esc(getShift(l.shift).name)} ×${l.requested}`).join(" · ")}</span>`;
      } else if (e.type === "sent") {
        icon = "send";
        body = `<b>${chatters(e.h.n)}</b> envoyé${e.h.n > 1 ? "s" : ""} à <b>${esc(r.manager)}</b><span>${esc(getShift(e.l.shift).name)}${e.h.names ? " · " + esc(e.h.names) : ""}</span>`;
      } else {
        icon = "check";
        body = `Demande de <b>${esc(r.manager)}</b> <b>entièrement satisfaite</b><span>${chatters(reqTotals(r).req)} en poste</span>`;
      }
      return `<li><span class="feed__ico feed__ico--${e.type}">${ico(icon)}</span><div class="feed__body">${body}</div><span class="feed__time">${rel(e.ts)}</span></li>`;
    }).join("");
  }

  /* ---------- Demandes ---------- */
  function renderChips() {
    const base = state.requests.filter((r) => (state.filters.status === "archived" ? r.archived : !r.archived));
    const chips = [{ id: "all", label: "Tous les shifts", n: base.length }].concat(
      SHIFTS.map((s) => ({ id: s.id, label: `${s.name} ${hh(s.s)}–${hh(s.e)}`, n: base.filter((r) => r.lines.some((l) => l.shift === s.id)).length }))
    );
    $("#shiftFilters").innerHTML = chips.map((c) =>
      `<button type="button" class="chip-btn ${state.filters.shift === c.id ? "active" : ""}" data-shift="${c.id}">${esc(c.label)} <i>${c.n}</i></button>`).join("");
  }

  function filtered() {
    const { q, shift, status } = state.filters;
    const term = q.trim().toLowerCase();
    return state.requests.filter((r) => {
      const st = statusOf(r);
      if (status === "active" ? r.archived : status === "archived" ? !r.archived : st !== status) return false;
      if (shift !== "all" && !r.lines.some((l) => l.shift === shift)) return false;
      if (term && !`${r.manager} ${r.team} ${r.note}`.toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => {
      const da = statusOf(a) === "done" ? 1 : 0, db = statusOf(b) === "done" ? 1 : 0;
      if (da !== db) return da - db;
      if ((a.priority === "urgent") !== (b.priority === "urgent")) return a.priority === "urgent" ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  function renderRequests() {
    renderChips();
    const rows = filtered();
    $("#emptyState").hidden = rows.length > 0;
    $("#demoNote").hidden = !state.requests.some((r) => r.demo);
    $("#requestList").innerHTML = rows.map((r) => {
      const st = statusOf(r), t = reqTotals(r);
      return `<article class="req ${state.flashId === r.id ? "flash" : ""}" data-id="${r.id}">
        <header class="req__head">
          <span class="av" style="--c:${colorFor(r.manager)}">${esc(initials(r.manager))}</span>
          <div class="req__who"><b>${esc(r.manager)}</b>${r.priority === "urgent" && st !== "done" && !r.archived ? `<span class="urgent">${ico("zap")} Urgent</span>` : ""}
            <small>${esc(r.team || "Sans équipe")} · demandé ${rel(r.createdAt)} (${fmtFull(r.createdAt)})</small></div>
          <div class="req__total"><div class="bar ${st === "done" ? "bar--done" : ""}"><i style="width:${t.pct}%"></i></div><b>${t.sent}/${t.req}</b></div>
          <span class="badge badge--${st}">${STATUS_LABEL[st]}</span>
          <div class="req__actions">
            <button class="icon-btn" data-act="history" data-id="${r.id}" title="Historique" aria-label="Historique">${ico("clock")}</button>
            ${!r.archived ? `<button class="icon-btn t-trainer" data-act="edit" data-id="${r.id}" title="Modifier" aria-label="Modifier">${ico("edit")}</button>` : ""}
            <button class="icon-btn t-trainer" data-act="archive" data-id="${r.id}" title="${r.archived ? "Restaurer" : "Archiver"}" aria-label="${r.archived ? "Restaurer" : "Archiver"}">${ico(r.archived ? "undo" : "archive")}</button>
            <button class="icon-btn icon-btn--del t-trainer" data-act="delete" data-id="${r.id}" title="Supprimer" aria-label="Supprimer">${ico("trash")}</button>
          </div>
        </header>
        <div class="req__lines">${r.lines.map((l) => {
          const sh = getShift(l.shift), done = l.assigned >= l.requested;
          const pct = Math.min(100, Math.round((l.assigned / l.requested) * 100));
          return `<div class="line" style="--c:${sh.color}">
            <span class="shift-tag">${ico(sh.icon)} ${esc(sh.name)} <small>${range(sh)}</small></span>
            <div class="bar ${done ? "bar--done" : ""}"><i style="width:${pct}%"></i></div>
            <div class="line__num">${l.assigned}/${l.requested}<small>${done ? "complet" : lineRem(l) + " restants"}</small></div>
            <div class="line__act">${done ? `<span class="line__ok" title="Complet">${ico("check")}</span>` : r.archived ? "" : sendBtn(r, l)}</div>
          </div>`;
        }).join("")}</div>
        ${r.note ? `<p class="req__note"><b>Précisions :</b> ${esc(r.note)}</p>` : ""}
      </article>`;
    }).join("");
    state.flashId = null;
  }

  /* ---------- Shifts ---------- */
  function renderShiftsView() {
    $("#shiftDetail").innerHTML = SHIFTS.map((sh) => {
      const st = shiftStats(sh.id);
      const lines = [];
      activeReqs().forEach((r) => r.lines.forEach((l) => { if (l.shift === sh.id) lines.push({ r, l }); }));
      lines.sort((a, b) => (lineRem(b.l) > 0) - (lineRem(a.l) > 0) || (b.r.priority === "urgent") - (a.r.priority === "urgent") || a.r.createdAt.localeCompare(b.r.createdAt));
      const badge = !st.req ? `<span class="badge badge--archived">Aucune demande</span>` : st.rem ? `<span class="badge badge--${st.sent ? "partial" : "pending"}">${st.pct}% couvert</span>` : `<span class="badge badge--done">Couvert</span>`;
      return `<article class="card sd" style="--c:${sh.color}">
        <div class="sd__top"><span class="shift__ico">${ico(sh.icon)}</span><div><h3>${esc(sh.name)}</h3><p>${range(sh)} · ${plural(st.count, "demande", "demandes")}</p></div>${badge}</div>
        <div class="sd__nums"><div><strong>${st.req}</strong><span>Demandés</span></div><div><strong>${st.sent}</strong><span>Envoyés</span></div><div><strong>${st.rem}</strong><span>Restants</span></div></div>
        <div class="bar ${st.req && !st.rem ? "bar--done" : ""}"><i style="width:${st.pct}%"></i></div>
        <p class="sd__sub">Managers sur ce shift</p>
        <div class="rows">${lines.length ? lines.map(({ r, l }) => `<div class="row"><span class="av" style="--c:${colorFor(r.manager)}">${esc(initials(r.manager))}</span>
          <div class="row__who"><b>${esc(r.manager)} ${r.priority === "urgent" && lineRem(l) ? `<span class="urgent">${ico("zap")} Urgent</span>` : ""}</b><small>${esc(r.team || "Sans équipe")}</small></div>
          <div class="row__rem"><b>${l.assigned}/${l.requested}</b>${lineRem(l) ? "envoyés" : "complet"}</div>${lineRem(l) ? sendBtn(r, l) : ""}</div>`).join("") : `<p class="empty-mini">Aucune demande sur ce shift.</p>`}</div>
      </article>`;
    }).join("");
  }

  function renderActivity() { $("#activityFeed").innerHTML = feedHtml(events().slice(0, 80)); }

  /* ---------- Rendu global ---------- */
  function renderTrainerUI() {
    document.body.classList.toggle("is-trainer", state.trainer);
    $("#trainerLabel").textContent = state.trainer ? "Formateur connecté" : "Espace formateur";
    $("#trainerIcon").innerHTML = `<use href="#i-${state.trainer ? "unlock" : "lock"}"/>`;
    $("#sideLockIcon").innerHTML = `<use href="#i-${state.trainer ? "unlock" : "lock"}"/>`;
    $("#sideRole").textContent = state.trainer ? "Mode formateur" : "Mode consultation";
    $("#sideRoleSub").textContent = state.trainer ? "Tu peux enregistrer les envois." : "Déverrouille pour gérer les envois.";
    $("#sideTrainerBtn").textContent = state.trainer ? "Se déconnecter" : "Espace formateur";
  }

  function renderAll() {
    $("#navCount").textContent = globalStats().open;
    renderTrainerUI();
    renderOverview();
    renderRequests();
    renderShiftsView();
    renderActivity();
    updateSummary();
  }

  /* ---------- Routage ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, "") || "overview";
    state.view = VIEWS[h] ? h : "overview";
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + state.view));
    $$(".side-link").forEach((l) => l.classList.toggle("active", l.dataset.view === state.view));
    $("#pageTitle").textContent = VIEWS[state.view][0];
    $("#pageSub").textContent = VIEWS[state.view][1];
    document.title = `${VIEWS[state.view][0]} · GLAgency`;
    closeNav();
    window.scrollTo({ top: 0 });
    // rafraîchit les temps relatifs
    renderOverview(); renderActivity();
  }
  const app = $("#app");
  const closeNav = () => { app.classList.remove("nav-open"); $("#burger").setAttribute("aria-expanded", "false"); };
  $("#burger").addEventListener("click", () => {
    const open = app.classList.toggle("nav-open");
    $("#burger").setAttribute("aria-expanded", String(open));
  });
  $("#scrim").addEventListener("click", closeNav);
  window.addEventListener("hashchange", route);
  const go = (v) => { location.hash = "#/" + v; };

  /* ---------- Toasts & modales ---------- */
  function toast(msg, warn = false) {
    const el = document.createElement("div");
    el.className = "toast" + (warn ? " toast--warn" : "");
    el.innerHTML = `${ico(warn ? "bell" : "check")} <span>${esc(msg)}</span>`;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .4s, transform .4s"; el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 400); }, 3200);
  }
  $$("dialog.modal").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  });
  function ask(title, text, okLabel = "Confirmer") {
    const d = $("#confirmDialog");
    $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmOk").textContent = okLabel;
    return new Promise((resolve) => {
      d.returnValue = "";
      d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
      d.showModal();
    });
  }

  /* ---------- Nouvelle demande (multi-shifts) ---------- */
  const form = $("#requestForm");
  const F = (n) => form.querySelector(`[name="${n}"]`);
  $("#shiftPick").innerHTML = SHIFTS.map((sh) => `
    <div class="pick" data-shift="${sh.id}" style="--c:${sh.color}">
      <label class="pick__main">
        <input type="checkbox" value="${sh.id}" aria-label="Shift ${esc(sh.name)}" />
        <span class="pick__box">${ico("check")}</span>
        <span class="shift__ico">${ico(sh.icon)}</span>
        <span class="pick__info"><b>${esc(sh.name)}</b><small>${range(sh)}</small></span>
      </label>
      <div class="stepper stepper--sm">
        <button type="button" data-pstep="-1" aria-label="Moins" disabled>${ico("minus")}</button>
        <input type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Nombre de chatters ${esc(sh.name)}" disabled />
        <button type="button" data-pstep="1" aria-label="Plus" disabled>${ico("plus")}</button>
      </div>
    </div>`).join("");

  function setPick(pick, on) {
    const cb = $('input[type="checkbox"]', pick), num = $('input[type="number"]', pick);
    cb.checked = on;
    pick.classList.toggle("is-on", on);
    num.disabled = !on;
    $$("[data-pstep]", pick).forEach((b) => (b.disabled = !on));
    if (on && !(parseInt(num.value, 10) >= 1)) num.value = 1;
  }
  function selection() {
    return $$(".pick", form).filter((p) => $('input[type="checkbox"]', p).checked).map((p) => ({
      shift: p.dataset.shift, n: clamp(parseInt($('input[type="number"]', p).value, 10) || 0, 0, 99),
    }));
  }
  function updateSummary() {
    const sel = selection();
    $("#summaryList").innerHTML = sel.length
      ? sel.map(({ shift, n }) => { const sh = getShift(shift); return `<li style="--c:${sh.color}"><span class="shift__ico">${ico(sh.icon)}</span><b>${esc(sh.name)}</b><em>${n}</em></li>`; }).join("")
      : `<li class="none">Aucun shift sélectionné.</li>`;
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
    const b = e.target.closest("[data-pstep]");
    if (!b) return;
    const num = $('input[type="number"]', b.closest(".pick"));
    num.value = clamp((parseInt(num.value, 10) || 1) + Number(b.dataset.pstep), 1, 99);
    updateSummary();
  });
  $("#pickAll").addEventListener("click", () => {
    const all = $$(".pick", form).every((p) => $('input[type="checkbox"]', p).checked);
    $$(".pick", form).forEach((p) => setPick(p, !all));
    $("#pickAll").textContent = all ? "Tout sélectionner" : "Tout désélectionner";
    $("#shiftError").textContent = "";
    updateSummary();
  });

  form.addEventListener("submit", (e) => {
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

    const req = {
      id: uid(), manager, team: (F("team")?.value || "").trim(), priority: form.querySelector('input[name="priority"]:checked').value,
      note: (F("note")?.value || "").trim(), createdAt: new Date().toISOString(), archived: false,
      lines: SHIFTS.map((s) => sel.find((x) => x.shift === s.id)).filter(Boolean).map((s) => ({ shift: s.shift, requested: s.n, assigned: 0, history: [] })),
    };
    state.requests = state.requests.filter((r) => !r.demo).concat(req); // les exemples disparaissent à la 1re vraie demande
    if (CLOUD) state.seen && state.seen.add(req.id);
    state.flashId = req.id;
    state.filters = { q: "", shift: "all", status: "active" };
    $("#searchInput").value = ""; $("#statusFilter").value = "active";

    form.reset();
    $$(".pick", form).forEach((p) => setPick(p, false));
    $$(".seg__opt", form).forEach((l) => l.classList.toggle("is-selected", $("input", l).checked));
    $("#pickAll").textContent = "Tout sélectionner";
    const total = req.lines.reduce((a, l) => a + l.requested, 0);
    save(req);
    toast(`Demande enregistrée : ${chatters(total)} sur ${plural(req.lines.length, "shift", "shifts")}`);
    go("requests");
  });

  /* ---------- Filtres ---------- */
  $("#searchInput").addEventListener("input", (e) => { state.filters.q = e.target.value; renderRequests(); });
  $("#statusFilter").addEventListener("change", (e) => { state.filters.status = e.target.value; renderRequests(); });
  $("#shiftFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-shift]");
    if (b) { state.filters.shift = b.dataset.shift; renderRequests(); }
  });

  /* ---------- Mode formateur ---------- */
  const pinDlg = $("#pinDialog");
  function setTrainer(on) {
    state.trainer = on;
    try { on ? sessionStorage.setItem(TRAINER_KEY, "1") : sessionStorage.removeItem(TRAINER_KEY); } catch {}
    renderTrainerUI();
  }
  async function toggleTrainer() {
    if (CLOUD) {
      if (await ask("Te déconnecter ?", "Tu devras te reconnecter avec ton e-mail et ton mot de passe.", "Se déconnecter")) await sb.auth.signOut();
      return;
    }
    if (state.trainer) {
      if (await ask("Quitter le mode formateur ?", "Tu repasseras en simple consultation.", "Quitter")) { setTrainer(false); toast("Mode formateur désactivé", true); }
      return;
    }
    $("#pinInput").value = ""; $("#pinError").textContent = "";
    pinDlg.showModal(); $("#pinInput").focus();
  }
  $("#trainerBtn").addEventListener("click", toggleTrainer);
  $("#sideTrainerBtn").addEventListener("click", () => { closeNav(); toggleTrainer(); });
  $("[data-open-pin]").addEventListener("click", toggleTrainer);
  $("#pinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#pinInput").value === getPin()) { pinDlg.close(); setTrainer(true); toast("Mode formateur activé"); }
    else {
      $("#pinError").textContent = "Code incorrect.";
      $("#pinInput").classList.remove("shake"); void $("#pinInput").offsetWidth; $("#pinInput").classList.add("shake");
    }
  });

  /* ---------- Actions sur les demandes ---------- */
  let cur = { id: null, shift: null };
  const findReq = (id) => state.requests.find((r) => r.id === id);

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const r = findReq(btn.dataset.id);
    if (!r) return;
    cur = { id: r.id, shift: btn.dataset.shift || null };
    const act = btn.dataset.act;
    if (act !== "history" && !state.trainer) return;

    if (act === "send") {
      const l = r.lines.find((x) => x.shift === cur.shift), sh = getShift(cur.shift), rem = lineRem(l);
      $("#sendInfo").innerHTML = `<b>${esc(r.manager)}</b> · ${esc(sh.name)} ${range(sh)}<br>${l.assigned} envoyés sur ${l.requested} · <b>${plural(rem, "restant", "restants")}</b>`;
      const c = $("#sendCount"); c.max = rem; c.value = 1;
      $("#sendNames").value = ""; $("#sendError").textContent = "";
      $("#sendDialog").showModal();
    }
    if (act === "edit") openEdit(r);
    if (act === "history") openHistory(r);
    if (act === "archive") { r.archived = !r.archived; save(r); toast(r.archived ? "Demande archivée" : "Demande restaurée"); }
    if (act === "delete") {
      if (await ask("Supprimer cette demande ?", `La demande de ${r.manager} sera définitivement supprimée.`, "Supprimer")) {
        removeReqs([r.id]); toast("Demande supprimée", true);
      }
    }
  });

  // Envoi de chatters sur une ligne (shift)
  $("#sendDialog").addEventListener("click", (e) => {
    const b = e.target.closest("[data-send-step]");
    if (b) { const c = $("#sendCount"); c.value = clamp((parseInt(c.value, 10) || 1) + Number(b.dataset.sendStep), 1, Number(c.max) || 99); }
  });
  $("#sendAll").addEventListener("click", () => {
    const l = findReq(cur.id).lines.find((x) => x.shift === cur.shift);
    $("#sendCount").value = lineRem(l);
  });
  $("#sendForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = findReq(cur.id), l = r.lines.find((x) => x.shift === cur.shift);
    const n = parseInt($("#sendCount").value, 10), rem = lineRem(l);
    if (!(n >= 1 && n <= rem)) { $("#sendError").textContent = `Entre 1 et ${rem}.`; return; }
    l.assigned += n;
    l.history.push({ ts: new Date().toISOString(), n, names: $("#sendNames").value.trim() });
    $("#sendDialog").close();
    const wasDone = statusOf(r) === "done";
    save(r);
    toast(wasDone ? `Demande de ${r.manager} entièrement satisfaite !` : `${chatters(n)} envoyé${n > 1 ? "s" : ""} à ${r.manager} · ${getShift(cur.shift).name}`);
  });

  // Modification d'une demande (nombre par shift)
  function openEdit(r) {
    $("#editInfo").textContent = `${r.manager} · mets 0 pour retirer un shift non commencé.`;
    $("#editLines").innerHTML = SHIFTS.map((sh) => {
      const l = r.lines.find((x) => x.shift === sh.id);
      return `<div class="edit-row" style="--c:${sh.color}"><span class="shift__ico">${ico(sh.icon)}</span>
        <div><b>${esc(sh.name)}</b><small>${range(sh)}${l && l.assigned ? ` · ${l.assigned} déjà envoyés` : ""}</small></div>
        <div class="stepper"><button type="button" data-estep="-1" aria-label="Moins">${ico("minus")}</button>
        <input type="number" min="0" max="99" value="${l ? l.requested : 0}" data-eshift="${sh.id}" inputmode="numeric" aria-label="Chatters ${esc(sh.name)}" />
        <button type="button" data-estep="1" aria-label="Plus">${ico("plus")}</button></div></div>`;
    }).join("");
    $("#editPriority").value = r.priority; $("#editError").textContent = "";
    $("#editDialog").showModal();
  }
  $("#editDialog").addEventListener("click", (e) => {
    const b = e.target.closest("[data-estep]");
    if (b) { const i = $("input", b.parentElement); i.value = clamp((parseInt(i.value, 10) || 0) + Number(b.dataset.estep), 0, 99); }
  });
  $("#editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = findReq(cur.id), lines = [];
    for (const sh of SHIFTS) {
      const v = clamp(parseInt($(`[data-eshift="${sh.id}"]`).value, 10) || 0, 0, 99);
      const old = r.lines.find((x) => x.shift === sh.id);
      if (old && v < old.assigned) { $("#editError").textContent = v === 0 ? `${sh.name} : ${chatters(old.assigned)} déjà envoyé${old.assigned > 1 ? "s" : ""}, impossible de retirer ce shift.` : `${sh.name} : ${chatters(old.assigned)} déjà envoyé${old.assigned > 1 ? "s" : ""}, mets au moins ${old.assigned}.`; return; }
      if (v > 0) lines.push(old ? { ...old, requested: v } : { shift: sh.id, requested: v, assigned: 0, history: [] });
    }
    if (!lines.length) { $("#editError").textContent = "Garde au moins un shift."; return; }
    r.lines = lines; r.priority = $("#editPriority").value;
    $("#editDialog").close(); save(r); toast("Demande mise à jour");
  });

  // Historique
  function openHistory(r) {
    $("#historyInfo").innerHTML = `<b>${esc(r.manager)}</b>${r.team ? " · " + esc(r.team) : ""}`;
    const sent = [];
    r.lines.forEach((l) => l.history.forEach((h) => sent.push({ ...h, shift: l.shift })));
    sent.sort((a, b) => a.ts.localeCompare(b.ts));
    const items = [`<li class="t-start"><b>Demande créée : ${chatters(reqTotals(r).req)}</b>${r.priority === "urgent" ? " · urgent" : ""}<small>${fmtFull(r.createdAt)}</small><span>${r.lines.map((l) => `${esc(getShift(l.shift).name)} ×${l.requested}`).join(" · ")}</span>${r.note ? `<span>« ${esc(r.note)} »</span>` : ""}</li>`]
      .concat(sent.map((h) => `<li><b>${chatters(h.n)} envoyé${h.n > 1 ? "s" : ""} · ${esc(getShift(h.shift).name)}</b><small>${fmtFull(h.ts)}</small>${h.names ? `<span>${esc(h.names)}</span>` : ""}</li>`));
    if (statusOf(r) === "done") items.push(`<li class="t-done"><b>Demande satisfaite</b><small>${chatters(reqTotals(r).req)} en poste</small></li>`);
    $("#historyList").innerHTML = items.join("");
    $("#undoLast").hidden = !sent.length;
    $("#historyDialog").showModal();
  }
  $("#undoLast").addEventListener("click", () => {
    const r = findReq(cur.id);
    let best = null;
    r.lines.forEach((l) => l.history.forEach((h, i) => { if (!best || h.ts > best.h.ts) best = { l, h, i }; }));
    if (!best) return;
    best.l.history.splice(best.i, 1);
    best.l.assigned = Math.max(0, best.l.assigned - best.h.n);
    save(r); openHistory(r); toast("Dernier envoi annulé", true);
  });

  /* ---------- Outils ---------- */
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  function exportCsv(list) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Date", "Manager", "Équipe", "Shift", "Horaires", "Demandés", "Envoyés", "Restants", "Statut", "Priorité", "Note"];
    const rows = [];
    list.forEach((r) => r.lines.forEach((l) => {
      const sh = getShift(l.shift);
      rows.push([fmtFull(r.createdAt), r.manager, r.team, sh.name, range(sh), l.requested, l.assigned, lineRem(l), r.archived ? "Archivé" : l.assigned >= l.requested ? "Satisfait" : l.assigned ? "Partiel" : "En attente", r.priority === "urgent" ? "Urgente" : "Normale", r.note]);
    }));
    download(`glagency-demandes-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + [head, ...rows].map((l) => l.map(cell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
    toast("Export CSV téléchargé");
  }
  $("#exportCsv").addEventListener("click", () => exportCsv(filtered()));
  $("#exportAll").addEventListener("click", () => exportCsv(state.requests));
  $("#backupBtn").addEventListener("click", () => {
    download(`glagency-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.requests, null, 2), "application/json");
    toast("Sauvegarde téléchargée");
  });
  $("#restoreFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data) || data.some((r) => !r.id || !r.manager || !(r.lines || r.shift))) throw new Error();
        const imported = data.map(migrate);
        if (CLOUD) {
          imported.forEach((r) => { r.demo = undefined; });
          const ids = new Set(imported.map((r) => r.id));
          state.requests = state.requests.filter((r) => !ids.has(r.id)).concat(imported);
          save(imported);
        } else { state.requests = imported; save(); }
        toast(plural(data.length, "demande restaurée", "demandes restaurées"));
      } catch { toast("Fichier de sauvegarde invalide", true); }
    };
    reader.readAsText(file); e.target.value = "";
  });
  $("#clearBtn").addEventListener("click", async () => {
    if (await ask("Tout effacer ?", "Toutes les demandes seront supprimées définitivement. Pense à faire une sauvegarde avant.", "Tout effacer")) {
      removeReqs(state.requests.map((r) => r.id)); toast("Toutes les données ont été effacées", true);
    }
  });
  $("#clearDemo").addEventListener("click", () => { state.requests = state.requests.filter((r) => !r.demo); save(); toast("Exemples supprimés"); });
  $("#pinChangeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#newPin").value.trim();
    if (!/^\d{4,8}$/.test(v)) { $("#pinChangeError").textContent = "Le code doit contenir 4 à 8 chiffres."; return; }
    store.set(PIN_KEY, v); $("#newPin").value = ""; $("#pinChangeError").textContent = ""; toast("Code formateur modifié");
  });

  /* ---------- Démarrage ---------- */
  $("#todayChip").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
  if (!CLOUD && store.get(KEY) === null) store.set(KEY, JSON.stringify(state.requests));
  renderAll();
  route();

  /* ---------- Lien du formulaire à envoyer aux managers ---------- */
  function formUrl() {
    if (CFG.FORM_URL) return CFG.FORM_URL;
    const u = new URL("demande.html", location.href); u.hash = ""; u.search = "";
    return u.href;
  }
  const link = formUrl();
  $("#shareLink").value = link;
  $("#openForm").href = link;
  $("#waLink").href = "https://wa.me/?text=" + encodeURIComponent("Bonjour, voici le lien pour faire ta demande de chatters (choisis les shifts et le nombre) : " + link);
  (function shareStatus() {
    const el = $("#shareStatus");
    let cls = "ok", msg = "Les demandes envoyées via ce lien apparaissent ici en direct.";
    if (location.protocol === "file:") { cls = "warn"; msg = "Le site n'est pas encore en ligne : ce lien ne marchera pas chez tes managers. Mets-le d'abord sur GitHub Pages."; }
    else if (!CONFIGURED) { cls = "warn"; msg = "La base partagée n'est pas configurée (config.js) : les demandes des managers n'arriveront pas ici. Suis le LISEZ-MOI."; }
    else if (!CLOUD) { cls = "warn"; msg = "Connexion à la base impossible pour le moment. Recharge la page."; }
    el.className = "share__status share__status--" + cls;
    el.innerHTML = `${ico(cls === "ok" ? "check" : "bell")} <span>${esc(msg)}</span>`;
  })();
  $("#copyLink").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(link); }
    catch { const i = $("#shareLink"); i.select(); document.execCommand("copy"); }
    toast("Lien copié : envoie-le à tes managers");
  });
  $("#shareLink").addEventListener("focus", (e) => e.target.select());

  /* ---------- Connexion formateur (cloud) ---------- */
  if (CLOUD) {
    const applySession = (session) => {
      const on = !!session;
      state.trainer = on;
      document.body.classList.toggle("locked", !on);
      if (on) { $("#sideRoleSub").textContent = session.user.email || ""; state.seen = null; pull().then(startSync); }
      else { stopSync(); state.requests = []; state.seen = null; renderAll(); }
      renderTrainerUI();
      if (on) $("#sideRoleSub").textContent = session.user.email || "";
    };
    sb.auth.getSession().then(({ data }) => applySession(data.session));
    sb.auth.onAuthStateChange((evt, session) => { if (evt === "SIGNED_IN" || evt === "SIGNED_OUT") applySession(session); });
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = $("#loginBtn"); b.disabled = true; $("#loginError").textContent = "";
      const { error } = await sb.auth.signInWithPassword({ email: $("#loginEmail").value.trim(), password: $("#loginPass").value });
      b.disabled = false;
      if (error) $("#loginError").textContent = /invalid/i.test(error.message) ? "E-mail ou mot de passe incorrect." : "Connexion impossible. Réessaie.";
      else $("#loginPass").value = "";
    });
  }
  setInterval(() => { renderOverview(); if (state.view === "activity") renderActivity(); }, 60000);
})();
