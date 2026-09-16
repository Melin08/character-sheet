"use strict";

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";

let myCharacterSpells = [];
let myCharacterTraits = [];
let myCharacterWeapons = [
  { name: "", atk: "", dmg: "", notes: "" },
  { name: "", atk: "", dmg: "", notes: "" }
];
let diceRollHistory = [];

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

let allSpellsCache = [];
let allTraitsCache = [];
let allClassesCache = [];
let allRacesCache = [];

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showStatus(text) {
  const statusElem = document.getElementById("saveStatus");
  if (!statusElem) return;
  statusElem.textContent = text;
  setTimeout(() => { statusElem.textContent = ""; }, 2500);
}

function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

function getProfBonus(level) {
  return Math.ceil(1 + level / 4);
}

function autoResizeStatInput(input) {
  if (!input) return;
  if (input.classList.contains("concentration-input")) return;
  const content = input.value || input.placeholder || "";
  input.style.width = Math.max(3, content.length + 1.5) + "ch";
}

function syncAllStatInputs() {
  document.querySelectorAll(".spell-stat-input").forEach(autoResizeStatInput);
}

function recalculateAll() {
  const levelInput = document.getElementById("charLevel");
  const level = parseInt(levelInput?.value, 10) || 1;
  const prof = getProfBonus(level);

  const profBonusDisplay = document.getElementById("profBonusDisplay");
  if (profBonusDisplay) profBonusDisplay.textContent = prof >= 0 ? `+${prof}` : `${prof}`;

  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  const mods = {};

  stats.forEach((stat) => {
    const scoreVal = parseInt(document.getElementById(`attr_${stat}`)?.value, 10) || 10;
    const mod = getModifier(scoreVal);
    mods[stat] = mod;

    const modElem = document.getElementById(`mod_${stat}`);
    if (modElem) modElem.textContent = mod;

    const isSaveChecked = document.getElementById(`save_${stat}`)?.checked;
    const saveValElem = document.getElementById(`save_val_${stat}`);
    if (saveValElem) saveValElem.textContent = isSaveChecked ? mod + prof : mod;
  });

  document.querySelectorAll(".skill-row").forEach((row) => {
    const stat = row.dataset.stat;
    const statMod = mods[stat] ?? 0;
    const isProf = row.querySelector(".prof-cb")?.checked;
    const isExp = row.querySelector(".exp-cb")?.checked;

    let total = statMod;
    if (isProf) total += prof;
    if (isExp) total += prof;

    const valElem = row.querySelector(".skill-val");
    if (valElem) valElem.textContent = total;
  });
}

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

  while (myCharacterWeapons.length < 2) {
    myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
  }

  container.innerHTML = myCharacterWeapons
    .map(
      (wpn, idx) => `
      <div class="attack-entry" data-index="${idx}">
        <input type="text" class="inline-input wpn-field" data-prop="name" value="${escapeHtml(wpn.name || "")}" placeholder="Weapon" />
        <input type="text" class="inline-input wpn-field" data-prop="atk" value="${escapeHtml(wpn.atk || "")}" placeholder="+5" />
        <input type="text" class="inline-input wpn-field" data-prop="dmg" value="${escapeHtml(wpn.dmg || "")}" placeholder="1d8" />
        <input type="text" class="inline-input wpn-field" data-prop="notes" value="${escapeHtml(wpn.notes || "")}" placeholder="Notes" />
        <button type="button" class="weapon-delete-btn" data-index="${idx}" title="Delete weapon">&times;</button>
      </div>
    `
    )
    .join("");
}

document.getElementById("addWeaponBtn")?.addEventListener("click", () => {
  myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
  saveSheet();
  renderWeapons();
});

document.getElementById("weaponsContainer")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("wpn-field")) {
    const entry = e.target.closest(".attack-entry");
    const index = parseInt(entry.dataset.index, 10);
    const prop = e.target.dataset.prop;
    myCharacterWeapons[index][prop] = e.target.value;
    saveSheet();
  }
});

