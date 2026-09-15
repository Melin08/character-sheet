"use strict";

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";

let allSpellsCache = [];
let allClassesCache = [];
let allRacesCache = [];
let allTraitsCache = [];
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

// Built-in SRD 5e Spells Backup Catalog so it never hangs
const SRD_SPELLS_BACKUP = [
  { name: "Fire Bolt", level: 0, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage." },
  { name: "Mage Hand", level: 0, school: "Conjuration", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "A spectral, floating hand appears at a point you choose within range. You can use your action to control the hand." },
  { name: "Eldritch Blast", level: 0, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage." },
  { name: "Vicious Mockery", level: 0, school: "Enchantment", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "You unleash a string of insults laced with subtle enchantments at one creature you can see. If it fails a Wisdom saving throw, it takes 1d4 psychic damage and has disadvantage on its next attack." },
  { name: "Magic Missile", level: 1, school: "Evocation", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range, dealing 1d4 + 1 force damage." },
  { name: "Shield", level: 1, school: "Abjuration", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack." },
  { name: "Cure Wounds", level: 1, school: "Evocation", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier." },
  { name: "Healing Word", level: 1, school: "Evocation", casting_time: "1 Bonus Action", range: "60 ft", duration: "Instantaneous", desc: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier." },
  { name: "Misty Step", level: 2, school: "Conjuration", casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see." },
  { name: "Fireball", level: 3, school: "Evocation", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere must make a Dex save or take 8d6 fire damage." }
];

// Official 5e SRD Fallback Database to guarantee immediate pop-up
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
  dwarf: { speed: 25, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Dwarven Resilience", type: "Racial", desc: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
    { name: "Stonecunning", type: "Racial", desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, you add double your proficiency bonus." }
  ]},
  elf: { speed: 30, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Keen Senses", type: "Racial", desc: "You have proficiency in the Perception skill." },
    { name: "Fey Ancestry", type: "Racial", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
    { name: "Trance", type: "Racial", desc: "Elves don't need to sleep. Instead, they meditate deeply for 4 hours a day." }
  ]},
  halfling: { speed: 25, traits: [
    { name: "Lucky", type: "Racial", desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
    { name: "Brave", type: "Racial", desc: "You have advantage on saving throws against being frightened." },
    { name: "Halfling Nimbleness", type: "Racial", desc: "You can move through the space of any creature that is of a size larger than yours." }
  ]},
  human: { speed: 30, traits: [
    { name: "Versatile", type: "Racial", desc: "Humans gain +1 to all ability scores and an extra language." }
  ]},
  dragonborn: { speed: 30, traits: [
    { name: "Draconic Ancestry", type: "Racial", desc: "You have draconic ancestry. Your breath weapon and damage resistance are determined by dragon type." },
    { name: "Breath Weapon", type: "Racial", desc: "You can use your action to exhale destructive energy determined by your draconic ancestry." },
    { name: "Damage Resistance", type: "Racial", desc: "You have resistance to the damage type associated with your draconic ancestry." }
  ]},
  gnome: { speed: 25, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Gnome Cunning", type: "Racial", desc: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." }
  ]},
  "half-elf": { speed: 30, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Fey Ancestry", type: "Racial", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
    { name: "Skill Versatility", type: "Racial", desc: "You gain proficiency in two skills of your choice." }
  ]},
  "half-orc": { speed: 30, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Menacing", type: "Racial", desc: "You gain proficiency in the Intimidation skill." },
    { name: "Relentless Endurance", type: "Racial", desc: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead once per long rest." },
    { name: "Savage Attacks", type: "Racial", desc: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage." }
  ]},
  tiefling: { speed: 30, traits: [
    { name: "Darkvision", type: "Racial", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    { name: "Hellish Resistance", type: "Racial", desc: "You have resistance to fire damage." },
    { name: "Infernal Legacy", type: "Racial", desc: "You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for these spells." }
  ]}
};

const SRD_GENERAL_FEATURES = [
  { name: "Rage", type: "Class Ability", desc: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action." },
  { name: "Reckless Attack", type: "Class Ability", desc: "Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation." },
  { name: "Action Surge", type: "Class Ability", desc: "On your turn, you can take one additional action on top of your regular action and possible bonus action." },
  { name: "Second Wind", type: "Class Ability", desc: "You have a limited well of stamina. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level." },
  { name: "Sneak Attack", type: "Class Ability", desc: "Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction to deal extra damage." },
  { name: "Cunning Action", type: "Class Ability", desc: "Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action to Dash, Disengage, or Hide." },
  { name: "Divine Smite", type: "Class Ability", desc: "Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target." },
  { name: "Lay on Hands", type: "Class Ability", desc: "Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest." },
  { name: "Wild Shape", type: "Class Ability", desc: "Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before." },
  { name: "Bardic Inspiration", type: "Class Ability", desc: "You can inspire others through stirring words or music. Use a bonus action on your turn to choose one creature other than yourself within 60 feet." },
  { name: "Channel Divinity", type: "Class Ability", desc: "You gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects." },
  { name: "Flurry of Blows", type: "Class Ability", desc: "Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action." },
  { name: "Pact Magic", type: "Class Ability", desc: "Your arcane research and the magic bestowed on you by your patron have given you facility with spells." },
  { name: "Arcane Recovery", type: "Class Ability", desc: "Once per day when you finish a short rest, you can choose expended spell slots to recover." },
  { name: "Alert", type: "Feat", desc: "Always on the lookout for danger. You gain a +5 bonus to initiative and you can't be surprised while you are conscious." },
  { name: "Lucky", type: "Feat", desc: "You have 3 luck points. Whenever you make an attack roll, an ability check, or a saving throw, you can spend one luck point to roll an additional d20." },
  { name: "War Caster", type: "Feat", desc: "You have advantage on Constitution saving throws that you make to maintain your concentration on a spell when you take damage." }
];

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
          myCharacterTraits.push({ name: t.name, type: t.type || "Racial", desc: t.desc || "" });
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
  if (e.target.classList.contains("modal-backdrop") || e.target.classList.contains("modal-close-btn") || e.target.id === "closeChoiceModal") {
    e.target.closest(".modal-backdrop")?.classList.remove("open");
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
    <div class="trait-card" data-index="${idx}">
      <div class="trait-card-header">
        <span class="trait-card-title">${escapeHtml(trait.name)}</span>
        <button class="trait-card-delete" data-index="${idx}" type="button" title="Remove ability">&times;</button>
      </div>
      <span class="trait-card-type">${escapeHtml(trait.type || "Ability")}</span>
      <div class="trait-card-snippet">${escapeHtml(trait.desc || "No description provided.")}</div>
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

  const card = e.target.closest(".trait-card");
  if (card) {
    card.classList.toggle("expanded");
  }
});

// Trait / Ability Search Modal with Timeout Fallback
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

async function fetchOfficialTraits() {
  if (allTraitsCache.length > 0) return;
  allTraitsCache = [...SRD_GENERAL_FEATURES];
  
  // Try fetching API with 2.5 second timeout so it never hangs
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://www.dnd5eapi.co/api/features", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const apiFeatures = (data.results || []).map(f => ({ name: f.name, type: "Feature", url: f.url }));
      allTraitsCache.push(...apiFeatures);
    }
  } catch (err) {
    // Falls back seamlessly to SRD features
  }
}

document.getElementById("addTraitBtn")?.addEventListener("click", async () => {
  const modal = document.getElementById("traitModal");
  modal?.classList.add("open");
  if (allTraitsCache.length === 0) {
    await fetchOfficialTraits();
  }
  renderModalTraits();
});

document.getElementById("closeTraitModal")?.addEventListener("click", () => {
  document.getElementById("traitModal")?.classList.remove("open");
});

document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  renderModalTraits(e.target.value);
});

document.getElementById("addCustomTraitBtn")?.addEventListener("click", () => {
  const customName = prompt("Enter ability name:") || "New Custom Ability";
  const customDesc = prompt("Enter ability description:") || "";
  myCharacterTraits.push({ name: customName, type: "Custom", desc: customDesc });
  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
});

document.getElementById("traitApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".trait-option-item");
  if (!row) return;

  const idx = parseInt(row.dataset.idx, 10);
  const selected = allTraitsCache[idx];
  if (!selected) return;

  let desc = selected.desc || "";
  if (!desc && selected.url) {
    try {
      const res = await fetch(`https://www.dnd5eapi.co${selected.url}`);
      if (res.ok) {
        const data = await res.json();
        desc = Array.isArray(data.desc) ? data.desc.join("\n\n") : (data.desc || "");
      }
    } catch (err) {
      desc = "No description available.";
    }
  }

  myCharacterTraits.push({
    name: selected.name,
    type: selected.type || "Feature",
    desc: desc || "No description provided."
  });

  saveSheet();
  renderMyTraits();
  document.getElementById("traitModal")?.classList.remove("open");
});

// Official Spells Implementation with Timeout Fallback
async function fetchOfficialSpells() {
  if (allSpellsCache.length > 0) return;
  allSpellsCache = [...SRD_SPELLS_BACKUP];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://www.dnd5eapi.co/api/spells", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      allSpellsCache = data.results || SRD_SPELLS_BACKUP;
    }
  } catch (err) {
    // Falls back to backup catalog
  }
}

