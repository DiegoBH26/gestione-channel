const state = {
  activeStructureId: "hotel-demo",
  savedStructures: {},
  generatedSimulations: [],
  selectedSimulationId: "",
  resultsReady: false,
  generatedResult: null,
  hotelName: "Hotel Demo",
  unitCategory: "multiunit",
  propertyType: "hotel",
  baseRoomType: "basic",
  basePrice: 100,
  minBasePrice: 70,
  maxBasePrice: 180,
  priceAnchors: [70, 75, 80, 85, 90, 100, 110, 125, 140, 150, 170],
  targetLevels: [
    { range: "0-14", adr: 44, revenue: 113 },
    { range: "15-24", adr: 50, revenue: 155 },
    { range: "25-34", adr: 52, revenue: 193 },
    { range: "35-44", adr: 55, revenue: 234 },
    { range: "45-54", adr: 58, revenue: 278 },
    { range: "55-64", adr: 61, revenue: 325 },
    { range: "65-74", adr: 76, revenue: 452 },
    { range: "75-84", adr: 92, revenue: 596 },
    { range: "85-94", adr: 108, revenue: 758 },
    { range: "95-100", adr: 123, revenue: 938 }
  ],
  roomTypes: [
    { id: "basic", name: "Basic", count: 8, ratio: 1, occupancy: 90 },
    { id: "standard", name: "Standard", count: 12, ratio: 1.18, occupancy: 82 },
    { id: "superior", name: "Superior", count: 6, ratio: 1.38, occupancy: 72 },
    { id: "suite", name: "Suite", count: 2, ratio: 1.85, occupancy: 50 }
  ],
  simulation: {
    stayDate: "",
    calendarFrom: "",
    calendarTo: "",
    days: [],
    periodType: "weekday",
    marketImportance: 60,
    hotelPressure: 90,
    currentAdrGlobal: 125,
    monthlyAdrTarget: 125,
    monthlyRevenueTarget: 0,
    maxIncrease: 55
  }
};

const periodModifiers = {
  low: { label: "Bassa stagione", factor: 0.92 },
  weekday: { label: "Feriale", factor: 1 },
  weekend: { label: "Weekend", factor: 1.08 },
  event: { label: "Evento", factor: 1.18 }
};

const defaultPriceAnchors = [70, 75, 80, 85, 90, 100, 110, 125, 140, 150, 170];

function defaultTargetLevels() {
  return [
    { range: "0-14", adr: 44, revenue: 113 },
    { range: "15-24", adr: 50, revenue: 155 },
    { range: "25-34", adr: 52, revenue: 193 },
    { range: "35-44", adr: 55, revenue: 234 },
    { range: "45-54", adr: 58, revenue: 278 },
    { range: "55-64", adr: 61, revenue: 325 },
    { range: "65-74", adr: 76, revenue: 452 },
    { range: "75-84", adr: 92, revenue: 596 },
    { range: "85-94", adr: 108, revenue: 758 },
    { range: "95-100", adr: 123, revenue: 938 }
  ];
}

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  restore();
  const today = new Date();
  if (!state.simulation.calendarFrom) {
    state.simulation.calendarFrom = toDateInput(today);
  }
  if (!state.simulation.calendarTo) {
    state.simulation.calendarTo = toDateInput(addDays(today, 6));
  }
  if (!Array.isArray(state.simulation.days) || !state.simulation.days.length) {
    generateCalendarDays();
  }
  bindEvents();
  renderAll();
});

function cacheElements() {
  [
    "hotelName", "unitCategory", "propertyType", "baseRoomType", "basePrice",
    "minBasePrice", "maxBasePrice", "roomTypes", "calendarFrom", "calendarTo",
    "periodType", "maxIncrease", "currentAdrGlobal", "monthlyAdrTarget",
    "monthlyRevenueTarget", "marketBand",
    "hotelBand", "periodOccupancy", "remainingRoomNights", "rmsAverage", "finalIndex", "estimatedRevenue", "recommendations",
    "matrixTables", "sideIndex", "sideBasePrice", "todayLabel", "currentStructureContext", "viewTitle",
    "viewSubtitle", "addRoomType", "resetDemo", "exportCsv", "priceAnchors",
    "resetAnchors", "targetRows", "dailyInputs", "generateCalendar", "saveSetup",
    "applyGenerate", "refreshPricing", "savedStructureSelect", "loadStructure", "newStructure", "simulationHistory",
    "simulationReport", "printSimulation", "saveSimulation", "sidebarSimulationList",
    "historyStructureSelect", "structureDashboard", "homeUnitFilter", "homeTypeFilter", "homeNewStructure"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  ["hotelName", "unitCategory", "propertyType", "baseRoomType", "basePrice", "minBasePrice", "maxBasePrice"].forEach((id) => {
    els[id].addEventListener("input", () => {
      const value = els[id].type === "number" ? number(els[id].value) : els[id].value;
      state[id] = value;
      persistActiveStructure();
      markResultsDirty();
      renderDerived();
    });
  });

  [els.homeUnitFilter, els.homeTypeFilter].forEach((filter) => {
    filter.addEventListener("change", renderStructureDashboard);
  });

  els.homeNewStructure.addEventListener("click", () => {
    createNewStructure();
    switchTab("setup");
    confirmButton(els.homeNewStructure, "Creata");
  });

  ["calendarFrom", "calendarTo", "periodType", "maxIncrease", "currentAdrGlobal", "monthlyAdrTarget", "monthlyRevenueTarget"].forEach((id) => {
    els[id].addEventListener("input", () => {
      state.simulation[id] = els[id].type === "number" || els[id].type === "range" ? number(els[id].value) : els[id].value;
      markResultsDirty();
      renderDerived();
    });
  });

  els.generateCalendar.addEventListener("click", () => {
    generateCalendarDays();
    markResultsDirty();
    renderAll();
    confirmButton(els.generateCalendar, "Generato");
  });

  els.saveSetup.addEventListener("click", () => {
    syncCalendarSoldRooms();
    saveCurrentStructure();
    renderAll();
    confirmButton(els.saveSetup, "Salvato");
  });

  els.applyGenerate.addEventListener("click", () => {
    updatePricingResults(els.applyGenerate, "Generato");
  });

  els.refreshPricing.addEventListener("click", () => {
    updatePricingResults(els.refreshPricing, "Aggiornata");
  });

  els.saveSimulation.addEventListener("click", () => {
    if (!state.resultsReady || !state.generatedResult) {
      updatePricingResults();
    }
    saveGeneratedSimulation(state.generatedResult);
    renderSimulationHistory();
    renderSidebarHistory();
    switchTab("simulations");
    save();
    confirmButton(els.saveSimulation, "Salvata");
  });

  els.loadStructure.addEventListener("click", () => {
    loadSelectedStructure();
    confirmButton(els.loadStructure, "Caricata");
  });

  els.newStructure.addEventListener("click", () => {
    createNewStructure();
    confirmButton(els.newStructure, "Creata");
  });

  els.savedStructureSelect.addEventListener("change", () => {
    loadSelectedStructure();
  });

  els.historyStructureSelect.addEventListener("change", () => {
    loadStructureById(els.historyStructureSelect.value);
  });

  els.addRoomType.addEventListener("click", () => {
    const id = `room_${Date.now()}`;
    state.roomTypes.push({ id, name: "Nuova camera", count: 1, ratio: 1.15 });
    saveAndRender();
    confirmButton(els.addRoomType, "✓");
  });

  els.resetDemo.addEventListener("click", () => {
    localStorage.removeItem("revenuePricingSimulator");
    location.reload();
  });

  els.resetAnchors.addEventListener("click", () => {
    state.priceAnchors = [...defaultPriceAnchors];
    renderAll();
    confirmButton(els.resetAnchors, "Reimpostate");
  });

  els.exportCsv.addEventListener("click", () => {
    exportCsv();
    confirmButton(els.exportCsv, "Esportato");
  });

  els.printSimulation.addEventListener("click", () => {
    if (!state.selectedSimulationId && simulationsForActiveStructure().length) {
      state.selectedSimulationId = simulationsForActiveStructure()[0].id;
      renderSimulationHistory();
    }
    window.print();
    confirmButton(els.printSimulation, "Aperto");
  });
}

function updatePricingResults(button, label) {
  state.generatedResult = calculateAll();
  state.resultsReady = true;
  renderSimulation();
  renderSimulationHistory();
  save();
  if (button && label) confirmButton(button, label);
}

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === tabId));
  const titles = {
    home: ["Dashboard strutture", "Scegli una struttura salvata o crea un nuovo setup."],
    setup: ["Setup struttura", "Imposta camere, listino, fasce e proporzioni tra tipologie."],
    calendar: ["Simulatore calendario", "Seleziona il periodo e inserisci i dati reali giorno per giorno."],
    simulations: ["Simulazioni generate", "Consulta lo storico per struttura e stampa report PDF."],
    matrix: ["Matrici tariffarie", "Controlla le fasce prezzo generate per ogni tipologia."]
  };
  els.viewTitle.textContent = titles[tabId][0];
  els.viewSubtitle.textContent = titles[tabId][1];
  renderStructureContext();
}

