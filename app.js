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

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

// Official 5e SRD Fallback Database to ensure instant pop-up without API stalls
const SRD_CLASS_EQUIPMENT = {
  barbarian: {
    name: "Barbarian", hitDie: 12, saves: ["Strength", "Constitution"],
    proficiencies: ["Light armor", "Medium armor", "Shields", "Simple weapons", "Martial weapons"],
    fixed: [{ name: "Explorer's Pack", qty: 1 }, { name: "Javelin", qty: 4 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "A Greataxe", items: [{ name: "Greataxe", qty: 1, desc: "1d12 slashing, heavy, two-handed" }] },
        { label: "Any Martial Melee Weapon", items: [{ name: "Longsword", qty: 1, desc: "1d8 slashing, versatile (1d10)" }] }
      ]},
      { desc: "Choose your secondary weapons", choose: 1, options: [
        { label: "Two Handaxes", items: [{ name: "Handaxe", qty: 2, desc: "1d6 slashing, light, thrown (20/60)" }] },
        { label: "Any Simple Weapon", items: [{ name: "Shortbow & 20 Arrows", qty: 1, desc: "1d6 piercing, two-handed, range 80/320" }] }
      ]}
    ]
  },
  bard: {
    name: "Bard", hitDie: 8, saves: ["Dexterity", "Charisma"],
    proficiencies: ["Light armor", "Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords", "Three musical instruments"],
    fixed: [{ name: "Leather Armor", qty: 1 }, { name: "Dagger", qty: 1 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "A Rapier", items: [{ name: "Rapier", qty: 1, desc: "1d8 piercing, finesse" }] },
        { label: "A Longsword", items: [{ name: "Longsword", qty: 1, desc: "1d8 slashing, versatile (1d10)" }] },
        { label: "Any Simple Weapon", items: [{ name: "Dagger", qty: 1, desc: "1d4 piercing, finesse, light, thrown" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Diplomat's Pack", items: [{ name: "Diplomat's Pack", qty: 1, desc: "Chest, fine clothes, ink, pen, lamp, oil, rations" }] },
        { label: "Entertainer's Pack", items: [{ name: "Entertainer's Pack", qty: 1, desc: "Backpack, bedroll, costumes, candles, rations, waterskin" }] }
      ]},
      { desc: "Choose your musical instrument", choose: 1, options: [
        { label: "A Lute", items: [{ name: "Lute", qty: 1, desc: "Musical instrument" }] },
        { label: "Any Musical Instrument", items: [{ name: "Flute", qty: 1, desc: "Musical instrument" }] }
      ]}
    ]
  },
  cleric: {
    name: "Cleric", hitDie: 8, saves: ["Wisdom", "Charisma"],
    proficiencies: ["Light armor", "Medium armor", "Shields", "Simple weapons"],
    fixed: [{ name: "Shield", qty: 1 }, { name: "Holy Symbol", qty: 1 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "A Mace", items: [{ name: "Mace", qty: 1, desc: "1d6 bludgeoning" }] },
        { label: "A Warhammer (if proficient)", items: [{ name: "Warhammer", qty: 1, desc: "1d8 bludgeoning, versatile (1d10)" }] }
      ]},
      { desc: "Choose your armor", choose: 1, options: [
        { label: "Scale Mail", items: [{ name: "Scale Mail", qty: 1, desc: "AC 14 + Dex mod (max 2), Disadv on Stealth" }] },
        { label: "Leather Armor", items: [{ name: "Leather Armor", qty: 1, desc: "AC 11 + Dex mod" }] },
        { label: "Chain Mail (if proficient)", items: [{ name: "Chain Mail", qty: 1, desc: "AC 16, Str 13 req, Disadv on Stealth" }] }
      ]},
      { desc: "Choose your ranged weapon", choose: 1, options: [
        { label: "Light Crossbow & 20 Bolts", items: [{ name: "Light Crossbow", qty: 1, desc: "1d8 piercing, range 80/320, loading" }, { name: "Crossbow Bolts", qty: 20, desc: "Ammunition" }] },
        { label: "Any Simple Weapon", items: [{ name: "Javelin", qty: 2, desc: "1d6 piercing, thrown (30/120)" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Priest's Pack", items: [{ name: "Priest's Pack", qty: 1, desc: "Backpack, blanket, candles, alms box, censer, vestments" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  druid: {
    name: "Druid", hitDie: 8, saves: ["Intelligence", "Wisdom"],
    proficiencies: ["Light armor (non-metal)", "Medium armor (non-metal)", "Shields (non-metal)", "Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears", "Herbalism kit"],
    fixed: [{ name: "Leather Armor", qty: 1 }, { name: "Explorer's Pack", qty: 1 }, { name: "Druidic Focus", qty: 1 }],
    choices: [
      { desc: "Choose your shield or weapon", choose: 1, options: [
        { label: "A Wooden Shield", items: [{ name: "Wooden Shield", qty: 1, desc: "+2 Armor Class" }] },
        { label: "Any Simple Weapon", items: [{ name: "Quarterstaff", qty: 1, desc: "1d6 bludgeoning, versatile (1d8)" }] }
      ]},
      { desc: "Choose your primary melee weapon", choose: 1, options: [
        { label: "A Scimitar", items: [{ name: "Scimitar", qty: 1, desc: "1d6 slashing, finesse, light" }] },
        { label: "Any Simple Melee Weapon", items: [{ name: "Spear", qty: 1, desc: "1d6 piercing, thrown (20/60), versatile (1d8)" }] }
      ]}
    ]
  },
  fighter: {
    name: "Fighter", hitDie: 10, saves: ["Strength", "Constitution"],
    proficiencies: ["All armor", "Shields", "Simple weapons", "Martial weapons"],
    fixed: [],
    choices: [
      { desc: "Choose your armor", choose: 1, options: [
        { label: "Chain Mail", items: [{ name: "Chain Mail", qty: 1, desc: "AC 16, Str 13 req, Disadv on Stealth" }] },
        { label: "Leather Armor & Longbow (20 Arrows)", items: [{ name: "Leather Armor", qty: 1, desc: "AC 11 + Dex mod" }, { name: "Longbow", qty: 1, desc: "1d8 piercing, heavy, two-handed, 150/600" }, { name: "Arrows", qty: 20, desc: "Ammunition" }] }
      ]},
      { desc: "Choose your weapon setup", choose: 1, options: [
        { label: "A Martial Weapon & Shield", items: [{ name: "Longsword", qty: 1, desc: "1d8 slashing, versatile (1d10)" }, { name: "Shield", qty: 1, desc: "+2 Armor Class" }] },
        { label: "Two Martial Weapons", items: [{ name: "Greatsword", qty: 1, desc: "2d6 slashing, heavy, two-handed" }, { name: "Shortsword", qty: 1, desc: "1d6 piercing, finesse, light" }] }
      ]},
      { desc: "Choose secondary ranged", choose: 1, options: [
        { label: "Light Crossbow & 20 Bolts", items: [{ name: "Light Crossbow", qty: 1, desc: "1d8 piercing, range 80/320, loading" }, { name: "Crossbow Bolts", qty: 20, desc: "Ammunition" }] },
        { label: "Two Handaxes", items: [{ name: "Handaxe", qty: 2, desc: "1d6 slashing, light, thrown (20/60)" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  monk: {
    name: "Monk", hitDie: 8, saves: ["Strength", "Dexterity"],
    proficiencies: ["Simple weapons", "Shortswords", "One type of artisan's tools or musical instrument"],
    fixed: [{ name: "Dart", qty: 10 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "A Shortsword", items: [{ name: "Shortsword", qty: 1, desc: "1d6 piercing, finesse, light" }] },
        { label: "Any Simple Weapon", items: [{ name: "Quarterstaff", qty: 1, desc: "1d6 bludgeoning, versatile (1d8)" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  paladin: {
    name: "Paladin", hitDie: 10, saves: ["Wisdom", "Charisma"],
    proficiencies: ["All armor", "Shields", "Simple weapons", "Martial weapons"],
    fixed: [{ name: "Chain Mail", qty: 1 }, { name: "Holy Symbol", qty: 1 }],
    choices: [
      { desc: "Choose your weapons", choose: 1, options: [
        { label: "A Martial Weapon & Shield", items: [{ name: "Longsword", qty: 1, desc: "1d8 slashing, versatile (1d10)" }, { name: "Shield", qty: 1, desc: "+2 Armor Class" }] },
        { label: "Two Martial Weapons", items: [{ name: "Greatsword", qty: 1, desc: "2d6 slashing, heavy, two-handed" }, { name: "Warhammer", qty: 1, desc: "1d8 bludgeoning, versatile (1d10)" }] }
      ]},
      { desc: "Choose secondary weapons", choose: 1, options: [
        { label: "Five Javelins", items: [{ name: "Javelin", qty: 5, desc: "1d6 piercing, thrown (30/120)" }] },
        { label: "Any Simple Melee Weapon", items: [{ name: "Mace", qty: 1, desc: "1d6 bludgeoning" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Priest's Pack", items: [{ name: "Priest's Pack", qty: 1, desc: "Backpack, blanket, candles, tinderbox, alms box, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  ranger: {
    name: "Ranger", hitDie: 10, saves: ["Strength", "Dexterity"],
    proficiencies: ["Light armor", "Medium armor", "Shields", "Simple weapons", "Martial weapons"],
    fixed: [{ name: "Longbow", qty: 1 }, { name: "Quiver & 20 Arrows", qty: 1 }],
    choices: [
      { desc: "Choose your armor", choose: 1, options: [
        { label: "Scale Mail", items: [{ name: "Scale Mail", qty: 1, desc: "AC 14 + Dex mod (max 2), Disadv on Stealth" }] },
        { label: "Leather Armor", items: [{ name: "Leather Armor", qty: 1, desc: "AC 11 + Dex mod" }] }
      ]},
      { desc: "Choose your melee setup", choose: 1, options: [
        { label: "Two Shortswords", items: [{ name: "Shortsword", qty: 2, desc: "1d6 piercing, finesse, light" }] },
        { label: "Two Simple Melee Weapons", items: [{ name: "Handaxe", qty: 2, desc: "1d6 slashing, light, thrown (20/60)" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  rogue: {
    name: "Rogue", hitDie: 8, saves: ["Dexterity", "Intelligence"],
    proficiencies: ["Light armor", "Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords", "Thieves' tools"],
    fixed: [{ name: "Leather Armor", qty: 1 }, { name: "Dagger", qty: 2 }, { name: "Thieves' Tools", qty: 1 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "A Rapier", items: [{ name: "Rapier", qty: 1, desc: "1d8 piercing, finesse" }] },
        { label: "A Shortsword", items: [{ name: "Shortsword", qty: 1, desc: "1d6 piercing, finesse, light" }] }
      ]},
      { desc: "Choose secondary ranged", choose: 1, options: [
        { label: "Shortbow & 20 Arrows", items: [{ name: "Shortbow", qty: 1, desc: "1d6 piercing, two-handed, range 80/320" }, { name: "Arrows", qty: 20, desc: "Ammunition" }] },
        { label: "A Shortsword", items: [{ name: "Shortsword", qty: 1, desc: "1d6 piercing, finesse, light" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Burglar's Pack", items: [{ name: "Burglar's Pack", qty: 1, desc: "Backpack, ball bearings, string, bell, candles, crowbar" }] },
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  sorcerer: {
    name: "Sorcerer", hitDie: 6, saves: ["Constitution", "Charisma"],
    proficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    fixed: [{ name: "Dagger", qty: 2 }],
    choices: [
      { desc: "Choose secondary weapon", choose: 1, options: [
        { label: "Light Crossbow & 20 Bolts", items: [{ name: "Light Crossbow", qty: 1, desc: "1d8 piercing, range 80/320, loading" }, { name: "Crossbow Bolts", qty: 20, desc: "Ammunition" }] },
        { label: "Any Simple Weapon", items: [{ name: "Quarterstaff", qty: 1, desc: "1d6 bludgeoning, versatile (1d8)" }] }
      ]},
      { desc: "Choose your spell focus", choose: 1, options: [
        { label: "Component Pouch", items: [{ name: "Component Pouch", qty: 1, desc: "Basic spellcasting focus" }] },
        { label: "Arcane Focus", items: [{ name: "Arcane Focus (Wand)", qty: 1, desc: "Arcane spellcasting focus" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  },
  warlock: {
    name: "Warlock", hitDie: 8, saves: ["Wisdom", "Charisma"],
    proficiencies: ["Light armor", "Simple weapons"],
    fixed: [{ name: "Leather Armor", qty: 1 }, { name: "Dagger", qty: 2 }],
    choices: [
      { desc: "Choose your primary weapon", choose: 1, options: [
        { label: "Light Crossbow & 20 Bolts", items: [{ name: "Light Crossbow", qty: 1, desc: "1d8 piercing, range 80/320, loading" }, { name: "Crossbow Bolts", qty: 20, desc: "Ammunition" }] },
        { label: "Any Simple Weapon", items: [{ name: "Quarterstaff", qty: 1, desc: "1d6 bludgeoning, versatile (1d8)" }] }
      ]},
      { desc: "Choose your spell focus", choose: 1, options: [
        { label: "Component Pouch", items: [{ name: "Component Pouch", qty: 1, desc: "Basic spellcasting focus" }] },
        { label: "Arcane Focus", items: [{ name: "Arcane Focus (Orb)", qty: 1, desc: "Arcane spellcasting focus" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Scholar's Pack", items: [{ name: "Scholar's Pack", qty: 1, desc: "Backpack, book of lore, ink, pen, parchment, sand" }] },
        { label: "Dungeoneer's Pack", items: [{ name: "Dungeoneer's Pack", qty: 1, desc: "Backpack, crowbar, hammer, pitons, torches, rations" }] }
      ]}
    ]
  },
  wizard: {
    name: "Wizard", hitDie: 6, saves: ["Intelligence", "Wisdom"],
    proficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    fixed: [{ name: "Spellbook", qty: 1 }],
    choices: [
      { desc: "Choose your weapon", choose: 1, options: [
        { label: "A Quarterstaff", items: [{ name: "Quarterstaff", qty: 1, desc: "1d6 bludgeoning, versatile (1d8)" }] },
        { label: "A Dagger", items: [{ name: "Dagger", qty: 1, desc: "1d4 piercing, finesse, light, thrown" }] }
      ]},
      { desc: "Choose your spell focus", choose: 1, options: [
        { label: "Component Pouch", items: [{ name: "Component Pouch", qty: 1, desc: "Basic spellcasting focus" }] },
        { label: "Arcane Focus", items: [{ name: "Arcane Focus (Wand)", qty: 1, desc: "Arcane spellcasting focus" }] }
      ]},
      { desc: "Choose your pack", choose: 1, options: [
        { label: "Scholar's Pack", items: [{ name: "Scholar's Pack", qty: 1, desc: "Backpack, book of lore, ink, pen, parchment, sand" }] },
        { label: "Explorer's Pack", items: [{ name: "Explorer's Pack", qty: 1, desc: "Bedroll, mess kit, tinderbox, torches, rations, waterskin" }] }
      ]}
    ]
  }
};

const SRD_RACE_DATA = {
  dwarf: { speed: 25, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Dwarven Resilience]\nYou have advantage on saving throws against poison, and you have resistance against poison damage.\n\n[Dwarven Combat Training]\nYou have proficiency with the battleaxe, handaxe, light hammer, and warhammer.\n\n[Stonecunning]\nWhenever you make an Intelligence (History) check related to the origin of stonework, you add double your proficiency bonus." },
  elf: { speed: 30, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Keen Senses]\nYou have proficiency in the Perception skill.\n\n[Fey Ancestry]\nYou have advantage on saving throws against being charmed, and magic can't put you to sleep.\n\n[Trance]\nElves don't need to sleep. Instead, they meditate deeply for 4 hours a day." },
  halfling: { speed: 25, traits: "[Lucky]\nWhen you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.\n\n[Brave]\nYou have advantage on saving throws against being frightened.\n\n[Halfling Nimbleness]\nYou can move through the space of any creature that is of a size larger than yours." },
  human: { speed: 30, traits: "[Versatile]\nHumans gain +1 to all ability scores and an extra language." },
  dragonborn: { speed: 30, traits: "[Draconic Ancestry]\nYou have draconic ancestry. Your breath weapon and damage resistance are determined by the dragon type.\n\n[Breath Weapon]\nYou can use your action to exhale destructive energy determined by your draconic ancestry.\n\n[Damage Resistance]\nYou have resistance to the damage type associated with your draconic ancestry." },
  gnome: { speed: 25, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Gnome Cunning]\nYou have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." },
  "half-elf": { speed: 30, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Fey Ancestry]\nYou have advantage on saving throws against being charmed, and magic can't put you to sleep.\n\n[Skill Versatility]\nYou gain proficiency in two skills of your choice." },
  "half-orc": { speed: 30, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Menacing]\nYou gain proficiency in the Intimidation skill.\n\n[Relentless Endurance]\nWhen you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead once per long rest.\n\n[Savage Attacks]\nWhen you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage." },
  tiefling: { speed: 30, traits: "[Darkvision]\nYou can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.\n\n[Hellish Resistance]\nYou have resistance to fire damage.\n\n[Infernal Legacy]\nYou know the Thaumaturgy cantrip. Charisma is your spellcasting ability for these spells." }
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
  myCharacterWeapons = charData.weapons && charData.weapons.length >= 2 ? charData.weapons : [
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
    if (allClassesCache.length === 0) {
      allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
    }
    renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  }
});

classInput?.addEventListener("input", async () => {
  if (allClassesCache.length === 0) allClassesCache = await fetchOfficialList("classes");
  if (allClassesCache.length === 0) {
    allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
  }
  renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  classDropdown.classList.add("open");
});

raceInput?.addEventListener("click", async () => {
  if (!raceDropdown.classList.contains("open")) {
    raceDropdown.innerHTML = '<div class="dropdown-item" style="color:#94a3b8; font-style:italic;">Loading races...</div>';
    raceDropdown.classList.add("open");
    if (allRacesCache.length === 0) allRacesCache = await fetchOfficialList("races");
    if (allRacesCache.length === 0) {
      allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
    }
    renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
  }
});

raceInput?.addEventListener("input", async () => {
  if (allRacesCache.length === 0) allRacesCache = await fetchOfficialList("races");
  if (allRacesCache.length === 0) {
    allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
  }
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

let activeClassLoadout = null;

function openClassEquipmentModal(classKey, displayName) {
  const data = SRD_CLASS_EQUIPMENT[classKey];
  if (!data) return;

  activeClassLoadout = JSON.parse(JSON.stringify(data));
  activeClassLoadout.selectedChoices = [];

  choiceModalTitle.textContent = `${displayName} Starting Equipment`;

  let html = `<div class="equip-section-title">Automatic Gear</div>`;
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
    const featBox = document.getElementById("featuresTraits");
    if (featBox) {
      const cur = featBox.value.trim();
      featBox.value = cur ? cur + "\n\n" + raceInfo.traits : raceInfo.traits;
      autoExpandTextarea(featBox);
    }
    saveSheet();
    showStatus("Racial traits loaded!");
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("open"));
  }
  if (e.target.classList.contains("modal-backdrop") || e.target.classList.contains("modal-close-btn") || e.target.id === "closeChoiceModal") {
    e.target.closest(".modal-backdrop")?.classList.remove("open");
  }
});

function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

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