document.getElementById("weaponsContainer")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("weapon-delete-btn")) {
    const index = parseInt(e.target.dataset.index, 10);
    myCharacterWeapons.splice(index, 1);
    while (myCharacterWeapons.length < 2) {
      myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    }
    saveSheet();
    renderWeapons();
  }
});

function getRoster() {
  try { return JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)) || {}; } 
  catch (e) { return {}; }
}

function saveRoster(roster) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
}

function getCurrentSheetData() {
  const fields = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") fields[field.id] = field.checked;
    else fields[field.id] = field.value;
  });
  return fields;
}

function saveSheet() {
  const roster = getRoster();
  const fields = getCurrentSheetData();
  const name = fields.charName?.trim() || "Unnamed Character";
  const charClass = fields.charClass?.trim() || "";
  const level = fields.charLevel || 1;

  roster[activeCharId] = {
    id: activeCharId,
    name: name,
    summary: charClass ? `${charClass} (Lvl ${level})` : `Level ${level}`,
    updatedAt: Date.now(),
    fields: fields,
    spells: myCharacterSpells,
    traits: myCharacterTraits,
    weapons: myCharacterWeapons
  };

  saveRoster(roster);
  localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  showStatus("Saved!");
}

function applyCharacterData(charData) {
  if (!charData) return;
  const fields = charData.fields || {};
  Object.keys(fields).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") el.checked = fields[id];
      else el.value = fields[id];
    }
  });

  myCharacterSpells = charData.spells || [];
  myCharacterTraits = charData.traits || [];
  myCharacterWeapons = charData.weapons && charData.weapons.length >= 2 ? charData.weapons : [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "", notes: "" }
  ];

  renderWeapons();
  renderMySpells();
  renderMyTraits();
  recalculateAll();
  syncAllStatInputs();
}

function loadSheet() {
  const roster = getRoster();
  if (roster[activeCharId]) {
    applyCharacterData(roster[activeCharId]);
  } else {
    const keys = Object.keys(roster);
    if (keys.length > 0) {
      activeCharId = keys[0];
      localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
      applyCharacterData(roster[activeCharId]);
    } else {
      recalculateAll();
      renderWeapons();
      renderMySpells();
      renderMyTraits();
      syncAllStatInputs();
    }
  }
}

function resetSheet() {
  activeCharId = "char_" + Date.now();
  localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);

  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") field.checked = false;
    else if (field.id === "charLevel") field.value = 1;
    else if (field.id === "ac" || field.id === "curHp" || field.id === "maxHp") field.value = 10;
    else if (field.classList.contains("attr-input")) field.value = 10;
    else if (field.id === "charSpeed") field.value = 30;
    else if (field.classList.contains("dual-input") || field.classList.contains("coin-input") || field.classList.contains("slot-input")) field.value = 0;
    else field.value = "";
  });

  myCharacterSpells = [];
  myCharacterTraits = [];
  myCharacterWeapons = [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "", notes: "" }
  ];
  diceRollHistory = [];
  
  renderDiceHistory();
  recalculateAll();
  renderWeapons();
  renderMySpells();
  renderMyTraits();
  syncAllStatInputs();
  saveSheet();
  showStatus("New Character Created!");
}

