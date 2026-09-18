import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIKe_hrxyQvn4uebwU5OZrP2qf-FwK0Rg",
  authDomain: "character-sheet-bd250.firebaseapp.com",
  projectId: "character-sheet-bd250",
  storageBucket: "character-sheet-bd250.firebasestorage.app",
  messagingSenderId: "881155587941",
  appId: "1:881155587941:web:45087fba9dc7154fddeb8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";

let myCharacterSpells = [];
let myCharacterTraits = [];
let myCharacterWeapons = [
  { name: "", dmg: "", dmg_type: "", notes: "" },
  { name: "", dmg: "", dmg_type: "", notes: "" }
];
let diceRollHistory = [];

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

let allClassesCache = [];
let allRacesCache = [];

// ==========================================
// 1. HARDCODED DATABASES FOR SETUP WIZARDS
// ==========================================

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
    proficiencies: ["Light armor", "Medium armor", "Shields", "Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears", "Herbalism kit"],
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
    proficiencies: ["Simple weapons", "Shortswords"],
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
  dwarf: { speed: 25, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Dwarven Resilience", type: "Racial Trait", desc: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
    { name: "Stonecunning", type: "Racial Trait", desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, you add double your proficiency bonus." }
  ]},
  elf: { speed: 30, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Keen Senses", type: "Racial Trait", desc: "You have proficiency in the Perception skill." },
    { name: "Fey Ancestry", type: "Racial Trait", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
    { name: "Trance", type: "Racial Trait", desc: "Elves don't need to sleep. Instead, they meditate deeply for 4 hours a day." }
  ]},
  halfling: { speed: 25, traits: [
    { name: "Lucky", type: "Racial Trait", desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
    { name: "Brave", type: "Racial Trait", desc: "You have advantage on saving throws against being frightened." },
    { name: "Halfling Nimbleness", type: "Racial Trait", desc: "You can move through the space of any creature that is of a size larger than yours." }
  ]},
  human: { speed: 30, traits: [
    { name: "Versatile", type: "Racial Trait", desc: "Humans gain +1 to all ability scores and an extra language." }
  ]},
  dragonborn: { speed: 30, traits: [
    { name: "Draconic Ancestry", type: "Racial Trait", desc: "You have draconic ancestry. Your breath weapon and damage resistance are determined by dragon type.", hasVariants: true, url: "/api/traits/draconic-ancestry" },
    { name: "Breath Weapon", type: "Racial Trait", desc: "You can use your action to exhale destructive energy determined by your draconic ancestry." },
    { name: "Damage Resistance", type: "Racial Trait", desc: "You have resistance to the damage type associated with your draconic ancestry." }
  ]},
  gnome: { speed: 25, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Gnome Cunning", type: "Racial Trait", desc: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." }
  ]},
  "half-elf": { speed: 30, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Fey Ancestry", type: "Racial Trait", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
    { name: "Skill Versatility", type: "Racial Trait", desc: "You gain proficiency in two skills of your choice." }
  ]},
  "half-orc": { speed: 30, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Menacing", type: "Racial Trait", desc: "You gain proficiency in the Intimidation skill." },
    { name: "Relentless Endurance", type: "Racial Trait", desc: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead once per long rest." },
    { name: "Savage Attacks", type: "Racial Trait", desc: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage." }
  ]},
  tiefling: { speed: 30, traits: [
    { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Hellish Resistance", type: "Racial Trait", desc: "You have resistance to fire damage." },
    { name: "Infernal Legacy", type: "Racial Trait", desc: "You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for these spells." }
  ]}
};

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

const CLASS_SPELL_ABILITY = {
  "wizard": "INT", "sorcerer": "CHA", "bard": "CHA", "warlock": "CHA", 
  "paladin": "CHA", "cleric": "WIS", "druid": "WIS", "ranger": "WIS", 
  "artificer": "INT", "monk": "WIS", "fighter": "INT", "rogue": "INT"
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

// ==========================================
// 2. AUTHENTICATION (Firebase)
// ==========================================

onAuthStateChanged(auth, async (user) => {
  const authGroup = document.getElementById("authNavGroup");
  if (user) {
    currentUser = user;
    authGroup.innerHTML = `
      <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">${user.email}</span>
      <button class="btn outline blue" id="logoutBtn" type="button" style="border:1px solid #94a3b8; background:transparent;">Log Out</button>
    `;
    
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await signOut(auth);
      localStorage.removeItem(ROSTER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CHAR_ID_KEY);
      window.location.reload(); // Wipes memory and forces a clean slate
    });
    
    try {
      const docSnap = await getDoc(doc(db, "user_rosters", user.uid));
      if (docSnap.exists()) {
         const cloudData = docSnap.data().data;
         localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(cloudData));
      } else {
         saveRoster(getRoster());
      }
      loadSheet();
    } catch (e) { console.error("Cloud pull failed", e); }
    
  } else {
    currentUser = null;
    authGroup.innerHTML = `
      <button class="btn outline blue" id="loginNavBtn" type="button" style="border:1px solid #94a3b8; background:transparent;">Log In</button>
      <button class="btn red" id="signupNavBtn" type="button">Sign Up</button>
    `;
    document.getElementById("loginNavBtn").addEventListener("click", () => openAuthModal("login"));
    document.getElementById("signupNavBtn").addEventListener("click", () => openAuthModal("signup"));
    loadSheet();
  }
});