function confirmButton(button, label = "Fatto") {
  if (!button) return;
  const original = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = original;
  button.textContent = label;
  button.classList.add("is-confirmed");
  window.clearTimeout(button._confirmTimer);
  button._confirmTimer = window.setTimeout(() => {
    button.textContent = button.dataset.originalLabel;
    button.classList.remove("is-confirmed");
  }, 1100);
}

function renderAll() {
  renderStructureContext();
  renderForms();
  renderStructureDashboard();
  renderRooms();
  renderPriceAnchors();
  renderTargets();
  renderSimulationHistory();
  renderSidebarHistory();
  renderDerived();
}

function renderDerived() {
  renderStructureContext();
  renderDailyInputs();
  renderSimulation();
  renderMatrix();
  persistActiveStructure();
  renderStructureDashboard();
  save();
}

function renderForms() {
  renderStructureContext();
  renderSavedStructures();
  els.hotelName.value = state.hotelName;
  els.unitCategory.value = state.unitCategory || "multiunit";
  els.propertyType.value = state.propertyType || "hotel";
  els.basePrice.value = state.basePrice;
  els.minBasePrice.value = state.minBasePrice;
  els.maxBasePrice.value = state.maxBasePrice;
  els.calendarFrom.value = state.simulation.calendarFrom;
  els.calendarTo.value = state.simulation.calendarTo;
  els.periodType.value = state.simulation.periodType;
  els.maxIncrease.value = state.simulation.maxIncrease;
  els.currentAdrGlobal.value = state.simulation.currentAdrGlobal;
  els.monthlyAdrTarget.value = state.simulation.monthlyAdrTarget;
  els.monthlyRevenueTarget.value = state.simulation.monthlyRevenueTarget;
  els.baseRoomType.innerHTML = state.roomTypes.map((room) => (
    `<option value="${room.id}">${escapeHtml(room.name)}</option>`
  )).join("");
  els.baseRoomType.value = state.baseRoomType;
  els.todayLabel.textContent = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(new Date());
}

function renderStructureContext() {
  if (!els.currentStructureContext) return;
  const structureName = state.hotelName && state.hotelName.trim()
    ? state.hotelName.trim()
    : "Struttura non nominata";
  els.currentStructureContext.innerHTML = `
    <span>Struttura attiva</span>
    <strong>${escapeHtml(structureName)}</strong>
    <small>${formatDateRange(state.simulation.calendarFrom, state.simulation.calendarTo)}</small>
  `;
}

function renderStructureDashboard() {
  if (!els.structureDashboard) return;
  const unitFilter = els.homeUnitFilter ? els.homeUnitFilter.value : "all";
  const typeFilter = els.homeTypeFilter ? els.homeTypeFilter.value : "all";
  const structures = Object.values(state.savedStructures || {})
    .filter((structure) => unitFilter === "all" || (structure.unitCategory || "multiunit") === unitFilter)
    .filter((structure) => typeFilter === "all" || (structure.propertyType || "hotel") === typeFilter)
    .sort((a, b) => String(a.hotelName || "").localeCompare(String(b.hotelName || ""), "it"));

  if (!structures.length) {
    els.structureDashboard.innerHTML = `<div class="empty-results">Nessuna struttura salvata per questi filtri.</div>`;
    return;
  }

  els.structureDashboard.innerHTML = structures.map((structure) => {
    const anchorsSet = (structure.priceAnchors || []).filter((value) => number(value) > 0).length;
    const roomsCount = (structure.roomTypes || []).length;
    const isActive = structure.id === state.activeStructureId;
    return `
      <article class="structure-card ${isActive ? "active" : ""}">
        <div>
          <span>${labelForUnitCategory(structure.unitCategory)} · ${labelForPropertyType(structure.propertyType)}</span>
          <strong>${escapeHtml(structure.hotelName || "Struttura senza nome")}</strong>
        </div>
        <div class="structure-card-kpis">
          <span>${roomsCount} tipologie</span>
          <span>${anchorsSet}/11 fasce</span>
        </div>
        <button class="secondary" type="button" data-load-home-structure="${structure.id}">Apri struttura</button>
      </article>
    `;
  }).join("");

  els.structureDashboard.querySelectorAll("[data-load-home-structure]").forEach((button) => {
    button.addEventListener("click", () => {
      loadStructureById(button.dataset.loadHomeStructure);
      switchTab("setup");
    });
  });
}

