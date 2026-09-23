"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyAIKe_hrxyQvn4uebwU5OZrP2qf-FwK0Rg",
  authDomain: "character-sheet-bd250.firebaseapp.com",
  projectId: "character-sheet-bd250",
  storageBucket: "character-sheet-bd250.firebasestorage.app",
  messagingSenderId: "881155587941",
  appId: "1:881155587941:web:45087fba9dc7154fddeb8c"
};

let auth = null;
let db = null;
let currentUser = null;

if (typeof firebase !== "undefined") {
  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (err) {
    console.warn("Firebase running in offline mode:", err);
  }
}

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";

let myCharacterSpells = [];
let myCharacterTraits = [];
let myCharacterWeapons = [
  { name: "", atk: "", dmg: "", notes: "" },
  { name: "", atk: "", dmg: "", notes: "" }
];
let myActiveConditions = [];
let diceRollHistory = [];

let draggedSpellIndex = null;
const apiCache = {};

let allSpellsCache = [];
let allTraitsCache = [];

// Comprehensive Classes Catalog
const DND_CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer",
  "Warlock", "Wizard", "Artificer", "Blood Hunter"
];

// Comprehensive Races and Subraces Catalog
const DND_RACES_CATALOG = [
  {
    race: "Dragonborn",
    subraces: ["Black Dragonborn", "Blue Dragonborn", "Brass Dragonborn", "Bronze Dragonborn", "Copper Dragonborn", "Gold Dragonborn", "Green Dragonborn", "Red Dragonborn", "Silver Dragonborn", "White Dragonborn"]
  },
  {
    race: "Dwarf",
    subraces: ["Hill Dwarf", "Mountain Dwarf", "Duergar"]
  },
  {
    race: "Elf",
    subraces: ["High Elf", "Wood Elf", "Dark Elf (Drow)", "Eladrin", "Sea Elf", "Shadar-kai"]
  },
  {
    race: "Gnome",
    subraces: ["Forest Gnome", "Rock Gnome", "Deep Gnome (Svirfneblin)"]
  },
  {
    race: "Half-Elf",
    subraces: ["Half-Elf (Standard)", "Half-Elf (Aquatic)", "Half-Elf (Drow)", "Half-Elf (Wood Elf)"]
  },
  {
    race: "Half-Orc",
    subraces: ["Half-Orc"]
  },
  {
    race: "Halfling",
    subraces: ["Lightfoot Halfling", "Stout Halfling", "Ghostwise Halfling"]
  },
  {
    race: "Human",
    subraces: ["Standard Human", "Variant Human"]
  },
  {
    race: "Tiefling",
    subraces: ["Tiefling (Bloodline of Asmodeus)", "Tiefling (Bloodline of Baalzebul)", "Tiefling (Bloodline of Dispater)", "Tiefling (Bloodline of Fierna)", "Tiefling (Bloodline of Glasya)", "Tiefling (Bloodline of Levistus)", "Tiefling (Bloodline of Mammon)", "Tiefling (Bloodline of Mephistopheles)", "Tiefling (Bloodline of Zariel)", "Feral Tiefling"]
  },
  {
    race: "Aasimar",
    subraces: ["Protector Aasimar", "Scourge Aasimar", "Fallen Aasimar"]
  },
  {
    race: "Genasi",
    subraces: ["Air Genasi", "Earth Genasi", "Fire Genasi", "Water Genasi"]
  },
  {
    race: "Goliath",
    subraces: ["Goliath"]
  },
  {
    race: "Tabaxi",
    subraces: ["Tabaxi"]
  },
  {
    race: "Tortle",
    subraces: ["Tortle"]
  },
  {
    race: "Kenku",
    subraces: ["Kenku"]
  },
  {
    race: "Firbolg",
    subraces: ["Firbolg"]
  },
  {
    race: "Changeling",
    subraces: ["Changeling"]
  },
  {
    race: "Warforged",
    subraces: ["Warforged"]
  }
];