function renderCharList() {
  const container = document.getElementById("charList");
  if (!container) return;
  const roster = getRoster();
  const keys = Object.keys(roster);

  if (keys.length === 0) {
    container.innerHTML = `<p class="loading-text">No saved characters found.</p>`;
    return;
  }

  container.innerHTML = keys.map((id) => {
    const char = roster[id];
    const isActive = id === activeCharId;
    return `
      <div class="char-item-row" data-id="${id}">
        <div class="char-item-info">
          <span class="char-item-name">${escapeHtml(char.name || "Unnamed Character")}</span>
          <span class="char-item-sub">${escapeHtml(char.summary || "")}</span>
        </div>
        <div class="char-actions">
          <button type="button" class="char-select-btn ${isActive ? "active" : ""}">${isActive ? "Active" : "Select"}</button>
          <button type="button" class="char-delete-btn" title="Delete character">&times;</button>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("loadBtn")?.addEventListener("click", () => {
  renderCharList();
  document.getElementById("loadModal")?.classList.add("open");
});

document.getElementById("closeLoadModal")?.addEventListener("click", () => {
  document.getElementById("loadModal")?.classList.remove("open");
});

document.getElementById("charList")?.addEventListener("click", (e) => {
  const row = e.target.closest(".char-item-row");
  if (!row) return;
  const targetId = row.dataset.id;
  const roster = getRoster();

  if (e.target.classList.contains("char-delete-btn")) {
    e.stopPropagation();
    if (confirm(`Delete character "${roster[targetId]?.name || "Unnamed"}"?`)) {
      delete roster[targetId];
      saveRoster(roster);
      if (activeCharId === targetId) {
        const remaining = Object.keys(roster);
        if (remaining.length > 0) {
          activeCharId = remaining[0];
          localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
          loadSheet();
        } else resetSheet();
      }
      renderCharList();
    }
    return;
  }

  activeCharId = targetId;
  localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  applyCharacterData(roster[activeCharId]);
  document.getElementById("loadModal")?.classList.remove("open");
  showStatus("Character Loaded!");
});

document.getElementById("helpLinkBtn")?.addEventListener("click", () => document.getElementById("helpModal")?.classList.add("open"));
document.getElementById("closeHelpModal")?.addEventListener("click", () => document.getElementById("helpModal")?.classList.remove("open"));

function switchMainTab(targetId) {
  document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
  const targetBtn = document.querySelector(`.main-tab[data-target="${targetId}"]`);
  if (targetBtn) targetBtn.classList.add("active");
  const tabEl = document.getElementById(targetId);
  if (tabEl) tabEl.classList.add("active");
}

document.querySelectorAll(".main-tab").forEach(btn => {
  btn.addEventListener("click", () => switchMainTab(btn.dataset.target));
});

document.querySelectorAll(".sub-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".subtab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.sub;
    const tabEl = document.getElementById(target);
    if (tabEl) tabEl.classList.add("active");
  });
});

document.querySelectorAll(".footer-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchMainTab(btn.dataset.tab);
    const targetId = btn.dataset.scroll === "attr" ? ".attributes-group" : 
                     btn.dataset.scroll === "skills" ? ".skills-group" : 
                     btn.dataset.scroll === "spells" ? "#spellsList" : "#tab-journal";
    const el = document.querySelector(targetId);
    if(el) el.scrollIntoView({ behavior: "smooth" });
  });
});

function addDiceHistory(desc, total) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  diceRollHistory.unshift({ desc, total, time });
  if (diceRollHistory.length > 25) diceRollHistory.pop();
  renderDiceHistory();
}

function renderDiceHistory() {
  const container = document.getElementById("diceHistoryList");
  if (!container) return;
  if (diceRollHistory.length === 0) {
    container.innerHTML = `<span class="dice-history-empty">No rolls logged yet.</span>`;
    return;
  }
  container.innerHTML = diceRollHistory.map(item => `
    <div class="dice-history-item">
      <span class="dice-history-desc">${escapeHtml(item.desc)} <small style="color:#64748b;">(${item.time})</small></span>
      <span class="dice-history-val">${escapeHtml(String(item.total))}</span>
    </div>
  `).join("");
}

document.querySelectorAll(".dice-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const sides = parseInt(btn.dataset.sides, 10);
    const roll = Math.floor(Math.random() * sides) + 1;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = roll;
    addDiceHistory(`1d${sides}`, roll);
  });
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0, label = "";
    if (e.target.dataset.type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (e.target.dataset.type === "skill") {
      const id = e.target.dataset.id;
      bonus = parseInt(document.getElementById(`val_${id}`)?.textContent, 10) || 0;
      label = document.querySelector(`#row_${id} .skill-label`)?.textContent || "Skill";
    }
    const total = roll + bonus;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = total;
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    addDiceHistory(`${label} (${roll} ${sign})`, total);
  }
});