function renderRooms() {
  els.roomTypes.innerHTML = "";
  const template = document.getElementById("roomRowTemplate");
  state.roomTypes.forEach((room) => {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector(".room-name").value = room.name;
    row.querySelector(".room-count").value = room.count;
    row.querySelector(".room-ratio").value = room.ratio;
    row.querySelector(".room-weight").value = `${roomWeight(room)}%`;

    row.querySelector(".room-name").addEventListener("input", (event) => updateRoom(room.id, "name", event.target.value));
    row.querySelector(".room-count").addEventListener("input", (event) => updateRoom(room.id, "count", number(event.target.value)));
    row.querySelector(".room-ratio").addEventListener("input", (event) => updateRoom(room.id, "ratio", number(event.target.value)));
    row.querySelector(".remove-room").addEventListener("click", () => removeRoom(room.id));
    els.roomTypes.appendChild(row);
  });
}

function renderPriceAnchors() {
  els.priceAnchors.innerHTML = state.priceAnchors.map((price, index) => {
    const importance = index * 10;
    return `
      <label class="anchor-field">
        <span>${importance}%</span>
        <input class="anchor-input" type="number" min="0" step="1" value="${price}" data-anchor-index="${index}">
      </label>
    `;
  }).join("");

  els.priceAnchors.querySelectorAll(".anchor-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = number(event.target.dataset.anchorIndex);
      state.priceAnchors[index] = number(event.target.value);
      renderDerived();
    });
  });
}

function renderTargets() {
  if (!els.targetRows) return;
  els.targetRows.innerHTML = `
    <div class="target-header">
      <span>Fascia</span>
      <span>Importanza</span>
      <span>Target ADR</span>
      <span>Target ricavi</span>
    </div>
    ${state.targetLevels.map((level, index) => renderTargetRow(level, index)).join("")}
  `;
  els.targetRows.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = number(event.target.dataset.targetIndex);
      const key = event.target.dataset.targetKey;
      state.targetLevels[index][key] = key === "range" ? event.target.value : number(event.target.value);
      markResultsDirty();
      renderDerived();
    });
  });
}

function renderTargetRow(level, index) {
  return `
    <div class="target-row">
      <strong>Fascia ${index}</strong>
      <input type="text" value="${escapeHtml(level.range)}" data-target-index="${index}" data-target-key="range" aria-label="Range importanza">
      <input type="number" min="0" step="1" value="${level.adr}" data-target-index="${index}" data-target-key="adr" aria-label="Target ADR">
      <input type="number" min="0" step="1" value="${level.revenue}" data-target-index="${index}" data-target-key="revenue" aria-label="Target ricavi">
    </div>
  `;
}

function renderDailyInputs() {
  if (!els.dailyInputs) return;
  els.dailyInputs.innerHTML = `
    <div class="daily-header" style="grid-template-columns: ${dailyGridTemplate()}">
      <span>Data</span>
      <span>RMS %</span>
      ${state.roomTypes.map((room) => `<span>Vendute ${escapeHtml(room.name)}</span>`).join("")}
      <span>Occ. calc.</span>
    </div>
    ${state.simulation.days.map((day, index) => `
      <div class="daily-row" style="grid-template-columns: ${dailyGridTemplate()}" data-day-row="${index}">
        <strong>${formatShortDate(day.date)}</strong>
        <input type="number" min="0" max="100" step="1" value="${day.marketImportance}" data-day-index="${index}" data-day-key="marketImportance" aria-label="Importanza RMS">
        ${state.roomTypes.map((room) => {
          const sold = soldRoomsFor(day, room.id);
          return `<input type="number" min="0" max="${room.count}" step="1" value="${sold}" data-day-index="${index}" data-day-key="soldRooms" data-room-id="${room.id}" aria-label="Camere vendute ${escapeHtml(room.name)}">`;
        }).join("")}
        <strong data-occupancy-index="${index}">${calculatedHotelOccupancy(day)}%</strong>
      </div>
    `).join("")}
  `;

  els.dailyInputs.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = number(event.target.dataset.dayIndex);
      const key = event.target.dataset.dayKey;
      if (key === "soldRooms") {
        const roomId = event.target.dataset.roomId;
        state.simulation.days[index].soldRooms = state.simulation.days[index].soldRooms || {};
        const room = state.roomTypes.find((item) => item.id === roomId);
        state.simulation.days[index].soldRooms[roomId] = clamp(number(event.target.value), 0, room ? room.count : 999);
        updateDailyOccupancyCell(index);
      } else {
        state.simulation.days[index][key] = number(event.target.value);
      }
      markResultsDirty();
      save();
    });
  });
}

function updateDailyOccupancyCell(index) {
  const output = els.dailyInputs.querySelector(`[data-occupancy-index="${index}"]`);
  if (!output || !state.simulation.days[index]) return;
  output.textContent = `${calculatedHotelOccupancy(state.simulation.days[index])}%`;
}

function renderSimulation() {
  if (!state.resultsReady || !state.generatedResult) {
    const preview = calculateAll();
    els.marketBand.textContent = preview.days.length;
    els.hotelBand.textContent = totalRooms();
    els.periodOccupancy.textContent = formatPercent(preview.periodOccupancy);
    els.remainingRoomNights.textContent = formatNumber(preview.remainingRoomNights);
    els.rmsAverage.textContent = formatPercent(resultMarketImportanceAverage(preview));
    els.finalIndex.textContent = "-";
    els.sideIndex.textContent = "-";
    els.sideBasePrice.textContent = euro(preview.averageRmsPrice);
    els.estimatedRevenue.textContent = "-";
    els.recommendations.innerHTML = `<div class="empty-results">Compila i dati giornalieri, poi premi <strong>Applica e genera prezzi</strong>.</div>`;
    return;
  }
  const result = state.generatedResult;
  els.marketBand.textContent = result.days.length;
  els.hotelBand.textContent = totalRooms();
  els.periodOccupancy.textContent = formatPercent(result.periodOccupancy);
  els.remainingRoomNights.textContent = formatNumber(result.remainingRoomNights);
  els.rmsAverage.textContent = formatPercent(resultMarketImportanceAverage(result));
  els.finalIndex.textContent = formatPercent(result.generalIndex);
  els.sideIndex.textContent = formatPercent(result.generalIndex);
  els.sideBasePrice.textContent = euro(result.averageRmsPrice);
  els.estimatedRevenue.textContent = euro(result.estimatedRevenue);
  els.recommendations.innerHTML = renderResultsMatrix(result);
}

function renderRecommendation(room) {
  const pressureClass = room.roomPressure >= 85 ? "hot" : room.roomPressure <= 45 ? "calm" : "";
  return `
    <article class="rec-card">
      <div class="rec-meta">
        <strong>${escapeHtml(room.name)}</strong>
        <span>${room.count} camere · occ. ${room.occupancy}% · proporzione ${room.ratio.toFixed(2)}</span>
      </div>
      <div class="rec-meta">
        <span>Prezzo RMS</span>
        <strong>${euro(room.rmsPrice)}</strong>
      </div>
      <div class="rec-meta">
        <span>Prezzo suggerito</span>
        <strong>${euro(room.finalPrice)}</strong>
      </div>
      <div class="rec-meta">
        <span>Fascia</span>
        <span class="badge ${pressureClass}">${room.finalBand}/10</span>
      </div>
      <div class="reason">${room.reason}</div>
    </article>
  `;
}

