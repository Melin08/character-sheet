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

let allClassesCache = [];
let allRacesCache = [];

const COMMON_SPELLS = [
  { name: "Fire Bolt", url: "/api/spells/fire-bolt", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard" },
  { name: "Mage Hand", url: "/api/spells/mage-hand", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Bard, Sorcerer, Warlock, Wizard" },
  { name: "Prestidigitation", url: "/api/spells/prestidigitation", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Bard, Sorcerer, Warlock, Wizard" },
  { name: "Shield", url: "/api/spells/shield", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Sorcerer, Wizard" },
  { name: "Magic Missile", url: "/api/spells/magic-missile", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard" },
  { name: "Cure Wounds", url: "/api/spells/cure-wounds", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid, Paladin, Ranger" },
  { name: "Healing Word", url: "/api/spells/healing-word", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid" },
  { name: "Misty Step", url: "/api/spells/misty-step", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard" },
  { name: "Fireball", url: "/api/spells/fireball", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard" },
  { name: "Counterspell", url: "/api/spells/counterspell", levelTag: "Level 3", schoolTag: "Abjuration", classesTag: "Sorcerer, Warlock, Wizard" }
];

const COMMON_TRAITS = [
  { name: "Action Surge", url: "/api/features/action-surge-1-use", type: "Class Feature", parentTag: "Fighter" },
  { name: "Sneak Attack", url: "/api/features/sneak-attack", type: "Class Feature", parentTag: "Rogue" },
  { name: "Rage", url: "/api/features/rage", type: "Class Feature", parentTag: "Barbarian" },
  { name: "Bardic Inspiration", url: "/api/features/bardic-inspiration-d6", type: "Class Feature", parentTag: "Bard" },
  { name: "Divine Smite", url: "/api/features/divine-smite", type: "Class Feature", parentTag: "Paladin" },
  { name: "Wild Shape", url: "/api/features/wild-shape", type: "Class Feature", parentTag: "Druid" },
  { name: "Cunning Action", url: "/api/features/cunning-action", type: "Class Feature", parentTag: "Rogue" },
  { name: "Darkvision", url: "/api/traits/darkvision", type: "Racial Trait", parentTag: "Elf, Dwarf, etc." },
  { name: "Fey Ancestry", url: "/api/traits/fey-ancestry", type: "Racial Trait", parentTag: "Elf" },
  { name: "Lucky", url: "/api/traits/lucky", type: "Racial Trait", parentTag: "Halfling" }
];

const SKILL_MAP = {
  "Skill: Acrobatics": "cb_acro_p", "Skill: Animal Handling": "cb_anim_p", "Skill: Arcana": "cb_arca_p",
  "Skill: Athletics": "cb_athl_p", "Skill: Deception": "cb_dec_p", "Skill: History": "cb_hist_p",
  "Skill: Insight": "cb_ins_p", "Skill: Intimidation": "cb_intm_p", "Skill: Investigation": "cb_inv_p",
  "Skill: Medicine": "cb_med_p", "Skill: Nature": "cb_nat_p", "Skill: Perception": "cb_perc_p",
  "Skill: Performance": "cb_perf_p", "Skill: Persuasion": "cb_pers_p", "Skill: Religion": "cb_rel_p",
  "Skill: Sleight of Hand": "cb_slt_p", "Skill: Stealth": "cb_ste_p", "Skill: Survival": "cb_surv_p"
};

const DRAGON_ANCESTRY_MAP = {
  "Black": { damage: "Acid", breath: "5 by 30 ft. line", save: "Dexterity" },
  "Blue": { damage: "Lightning", breath: "5 by 30 ft. line", save: "Dexterity" },
  "Brass": { damage: "Fire", breath: "5 by 30 ft. line", save: "Dexterity" },
  "Bronze": { damage: "Lightning", breath: "5 by 30 ft. line", save: "Dexterity" },
  "Copper": { damage: "Acid", breath: "5 by 30 ft. line", save: "Dexterity" },
  "Gold": { damage: "Fire", breath: "15 ft. cone", save: "Dexterity" },
  "Green": { damage: "Poison", breath: "15 ft. cone", save: "Constitution" },
  "Red": { damage: "Fire", breath: "15 ft. cone", save: "Dexterity" },
  "Silver": { damage: "Cold", breath: "15 ft. cone", save: "Constitution" },
  "White": { damage: "Cold", breath: "15 ft. cone", save: "Constitution" }
};

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showStatus(text) {
  const toast = document.getElementById("saveToast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => { toast.classList.remove("show"); }, 2000);
}

function getModifier(score) { return Math.floor((score - 10) / 2); }
function getProfBonus(level) { return Math.ceil(1 + level / 4); }

function autoResizeStatInput(input) {
  if (!input) return;
  if (input.classList.contains("concentration-input")) return;
  const content = input.value || input.placeholder || "";
  input.style.width = Math.max(3, content.length + 1.5) + "ch";
}

function syncAllStatInputs() {
  document.querySelectorAll(".spell-stat-input").forEach(autoResizeStatInput);
}

function addDiceHistory(desc, total) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  diceRollHistory.unshift({ desc, total, time });
  if (diceRollHistory.length > 25) {
    diceRollHistory.pop();
  }
  renderDiceHistory();
}

function renderDiceHistory() {
  const container = document.getElementById("diceHistoryList");
  if (!container) return;

  if (diceRollHistory.length === 0) {
    container.innerHTML = `<span class="dice-history-empty">No rolls logged yet.</span>`;
    return;
  }

  container.innerHTML = diceRollHistory
    .map(
      (item) => `
      <div class="dice-history-item">
        <span class="dice-history-desc">${escapeHtml(item.desc)} <small style="color:#64748b;">(${item.time})</small></span>
        <span class="dice-history-val">${escapeHtml(String(item.total))}</span>
      </div>
    `
    )
    .join("");
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
    if (modElem) modElem.textContent = mod >= 0 ? `+${mod}` : mod;

    const isSaveChecked = document.getElementById(`save_${stat}`)?.checked;
    const saveValElem = document.getElementById(`save_val_${stat}`);
    if (saveValElem) {
      let saveVal = isSaveChecked ? mod + prof : mod;
      saveValElem.textContent = saveVal >= 0 ? `+${saveVal}` : saveVal;
    }
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
    if (valElem) valElem.textContent = total >= 0 ? `+${total}` : total;
  });
}

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

  while (myCharacterWeapons.length < 2) {
    myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
  }

  container.innerHTML = myCharacterWeapons.map((wpn, idx) => `
      <div class="attack-entry" data-index="${idx}">
        <input type="text" class="inline-input wpn-field" data-prop="name" value="${escapeHtml(wpn.name || "")}" placeholder="Weapon" />
        <input type="text" class="inline-input wpn-field" data-prop="atk" value="${escapeHtml(wpn.atk || "")}" placeholder="+5" />
        <input type="text" class="inline-input wpn-field" data-prop="dmg" value="${escapeHtml(wpn.dmg || "")}" placeholder="1d8" />
        <input type="text" class="inline-input wpn-field" data-prop="notes" value="${escapeHtml(wpn.notes || "")}" placeholder="Notes" />
        <button type="button" class="weapon-delete-btn" data-index="${idx}" title="Delete weapon">&times;</button>
      </div>
  `).join("");
}

document.getElementById("addWeaponBtn")?.addEventListener("click", () => {
  myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
  saveSheet(false);
  renderWeapons();
});

document.getElementById("weaponsContainer")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("wpn-field")) {
    const entry = e.target.closest(".attack-entry");
    const index = parseInt(entry.dataset.index, 10);
    const prop = e.target.dataset.prop;
    myCharacterWeapons[index][prop] = e.target.value;
    saveSheet(true); // Quiet save while typing
  }
});

document.getElementById("weaponsContainer")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("weapon-delete-btn")) {
    const index = parseInt(e.target.dataset.index, 10);
    myCharacterWeapons.splice(index, 1);
    while (myCharacterWeapons.length < 2) {
      myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    }
    saveSheet(false);
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

function saveSheet(quiet = false) {
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
  
  if (!quiet) showStatus("Saved!");
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
    { name: "", atk: "", dmg: "", notes: "" }, { name: "", atk: "", dmg: "", notes: "" }
  ];

  renderWeapons(); renderMySpells(); renderMyTraits(); recalculateAll(); syncAllStatInputs();
}

function loadSheet() {
  const roster = getRoster();
  if (roster[activeCharId]) applyCharacterData(roster[activeCharId]);
  else {
    const keys = Object.keys(roster);
    if (keys.length > 0) {
      activeCharId = keys[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); applyCharacterData(roster[activeCharId]);
    } else {
      recalculateAll(); renderWeapons(); renderMySpells(); renderMyTraits(); syncAllStatInputs();
    }
  }
}

function resetSheet() {
  activeCharId = "char_" + Date.now(); localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") field.checked = false;
    else if (field.id === "charLevel") field.value = 1;
    else if (field.id === "ac" || field.id === "curHp" || field.id === "maxHp") field.value = 10;
    else if (field.classList.contains("attr-score-input")) field.value = 10;
    else if (field.id === "charSpeed") field.value = 30;
    else if (field.classList.contains("dual-input") || field.classList.contains("coin-input") || field.classList.contains("slot-input")) field.value = 0;
    else field.value = "";
  });
  myCharacterSpells = []; myCharacterTraits = []; myCharacterWeapons = [{ name: "", atk: "", dmg: "", notes: "" }, { name: "", atk: "", dmg: "", notes: "" }];
  diceRollHistory = [];
  
  renderDiceHistory(); recalculateAll(); renderWeapons(); renderMySpells(); renderMyTraits(); syncAllStatInputs(); saveSheet(false); showStatus("New Character Created!");
}

