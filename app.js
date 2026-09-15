// Storage Keys
const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let allSpellsCache = [];
let allClassesCache = [];
let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";

let myCharacterSpells = [];
let myCharacterWeapons = []; // Starting completely empty
let diceRollHistory = [];

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

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
  document.querySelectorAll(".spell-stat-input").forEach((input) => {
    autoResizeStatInput(input);
  });
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
  try {
    return JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveRoster(roster) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
}

function getCurrentSheetData() {
  const fields = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") {
      fields[field.id] = field.checked;
    } else {
      fields[field.id] = field.value;
    }
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
      if (el.type === "checkbox") {
        el.checked = fields[id];
      } else {
        el.value = fields[id];
      }
    }
  });

  myCharacterSpells = charData.spells || [];
  myCharacterWeapons = charData.weapons || [];

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
    if (field.type === "checkbox") {
      field.checked = false;
    } else if (field.id === "charLevel") {
      field.value = 1;
    } else if (field.id === "ac" || field.id === "curHp" || field.id === "maxHp") {
      field.value = 10;
    } else if (field.classList.contains("attr-input")) {
      field.value = 10;
    } else if (field.id === "charSpeed") {
      field.value = 30;
    } else if (
      field.classList.contains("dual-input") ||
      field.classList.contains("coin-input") ||
      field.classList.contains("slot-input")
    ) {
      field.value = 0;
    } else {
      field.value = "";
    }
  });

  myCharacterSpells = [];
  myCharacterWeapons = [];
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

  container.innerHTML = keys
    .map((id) => {
      const char = roster[id];
      const isActive = id === activeCharId;
      return `
        <div class="char-item-row" data-id="${id}">
          <div class="char-item-info">
            <span class="char-item-name">${escapeHtml(char.name || "Unnamed Character")}</span>
            <span class="char-item-sub">${escapeHtml(char.summary || "")}</span>
          </div>
          <div class="char-actions">
            <button type="button" class="char-select-btn ${isActive ? "active" : ""}">
              ${isActive ? "Active" : "Select"}
            </button>
            <button type="button" class="char-delete-btn" title="Delete character">&times;</button>
          </div>
        </div>
      `;
    })
    .join("");
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
        } else {
          resetSheet();
        }
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

document.getElementById("helpLinkBtn")?.addEventListener("click", () => {
  document.getElementById("helpModal")?.classList.add("open");
});

document.getElementById("closeHelpModal")?.addEventListener("click", () => {
  document.getElementById("helpModal")?.classList.remove("open");
});

document.getElementById("helpModal")?.addEventListener("click", (e) => {
  if (e.target.id === "helpModal") {
    document.getElementById("helpModal")?.classList.remove("open");
  }
});

function switchMainTab(targetId) {
  document.querySelectorAll(".main-tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));

  const targetBtn = document.querySelector(`.main-tab[data-target="${targetId}"]`);
  targetBtn?.classList.add("active");
  document.getElementById(targetId)?.classList.add("active");
}

document.querySelectorAll(".main-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchMainTab(btn.dataset.target);
  });
});

document.querySelectorAll(".sub-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".subtab-page").forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const target = btn.dataset.sub;
    document.getElementById(target)?.classList.add("active");
  });
});

document.querySelectorAll(".footer-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabTarget = btn.dataset.tab;
    switchMainTab(tabTarget);
    const scrollTarget = btn.dataset.scroll;
    if (scrollTarget === "spells") {
      document.getElementById("spellsList")?.scrollIntoView({ behavior: "smooth" });
    } else if (scrollTarget === "skills") {
      document.querySelector(".skills-group")?.scrollIntoView({ behavior: "smooth" });
    } else if (scrollTarget === "attr") {
      document.querySelector(".attributes-group")?.scrollIntoView({ behavior: "smooth" });
    } else {
      document.getElementById("tab-journal")?.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// Dice Roller & History
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

document.querySelectorAll(".dice-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sides = parseInt(btn.dataset.sides, 10);
    const roll = Math.floor(Math.random() * sides) + 1;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = roll;
    addDiceHistory(`1d${sides}`, roll);
  });
});