async function fetchSpellDetails(spellIndex) {
  const localMatch = SRD_SPELLS_BACKUP.find(s => s.name.toLowerCase() === spellIndex.toLowerCase() || s.name.toLowerCase().replace(/\s+/g, '-') === spellIndex);
  if (localMatch) return localMatch;

  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/spells/${spellIndex}`);
    return await res.json();
  } catch (err) {
    return { name: spellIndex, level: 1, school: { name: "Magic" }, casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Custom spell" };
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

  container.innerHTML = matches.map(spell => `
    <div class="spell-option-item" data-index="${spell.index || spell.name.toLowerCase().replace(/\s+/g, '-')}" data-name="${escapeHtml(spell.name)}">
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
  const modal = document.getElementById("spellModal");
  modal?.classList.add("open");
  if (allSpellsCache.length === 0) {
    await fetchOfficialSpells();
  }
  renderModalSpells();
});

document.getElementById("closeSpellModal")?.addEventListener("click", () => {
  document.getElementById("spellModal")?.classList.remove("open");
});

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

document.getElementById("addCustomSpellBtn")?.addEventListener("click", () => {
  const customName = prompt("Enter spell name:") || "New Custom Spell";
  const customDesc = prompt("Enter spell description:") || "";
  myCharacterSpells.push({ name: customName, type: "1st Level", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: customDesc });
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
      type: `${details.level === 0 ? "Cantrip" : "Level " + details.level} ${details.school?.name || details.school || ""}`.trim(),
      casting_time: details.casting_time || "1 Action",
      range: details.range || "30 ft",
      duration: details.duration || "Instantaneous",
      desc: Array.isArray(details.desc) ? details.desc.join("\n\n") : (details.desc || "")
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

loadSheet();
renderMyTraits();