async function fetchAPI(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API fail");
    return await res.json();
  } catch (e) {
    return null;
  }
}

const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const raceInput = document.getElementById("charRace");
const raceDropdown = document.getElementById("raceDropdown");

function renderDropdown(dropdownEl, items, filter = "") {
  if (!dropdownEl) return;
  const q = filter.toLowerCase().trim();
  const filtered = items.filter(i => i.name.toLowerCase().includes(q));
  dropdownEl.innerHTML = filtered.map(i => `<div class="dropdown-item" data-index="${i.index}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}</div>`).join("");
}

classInput?.addEventListener("focus", async () => {
  if (!classDropdown.classList.contains("open")) {
    if (allClassesCache.length === 0) {
      const data = await fetchAPI("https://www.dnd5eapi.co/api/classes");
      if (data) allClassesCache = data.results;
    }
    renderDropdown(classDropdown, allClassesCache, classInput.value);
    classDropdown.classList.add("open");
  }
});

classInput?.addEventListener("input", () => {
  renderDropdown(classDropdown, allClassesCache, classInput.value);
  classDropdown.classList.add("open");
});

raceInput?.addEventListener("focus", async () => {
  if (!raceDropdown.classList.contains("open")) {
    if (allRacesCache.length === 0) {
      const data = await fetchAPI("https://www.dnd5eapi.co/api/races");
      if (data) allRacesCache = data.results;
    }
    renderDropdown(raceDropdown, allRacesCache, raceInput.value);
    raceDropdown.classList.add("open");
  }
});

raceInput?.addEventListener("input", () => {
  renderDropdown(raceDropdown, allRacesCache, raceInput.value);
  raceDropdown.classList.add("open");
});

classDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  classInput.value = item.dataset.name;
  classDropdown.classList.remove("open");
  saveSheet();
});

raceDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  raceInput.value = item.dataset.name;
  raceDropdown.classList.remove("open");
  saveSheet();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("open"));
  }
  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
  }
});

function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function renderMyTraits() {
  const container = document.getElementById("traitsList");
  if (!container) return;

  if (myCharacterTraits.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.85rem; color: #64748b; font-style: italic;">No abilities added yet. Click "+ Add Ability" above to add one.</p>`;
    return;
  }

  container.innerHTML = myCharacterTraits.map((trait, idx) => `
    <div class="trait-card ${trait.isExpanded ? 'expanded' : ''}" data-index="${idx}">
      <div class="trait-card-header">
        <input type="text" class="trait-name-input custom-trait-field" data-prop="name" value="${escapeHtml(trait.name || '')}" placeholder="Ability Name" />
        <button class="trait-card-delete" data-index="${idx}" type="button" title="Remove ability">&times;</button>
      </div>
      <input type="text" class="trait-type-input custom-trait-field" data-prop="type" value="${escapeHtml(trait.type || '')}" placeholder="Type (Racial, Feat, etc.)" />
      <textarea class="trait-desc-input custom-trait-field" data-prop="desc" placeholder="Ability description and rules...">${escapeHtml(trait.desc || '')}</textarea>
      <div class="trait-card-footer">
        <button type="button" class="trait-expand-btn">${trait.isExpanded ? 'Collapse' : 'Expand'}</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("traitsList")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("trait-card-delete")) {
    e.stopPropagation();
    const idx = parseInt(e.target.dataset.index, 10);
    myCharacterTraits.splice(idx, 1);
    saveSheet();
    renderMyTraits();
    return;
  }

  const expandBtn = e.target.closest(".trait-expand-btn");
  if (expandBtn) {
    e.stopPropagation();
    const card = expandBtn.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    const isExp = card.classList.contains("expanded");
    expandBtn.textContent = isExp ? "Collapse" : "Expand";
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = isExp;
    saveSheet();
    return;
  }

  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    if (card && !card.classList.contains("expanded")) {
      card.classList.add("expanded");
      const btn = card.querySelector(".trait-expand-btn");
      if (btn) btn.textContent = "Collapse";
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = true;
      saveSheet();
    }
  }
});

document.getElementById("traitsList")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    const prop = e.target.dataset.prop;
    if (myCharacterTraits[idx]) {
      myCharacterTraits[idx][prop] = e.target.value;
      saveSheet();
    }
  }
});

function renderModalTraits(filterText = "") {
  const container = document.getElementById("traitApiList");
  if (!container) return;
  const q = filterText.toLowerCase().trim();
  const matches = allTraitsCache.filter(t => t.name.toLowerCase().includes(q));

  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching features found.</p>`;
    return;
  }

  container.innerHTML = matches.slice(0, 150).map((trait, idx) => `
    <div class="spell-option-item trait-option-item" data-idx="${allTraitsCache.indexOf(trait)}">
      <div>
        <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</span>
        <span style="font-size: 0.75rem; color: #34d399; margin-left: 0.5rem; text-transform: uppercase;">${escapeHtml(trait.type || "Feature")}</span>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `).join("");
}