function renderDayRecommendation(day) {
  return `
    <section class="day-card">
      <div class="day-card-head">
        <div>
          <strong>${formatLongDate(day.date)}</strong>
          <span>RMS ${day.marketImportance}% - occ. calcolata ${day.hotelOccupancy}% - ADR attuale prenotazioni ${euro(state.simulation.currentAdrGlobal)}</span>
        </div>
        <div class="day-index">
          <span>Importanza applicata</span>
          <strong>${Math.round(day.averageIndex)}%</strong>
        </div>
      </div>
      <div class="day-room-table">
        <div class="day-room-header">
          <span>Camera</span>
          <span>Vendute</span>
          <span>RMS</span>
          <span>ADR target mese</span>
          <span>Rev. target mese</span>
          <span>Forza struttura</span>
          <span>Applicata</span>
          <span>Tariffa</span>
          <span>Note</span>
        </div>
        ${day.rooms.map((room) => `
          <div class="day-room-row">
            <strong>${escapeHtml(room.name)}</strong>
            <span>${room.soldRooms}/${room.count}</span>
            <span>${euro(room.rmsPrice)}</span>
            <span>${euro(room.targetAdr)}</span>
            <span>${euro(room.targetRevenue)}</span>
            <span>${Math.round(room.structureWeight * 100)}%</span>
            <span>${Math.round(room.finalIndex)}%</span>
            <strong>${euro(room.finalPrice)}</strong>
            <span>${room.reason}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderResultsMatrix(result, roomTypes = state.roomTypes) {
  const days = result.days;
  const roomRows = roomTypes.map((room) => {
    const dayCells = days.map((day) => {
      const pricedRoom = day.rooms.find((item) => item.id === room.id);
      if (!pricedRoom) return `<td>-</td>`;
      return `
        <td>
          <strong>${euro(pricedRoom.finalPrice)}</strong>
          <span>M ${Math.round(day.marketImportance)}%</span>
          <span>P ${Math.round(pricedRoom.roomPressure)}%</span>
          <span>I ${Math.round(pricedRoom.finalIndex)}%</span>
        </td>
      `;
    }).join("");
    const roomDays = days.map((day) => day.rooms.find((item) => item.id === room.id)).filter(Boolean);
    const averageOcc = average(roomDays.map((item) => item.occupancy));
    const averageAdrTarget = average(roomDays.map((item) => item.targetAdr));
    const averageRevenueTarget = average(roomDays.map((item) => item.targetRevenue));
    const averageStructureWeight = average(roomDays.map((item) => item.structureWeight * 100));
    const averageFinalIndex = average(roomDays.map((item) => item.finalIndex));
    return `
      <tr>
        <th>${escapeHtml(room.name)}</th>
        <td>${euro(averageAdrTarget)}</td>
        <td>${Math.round(averageOcc)}%</td>
        <td>${euro(averageRevenueTarget)}</td>
        <td>${Math.round(averageStructureWeight)}%</td>
        <td>${Math.round(averageFinalIndex)}%</td>
        ${dayCells}
      </tr>
    `;
  }).join("");

  return `
    <div class="matrix-result-wrap">
      <table class="pricing-result-table">
        <thead>
          <tr>
            <th>Camera</th>
            <th>ADR tgt</th>
            <th>Occ.</th>
            <th>Rev tgt</th>
            <th>Forza</th>
            <th>Imp.</th>
            ${days.map((day) => `<th title="${formatLongDate(day.date)}">${formatDayNumber(day.date)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${roomRows}</tbody>
      </table>
    </div>
  `;
}

function renderMatrix() {
  els.matrixTables.innerHTML = state.roomTypes.map((room) => {
    const rows = state.priceAnchors.map((anchorPrice, index) => {
      const importance = index * 10;
      const price = applyRoomLimits(anchorPrice * room.ratio, room.ratio);
      return `<tr><td>Fascia ${index}</td><td>${importance}%</td><td>${euro(price)}</td></tr>`;
    }).join("");
    return `
      <div class="matrix-table">
        <h3>${escapeHtml(room.name)}</h3>
        <table>
          <thead><tr><th>Fascia</th><th>Indice domanda</th><th>Prezzo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");
}

function renderSimulationHistory() {
  if (!els.simulationHistory || !els.simulationReport) return;
  const simulations = simulationsForActiveStructure();
  if (!simulations.length) {
    els.simulationHistory.innerHTML = `<div class="empty-results">Nessuna simulazione salvata per questa struttura.</div>`;
    els.simulationReport.innerHTML = `<div class="empty-results">Genera una simulazione per creare il primo report.</div>`;
    return;
  }
  if (!state.selectedSimulationId || !simulations.some((item) => item.id === state.selectedSimulationId)) {
    state.selectedSimulationId = simulations[0].id;
  }
  els.simulationHistory.innerHTML = simulations.map((simulation) => `
    <article class="history-row ${simulation.id === state.selectedSimulationId ? "active" : ""}">
      <div>
        <strong>${escapeHtml(simulation.structureName)}</strong>
        <span>${formatDateTime(simulation.createdAt)} - ${formatDateRange(simulation.calendarFrom, simulation.calendarTo)}</span>
      </div>
      <div class="history-actions">
        <button class="secondary" type="button" data-open-simulation="${simulation.id}">Apri</button>
        <button class="secondary danger-action" type="button" data-delete-simulation="${simulation.id}">Cancella</button>
      </div>
    </article>
  `).join("");
  els.simulationHistory.querySelectorAll("[data-open-simulation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSimulationId = button.dataset.openSimulation;
      renderSimulationHistory();
      save();
    });
  });
  els.simulationHistory.querySelectorAll("[data-delete-simulation]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteSimulation(button.dataset.deleteSimulation);
    });
  });
  renderSimulationReport();
}

function renderSidebarHistory() {
  if (!els.sidebarSimulationList) return;
  const simulations = simulationsForActiveStructure().slice(0, 6);
  if (!simulations.length) {
    els.sidebarSimulationList.innerHTML = `<small>Nessuna simulazione salvata.</small>`;
    return;
  }
  els.sidebarSimulationList.innerHTML = simulations.map((simulation) => `
    <button type="button" data-sidebar-simulation="${simulation.id}">
      <strong>${formatDateRange(simulation.calendarFrom, simulation.calendarTo)}</strong>
      <span>${formatDateTime(simulation.createdAt)}</span>
    </button>
  `).join("");
  els.sidebarSimulationList.querySelectorAll("[data-sidebar-simulation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSimulationId = button.dataset.sidebarSimulation;
      switchTab("simulations");
      renderSimulationHistory();
      save();
    });
  });
}