function renderCharList() {
  const container = document.getElementById("charList");
  if (!container) return;
  const roster = getRoster(); const keys = Object.keys(roster);
  if (keys.length === 0) { container.innerHTML = `<p class="loading-text">No saved characters found.</p>`; return; }
  container.innerHTML = keys.map((id) => {
    const char = roster[id]; const isActive = id === activeCharId;
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

// Global Document listeners
document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll(); saveSheet(false);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll(); saveSheet(true);
  }
});

document.addEventListener("focusout", (e) => {
  if (e.target.classList.contains("save-field") && e.target.type !== "checkbox") {
    saveSheet(false); // Loud save when finishing typing
  }
});

// Dropdown click handlers
document.addEventListener("click", (e) => {
  if (e.target.id === "loginNavBtn" || e.target.id === "signupNavBtn") {
    alert("Cloud accounts require running the app on a web server instead of a local file. Your local saves will continue to work perfectly!");
  }
  
  if (e.target.id === "saveBtn") saveSheet(false);
  if (e.target.id === "newBtn") { if (confirm("Create a new blank character sheet?")) resetSheet(); }
  if (e.target.id === "loadBtn") { renderCharList(); document.getElementById("loadModal")?.classList.add("open"); }
  if (e.target.id === "closeLoadModal") document.getElementById("loadModal")?.classList.remove("open");
  if (e.target.id === "deleteBtn") {
    const roster = getRoster();
    if (confirm("Permanently delete current character?")) {
      delete roster[activeCharId]; saveRoster(roster);
      const keys = Object.keys(roster);
      if (keys.length > 0) { activeCharId = keys[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); loadSheet(); } 
      else resetSheet();
    }
  }
  
  if (e.target.id === "backupBtn") {
    const roster = getRoster();
    const currentChar = roster[activeCharId] || { id: activeCharId, name: "Character", fields: getCurrentSheetData(), spells: myCharacterSpells, traits: myCharacterTraits, weapons: myCharacterWeapons };
    const blob = new Blob([JSON.stringify({ character: currentChar, allRoster: roster }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `character-backup.json`; a.click(); URL.revokeObjectURL(url); showStatus("Backup downloaded!");
  }

  // Tabbing
  if (e.target.classList.contains("main-tab")) {
    document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active"); document.getElementById(e.target.dataset.target)?.classList.add("active");
  }
  if (e.target.classList.contains("sub-tab")) {
    document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".subtab-page").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active"); document.getElementById(e.target.dataset.sub)?.classList.add("active");
  }
  if (e.target.classList.contains("footer-nav-btn")) {
    const tabTarget = e.target.dataset.tab;
    document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    document.querySelector(`.main-tab[data-target="${tabTarget}"]`)?.classList.add("active");
    document.getElementById(tabTarget)?.classList.add("active");
    const scrollTarget = e.target.dataset.scroll;
    const elId = scrollTarget === "attr" ? ".attributes-group" : scrollTarget === "skills" ? ".skills-group" : scrollTarget === "spells" ? "#spellsList" : "#tab-journal";
    document.querySelector(elId)?.scrollIntoView({ behavior: "smooth" });
  }

  // Rests
  if (e.target.id === "longRestBtn") {
      if (confirm("Take a Long Rest? This restores all HP, Hit Dice, and Spell Slots.")) {
        const maxHp = document.getElementById("maxHp"); if (document.getElementById("curHp")) document.getElementById("curHp").value = maxHp.value;
        const maxHd = document.getElementById("hitDiceMax"); if (document.getElementById("hitDiceCur")) document.getElementById("hitDiceCur").value = maxHd.value;
        for (let i = 1; i <= 9; i++) { let cur = document.getElementById(`slot${i}_cur`); let max = document.getElementById(`slot${i}_max`); if (cur && max) cur.value = max.value; }
        saveSheet(false); showStatus("Long Rest Taken!");
      }
  }
  if (e.target.id === "shortRestBtn") { 
    if (confirm("Take a Short Rest? Use your hit dice to heal!")) showStatus("Short Rest Taken!"); 
  }

  // Dice
  if (e.target.classList.contains("dice-btn")) {
     const sides = parseInt(e.target.dataset.sides, 10);
     const roll = Math.floor(Math.random() * sides) + 1;
     const out = document.getElementById("rollResult");
     if (out) out.textContent = roll;
     addDiceHistory(`1d${sides}`, roll);
  }

  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0, label = "";
    if (e.target.dataset.type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (e.target.dataset.type === "skill") {
      const id = e.target.dataset.id;
      const row = e.target.closest(".skill-row");
      bonus = parseInt(row?.querySelector(".skill-val")?.textContent, 10) || 0;
      let rawText = row?.querySelector(".skill-label")?.textContent || "Skill";
      label = rawText.replace(/(DEX|WIS|INT|STR|CHA|CON)$/i, '').trim(); 
    }
    const total = roll + bonus;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = total;
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    addDiceHistory(`${label} (${roll} ${sign})`, total);
  }

  // List Mgmt
  if (e.target.classList.contains("char-delete-btn")) {
    const row = e.target.closest(".char-item-row"); const roster = getRoster();
    if (confirm(`Delete character "${roster[row.dataset.id]?.name || "Unnamed"}"?`)) {
      delete roster[row.dataset.id]; saveRoster(roster);
      if (activeCharId === row.dataset.id) {
        const remaining = Object.keys(roster);
        if (remaining.length > 0) { activeCharId = remaining[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); loadSheet(); } else resetSheet();
      }
      renderCharList();
    }
  } else if (e.target.closest(".char-item-info") || e.target.classList.contains("char-select-btn")) {
    const row = e.target.closest(".char-item-row"); const roster = getRoster();
    activeCharId = row.dataset.id; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); applyCharacterData(roster[activeCharId]);
    document.getElementById("loadModal")?.classList.remove("open"); showStatus("Character Loaded!");
  }
});

// Auto-Expanders
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("spell-stat-input")) autoResizeStatInput(e.target);
  
  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    if(card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterSpells[idx]) {
        myCharacterSpells[idx][e.target.dataset.prop] = e.target.value; saveSheet(true);
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }
  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    if(card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterTraits[idx]) {
        myCharacterTraits[idx][e.target.dataset.prop] = e.target.value; saveSheet(true);
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }
});

