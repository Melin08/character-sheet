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
  { name: "Fireball", url: "/api/spells/fireball", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard" }
];

const COMMON_TRAITS = [
  { name: "Action Surge", url: "/api/features/action-surge-1-use", type: "Class Feature", parentTag: "Fighter" },
  { name: "Sneak Attack", url: "/api/features/sneak-attack", type: "Class Feature", parentTag: "Rogue" },
  { name: "Rage", url: "/api/features/rage", type: "Class Feature", parentTag: "Barbarian" },
  { name: "Bardic Inspiration", url: "/api/features/bardic-inspiration-d6", type: "Class Feature", parentTag: "Bard" },
  { name: "Divine Smite", url: "/api/features/divine-smite", type: "Class Feature", parentTag: "Paladin" }
];

const SKILL_MAP = {
  "Skill: Acrobatics": "cb_acro_p", "Skill: Animal Handling": "cb_anim_p", "Skill: Arcana": "cb_arca_p",
  "Skill: Athletics": "cb_athl_p", "Skill: Deception": "cb_dec_p", "Skill: History": "cb_hist_p",
  "Skill: Insight": "cb_ins_p", "Skill: Intimidation": "cb_intm_p", "Skill: Investigation": "cb_inv_p",
  "Skill: Medicine": "cb_med_p", "Skill: Nature": "cb_nat_p", "Skill: Perception": "cb_perc_p",
  "Skill: Performance": "cb_perf_p", "Skill: Persuasion": "cb_pers_p", "Skill: Religion": "cb_rel_p",
  "Skill: Sleight of Hand": "cb_slt_p", "Skill: Stealth": "cb_ste_p", "Skill: Survival": "cb_surv_p"
};

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
  myCharacterWeapons = [{ name: "", atk: "", dmg: "", notes: "" }, { name: "", atk: "", dmg: "", notes: "" }];
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

/* =========================================================
   DYNAMIC API CACHE, SEARCH ENGINE & STEP-BY-STEP LOADOUT
   ========================================================= */

const apiCache = {};

async function fetchAPI(url) {
  if (apiCache[url]) return apiCache[url];
  try {
    const res = await fetch(url);
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

/* --- Detailed Tag Fetchers --- */

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

/* --- Class Equipment Logic --- */

let loadoutState = {
  equipOptions: [],
  profOptions: [],
  weaponsList: [],
  gearList: [],
  selectedSkills: []
};

function isWeaponOrArmor(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes("sword") || lower.includes("bow") || lower.includes("dagger") || 
         lower.includes("axe") || lower.includes("mace") || lower.includes("crossbow") || 
         lower.includes("staff") || lower.includes("hammer") || lower.includes("spear") || 
         lower.includes("shield") || lower.includes("armor") || lower.includes("mail") || 
         lower.includes("javelin") || lower.includes("glaive") || lower.includes("halberd") || 
         lower.includes("pike") || lower.includes("flail") || lower.includes("club") || 
         lower.includes("rapier") || lower.includes("dart");
}

async function formatItemWithStats(name, url, count) {
  let qtyStr = count > 1 ? `<span style="color:#f87171">${count}x</span> ` : "";
  let statStr = "";
  if (url) {
    const data = await fetchAPI("https://www.dnd5eapi.co" + url);
    if (data) {
      let extras = [];
      if (data.damage && data.damage.damage_dice) {
        let dmgType = data.damage.damage_type?.name ? " " + data.damage.damage_type.name.toLowerCase() : "";
        extras.push(`🎲 ${data.damage.damage_dice}${dmgType}`);
      }
      if (data.armor_class) {
        extras.push(`🛡️ AC ${data.armor_class.base}${data.armor_class.dex_bonus ? ' + Dex' : ''}`);
      }
      if (data.contents && data.contents.length > 0) {
        const contentsText = data.contents.map(c => `${c.quantity}x ${c.item.name}`).join(', ');
        extras.push(`🎒 Contains: ${contentsText}`);
      }
      if (extras.length > 0) {
        statStr = `<span class="subtext" style="color:#94a3b8; font-weight:normal; margin-top:0.4rem; display:block;">${extras.join("<br>")}</span>`;
      }
    }
  }
  return `<strong style="font-size:1.1rem; color:#f8fafc;">${qtyStr}${escapeHtml(name)}</strong>${statStr}`;
}

async function getAsyncChoiceDetails(choice) {
  let details = [];
  if (!choice) return details;

  if (choice.option_type === "counted_reference" && choice.of) {
    details.push(await formatItemWithStats(choice.of.name, choice.of.url, choice.count));
  } else if (choice.option_type === "choice" && choice.choice) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Any ${choice.choice.desc || choice.choice.from?.equipment_category?.name || "Option"}</strong><br><span class="subtext" style="color:#34d399;">Click to open choices!</span>`);
  } else if (choice.option_type === "multiple" && choice.items) {
    for (let i of choice.items) {
      if (i.option_type === "counted_reference" && i.of) details.push(await formatItemWithStats(i.of.name, i.of.url, i.count));
      else if (i.option_type === "choice" && i.choice) details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Any ${i.choice.desc || i.choice.from?.equipment_category?.name || "Option"}</strong><br><span class="subtext" style="color:#34d399;">Click to open choices!</span>`);
      else if (i.of) details.push(await formatItemWithStats(i.of.name, i.of.url, i.count));
      else if (i.item) details.push(await formatItemWithStats(i.item.name, i.item.url, i.count));
    }
  } else if (choice.option_type === "equipment_category" && choice.equipment_category) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose ${choice.count > 1 ? choice.count + " " : ""}${choice.equipment_category.name}</strong><br><span class="subtext" style="color:#34d399;">Click to open choices!</span>`);
  } else if (choice.equipment) {
    details.push(await formatItemWithStats(choice.equipment.name, choice.equipment.url, choice.quantity));
  } else if (choice.equipment_category) {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">🎁 Choose from ${choice.equipment_category.name}</strong><br><span class="subtext" style="color:#34d399;">Click to open choices!</span>`);
  } else if (choice.item) {
    details.push(await formatItemWithStats(choice.item.name, choice.item.url, choice.count));
  } else {
    details.push(`<strong style="font-size:1.1rem; color:#f8fafc;">${choice.desc || "Item Option"}</strong>`);
  }
  
  if (details.length === 0) details.push("<strong>Equipment Option</strong>");
  return details;
}