function renderSimulationReport() {
  const simulation = state.generatedSimulations.find((item) => item.id === state.selectedSimulationId);
  if (!simulation) return;
  els.simulationReport.innerHTML = `
    <div class="report-header">
      <div>
        <h3>Report simulazione</h3>
        <p>${escapeHtml(simulation.structureName)} - generata ${formatDateTime(simulation.createdAt)}</p>
      </div>
      <div>
        <strong>${formatDateRange(simulation.calendarFrom, simulation.calendarTo)}</strong>
        <span>${simulation.periodLabel}</span>
      </div>
    </div>
    <div class="report-kpis">
      <div><span>ADR attuale prenotazioni</span><strong>${euro(simulation.currentAdrGlobal)}</strong></div>
      <div><span>ADR target mensile</span><strong>${euro(simulation.monthlyAdrTarget || 0)}</strong></div>
      <div><span>Revenue target mensile</span><strong>${euro(simulation.monthlyRevenueTarget || 0)}</strong></div>
      <div><span>Revenue stimato</span><strong>${euro(simulation.result.estimatedRevenue)}</strong></div>
      <div><span>Occ. stimata periodo</span><strong>${formatPercent(resultPeriodOccupancy(simulation.result, simulation.roomTypes))}</strong></div>
      <div><span>RN ancora vendibili</span><strong>${formatNumber(resultRemainingRoomNights(simulation.result, simulation.roomTypes))}</strong></div>
      <div><span>Media RMS inserita</span><strong>${formatPercent(resultMarketImportanceAverage(simulation.result))}</strong></div>
      <div><span>Indice finale medio</span><strong>${formatPercent(simulation.result.generalIndex)}</strong></div>
      <div><span>Camere</span><strong>${simulation.totalRooms}</strong></div>
    </div>
    ${renderResultsMatrix(simulation.result, simulation.roomTypes)}
  `;
}

function calculateAll() {
  const days = state.simulation.days.map((day) => {
    const normalizedDay = { ...day, hotelOccupancy: calculatedHotelOccupancy(day) };
    const rooms = state.roomTypes.map((room) => calculateRoom(room, normalizedDay));
    const estimatedRevenue = rooms.reduce((sum, room) => {
      const occupiedRooms = soldRoomsFor(normalizedDay, room.id);
      return sum + occupiedRooms * room.finalPrice;
    }, 0);
    const averageIndex = rooms.reduce((sum, room) => sum + room.finalIndex * room.count, 0) / Math.max(1, totalRooms());
    const averageRmsPrice = rooms.reduce((sum, room) => sum + room.rmsPrice * room.count, 0) / Math.max(1, totalRooms());
    return { ...normalizedDay, rooms, estimatedRevenue, averageIndex, averageRmsPrice };
  });
  const estimatedRevenue = days.reduce((sum, day) => sum + day.estimatedRevenue, 0);
  const roomNightStats = periodRoomNightStats(days);
  const generalIndex = days.length
    ? days.reduce((sum, day) => sum + day.averageIndex, 0) / days.length
    : 0;
  const marketImportanceAverage = days.length
    ? days.reduce((sum, day) => sum + number(day.marketImportance), 0) / days.length
    : 0;
  const averageRmsPrice = days.length
    ? days.reduce((sum, day) => sum + day.averageRmsPrice, 0) / days.length
    : 0;
  return {
    days,
    estimatedRevenue,
    generalIndex,
    marketImportanceAverage,
    averageRmsPrice,
    periodOccupancy: roomNightStats.occupancy,
    totalRoomNights: roomNightStats.total,
    soldRoomNights: roomNightStats.sold,
    remainingRoomNights: roomNightStats.remaining
  };
}

function resultMarketImportanceAverage(result) {
  if (Number.isFinite(result?.marketImportanceAverage)) return result.marketImportanceAverage;
  if (!Array.isArray(result?.days) || !result.days.length) return 0;
  return average(result.days.map((day) => number(day.marketImportance)));
}

function resultPeriodOccupancy(result, roomTypes = state.roomTypes) {
  if (Number.isFinite(result?.periodOccupancy)) return result.periodOccupancy;
  return periodRoomNightStats(result?.days || [], roomTypes).occupancy;
}

function resultRemainingRoomNights(result, roomTypes = state.roomTypes) {
  if (Number.isFinite(result?.remainingRoomNights)) return result.remainingRoomNights;
  return periodRoomNightStats(result?.days || [], roomTypes).remaining;
}

function periodRoomNightStats(days = state.simulation.days, roomTypes = state.roomTypes) {
  const total = roomTypes.reduce((sum, room) => sum + number(room.count), 0) * days.length;
  const sold = days.reduce((daySum, day) => {
    return daySum + roomTypes.reduce((roomSum, room) => {
      return roomSum + clamp(soldRoomsFor(day, room.id), 0, room.count);
    }, 0);
  }, 0);
  return {
    total,
    sold,
    remaining: Math.max(0, total - sold),
    occupancy: total ? (sold / total) * 100 : 0
  };
}

function calculateRoom(room, day) {
  const market = day.marketImportance;
  const hotel = day.hotelOccupancy;
  const roomOccupancy = room.count > 0 ? clamp((soldRoomsFor(day, room.id) / room.count) * 100, 0, 100) : 0;
  const roomPressure = clamp((roomOccupancy * 0.55) + (hotel * 0.45), 0, 100);
  const structureWeight = dynamicStructureWeight(roomPressure);
  const marketWeight = 1 - structureWeight;
  const finalIndex = clamp((market * marketWeight) + (roomPressure * structureWeight), 0, 100);
  const finalBand = toLevel(finalIndex);
  const rmsPrice = priceForImportance(room, market);
  const unconstrained = priceForImportance(room, finalIndex) * periodModifiers[state.simulation.periodType].factor;
  const targetPrice = targetAdrForRoom(room, finalIndex);
  const targetCalibrated = targetPrice > unconstrained
    ? (unconstrained * 0.8) + (targetPrice * 0.2)
    : unconstrained;
  const scarcityFloor = scarcityPriceFloor(rmsPrice, roomPressure);
  const pressureFloor = pressureStrategicFloor(room, market, finalIndex, roomPressure);
  const protectedPrice = Math.max(targetCalibrated, scarcityFloor, pressureFloor);
  const maxAllowedPrice = rmsPrice * (1 + state.simulation.maxIncrease / 100);
  const isCappedByIncrease = protectedPrice > maxAllowedPrice;
  const cappedByIncrease = Math.min(protectedPrice, maxAllowedPrice);
  const finalPrice = roundToFive(applyRoomLimits(cappedByIncrease, room.ratio));
  const reason = buildReason(market, roomPressure, finalPrice, rmsPrice, isCappedByIncrease);
  return {
    ...room,
    soldRooms: soldRoomsFor(day, room.id),
    occupancy: Math.round(roomOccupancy),
    roomPressure,
    structureWeight,
    finalIndex,
    finalBand,
    targetAdr: roundToFive(targetPrice),
    targetRevenue: targetRevenueForRoom(room, finalIndex),
    rmsPrice: roundToFive(rmsPrice),
    scarcityFloor: roundToFive(scarcityFloor),
    pressureFloor: roundToFive(pressureFloor),
    maxAllowedPrice: roundToFive(maxAllowedPrice),
    isCappedByIncrease,
    finalPrice,
    reason
  };
}