document.getElementById("addTraitBtn")?.addEventListener("click", async () => {
  const modal = document.getElementById("traitModal");
  modal?.classList.add("open");
  
  if (allTraitsCache.length === 0) {
    document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Loading official features...</p>`;
    const dataFeatures = await fetchAPI("https://www.dnd5eapi.co/api/features");
    const dataTraits = await fetchAPI("https://www.dnd5eapi.co/api/traits");
    let combined = [];
    if (dataFeatures) combined = combined.concat(dataFeatures.results);
    if (dataTraits) combined = combined.concat(dataTraits.results);
    allTraitsCache = combined;
  }
  
  renderModalTraits(document.getElementById("traitSearchInput")?.value || "");
});

document.getElementById("closeTraitModal")?.addEventListener("click", () => {
  document.getElementById("traitModal")?.classList.remove("open");
});

document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  renderModalTraits(e.target.value);
});

document.getElementById("addCustomTraitBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  myCharacterTraits.push({ name: "", type: "", desc: "", isExpanded: true });
  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
  const cards = document.querySelectorAll("#traitsList .trait-card");
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    const input = lastCard.querySelector(".trait-name-input");
    if (input) input.focus();
  }
});

document.getElementById("traitApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".trait-option-item");
  if (!row) return;

  const idx = parseInt(row.dataset.idx, 10);
  const selected = allTraitsCache[idx];
  if (!selected) return;

  let finalDesc = "Description not available.";
  if (selected.url) {
    const detail = await fetchAPI("https://www.dnd5eapi.co" + selected.url);
    if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n") : detail.desc;
  }

  myCharacterTraits.push({
    name: selected.name,
    type: selected.type || (selected.url && selected.url.includes("traits") ? "Racial Trait" : "Class Feature"),
    desc: finalDesc,
    isExpanded: false
  });

  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
});

function renderModalSpells(filterText = "") {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  const query = filterText.toLowerCase().trim();
  const matches = allSpellsCache.filter((s) => s.name.toLowerCase().includes(query));

  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = matches.slice(0, 150).map((spell) => `
    <div class="spell-option-item spell-add-item" data-idx="${allSpellsCache.indexOf(spell)}">
      <div>
        <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</span>
        <span style="font-size: 0.75rem; color: #f87171; margin-left: 0.5rem;">${spell.level === "Cantrip" ? "Cantrip" : "Level " + spell.level} ${spell.school || ""}</span>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `).join("");
}

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells.map((spell, idx) => {
    let typeVal = spell.type || (spell.level !== undefined ? (spell.level === "Cantrip" || spell.level === 0 ? "Cantrip" : `Level ${spell.level} ${spell.school || ""}`.trim()) : "");
    let descVal = Array.isArray(spell.desc) ? spell.desc.join("\n\n") : (spell.desc || "");
    return `
      <div class="spell-card" draggable="true" data-index="${idx}">
        <div class="spell-card-header">
          <span class="spell-drag-handle" title="Drag to reorder">⋮⋮</span>
          <input type="text" class="spell-custom-title-input custom-spell-field" data-prop="name" value="${escapeHtml(spell.name || "")}" placeholder="Spell Name" />
          <button class="spell-card-delete" data-index="${idx}" type="button" title="Remove spell">&times;</button>
        </div>
        <div class="spell-card-meta">
          <div class="meta-field-group">
            <span class="meta-label">Type</span>
            <input type="text" class="spell-meta-input custom-spell-field" data-prop="type" value="${escapeHtml(typeVal)}" placeholder="Cantrip" />
          </div>
          <div class="meta-field-group">
            <span class="meta-label">Cast</span>
            <input type="text" class="spell-meta-input custom-spell-field" data-prop="casting_time" value="${escapeHtml(spell.casting_time || "")}" placeholder="1 Action" />
          </div>
          <div class="meta-field-group">
            <span class="meta-label">Range</span>
            <input type="text" class="spell-meta-input custom-spell-field" data-prop="range" value="${escapeHtml(spell.range || "")}" placeholder="30 ft" />
          </div>
          <div class="meta-field-group">
            <span class="meta-label">Duration</span>
            <input type="text" class="spell-meta-input custom-spell-field" data-prop="duration" value="${escapeHtml(spell.duration || "")}" placeholder="Instantaneous" />
          </div>
        </div>
        <textarea class="spell-custom-desc-textarea custom-spell-field" data-prop="desc" placeholder="Spell description and effects...">${escapeHtml(descVal)}</textarea>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".spell-custom-desc-textarea").forEach(autoExpandTextarea);
  attachSpellDragEvents();
}

function attachSpellDragEvents() {
  const cards = document.querySelectorAll(".spell-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault(); return;
      }
      draggedSpellIndex = parseInt(card.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedSpellIndex);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".spell-card").forEach(c => c.classList.remove("drag-over"));
      draggedSpellIndex = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("dragenter", () => {
      if (draggedSpellIndex !== null && parseInt(card.dataset.index, 10) !== draggedSpellIndex) {
        card.classList.add("drag-over");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (draggedSpellIndex === null) return;
      const targetIndex = parseInt(card.dataset.index, 10);
      if (draggedSpellIndex === targetIndex) return;

      const movedSpell = myCharacterSpells.splice(draggedSpellIndex, 1)[0];
      myCharacterSpells.splice(targetIndex, 0, movedSpell);
      saveSheet();
      renderMySpells();
    });

    const handle = card.querySelector(".spell-drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", () => {
        touchDraggedIndex = parseInt(card.dataset.index, 10);
        card.classList.add("dragging");
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCard = targetElement ? targetElement.closest(".spell-card") : null;

        document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
        if (targetCard && targetCard !== card) {
          targetCard.classList.add("drag-over");
          currentDropTarget = targetCard;
        } else {
          currentDropTarget = null;
        }
      });

      handle.addEventListener("touchend", () => {
        card.classList.remove("dragging");
        document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
        if (touchDraggedIndex !== null && currentDropTarget) {
          const targetIndex = parseInt(currentDropTarget.dataset.index, 10);
          if (touchDraggedIndex !== targetIndex) {
            const moved = myCharacterSpells.splice(touchDraggedIndex, 1)[0];
            myCharacterSpells.splice(targetIndex, 0, moved);
            saveSheet();
            renderMySpells();
          }
        }
        touchDraggedIndex = null;
        currentDropTarget = null;
      });
    }
  });
}

