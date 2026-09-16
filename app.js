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

// Official 5e SRD Fallback Spells - Loaded immediately with zero wait
const SRD_SPELLS_LIBRARY = [
  { name: "Fire Bolt", level: 0, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage." },
  { name: "Mage Hand", level: 0, school: "Conjuration", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "A spectral, floating hand appears at a point you choose within range. You can use your action to control the hand to manipulate objects up to 10 pounds." },
  { name: "Eldritch Blast", level: 0, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage." },
  { name: "Vicious Mockery", level: 0, school: "Enchantment", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "You unleash a string of insults laced with subtle enchantments at one creature you can see. If it fails a Wisdom saving throw, it takes 1d4 psychic damage and has disadvantage on its next attack." },
  { name: "Prestidigitation", level: 0, school: "Transmutation", casting_time: "1 Action", range: "10 ft", duration: "Up to 1 hour", desc: "This spell is a minor magical trick that novice spellcasters use for practice. Create harmless sensory effects, light or snuff candles, or clean/soil objects." },
  { name: "Sacred Flame", level: 0, school: "Evocation", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage." },
  { name: "Minor Illusion", level: 0, school: "Illusion", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "You create a sound or an image of an object within range that lasts for the duration. The illusion ends if you dismiss it or cast this spell again." },
  { name: "Ray of Frost", level: 0, school: "Evocation", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "A frigid beam of blue-white light streaks toward a creature within range. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn." },
  { name: "Magic Missile", level: 1, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range, dealing 1d4 + 1 force damage to its target. The darts all strike simultaneously." },
  { name: "Shield", level: 1, school: "Abjuration", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile." },
  { name: "Cure Wounds", level: 1, school: "Evocation", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs." },
  { name: "Healing Word", level: 1, school: "Evocation", casting_time: "1 Bonus Action", range: "60 ft", duration: "Instantaneous", desc: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs." },
  { name: "Thunderwave", level: 1, school: "Evocation", casting_time: "1 Action", range: "Self (15-foot cube)", duration: "Instantaneous", desc: "A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw or take 2d8 thunder damage and be pushed 10 feet away." },
  { name: "Guiding Bolt", level: 1, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "1 round", desc: "A flash of light streaks toward a creature of your choice within range. On a hit, the target takes 4d6 radiant damage, and the next attack roll made against this target before the end of your next turn has advantage." },
  { name: "Misty Step", level: 2, school: "Conjuration", casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see." },
  { name: "Invisibility", level: 2, school: "Illusion", casting_time: "1 Action", range: "Touch", duration: "Concentration, up to 1 hour", desc: "A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target's person. The spell ends if the target attacks or casts a spell." },
  { name: "Hold Person", level: 2, school: "Enchantment", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration." },
  { name: "Fireball", level: 3, school: "Evocation", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A bright streak flashes from your pointing finger to a point you choose within range and blossoms into an explosion of flame. Each creature in a 20-foot-radius sphere must make a Dex save, taking 8d6 fire damage on a failure, or half on a success." },
  { name: "Counterspell", level: 3, school: "Abjuration", casting_time: "1 Reaction", range: "60 ft", duration: "Instantaneous", desc: "You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect." },
  { name: "Haste", level: 3, school: "Transmutation", casting_time: "1 Action", range: "30 ft", duration: "Concentration, up to 1 minute", desc: "Choose a willing creature within range. Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, advantage on Dex saving throws, and an additional action on each of its turns." }
];

// Official 5e SRD Fallback Traits & Features - Loaded immediately with zero wait
const SRD_TRAITS_LIBRARY = [
  { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray." },
  { name: "Fey Ancestry", type: "Racial", desc: "You have advantage on saving throws against being charmed, and magic cannot put you to sleep." },
  { name: "Dwarven Resilience", type: "Racial", desc: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
  { name: "Lucky", type: "Racial", desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
  { name: "Relentless Endurance", type: "Racial", desc: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest." },
  { name: "Savage Attacks", type: "Racial", desc: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage." },
  { name: "Breath Weapon", type: "Racial", desc: "You can use your action to exhale destructive energy determined by your draconic ancestry. Each creature in the area must make a saving throw based on your dragon type." },
  { name: "Hellish Resistance", type: "Racial", desc: "You have resistance to fire damage." },
  { name: "Gnome Cunning", type: "Racial", desc: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." },
  { name: "Rage", type: "Class Ability", desc: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action, gaining advantage on Strength checks, bonus melee damage, and resistance to bludgeoning, piercing, and slashing damage." },
  { name: "Reckless Attack", type: "Class Ability", desc: "Starting at 2nd level, you can throw aside all concern for defense. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn." },
  { name: "Action Surge", type: "Class Ability", desc: "On your turn, you can push yourself beyond your normal limits for a moment. You can take one additional action on top of your regular action and a possible bonus action." },
  { name: "Second Wind", type: "Class Ability", desc: "You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level." },
  { name: "Sneak Attack", type: "Class Ability", desc: "Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll." },
  { name: "Cunning Action", type: "Class Ability", desc: "Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide." },
  { name: "Divine Smite", type: "Class Ability", desc: "Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon's damage (2d8 for a 1st-level slot + 1d8 each higher level)." },
  { name: "Lay on Hands", type: "Class Ability", desc: "Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level x 5." },
  { name: "Wild Shape", type: "Class Ability", desc: "Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before twice per short or long rest." },
  { name: "Bardic Inspiration", type: "Class Ability", desc: "You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet. Once within the next 10 minutes, the creature can add a d6 to one ability check, attack roll, or saving throw." },
  { name: "Channel Divinity", type: "Class Ability", desc: "You gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects specific to your sacred domain." },
  { name: "Flurry of Blows", type: "Class Ability", desc: "Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action." },
  { name: "Pact Magic", type: "Class Ability", desc: "Your arcane research and the magic bestowed on you by your patron have given you facility with spells. Your spell slots are always cast at your highest available slot level and recover on a short rest." },
  { name: "Arcane Recovery", type: "Class Ability", desc: "Once per day when you finish a short rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your wizard level (rounded up)." },
  { name: "Alert", type: "Feat", desc: "Always on the lookout for danger. You gain a +5 bonus to initiative and you cannot be surprised while you are conscious. Other creatures don't gain advantage on attack rolls against you as a result of being unseen by you." },
  { name: "War Caster", type: "Feat", desc: "You have advantage on Constitution saving throws that you make to maintain your concentration on a spell when you take damage. You can perform the somatic components of spells even when you have weapons or a shield in one or both hands." },
  { name: "Sharpshooter", type: "Feat", desc: "Attacking at long range doesn't impose disadvantage on your ranged weapon attack rolls. Your ranged weapon attacks ignore half cover and three-quarters cover. You can choose to take a -5 penalty to the attack roll to add +10 to the damage." }
];

let allSpellsCache = [...SRD_SPELLS_LIBRARY];
let allTraitsCache = [...SRD_TRAITS_LIBRARY];
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

// Dropdowns & D&D 5e API Fetching
const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const raceInput = document.getElementById("charRace");
const raceDropdown = document.getElementById("raceDropdown");
const choiceModal = document.getElementById("choiceModal");
const choiceModalBody = document.getElementById("choiceModalBody");
const choiceModalTitle = document.getElementById("choiceModalTitle");

let activeClassLoadout = null;

function isWeaponOrArmor(name) {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.includes("sword") || l.includes("bow") || l.includes("dagger") || l.includes("axe") || 
         l.includes("mace") || l.includes("crossbow") || l.includes("staff") || l.includes("hammer") || 
         l.includes("spear") || l.includes("shield") || l.includes("armor") || l.includes("mail") || 
         l.includes("javelin") || l.includes("glaive") || l.includes("halberd") || l.includes("rapier") || 
         l.includes("club") || l.includes("sickle") || l.includes("dart");
}

function openClassEquipmentModal(classKey, displayName) {
  const data = SRD_CLASS_EQUIPMENT[classKey];
  if (!data) return;

  activeClassLoadout = JSON.parse(JSON.stringify(data));
  activeClassLoadout.selectedChoices = [];

  choiceModalTitle.textContent = `${displayName} Starting Loadout`;

  let html = `<div class="equip-section-title">Granted Equipment</div>`;
  if (activeClassLoadout.fixed.length > 0) {
    html += `<ul class="equip-fixed-list">`;
    activeClassLoadout.fixed.forEach(i => {
      html += `<li>${i.qty > 1 ? i.qty + 'x ' : ''}${escapeHtml(i.name)}</li>`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color:#64748b; font-size:0.9rem;">None</p>`;
  }

  activeClassLoadout.choices.forEach((choiceGroup, gIdx) => {
    html += `
      <div class="equip-choice-group" id="choice-group-${gIdx}">
        <div class="equip-choice-title">${escapeHtml(choiceGroup.desc)} (Choose ${choiceGroup.choose})</div>
        <div class="equip-options-grid">
    `;

    choiceGroup.options.forEach((opt, oIdx) => {
      const tooltipLines = opt.items.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.name}${i.desc ? ' (' + i.desc + ')' : ''}`).join('\n');
      html += `
        <div class="choice-option-wrapper">
          <button type="button" class="choice-option-btn" data-group="${gIdx}" data-option="${oIdx}">
            ${escapeHtml(opt.label)}
          </button>
          <div class="choice-tooltip">${escapeHtml(tooltipLines).replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += `<button type="button" id="confirmLoadoutBtn" class="btn red confirm-loadout-btn">Confirm Loadout</button>`;

  choiceModalBody.innerHTML = html;
  choiceModal.classList.add("open");

  const newBody = choiceModalBody.cloneNode(true);
  choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
  const activeModalBody = document.getElementById("choiceModalBody");

  activeModalBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".choice-option-btn");
    if (btn) {
      const gIdx = parseInt(btn.dataset.group, 10);
      const oIdx = parseInt(btn.dataset.option, 10);
      const groupEl = document.getElementById(`choice-group-${gIdx}`);

      groupEl.querySelectorAll(".choice-option-btn").forEach(b => {
        b.style.borderColor = "#3b4c68";
        b.style.backgroundColor = "#151d2f";
      });

      btn.style.borderColor = "#dc2626";
      btn.style.backgroundColor = "#3f0f0f";

      activeClassLoadout.selectedChoices[gIdx] = oIdx;
    }

    if (e.target.id === "confirmLoadoutBtn") {
      finalizeSelectedLoadout();
    }
  });
}

function finalizeSelectedLoadout() {
  if (!activeClassLoadout) return;

  let weaponsList = [];
  let gearList = [];

  activeClassLoadout.fixed.forEach(i => {
    const q = i.qty > 1 ? `${i.qty}x ` : "";
    if (isWeaponOrArmor(i.name)) weaponsList.push({ name: `${q}${i.name}`, atk: "+5", dmg: "1d8", notes: "" });
    else gearList.push(`${q}${i.name}`);
  });

  activeClassLoadout.choices.forEach((group, gIdx) => {
    const chosenOIdx = activeClassLoadout.selectedChoices[gIdx] ?? 0;
    const chosenOpt = group.options[chosenOIdx];
    if (chosenOpt) {
      chosenOpt.items.forEach(i => {
        const q = i.qty > 1 ? `${i.qty}x ` : "";
        if (isWeaponOrArmor(i.name)) weaponsList.push({ name: `${q}${i.name}`, atk: "+5", dmg: "1d8", notes: i.desc || "" });
        else gearList.push(`${q}${i.name}`);
      });
    }
  });

  while (weaponsList.length < 2) {
    weaponsList.push({ name: "", atk: "", dmg: "", notes: "" });
  }

  myCharacterWeapons = weaponsList;
  renderWeapons();

  const invBox = document.getElementById("inventory");
  if (invBox && gearList.length > 0) {
    invBox.value = gearList.join("\n");
    autoExpandTextarea(invBox);
  }

  let featText = `Hit Die: 1d${activeClassLoadout.hitDie} per level\n\nSaving Throws: ${activeClassLoadout.saves.join(", ")}\n\n`;
  const featBox = document.getElementById("featuresTraits");
  if (featBox) {
    const cur = featBox.value.trim();
    featBox.value = cur ? cur + "\n\n" + featText.trim() : featText.trim();
    autoExpandTextarea(featBox);
  }

  const profBox = document.getElementById("otherProfs");
  if (profBox && activeClassLoadout.proficiencies.length > 0) {
    profBox.value = activeClassLoadout.proficiencies.join(", ");
    autoExpandTextarea(profBox);
  }

  saveSheet();
  recalculateAll();
  choiceModal.classList.remove("open");
  showStatus("Class Loadout applied!");
}

function renderDropdown(dropdownEl, items, filter = "", customId, customText) {
  if (!dropdownEl) return;
  const q = filter.toLowerCase().trim();
  const filtered = items.filter(i => i.name.toLowerCase().includes(q));
  let html = filtered.map(i => `<div class="dropdown-item" data-index="${i.index}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}</div>`).join("");
  html += `<div class="dropdown-item dropdown-custom" id="${customId}">${customText}</div>`;
  dropdownEl.innerHTML = html;
}

classInput?.addEventListener("click", () => {
  if (!classDropdown.classList.contains("open")) {
    if (allClassesCache.length === 0) {
      allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
    }
    renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
    classDropdown.classList.add("open");
  }
});

classInput?.addEventListener("input", () => {
  if (allClassesCache.length === 0) {
    allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
  }
  renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  classDropdown.classList.add("open");
});

raceInput?.addEventListener("click", () => {
  if (!raceDropdown.classList.contains("open")) {
    if (allRacesCache.length === 0) {
      allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
    }
    renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
    raceDropdown.classList.add("open");
  }
});

raceInput?.addEventListener("input", () => {
  if (allRacesCache.length === 0) {
    allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
  }
  renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
  raceDropdown.classList.add("open");
});

classDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.id === "addCustomClassOption") {
    classInput.value = "";
    classInput.focus();
    classDropdown.classList.remove("open");
    return;
  }

  const className = item.dataset.name;
  const classIdx = item.dataset.index.toLowerCase();
  classInput.value = className;
  classDropdown.classList.remove("open");
  saveSheet();

  openClassEquipmentModal(classIdx, className);
});

raceDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.id === "addCustomRaceOption") {
    raceInput.value = "";
    raceInput.focus();
    raceDropdown.classList.remove("open");
    return;
  }

  const raceName = item.dataset.name;
  const raceIdx = item.dataset.index.toLowerCase();
  raceInput.value = raceName;
  raceDropdown.classList.remove("open");
  saveSheet();

  const raceInfo = SRD_RACE_DATA[raceIdx];
  if (raceInfo) {
    if (raceInfo.speed) document.getElementById("charSpeed").value = raceInfo.speed;
    
    if (raceInfo.traits && raceInfo.traits.length > 0) {
      raceInfo.traits.forEach(t => {
        if (!myCharacterTraits.some(existing => existing.name.toLowerCase() === t.name.toLowerCase())) {
          myCharacterTraits.push({ name: t.name, type: t.type || "Racial", desc: t.desc || "", isExpanded: false });
        }
      });
      renderMyTraits();
    }

    saveSheet();
    showStatus("Racial abilities loaded!");
  }
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

// 4-Column Abilities & Features Implementation
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

// Trait / Ability Search Modal
function renderModalTraits(filterText = "") {
  const container = document.getElementById("traitApiList");
  if (!container) return;
  const q = filterText.toLowerCase().trim();
  const matches = allTraitsCache.filter(t => t.name.toLowerCase().includes(q));

  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching features found.</p>`;
    return;
  }

  container.innerHTML = matches.map((trait, idx) => `
    <div class="spell-option-item trait-option-item" data-idx="${idx}">
      <div>
        <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</span>
        <span style="font-size: 0.75rem; color: #34d399; margin-left: 0.5rem; text-transform: uppercase;">${escapeHtml(trait.type)}</span>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `).join("");
}

document.getElementById("addTraitBtn")?.addEventListener("click", () => {
  const modal = document.getElementById("traitModal");
  modal?.classList.add("open");
  renderModalTraits(document.getElementById("traitSearchInput")?.value || "");
});

document.getElementById("closeTraitModal")?.addEventListener("click", () => {
  document.getElementById("traitModal")?.classList.remove("open");
});

document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  renderModalTraits(e.target.value);
});

// Add Custom Trait: create an identical box without any text at all
document.getElementById("addCustomTraitBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  myCharacterTraits.push({
    name: "",
    type: "",
    desc: "",
    isExpanded: true
  });
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

document.getElementById("traitApiList")?.addEventListener("click", (e) => {
  const row = e.target.closest(".trait-option-item");
  if (!row) return;

  const idx = parseInt(row.dataset.idx, 10);
  const selected = allTraitsCache[idx];
  if (!selected) return;

  myCharacterTraits.push({
    name: selected.name,
    type: selected.type || "Feature",
    desc: selected.desc || "",
    isExpanded: false
  });

  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
});

// Official Spells Implementation
function renderModalSpells(filterText = "") {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  const query = filterText.toLowerCase().trim();
  const matches = allSpellsCache.filter((s) => s.name.toLowerCase().includes(query));

  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = matches.map((spell, idx) => `
    <div class="spell-option-item" data-idx="${idx}">
      <div>
        <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</span>
        <span style="font-size: 0.75rem; color: #f87171; margin-left: 0.5rem;">${spell.level === 0 ? "Cantrip" : "Level " + spell.level} ${spell.school || ""}</span>
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
    let typeVal = spell.type || (spell.level !== undefined ? (spell.level === 0 ? "Cantrip" : `Level ${spell.level} ${spell.school || ""}`.trim()) : "");
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

document.getElementById("addSpellBtn")?.addEventListener("click", () => {
  const modal = document.getElementById("spellModal");
  modal?.classList.add("open");
  renderModalSpells(document.getElementById("spellSearchInput")?.value || "");
});

document.getElementById("closeSpellModal")?.addEventListener("click", () => {
  document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

// Add Custom Spell: create an identical box without any text at all
document.getElementById("addCustomSpellBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  myCharacterSpells.push({
    name: "",
    type: "",
    casting_time: "",
    range: "",
    duration: "",
    desc: ""
  });
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
  const row = e.target.closest(".spell-option-item");
  if (!row) return;

  const idx = parseInt(row.dataset.idx, 10);
  const details = allSpellsCache[idx];
  if (!details) return;

  myCharacterSpells.push({
    name: details.name,
    type: details.type || (details.level === 0 ? "Cantrip" : `Level ${details.level} ${details.school || ""}`.trim()),
    casting_time: details.casting_time || "1 Action",
    range: details.range || "30 ft",
    duration: details.duration || "Instantaneous",
    desc: Array.isArray(details.desc) ? details.desc.join("\n\n") : (details.desc || "")
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

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
});

// Initialize sheet and abilities
loadSheet();
renderMyTraits();
