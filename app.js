"use strict";

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let allSpellsCache = [];
let allClassesCache = [];
let allRacesCache = [];
let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";

let myCharacterSpells = [];
let myCharacterWeapons = [
  { name: "", atk: "", dmg: "", notes: "" },
  { name: "", atk: "", dmg: "", notes: "" }
];
let diceRollHistory = [];

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showStatus(text) {
  const statusElem = document.getElementById("saveStatus");
  if (!statusElem) return;
  statusElem.textContent = text;
  setTimeout(() => {
    statusElem.textContent = "";
  }, 2500);
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
  if (profBonusDisplay) {
    profBonusDisplay.textContent = prof >= 0 ? `+${prof}` : `${prof}`;
  }

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
    if (saveValElem) {
      saveValElem.textContent = isSaveChecked ? mod + prof : mod;
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
    if (valElem) valElem.textContent = total;
  });
}

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

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
  myCharacterWeapons = charData.weapons || [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "", notes: "" }
  ];

  renderWeapons();
  renderMySpells();
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
  myCharacterWeapons = [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "", notes: "" }
  ];
  diceRollHistory = [];
  
  renderDiceHistory();
  recalculateAll();
  renderWeapons();
  renderMySpells();
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

document.getElementById("loadModal")?.addEventListener("click", (e) => {
  if (e.target.id === "loadModal") {
    document.getElementById("loadModal")?.classList.remove("open");
  }
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

// Dropdowns & D&D 5e API Fetching
const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const raceInput = document.getElementById("charRace");
const raceDropdown = document.getElementById("raceDropdown");
const choiceModal = document.getElementById("choiceModal");
const choiceModalBody = document.getElementById("choiceModalBody");
const choiceModalTitle = document.getElementById("choiceModalTitle");

async function fetchOfficialList(endpoint) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/${endpoint}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) { return []; }
}

function renderDropdown(dropdownEl, items, filter = "", customId, customText) {
  if (!dropdownEl) return;
  const q = filter.toLowerCase().trim();
  const filtered = items.filter(i => i.name.toLowerCase().includes(q));
  let html = filtered.map(i => `<div class="dropdown-item" data-index="${i.index}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}</div>`).join("");
  html += `<div class="dropdown-item dropdown-custom" id="${customId}">${customText}</div>`;
  dropdownEl.innerHTML = html;
}

classInput?.addEventListener("click", async () => {
  if (!classDropdown.classList.contains("open")) {
    classDropdown.innerHTML = '<div class="dropdown-item" style="color:#94a3b8; font-style:italic;">Loading classes...</div>';
    classDropdown.classList.add("open");
    if (allClassesCache.length === 0) allClassesCache = await fetchOfficialList("classes");
    renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  }
});

classInput?.addEventListener("input", async () => {
  if (allClassesCache.length === 0) allClassesCache = await fetchOfficialList("classes");
  renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  classDropdown.classList.add("open");
});

raceInput?.addEventListener("click", async () => {
  if (!raceDropdown.classList.contains("open")) {
    raceDropdown.innerHTML = '<div class="dropdown-item" style="color:#94a3b8; font-style:italic;">Loading races...</div>';
    raceDropdown.classList.add("open");
    if (allRacesCache.length === 0) allRacesCache = await fetchOfficialList("races");
    renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
  }
});

raceInput?.addEventListener("input", async () => {
  if (allRacesCache.length === 0) allRacesCache = await fetchOfficialList("races");
  renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
  raceDropdown.classList.add("open");
});

function isWeaponOrArmor(name) {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.includes("sword") || l.includes("bow") || l.includes("dagger") || l.includes("axe") || 
         l.includes("mace") || l.includes("crossbow") || l.includes("staff") || l.includes("hammer") || 
         l.includes("spear") || l.includes("shield") || l.includes("armor") || l.includes("mail") || 
         l.includes("javelin") || l.includes("glaive") || l.includes("halberd") || l.includes("rapier") || 
         l.includes("club") || l.includes("sickle") || l.includes("dart");
}