// Intercepts categories and breaks them down into new selectable steps
async function processChosenOption(c, weaponsList, gearList) {
  let pendingSteps = [];

  async function pushEnrichedItem(name, url, qty) {
    let finalDmg = "1d8";
    let isWpn = isWeaponOrArmor(name);
    let contentStr = "";
    if (url) {
       const data = await fetchAPI("https://www.dnd5eapi.co" + url);
       if (data) {
          if (data.damage && data.damage.damage_dice) {
             finalDmg = data.damage.damage_dice;
             if (data.damage.damage_type && data.damage.damage_type.name) {
                finalDmg += " " + data.damage.damage_type.name.toLowerCase();
             }
          }
          if (data.contents && data.contents.length > 0) {
             const cText = data.contents.map(cnt => `${cnt.quantity}x ${cnt.item.name}`).join(', ');
             contentStr = ` (Contains: ${cText})`;
          }
       }
    }
    const fullName = name + contentStr;
    const qtyPrefix = qty > 1 ? `${qty}x ` : "";
    if (isWpn) weaponsList.push({ name: `${qtyPrefix}${fullName}`, atk: "+5", dmg: finalDmg, notes: "" });
    else gearList.push(`${qtyPrefix}${fullName}`);
  }

  // Recursive parsing to handle multi-nested choices gracefully
  async function parse(c_in) {
    if (c_in.option_type === "multiple" && c_in.items) {
       for (let i of c_in.items) await parse(i);
    } else if (c_in.option_type === "choice" && c_in.choice) {
       let catUrl = c_in.choice.from?.equipment_category?.url;
       if (catUrl) {
          const catData = await fetchAPI("https://www.dnd5eapi.co" + catUrl);
          if (catData && catData.equipment) {
             pendingSteps.push({
                desc: `Select ${c_in.choice.choose || 1} from ${c_in.choice.from.equipment_category.name}`,
                choose: c_in.choice.choose || 1,
                options: catData.equipment.map(eq => ({ option_type: "item", item: eq }))
             });
          }
       } else if (c_in.choice.from?.options) {
          pendingSteps.push({
             desc: `Choose ${c_in.choice.choose || 1} Option(s)`,
             choose: c_in.choice.choose || 1,
             options: c_in.choice.from.options
          });
       }
    } else if (c_in.option_type === "equipment_category" && c_in.equipment_category) {
       const catData = await fetchAPI("https://www.dnd5eapi.co" + c_in.equipment_category.url);
       if (catData && catData.equipment) {
          pendingSteps.push({
             desc: `Select 1 from ${c_in.equipment_category.name}`,
             choose: 1,
             options: catData.equipment.map(eq => ({ option_type: "item", item: eq }))
          });
       }
    } else if (c_in.option_type === "counted_reference" && c_in.of) {
       await pushEnrichedItem(c_in.of.name, c_in.of.url, c_in.count || 1);
    } else if (c_in.equipment) {
       await pushEnrichedItem(c_in.equipment.name, c_in.equipment.url, c_in.quantity || 1);
    } else if (c_in.item) {
       await pushEnrichedItem(c_in.item.name, c_in.item.url, c_in.count || 1);
    } else if (c_in.equipment_category) {
       const catData = await fetchAPI("https://www.dnd5eapi.co" + c_in.equipment_category.url);
       if (catData && catData.equipment) {
          pendingSteps.push({
             desc: `Select 1 from ${c_in.equipment_category.name}`,
             choose: 1,
             options: catData.equipment.map(eq => ({ option_type: "item", item: eq }))
          });
       }
    } else {
       gearList.push("1x " + (c_in.desc || "Selected Option"));
    }
  }

  await parse(c);
  return pendingSteps;
}