let authMode = "login";
function openAuthModal(mode) {
   authMode = mode;
   document.getElementById("authModalTitle").textContent = mode === "login" ? "Sign In" : "Create Account";
   document.getElementById("authSubmitBtn").textContent = mode === "login" ? "Log In" : "Sign Up";
   document.getElementById("authError").style.display = "none";
   document.getElementById("authPassword").value = "";
   document.getElementById("authModal").classList.add("open");
}

document.getElementById("authSubmitBtn")?.addEventListener("click", async () => {
   const email = document.getElementById("authEmail").value;
   const pass = document.getElementById("authPassword").value;
   const errEl = document.getElementById("authError");
   errEl.style.display = "none";

   try {
       if (authMode === "login") {
           await signInWithEmailAndPassword(auth, email, pass);
       } else {
           await createUserWithEmailAndPassword(auth, email, pass);
       }
       document.getElementById("authModal").classList.remove("open");
   } catch (err) {
       errEl.textContent = err.message.replace("Firebase: ", "");
       errEl.style.display = "block";
   }
});

document.getElementById("googleAuthBtn")?.addEventListener("click", async () => {
   const provider = new GoogleAuthProvider();
   const errEl = document.getElementById("authError");
   errEl.style.display = "none";
   try {
       await signInWithPopup(auth, provider);
       document.getElementById("authModal").classList.remove("open");
   } catch (err) {
       errEl.textContent = err.message.replace("Firebase: ", "");
       errEl.style.display = "block";
   }
});

document.getElementById("closeAuthModal")?.addEventListener("click", () => {
    document.getElementById("authModal").classList.remove("open");
});

// ==========================================
// 3. UTILITIES & CALCULATIONS
// ==========================================

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

function autoExpandTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
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
    if (modElem) {
      modElem.textContent = mod >= 0 ? `+${mod}` : mod;
    }

    const isSaveChecked = document.getElementById(`save_${stat}`)?.checked;
    const saveValElem = document.getElementById(`save_val_${stat}`);
    if (saveValElem) {
      saveValElem.textContent = isSaveChecked ? mod + prof : mod;
    }
  });

  // Skills Calculation
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

// ==========================================
// 4. DATA SAVING / LOADING
// ==========================================

function getRoster() {
  try { return JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)) || {}; } 
  catch (e) { return {}; }
}

async function saveRoster(roster) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  if (currentUser) {
    try {
      await setDoc(doc(db, "user_rosters", currentUser.uid), { data: roster });
    } catch (e) {
      console.error("Cloud save failed", e);
    }
  }
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
    { name: "", dmg: "", dmg_type: "", notes: "" },
    { name: "", dmg: "", dmg_type: "", notes: "" }
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
    else if (field.classList.contains("attr-score-input")) field.value = 10;
    else if (field.id === "charSpeed") field.value = 30;
    else if (field.classList.contains("dual-input") || field.classList.contains("coin-input") || field.classList.contains("slot-input")) field.value = 0;
    else field.value = "";
  });

  myCharacterSpells = [];
  myCharacterTraits = [];
  myCharacterWeapons = [{ name: "", dmg: "", dmg_type: "", notes: "" }, { name: "", dmg: "", dmg_type: "", notes: "" }];
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