function scarcityPriceFloor(rmsPrice, roomPressure) {
  if (roomPressure >= 95) return rmsPrice * 1.25;
  if (roomPressure >= 90) return rmsPrice * 1.18;
  if (roomPressure >= 85) return rmsPrice * 1.1;
  if (roomPressure >= 75) return rmsPrice * 1.05;
  return 0;
}

function pressureStrategicFloor(room, market, finalIndex, roomPressure) {
  if (roomPressure < 75) return 0;
  const protectedIndex = Math.max(market, finalIndex, roomPressure);
  return priceForImportance(room, protectedIndex) * periodModifiers[state.simulation.periodType].factor;
}

function dynamicStructureWeight(roomPressure) {
  if (roomPressure >= 95) return 0.8;
  if (roomPressure >= 90) return 0.72;
  if (roomPressure >= 85) return 0.65;
  if (roomPressure >= 75) return 0.55;
  if (roomPressure >= 60) return 0.45;
  return 0.3;
}

function buildReason(market, roomPressure, finalPrice, rmsPrice, isCappedByIncrease = false) {
  if (isCappedByIncrease && roomPressure >= 75) {
    return "Pressione alta: prezzo portato al limite massimo consentito rispetto al RMS.";
  }
  if (roomPressure >= 88 && finalPrice > rmsPrice) {
    return "La camera è quasi piena: il prezzo protegge l'ultima disponibilità oltre il segnale RMS.";
  }
  if (roomPressure >= 75 && finalPrice >= rmsPrice) {
    return "Pressione alta: applicata protezione scarsita su occupazione struttura e camera.";
  }
  if (market < 45 && roomPressure < 55) {
    return "Domanda bassa: resta vicino alla base e difende volume.";
  }
  return "Prezzo bilanciato tra mercato RMS, pressione struttura e occupazione specifica.";
}

function priceForImportance(room, importance) {
  const safeImportance = clamp(importance, 0, 100);
  const lowerIndex = Math.floor(safeImportance / 10);
  const upperIndex = Math.min(10, lowerIndex + 1);
  const progress = (safeImportance - lowerIndex * 10) / 10;
  const lowerPrice = state.priceAnchors[lowerIndex] ?? state.priceAnchors[0];
  const upperPrice = state.priceAnchors[upperIndex] ?? lowerPrice;
  const interpolated = lowerPrice + (upperPrice - lowerPrice) * progress;
  return applyRoomLimits(interpolated * room.ratio, room.ratio);
}

function targetIndexForImportance(importance) {
  return clamp(Math.floor(clamp(importance, 0, 100) / 10), 0, 9);
}

function targetAdrForRoom(room, importance) {
  const level = state.targetLevels[targetIndexForImportance(importance)] || state.targetLevels[0];
  return number(level.adr) * room.ratio;
}

function targetRevenueForRoom(room, importance) {
  const level = state.targetLevels[targetIndexForImportance(importance)] || state.targetLevels[0];
  return number(level.revenue) * room.ratio;
}

function applyRoomLimits(price, ratio) {
  return clamp(price, state.minBasePrice * ratio, state.maxBasePrice * ratio);
}

function toBand(value) {
  return clamp(Math.ceil(clamp(value, 0, 100) / 10), 1, 10);
}

function toLevel(value) {
  return clamp(Math.round(clamp(value, 0, 100) / 10), 0, 10);
}

function updateRoom(id, key, value) {
  const room = state.roomTypes.find((item) => item.id === id);
  if (!room) return;
  room[key] = value;
  markResultsDirty();
  renderDerived();
}

function removeRoom(id) {
  if (state.roomTypes.length === 1) return;
  state.roomTypes = state.roomTypes.filter((room) => room.id !== id);
  if (state.baseRoomType === id) state.baseRoomType = state.roomTypes[0].id;
  saveAndRender();
}

function markResultsDirty() {
  state.resultsReady = false;
  state.generatedResult = null;
  renderSimulation();
}

function currentStructureSnapshot() {
  return {
    id: state.activeStructureId || slugify(state.hotelName),
    hotelName: state.hotelName,
    unitCategory: state.unitCategory || "multiunit",
    propertyType: state.propertyType || "hotel",
    baseRoomType: state.baseRoomType,
    basePrice: state.basePrice,
    minBasePrice: state.minBasePrice,
    maxBasePrice: state.maxBasePrice,
    priceAnchors: [...state.priceAnchors],
    targetLevels: state.targetLevels.map((level) => ({ ...level })),
    roomTypes: state.roomTypes.map((room) => ({ ...room }))
  };
}

function saveCurrentStructure() {
  if (!state.hotelName.trim()) {
    state.hotelName = "Nuova struttura";
  }
  const id = state.activeStructureId || slugify(state.hotelName);
  state.activeStructureId = id;
  state.savedStructures[id] = { ...currentStructureSnapshot(), id };
  save();
}

function persistActiveStructure() {
  if (!state.activeStructureId) {
    state.activeStructureId = slugify(state.hotelName || "struttura");
  }
  state.savedStructures = state.savedStructures || {};
  state.savedStructures[state.activeStructureId] = { ...currentStructureSnapshot(), id: state.activeStructureId };
}

function renderSavedStructures() {
  if (!state.savedStructures || !Object.keys(state.savedStructures).length) {
    saveCurrentStructure();
  }
  const options = Object.values(state.savedStructures).map((structure) => (
    `<option value="${structure.id}">${escapeHtml(structure.hotelName)}</option>`
  )).join("");
  if (els.savedStructureSelect) {
    els.savedStructureSelect.innerHTML = options;
    els.savedStructureSelect.value = state.activeStructureId;
  }
  if (els.historyStructureSelect) {
    els.historyStructureSelect.innerHTML = options;
    els.historyStructureSelect.value = state.activeStructureId;
  }
}

function loadSelectedStructure() {
  loadStructureById(els.savedStructureSelect.value);
}

