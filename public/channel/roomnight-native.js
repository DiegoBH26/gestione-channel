const RN_STORE = "roomnight-monitor-v1";
const RN_GOALS_STORE = "roomnight-analyses-v1";
const RN_CLUSTERS_STORE = "roomnight-clusters-v1";
const RN_RECOVERY_KEY = "roomnight-integrated-recovery-20260728-v3";
const RN_MONTHS = ["Luglio", "Agosto", "Settembre"];
const RN_MONTH_KEYS = ["2026-07", "2026-08", "2026-09"];
const RN_WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function rnDate(month, day) {
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function rnDays(from, to) {
  const out = [], cursor = new Date(`${from}T12:00:00`), end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
function rnSeed(id, name, capacity) {
  return { id, name, capacity, rooms: Array.from({ length: capacity }, (_, i) => `Camera ${i + 1}`), sold: {} };
}
function rnLoad(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch { return fallback; }
}
let rnProperties = rnLoad(RN_STORE, [
  rnSeed("annita", "B&B Annita", 5),
  rnSeed("mcl", "MCL · Masseria Corda di Lana", 14),
  rnSeed("gdm", "GDM · Gioia del Mare", 11),
]);
let rnGoals = rnLoad(RN_GOALS_STORE, []);
let rnClusters = rnLoad(RN_CLUSTERS_STORE, []);
let rnPropertyId = rnProperties[0].id;
let rnMonth = 0;
let rnFrom = "";
let rnTo = "";
let rnSelectedGoal = "";
let rnSelectedCluster = "";
let rnClusterFormOpen = false;
let rnEditingClusterId = "";
let rnClusterNotice = "";

const RN_SCREENSHOT_OVERRIDES = {
  annita: [5,5,5,5,5,5,5,5,4,4,1,5,5,5,4,5,5,2],
  mcl: [14,14,14,13,13,14,14,13,14,14,12,13,13,14,13,12,13,5],
  gdm: [6,9,10,8,8,7,8,7,7,11,5,8,8,8,7,9,10,6],
};
const RN_RECOVERY_DATES = rnDays("2026-07-23", "2026-08-09");
const RN_RECOVERED_GOALS = [
  { id: "recovery-annita-2307-0908", propertyId: "annita", name: "23 Luglio – 9 Agosto", from: "2026-07-23", to: "2026-08-09", initialFree: 25, createdAt: "2026-07-23T12:00:00.000Z" },
  { id: "recovery-mcl-2307-0908", propertyId: "mcl", name: "23 Luglio – 9 Agosto", from: "2026-07-23", to: "2026-08-09", initialFree: 82, createdAt: "2026-07-23T12:00:00.000Z" },
  { id: "recovery-gdm-2307-0908", propertyId: "gdm", name: "23 Luglio – 9 Agosto", from: "2026-07-23", to: "2026-08-09", initialFree: 96, createdAt: "2026-07-23T12:00:00.000Z" },
];

function rnRecoverOriginalData() {
  if (localStorage.getItem(RN_RECOVERY_KEY) === "done") return;
  const original = Array.isArray(window.RN_ORIGINAL_PROPERTIES)
    ? JSON.parse(JSON.stringify(window.RN_ORIGINAL_PROPERTIES))
    : [];
  original.forEach(item => {
    item.name = String(item.name || "").replace("Â·", "·");
    const values = RN_SCREENSHOT_OVERRIDES[item.id];
    if (values) RN_RECOVERY_DATES.forEach((date, index) => { item.sold[date] = values[index]; });
  });

  const localById = new Map((Array.isArray(rnProperties) ? rnProperties : []).map(item => [String(item.id), item]));
  const mergedOriginal = original.map(seed => {
    const local = localById.get(String(seed.id));
    if (!local) return seed;
    localById.delete(String(seed.id));
    return {
      ...seed,
      ...local,
      name: String(local.name || seed.name).replace("Â·", "·"),
      capacity: Number(local.capacity) || seed.capacity,
      rooms: Array.isArray(local.rooms) && local.rooms.length ? local.rooms : seed.rooms,
      sold: { ...seed.sold, ...(local.sold || {}) },
    };
  });
  rnProperties = [...mergedOriginal, ...localById.values()];
  rnProperties.forEach(item => {
    const values = RN_SCREENSHOT_OVERRIDES[item.id];
    if (values) RN_RECOVERY_DATES.forEach((date, index) => { item.sold[date] = values[index]; });
  });

  const existingGoalKeys = new Set((Array.isArray(rnGoals) ? rnGoals : []).map(item => `${item.propertyId}|${item.from}|${item.to}`));
  RN_RECOVERED_GOALS.forEach(goal => {
    if (!existingGoalKeys.has(`${goal.propertyId}|${goal.from}|${goal.to}`)) rnGoals.push(goal);
  });
  rnGoals = rnGoals.map(goal =>
    goal.id === "recovery-mcl-2307-0908"
      ? { ...goal, initialFree: 82 }
      : goal
  );
  rnSave();
  localStorage.setItem(RN_RECOVERY_KEY, "done");
}

function rnEnsureState() {
  if (!Array.isArray(rnProperties) || !rnProperties.length) {
    rnProperties = [rnSeed("annita", "B&B Annita", 5)];
  }
  rnProperties = rnProperties.filter(Boolean).map((item, index) => {
    const capacity = Math.max(1, Math.min(100, Number(item.capacity) || 1));
    return {
      id: String(item.id || `struttura-${index + 1}`),
      name: String(item.name || `Struttura ${index + 1}`),
      capacity,
      rooms: Array.isArray(item.rooms) ? item.rooms : Array.from({ length: capacity }, (_, i) => `Camera ${i + 1}`),
      sold: item.sold && typeof item.sold === "object" && !Array.isArray(item.sold) ? item.sold : {},
    };
  });
  if (!rnProperties.some(item => item.id === rnPropertyId)) rnPropertyId = rnProperties[0].id;
  if (!Array.isArray(rnGoals)) rnGoals = [];
  rnGoals = rnGoals.filter(item =>
    item && item.id && item.propertyId &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(item.from || "")) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(item.to || ""))
  );
}
rnRecoverOriginalData();
function rnProperty() {
  rnEnsureState();
  return rnProperties.find(p => p.id === rnPropertyId) || rnProperties[0];
}
function rnSave() {
  localStorage.setItem(RN_STORE, JSON.stringify(rnProperties));
  localStorage.setItem(RN_GOALS_STORE, JSON.stringify(rnGoals));
  localStorage.setItem(RN_CLUSTERS_STORE, JSON.stringify(rnClusters));
}
function rnMetric(property, from, to) {
  const days = rnDays(from, to).filter(d => d >= "2026-07-01" && d <= "2026-09-30");
  const sold = days.reduce((sum, day) => sum + (property.sold[day] || 0), 0);
  const inventory = days.length * property.capacity;
  return { days: days.length, sold, inventory, free: inventory - sold, rate: inventory ? Math.round(sold / inventory * 100) : 0 };
}
function rnFormat(value) {
  try {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
  } catch { return String(value || ""); }
}
function rnClusterMetrics(cluster) {
  const members = rnProperties.filter(property => cluster.propertyIds.includes(property.id));
  const details = members.map(property => {
    const metric = rnMetric(property, cluster.from, cluster.to);
    const goal = rnGoals.find(item =>
      item.propertyId === property.id && item.from === cluster.from && item.to === cluster.to
    );
    return { property, metric, initialFree: goal ? Number(goal.initialFree) : metric.inventory };
  });
  const inventory = details.reduce((sum, item) => sum + item.metric.inventory, 0);
  const sold = details.reduce((sum, item) => sum + item.metric.sold, 0);
  const free = inventory - sold;
  const initialFree = details.reduce((sum, item) => sum + item.initialFree, 0);
  return {
    details,
    rooms: members.reduce((sum, item) => sum + item.capacity, 0),
    days: rnDays(cluster.from, cluster.to).length,
    inventory,
    sold,
    free,
    initialFree,
    soldSince: initialFree - free,
    rate: inventory ? Math.round(sold / inventory * 100) : 0,
  };
}
function rnRenderClusters() {
  const selected = rnClusters.find(item => item.id === rnSelectedCluster);
  const metrics = selected ? rnClusterMetrics(selected) : null;
  const editing = rnClusters.find(item => item.id === rnEditingClusterId);
  const formFrom = editing?.from || rnFrom || "2026-07-23";
  const formTo = editing?.to || rnTo || "2026-08-09";
  return `<section class="panel rn-cluster-panel">
    <div class="rn-cluster-head">
      <div><span class="rn-label">Analisi aggregata</span><h3>Cluster di strutture</h3><p>Unisci strutture e periodo per controllare risultati complessivi.</p></div>
      <div class="rn-cluster-actions">
        <select id="rnClusterSelect"><option value="">Seleziona un cluster</option>${rnClusters.map(item => `<option value="${item.id}" ${item.id === rnSelectedCluster ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>
        <button class="primary" id="rnNewCluster">+ Crea cluster</button>
      </div>
    </div>
    ${rnClusterNotice ? `<div class="rn-cluster-notice" role="status">${escapeHtml(rnClusterNotice)}</div>` : ""}
    ${rnClusterFormOpen ? `<div class="rn-cluster-form">
      <label>Nome cluster (facoltativo)<input id="rnClusterName" value="${escapeHtml(editing?.name || "")}" placeholder="Se vuoto viene creato automaticamente"></label>
      <label>Dal<input id="rnClusterFrom" type="date" min="2026-07-01" max="2026-09-30" value="${formFrom}"></label>
      <label>Al<input id="rnClusterTo" type="date" min="2026-07-01" max="2026-09-30" value="${formTo}"></label>
      <div class="rn-cluster-members"><span>Strutture incluse</span>${rnProperties.map(item => `<label><input type="checkbox" data-rn-cluster-property="${item.id}" ${!editing || editing.propertyIds.includes(item.id) ? "checked" : ""}> ${escapeHtml(item.name)}</label>`).join("")}</div>
      <button class="primary" id="rnSaveCluster">${editing ? "Salva modifiche" : "Salva cluster"}</button><button id="rnCancelCluster">Annulla</button>
    </div>` : ""}
    ${metrics ? `<div class="rn-cluster-dashboard">
      <div class="rn-cluster-title"><div><h3>${escapeHtml(selected.name)}</h3><p>${rnFormat(selected.from)} — ${rnFormat(selected.to)} · ${metrics.details.length} strutture · ${metrics.rooms} camere</p></div><div class="rn-cluster-title-actions"><button id="rnEditCluster">Modifica cluster</button><button class="danger" id="rnDeleteCluster">Elimina cluster</button></div></div>
      <div class="rn-cluster-kpis">
        <article><span>Room night complessive</span><strong>${metrics.inventory}</strong><small>${metrics.rooms} camere × ${metrics.days} giorni</small></article>
        <article><span>Occupate / vendute</span><strong>${metrics.sold}</strong><small>${metrics.rate}% di occupazione</small></article>
        <article><span>Ancora libere</span><strong>${metrics.free}</strong><small>nel periodo del cluster</small></article>
        <article class="goal"><span>Vendute dall’avvio obiettivi</span><strong>${metrics.soldSince}</strong><small>${metrics.initialFree} libere iniziali</small></article>
      </div>
      <div class="rn-cluster-progress"><i style="width:${metrics.rate}%"></i><span>${metrics.rate}% occupazione complessiva</span></div>
      <div class="rn-cluster-table"><table><thead><tr><th>Struttura</th><th>Camere</th><th>Totali</th><th>Vendute</th><th>Libere</th><th>Occupazione</th><th>Da obiettivo</th></tr></thead><tbody>
        ${metrics.details.map(item => `<tr><td>${escapeHtml(item.property.name)}</td><td>${item.property.capacity}</td><td>${item.metric.inventory}</td><td>${item.metric.sold}</td><td>${item.metric.free}</td><td><b>${item.metric.rate}%</b></td><td>${item.initialFree - item.metric.free}</td></tr>`).join("")}
      </tbody></table></div>
    </div>` : ""}
  </section>`;
}
function rnRenderCalendar(property, dates, rangeActive) {
  const first = dates[0] || rnDate(rnMonth + 7, 1);
  const blanks = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  return `${Array.from({ length: blanks }, () => `<div class="rn-day rn-empty"></div>`).join("")}${dates.map(key => {
    const count = property.sold[key] || 0;
    const free = property.capacity - count;
    const monthLabel = RN_MONTHS[Number(key.slice(5, 7)) - 7]?.slice(0, 3) || "";
    return `<article class="rn-day ${free === 0 ? "rn-full" : count ? "rn-partial" : ""}">
      <div class="rn-day-top"><b>${Number(key.slice(-2))}${rangeActive ? `<em>${monthLabel}</em>` : ""}</b><span>${free === 0 ? "Completo" : `${free} lib.`}</span></div>
      <div class="rn-count"><strong>${count}</strong><small>/ ${property.capacity} vendute</small></div>
      <div class="rn-stepper"><button data-rn-step="${key}" data-delta="-1">−</button><div><i style="width:${count / property.capacity * 100}%"></i></div><button data-rn-step="${key}" data-delta="1">+</button></div>
    </article>`;
  }).join("")}`;
}
function renderRoomNightNative() {
  rnEnsureState();
  const property = rnProperty();
  const monthNumber = rnMonth + 7;
  const monthEnd = rnDate(monthNumber, new Date(2026, monthNumber, 0).getDate());
  const rangeActive = Boolean(rnFrom && rnTo);
  const safeFrom = rangeActive ? (rnFrom <= rnTo ? rnFrom : rnTo) : rnDate(monthNumber, 1);
  const safeTo = rangeActive ? (rnFrom <= rnTo ? rnTo : rnFrom) : monthEnd;
  const dates = rnDays(safeFrom, safeTo).filter(d => d >= "2026-07-01" && d <= "2026-09-30");
  const metric = rnMetric(property, safeFrom, safeTo);
  const goal = rnGoals.find(g => g.id === rnSelectedGoal && g.propertyId === property.id);
  const soldSince = goal ? goal.initialFree - metric.free : metric.sold;
  const goals = rnGoals.filter(g => g.propertyId === property.id);
  const title = rangeActive ? `${rnFormat(safeFrom)} — ${rnFormat(safeTo)}` : `${RN_MONTHS[rnMonth]} 2026`;
  return `${head("Room Night & Obiettivi", "Sezione interna per aggiornare vendite, disponibilità e obiettivi di ogni struttura.")}
    <div class="rn-top panel">
      <div><span class="rn-label">Struttura attiva</span><select id="rnProperty">${rnProperties.map(p => `<option value="${p.id}" ${p.id === property.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select></div>
      <div class="rn-capacity"><span>Camere monitorate</span><strong>${property.capacity}</strong></div>
      <button class="primary" id="rnAddStructure">+ Aggiungi struttura</button>
    </div>
    ${rnRenderClusters()}
    <div class="rn-kpis">
      <article class="rn-kpi rn-primary"><span>${goal ? "Vendute dall’avvio" : "Room night vendute"}</span><strong>${soldSince}</strong><small>${goal ? escapeHtml(goal.name) : "nel periodo selezionato"}</small></article>
      <article class="rn-kpi"><span>${goal ? "Libere ora nell’obiettivo" : "Ancora disponibili"}</span><strong>${metric.free}</strong><small>${goal ? `partenza: ${goal.initialFree}` : `su ${metric.inventory} totali`}</small></article>
      <article class="rn-kpi"><span>Occupazione</span><strong>${metric.rate}%</strong><div class="rn-progress"><i style="width:${metric.rate}%"></i></div></article>
      <article class="rn-kpi"><span>Periodo</span><strong class="rn-days">${metric.days} giorni</strong><small>${title}</small></article>
    </div>
    <div class="rn-layout">
      <div class="rn-main">
        <section class="panel rn-quick">
          <div><span class="rn-label">Aggiornamento di fine giornata</span><h3>Registra una vendita</h3></div>
          <label>Data di soggiorno<input id="rnQuickDate" type="date" min="2026-07-01" max="2026-09-30" value="${rnDate(monthNumber, 1)}"></label>
          <label>Room night vendute<input id="rnQuickAmount" type="number" min="1" max="${property.capacity}" value="1"></label>
          <button class="primary" id="rnQuickAdd">Aggiungi al planning</button>
        </section>
        <section class="panel rn-calendar-card">
          <div class="rn-calendar-head"><div><span class="rn-label">Planning disponibilità</span><h3>${title}</h3></div>
            ${rangeActive ? `<button id="rnClearRange">× Azzera periodo</button>` : `<div class="rn-tabs">${RN_MONTHS.map((m, i) => `<button data-rn-month="${i}" class="${i === rnMonth ? "active" : ""}">${m.slice(0, 3)}</button>`).join("")}</div>`}
          </div>
          <div class="rn-weekdays">${RN_WEEKDAYS.map(d => `<span>${d}</span>`).join("")}</div>
          <div class="rn-calendar">${rnRenderCalendar(property, dates, rangeActive)}</div>
        </section>
      </div>
      <aside class="rn-side">
        <section class="panel rn-range">
          <span class="rn-label">Analisi personalizzata</span><h3>Mostra un periodo</h3>
          <label>Dal<input id="rnFrom" type="date" min="2026-07-01" max="2026-09-30" value="${rnFrom}"></label>
          <label>Al<input id="rnTo" type="date" min="2026-07-01" max="2026-09-30" value="${rnTo}"></label>
          <p>${rangeActive ? "Il calendario mostra solo le date selezionate." : "Lascia vuoto per vedere il mese completo."}</p>
          <div class="rn-result"><div><span>${goal ? "Vendute da inizio" : "Vendute"}</span><b>${soldSince}</b></div><div><span>Libere</span><b>${metric.free}</b></div><div><span>${goal ? "Iniziali" : "Totali"}</span><b>${goal ? goal.initialFree : metric.inventory}</b></div></div>
          ${rangeActive && !goal ? `<div class="rn-goal-form"><h4>Salva come obiettivo</h4><label>Nome<input id="rnGoalName" placeholder="Es. Fine luglio GDM"></label><label>Camere libere alla data iniziale<input id="rnInitialFree" type="number" min="0" placeholder="Es. 96"></label><button class="primary" id="rnSaveGoal">Salva obiettivo</button></div>` : ""}
        </section>
        <section class="panel rn-goals"><span class="rn-label">Periodi salvati</span><h3>Obiettivi di ${escapeHtml(property.name)}</h3>
          ${goals.length ? goals.map(g => {
            const gm = rnMetric(property, g.from, g.to);
            return `<article class="${g.id === rnSelectedGoal ? "selected" : ""}"><button data-rn-goal="${g.id}"><span><b>${escapeHtml(g.name)}</b><small>${rnFormat(g.from)} — ${rnFormat(g.to)}</small></span><strong>${gm.free}<em> libere</em></strong></button><div><span>${g.initialFree - gm.free} vendute dall’avvio</span><button data-rn-delete="${g.id}">Elimina</button></div></article>`;
          }).join("") : `<p>Nessun obiettivo salvato.</p>`}
        </section>
      </aside>
    </div>`;
}
function bindRoomNightNative(root, rerender) {
  const refresh = () => { rnSave(); rerender(); };
  root.querySelector("#rnClusterSelect")?.addEventListener("change", e => { rnSelectedCluster = e.target.value; rnClusterNotice = ""; rerender(); });
  root.querySelector("#rnNewCluster")?.addEventListener("click", () => { rnEditingClusterId = ""; rnClusterNotice = ""; rnClusterFormOpen = true; rerender(); });
  root.querySelector("#rnEditCluster")?.addEventListener("click", () => { rnEditingClusterId = rnSelectedCluster; rnClusterFormOpen = true; rerender(); });
  root.querySelector("#rnCancelCluster")?.addEventListener("click", () => { rnClusterFormOpen = false; rnEditingClusterId = ""; rerender(); });
  root.querySelector("#rnSaveCluster")?.addEventListener("click", () => {
    const enteredName = root.querySelector("#rnClusterName")?.value.trim();
    const from = root.querySelector("#rnClusterFrom")?.value;
    const to = root.querySelector("#rnClusterTo")?.value;
    const propertyIds = [...root.querySelectorAll("[data-rn-cluster-property]:checked")].map(item => item.dataset.rnClusterProperty);
    if (!from || !to) { rnClusterNotice = "Seleziona una data iniziale e una data finale."; rerender(); return; }
    if (!propertyIds.length) { rnClusterNotice = "Seleziona almeno una struttura da inserire nel cluster."; rerender(); return; }
    const name = enteredName || `Cluster ${rnFormat(from <= to ? from : to)} – ${rnFormat(from <= to ? to : from)}`;
    const cluster = { id: rnEditingClusterId || String(Date.now()), name, from: from <= to ? from : to, to: from <= to ? to : from, propertyIds };
    if (rnEditingClusterId) {
      rnClusters = rnClusters.map(item => item.id === rnEditingClusterId ? cluster : item);
    } else {
      rnClusters.unshift(cluster);
    }
    rnSelectedCluster = cluster.id; rnClusterFormOpen = false; rnEditingClusterId = "";
    rnClusterNotice = enteredName ? `Cluster “${name}” salvato.` : `Cluster salvato automaticamente come “${name}”.`;
    refresh();
  });
  root.querySelector("#rnDeleteCluster")?.addEventListener("click", () => {
    rnClusters = rnClusters.filter(item => item.id !== rnSelectedCluster);
    rnSelectedCluster = ""; rnEditingClusterId = ""; rnClusterFormOpen = false; refresh();
  });
  root.querySelector("#rnProperty")?.addEventListener("change", e => { rnPropertyId = e.target.value; rnFrom = ""; rnTo = ""; rnSelectedGoal = ""; rerender(); });
  root.querySelector("#rnAddStructure")?.addEventListener("click", () => {
    const name = prompt("Nome della nuova struttura:");
    if (!name?.trim()) return;
    const capacity = Math.max(1, Math.min(100, Number(prompt("Quante camere vuoi monitorare?", "1")) || 1));
    const item = rnSeed(String(Date.now()), name.trim(), capacity);
    rnProperties.push(item); rnPropertyId = item.id; refresh();
  });
  root.querySelectorAll("[data-rn-month]").forEach(b => b.addEventListener("click", () => { rnMonth = Number(b.dataset.rnMonth); rerender(); }));
  root.querySelectorAll("[data-rn-step]").forEach(b => b.addEventListener("click", () => {
    const p = rnProperty(), key = b.dataset.rnStep;
    p.sold[key] = Math.max(0, Math.min(p.capacity, (p.sold[key] || 0) + Number(b.dataset.delta)));
    refresh();
  }));
  root.querySelector("#rnQuickAdd")?.addEventListener("click", () => {
    const p = rnProperty(), key = root.querySelector("#rnQuickDate").value;
    const amount = Number(root.querySelector("#rnQuickAmount").value) || 1;
    if (key >= "2026-07-01" && key <= "2026-09-30") p.sold[key] = Math.max(0, Math.min(p.capacity, (p.sold[key] || 0) + amount));
    refresh();
  });
  const updateRange = () => { rnFrom = root.querySelector("#rnFrom")?.value || ""; rnTo = root.querySelector("#rnTo")?.value || ""; rnSelectedGoal = ""; rerender(); };
  root.querySelector("#rnFrom")?.addEventListener("change", updateRange);
  root.querySelector("#rnTo")?.addEventListener("change", updateRange);
  root.querySelector("#rnClearRange")?.addEventListener("click", () => { rnFrom = ""; rnTo = ""; rnSelectedGoal = ""; rerender(); });
  root.querySelector("#rnSaveGoal")?.addEventListener("click", () => {
    const initialFree = Number(root.querySelector("#rnInitialFree").value);
    if (!Number.isFinite(initialFree) || initialFree < 0) return;
    const from = rnFrom <= rnTo ? rnFrom : rnTo, to = rnFrom <= rnTo ? rnTo : rnFrom;
    const item = { id: String(Date.now()), propertyId: rnPropertyId, name: root.querySelector("#rnGoalName").value.trim() || `${rnFormat(from)} — ${rnFormat(to)}`, from, to, initialFree };
    rnGoals.unshift(item); rnSelectedGoal = item.id; refresh();
  });
  root.querySelectorAll("[data-rn-goal]").forEach(b => b.addEventListener("click", () => {
    const g = rnGoals.find(x => x.id === b.dataset.rnGoal);
    if (g) { rnFrom = g.from; rnTo = g.to; rnSelectedGoal = g.id; rerender(); }
  }));
  root.querySelectorAll("[data-rn-delete]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); rnGoals = rnGoals.filter(g => g.id !== b.dataset.rnDelete);
    if (rnSelectedGoal === b.dataset.rnDelete) rnSelectedGoal = "";
    refresh();
  }));
}