// Global UI Listeners
document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
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

document.getElementById("loadBtn")?.addEventListener("click", () => {
  renderCharList();
  document.getElementById("loadModal")?.classList.add("open");
});
document.getElementById("closeLoadModal")?.addEventListener("click", () => document.getElementById("loadModal")?.classList.remove("open"));

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

document.getElementById("helpLinkBtn")?.addEventListener("click", () => document.getElementById("helpModal")?.classList.add("open"));
document.getElementById("closeHelpModal")?.addEventListener("click", () => document.getElementById("helpModal")?.classList.remove("open"));

// Tabbing Logic
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

// Resting
document.getElementById("longRestBtn")?.addEventListener("click", () => {
  if (confirm("Take a Long Rest? This restores all HP, Hit Dice, and Spell Slots.")) {
    const maxHp = document.getElementById("maxHp")?.value || 0;
    if (document.getElementById("curHp")) document.getElementById("curHp").value = maxHp;
    
    const maxHd = document.getElementById("hitDiceMax")?.value || 0;
    if (document.getElementById("hitDiceCur")) document.getElementById("hitDiceCur").value = maxHd;
    
    for (let i = 1; i <= 9; i++) {
      let cur = document.getElementById(`slot${i}_cur`);
      let max = document.getElementById(`slot${i}_max`);
      if (cur && max) cur.value = max.value;
    }
    saveSheet();
    showStatus("Rested!");
  }
});
document.getElementById("shortRestBtn")?.addEventListener("click", () => {
  if (confirm("Take a Short Rest? Use your hit dice to heal!")) showStatus("Rested!");
});

// ==========================================
// 5. DICE ROLLER
// ==========================================

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

// ==========================================
// 6. WEAPONS TABLE
// ==========================================
document.getElementById("addWeaponBtn")?.addEventListener("click", () => {
  myCharacterWeapons.push({ name: "", dmg: "", dmg_type: "", notes: "" });
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
      myCharacterWeapons.push({ name: "", dmg: "", dmg_type: "", notes: "" });
    }
    saveSheet();
    renderWeapons();
  }
});

// ==========================================
// 7. SETUP WIZARDS (Hardcoded)
// ==========================================
let loadoutState = {
  equipOptions: [],
  profOptions: [],
  weaponsList: [],
  gearList: [],
  selectedSkills: [],
  traitChoiceOptions: [],
  traitsToAdd: [],
  spellsToAdd: [],
  isSingleAbility: false,
  history: []
};

const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const raceInput = document.getElementById("charRace");
const raceDropdown = document.getElementById("raceDropdown");
const choiceModal = document.getElementById("choiceModal");
const choiceModalBody = document.getElementById("choiceModalBody");
const choiceModalTitle = document.getElementById("choiceModalTitle");

document.getElementById("skipSetupBtn")?.addEventListener("click", () => {
    document.getElementById("choiceModal")?.classList.remove("open");
});
document.getElementById("closeChoiceModal")?.addEventListener("click", () => {
  document.getElementById("choiceModal")?.classList.remove("open");
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("open"));
  }
});

function renderDropdown(dropdownEl, items, filter = "", customId, customText) {
  if (!dropdownEl) return;
  const q = filter.toLowerCase().trim();
  const filtered = items.filter(i => i.name.toLowerCase().includes(q));
  let html = filtered.map(i => `<div class="dropdown-item" data-index="${i.index}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}</div>`).join("");
  html += `<div class="dropdown-item" style="color:#dc2626; text-align:center; border-top:1px solid #3b4c68;" id="${customId}">${customText}</div>`;
  dropdownEl.innerHTML = html;
}

classInput?.addEventListener("click", () => {
  if (!classDropdown.classList.contains("open")) {
    if (allClassesCache.length === 0) allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
    renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
    classDropdown.classList.add("open");
  }
});