function finalizeLoadout() {
  if (loadoutState.weaponsList.length > 0) {
    let updatedWeps = loadoutState.weaponsList.map(w => ({ name: w.name, atk: w.atk, dmg: w.dmg, notes: w.notes }));
    while (updatedWeps.length < 2) updatedWeps.push({ name: "", atk: "", dmg: "", notes: "" });
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

  saveSheet();
  recalculateAll();

  document.getElementById("choiceModalTitle").textContent = "Loadout Complete! 🎉";
  document.getElementById("choiceModalBody").innerHTML = `
    <div class="wizard-intro" style="font-size: 1.25rem; color: #34d399; font-weight: 800; padding: 1.5rem 0;">
      Awesome! Your equipment and skills are successfully applied to your sheet!
    </div>
    <button class="btn red confirm-loadout-btn" id="finishLoadoutBtn" style="font-size: 1.25rem; padding: 1.2rem;">Let's Go!</button>
  `;

  document.getElementById("finishLoadoutBtn")?.addEventListener("click", () => {
    document.getElementById("choiceModal").classList.remove("open");
  });
}

async function runLoadoutStep() {
  const choiceModal = document.getElementById("choiceModal");

  // Step 1: Equipment Options
  if (loadoutState.equipOptions.length > 0) {
    const optGroup = loadoutState.equipOptions[0];
    let chooseAmount = optGroup.choose || 1;
    document.getElementById("choiceModalTitle").textContent = "Gear Up!";

    const choiceModalBody = document.getElementById("choiceModalBody");
    choiceModalBody.innerHTML = `
      <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🎒</span>
        It's dangerous to go alone! Let's get you geared up.
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

    // Auto-skip if there's only 1 category choice so you jump straight into the drill-down
    if (choicesArray.length === 1) {
      const newSteps = await processChosenOption(choicesArray[0], loadoutState.weaponsList, loadoutState.gearList);
      loadoutState.equipOptions.shift();
      if (newSteps.length > 0) loadoutState.equipOptions.unshift(...newSteps);
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
          <button type="button" class="choice-option-btn" data-opt-index="${choiceIdx}">${label}</button>
        </div>
      `;
    }
    html += `</div>`;

    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    document.getElementById("choiceModalBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".choice-option-btn");
      if (!btn) return;

      btn.style.opacity = "0.5";
      btn.innerHTML = "<strong style='color:#34d399;'>Loading Choice...</strong>";
      btn.disabled = true;

      const chosenIdx = parseInt(btn.dataset.optIndex, 10);
      const newSteps = await processChosenOption(choicesArray[chosenIdx], loadoutState.weaponsList, loadoutState.gearList);

      chooseAmount--;
      if (chooseAmount > 0) {
        btn.closest(".choice-option-wrapper").style.display = "none"; 
        const countSpan = document.getElementById("wizChooseCount");
        if (countSpan) countSpan.textContent = chooseAmount;
        if (newSteps.length > 0) loadoutState.equipOptions.splice(1, 0, ...newSteps);
      } else {
        loadoutState.equipOptions.shift();
        if (newSteps.length > 0) loadoutState.equipOptions.unshift(...newSteps);
        runLoadoutStep();
      }
    });
    return;
  }

  // Step 2: Skill Proficiencies
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
      <div class="loadout-skill-grid">
    `;
    skillChoices.forEach((skill) => {
      const cleanName = skill.replace("Skill: ", "");
      html += `<button type="button" class="skill-toggle-btn" data-skill="${escapeHtml(skill)}">${escapeHtml(cleanName)}</button>`;
    });
    html += `</div>`;
    html += `<button type="button" class="btn red confirm-loadout-btn" id="confirmSkillsBtn" style="font-size: 1.15rem; padding: 1.1rem; margin-top: 1.5rem;">Confirm Skills</button>`;

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
          currentSelections = currentSelections.filter(s => s !== skill);
        } else {
          if (currentSelections.length < chooseAmount) {
            btn.classList.add("active");
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

/* --- Dropdowns --- */
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

    // Apply Other Proficiencies and Saves immediately!
    if (classRes?.proficiencies) {
      const otherProfs = classRes.proficiencies
        .filter(p => !p.index.startsWith("skill-") && !p.index.startsWith("saving-throw-"))
        .map(p => p.name)
        .join(", ");
        
      if (otherProfs) {
        // Automatically injects into Bio/Notes or an Other Proficiencies box if available
        const profBox = document.getElementById("otherProfs") || document.getElementById("proficiencies") || document.getElementById("other_proficiencies") || document.getElementById("bio");
        if (profBox) {
          const current = profBox.value.trim();
          const prefixText = profBox.id === "bio" ? "Other Proficiencies:\n" : "";
          profBox.value = current ? current + "\n\n" + prefixText + otherProfs : prefixText + otherProfs;
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
      equipOptions: finalEquip?.starting_equipment_options || [],
      profOptions: classRes?.proficiency_choices || [],
      weaponsList: [],
      gearList: [],
      selectedSkills: []
    };
    
    // Process automatic guaranteed equipment immediately
    if (finalEquip?.starting_equipment) {
      for (const stItem of finalEquip.starting_equipment) {
        const qtyPrefix = stItem.quantity > 1 ? `${stItem.quantity}x ` : "";
        let isWpn = isWeaponOrArmor(stItem.equipment.name);
        let finalDmg = "1d8";
        let contentStr = "";
        
        if (stItem.equipment.url) {
           const data = await fetchAPI("https://www.dnd5eapi.co" + stItem.equipment.url);
           if (data) {
              if (data.damage && data.damage.damage_dice) {
                 finalDmg = data.damage.damage_dice;
                 if (data.damage.damage_type && data.damage.damage_type.name) {
                    finalDmg += " " + data.damage.damage_type.name.toLowerCase();
                 }
              }
              if (data.contents && data.contents.length > 0) {
                 const cText = data.contents.map(cnt => `${cnt.quantity}x ${cnt.item.name}`).join(', ');
                 contentStr = ` (Contains: ${cText})`;
              }
           }
        }
        
        const fullName = stItem.equipment.name + contentStr;
        if (isWpn) loadoutState.weaponsList.push({ name: `${qtyPrefix}${fullName}`, atk: "+5", dmg: finalDmg, notes: "" });
        else loadoutState.gearList.push(`${qtyPrefix}${fullName}`);
      }
    }

    runLoadoutStep();
  }
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
  if (e.target.classList.contains("modal-backdrop") || e.target.classList.contains("modal-close-btn")) {
    e.target.closest('.modal-backdrop')?.classList.remove("open");
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
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.85rem; color: #64748b; font-style: italic;">No skills/abilities added yet. Click "+ Add Skill / Ability" above to add one.</p>`;
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