document.addEventListener("focusout", (e) => {
   if (e.target.classList.contains("custom-spell-field") || e.target.classList.contains("custom-trait-field") || e.target.classList.contains("wpn-field")) {
       saveSheet(false);
   } 
});

/* =========================================================
   DYNAMIC API CACHE, SEARCH ENGINE & STEP-BY-STEP LOADOUT
   ========================================================= */

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

classDropdown?.addEventListener("click", async (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  classInput.value = item.dataset.name;
  classDropdown.classList.remove("open");
  saveSheet();

  const classIdx = item.dataset.index;
  if (classIdx) {
    document.getElementById("choiceModalTitle").textContent = `Setting up your ${item.dataset.name}...`;
    document.getElementById("choiceModalBody").innerHTML = `<div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center;">We're grabbing your class choices from the database! Hang tight...</div><p class="loading-text">Fetching loadout options...</p>`;
    document.getElementById("choiceModal").classList.add("open");

    const [equipRes1, equipRes2, classRes] = await Promise.all([
      fetchAPI(`https://www.dnd5eapi.co/api/classes/${classIdx}/starting-equipment`),
      fetchAPI(`https://www.dnd5eapi.co/api/starting-equipment/${classIdx}`),
      fetchAPI(`https://www.dnd5eapi.co/api/classes/${classIdx}`)
    ]);

    if (classRes?.proficiencies) {
      const otherProfs = classRes.proficiencies
        .filter(p => !p.index.startsWith("skill-") && !p.index.startsWith("saving-throw-"))
        .map(p => p.name)
        .join(", ");
        
      if (otherProfs) {
        const profBox = document.getElementById("otherProfs");
        if (profBox) {
          const current = profBox.value.trim();
          profBox.value = current ? current + "\n\n" + otherProfs : otherProfs;
          autoExpandTextarea(profBox);
        }
      }
    }
    if (classRes?.saving_throws) {
      classRes.saving_throws.forEach(st => {
        const cb = document.getElementById(`save_${st.index}`);
        if (cb) cb.checked = true;
      });
    }

    const finalEquip = equipRes1?.starting_equipment_options ? equipRes1 : equipRes2;

    loadoutState = {
      equipOptions: [],
      profOptions: classRes?.proficiency_choices || [],
      weaponsList: [],
      gearList: [],
      selectedSkills: [],
      subraceOptions: [],
      traitChoiceOptions: [],
      traitsToAdd: [],
      isSingleAbility: false
    };

    if (finalEquip?.starting_equipment_options) {
      finalEquip.starting_equipment_options.forEach(opt => {
        let c = opt.choose || 1;
        for(let i=0; i<c; i++) {
           let step = JSON.parse(JSON.stringify(opt));
           step.choose = 1;
           if (c > 1) step.desc = (opt.desc || "Choose an option") + ` (Choice ${i+1} of ${c})`;
           loadoutState.equipOptions.push(step);
        }
      });
    }
    
    if (finalEquip?.starting_equipment) {
      const concreteItems = [];
      finalEquip.starting_equipment.forEach(stItem => {
         concreteItems.push({ name: stItem.equipment.name, url: stItem.equipment.url, qty: stItem.quantity });
      });
      await processConcreteItems(concreteItems);
    }

    runLoadoutStep();
  }
});

raceDropdown?.addEventListener("click", async (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  raceInput.value = item.dataset.name;
  raceDropdown.classList.remove("open");
  saveSheet();

  const raceIdx = item.dataset.index;
  if (raceIdx) {
    document.getElementById("choiceModalTitle").textContent = `Setting up your ${item.dataset.name}...`;
    document.getElementById("choiceModalBody").innerHTML = `<div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center;">We're grabbing your racial traits from the database! Hang tight...</div><p class="loading-text">Fetching loadout options...</p>`;
    document.getElementById("choiceModal").classList.add("open");

    const raceRes = await fetchAPI(`https://www.dnd5eapi.co/api/races/${raceIdx}`);

    loadoutState = {
      equipOptions: [],
      profOptions: raceRes?.starting_proficiency_options ? [raceRes.starting_proficiency_options] : [],
      weaponsList: [],
      gearList: [],
      selectedSkills: [],
      subraceOptions: raceRes?.subraces && raceRes.subraces.length > 0 ? [...raceRes.subraces] : [],
      traitChoiceOptions: [],
      traitsToAdd: [],
      isSingleAbility: false
    };

    if (raceRes?.speed) {
      const speedInp = document.getElementById("charSpeed");
      if (speedInp) speedInp.value = raceRes.speed;
    }

    if (raceRes?.starting_proficiencies) {
       raceRes.starting_proficiencies.forEach(p => {
         if (p.index.startsWith("skill-")) {
           loadoutState.selectedSkills.push("Skill: " + p.name.replace("Skill: ", ""));
         }
       });
    }

    if (raceRes?.traits) {
       for (let t of raceRes.traits) {
           const tData = await fetchAPI("https://www.dnd5eapi.co" + t.url);
           if (tData) {
               let specific = tData.trait_specific || tData.feature_specific || tData.choice;
               if (specific && (specific.subtrait_options || specific.spell_options || specific.damage_type_options || specific.choice || specific.breath_weapon_options || specific.subfeature_options || specific.expertise_options || specific.from)) {
                   loadoutState.traitChoiceOptions.push(tData);
               } else {
                   loadoutState.traitsToAdd.push(tData);
               }
           }
       }
    }

    runLoadoutStep();
  }
});