classInput?.addEventListener("input", () => {
  if (allClassesCache.length === 0) allClassesCache = Object.keys(SRD_CLASS_EQUIPMENT).map(k => ({ index: k, name: SRD_CLASS_EQUIPMENT[k].name }));
  renderDropdown(classDropdown, allClassesCache, classInput.value, "addCustomClassOption", "+ Add Custom Class");
  classDropdown.classList.add("open");
});

raceInput?.addEventListener("click", () => {
  if (!raceDropdown.classList.contains("open")) {
    if (allRacesCache.length === 0) allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
    renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
    raceDropdown.classList.add("open");
  }
});

raceInput?.addEventListener("input", () => {
  if (allRacesCache.length === 0) allRacesCache = Object.keys(SRD_RACE_DATA).map(k => ({ index: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
  renderDropdown(raceDropdown, allRacesCache, raceInput.value, "addCustomRaceOption", "+ Add Custom Race");
  raceDropdown.classList.add("open");
});

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

classDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  if (item.id === "addCustomClassOption") {
    classInput.value = ""; classInput.focus();
    classDropdown.classList.remove("open"); return;
  }
  const className = item.dataset.name;
  const classIdx = item.dataset.index.toLowerCase();
  classInput.value = className;
  classDropdown.classList.remove("open");
  saveSheet();

  const data = SRD_CLASS_EQUIPMENT[classIdx];
  if (!data) return;
  
  activeClassLoadout = JSON.parse(JSON.stringify(data));
  activeClassLoadout.selectedChoices = [];
  choiceModalTitle.textContent = `${className} Starting Loadout`;

  const hdMax = document.getElementById("hitDiceMax");
  const hdCur = document.getElementById("hitDiceCur");
  if (hdMax) hdMax.value = `1d${data.hitDie}`;
  if (hdCur) hdCur.value = `1`;

  const sAbility = CLASS_SPELL_ABILITY[classIdx];
  if (sAbility) {
      const el = document.getElementById("spellAbility");
      if (el && !el.value) el.value = sAbility;
  }

  let html = `<div class="wizard-intro" style="text-transform: uppercase; font-weight: 700; border-bottom: 1.5px solid #3b4c68; margin-bottom: 0.5rem; padding-bottom: 0.5rem;">Granted Equipment</div>`;
  if (activeClassLoadout.fixed.length > 0) {
    html += `<ul style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem; list-style: none; margin-bottom: 1.5rem;">`;
    activeClassLoadout.fixed.forEach(i => {
      html += `<li style="background: #080d18; border: 1px solid #1e293b; padding: 0.5rem 0.85rem; border-left: 3px solid #dc2626; border-radius: 6px;">${i.qty > 1 ? i.qty + 'x ' : ''}${escapeHtml(i.name)}</li>`;
    });
    html += `</ul>`;
  } else html += `<p style="color:#64748b; font-size:0.9rem; margin-bottom: 1.5rem;">None</p>`;

  activeClassLoadout.choices.forEach((choiceGroup, gIdx) => {
    html += `
      <div style="background: #0d1322; border: 1.5px solid #1e293b; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem;" id="choice-group-${gIdx}">
        <div style="color: #34d399; font-weight: 700; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.04em;">${escapeHtml(choiceGroup.desc)}</div>
        <div class="equip-options-grid">
    `;
    choiceGroup.options.forEach((opt, oIdx) => {
      const tooltipLines = opt.items.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.name}${i.desc ? ' (' + i.desc + ')' : ''}`).join('<br>');
      html += `
        <div class="choice-option-wrapper">
          <button type="button" class="choice-option-btn" data-group="${gIdx}" data-option="${oIdx}">
            <strong>${escapeHtml(opt.label)}</strong>
            <span class="subtext">${tooltipLines}</span>
          </button>
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
        b.style.background = "linear-gradient(145deg, #151d2f, #0d1322)";
      });
      btn.style.borderColor = "#dc2626";
      btn.style.background = "linear-gradient(145deg, #3f0f0f, #151d2f)";
      activeClassLoadout.selectedChoices[gIdx] = oIdx;
    }
    if (e.target.id === "confirmLoadoutBtn") finalizeSelectedLoadout();
  });
});

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

  while (weaponsList.length < 2) weaponsList.push({ name: "", atk: "", dmg: "", notes: "" });
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

raceDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.id === "addCustomRaceOption") {
    raceInput.value = ""; raceInput.focus();
    raceDropdown.classList.remove("open"); return;
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
      if (raceIdx === "dragonborn") {
        loadoutState = { traitChoiceOptions: [raceInfo.traits[0]], traitsToAdd: [], isSingleAbility: true, history: [] };
        choiceModal.classList.add("open");
        runTraitVariantStep();
      } else {
        let featText = `Racial Traits:\n`;
        raceInfo.traits.forEach(t => { featText += `- ${t.name}: ${t.desc}\n`; });
        const featBox = document.getElementById("featuresTraits");
        if (featBox) {
          const cur = featBox.value.trim();
          featBox.value = cur ? cur + "\n\n" + featText.trim() : featText.trim();
          autoExpandTextarea(featBox);
        }
        showStatus("Racial abilities loaded!");
      }
    }
    saveSheet();
  }
});

function runTraitVariantStep() {
  if (!loadoutState.traitChoiceOptions || loadoutState.traitChoiceOptions.length === 0) {
    choiceModal.classList.remove("open");
    let featText = `Racial Traits:\n`;
    loadoutState.traitsToAdd.forEach(t => { featText += `- ${t.name}: ${t.desc}\n`; });
    const featBox = document.getElementById("featuresTraits");
    if (featBox) {
      const cur = featBox.value.trim();
      featBox.value = cur ? cur + "\n\n" + featText.trim() : featText.trim();
      autoExpandTextarea(featBox);
    }
    saveSheet();
    return;
  }

  const traitObj = loadoutState.traitChoiceOptions[0];
  choiceModalTitle.textContent = `Choose Variant: ${traitObj.name}`;
  
  let optionsArr = [];
  if (traitObj.name === "Draconic Ancestry") {
    optionsArr = Object.keys(DRAGON_ANCESTRY_MAP).map(k => ({ name: k }));
  }

  let html = `
    <div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">
      <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">✨</span>
      Select your ${escapeHtml(traitObj.name)} variant:
    </div>
    <div class="equip-options-grid">
  `;
  optionsArr.forEach((opt, idx) => {
    html += `
      <div class="choice-option-wrapper">
        <button type="button" class="choice-option-btn trait-variant-btn" data-name="${escapeHtml(opt.name)}">
          <strong>${escapeHtml(opt.name)}</strong>
        </button>
      </div>
    `;
  });
  html += `</div>`;

  choiceModalBody.innerHTML = html;
  const newBody = choiceModalBody.cloneNode(true);
  choiceModalBody.parentNode.replaceChild(newBody, choiceModalBody);
  
  newBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".trait-variant-btn");
    if (!btn) return;
    
    let selectedName = btn.dataset.name;
    let dragon = DRAGON_ANCESTRY_MAP[selectedName];
    
    if (traitObj.name === "Draconic Ancestry" && dragon) {
      const rInp = document.getElementById("charRace");
      if (rInp) rInp.value = `${selectedName} Dragonborn`;
      
      loadoutState.traitsToAdd.push({
        name: `Draconic Ancestry (${selectedName})`,
        desc: `You have resistance to ${dragon.damage} damage.`
      });
      loadoutState.traitsToAdd.push({
        name: `Breath Weapon (${dragon.damage})`,
        desc: `Exhale destructive energy (${dragon.breath}, ${dragon.damage}). Save: ${dragon.save}.`
      });
    }

    loadoutState.traitChoiceOptions.shift();
    runTraitVariantStep();
  });
}

// ==========================================
// 8. SPELL & TRAIT BROWSERS (API)
// ==========================================
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
  
  if (combined.length > 0) {
      return combined.filter(t => !t.name.includes("Dragon Ancestor (") && !t.name.includes("Draconic Ancestry ("));
  }
  return COMMON_TRAITS.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));
}