function loadStructureById(id) {
  const selected = state.savedStructures[id];
  if (!selected) return;
  state.activeStructureId = selected.id;
  state.hotelName = selected.hotelName;
  state.unitCategory = selected.unitCategory || "multiunit";
  state.propertyType = selected.propertyType || "hotel";
  state.baseRoomType = selected.baseRoomType;
  state.basePrice = selected.basePrice;
  state.minBasePrice = selected.minBasePrice;
  state.maxBasePrice = selected.maxBasePrice;
  state.priceAnchors = Array.isArray(selected.priceAnchors) && selected.priceAnchors.length === 11
    ? [...selected.priceAnchors]
    : [...defaultPriceAnchors];
  state.targetLevels = Array.isArray(selected.targetLevels)
    ? selected.targetLevels.map((level) => ({ ...level }))
    : defaultTargetLevels();
  state.roomTypes = Array.isArray(selected.roomTypes) && selected.roomTypes.length
    ? selected.roomTypes.map((room) => ({ ...room }))
    : [{ id: "camera-base", name: "Camera base", count: 1, ratio: 1 }];
  syncCalendarSoldRooms();
  markResultsDirty();
  renderAll();
}

function createNewStructure() {
  const today = new Date();
  state.activeStructureId = `nuova-struttura-${Date.now()}`;
  state.hotelName = "";
  state.unitCategory = "multiunit";
  state.propertyType = "hotel";
  state.baseRoomType = "camera-base";
  state.basePrice = 0;
  state.minBasePrice = 0;
  state.maxBasePrice = 0;
  state.priceAnchors = Array(11).fill(0);
  state.targetLevels = defaultTargetLevels().map((level) => ({ range: level.range, adr: 0, revenue: 0 }));
  state.roomTypes = [
    { id: "camera-base", name: "", count: 1, ratio: 1 }
  ];
  state.simulation = {
    calendarFrom: toDateInput(today),
    calendarTo: toDateInput(addDays(today, 6)),
    days: [],
    periodType: "weekday",
    marketImportance: 60,
    hotelPressure: 90,
    currentAdrGlobal: 0,
    monthlyAdrTarget: 0,
    monthlyRevenueTarget: 0,
    maxIncrease: 40
  };
  generateCalendarDays();
  state.selectedSimulationId = "";
  markResultsDirty();
  renderAll();
}

function saveGeneratedSimulation(result) {
  if (result.savedSimulationId && state.generatedSimulations.some((simulation) => simulation.id === result.savedSimulationId)) {
    state.selectedSimulationId = result.savedSimulationId;
    return;
  }
  const existingSameResult = state.generatedSimulations.find((simulation) => simulation.result === result);
  if (existingSameResult) {
    state.selectedSimulationId = existingSameResult.id;
    return;
  }
  const simulation = {
    id: `sim-${Date.now()}`,
    structureId: state.activeStructureId,
    structureName: state.hotelName,
    createdAt: new Date().toISOString(),
    calendarFrom: state.simulation.calendarFrom,
    calendarTo: state.simulation.calendarTo,
    periodType: state.simulation.periodType,
    periodLabel: periodModifiers[state.simulation.periodType].label,
    currentAdrGlobal: state.simulation.currentAdrGlobal,
    monthlyAdrTarget: state.simulation.monthlyAdrTarget,
    monthlyRevenueTarget: state.simulation.monthlyRevenueTarget,
    totalRooms: totalRooms(),
    roomTypes: state.roomTypes.map((room) => ({ ...room })),
    priceAnchors: [...state.priceAnchors],
    targetLevels: state.targetLevels.map((level) => ({ ...level })),
    dailyInputs: state.simulation.days.map((day) => ({
      date: day.date,
      marketImportance: day.marketImportance,
      soldRooms: { ...(day.soldRooms || {}) },
      hotelOccupancy: calculatedHotelOccupancy(day)
    })),
    result
  };
  state.generatedSimulations.unshift(simulation);
  state.selectedSimulationId = simulation.id;
  state.generatedResult.savedSimulationId = simulation.id;
}