const SRD_SPELL_LEVELS = {
  "acid-arrow": 2, "acid-splash": 0, "aid": 2, "alarm": 1, "alter-self": 2, "animal-friendship": 1, "animal-messenger": 2, "animal-shapes": 8, "animate-dead": 3, "animate-objects": 5, "antimagic-field": 8, "antipathy-sympathy": 8, "arcane-eye": 4, "arcane-hand": 5, "arcane-lock": 2, "arcane-sword": 7, "arcanists-magic-aura": 2, "astral-projection": 9, "augury": 2, "awaken": 5, "bane": 1, "banishment": 4, "barkskin": 2, "beacon-of-hope": 3, "bestow-curse": 3, "black-tentacles": 4, "blade-barrier": 6, "bless": 1, "blight": 4, "blindness-deafness": 2, "blink": 3, "blur": 2, "branding-smite": 2, "burning-hands": 1, "call-lightning": 3, "calm-emotions": 2, "chain-lightning": 6, "charm-person": 1, "chill-touch": 0, "circle-of-death": 6, "clairvoyance": 3, "clone": 8, "cloudkill": 5, "color-spray": 1, "command": 1, "commune": 5, "commune-with-nature": 5, "comprehend-languages": 1, "cone-of-cold": 5, "confusion": 4, "conjure-animals": 3, "conjure-celestial": 7, "conjure-elemental": 5, "conjure-fey": 6, "conjure-minor-elementals": 4, "conjure-woodland-beings": 4, "contact-other-plane": 5, "contagion": 5, "contingency": 6, "continual-flame": 2, "control-water": 4, "control-weather": 8, "counterspell": 3, "create-food-and-water": 3, "create-or-destroy-water": 1, "create-undead": 6, "creation": 5, "cure-wounds": 1, "darkness": 2, "darkvision": 2, "daylight": 3, "death-ward": 4, "delayed-blast-fireball": 7, "demiplane": 8, "detect-evil-and-good": 1, "detect-magic": 1, "detect-poison-and-disease": 1, "detect-thoughts": 2, "dimension-door": 4, "disguise-self": 1, "disintegrate": 6, "dispel-evil-and-good": 5, "dispel-magic": 3, "divination": 4, "divine-favor": 1, "divine-word": 7, "dominate-beast": 4, "dominate-monster": 8, "dominate-person": 5, "dream": 5, "earthquake": 8, "eldritch-blast": 0, "enhance-ability": 2, "enlarge-reduce": 2, "entangle": 1, "enthrall": 2, "etherealness": 7, "expeditious-retreat": 1, "eyebite": 6, "fabricate": 4, "faerie-fire": 1, "faithful-hound": 4, "false-life": 1, "fear": 3, "feather-fall": 1, "feeblemind": 8, "find-familiar": 1, "find-steed": 2, "find-the-path": 6, "find-traps": 2, "finger-of-death": 7, "fire-shield": 4, "fire-storm": 7, "fireball": 3, "fire-bolt": 0, "flame-blade": 2, "flame-strike": 5, "flaming-sphere": 2, "flesh-to-stone": 6, "fly": 3, "fog-cloud": 1, "forbiddance": 6, "forcecage": 7, "foresight": 9, "freedom-of-movement": 4, "freezing-sphere": 6, "gaseous-form": 3, "gate": 9, "geas": 5, "gentle-repose": 2, "glibness": 8, "globe-of-invulnerability": 6, "glyph-of-warding": 3, "grease": 1, "greater-invisibility": 4, "greater-restoration": 5, "guardian-of-faith": 4, "guards-and-wards": 6, "guidance": 0, "guiding-bolt": 1, "gust-of-wind": 2, "hallow": 5, "hallucinatory-terrain": 4, "harm": 6, "haste": 3, "heal": 6, "healing-word": 1, "heat-metal": 2, "hellish-rebuke": 1, "heroes-feast": 6, "heroism": 1, "hideous-laughter": 1, "hold-monster": 5, "hold-person": 2, "holy-aura": 8, "hunters-mark": 1, "hypnotic-pattern": 3, "ice-storm": 4, "identify": 1, "illusory-script": 1, "imprisonment": 9, "incendiary-cloud": 8, "inflict-wounds": 1, "insect-plague": 5, "instant-summons": 6, "invisibility": 2, "jump": 1, "knock": 2, "legend-lore": 5, "lesser-restoration": 2, "levitate": 2, "light": 0, "lightning-bolt": 3, "locate-animals-or-plants": 2, "locate-creature": 4, "locate-object": 2, "longstrider": 1, "mage-armor": 1, "mage-hand": 0, "magic-circle": 3, "magic-jar": 6, "magic-missile": 1, "magic-mouth": 2, "magic-weapon": 2, "magnificent-mansion": 7, "major-image": 3, "mass-cure-wounds": 5, "mass-heal": 9, "mass-healing-word": 3, "mass-suggestion": 6, "maze": 8, "meld-into-stone": 3, "mending": 0, "message": 0, "meteor-swarm": 9, "mind-blank": 8, "minor-illusion": 0, "mirage-arcane": 7, "mirror-image": 2, "mislead": 5, "misty-step": 2, "modify-memory": 5, "moonbeam": 2, "move-earth": 6, "nondetection": 3, "pass-without-trace": 2, "passwall": 5, "phantasmal-killer": 4, "phantom-steed": 3, "planar-ally": 6, "planar-binding": 5, "plane-shift": 7, "plant-growth": 3, "poison-spray": 0, "polymorph": 4, "power-word-kill": 9, "power-word-stun": 8, "prayer-of-healing": 2, "prestidigitation": 0, "prismatic-spray": 7, "prismatic-wall": 9, "produce-flame": 0, "programmed-illusion": 6, "project-image": 7, "protection-from-energy": 3, "protection-from-evil-and-good": 1, "protection-from-poison": 2, "purify-food-and-drink": 1, "raise-dead": 5, "ray-of-enfeeblement": 2, "ray-of-frost": 0, "regenerate": 7, "reincarnate": 5, "remove-curse": 3, "resilient-sphere": 4, "resistance": 0, "resurrection": 7, "reverse-gravity": 7, "revivify": 3, "rope-trick": 2, "sacred-flame": 0, "sanctuary": 1, "scorching-ray": 2, "scrying": 5, "secret-chest": 4, "see-invisibility": 2, "seeming": 5, "sending": 3, "sequester": 7, "shapechange": 9, "shatter": 2, "shield": 1, "shield-of-faith": 1, "shillelagh": 0, "shocking-grasp": 0, "silence": 2, "silent-image": 1, "simulacrum": 7, "sleep": 1, "sleet-storm": 3, "slow": 3, "speak-with-animals": 1, "speak-with-dead": 3, "speak-with-plants": 3, "spider-climb": 2, "spike-growth": 2, "spirit-guardians": 3, "spiritual-weapon": 2, "stinking-cloud": 3, "stone-shape": 4, "stoneskin": 4, "storm-of-vengeance": 9, "suggestion": 2, "sunbeam": 6, "sunburst": 8, "symbol": 7, "telekinesis": 5, "telepathic-bond": 5, "teleport": 7, "teleportation-circle": 5, "thaumaturgy": 0, "thunderwave": 1, "time-stop": 9, "tiny-hut": 3, "tongues": 3, "transport-via-plants": 6, "tree-stride": 5, "true-polymorph": 9, "true-resurrection": 9, "true-seeing": 6, "true-strike": 0, "unseen-servant": 1, "vampiric-touch": 3, "vicious-mockery": 0, "wall-of-fire": 4, "wall-of-force": 5, "wall-of-ice": 6, "wall-of-stone": 5, "wall-of-thorns": 6, "warding-bond": 2, "water-breathing": 3, "water-walk": 3, "web": 2, "weird": 9, "wind-walk": 6, "wind-wall": 3, "wish": 9, "word-of-recall": 6, "zone-of-truth": 2
};