function parseChoiceOption(opt) {
  let items = [];
  let labelParts = [];

  try {
      if (opt.option_type === "counted_reference" && opt.of) {
        items.push({ name: opt.of.name, qty: opt.count || 1 });
        labelParts.push(`${opt.count > 1 ? opt.count + "x " : ""}${opt.of.name}`);
      } else if (opt.option_type === "choice" && opt.choice) {
        const cat = opt.choice.desc || opt.choice.from?.equipment_category?.name || "Equipment Option";
        items.push({ name: `Any ${cat}`, qty: opt.choice.choose || 1 });
        labelParts.push(`Any ${cat}`);
      } else if (opt.option_type === "multiple" && opt.items) {
        opt.items.forEach(sub => {
          const parsed = parseChoiceOption(sub);
          items.push(...parsed.details);
          labelParts.push(parsed.label);
        });
      } else if (opt.option_type === "equipment_category" || opt.equipment_category) {
        const cat = opt.equipment_category?.name || "Category";
        labelParts.push(`Any ${cat}`);
        items.push({ name: `Any ${cat}`, qty: 1 });
      } else if (opt.equipment) {
        labelParts.push(`${opt.quantity > 1 ? opt.quantity + "x " : ""}${opt.equipment.name}`);
        items.push({ name: opt.equipment.name, qty: opt.quantity || 1 });
      } else if (opt.item) {
        labelParts.push(`${opt.count > 1 ? opt.count + "x " : ""}${opt.item.name}`);
        items.push({ name: opt.item.name, qty: opt.count || 1 });
      } else {
        labelParts.push("Equipment Option");
        items.push({ name: "Equipment Option", qty: 1 });
      }
  } catch (e) {
      labelParts.push("Option");
  }

  return { label: labelParts.join(" + ") || "Option", details: items };
}