document.getElementById("clearRollBtn")?.addEventListener("click", () => {
  const out = document.getElementById("rollResult");
  if (out) out.textContent = "—";
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0;
    let label = "";
    const type = e.target.dataset.type;

    if (type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (type === "skill") {
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

// Official 5e Class Wiki Dropdown & Starting Equipment Automation
const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const choiceModal = document.getElementById("choiceModal");
const choiceModalTitle = document.getElementById("choiceModalTitle");

async function fetchOfficialClasses() {
  if (allClassesCache.length > 0) return allClassesCache;
  try {
    const res = await fetch("https://www.dnd5eapi.co/api/classes");
    const data = await res.json();
    allClassesCache = data.results || [];
    return allClassesCache;
  } catch (err) {
    console.error("Failed to load classes from API", err);
    return [];
  }
}

async function fetchClassStartingEquipment(classIndex) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/classes/${classIndex}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch class equipment", err);
    return null;
  }
}

function renderClassDropdown(filter = "") {
  if (!classDropdown) return;
  const q = filter.toLowerCase().trim();
  const filtered = allClassesCache.filter(c => c.name.toLowerCase().includes(q));

  let html = filtered
    .map(c => `<div class="class-dropdown-item" data-index="${c.index}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`)
    .join("");

  html += `<div class="class-dropdown-item class-dropdown-custom" id="addCustomClassOption">+ Add Custom Class</div>`;
  classDropdown.innerHTML = html;
}

classInput?.addEventListener("focus", async () => {
  if (allClassesCache.length === 0) {
    await fetchOfficialClasses();
  }
  renderClassDropdown(classInput.value);
  classDropdown?.classList.add("open");
});

classInput?.addEventListener("input", async () => {
  if (allClassesCache.length === 0) {
    await fetchOfficialClasses();
  }
  renderClassDropdown(classInput.value);
  classDropdown?.classList.add("open");
});

classDropdown?.addEventListener("click", async (e) => {
  const item = e.target.closest(".class-dropdown-item");
  if (!item) return;

  if (item.id === "addCustomClassOption") {
    classInput.value = "";
    classInput.placeholder = "Type custom class...";
    classInput.focus();
    classDropdown.classList.remove("open");
    return;
  }

  const className = item.dataset.name;
  const classIdx = item.dataset.index;
  classInput.value = className;
  classDropdown.classList.remove("open");

  recalculateAll();
  saveSheet();

  const details = await fetchClassStartingEquipment(classIdx);
  if (details) {
    applyStartingEquipment(details);
  }
});

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

function applyStartingEquipment(details) {
  let weaponsList = [];
  let gearList = [];
  let featuresText = `Class: ${details.name}\nHit Die: 1d${details.hit_die} per level\n\n`;

  if (details.saving_throws && details.saving_throws.length > 0) {
    featuresText += "Saving Throws: " + details.saving_throws.map(st => st.name).join(", ") + "\n\n";
  }

  if (details.proficiencies && details.proficiencies.length > 0) {
    const profs = details.proficiencies.map(p => p.name).join(", ");
    const profBox = document.getElementById("otherProfs");
    if (profBox && !profBox.value) {
      profBox.value = profs;
    }
  }

  if (details.starting_equipment) {
    details.starting_equipment.forEach(item => {
      const name = item.equipment.name;
      const qty = item.quantity || 1;
      const qtyPrefix = qty > 1 ? `${qty}x ` : "";
      
      if (isWeaponOrArmor(name)) {
        weaponsList.push({ name: `${qtyPrefix}${name}`, atk: "+5", dmg: "1d8", notes: "" });
      } else {
        gearList.push(`${qtyPrefix}${name}`);
      }
    });
  }

  if (details.starting_equipment_options && details.starting_equipment_options.length > 0) {
    processEquipmentOptions(details.starting_equipment_options, 0, weaponsList, gearList, featuresText);
  } else {
    finalizeEquipmentApplication(weaponsList, gearList, featuresText);
  }
}

function processEquipmentOptions(options, index, weaponsList, gearList, featuresText) {
  if (index >= options.length) {
    finalizeEquipmentApplication(weaponsList, gearList, featuresText);
    return;
  }

  const optGroup = options[index];
  let chooseAmount = optGroup.choose || 1;
  choiceModalTitle.textContent = optGroup.desc || `Choose ${chooseAmount} Starting Item(s)`;

  let choicesArray = [];
  if (Array.isArray(optGroup.from)) {
    choicesArray = optGroup.from;
  } else if (optGroup.from && optGroup.from.options) {
    choicesArray = optGroup.from.options;
  } else if (optGroup.from && optGroup.from.equipment_category) {
    choicesArray = [{ equipment_category: optGroup.from.equipment_category }];
  }

  if (choicesArray.length === 0) {
    processEquipmentOptions(options, index + 1, weaponsList, gearList, featuresText);
    return;
  }

  let html = "";
  choicesArray.forEach((choice, choiceIdx) => {
    let label = "Option";
    
    if (choice.option_type === "counted_reference" && choice.of) {
       label = `${choice.count > 1 ? choice.count + "x " : ""}${choice.of.name}`;
       choice.equipment = choice.of; 
       choice.quantity = choice.count;
    } else if (choice.option_type === "choice" && choice.choice) {
       label = `Choose from ${choice.choice.desc}`;
       choice.equipment_category = { name: choice.choice.desc };
    } else if (choice.option_type === "multiple" && choice.items) {
       let names = choice.items.map(i => {
           if (i.option_type === "counted_reference" && i.of) {
             return `${i.count > 1 ? i.count + "x " : ""}${i.of.name}`;
           }
           return "Item";
       }).join(" and ");
       label = names;
       choice.multiple_items = choice.items;
    } else if (choice.equipment) {
       label = `${choice.quantity > 1 ? choice.quantity + "x " : ""}${choice.equipment.name}`;
    } else if (choice.equipment_category) {
       label = `Any ${choice.equipment_category.name}`;
    } else if (choice.item) {
       label = `${choice.count > 1 ? choice.count + "x " : ""}${choice.item.name}`;
       choice.equipment = choice.item;
       choice.quantity = choice.count;
    }

    html += `<button type="button" class="choice-option-btn" data-opt-index="${choiceIdx}">${escapeHtml(label)}</button>`;
  });

  const choiceModalBody = document.getElementById("choiceModalBody");
  choiceModalBody.innerHTML = html;
  choiceModal.classList.add("open");

  const newBody = choiceModalBody.cloneNode(true);
  choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
  const activeModalBody = document.getElementById("choiceModalBody");

  activeModalBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".choice-option-btn");
    if (!btn) return;
    const chosenIdx = parseInt(btn.dataset.optIndex, 10);
    const chosenChoice = choicesArray[chosenIdx];

    let itemsToAdd = [];
    if (chosenChoice.multiple_items) {
       chosenChoice.multiple_items.forEach(i => {
           if (i.of) itemsToAdd.push({ name: i.of.name, qty: i.count || 1 });
           else if (i.item) itemsToAdd.push({ name: i.item.name, qty: i.count || 1 });
       });
    } else if (chosenChoice.equipment) {
       itemsToAdd.push({ name: chosenChoice.equipment.name, qty: chosenChoice.quantity || 1 });
    } else if (chosenChoice.equipment_category) {
       gearList.push(`1x ${chosenChoice.equipment_category.name}`);
    }

    itemsToAdd.forEach(item => {
       const qtyPrefix = item.qty > 1 ? `${item.qty}x ` : "";
       if (isWeaponOrArmor(item.name)) {
         weaponsList.push({ name: `${qtyPrefix}${item.name}`, atk: "+5", dmg: "1d8", notes: "" });
       } else {
         gearList.push(`${qtyPrefix}${item.name}`);
       }
    });

    chooseAmount--;
    if (chooseAmount > 0) {
       btn.style.display = "none"; 
       choiceModalTitle.textContent = `Choose ${chooseAmount} MORE option(s)`;
    } else {
       choiceModal.classList.remove("open");
       processEquipmentOptions(options, index + 1, weaponsList, gearList, featuresText);
    }
  });
}