function renderModalTraitsList(matches) {
  const container = document.getElementById("traitApiList");
  if (!container) return;
  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching features found.</p>`;
    return;
  }

  container.innerHTML = matches.map((trait) => {
    let tagsHtml = `<span class="tag-pill blue">${escapeHtml(trait.type || 'Feature')}</span>`;
    if (trait.parentTag) tagsHtml += `<span class="tag-pill purple">${escapeHtml(trait.parentTag)}</span>`;

    return `
    <div class="spell-option-item trait-option-item" data-url="${trait.url}" data-name="${escapeHtml(trait.name)}" data-type="${escapeHtml(trait.type || '')}">
      <div>
        <div style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</div>
        <div class="spell-meta-tags">${tagsHtml}</div>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `}).join("");
}

document.getElementById("addTraitBtn")?.addEventListener("click", async () => {
  const modal = document.getElementById("traitModal");
  modal?.classList.add("open");
  const input = document.getElementById("traitSearchInput");
  if (input) input.value = "";
  
  document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
  const results = await searchTraits("");
  renderModalTraitsList(results);
});

document.getElementById("closeTraitModal")?.addEventListener("click", () => {
  document.getElementById("traitModal")?.classList.remove("open");
});

let traitSearchTimeout = null;
document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value;
  clearTimeout(traitSearchTimeout);
  traitSearchTimeout = setTimeout(async () => {
    document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Searching D&D API...</p>`;
    const results = await searchTraits(query);
    const detailed = await fetchDetailedTraits(results);
    renderModalTraitsList(detailed);
  }, 400);
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

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  let finalDesc = "Description not available.";
  if (row.dataset.url) {
    const detail = await fetchAPI("https://www.dnd5eapi.co" + row.dataset.url);
    if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "");
  }

  myCharacterTraits.push({
    name: row.dataset.name,
    type: row.dataset.type || "Feature",
    desc: finalDesc,
    isExpanded: false
  });

  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
  if (badge) badge.textContent = "+ Add";
});