const apiCache = {};

async function fetchAPI(url) {
  if (apiCache[url]) return apiCache[url];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); 
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    apiCache[url] = data;
    return data;
  } catch (e) {
    return null;
  }
}

async function searchSpells(query) {
  if (!query) return COMMON_SPELLS;
  const res = await fetchAPI(`https://www.dnd5eapi.co/api/spells?name=${encodeURIComponent(query)}`);
  if (res && res.results && res.results.length > 0) return res.results;
  return COMMON_SPELLS.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
}

async function searchTraits(query) {
  if (!query) return COMMON_TRAITS;
  const [featRes, traitRes] = await Promise.all([
     fetchAPI(`https://www.dnd5eapi.co/api/features?name=${encodeURIComponent(query)}`),
     fetchAPI(`https://www.dnd5eapi.co/api/traits?name=${encodeURIComponent(query)}`)
  ]);
  let combined = [];
  if (featRes && featRes.results) combined.push(...featRes.results);
  if (traitRes && traitRes.results) combined.push(...traitRes.results);
  if (combined.length > 0) return combined;
  return COMMON_TRAITS.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));
}

async function fetchDetailedSpells(matches) {
  const top = matches.slice(0, 15);
  return await Promise.all(top.map(async m => {
    if (m.url && !m.fetchedDetails) {
      const det = await fetchAPI("https://www.dnd5eapi.co" + m.url);
      if (det) {
        return { 
          ...m, 
          levelTag: det.level === 0 ? "Cantrip" : `Level ${det.level}`,
          schoolTag: det.school?.name,
          classesTag: det.classes?.map(c => c.name).join(", "),
          fetchedDetails: true
        };
      }
    }
    return m;
  }));
}

async function fetchDetailedTraits(matches) {
  const top = matches.slice(0, 15);
  return await Promise.all(top.map(async m => {
    if (m.url && !m.fetchedDetails) {
      const det = await fetchAPI("https://www.dnd5eapi.co" + m.url);
      if (det) {
        let parentNames = [];
        if (det.races && det.races.length > 0) parentNames.push(...det.races.map(r => r.name));
        if (det.subraces && det.subraces.length > 0) parentNames.push(...det.subraces.map(sr => sr.name));
        if (det.class && det.class.name) parentNames.push(det.class.name);
        if (det.subclass && det.subclass.name) parentNames.push(det.subclass.name);
        if (det.parent && det.parent.name) parentNames.push(det.parent.name);

        let pTag = parentNames.length > 0 ? parentNames.join(", ") : (m.url.includes("/races/") ? "Various Races" : "");

        return { 
          ...m, 
          type: m.url.includes("/features/") ? "Class Feature" : "Racial Trait",
          parentTag: pTag,
          fetchedDetails: true
        };
      }
    }
    return m;
  }));
}

let loadoutState = {
  equipOptions: [],
  profOptions: [],
  weaponsList: [],
  gearList: [],
  selectedSkills: [],
  subraceOptions: [],
  traitChoiceOptions: [],
  traitsToAdd: [],
  isSingleAbility: false
};

async function formatItemWithStats(name, url, count) {
  let qtyStr = count > 1 ? `<span style="color:#f87171">${count}x</span> ` : "";
  let statStr = "";
  if (url) {
    const data = await fetchAPI("https://www.dnd5eapi.co" + url);
    if (data) {
      let extras = [];
      if (data.equipment_category?.name === "Weapon") {
        let dmgStr = "";
        if (data.damage && data.damage.damage_dice) {
          let dmgType = data.damage.damage_type?.name ? data.damage.damage_type.name.toLowerCase() : "";
          dmgStr = `🎲 ${data.damage.damage_dice} ${dmgType}`.trim();
          extras.push(dmgStr);
        }
        if (data.range) {
           if (data.range.long) extras.push(`🎯 Range ${data.range.normal}/${data.range.long} ft.`);
           else if (data.range.normal > 5) extras.push(`🎯 Range ${data.range.normal} ft.`);
        }
      }
      if (data.armor_class) {
        extras.push(`🛡️ AC ${data.armor_class.base}${data.armor_class.dex_bonus ? ' + Dex' : ''}`);
      }
      if (data.contents && data.contents.length > 0) {
        const contentsText = data.contents.map(c => `${c.quantity}x ${c.item.name}`).join(', ');
        extras.push(`🎒 Contains: ${contentsText}`);
      }
      if (data.desc && data.desc.length > 0) {
         let dText = data.desc.join(" ").substring(0, 120);
         if (data.desc.join(" ").length > 120) dText += "...";
         extras.push(`📝 ${dText}`);
      }
      if (extras.length > 0) {
        statStr = `<span class="subtext" style="color:#94a3b8; font-weight:normal; margin-top:0.4rem; display:block;">${extras.join("<br>")}</span>`;
      }
    }
  }
  return `<strong style="font-size:1.1rem; color:#f8fafc;">${qtyStr}${escapeHtml(name)}</strong>${statStr ? '<br>' + statStr : ''}`;
}

async function getAsyncChoiceDetails(choice) {
  let details = [];
  if (!choice) return details;

  if (choice.option_type === "counted_reference" && choice.of) {
    details.push(await formatItemWithStats(choice.of.name, choice.of.url, choice.count));
  } else if (choice.option_type === "choice" && choice.choice) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose Any ${choice.choice.desc || choice.choice.from?.equipment_category?.name || "Option"}</strong><br><span class="subtext" style="color:#34d399;">Click to see options!</span>`);
  } else if (choice.option_type === "multiple" && choice.items) {
    for (let i of choice.items) {
      if (i.option_type === "counted_reference" && i.of) details.push(await formatItemWithStats(i.of.name, i.of.url, i.count));
      else if (i.option_type === "choice" && i.choice) details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose Any ${i.choice.desc || i.choice.from?.equipment_category?.name || "Option"}</strong><br><span class="subtext" style="color:#34d399;">Click to see options!</span>`);
      else if (i.of) details.push(await formatItemWithStats(i.of.name, i.of.url, i.count));
      else if (i.item) details.push(await formatItemWithStats(i.item.name, i.item.url, i.count));
    }
  } else if (choice.option_type === "equipment_category" && choice.equipment_category) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose ${choice.count > 1 ? choice.count + " " : ""}${choice.equipment_category.name}</strong><br><span class="subtext" style="color:#34d399;">Click to open category!</span>`);
  } else if (choice.equipment) {
    details.push(await formatItemWithStats(choice.equipment.name, choice.equipment.url, choice.quantity));
  } else if (choice.equipment_category) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose from ${choice.equipment_category.name}</strong><br><span class="subtext" style="color:#34d399;">Click to open category!</span>`);
  } else if (choice.item) {
    details.push(await formatItemWithStats(choice.item.name, choice.item.url, choice.count));
  } else {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">${choice.desc || "Item Option"}</strong>`);
  }
  
  if (details.length === 0) details.push("<strong>Equipment Option</strong>");
  return details;
}