function processOptionGroup(group, weaponsList, gearList) {
  return new Promise((resolve) => {
    let choose = group.choose || 1;
    let options = group.from?.options || group.from || [];
    
    if (group.from?.equipment_category) {
        options = [{ option_type: "equipment_category", equipment_category: group.from.equipment_category }];
    }
    
    if (!Array.isArray(options)) options = [options];

    if (options.length === 0) {
      resolve();
      return;
    }

    if (options.length === 1 && choose === 1) {
      const parsed = parseChoiceOption(options[0]);
      parsed.details.forEach(i => {
        const q = i.qty > 1 ? `${i.qty}x ` : "";
        if (isWeaponOrArmor(i.name)) weaponsList.push({ name: `${q}${i.name}`, atk: "+5", dmg: "1d8", notes: "" });
        else gearList.push(`${q}${i.name}`);
      });
      resolve();
      return;
    }

    choiceModalTitle.textContent = group.desc || `Choose ${choose} Starting Option(s)`;
    
    let html = "";
    options.forEach((opt, idx) => {
      const parsed = parseChoiceOption(opt);
      const tooltip = parsed.details.map(d => `${d.qty}x ${d.name}`).join("\n");
      const cleanLabel = parsed.label === "Option" && group.desc ? group.desc : parsed.label;
      html += `
        <div class="choice-option-wrapper" id="choice-wrap-${idx}">
          <button type="button" class="choice-option-btn" data-idx="${idx}">${escapeHtml(cleanLabel)}</button>
          <div class="choice-tooltip">${escapeHtml(tooltip).replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });

    choiceModalBody.innerHTML = html;
    choiceModal.classList.add("open");

    const newBody = choiceModalBody.cloneNode(true);
    choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
    const activeModalBody = document.getElementById("choiceModalBody");

    const clickHandler = (e) => {
      const btn = e.target.closest(".choice-option-btn");
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      const parsed = parseChoiceOption(options[idx]);

      parsed.details.forEach(i => {
        const q = i.qty > 1 ? `${i.qty}x ` : "";
        if (isWeaponOrArmor(i.name)) weaponsList.push({ name: `${q}${i.name}`, atk: "+5", dmg: "1d8", notes: "" });
        else gearList.push(`${q}${i.name}`);
      });

      const wrapper = document.getElementById(`choice-wrap-${idx}`);
      if(wrapper) wrapper.style.display = "none";
      choose--;

      if (choose <= 0) {
        activeModalBody.removeEventListener("click", clickHandler);
        choiceModal.classList.remove("open");
        resolve();
      } else {
        choiceModalTitle.textContent = `Choose ${choose} MORE option(s)`;
      }
    };

    activeModalBody.addEventListener("click", clickHandler);
  });
}

function finalizeEquipmentApplication(weaponsList, gearList, featuresText) {
  while (weaponsList.length < 2) {
      weaponsList.push({ name: "", atk: "", dmg: "", notes: "" });
  }
  myCharacterWeapons = weaponsList;
  renderWeapons();

  const invBox = document.getElementById("inventory");
  if (invBox && gearList.length > 0) {
    const currentInv = invBox.value.trim();
    const newInv = gearList.join("\n");
    invBox.value = currentInv ? currentInv + "\n\n" + newInv : newInv;
    autoExpandTextarea(invBox);
  }

  const featBox = document.getElementById("featuresTraits");
  if (featBox) {
    const currentFeats = featBox.value.trim();
    featBox.value = currentFeats ? currentFeats + "\n\n" + featuresText.trim() : featuresText.trim();
    autoExpandTextarea(featBox);
  }

  saveSheet();
  showStatus("Class gear & stats loaded!");
  recalculateAll();
}

classDropdown?.addEventListener("click", async (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.id === "addCustomClassOption") {
    classInput.value = "";
    classInput.focus();
    classDropdown.classList.remove("open");
    return;
  }

  const className = item.dataset.name;
  const classIdx = item.dataset.index;
  classInput.value = className;
  classDropdown.classList.remove("open");
  saveSheet();

  showStatus("Loading gear...");
  try {
    const classRes = await fetch(`https://www.dnd5eapi.co/api/classes/${classIdx}`);
    if (!classRes.ok) return;
    const classDetails = await classRes.json();
    
    let weaponsList = [];
    let gearList = [];
    let featuresText = `Hit Die: 1d${classDetails.hit_die} per level\n\n`;

    if (classDetails.saving_throws && classDetails.saving_throws.length > 0) {
      featuresText += "Saving Throws: " + classDetails.saving_throws.map(st => st.name).join(", ") + "\n\n";
    }

    if (classDetails.proficiencies && classDetails.proficiencies.length > 0) {
      const filteredProfs = classDetails.proficiencies.filter(p => !p.index.startsWith("saving"));
      const profs = filteredProfs.map(p => p.name).join(", ");
      const profBox = document.getElementById("otherProfs");
      if (profBox && !profBox.value) profBox.value = profs;
    }

    const equipRes = await fetch(`https://www.dnd5eapi.co/api/starting-equipment/${classIdx}`);
    if (equipRes.ok) {
        const equipData = await equipRes.json();
        if (equipData.starting_equipment) {
            equipData.starting_equipment.forEach(item => {
              const name = item.equipment.name;
              const q = item.quantity > 1 ? `${item.quantity}x ` : "";
              if (isWeaponOrArmor(name)) weaponsList.push({ name: `${q}${name}`, atk: "+5", dmg: "1d8", notes: "" });
              else gearList.push(`${q}${name}`);
            });
        }
        if (equipData.starting_equipment_options) {
            for (const group of equipData.starting_equipment_options) {
              await processOptionGroup(group, weaponsList, gearList);
            }
        }
    }
    
    finalizeEquipmentApplication(weaponsList, gearList, featuresText);

  } catch (err) {
    console.error("Error loading class equipment:", err);
  }
});

raceDropdown?.addEventListener("click", async (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.id === "addCustomRaceOption") {
    raceInput.value = "";
    raceInput.focus();
    raceDropdown.classList.remove("open");
    return;
  }

  const raceName = item.dataset.name;
  const raceIdx = item.dataset.index;
  raceInput.value = raceName;
  raceDropdown.classList.remove("open");
  saveSheet();

  showStatus("Fetching racial traits...");
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/races/${raceIdx}`);
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.speed) document.getElementById("charSpeed").value = data.speed;
    
    let traitText = "";
    if (data.traits && data.traits.length > 0) {
        const promises = data.traits.map(t => fetch(`https://www.dnd5eapi.co${t.url}`).then(r => r.json()));
        const traitsData = await Promise.all(promises);
        traitsData.forEach(td => {
            const desc = Array.isArray(td.desc) ? td.desc.join("\n") : (td.desc || "");
            traitText += `[${td.name}]\n${desc}\n\n`;
        });
    }
    
    if (traitText) {
        const featBox = document.getElementById("featuresTraits");
        if (featBox) {
            const cur = featBox.value.trim();
            featBox.value = cur ? cur + "\n\n" + traitText.trim() : traitText.trim();
            autoExpandTextarea(featBox);
            saveSheet();
        }
    }
    showStatus("Racial traits loaded!");
  } catch (err) {
    console.error("Error loading traits", err);
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("open"));
  }
  if(e.target.classList.contains("modal-backdrop") || e.target.classList.contains("modal-close-btn")) {
      e.target.closest(".modal-backdrop")?.classList.remove("open");
  }
});