function renderModalSpellsList(matches) {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = matches.map((spell) => {
    let lvlTag = spell.levelTag || "Spell";
    if (spell.name === "Fire Bolt" || spell.name === "Mage Hand" || spell.name === "Prestidigitation") lvlTag = "Cantrip";
    else if (spell.name === "Shield" || spell.name === "Magic Missile" || spell.name === "Cure Wounds" || spell.name === "Healing Word") lvlTag = "Level 1";
    else if (spell.name === "Misty Step") lvlTag = "Level 2";
    else if (spell.name === "Fireball" || spell.name === "Counterspell") lvlTag = "Level 3";

    let tagsHtml = `<span class="tag-pill green">${escapeHtml(lvlTag)}</span>`;
    if (spell.schoolTag) tagsHtml += `<span class="tag-pill purple">${escapeHtml(spell.schoolTag)}</span>`;
    if (spell.classesTag) tagsHtml += `<span class="tag-pill blue" style="opacity:0.8;">${escapeHtml(spell.classesTag)}</span>`;

    return `
    <div class="spell-option-item spell-add-item" data-url="${spell.url}" data-name="${escapeHtml(spell.name)}">
      <div>
        <div style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</div>
        <div class="spell-meta-tags">${tagsHtml}</div>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `}).join("");
}

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells.map((spell, idx) => {
    let typeVal = spell.type || "";
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
  const input = document.getElementById("spellSearchInput");
  if (input) input.value = "";
  
  document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
  const results = await searchSpells("");
  renderModalSpellsList(results);
});

document.getElementById("closeSpellModal")?.addEventListener("click", () => {
  document.getElementById("spellModal")?.classList.remove("open");
});

let spellSearchTimeout = null;
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value;
  clearTimeout(spellSearchTimeout);
  spellSearchTimeout = setTimeout(async () => {
    document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Searching D&D API...</p>`;
    const results = await searchSpells(query);
    const detailed = await fetchDetailedSpells(results);
    renderModalSpellsList(detailed);
  }, 400);
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

document.getElementById("spellApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".spell-add-item");
  if (!row) return;

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  let finalDesc = "Description not available.";
  let finalType = "Spell";
  let finalCast = "1 Action";
  let finalRange = "30 ft";
  let finalDur = "Instantaneous";

  if (row.dataset.url) {
    const fetched = await fetchAPI("https://www.dnd5eapi.co" + row.dataset.url);
    if (fetched) {
      finalDesc = Array.isArray(fetched.desc) ? fetched.desc.join("\n\n") : (fetched.desc || "");
      if (fetched.higher_level) finalDesc += "\n\nAt Higher Levels: " + (Array.isArray(fetched.higher_level) ? fetched.higher_level.join(" ") : fetched.higher_level);
      finalType = fetched.level === 0 ? "Cantrip" : `Level ${fetched.level} ${fetched.school?.name || ""}`.trim();
      finalCast = fetched.casting_time || finalCast;
      finalRange = fetched.range || finalRange;
      finalDur = fetched.duration || finalDur;
    }
  }

  myCharacterSpells.push({
    name: row.dataset.name,
    type: finalType,
    casting_time: finalCast,
    range: finalRange,
    duration: finalDur,
    desc: finalDesc
  });

  saveSheet();
  renderMySpells();
  document.getElementById("spellModal")?.classList.remove("open");
  if (badge) badge.textContent = "+ Add";
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

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
});

// Init
loadSheet();
renderMyTraits();