async function extractConcreteItemsAndDrillDowns(choice) {
   let concreteItems = [];
   let drillDownSteps = [];

   async function parse(c) {
      let catUrl = null;
      let qty = c.count || 1;
      if (c.option_type === "choice" && c.choice?.from?.equipment_category) {
         catUrl = c.choice.from.equipment_category.url;
         qty = c.choice.choose || 1;
      } else if (c.equipment_category) {
         catUrl = c.equipment_category.url;
      } else if (c.option_type === "equipment_category" && c.equipment_category) {
         catUrl = c.equipment_category.url;
      }

      if (catUrl) {
         const catData = await fetchAPI("https://www.dnd5eapi.co" + catUrl);
         if (catData && catData.equipment) {
            drillDownSteps.push({
               desc: `Select ${qty} from ${catData.name}`,
               choose: qty,
               options: catData.equipment.map(eq => ({ option_type: "item", item: eq, count: 1 }))
            });
         }
      } else if (c.option_type === "multiple" && c.items) {
         for (let i of c.items) await parse(i);
      } else if (c.option_type === "counted_reference" && c.of) {
         concreteItems.push({ name: c.of.name, url: c.of.url, qty: c.count || 1 });
      } else if (c.equipment) {
         concreteItems.push({ name: c.equipment.name, url: c.equipment.url, qty: c.quantity || 1 });
      } else if (c.item) {
         concreteItems.push({ name: c.item.name, url: c.item.url, qty: c.count || 1 });
      } else if (c.desc) {
         concreteItems.push({ name: c.desc, qty: 1 });
      }
   }
   
   await parse(choice);
   return { concreteItems, drillDownSteps };
}

async function processConcreteItems(items) {
   let newAcBase = 0;
   let newShield = 0;

   for (let item of items) {
      let dmg = "";
      let dmgType = "";
      let category = "Gear";
      let baseAc = null;
      let isShield = false;
      let contentsStr = "";
      let descStr = "";
      let rangeStr = "";

      if (item.url) {
         const data = await fetchAPI("https://www.dnd5eapi.co" + item.url);
         if (data) {
            category = data.equipment_category?.name || category;

            if (data.damage && data.damage.damage_dice) {
               dmg = data.damage.damage_dice;
               dmgType = data.damage.damage_type?.name || "";
            }
            
            if (category === "Weapon" && data.range) {
               if (data.range.long) {
                  rangeStr = `Range ${data.range.normal}/${data.range.long} ft.`;
               } else if (data.range.normal > 5) {
                  rangeStr = `Range ${data.range.normal} ft.`;
               }
            }

            if (data.armor_class) {
               baseAc = data.armor_class.base;
               if (data.armor_category === "Shield" || data.name === "Shield") {
                  isShield = true;
                  newShield += 2;
               } else if (baseAc > newAcBase) {
                  newAcBase = baseAc;
               }
            }
            if (data.contents && data.contents.length > 0) {
               contentsStr = data.contents.map(c => `${c.quantity}x ${c.item.name}`).join(", ");
            }
            if (data.desc && data.desc.length > 0) {
               descStr = data.desc.join(" ");
            }
         }
      }

      let fullName = item.name;
      if (contentsStr) fullName += ` (Contains: ${contentsStr})`;
      
      let notes = descStr;
      if (rangeStr) {
         notes = notes ? `${rangeStr}, ${notes}` : rangeStr;
      }

      const qtyPrefix = item.qty > 1 ? `${item.qty}x ` : "";

      if (category === "Weapon") {
         loadoutState.weaponsList.push({ 
            name: `${qtyPrefix}${fullName}`, 
            dmg: dmg, 
            dmg_type: dmgType, 
            notes: notes 
         });
      } else {
         loadoutState.gearList.push(`${qtyPrefix}${fullName}`);
      }
   }

   if (newAcBase > 0 || newShield > 0) {
       const acField = document.getElementById("ac");
       if (acField) {
           let base = newAcBase > 0 ? newAcBase : parseInt(acField.value) || 10;
           acField.value = base + newShield;
       }
   }
}

function finalizeLoadout() {
  if (loadoutState.weaponsList.length > 0) {
    let updatedWeps = loadoutState.weaponsList.map(w => ({ name: w.name, dmg: w.dmg, dmg_type: w.dmg_type, notes: w.notes }));
    while (updatedWeps.length < 2) updatedWeps.push({ name: "", dmg: "", dmg_type: "", notes: "" });
    myCharacterWeapons = updatedWeps;
  }
  renderWeapons();

  const invBox = document.getElementById("inventory");
  if (invBox && loadoutState.gearList.length > 0) {
    const currentInv = invBox.value.trim();
    const newInv = loadoutState.gearList.join("\n");
    invBox.value = currentInv ? currentInv + "\n\n" + newInv : newInv;
    autoExpandTextarea(invBox);
  }

  loadoutState.selectedSkills.forEach(skillName => {
    const cbId = SKILL_MAP[skillName];
    if (cbId) {
      const cb = document.getElementById(cbId);
      if (cb) cb.checked = true;
    }
  });

  if (loadoutState.traitsToAdd && loadoutState.traitsToAdd.length > 0) {
    loadoutState.traitsToAdd.forEach(t => {
       let tDesc = Array.isArray(t.desc) ? t.desc.join("\n\n") : (t.desc || "");
       let existing = myCharacterTraits.find(ex => ex.name === t.name);
       if (!existing) {
           myCharacterTraits.push({
             name: t.name,
             type: t.type || "Trait / Feature",
             desc: tDesc,
             isExpanded: false
           });
       } else {
           existing.desc = tDesc; 
       }
    });
    renderMyTraits();
  }

  saveSheet();
  recalculateAll();

  document.getElementById("choiceModalTitle").textContent = loadoutState.isSingleAbility ? "Ability Added! 🎉" : "Loadout Complete! 🎉";
  document.getElementById("choiceModalBody").innerHTML = `
    <div class="wizard-intro" style="font-size: 1.25rem; color: #34d399; font-weight: 800; padding: 1.5rem 0;">
      Awesome! Your ${loadoutState.isSingleAbility ? 'ability variant was' : 'selections are'} successfully applied to your sheet!
    </div>
    <button class="btn red confirm-loadout-btn" id="finishLoadoutBtn" style="font-size: 1.25rem; padding: 1.2rem;">${loadoutState.isSingleAbility ? 'Done' : 'Let\'s Go!'}</button>
  `;

  document.getElementById("finishLoadoutBtn")?.addEventListener("click", () => {
    document.getElementById("choiceModal").classList.remove("open");
  });
}