document.getElementById("addSpellBtn")?.addEventListener("click", async () => {
  const modal = document.getElementById("spellModal");
  modal?.classList.add("open");
  
  if (allSpellsCache.length === 0) {
    document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Fetching massive Open5e spell library...</p>`;
    const data = await fetchAPI("https://api.open5e.com/v1/spells/?limit=3000");
    if (data && data.results) {
      allSpellsCache = data.results;
    } else {
      document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Failed to fetch spells.</p>`;
      return;
    }
  }
  
  renderModalSpells(document.getElementById("spellSearchInput")?.value || "");
});

document.getElementById("closeSpellModal")?.addEventListener("click", () => {
  document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

document.getElementById("addCustomSpellBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  myCharacterSpells.push({ name: "", type: "", casting_time: "", range: "", duration: "", desc: "" });
  saveSheet();
  renderMySpells();
  document.getElementById("spellModal")?.classList.remove("open");

  const cards = document.querySelectorAll("#spellsList .spell-card");
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    const input = lastCard.querySelector(".spell-custom-title-input");
    if (input) input.focus();
  }
});

document.getElementById("spellApiList")?.addEventListener("click", (e) => {
  const row = e.target.closest(".spell-add-item");
  if (!row) return;

  const idx = parseInt(row.dataset.idx, 10);
  const details = allSpellsCache[idx];
  if (!details) return;

  myCharacterSpells.push({
    name: details.name,
    type: details.level === "Cantrip" ? "Cantrip" : `Level ${details.level} ${details.school || ""}`.trim(),
    casting_time: details.casting_time || "1 Action",
    range: details.range || "30 ft",
    duration: details.duration || "Instantaneous",
    desc: details.desc || ""
  });

  saveSheet();
  renderMySpells();
  document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellsList")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    const idx = parseInt(card.dataset.index, 10);
    const prop = e.target.dataset.prop;
    if (myCharacterSpells[idx]) {
      myCharacterSpells[idx][prop] = e.target.value;
      saveSheet();
    }
    if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
  }
});