async function fetchOfficialSpells() {
  if (allSpellsCache.length > 0) return allSpellsCache;
  try {
    const res = await fetch("https://www.dnd5eapi.co/api/spells");
    const data = await res.json();
    allSpellsCache = data.results || [];
    return allSpellsCache;
  } catch (err) { return []; }
}

async function fetchSpellDetails(spellIndex) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/spells/${spellIndex}`);
    return await res.json();
  } catch (err) { return null; }
}

function renderModalSpells(filterText = "") {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  const query = filterText.toLowerCase().trim();
  const matches = allSpellsCache.filter((s) => s.name.toLowerCase().includes(query));

  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = matches.map(spell => `
        <div class="spell-option-item" data-index="${spell.index}" data-name="${escapeHtml(spell.name)}">
          <span>${escapeHtml(spell.name)}</span>
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
      let typeVal = spell.type || `Level ${spell.level || 1} ${spell.school?.name || ""}`.trim();
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
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="casting_time" value="${escapeHtml(spell.casting_time || "1 Action")}" />
            </div>
            <div class="meta-field-group">
              <span class="meta-label">Range</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="range" value="${escapeHtml(spell.range || "30 ft")}" />
            </div>
            <div class="meta-field-group">
              <span class="meta-label">Duration</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="duration" value="${escapeHtml(spell.duration || "Instantaneous")}" />
            </div>
          </div>
          <textarea class="spell-custom-desc-textarea custom-spell-field" data-prop="desc" placeholder="Spell description...">${escapeHtml(descVal)}</textarea>
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
  document.getElementById("spellModal")?.classList.add("open");
  const list = document.getElementById("spellApiList");
  if (list && allSpellsCache.length === 0) {
    list.innerHTML = `<p class="loading-text">Loading official 5e spells...</p>`;
    await fetchOfficialSpells();
  }
  renderModalSpells();
});

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

document.getElementById("addCustomSpellBtn")?.addEventListener("click", () => {
  myCharacterSpells.push({ name: "New Custom Spell", type: "1st Level", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "" });
  saveSheet();
  renderMySpells();
  document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".spell-option-item");
  if (!row) return;
  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";
  
  const details = await fetchSpellDetails(row.dataset.index);
  if (details) {
    myCharacterSpells.push({
      name: details.name,
      type: `${details.level === 0 ? "Cantrip" : "Level " + details.level} ${details.school?.name || ""}`.trim(),
      casting_time: details.casting_time,
      range: details.range,
      duration: details.duration,
      desc: Array.isArray(details.desc) ? details.desc.join("\n\n") : details.desc
    });
    saveSheet();
    renderMySpells();
  }
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
  const currentChar = roster[activeCharId] || { id: activeCharId, name: "Character", fields: getCurrentSheetData(), spells: myCharacterSpells, weapons: myCharacterWeapons };
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

loadSheet();