async function runLoadoutStep() {
  const choiceModal = document.getElementById("choiceModal");

  // RACE WIZARD STEP 1: SUBRACES (e.g. High Elf vs Wood Elf)
  if (loadoutState.subraceOptions && loadoutState.subraceOptions.length > 0) {
    document.getElementById("choiceModalTitle").textContent = "Choose your Heritage!";
    let html = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🧬</span>
        Select your subrace or variant:
      </div>
      <div class="equip-options-grid">
    `;
    
    loadoutState.subraceOptions.forEach((sub, idx) => {
      html += `
        <div class="choice-option-wrapper">
          <button type="button" class="choice-option-btn subrace-btn" data-index="${idx}" data-url="${sub.url}">
            <strong>${escapeHtml(sub.name)}</strong>
          </button>
        </div>
      `;
    });
    html += `</div>`;

    const choiceModalBody = document.getElementById("choiceModalBody");
    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    
    document.getElementById("choiceModalBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".subrace-btn");
      if (!btn) return;
      btn.style.opacity = "0.5";
      btn.innerHTML = "<strong style='color:#34d399;'>Loading...</strong>";
      
      const subUrl = btn.dataset.url;
      const subRes = await fetchAPI("https://www.dnd5eapi.co" + subUrl);
      
      if (subRes) {
        const raceInput = document.getElementById("charRace");
        if (raceInput && !raceInput.value.includes(subRes.name)) {
            raceInput.value = subRes.name;
            saveSheet(true);
        }

        if (subRes.starting_proficiencies) {
           subRes.starting_proficiencies.forEach(p => {
             if (p.index.startsWith("skill-")) {
               loadoutState.selectedSkills.push("Skill: " + p.name.replace("Skill: ", ""));
             }
           });
        }
        if (subRes.starting_proficiency_options) {
           loadoutState.profOptions.push(subRes.starting_proficiency_options);
        }

        if (subRes.racial_traits) {
           for (let t of subRes.racial_traits) {
               const tData = await fetchAPI("https://www.dnd5eapi.co" + t.url);
               if (tData) {
                   let specific = tData.trait_specific || tData.feature_specific || tData.choice;
                   if (specific && (specific.subtrait_options || specific.spell_options || specific.damage_type_options || specific.choice || specific.breath_weapon_options || specific.subfeature_options || specific.expertise_options || specific.from)) {
                       if (!loadoutState.traitChoiceOptions) loadoutState.traitChoiceOptions = [];
                       loadoutState.traitChoiceOptions.push(tData);
                   } else {
                       loadoutState.traitsToAdd.push(tData);
                   }
               }
           }
        }
      }
      
      loadoutState.subraceOptions = []; 
      runLoadoutStep();
    });
    return;
  }

  // RACE WIZARD STEP 2: TRAIT CHOICES (e.g. Draconic Ancestry, Fighting Styles, etc.)
  if (loadoutState.traitChoiceOptions && loadoutState.traitChoiceOptions.length > 0) {
    const traitObj = loadoutState.traitChoiceOptions[0];
    document.getElementById("choiceModalTitle").textContent = `Choose Variant: ${traitObj.name}`;
    
    let choiceData = traitObj.trait_specific?.subtrait_options || traitObj.trait_specific?.spell_options || traitObj.trait_specific?.damage_type_options || traitObj.trait_specific?.choice || traitObj.trait_specific?.breath_weapon_options || traitObj.feature_specific?.subfeature_options || traitObj.feature_specific?.expertise_options || traitObj.feature_specific?.choice || (traitObj.trait_specific?.from ? traitObj.trait_specific : null) || (traitObj.feature_specific?.from ? traitObj.feature_specific : null) || traitObj.choice;
    
    let optionsArr = [];
    if (choiceData && choiceData.from && choiceData.from.options) {
         optionsArr = choiceData.from.options;
    }

    if (optionsArr.length === 0) {
        loadoutState.traitsToAdd.push(traitObj);
        loadoutState.traitChoiceOptions.shift();
        runLoadoutStep();
        return;
    }

    let html = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">✨</span>
        Select your ${escapeHtml(traitObj.name)} variant:
      </div>
      <div class="equip-options-grid">
    `;
    
    optionsArr.forEach((opt, idx) => {
      let name = opt.notes || opt.item?.name || opt.choice?.desc || opt.desc || opt.trait?.name || opt.spell?.name || opt.damage_type?.name || opt.feature?.name || "Variant " + (idx+1);
      let url = opt.item?.url || opt.trait?.url || opt.feature?.url || null; 
      html += `
        <div class="choice-option-wrapper">
          <button type="button" class="choice-option-btn trait-variant-btn" data-index="${idx}" data-name="${escapeHtml(name)}" data-url="${url || ''}">
            <strong>${escapeHtml(name)}</strong>
          </button>
        </div>
      `;
    });
    html += `</div>`;

    const choiceModalBody = document.getElementById("choiceModalBody");
    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    
    document.getElementById("choiceModalBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".trait-variant-btn");
      if (!btn) return;
      btn.style.opacity = "0.5";
      btn.innerHTML = "<strong style='color:#34d399;'>Loading...</strong>";
      
      let selectedName = btn.dataset.name;
      let selectedUrl = btn.dataset.url;
      let traitDesc = Array.isArray(traitObj.desc) ? traitObj.desc.join("\n") : (traitObj.desc || "");
      
      if (selectedUrl) {
         const subT = await fetchAPI("https://www.dnd5eapi.co" + selectedUrl);
         if (subT && subT.desc) {
             traitDesc += "\n\n" + (Array.isArray(subT.desc) ? subT.desc.join("\n") : subT.desc);
         }
      } else {
         traitDesc += `\n\nSelected Variant: ${selectedName}`;
      }

      loadoutState.traitsToAdd.push({
         name: `${traitObj.name} (${selectedName})`,
         type: traitObj.url?.includes("/features/") ? "Class Feature" : "Racial Trait",
         desc: traitDesc
      });
      
      // Specialized interceptor to modify Dragonborn's Breath Weapon
      if (traitObj.name === "Draconic Ancestry") {
          let dragonName = selectedName.replace(/dragon/i, "").trim().split(" ")[0];
          let dragon = DRAGON_ANCESTRY_MAP[dragonName] || DRAGON_ANCESTRY_MAP[selectedName];
          if (dragon) {
             let updateBW = (targetArray) => {
                 let bw = targetArray.find(t => t.name.startsWith("Breath Weapon"));
                 if (bw) {
                     bw.name = `Breath Weapon (${dragon.damage})`;
                     bw.desc = `You can use your action to exhale destructive energy. It is a ${dragon.breath} dealing ${dragon.damage} damage. When you use your breath weapon, each creature in the area of the exhalation must make a ${dragon.save} saving throw. The DC for this saving throw equals 8 + your Constitution modifier + your proficiency bonus. A creature takes 2d6 damage on a failed save, and half as much damage on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level. After you use your breath weapon, you can't use it again until you complete a short or long rest.`;
                 }
                 let dr = targetArray.find(t => t.name.startsWith("Damage Resistance"));
                 if (dr) {
                     dr.name = `Damage Resistance (${dragon.damage})`;
                     dr.desc = `You have resistance to the damage type associated with your draconic ancestry (${dragon.damage}).`;
                 }
             };
             updateBW(loadoutState.traitsToAdd);
             updateBW(myCharacterTraits);
          }
      }

      loadoutState.traitChoiceOptions.shift();
      runLoadoutStep();
    });
    return;
  }

  // CLASS WIZARD STEP 1: EQUIPMENT
  if (loadoutState.equipOptions.length > 0) {
    const optGroup = loadoutState.equipOptions[0];
    let chooseAmount = optGroup.choose || 1;
    document.getElementById("choiceModalTitle").textContent = "Gear Up!";

    const choiceModalBody = document.getElementById("choiceModalBody");
    choiceModalBody.innerHTML = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🎒</span>
        It's dangerous to go alone! Let's get you geared up.<br>
      </div>
      <p class="loading-text">Fetching weapon & armor stats...</p>
    `;

    let choicesArray = [];
    if (optGroup.from) {
        if (Array.isArray(optGroup.from)) choicesArray = optGroup.from;
        else if (optGroup.from.options) choicesArray = optGroup.from.options;
        else if (optGroup.from.equipment_category) {
            choicesArray = [{ option_type: "equipment_category", equipment_category: optGroup.from.equipment_category, count: chooseAmount }];
            chooseAmount = 1;
        }
    }
    if (!choicesArray.length && optGroup.options) choicesArray = optGroup.options;
    if (!choicesArray.length && Array.isArray(optGroup)) choicesArray = optGroup;

    if (!choicesArray || choicesArray.length === 0) {
      loadoutState.equipOptions.shift();
      runLoadoutStep();
      return;
    }

    if (choicesArray.length === 1) {
      const { concreteItems, drillDownSteps } = await extractConcreteItemsAndDrillDowns(choicesArray[0]);
      await processConcreteItems(concreteItems);
      loadoutState.equipOptions.shift();
      if (drillDownSteps.length > 0) {
        let normalizedSteps = [];
        drillDownSteps.forEach(s => {
           let c = s.choose || 1;
           for(let i=0; i<c; i++) {
              let stepCopy = JSON.parse(JSON.stringify(s));
              stepCopy.choose = 1;
              normalizedSteps.push(stepCopy);
           }
        });
        loadoutState.equipOptions.unshift(...normalizedSteps);
      }
      runLoadoutStep();
      return;
    }

    let html = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🎒</span>
        It's dangerous to go alone! Let's get you geared up.<br>
        You get to pick <strong style="color: #38bdf8; font-size: 1.3rem;" id="wizChooseCount">${chooseAmount}</strong> item(s) from this list:
      </div>
      <div class="equip-options-grid">
    `;
    for (let choiceIdx = 0; choiceIdx < choicesArray.length; choiceIdx++) {
      const choice = choicesArray[choiceIdx];
      const detailsArr = await getAsyncChoiceDetails(choice);
      let label = detailsArr.join('<br><span style="color:#64748b; font-size:0.8rem; font-weight:800; display:block; margin:0.6rem 0;">AND</span>');
      if (!label || label === "Item Option" || label === "Item(s)") label = "<strong>Equipment Option</strong>";

      html += `
        <div class="choice-option-wrapper">
          <button type="button" class="choice-option-btn gear-choice-btn" data-opt-index="${choiceIdx}">${label}</button>
        </div>
      `;
    }
    html += `</div>`;

    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    document.getElementById("choiceModalBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".gear-choice-btn");
      if (!btn) return;

      btn.style.opacity = "0.5";
      btn.innerHTML = "<strong style='color:#34d399;'>Loading Choice...</strong>";
      btn.disabled = true;

      const chosenIdx = parseInt(btn.dataset.optIndex, 10);
      const chosenChoice = choicesArray[chosenIdx];

      const { concreteItems, drillDownSteps } = await extractConcreteItemsAndDrillDowns(chosenChoice);
      await processConcreteItems(concreteItems);

      chooseAmount--;
      if (chooseAmount > 0) {
        btn.closest(".choice-option-wrapper").style.display = "none"; 
        const countSpan = document.getElementById("wizChooseCount");
        if (countSpan) countSpan.textContent = chooseAmount;
        if (drillDownSteps.length > 0) {
          let normalizedSteps = [];
          drillDownSteps.forEach(s => {
             let c = s.choose || 1;
             for(let i=0; i<c; i++) {
                let stepCopy = JSON.parse(JSON.stringify(s));
                stepCopy.choose = 1;
                normalizedSteps.push(stepCopy);
             }
          });
          loadoutState.equipOptions.splice(1, 0, ...normalizedSteps);
        }
      } else {
        loadoutState.equipOptions.shift();
        if (drillDownSteps.length > 0) {
          let normalizedSteps = [];
          drillDownSteps.forEach(s => {
             let c = s.choose || 1;
             for(let i=0; i<c; i++) {
                let stepCopy = JSON.parse(JSON.stringify(s));
                stepCopy.choose = 1;
                normalizedSteps.push(stepCopy);
             }
          });
          loadoutState.equipOptions.unshift(...normalizedSteps);
        }
        runLoadoutStep();
      }
    });
    return;
  }

  // WIZARD STEP: SKILL PROFICIENCIES
  if (loadoutState.profOptions.length > 0) {
    const profGroup = loadoutState.profOptions[0];
    const chooseAmount = profGroup.choose || 1;
    document.getElementById("choiceModalTitle").textContent = "Time to learn some skills!";

    let optionsArray = [];
    if (profGroup.from && profGroup.from.options) optionsArray = profGroup.from.options;
    else if (Array.isArray(profGroup.from)) optionsArray = profGroup.from;

    const skillChoices = optionsArray.map(opt => opt.item?.name || opt.name).filter(name => name?.startsWith("Skill:"));

    if (skillChoices.length === 0) {
      loadoutState.profOptions.shift();
      runLoadoutStep();
      return;
    }

    let html = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🧠</span>
        What are you good at?
        <br>Pick <strong style="color: #38bdf8; font-size: 1.3rem;">${chooseAmount}</strong> skill(s) to master:
      </div>
      <div class="loadout-skill-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
    `;
    skillChoices.forEach((skill) => {
      const cleanName = skill.replace("Skill: ", "");
      html += `<button type="button" class="skill-toggle-btn" data-skill="${escapeHtml(skill)}" style="background:#1e293b; border:1px solid #334155; color:#94a3b8; padding:0.65rem; border-radius:6px; font-weight:600; cursor:pointer;">${escapeHtml(cleanName)}</button>`;
    });
    html += `</div>`;
    html += `<button type="button" class="btn red confirm-loadout-btn" id="confirmSkillsBtn" style="font-size: 1.15rem; padding: 1.1rem; margin-top: 1.5rem; width:100%;">Confirm Skills</button>`;

    const choiceModalBody = document.getElementById("choiceModalBody");
    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    const activeBody = document.getElementById("choiceModalBody");

    let currentSelections = [];
    activeBody.addEventListener("click", (e) => {
      if (e.target.classList.contains("skill-toggle-btn")) {
        const btn = e.target;
        const skill = btn.dataset.skill;
        if (btn.classList.contains("active")) {
          btn.classList.remove("active");
          btn.style.background = "#1e293b"; btn.style.color = "#94a3b8"; btn.style.borderColor = "#334155";
          currentSelections = currentSelections.filter(s => s !== skill);
        } else {
          if (currentSelections.length < chooseAmount) {
            btn.classList.add("active");
            btn.style.background = "#dc2626"; btn.style.color = "#ffffff"; btn.style.borderColor = "#dc2626";
            currentSelections.push(skill);
          }
        }
      } else if (e.target.id === "confirmSkillsBtn") {
        if (currentSelections.length === 0 && !confirm("You haven't selected any skills! Are you sure you want to skip this?")) return;
        loadoutState.selectedSkills.push(...currentSelections);
        loadoutState.profOptions.shift();
        runLoadoutStep();
      }
    });
    return;
  }

  finalizeLoadout();
}

document.getElementById("closeChoiceModal")?.addEventListener("click", () => {
  document.getElementById("choiceModal")?.classList.remove("open");
});

document.addEventListener("click", (e) => {
  if (e.target.id === "addTraitBtn") {
    document.getElementById("traitModal")?.classList.add("open");
    document.getElementById("traitSearchInput").value = "";
    document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
    
    document.getElementById("traitApiList").innerHTML = COMMON_TRAITS.map(trait => {
      let tagsHtml = `<span class="tag-pill blue">${escapeHtml(trait.type || 'Feature')}</span>`;
      if (trait.parentTag) tagsHtml += `<span class="tag-pill purple">${escapeHtml(trait.parentTag)}</span>`;
      return `<div class="spell-option-item trait-option-item" data-url="${trait.url}" data-name="${escapeHtml(trait.name)}" data-type="${escapeHtml(trait.type || '')}"><div><div style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</div><div class="spell-meta-tags">${tagsHtml}</div></div><span class="spell-add-badge">+ Add</span></div>`;
    }).join("");
  }
  
  if (e.target.id === "addSpellBtn") {
    document.getElementById("spellModal")?.classList.add("open");
    document.getElementById("spellSearchInput").value = "";
    document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
    
    document.getElementById("spellApiList").innerHTML = COMMON_SPELLS.map(spell => {
      let lvlTag = spell.levelTag || "Spell";
      let tagsHtml = `<span class="tag-pill green">${escapeHtml(lvlTag)}</span>`;
      if (spell.schoolTag) tagsHtml += `<span class="tag-pill purple">${escapeHtml(spell.schoolTag)}</span>`;
      if (spell.classesTag) tagsHtml += `<span class="tag-pill blue" style="opacity:0.8;">${escapeHtml(spell.classesTag)}</span>`;
      return `<div class="spell-option-item spell-add-item" data-url="${spell.url}" data-name="${escapeHtml(spell.name)}"><div><div style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</div><div class="spell-meta-tags">${tagsHtml}</div></div><span class="spell-add-badge">+ Add</span></div>`;
    }).join("");
  }
});

let spellSearchTimeout = null;
let fullSpellsCache = [];
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase(); clearTimeout(spellSearchTimeout);
  spellSearchTimeout = setTimeout(async () => {
    document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Searching API...</p>`;
    
    let isError = false;
    if (fullSpellsCache.length === 0) {
        const data = await fetchAPI("https://www.dnd5eapi.co/api/spells");
        if (data && data.results) fullSpellsCache = data.results;
        else isError = true;
    }
    
    if (isError) {
        document.getElementById("spellApiList").innerHTML = `<p class="loading-text" style="color:#ef4444;">Search failed. API unresponsive.</p>`;
        return;
    }

    const filtered = fullSpellsCache.filter(s => s.name.toLowerCase().includes(query)).slice(0, 40);
    if (filtered.length === 0) { document.getElementById("spellApiList").innerHTML = `<p class="loading-text">No matching spells.</p>`; return; }
    document.getElementById("spellApiList").innerHTML = filtered.map((spell) => `
        <div class="spell-option-item spell-add-item" data-url="${spell.url}" data-name="${escapeHtml(spell.name)}">
          <div><div style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</div></div><span class="spell-add-badge">+ Add</span>
        </div>
    `).join("");
  }, 400);
});