document.getElementById("spellsList")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("spell-card-delete")) {
    myCharacterSpells.splice(parseInt(e.target.dataset.index, 10), 1);
    saveSheet();
    renderMySpells();
  }
});

document.getElementById("saveBtn")?.addEventListener("click", saveSheet);
document.getElementById("newBtn")?.addEventListener("click", () => { if (confirm("Create a new blank character sheet?")) resetSheet(); });

document.getElementById("deleteBtn")?.addEventListener("click", () => {
  const roster = getRoster();
  if (confirm("Permanently delete current character?")) {
    delete roster[activeCharId];
    saveRoster(roster);
    const keys = Object.keys(roster);
    if (keys.length > 0) {
      activeCharId = keys[0];
      localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
      loadSheet();
    } else {
      resetSheet();
    }
  }
});

document.getElementById("backupBtn")?.addEventListener("click", () => {
  const roster = getRoster();
  const currentChar = roster[activeCharId] || { 
    id: activeCharId, 
    name: "Character", 
    fields: getCurrentSheetData(), 
    spells: myCharacterSpells, 
    traits: myCharacterTraits,
    weapons: myCharacterWeapons 
  };
  const blob = new Blob([JSON.stringify({ character: currentChar, allRoster: roster }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `character-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Backup downloaded!");
});

document.getElementById("restoreFile")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      const roster = getRoster();
      if (parsed.allRoster) Object.assign(roster, parsed.allRoster);
      else if (parsed.character) roster[parsed.character.id || "char_1"] = parsed.character;
      saveRoster(roster);
      loadSheet();
      showStatus("Restored successfully!");
    } catch (err) {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
});

// Init
loadSheet();
renderMyTraits();