function finalizeEquipmentApplication(weaponsList, gearList, featuresText) {
  if (weaponsList.length > 0) {
    myCharacterWeapons = weaponsList;
    renderWeapons();
  }

  const invBox = document.getElementById("inventory");
  if (invBox) {
    invBox.value = gearList.join("\n");
    autoExpandTextarea(invBox);
  }

  const featBox = document.getElementById("featuresTraits");
  if (featBox && !featBox.value) {
    featBox.value = featuresText;
    autoExpandTextarea(featBox);
  }

  saveSheet();
  showStatus("Class data & gear loaded!");
  recalculateAll();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".class-pill-wrapper")) {
    classDropdown?.classList.remove("open");
  }
});

function autoExpandTextarea(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// Spells API & Details
async function fetchOfficialSpells() {
  if (allSpellsCache.length > 0) return allSpellsCache;
  try {
    const res = await fetch("https://www.dnd5eapi.co/api/spells");
    const data = await res.json();
    allSpellsCache = data.results || [];
    return allSpellsCache;
  } catch (err) {
    console.error("Failed to load official 5e spell index:", err);
    return [];
  }
}

async function fetchSpellDetails(spellIndex) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/spells/${spellIndex}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to load details for spell:", spellIndex, err);
    return null;
  }
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

  container.innerHTML = matches
    .map(
      (spell) => `
        <div class="spell-option-item" data-index="${spell.index}" data-name="${escapeHtml(spell.name)}">
          <span>${escapeHtml(spell.name)}</span>
          <span class="spell-add-badge">+ Add</span>
        </div>
      `
    )
    .join("");
}