let traitSearchTimeout = null;
let fullTraitsCache = [];
document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase(); clearTimeout(traitSearchTimeout);
  traitSearchTimeout = setTimeout(async () => {
    document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Searching API...</p>`;
    
    let isError = false;
    if (fullTraitsCache.length === 0) {
        const [f, t] = await Promise.all([fetchAPI("https://www.dnd5eapi.co/api/features"), fetchAPI("https://www.dnd5eapi.co/api/traits")]);
        if (f && f.results) fullTraitsCache.push(...f.results); else isError = true;
        if (t && t.results) fullTraitsCache.push(...t.results);
    }

    if (isError && fullTraitsCache.length === 0) {
        document.getElementById("traitApiList").innerHTML = `<p class="loading-text" style="color:#ef4444;">Search failed. API unresponsive.</p>`;
        return;
    }

    const filtered = fullTraitsCache.filter(t => t.name.toLowerCase().includes(query) && !t.name.includes("Dragon Ancestor (") && !t.name.includes("Draconic Ancestry (")).slice(0, 40);
    if (filtered.length === 0) { document.getElementById("traitApiList").innerHTML = `<p class="loading-text">No matching features.</p>`; return; }
    document.getElementById("traitApiList").innerHTML = filtered.map((trait) => `
        <div class="spell-option-item trait-option-item" data-url="${trait.url}" data-name="${escapeHtml(trait.name)}" data-type="${trait.url.includes('/features/') ? 'Class Feature' : 'Racial Trait'}">
          <div><div style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</div><div class="spell-meta-tags"><span class="tag-pill blue">${trait.url.includes('/features/') ? 'Class Feature' : 'Racial Trait'}</span></div></div><span class="spell-add-badge">+ Add</span>
        </div>
    `).join("");
  }, 400);
});