async function fetchDetailedSpells(matches) {
  const top = matches.slice(0, 15);
  return await Promise.all(top.map(async m => {
    if (m.url && !m.fetchedDetails) {
      const det = await fetchAPI("https://www.dnd5eapi.co" + m.url);
      if (det) {
        let hasVariants = !!(det.damage_type_options || det.choice);
        return { 
          ...m, 
          levelTag: det.level === 0 ? "Cantrip" : `Level ${det.level}`,
          schoolTag: det.school?.name,
          classesTag: det.classes?.map(c => c.name).join(", "),
          hasVariants: hasVariants,
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
        let pTag = "";
        let specific = det.trait_specific || det.feature_specific || det.choice;
        let hasVariants = !!(specific && (specific.subtrait_options || specific.spell_options || specific.damage_type_options || specific.choice || specific.breath_weapon_options || specific.subfeature_options || specific.expertise_options || specific.from));
        if (det.name === "Breath Weapon") hasVariants = true;

        return { 
          ...m, 
          type: m.url.includes("/features/") ? "Class Feature" : "Racial Trait",
          parentTag: pTag,
          hasVariants: hasVariants,
          fetchedDetails: true
        };
      }
    }
    return m;
  }));
}

function renderMyTraits() {
  const container = document.getElementById("traitsList");
  if (!container) return;

  if (myCharacterTraits.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.85rem; color: #64748b; font-style: italic;">No skills/abilities added yet. Click "+ Add Ability" above to add one.</p>`;
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
    saveSheet(); renderMyTraits(); return;
  }
  const expandBtn = e.target.closest(".trait-expand-btn");
  if (expandBtn) {
    e.stopPropagation();
    const card = expandBtn.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    expandBtn.textContent = card.classList.contains("expanded") ? "Collapse" : "Expand";
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = card.classList.contains("expanded");
    saveSheet(); return;
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
    if (trait.hasVariants) tagsHtml += `<span class="tag-pill orange">Variants</span>`;
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
  const detailed = await fetchDetailedTraits(results);
  renderModalTraitsList(detailed);
});

document.getElementById("closeTraitModal")?.addEventListener("click", () => document.getElementById("traitModal")?.classList.remove("open"));

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
  saveSheet(); renderMyTraits(); document.getElementById("traitModal")?.classList.remove("open");
});

document.getElementById("traitApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".trait-option-item");
  if (!row) return;

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  let detail = null;
  if (row.dataset.url) detail = await fetchAPI("https://www.dnd5eapi.co" + row.dataset.url);

  let hasVariants = false;
  let specific = detail?.trait_specific || detail?.feature_specific || detail?.choice;
  if (specific && (specific.subtrait_options || specific.spell_options || specific.damage_type_options || specific.choice || specific.breath_weapon_options || specific.subfeature_options || specific.expertise_options || specific.from)) hasVariants = true;
  if (detail?.name === "Breath Weapon") {
      hasVariants = true;
      detail.choice = { from: { options: Object.keys(DRAGON_ANCESTRY_MAP).map(c => ({ item: { name: c } })) } };
  }

  if (hasVariants) {
      loadoutState = { traitChoiceOptions: [{ ...detail, isSpell: false }], traitsToAdd: [], isSingleAbility: true, history: [] };
      document.getElementById("traitModal")?.classList.remove("open");
      if (badge) badge.textContent = "+ Add";
      choiceModal.classList.add("open");
      runTraitVariantStep();
      return;
  }

  let finalDesc = "Description not available.";
  if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "");

  myCharacterTraits.push({
    name: row.dataset.name,
    type: row.dataset.type || "Feature",
    desc: finalDesc,
    isExpanded: false
  });
  saveSheet(); renderMyTraits(); document.getElementById("traitModal")?.classList.remove("open");
  if (badge) badge.textContent = "+ Add";
});