function simulationsForActiveStructure() {
  return (state.generatedSimulations || [])
    .filter((simulation) => simulation.structureId === state.activeStructureId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function deleteSimulation(id) {
  state.generatedSimulations = state.generatedSimulations.filter((simulation) => simulation.id !== id);
  if (state.selectedSimulationId === id) {
    const next = simulationsForActiveStructure()[0];
    state.selectedSimulationId = next ? next.id : "";
  }
  if (state.generatedResult && state.generatedResult.savedSimulationId === id) {
    delete state.generatedResult.savedSimulationId;
  }
  renderSimulationHistory();
  renderSidebarHistory();
  save();
}

function exportCsv() {
  const result = state.resultsReady && state.generatedResult ? state.generatedResult : calculateAll();
  const lines = [
    ["Data", "Periodo", "RMS %", "Occ Calcolata %", "ADR Attuale Prenotazioni", "ADR Target Mensile", "Revenue Target Mensile", "Camera", "Camere Totali", "Camere Vendute", "Proporzione", "Pressione Camera %", "Peso Struttura %", "Importanza Applicata %", "ADR Target Fascia Camera", "Revenue Target Fascia", "Prezzo RMS", "Soglia Scarsita", "Soglia Pressione", "Prezzo Max Ammesso", "Limitato da Max", "Prezzo Suggerito"].join(";")
  ];
  result.days.forEach((day) => {
    day.rooms.forEach((room) => {
      lines.push([
        day.date,
        periodModifiers[state.simulation.periodType].label,
        day.marketImportance,
        day.hotelOccupancy,
        state.simulation.currentAdrGlobal,
        state.simulation.monthlyAdrTarget,
        state.simulation.monthlyRevenueTarget,
        room.name,
        room.count,
        room.soldRooms,
        room.ratio.toFixed(2),
        Math.round(room.roomPressure),
        Math.round(room.structureWeight * 100),
        Math.round(room.finalIndex),
        room.targetAdr,
        room.targetRevenue,
        room.rmsPrice,
        room.scarcityFloor,
        room.pressureFloor,
        room.maxAllowedPrice,
        room.isCappedByIncrease ? "SI" : "NO",
        room.finalPrice
      ].join(";"));
    });
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `prezzi-consigliati-${state.simulation.calendarFrom}-${state.simulation.calendarTo}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function totalRooms() {
  return state.roomTypes.reduce((sum, room) => sum + number(room.count), 0);
}

function selectedDayCount() {
  const from = parseDateInput(state.simulation.calendarFrom);
  const to = parseDateInput(state.simulation.calendarTo);
  if (!from || !to) return Math.max(1, state.simulation.days.length || 1);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function roomWeight(room) {
  const total = totalRooms();
  if (!total) return 0;
  return Math.round((number(room.count) / total) * 100);
}

function generateCalendarDays() {
  const from = parseDateInput(state.simulation.calendarFrom);
  const to = parseDateInput(state.simulation.calendarTo);
  if (!from || !to) return;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const existing = new Map(state.simulation.days.map((day) => [day.date, day]));
  const days = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const date = toDateInput(cursor);
    days.push(existing.get(date) || {
      date,
      marketImportance: 60,
      soldRooms: defaultSoldRooms(),
    });
  }
  state.simulation.calendarFrom = toDateInput(start);
  state.simulation.calendarTo = toDateInput(end);
  state.simulation.days = days;
}

function weightedRoomOccupancy() {
  const rooms = totalRooms();
  if (!rooms) return 0;
  return 0;
}

function syncCalendarSoldRooms() {
  state.simulation.days = state.simulation.days.map((day) => {
    const soldRooms = {};
    state.roomTypes.forEach((room) => {
      const existing = day.soldRooms && Object.prototype.hasOwnProperty.call(day.soldRooms, room.id)
        ? day.soldRooms[room.id]
        : 0;
      soldRooms[room.id] = clamp(number(existing), 0, room.count);
    });
    return { ...day, soldRooms };
  });
}

function defaultSoldRooms() {
  return Object.fromEntries(state.roomTypes.map((room) => [
    room.id,
    0
  ]));
}

function soldRoomsFor(day, roomId) {
  if (!day.soldRooms) {
    const room = state.roomTypes.find((item) => item.id === roomId);
    return room ? Math.round(room.count * clamp(day.hotelOccupancy || 0, 0, 100) / 100) : 0;
  }
  return number(day.soldRooms[roomId]);
}

function calculatedHotelOccupancy(day) {
  const rooms = totalRooms();
  if (!rooms) return 0;
  const sold = state.roomTypes.reduce((sum, room) => sum + clamp(soldRoomsFor(day, room.id), 0, room.count), 0);
  return Math.round((sold / rooms) * 100);
}

function dailyGridTemplate() {
  const roomColumns = state.roomTypes.map(() => "minmax(140px, 1fr)").join(" ");
  return `minmax(90px, 0.8fr) minmax(130px, 0.9fr) ${roomColumns} minmax(100px, 0.8fr)`;
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
  const date = parseDateInput(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}

function formatLongDate(value) {
  const date = parseDateInput(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function formatDateRange(from, to) {
  return `${formatShortDate(from)} - ${formatShortDate(to)}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatDayNumber(value) {
  const date = parseDateInput(value);
  if (!date) return value;
  return String(date.getDate()).padStart(2, "0");
}

function saveAndRender() {
  renderAll();
}

function save() {
  localStorage.setItem("revenuePricingSimulator", JSON.stringify(state));
}

function restore() {
  const saved = localStorage.getItem("revenuePricingSimulator");
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    normalizeState();
  } catch {
    localStorage.removeItem("revenuePricingSimulator");
  }
}

function normalizeState() {
  if (!state.activeStructureId) {
    state.activeStructureId = slugify(state.hotelName);
  }
  if (!state.savedStructures || typeof state.savedStructures !== "object") {
    state.savedStructures = {};
  }
  state.unitCategory = state.unitCategory || "multiunit";
  state.propertyType = state.propertyType || "hotel";
  if (!Array.isArray(state.generatedSimulations)) {
    state.generatedSimulations = [];
  }
  if (typeof state.selectedSimulationId !== "string") {
    state.selectedSimulationId = "";
  }
  if (!Object.keys(state.savedStructures).length) {
    state.savedStructures[state.activeStructureId] = currentStructureSnapshot();
  }
  state.savedStructures = Object.fromEntries(
    Object.entries(state.savedStructures).map(([id, structure]) => [
      id,
      normalizeStructureSnapshot({ id, ...structure })
    ])
  );
  if (typeof state.resultsReady !== "boolean") {
    state.resultsReady = false;
  }
  if (!state.resultsReady) {
    state.generatedResult = null;
  }
  state.simulation = {
    calendarFrom: "",
    calendarTo: "",
    days: [],
    periodType: "weekday",
    marketImportance: 60,
    hotelPressure: 90,
    currentAdrGlobal: 0,
    monthlyAdrTarget: 0,
    monthlyRevenueTarget: 0,
    maxIncrease: 55,
    ...state.simulation
  };
  if (!Array.isArray(state.simulation.days)) {
    state.simulation.days = [];
  }
  if (!Array.isArray(state.priceAnchors) || state.priceAnchors.length !== 11) {
    state.priceAnchors = [...defaultPriceAnchors];
  }
  if (!Array.isArray(state.targetLevels) || state.targetLevels.length !== 10) {
    state.targetLevels = defaultTargetLevels();
  } else {
    state.targetLevels = state.targetLevels.map((level, index) => ({
      range: level.range || `${index * 10}-${index === 9 ? 100 : index * 10 + 9}`,
      adr: number(level.adr),
      revenue: number(level.revenue)
    }));
  }
  if (!Array.isArray(state.roomTypes) || !state.roomTypes.length) {
    state.roomTypes = [
      { id: "basic", name: "Basic", count: 8, ratio: 1, occupancy: 90 }
    ];
  }
}

function normalizeStructureSnapshot(structure) {
  return {
    id: structure.id || slugify(structure.hotelName || "struttura"),
    hotelName: structure.hotelName || "Struttura senza nome",
    unitCategory: structure.unitCategory || "multiunit",
    propertyType: structure.propertyType || "hotel",
    baseRoomType: structure.baseRoomType || "camera-base",
    basePrice: number(structure.basePrice),
    minBasePrice: number(structure.minBasePrice),
    maxBasePrice: number(structure.maxBasePrice),
    priceAnchors: Array.isArray(structure.priceAnchors) && structure.priceAnchors.length === 11
      ? structure.priceAnchors.map(number)
      : [...defaultPriceAnchors],
    targetLevels: Array.isArray(structure.targetLevels) && structure.targetLevels.length === 10
      ? structure.targetLevels.map((level, index) => ({
        range: level.range || `${index * 10}-${index === 9 ? 100 : index * 10 + 9}`,
        adr: number(level.adr),
        revenue: number(level.revenue)
      }))
      : defaultTargetLevels(),
    roomTypes: Array.isArray(structure.roomTypes) && structure.roomTypes.length
      ? structure.roomTypes.map((room, index) => ({
        id: room.id || `room-${index + 1}`,
        name: room.name || `Camera ${index + 1}`,
        count: number(room.count) || 1,
        ratio: number(room.ratio) || 1
      }))
      : [{ id: "camera-base", name: "Camera base", count: 1, ratio: 1 }]
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function formatPercent(value) {
  const rounded = Math.round(number(value) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(number(value));
}

function labelForUnitCategory(value) {
  return value === "monounit" ? "Monounit" : "Multiunit";
}

function labelForPropertyType(value) {
  const labels = {
    hotel: "Hotel",
    bb: "B&B",
    masseria: "Masseria",
    residence: "Residence",
    villa: "Villa",
    casa: "Casa",
    appartamento: "Appartamento",
    altro: "Altro"
  };
  return labels[value] || labels.hotel;
}

function slugify(value) {
  return String(value || "struttura")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `struttura-${Date.now()}`;
}

function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

function euro(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