const BUILTIN_SPELLS = [
  { name: "Fire Bolt", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage." },
  { name: "Mage Hand", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "A spectral, floating hand appears at a point you choose within range. You can use your action to control the hand to manipulate objects up to 10 pounds." },
  { name: "Eldritch Blast", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Warlock", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "A beam of crackling energy streaks toward a creature within range. On a hit, the target takes 1d10 force damage." },
  { name: "Vicious Mockery", levelTag: "Cantrip", schoolTag: "Enchantment", classesTag: "Bard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "You unleash a string of insults. Target takes 1d4 psychic damage and has disadvantage on its next attack roll on a failed Wisdom save." },
  { name: "Prestidigitation", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "10 ft", duration: "Up to 1 hour", desc: "Perform minor harmless sensory effects, light or snuff flames, clean or soil items, or chill and warm food." },
  { name: "Shield", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Sorcerer, Wizard", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "An invisible barrier of magical force protects you. You gain a +5 bonus to AC until the start of your next turn and take no damage from magic missile." },
  { name: "Magic Missile", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You create three glowing darts of magical force. Each dart automatically strikes a creature for 1d4 + 1 force damage." },
  { name: "Cure Wounds", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid, Paladin, Ranger", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "A creature you touch regains hit points equal to 1d8 + your spellcasting ability modifier." },
  { name: "Healing Word", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid", casting_time: "1 Bonus Action", range: "60 ft", duration: "Instantaneous", desc: "A creature of your choice that you can see within range regains 1d4 + spellcasting modifier hit points." },
  { name: "Misty Step", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space you can see." },
  { name: "Fireball", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A 20-foot-radius sphere of fire deals 8d6 fire damage to all creatures failing a Dexterity saving throw, or half as much on a successful one." },
  { name: "Counterspell", levelTag: "Level 3", schoolTag: "Abjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Reaction", range: "60 ft", duration: "Instantaneous", desc: "You attempt to interrupt a creature in the process of casting a spell. If the spell is 3rd level or lower, it automatically fails." }
];

const BUILTIN_TRAITS = [
  { name: "Action Surge", classes: ["Fighter"], desc: "On your turn, you can take one additional action on top of your regular action and bonus action." },
  { name: "Second Wind", classes: ["Fighter"], desc: "On your turn, use a bonus action to regain hit points equal to 1d10 + your fighter level once per short or long rest." },
  { name: "Sneak Attack", classes: ["Rogue"], desc: "Once per turn, deal an extra 1d6 damage to one creature you hit with advantage using a finesse or ranged weapon." },
  { name: "Cunning Action", classes: ["Rogue"], desc: "You can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide." },
  { name: "Rage", classes: ["Barbarian"], desc: "Enter a primal rage as a bonus action, gaining advantage on Strength checks, melee bonus damage, and resistance to physical damage." },
  { name: "Reckless Attack", classes: ["Barbarian"], desc: "Gain advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn." },
  { name: "Bardic Inspiration", classes: ["Bard"], desc: "Use a bonus action to give a companion within 60 feet a d6 to add to an attack roll, ability check, or saving throw." },
  { name: "Divine Smite", classes: ["Paladin"], desc: "When you hit a creature with a melee weapon attack, expend a spell slot to deal 2d8 plus 1d8 per spell level above 1st radiant damage." },
  { name: "Lay on Hands", classes: ["Paladin"], desc: "Heal wounds through blessed touch using a pool of healing power equal to your paladin level x 5." },
  { name: "Wild Shape", classes: ["Druid"], desc: "Magically assume the shape of a beast you have seen before as an action twice per short or long rest." },
  { name: "Channel Divinity", classes: ["Cleric", "Paladin"], desc: "Channel divine energy directly from your deity to fuel potent domain or oath effects." },
  { name: "Flurry of Blows", classes: ["Monk"], desc: "Immediately after you take the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action." },
  { name: "Pact Magic", classes: ["Warlock"], desc: "Your spell slots are all of the highest available slot level and recover fully upon a short rest." },
  { name: "Arcane Recovery", classes: ["Wizard"], desc: "Once per day during a short rest, recover expended spell slots up to half your wizard level (rounded up)." },
  { name: "Darkvision", races: ["Dwarf", "Elf", "Gnome", "Half-Elf", "Half-Orc", "Tiefling"], desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
  { name: "Fey Ancestry", races: ["Elf", "Half-Elf"], desc: "Advantage on saving throws against being charmed, and magic cannot put you to sleep." },
  { name: "Trance", races: ["Elf"], desc: "Elves don't need to sleep. Instead, they meditate deeply for 4 hours a day, gaining the full benefits of an 8-hour rest." },
  { name: "Dwarven Resilience", races: ["Dwarf"], desc: "Advantage on saving throws against poison, and resistance against poison damage." },
  { name: "Stonecunning", races: ["Dwarf"], desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, add double your proficiency bonus." },
  { name: "Lucky", races: ["Halfling"], desc: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
  { name: "Brave", races: ["Halfling"], desc: "Advantage on saving throws against being frightened." },
  { name: "Relentless Endurance", races: ["Half-Orc"], desc: "When reduced to 0 HP but not killed outright, you can drop to 1 HP instead once per long rest." },
  { name: "Savage Attacks", races: ["Half-Orc"], desc: "When you score a critical hit with a melee weapon attack, roll one of the weapon's damage dice one additional time." },
  { name: "Hellish Resistance", races: ["Tiefling"], desc: "You have resistance to fire damage." },
  { name: "Breath Weapon", races: ["Dragonborn"], desc: "Exhale destructive elemental energy based on your draconic ancestry once per short or long rest." },
  { name: "Damage Resistance", races: ["Dragonborn"], desc: "You have resistance to the damage type associated with your draconic ancestry." },
  { name: "Gnome Cunning", races: ["Gnome"], desc: "Advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." }
];

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let toastTimer = null;
function showStatus(text) {
  const toast = document.getElementById("saveToast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

function getProfBonus(level) {
  return Math.ceil(1 + level / 4);
}

function autoResizeStatInput(input) {
  if (!input || input.classList.contains("concentration-input")) return;
  const content = input.value || input.placeholder || "";
  input.style.width = Math.max(3, content.length + 1.5) + "ch";
}

function syncAllStatInputs() {
  document.querySelectorAll(".spell-stat-input").forEach(autoResizeStatInput);
}

function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
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
      const saveTotal = isSaveChecked ? mod + prof : mod;
      saveValElem.textContent = saveTotal >= 0 ? `+${saveTotal}` : saveTotal;
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

  // Calculate Passive Senses (10 + skill bonus)
  const percSkill = parseInt(document.getElementById("val_perc")?.textContent, 10) || 0;
  const invSkill = parseInt(document.getElementById("val_inv")?.textContent, 10) || 0;
  const insSkill = parseInt(document.getElementById("val_ins")?.textContent, 10) || 0;

  const passivePerc = document.getElementById("passivePerception");
  if (passivePerc) passivePerc.textContent = 10 + percSkill;

  const passiveInv = document.getElementById("passiveInvestigation");
  if (passiveInv) passiveInv.textContent = 10 + invSkill;

  const passiveIns = document.getElementById("passiveInsight");
  if (passiveIns) passiveIns.textContent = 10 + insSkill;
}

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

  while (myCharacterWeapons.length < 2) {
    myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
  }

  container.innerHTML = myCharacterWeapons.map((wpn, idx) => `
    <div class="attack-entry" data-index="${idx}">
      <input type="text" class="save-field wpn-field" data-prop="name" value="${escapeHtml(wpn.name || "")}" placeholder="Weapon" />
      <input type="text" class="save-field wpn-field center" data-prop="atk" value="${escapeHtml(wpn.atk || "")}" placeholder="+5" />
      <input type="text" class="save-field wpn-field center" data-prop="dmg" value="${escapeHtml(wpn.dmg || "")}" placeholder="1d8" />
      <input type="text" class="save-field wpn-field" data-prop="notes" value="${escapeHtml(wpn.notes || "")}" placeholder="Notes..." />
      <button type="button" class="weapon-delete-btn" data-index="${idx}" title="Delete weapon">&times;</button>
    </div>
  `).join("");
}

function renderMyTraits() {
  const container = document.getElementById("traitsList");
  if (!container) return;

  if (myCharacterTraits.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b; font-style: italic; padding: 0.5rem 0;">No abilities added yet. Click "+ Add Ability" above to browse the compendium.</p>`;
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

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet. Click "+ Add Spell" above to browse the compendium.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells.map((spell, idx) => {
    const typeVal = spell.type || "Spell";
    const descVal = Array.isArray(spell.desc) ? spell.desc.join("\n\n") : (spell.desc || "");
    return `
      <div class="spell-card" draggable="true" data-index="${idx}">
        <div class="spell-card-header">
          <span class="spell-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
          <input type="text" class="spell-custom-title-input custom-spell-field" data-prop="name" value="${escapeHtml(spell.name || "")}" placeholder="Spell Name" />
          <button class="spell-card-delete" data-index="${idx}" type="button" title="Remove spell">&times;</button>
        </div>
        <div class="spell-card-meta">
          <div class="meta-field-group">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="type" value="${escapeHtml(typeVal)}" placeholder="Cantrip" />
          </div>
          <div class="meta-field-group">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="casting_time" value="${escapeHtml(spell.casting_time || "")}" placeholder="1 Action" />
          </div>
          <div class="meta-field-group">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="range" value="${escapeHtml(spell.range || "")}" placeholder="30 ft" />
          </div>
          <div class="meta-field-group">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="duration" value="${escapeHtml(spell.duration || "")}" placeholder="Instantaneous" />
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
  document.querySelectorAll(".spell-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        return;
      }
      draggedSpellIndex = parseInt(card.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move";
      card.style.opacity = "0.4";
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
      document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
      draggedSpellIndex = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
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

      const moved = myCharacterSpells.splice(draggedSpellIndex, 1)[0];
      myCharacterSpells.splice(targetIndex, 0, moved);
      saveSheet(false);
      renderMySpells();
    });
  });
}

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

  container.innerHTML = diceRollHistory.map((item) => `
    <div class="dice-history-item">
      <span class="dice-history-desc">${escapeHtml(item.desc)} <small style="color:#64748b;">(${item.time})</small></span>
      <span class="dice-history-val">${escapeHtml(String(item.total))}</span>
    </div>
  `).join("");
}

function renderConditionChips() {
  document.querySelectorAll(".cond-chip").forEach((chip) => {
    const cond = chip.dataset.cond;
    if (myActiveConditions.includes(cond)) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

function getRoster() {
  try {
    return JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

async function saveRoster(roster) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  if (currentUser && db) {
    try {
      await db.collection("user_rosters").doc(currentUser.uid).set({ data: roster });
    } catch (err) {
      console.warn("Cloud save sync deferred:", err);
    }
  }
}

function getCurrentSheetData() {
  const fields = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.id) {
      if (field.type === "checkbox") {
        fields[field.id] = field.checked;
      } else {
        fields[field.id] = field.value;
      }
    }
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
    weapons: myCharacterWeapons,
    conditions: myActiveConditions
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
  myActiveConditions = charData.conditions || [];
  myCharacterWeapons = charData.weapons && charData.weapons.length >= 2 ? charData.weapons : [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "", notes: "" }
  ];

  renderWeapons();
  renderMySpells();
  renderMyTraits();
  renderConditionChips();
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
      renderConditionChips();
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
      field.classList.contains("slot-input") ||
      field.classList.contains("death-input") ||
      field.classList.contains("res-input") ||
      field.classList.contains("exhaustion-input")
    ) {
      field.value = 0;
    } else {
      field.value = "";
    }
  });

  myCharacterSpells = [];
  myCharacterTraits = [];
  myActiveConditions = [];
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
  renderConditionChips();
  syncAllStatInputs();
  saveSheet(false);
  showStatus("New Sheet Created!");
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

// Render Dropdown Menus for Class and Race
function renderClassDropdown(filter = "") {
  const dropdown = document.getElementById("classDropdown");
  if (!dropdown) return;
  const q = filter.toLowerCase().trim();
  const filtered = DND_CLASSES.filter((c) => c.toLowerCase().includes(q));

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="dropdown-item" style="color:#64748b; cursor:default;">No classes match</div>`;
    return;
  }

  dropdown.innerHTML = filtered.map((c) => `
    <div class="dropdown-item select-class-item" data-name="${escapeHtml(c)}">${escapeHtml(c)}</div>
  `).join("");
}

function renderRaceDropdown(filter = "") {
  const dropdown = document.getElementById("raceDropdown");
  if (!dropdown) return;
  const q = filter.toLowerCase().trim();

  let html = "";
  DND_RACES_CATALOG.forEach((group) => {
    const subMatches = group.subraces.filter((s) => s.toLowerCase().includes(q));
    const raceMatches = group.race.toLowerCase().includes(q);

    if (raceMatches || subMatches.length > 0) {
      html += `<div class="dropdown-header-item">${escapeHtml(group.race)}</div>`;
      if (!q || raceMatches) {
        html += `<div class="dropdown-item select-race-item" data-name="${escapeHtml(group.race)}">${escapeHtml(group.race)} (Base)</div>`;
      }
      const listToDisplay = q && !raceMatches ? subMatches : group.subraces;
      listToDisplay.forEach((sub) => {
        if (sub !== group.race) {
          html += `<div class="dropdown-item subrace-item select-race-item" data-name="${escapeHtml(sub)}">${escapeHtml(sub)}</div>`;
        }
      });
    }
  });

  if (!html) {
    dropdown.innerHTML = `<div class="dropdown-item" style="color:#64748b; cursor:default;">No races match</div>`;
  } else {
    dropdown.innerHTML = html;
  }
}

async function fetchAPI(url) {
  if (apiCache[url]) return apiCache[url];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    apiCache[url] = data;
    return data;
  } catch (err) {
    return null;
  }
}

function getSpellLevelTag(s) {
  if (s.levelTag) return s.levelTag;
  let lvl = s.level;
  if (lvl === undefined) {
    const key = (s.index || s.name || "").toLowerCase().replace(/[^a-z0-9]/g, '-');
    lvl = SRD_SPELL_LEVELS[key];
  }
  if (lvl === 0) return "Cantrip";
  if (lvl !== undefined && lvl !== null) return `Level ${lvl}`;
  return "Spell";
}

async function loadAllSpells() {
  if (allSpellsCache.length > 0) return allSpellsCache;
  const res = await fetchAPI("https://www.dnd5eapi.co/api/spells");
  if (res && res.results && res.results.length > 0) {
    const combined = [...BUILTIN_SPELLS];
    res.results.forEach((s) => {
      if (!combined.some((b) => b.name.toLowerCase() === s.name.toLowerCase())) {
        combined.push({
          name: s.name,
          url: s.url,
          index: s.index,
          level: s.level,
          levelTag: getSpellLevelTag(s)
        });
      }
    });
    allSpellsCache = combined;
  } else {
    allSpellsCache = [...BUILTIN_SPELLS];
  }
  return allSpellsCache;
}

async function loadAllTraits() {
  if (allTraitsCache.length > 0) return allTraitsCache;

  const combined = [...BUILTIN_TRAITS];

  const [f, t] = await Promise.all([
    fetchAPI("https://www.dnd5eapi.co/api/features"),
    fetchAPI("https://www.dnd5eapi.co/api/traits")
  ]);

  if (f && f.results) {
    f.results.forEach((item) => {
      if (!item.name.includes("Dragon Ancestor (") && !item.name.includes("Draconic Ancestry (")) {
        const existing = combined.find((b) => b.name.toLowerCase() === item.name.toLowerCase());
        if (!existing) {
          combined.push({ name: item.name, url: item.url, type: "Class Feature" });
        }
      }
    });
  }

  if (t && t.results) {
    t.results.forEach((item) => {
      const existing = combined.find((b) => b.name.toLowerCase() === item.name.toLowerCase());
      if (!existing) {
        combined.push({ name: item.name, url: item.url, type: "Racial Trait" });
      }
    });
  }

  allTraitsCache = combined;
  syncClassAndRaceFeatureTags();
  return allTraitsCache;
}

async function syncClassAndRaceFeatureTags() {
  const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
  const races = ["dragonborn", "dwarf", "elf", "gnome", "half-elf", "half-orc", "halfling", "human", "tiefling"];

  const classFetches = classes.map((c) => fetchAPI(`https://www.dnd5eapi.co/api/classes/${c}/features`));
  const raceFetches = races.map((r) => fetchAPI(`https://www.dnd5eapi.co/api/races/${r}/traits`));

  const [classResults, raceResults] = await Promise.all([
    Promise.all(classFetches),
    Promise.all(raceFetches)
  ]);

  classResults.forEach((res, idx) => {
    if (res && res.results) {
      const className = classes[idx].charAt(0).toUpperCase() + classes[idx].slice(1);
      res.results.forEach((feat) => {
        const match = allTraitsCache.find((t) => t.name.toLowerCase() === feat.name.toLowerCase());
        if (match) {
          if (!match.classes) match.classes = [];
          if (!match.classes.includes(className)) match.classes.push(className);
        }
      });
    }
  });

  raceResults.forEach((res, idx) => {
    if (res && res.results) {
      const raceName = races[idx].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
      res.results.forEach((trait) => {
        const match = allTraitsCache.find((t) => t.name.toLowerCase() === trait.name.toLowerCase());
        if (match) {
          if (!match.races) match.races = [];
          if (!match.races.includes(raceName)) match.races.push(raceName);
        }
      });
    }
  });

  const traitModal = document.getElementById("traitModal");
  if (traitModal && traitModal.classList.contains("open")) {
    const query = document.getElementById("traitSearchInput")?.value.toLowerCase().trim() || "";
    const filtered = allTraitsCache.filter((t) => t.name.toLowerCase().includes(query));
    renderModalTraits(filtered);
  }
}

async function enrichSpellList(items) {
  const topSlice = items.slice(0, 20);
  let updated = false;
  await Promise.all(topSlice.map(async (s) => {
    if (!s.schoolTag && s.url) {
      const data = await fetchAPI("https://www.dnd5eapi.co" + s.url);
      if (data) {
        s.levelTag = data.level === 0 ? "Cantrip" : `Level ${data.level}`;
        s.schoolTag = data.school?.name || "";
        s.classesTag = (data.classes || []).map((c) => c.name).join(", ");
        s.casting_time = data.casting_time || "1 Action";
        s.range = data.range || "30 ft";
        s.duration = data.duration || "Instantaneous";
        s.desc = Array.isArray(data.desc) ? data.desc.join("\n\n") : (data.desc || "");
        updated = true;
      }
    }
  }));
  return updated;
}

function getSchoolCssClass(school) {
  if (!school) return "purple";
  const s = school.toLowerCase();
  if (s.includes("evoc")) return "school-evocation";
  if (s.includes("abjur")) return "school-abjuration";
  if (s.includes("conjur")) return "school-conjuration";
  if (s.includes("transmut")) return "school-transmutation";
  if (s.includes("enchant")) return "school-enchantment";
  if (s.includes("illus")) return "school-illusion";
  if (s.includes("divin")) return "school-divination";
  if (s.includes("necro")) return "school-necromancy";
  return "purple";
}

function getClassCssClass(className) {
  if (!className) return "blue";
  const c = className.toLowerCase();
  if (c.includes("fighter")) return "class-fighter";
  if (c.includes("rogue")) return "class-rogue";
  if (c.includes("wizard")) return "class-wizard";
  if (c.includes("sorcerer")) return "class-sorcerer";
  if (c.includes("warlock")) return "class-warlock";
  if (c.includes("cleric")) return "class-cleric";
  if (c.includes("paladin")) return "class-paladin";
  if (c.includes("barbarian")) return "class-barbarian";
  if (c.includes("bard")) return "class-bard";
  if (c.includes("druid")) return "class-druid";
  if (c.includes("monk")) return "class-monk";
  if (c.includes("ranger")) return "class-ranger";
  return "blue";
}

function getRaceCssClass(raceName) {
  if (!raceName) return "purple";
  const r = raceName.toLowerCase();
  if (r.includes("elf") && !r.includes("half")) return "race-elf";
  if (r.includes("half-elf")) return "race-half-elf";
  if (r.includes("dwarf")) return "race-dwarf";
  if (r.includes("tiefling")) return "race-tiefling";
  if (r.includes("dragon")) return "race-dragonborn";
  if (r.includes("halfling")) return "race-halfling";
  if (r.includes("half-orc")) return "race-half-orc";
  if (r.includes("gnome")) return "race-gnome";
  if (r.includes("human")) return "race-human";
  return "purple";
}

function renderModalSpells(list) {
  const container = document.getElementById("spellApiList");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = list.slice(0, 40).map((s) => {
    const levelStr = getSpellLevelTag(s);
    const isCantrip = levelStr.toLowerCase().includes("cantrip");
    const lvlClass = isCantrip ? "spell-cantrip" : "spell-level";

    let tagsHtml = `<span class="tag-pill ${lvlClass}">${escapeHtml(levelStr)}</span>`;
    
    if (s.schoolTag) {
      tagsHtml += `<span class="tag-pill ${getSchoolCssClass(s.schoolTag)}">${escapeHtml(s.schoolTag)}</span>`;
    }
    
    if (s.classesTag) {
      const cList = s.classesTag.split(",").map(c => c.trim());
      cList.forEach((cls) => {
        tagsHtml += `<span class="tag-pill ${getClassCssClass(cls)}">${escapeHtml(cls)}</span>`;
      });
    }

    return `
      <div class="spell-option-item spell-pick-row" data-url="${s.url || ''}" data-name="${escapeHtml(s.name)}">
        <div>
          <div style="font-weight:700; color:#f8fafc;">${escapeHtml(s.name)}</div>
          <div class="spell-meta-tags">${tagsHtml}</div>
        </div>
        <span class="spell-add-badge">+ Add</span>
      </div>
    `;
  }).join("");
}

function renderModalTraits(list) {
  const container = document.getElementById("traitApiList");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching abilities found.</p>`;
    return;
  }

  container.innerHTML = list.slice(0, 40).map((t) => {
    let tagsHtml = "";

    const classes = Array.isArray(t.classes) ? t.classes : (t.class ? [t.class] : []);
    const races = Array.isArray(t.races) ? t.races : (t.race ? [t.race] : []);

    classes.forEach((c) => {
      tagsHtml += `<span class="tag-pill ${getClassCssClass(c)}">${escapeHtml(c)}</span>`;
    });

    races.forEach((r) => {
      tagsHtml += `<span class="tag-pill ${getRaceCssClass(r)}">${escapeHtml(r)}</span>`;
    });

    if (!tagsHtml) {
      tagsHtml = `<span class="tag-pill blue">${escapeHtml(t.type || 'Feature')}</span>`;
    }

    return `
      <div class="spell-option-item trait-pick-row" data-url="${t.url || ''}" data-name="${escapeHtml(t.name)}" data-type="${escapeHtml(t.type || 'Feature')}">
        <div>
          <div style="font-weight:700; color:#f8fafc;">${escapeHtml(t.name)}</div>
          <div class="spell-meta-tags">${tagsHtml}</div>
        </div>
        <span class="spell-add-badge">+ Add</span>
      </div>
    `;
  }).join("");
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove("open");
}

function closeAllModals() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
}

let authMode = "login";
function openAuthModal(mode) {
  authMode = mode;
  document.getElementById("authModalTitle").textContent = mode === "login" ? "Sign In" : "Create Account";
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "Log In" : "Sign Up";
  document.getElementById("authError").style.display = "none";
  document.getElementById("authPassword").value = "";
  document.getElementById("authModal")?.classList.add("open");
}

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    const authGroup = document.getElementById("authNavGroup");
    if (!authGroup) return;
    if (user) {
      currentUser = user;
      authGroup.innerHTML = `
        <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 700; padding: 0 0.5rem;">${escapeHtml(user.email || "Adventurer")}</span>
        <button class="btn outline blue" id="logoutBtn" type="button">Log Out</button>
      `;
      if (db) {
        try {
          const docSnap = await db.collection("user_rosters").doc(user.uid).get();
          if (docSnap.exists) {
            localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(docSnap.data().data));
          } else {
            saveRoster(getRoster());
          }
          loadSheet();
        } catch (e) {
          console.warn("Cloud sync deferred:", e);
        }
      }
    } else {
      currentUser = null;
      authGroup.innerHTML = `
        <button class="btn outline blue" id="loginNavBtn" type="button">Log In</button>
        <button class="btn red" id="signupNavBtn" type="button">Sign Up</button>
      `;
      loadSheet();
    }
  });
}

function switchMainTab(targetId) {
  document.querySelectorAll(".main-tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.main-tab[data-target="${targetId}"]`)?.classList.add("active");
  document.getElementById(targetId)?.classList.add("active");
}

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("modal-close-btn") || e.target.closest(".modal-close-btn")) {
    const backdrop = e.target.closest(".modal-backdrop");
    if (backdrop) backdrop.classList.remove("open");
    return;
  }

  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
    return;
  }

  // Close dropdowns if clicked outside
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach((d) => d.classList.remove("open"));
  }

  // Dropdown Item Selections
  if (e.target.classList.contains("select-class-item")) {
    const className = e.target.dataset.name;
    const classInput = document.getElementById("charClass");
    if (classInput) {
      classInput.value = className;
      saveSheet(false);
    }
    document.getElementById("classDropdown")?.classList.remove("open");
    return;
  }

  if (e.target.classList.contains("select-race-item")) {
    const raceName = e.target.dataset.name;
    const raceInput = document.getElementById("charRace");
    if (raceInput) {
      raceInput.value = raceName;
      saveSheet(false);
    }
    document.getElementById("raceDropdown")?.classList.remove("open");
    return;
  }

  // Interactive Conditions Tracker Toggle
  if (e.target.classList.contains("cond-chip")) {
    const cond = e.target.dataset.cond;
    if (myActiveConditions.includes(cond)) {
      myActiveConditions = myActiveConditions.filter((c) => c !== cond);
      e.target.classList.remove("active");
    } else {
      myActiveConditions.push(cond);
      e.target.classList.add("active");
    }
    saveSheet(true);
    return;
  }

  if (e.target.id === "loginNavBtn") openAuthModal("login");
  if (e.target.id === "signupNavBtn") openAuthModal("signup");

  if (e.target.id === "logoutBtn" && auth) {
    await auth.signOut();
    showStatus("Logged out");
  }

  if (e.target.id === "authSubmitBtn" && auth) {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPassword").value;
    const errEl = document.getElementById("authError");
    errEl.style.display = "none";
    try {
      if (authMode === "login") {
        await auth.signInWithEmailAndPassword(email, pass);
      } else {
        await auth.createUserWithEmailAndPassword(email, pass);
      }
      closeModal("authModal");
    } catch (err) {
      errEl.textContent = err.message.replace("Firebase: ", "");
      errEl.style.display = "block";
    }
  }

  if (e.target.id === "googleAuthBtn" && auth) {
    const provider = new firebase.auth.GoogleAuthProvider();
    const errEl = document.getElementById("authError");
    errEl.style.display = "none";
    try {
      await auth.signInWithPopup(provider);
      closeModal("authModal");
    } catch (err) {
      errEl.textContent = err.message.replace("Firebase: ", "");
      errEl.style.display = "block";
    }
  }

  if (e.target.id === "saveBtn") saveSheet(false);
  if (e.target.id === "newBtn") {
    if (confirm("Create a new blank character sheet?")) resetSheet();
  }
  if (e.target.id === "loadBtn") {
    renderCharList();
    document.getElementById("loadModal")?.classList.add("open");
  }

  if (e.target.id === "deleteBtn") {
    const roster = getRoster();
    if (confirm(`Permanently delete "${roster[activeCharId]?.name || "this character"}"?`)) {
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
  }

  if (e.target.id === "backupBtn") {
    const roster = getRoster();
    const currentChar = roster[activeCharId] || {
      id: activeCharId,
      name: "Character",
      fields: getCurrentSheetData(),
      spells: myCharacterSpells,
      traits: myCharacterTraits,
      weapons: myCharacterWeapons,
      conditions: myActiveConditions
    };
    const blob = new Blob([JSON.stringify({ character: currentChar, allRoster: roster }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(currentChar.name || "character").toLowerCase().replace(/\s+/g, "_")}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("Backup Downloaded");
  }

  if (e.target.id === "helpLinkBtn") {
    document.getElementById("helpModal")?.classList.add("open");
  }

  if (e.target.classList.contains("main-tab")) {
    switchMainTab(e.target.dataset.target);
  }

  if (e.target.classList.contains("sub-tab")) {
    document.querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".subtab-page").forEach((p) => p.classList.remove("active"));
    e.target.classList.add("active");
    document.getElementById(e.target.dataset.sub)?.classList.add("active");
  }

  if (e.target.classList.contains("footer-nav-btn")) {
    const tabTarget = e.target.dataset.tab;
    switchMainTab(tabTarget);
    const targetMap = {
      attr: ".attributes-group",
      skills: ".skills-group",
      traits: "#abilitiesSection",
      spells: ".spells-full-section",
      journal: "#tab-journal"
    };
    document.querySelector(targetMap[e.target.dataset.scroll])?.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("dice-btn")) {
    const sides = parseInt(e.target.dataset.sides, 10);
    const roll = Math.floor(Math.random() * sides) + 1;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = roll;
    addDiceHistory(`1d${sides}`, roll);
  }

  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0;
    let label = "Check";
    if (e.target.dataset.type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (e.target.dataset.type === "skill") {
      const row = e.target.closest(".skill-row");
      bonus = parseInt(row?.querySelector(".skill-val")?.textContent, 10) || 0;
      label = row?.querySelector(".skill-label")?.textContent.replace(/\s+[A-Za-z]+$/, "").trim() || "Skill";
    }
    const total = roll + bonus;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = total;
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    addDiceHistory(`${label} (${roll} ${sign})`, total);
  }

  if (e.target.id === "addSpellBtn") {
    document.getElementById("spellModal")?.classList.add("open");
    const input = document.getElementById("spellSearchInput");
    if (input) input.value = "";
    const list = await loadAllSpells();
    renderModalSpells(list);
    enrichSpellList(list).then((changed) => {
      if (changed && (!input || input.value === "")) {
        renderModalSpells(allSpellsCache);
      }
    });
  }

  if (e.target.id === "addCustomSpellBtn") {
    myCharacterSpells.push({
      name: "New Spell",
      type: "Cantrip",
      casting_time: "1 Action",
      range: "30 ft",
      duration: "Instantaneous",
      desc: ""
    });
    saveSheet(false);
    renderMySpells();
    closeModal("spellModal");
  }

  const spellRow = e.target.closest(".spell-pick-row");
  if (spellRow) {
    const name = spellRow.dataset.name;
    const url = spellRow.dataset.url;
    let detail = allSpellsCache.find((s) => s.name.toLowerCase() === name.toLowerCase());

    if (url && (!detail || !detail.desc)) {
      const fetched = await fetchAPI("https://www.dnd5eapi.co" + url);
      if (fetched) {
        detail = {
          name: fetched.name,
          type: fetched.level === 0 ? "Cantrip" : `Level ${fetched.level} ${fetched.school?.name || ""}`.trim(),
          casting_time: fetched.casting_time || "1 Action",
          range: fetched.range || "30 ft",
          duration: fetched.duration || "Instantaneous",
          desc: Array.isArray(fetched.desc) ? fetched.desc.join("\n\n") : (fetched.desc || "")
        };
      }
    }

    myCharacterSpells.push(detail || {
      name: name,
      type: getSpellLevelTag({ name }),
      casting_time: "1 Action",
      range: "30 ft",
      duration: "Instantaneous",
      desc: ""
    });

    saveSheet(false);
    renderMySpells();
    closeModal("spellModal");
  }

  if (e.target.id === "addTraitBtn") {
    document.getElementById("traitModal")?.classList.add("open");
    const input = document.getElementById("traitSearchInput");
    if (input) input.value = "";
    const list = await loadAllTraits();
    renderModalTraits(list);
  }

  if (e.target.id === "addCustomTraitBtn") {
    myCharacterTraits.push({
      name: "New Ability",
      type: "Feature",
      desc: "",
      isExpanded: true
    });
    saveSheet(false);
    renderMyTraits();
    closeModal("traitModal");
  }

  const traitRow = e.target.closest(".trait-pick-row");
  if (traitRow) {
    const name = traitRow.dataset.name;
    const url = traitRow.dataset.url;
    const type = traitRow.dataset.type || "Feature";
    let detail = allTraitsCache.find((t) => t.name.toLowerCase() === name.toLowerCase());

    if (url && (!detail || !detail.desc)) {
      const fetched = await fetchAPI("https://www.dnd5eapi.co" + url);
      if (fetched) {
        detail = {
          name: fetched.name,
          type: type,
          desc: Array.isArray(fetched.desc) ? fetched.desc.join("\n\n") : (fetched.desc || "")
        };
      }
    }

    myCharacterTraits.push(detail || {
      name: name,
      type: type,
      desc: ""
    });

    saveSheet(false);
    renderMyTraits();
    closeModal("traitModal");
  }

  if (e.target.id === "addWeaponBtn") {
    myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    saveSheet(false);
    renderWeapons();
  }

  if (e.target.classList.contains("weapon-delete-btn")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCharacterWeapons.splice(idx, 1);
    while (myCharacterWeapons.length < 2) myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    saveSheet(false);
    renderWeapons();
  }

  if (e.target.classList.contains("trait-card-delete")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCharacterTraits.splice(idx, 1);
    saveSheet(false);
    renderMyTraits();
  }

  if (e.target.classList.contains("trait-expand-btn")) {
    const card = e.target.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    const isExp = card.classList.contains("expanded");
    e.target.textContent = isExp ? "Collapse" : "Expand";
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = isExp;
    saveSheet(true);
  }

  if (e.target.classList.contains("spell-card-delete")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCharacterSpells.splice(idx, 1);
    saveSheet(false);
    renderMySpells();
  }

  if (e.target.classList.contains("char-delete-btn")) {
    const row = e.target.closest(".char-item-row");
    const roster = getRoster();
    if (confirm(`Delete character "${roster[row.dataset.id]?.name || "Unnamed"}"?`)) {
      delete roster[row.dataset.id];
      saveRoster(roster);
      if (activeCharId === row.dataset.id) {
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
  } else if (e.target.closest(".char-item-info") || e.target.classList.contains("char-select-btn")) {
    const row = e.target.closest(".char-item-row");
    const roster = getRoster();
    activeCharId = row.dataset.id;
    localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
    applyCharacterData(roster[activeCharId]);
    closeModal("loadModal");
    showStatus("Character Loaded");
  }
});

// Dropdown input listeners
document.getElementById("charClass")?.addEventListener("focus", (e) => {
  renderClassDropdown(e.target.value);
  document.getElementById("classDropdown")?.classList.add("open");
});

document.getElementById("charClass")?.addEventListener("input", (e) => {
  renderClassDropdown(e.target.value);
  document.getElementById("classDropdown")?.classList.add("open");
});

document.getElementById("charRace")?.addEventListener("focus", (e) => {
  renderRaceDropdown(e.target.value);
  document.getElementById("raceDropdown")?.classList.add("open");
});

document.getElementById("charRace")?.addEventListener("input", (e) => {
  renderRaceDropdown(e.target.value);
  document.getElementById("raceDropdown")?.classList.add("open");
});

// Search & Filter Listeners
let spellFilterTimeout = null;
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearTimeout(spellFilterTimeout);
  spellFilterTimeout = setTimeout(() => {
    const filtered = allSpellsCache.filter((s) => s.name.toLowerCase().includes(query));
    renderModalSpells(filtered);
    enrichSpellList(filtered).then((changed) => {
      if (changed && document.getElementById("spellSearchInput")?.value.toLowerCase().trim() === query) {
        renderModalSpells(filtered);
      }
    });
  }, 120);
});

let traitFilterTimeout = null;
document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearTimeout(traitFilterTimeout);
  traitFilterTimeout = setTimeout(() => {
    const filtered = allTraitsCache.filter((t) => {
      const matchName = t.name.toLowerCase().includes(query);
      const matchClass = (t.classes || []).some(c => c.toLowerCase().includes(query));
      const matchRace = (t.races || []).some(r => r.toLowerCase().includes(query));
      return matchName || matchClass || matchRace;
    });
    renderModalTraits(filtered);
  }, 120);
});

document.getElementById("filterSpellbookInput")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll(".spell-card").forEach((card) => {
    const title = card.querySelector(".spell-custom-title-input")?.value.toLowerCase() || "";
    const desc = card.querySelector(".spell-custom-desc-textarea")?.value.toLowerCase() || "";
    if (!q || title.includes(q) || desc.includes(q)) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
});

document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet(false);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field") && e.target.type !== "checkbox") {
    recalculateAll();
    saveSheet(true);
  }

  if (e.target.classList.contains("spell-stat-input")) {
    autoResizeStatInput(e.target);
  }

  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    if (card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterSpells[idx]) {
        myCharacterSpells[idx][e.target.dataset.prop] = e.target.value;
        saveSheet(true);
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }

  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    if (card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterTraits[idx]) {
        myCharacterTraits[idx][e.target.dataset.prop] = e.target.value;
        saveSheet(true);
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }

  if (e.target.classList.contains("wpn-field")) {
    const entry = e.target.closest(".attack-entry");
    if (entry) {
      const idx = parseInt(entry.dataset.index, 10);
      if (myCharacterWeapons[idx]) {
        myCharacterWeapons[idx][e.target.dataset.prop] = e.target.value;
        saveSheet(true);
      }
    }
  }
});

document.addEventListener("focusout", (e) => {
  if (
    e.target.classList.contains("save-field") ||
    e.target.classList.contains("custom-spell-field") ||
    e.target.classList.contains("custom-trait-field") ||
    e.target.classList.contains("wpn-field")
  ) {
    if (e.target.type !== "checkbox") {
      saveSheet(false);
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllModals();
  }
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
        roster[parsed.character.id || "char_1"] = parsed.character;
      }
      saveRoster(roster);
      loadSheet();
      showStatus("Sheet Restored!");
    } catch (err) {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
});

loadSheet();
renderMyTraits();
loadAllSpells();
loadAllTraits();