// Spell logic
function renderModalSpellsList(matches) {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  if (matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }
  container.innerHTML = matches.map((spell) => {
    let lvlTag = spell.levelTag || "Spell";
    let tagsHtml = `<span class="tag-pill green">${escapeHtml(lvlTag)}</span>`;
    if (spell.schoolTag) tagsHtml += `<span class="tag-pill purple">${escapeHtml(spell.schoolTag)}</span>`;
    if (spell.classesTag) tagsHtml += `<span class="tag-pill blue" style="opacity:0.8;">${escapeHtml(spell.classesTag)}</span>`;
    if (spell.hasVariants) tagsHtml += `<span class="tag-pill orange">Variants</span>`;
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
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) { e.preventDefault(); return; }
      draggedSpellIndex = parseInt(card.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", draggedSpellIndex);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".spell-card").forEach(c => c.classList.remove("drag-over"));
      draggedSpellIndex = null;
    });
    card.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    card.addEventListener("dragenter", () => {
      if (draggedSpellIndex !== null && parseInt(card.dataset.index, 10) !== draggedSpellIndex) card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => { card.classList.remove("drag-over"); });
    card.addEventListener("drop", (e) => {
      e.preventDefault(); card.classList.remove("drag-over");
      if (draggedSpellIndex === null) return;
      const targetIndex = parseInt(card.dataset.index, 10);
      if (draggedSpellIndex === targetIndex) return;
      const movedSpell = myCharacterSpells.splice(draggedSpellIndex, 1)[0];
      myCharacterSpells.splice(targetIndex, 0, movedSpell);
      saveSheet(); renderMySpells();
    });

    const handle = card.querySelector(".spell-drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", () => {
        touchDraggedIndex = parseInt(card.dataset.index, 10); card.classList.add("dragging");
      }, { passive: true });
      handle.addEventListener("touchmove", (e) => {
        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCard = targetElement ? targetElement.closest(".spell-card") : null;
        document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
        if (targetCard && targetCard !== card) {
          targetCard.classList.add("drag-over"); currentDropTarget = targetCard;
        } else currentDropTarget = null;
      });
      handle.addEventListener("touchend", () => {
        card.classList.remove("dragging");
        document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
        if (touchDraggedIndex !== null && currentDropTarget) {
          const targetIndex = parseInt(currentDropTarget.dataset.index, 10);
          if (touchDraggedIndex !== targetIndex) {
            const moved = myCharacterSpells.splice(touchDraggedIndex, 1)[0];
            myCharacterSpells.splice(targetIndex, 0, moved); saveSheet(); renderMySpells();
          }
        }
        touchDraggedIndex = null; currentDropTarget = null;
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
  const detailed = await fetchDetailedSpells(results);
  renderModalSpellsList(detailed);
});

document.getElementById("closeSpellModal")?.addEventListener("click", () => document.getElementById("spellModal")?.classList.remove("open"));

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
  saveSheet(); renderMySpells(); document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".spell-add-item");
  if (!row) return;

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  let detail = null;
  if (row.dataset.url) detail = await fetchAPI("https://www.dnd5eapi.co" + row.dataset.url);

  let hasVariants = !!(detail?.damage_type_options || detail?.choice);
  if (hasVariants) {
      loadoutState = { traitChoiceOptions: [{ ...detail, isSpell: true }], spellsToAdd: [], isSingleAbility: true, history: [] };
      document.getElementById("spellModal")?.classList.remove("open");
      if (badge) badge.textContent = "+ Add";
      choiceModal.classList.add("open");
      runTraitVariantStep();
      return;
  }

  let finalDesc = "Description not available.";
  let finalType = "Spell"; let finalCast = "1 Action"; let finalRange = "30 ft"; let finalDur = "Instantaneous";

  if (detail) {
      finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "");
      if (detail.higher_level) finalDesc += "\n\nAt Higher Levels: " + (Array.isArray(detail.higher_level) ? detail.higher_level.join(" ") : detail.higher_level);
      finalType = detail.level === 0 ? "Cantrip" : `Level ${detail.level} ${detail.school?.name || ""}`.trim();
      finalCast = detail.casting_time || finalCast;
      finalRange = detail.range || finalRange;
      finalDur = detail.duration || finalDur;
  }

  myCharacterSpells.push({
    name: row.dataset.name, type: finalType, casting_time: finalCast, range: finalRange, duration: finalDur, desc: finalDesc
  });

  saveSheet(); renderMySpells(); document.getElementById("spellModal")?.classList.remove("open");
  if (badge) badge.textContent = "+ Add";
});

document.getElementById("spellsList")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    const idx = parseInt(card.dataset.index, 10);
    if (myCharacterSpells[idx]) {
      myCharacterSpells[idx][e.target.dataset.prop] = e.target.value; saveSheet();
    }
    if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
  }
});

document.getElementById("spellsList")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("spell-card-delete")) {
    myCharacterSpells.splice(parseInt(e.target.dataset.index, 10), 1);
    saveSheet(); renderMySpells();
  }
});

// Initialization
loadSheet();
renderMyTraits();