// Render All Spells into 2-Column Grid with In-Place Editing
function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells
    .map((spell, idx) => {
      let typeVal = spell.type;
      if (!typeVal) {
        const levelText = spell.level === 0 ? "Cantrip" : `Level ${spell.level || 1}`;
        const schoolText = spell.school?.name || "";
        typeVal = `${levelText} ${schoolText}`.trim();
      }

      let descVal = spell.desc;
      if (Array.isArray(descVal)) descVal = descVal.join("\n\n");
      if (descVal === undefined || descVal === null) descVal = "";

      const nameVal = spell.name || "New Spell";
      const castVal = spell.casting_time || "1 Action";
      const rangeVal = spell.range || "30 ft";
      const durVal = spell.duration || "Instantaneous";

      return `
        <div class="spell-card" draggable="true" data-index="${idx}">
          <div class="spell-card-header">
            <span class="spell-drag-handle" title="Drag to reorder">⋮⋮</span>
            <input type="text" class="spell-custom-title-input custom-spell-field" data-prop="name" value="${escapeHtml(nameVal)}" placeholder="Spell Name" />
            <button class="spell-card-delete" data-index="${idx}" type="button" title="Remove spell">&times;</button>
          </div>
          <div class="spell-card-meta">
            <div class="meta-field-group">
              <span class="meta-label">Type</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="type" value="${escapeHtml(typeVal)}" placeholder="Cantrip" />
            </div>
            <div class="meta-field-group">
              <span class="meta-label">Cast</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="casting_time" value="${escapeHtml(castVal)}" placeholder="1 Action" />
            </div>
            <div class="meta-field-group">
              <span class="meta-label">Range</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="range" value="${escapeHtml(rangeVal)}" placeholder="30 ft" />
            </div>
            <div class="meta-field-group">
              <span class="meta-label">Duration</span>
              <input type="text" class="spell-meta-input custom-spell-field" data-prop="duration" value="${escapeHtml(durVal)}" placeholder="Instantaneous" />
            </div>
          </div>
          <textarea class="spell-custom-desc-textarea custom-spell-field" data-prop="desc" placeholder="Spell description and effects...">${escapeHtml(descVal)}</textarea>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll(".spell-custom-desc-textarea").forEach((textarea) => {
    autoExpandTextarea(textarea);
  });

  attachSpellDragEvents();
}

function attachSpellDragEvents() {
  const cards = document.querySelectorAll(".spell-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        return;
      }
      draggedSpellIndex = parseInt(card.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedSpellIndex);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
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

function openSpellModal() {
  const modal = document.getElementById("spellModal");
  modal?.classList.add("open");
  const searchInput = document.getElementById("spellSearchInput");
  if (searchInput) {
    searchInput.value = "";
    setTimeout(() => searchInput.focus(), 50);
  }
}

function closeSpellModal() {
  const modal = document.getElementById("spellModal");
  modal?.classList.remove("open");
}

document.getElementById("addSpellBtn")?.addEventListener("click", async () => {
  openSpellModal();
  const list = document.getElementById("spellApiList");
  if (list && allSpellsCache.length === 0) {
    list.innerHTML = `<p class="loading-text">Loading official 5e spells...</p>`;
    await fetchOfficialSpells();
  }
  renderModalSpells();
});

document.getElementById("closeSpellModal")?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeSpellModal();
});

document.getElementById("spellModal")?.addEventListener("click", (e) => {
  if (e.target.id === "spellModal") {
    closeSpellModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSpellModal();
    document.getElementById("loadModal")?.classList.remove("open");
    document.getElementById("helpModal")?.classList.remove("open");
    document.getElementById("choiceModal")?.classList.remove("open");
  }
});

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

// Quick in-sheet spellbook search
document.getElementById("filterSpellbookInput")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll(".spell-card").forEach((card) => {
    const title = card.querySelector(".spell-custom-title-input")?.value.toLowerCase() || "";
    const desc = card.querySelector(".spell-custom-desc-textarea")?.value.toLowerCase() || "";
    const type = card.querySelector(".spell-meta-input[data-prop='type']")?.value.toLowerCase() || "";
    if (!q || title.includes(q) || desc.includes(q) || type.includes(q)) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
});

// Add Custom Spell Button
document.getElementById("addCustomSpellBtn")?.addEventListener("click", () => {
  myCharacterSpells.push({
    name: "New Custom Spell",
    type: "1st Level",
    casting_time: "1 Action",
    range: "30 ft",
    duration: "Instantaneous",
    desc: ""
  });
  saveSheet();
  renderMySpells();
  closeSpellModal();
});

// Click Official 5e Spell to Add
document.getElementById("spellApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".spell-option-item");
  if (!row) return;

  const spellIndex = row.dataset.index;
  const spellName = row.dataset.name;

  if (myCharacterSpells.some((s) => s.name.toLowerCase() === spellName.toLowerCase())) {
    closeSpellModal();
    return;
  }

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  const details = await fetchSpellDetails(spellIndex);
  if (details) {
    let summary = "";
    if (Array.isArray(details.desc)) summary = details.desc.join("\n\n");
    else if (typeof details.desc === "string") summary = details.desc;

    const levelText = details.level === 0 ? "Cantrip" : `Level ${details.level}`;
    const schoolText = details.school?.name || "";

    myCharacterSpells.push({
      name: details.name || spellName,
      type: `${levelText} ${schoolText}`.trim(),
      casting_time: details.casting_time || "1 Action",
      range: details.range || "Self",
      duration: details.duration || "Instantaneous",
      desc: summary || ""
    });

    saveSheet();
    renderMySpells();
  }

  closeSpellModal();
  if (badge) badge.textContent = "+ Add";
});

// Live Edit Spell Fields & Auto-Expanding Description
document.getElementById("spellsList")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    const idx = parseInt(card.dataset.index, 10);
    const prop = e.target.dataset.prop;

    if (myCharacterSpells[idx]) {
      myCharacterSpells[idx][prop] = e.target.value;
      saveSheet();
    }

    if (e.target.tagName.toLowerCase() === "textarea") {
      autoExpandTextarea(e.target);
    }
  }
});

// Delete Individual Spell
document.getElementById("spellsList")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("spell-card-delete")) {
    const index = parseInt(e.target.dataset.index, 10);
    myCharacterSpells.splice(index, 1);
    saveSheet();
    renderMySpells();
  }
});

// Header Actions
document.getElementById("saveBtn")?.addEventListener("click", () => {
  saveSheet();
});

document.getElementById("newBtn")?.addEventListener("click", () => {
  if (confirm("Create a new blank character sheet?")) {
    resetSheet();
  }
});

document.getElementById("deleteBtn")?.addEventListener("click", () => {
  const roster = getRoster();
  const currentName = roster[activeCharId]?.name || "Unnamed Character";
  if (confirm(`Permanently delete current character "${currentName}"?`)) {
    delete roster[activeCharId];
    saveRoster(roster);
    const remaining = Object.keys(roster);
    if (remaining.length > 0) {
      activeCharId = remaining[0];
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
    name: document.getElementById("charName")?.value || "Character",
    fields: getCurrentSheetData(),
    spells: myCharacterSpells,
    weapons: myCharacterWeapons
  };

  const fullBackup = {
    character: currentChar,
    allRoster: roster,
    version: 2
  };

  const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const charName = currentChar.name.trim() || "character";
  a.href = url;
  a.download = `${charName.toLowerCase().replace(/\s+/g, "_")}-backup.json`;
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

      if (parsed.allRoster) {
        Object.assign(roster, parsed.allRoster);
      } else if (parsed.character) {
        const id = parsed.character.id || "char_" + Date.now();
        roster[id] = parsed.character;
        activeCharId = id;
      } else if (parsed.sheet) {
        const id = "char_" + Date.now();
        roster[id] = {
          id: id,
          name: parsed.sheet.charName || "Restored Hero",
          fields: parsed.sheet,
          spells: parsed.spells || [],
          weapons: parsed.weapons || []
        };
        activeCharId = id;
      }

      saveRoster(roster);
      localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
      loadSheet();
      showStatus("Restored successfully!");
    } catch (err) {
      alert("Invalid JSON backup file.");
    }
  };
  reader.readAsText(file);
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
  if (e.target.classList.contains("spell-stat-input")) {
    autoResizeStatInput(e.target);
  }
});

loadSheet();
