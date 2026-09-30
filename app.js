"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyAIKe_hrxyQvn4uebwU5OZrP2qf-FwK0Rg",
  authDomain: "character-sheet-bd250.firebaseapp.com",
  projectId: "character-sheet-bd250",
  storageBucket: "character-sheet-bd250.firebasestorage.app",
  messagingSenderId: "881155587941",
  appId: "1:881155587941:web:45087fba9dc7154fddeb8c",
  measurementId: "G-E0LD6CXQ2W"
};

let auth = null;
let db = null;
let analytics = null;
let currentUser = null;

try {
  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    if (firebase.analytics) {
      analytics = firebase.analytics();
    }
  }
} catch (err) {
  console.warn("Firebase initialization skipped or failed:", err);
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
let myBlurredPills = [];
let diceRollHistory = [];

let draggedSpellIndex = null;
const apiCache = {};

let allSpellsCache = [];
let allTraitsCache = [];

const DND_CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer",
  "Warlock", "Wizard", "Artificer", "Blood Hunter"
];

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
  { name: "Hunter's Mark", levelTag: "Level 1", schoolTag: "Divination", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "90 ft", duration: "Concentration, up to 1 hour", desc: "You mark a creature as your quarry. Deal an extra 1d6 damage when hitting it with a weapon attack, and gain advantage on Perception or Survival checks to find it." },
  { name: "Hail of Thorns", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a ranged weapon attack, thorns rain down. Target and creatures within 5 feet take 1d10 piercing damage on a failed Dex save, or half on a success." },
  { name: "Zephyr Strike", levelTag: "Level 1", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Move like wind. Movement does not provoke opportunity attacks. Gain advantage on one attack roll dealing an extra 1d8 force damage and boost speed by 30 feet." },
  { name: "Ensnaring Strike", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit with a weapon attack, writhing thorny vines appear. The target must pass a Strength save or become restrained." },
  { name: "Goodberry", levelTag: "Level 1", schoolTag: "Transmutation", classesTag: "Druid, Ranger", casting_time: "1 Action", range: "Touch", duration: "24 hours", desc: "Ten berries appear in hand. Eating a berry restores 1 hit point and provides nourishment for a full day." },
  { name: "Absorb Elements", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Artificer, Druid, Ranger, Sorcerer, Wizard", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "Gain resistance to the triggering elemental damage type until next turn, and add 1d6 damage of that type to your next melee attack." },
  { name: "Fog Cloud", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Druid, Ranger, Sorcerer, Wizard, Triton", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 hour", desc: "Create a 20-foot-radius sphere of fog centered on a point. The sphere spreads around corners and heavily obscures the area." },
  { name: "Pass without Trace", levelTag: "Level 2", schoolTag: "Abjuration", classesTag: "Druid, Ranger, Earth Genasi", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 hour", desc: "A veil of shadows radiates from you. Each chosen creature within 30 feet gets +10 to Stealth checks and cannot be tracked by nonmagical means." },
  { name: "Spike Growth", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Druid, Ranger", casting_time: "1 Action", range: "150 ft", duration: "Concentration, up to 10 minutes", desc: "The ground twists into hard thorns. Any creature moving through takes 2d4 piercing damage for every 5 feet traveled." },
  { name: "Cordon of Arrows", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Action", range: "5 ft", duration: "8 hours", desc: "Plant four arrows or bolts in the ground. When an enemy steps within 30 feet, an arrow strikes for 1d6 piercing damage on a failed Dex save." },
  { name: "Silence", levelTag: "Level 2", schoolTag: "Illusion", classesTag: "Bard, Cleric, Ranger", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 10 minutes", desc: "No sound can pass through a 20-foot sphere. Creatures inside are deafened, immune to thunder damage, and cannot cast verbal spells." },
  { name: "Lesser Restoration", levelTag: "Level 2", schoolTag: "Abjuration", classesTag: "Artificer, Bard, Cleric, Druid, Paladin, Ranger", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "Touch a creature to end one disease or condition: blinded, deafened, paralyzed, or poisoned." },
  { name: "Conjure Animals", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Druid, Ranger", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 hour", desc: "Summon fey spirits taking the form of beasts that obey your verbal commands." },
  { name: "Conjure Barrage", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Action", range: "Self (60-ft cone)", duration: "Instantaneous", desc: "Throw a nonmagical weapon to unleash a storm of duplicates. Each creature in a 60-foot cone takes 3d8 damage on a failed Dex save." },
  { name: "Lightning Arrow", levelTag: "Level 3", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Your next ranged attack transforms into lightning, dealing 4d8 lightning damage on a hit, and 2d8 to targets within 10 feet on a failed Dex save." },
  { name: "Wind Wall", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Druid, Ranger", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "A gale up to 50 feet long and 15 feet high rises from the ground, deflecting arrows and small projectiles." },
  { name: "Guardian of Nature", levelTag: "Level 4", schoolTag: "Transmutation", classesTag: "Druid, Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Assume the form of a primal guardian: Primal Beast (speed boost, darkvision, Str advantage) or Great Tree (temp HP and Dex/Wis advantage)." },
  { name: "Freedom of Movement", levelTag: "Level 4", schoolTag: "Abjuration", classesTag: "Artificer, Bard, Cleric, Druid, Ranger", casting_time: "1 Action", range: "Touch", duration: "1 hour", desc: "Target ignores difficult terrain and cannot be paralyzed or restrained by magic." },
  { name: "Swift Quiver", levelTag: "Level 5", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Touch", duration: "Concentration, up to 1 minute", desc: "Your quiver produces endless ammo. Make two weapon attacks as a bonus action on each turn." },
  { name: "Steel Wind Strike", levelTag: "Level 5", schoolTag: "Conjuration", classesTag: "Ranger, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Strike up to five creatures within 30 feet, dealing 6d10 force damage to each target on a hit, then teleport near one." },
  { name: "Divine Favor", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Empower your weapon with holy light to deal an extra 1d4 radiant damage on every hit." },
  { name: "Compelled Duel", levelTag: "Level 1", schoolTag: "Enchantment", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "30 ft", duration: "Concentration, up to 1 minute", desc: "Force a creature into a duel on a failed Wis save, giving it disadvantage on attacks against anyone else." },
  { name: "Thunderous Smite", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Next melee hit deals an extra 2d6 thunder damage and knocks target prone 10 feet away on a failed Strength save." },
  { name: "Wrathful Smite", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Next melee hit deals 1d6 psychic damage and can frighten the target on a failed Wisdom saving throw." },
  { name: "Hex", levelTag: "Level 1", schoolTag: "Enchantment", classesTag: "Warlock", casting_time: "1 Bonus Action", range: "90 ft", duration: "Concentration, up to 1 hour", desc: "Curse a target for an extra 1d6 necrotic damage on hits, and give it disadvantage on checks with one chosen ability score." },
  { name: "Armor of Agathys", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Warlock", casting_time: "1 Action", range: "Self", duration: "1 hour", desc: "Gain 5 temporary hit points. Attackers hitting you with melee take 5 cold damage as long as these points remain." },
  { name: "Hellish Rebuke", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Warlock, Tiefling", casting_time: "1 Reaction", range: "60 ft", duration: "Instantaneous", desc: "Surround an attacker that hurt you with flames for 2d10 fire damage on a failed Dexterity save." },
  { name: "Darkness", levelTag: "Level 2", schoolTag: "Evocation", classesTag: "Sorcerer, Warlock, Wizard, Drow, Tiefling", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 10 minutes", desc: "Magical darkness fills a 15-foot sphere that darkvision and standard torches cannot penetrate." },
  { name: "Dancing Lights", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Bard, Sorcerer, Wizard, Drow", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "Create four glowing lights that float within range and illuminate 10-foot areas." },
  { name: "Faerie Fire", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Artificer, Bard, Druid, Drow", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Outline targets in radiant light inside a 20-foot cube, giving advantage to attackers." },
  { name: "Thaumaturgy", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Cleric, Tiefling", casting_time: "1 Action", range: "30 ft", duration: "Up to 1 minute", desc: "Manifest minor wonders like booming voices, flickering flames, tremors, or swinging doors." },
  { name: "Light", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Bard, Cleric, Sorcerer, Wizard, Aasimar", casting_time: "1 Action", range: "Touch", duration: "1 hour", desc: "Touch an object to make it shine brightly for 20 feet and dimly for another 20 feet." },
  { name: "Produce Flame", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Druid, Fire Genasi", casting_time: "1 Action", range: "Self", duration: "10 minutes", desc: "Hold a flame in hand shedding bright light, or hurl it up to 30 feet for 1d8 fire damage." },
  { name: "Minor Illusion", levelTag: "Cantrip", schoolTag: "Illusion", classesTag: "Bard, Sorcerer, Warlock, Wizard, Forest Gnome", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "Create an image of an object or a sound that lasts up to one minute." },
  { name: "Guidance", levelTag: "Cantrip", schoolTag: "Divination", classesTag: "Artificer, Cleric, Druid", casting_time: "1 Action", range: "Touch", duration: "Concentration, up to 1 minute", desc: "Touch an ally to add 1d4 to one ability check of their choice." },
  { name: "Fire Bolt", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Hurl a mote of fire at a target for 1d10 fire damage on a ranged spell hit." },
  { name: "Mage Hand", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "A spectral hand appears within range to manipulate objects up to 10 pounds." },
  { name: "Eldritch Blast", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Warlock", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "A beam of energy deals 1d10 force damage on a hit." },
  { name: "Shield", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Sorcerer, Wizard", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "Gain +5 to AC until next turn and take no damage from magic missile." },
  { name: "Magic Missile", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Three darts strike targets automatically for 1d4 + 1 force damage each." },
  { name: "Cure Wounds", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid, Paladin, Ranger", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "Restore 1d8 + modifier hit points to a touched creature." },
  { name: "Healing Word", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid", casting_time: "1 Bonus Action", range: "60 ft", duration: "Instantaneous", desc: "Restore 1d4 + modifier hit points to a seen creature within range." },
  { name: "Misty Step", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Teleport up to 30 feet to an unoccupied space you can see." },
  { name: "Fireball", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A 20-foot fireball deals 8d6 fire damage to creatures failing a Dexterity save." },
  { name: "Counterspell", levelTag: "Level 3", schoolTag: "Abjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Reaction", range: "60 ft", duration: "Instantaneous", desc: "Attempt to interrupt a spellcaster. 3rd-level or lower spells fail automatically." }
];

const BUILTIN_TRAITS = [
  { name: "Deft Explorer", classes: ["Ranger"], desc: "1st Level (Canny): Choose one skill proficiency to gain expertise in (double proficiency bonus), and learn two languages of your choice.\n\n6th Level (Roving): Your walking speed increases by 5 feet, and you gain climbing and swimming speeds equal to your walking speed.\n\n10th Level (Tireless): As an action, gain temporary hit points equal to 1d8 + your Wisdom modifier a number of times per long rest equal to your proficiency bonus. In addition, whenever you finish a short rest, your exhaustion level drops by 1." },
  { name: "Favored Foe", classes: ["Ranger"], desc: "When you hit a creature with an attack roll, you can call on your mystical bond with nature to mark the target as your favored enemy for 1 minute (requires concentration).\n\n1st Level: The first time on each of your turns that you hit the favored enemy, deal an extra 1d4 damage of the weapon's type. You can use this a number of times equal to your proficiency bonus per long rest.\n\n6th Level: The extra damage increases to 1d6.\n\n14th Level: The extra damage increases to 1d8." },
  { name: "Primal Awareness", classes: ["Ranger"], desc: "You focus on the life energies of the world, gaining spells that don't count against your spells known. You can cast each spell once per long rest without expending a spell slot:\n\n3rd Level: Speak with Animals\n5th Level: Beast Sense\n9th Level: Speak with Plants\n13th Level: Locate Creature\n17th Level: Commune with Nature" },
  { name: "Favored Enemy", classes: ["Ranger"], desc: "You study and track specific foes. Gain advantage on Wisdom (Survival) checks to track them and Intelligence checks to recall information about them, plus learn one language spoken by them.\n\n1st Level: Choose one favored enemy type (aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead) or two humanoid races.\n\n6th Level: Choose one additional favored enemy and an associated language.\n\n14th Level: Choose one additional favored enemy and an associated language." },
  { name: "Natural Explorer", classes: ["Ranger"], desc: "You are a master of wilderness survival. While traveling in your favored terrain: difficult terrain doesn't slow your group, you can't become lost except by magic, remain alert to danger while foraging, move stealthily at normal pace, forage twice as much food, and learn exact numbers and sizes when tracking creatures.\n\n1st Level: Choose one favored terrain (arctic, coast, desert, forest, grassland, mountain, swamp, or the Underdark).\n\n6th Level: Choose a second favored terrain.\n\n10th Level: Choose a third favored terrain." },
  { name: "Primeval Awareness", classes: ["Ranger"], desc: "3rd Level: Use an action and expend one ranger spell slot to sense whether aberrations, celestials, dragons, elementals, fey, fiends, or undead are present within 1 mile (or up to 6 miles in your favored terrain). This effect lasts 1 minute per level of the spell slot expended." },
  { name: "Dread Ambusher", classes: ["Ranger"], desc: "3rd Level (Gloom Stalker): Add your Wisdom modifier to your initiative rolls. At the start of your first turn of each combat, your walking speed increases by 10 feet until the end of that turn, and if you take the Attack action, you can make one additional weapon attack dealing an extra 1d8 damage of the weapon's type on a hit." },
  { name: "Umbral Sight", classes: ["Ranger"], desc: "3rd Level (Gloom Stalker): You gain darkvision out to a range of 60 feet. If you already have darkvision, its range increases by 30 feet. You are also invisible to any creature that relies on darkvision to see you in darkness." },
  { name: "Iron Mind", classes: ["Ranger"], desc: "7th Level (Gloom Stalker): You hone your ability to resist the mind-altering powers of your prey. You gain proficiency in Wisdom saving throws. If you already have this proficiency, you instead gain proficiency in Intelligence or Charisma saving throws (your choice)." },
  { name: "Stalker's Flurry", classes: ["Ranger"], desc: "11th Level (Gloom Stalker): Once on each of your turns when you miss with a weapon attack roll, you can make another weapon attack as part of the same action." },
  { name: "Shadowy Dodge", classes: ["Ranger"], desc: "15th Level (Gloom Stalker): Whenever a creature makes an attack roll against you and doesn't have advantage, you can use your reaction to impose disadvantage on that roll." },
  { name: "Hunter's Prey", classes: ["Ranger"], desc: "3rd Level (Hunter): Gain one feature of your choice:\n\nColossus Slayer: Once per turn when you hit a creature with a weapon attack, deal an extra 1d8 damage if the creature is below its hit point maximum.\n\nGiant Killer: When a Large or larger creature within 5 feet hits or misses you, use your reaction to attack it.\n\nHorde Breaker: Once per turn when you make a weapon attack, make another attack against a different creature within 5 feet of the target." },
  { name: "Defensive Tactics", classes: ["Ranger"], desc: "7th Level (Hunter): Gain one feature of your choice:\n\nEscape the Horde: Opportunity attacks against you have disadvantage.\n\nMultiattack Defense: When a creature hits you with an attack, you gain a +4 bonus to AC against all subsequent attacks by that creature for the rest of the turn.\n\nSteel Will: You have advantage on saving throws against being frightened." },
  { name: "Multiattack", classes: ["Ranger"], desc: "11th Level (Hunter): Gain one feature of your choice:\n\nVolley: Use your action to make ranged attacks against any number of creatures within 10 feet of a point you can see within your weapon's range (requires ammunition for each).\n\nWhirlwind Attack: Use your action to make melee attacks against any number of creatures within 5 feet of you." },
  { name: "Superior Hunter's Defense", classes: ["Ranger"], desc: "15th Level (Hunter): Gain one feature of your choice:\n\nEvasion: Take half damage on failed Dex saves and no damage on successes.\n\nStand Against the Tide: When a hostile creature misses you with a melee attack, force it to repeat its attack against another creature within range.\n\nUncanny Dodge: Halve the damage of an attacker you can see using your reaction." },
  { name: "Land's Stride", classes: ["Ranger", "Druid"], desc: "8th Level: Moving through nonmagical difficult terrain costs you no extra movement. You can pass through nonmagical plants without being slowed or taking damage from thorns and hazards, and you have advantage on saves against magically created plants." },
  { name: "Hide in Plain Sight", classes: ["Ranger"], desc: "10th Level: Spend 1 minute camouflaging yourself. You gain a +10 bonus to Dexterity (Stealth) checks as long as you remain still against a solid surface." },
  { name: "Vanish", classes: ["Ranger"], desc: "14th Level: You can use the Hide action as a bonus action on your turn. In addition, you can't be tracked by nonmagical means unless you choose to leave a trail." },
  { name: "Feral Senses", classes: ["Ranger"], desc: "18th Level: When you attack a creature you can't see, your inability to see it doesn't impose disadvantage on your attack rolls. You are also aware of the location of any invisible creature within 30 feet of you." },
  { name: "Foe Slayer", classes: ["Ranger"], desc: "20th Level: Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies." },

  { name: "Rage", classes: ["Barbarian"], desc: "Enter a rage as a bonus action for 1 minute. Gain advantage on Strength checks and saves, resistance to bludgeoning, piercing, and slashing damage, and a melee damage bonus.\n\nDamage Bonus:\nLevels 1-8: +2 damage\nLevels 9-15: +3 damage\nLevels 16-20: +4 damage\n\nRages per Long Rest:\nLevels 1-2: 2\nLevels 3-5: 3\nLevels 6-11: 4\nLevels 12-16: 5\nLevels 17-19: 6\nLevel 20: Unlimited" },
  { name: "Reckless Attack", classes: ["Barbarian"], desc: "2nd Level: Gain advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn." },
  { name: "Danger Sense", classes: ["Barbarian"], desc: "2nd Level: You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells, provided you aren't blinded, deafened, or incapacitated." },
  { name: "Frenzy", classes: ["Barbarian"], desc: "3rd Level (Berserker): You can go into a frenzy when you rage. For the duration, make a single melee weapon attack as a bonus action on each of your turns. When your rage ends, you suffer one level of exhaustion." },
  { name: "Mindless Rage", classes: ["Barbarian"], desc: "6th Level (Berserker): You can't be charmed or frightened while raging. If charmed or frightened when you enter a rage, the effect is suspended for the duration." },
  { name: "Intimidating Presence", classes: ["Barbarian"], desc: "10th Level (Berserker): Use an action to frighten someone within 30 feet until the end of your next turn on a failed Wisdom saving throw (DC 8 + proficiency bonus + Charisma modifier). Extend the duration each turn with your action." },
  { name: "Retaliation", classes: ["Barbarian"], desc: "14th Level (Berserker): When you take damage from a creature that is within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature." },
  { name: "Fast Movement", classes: ["Barbarian"], desc: "5th Level: Your speed increases by 10 feet while you aren't wearing heavy armor." },
  { name: "Feral Instinct", classes: ["Barbarian"], desc: "7th Level: Advantage on initiative rolls. If you are surprised when combat starts, you can act normally on your first turn if you enter your rage before doing anything else." },
  { name: "Brutal Critical", classes: ["Barbarian"], desc: "Roll additional weapon damage dice on a melee critical hit:\n9th Level: 1 additional die\n13th Level: 2 additional dice\n17th Level: 3 additional dice" },
  { name: "Relentless Rage", classes: ["Barbarian"], desc: "11th Level: If you drop to 0 hit points while raging and don't die outright, make a DC 10 Constitution saving throw to drop to 1 hit point instead. The DC increases by 5 for each subsequent check until you finish a short or long rest." },

  { name: "Action Surge", classes: ["Fighter"], desc: "Take one additional action on your turn.\n2nd Level: 1 use per short or long rest\n17th Level: 2 uses per short or long rest (one per turn)" },
  { name: "Second Wind", classes: ["Fighter"], desc: "1st Level: On your turn, use a bonus action to regain hit points equal to 1d10 + your fighter level once per short or long rest." },
  { name: "Fighting Style", classes: ["Fighter", "Paladin", "Ranger"], desc: "1st Level (Fighter/Paladin/Ranger):\nArchery: +2 bonus to attack rolls made with ranged weapons.\nDefense: +1 bonus to AC while wearing armor.\nDueling: +2 bonus to damage rolls when wielding a melee weapon in one hand and no other weapons.\nGreat Weapon Fighting: Reroll a 1 or 2 on damage dice for two-handed or versatile melee weapons.\nProtection: Use a reaction to impose disadvantage on an attack against an ally within 5 feet while using a shield.\nTwo-Weapon Fighting: Add your ability modifier to the damage of the offhand attack." },
  { name: "Improved Critical", classes: ["Fighter"], desc: "3rd Level (Champion): Your weapon attacks score a critical hit on a roll of 19 or 20." },
  { name: "Remarkable Athlete", classes: ["Fighter"], desc: "7th Level (Champion): Add half your proficiency bonus (rounded up) to any Strength, Dexterity, or Constitution check that doesn't already use your proficiency bonus. Your running long jump distance also increases by your Strength modifier in feet." },
  { name: "Superior Critical", classes: ["Fighter"], desc: "15th Level (Champion): Your weapon attacks score a critical hit on a roll of 18, 19, or 20." },
  { name: "Survivor", classes: ["Fighter"], desc: "18th Level (Champion): At the start of each of your turns, you regain 5 + your Constitution modifier hit points if you have no more than half of your hit points left and at least 1 hit point." },
  { name: "Indomitable", classes: ["Fighter"], desc: "Reroll a failed saving throw, must use the new roll:\n9th Level: 1 use per long rest\n13th Level: 2 uses per long rest\n17th Level: 3 uses per long rest" },

  { name: "Sneak Attack", classes: ["Rogue"], desc: "Once per turn, deal extra damage to one creature you hit with advantage (or if an ally is within 5 feet of the target) using a finesse or ranged weapon:\nLevels 1-2: 1d6\nLevels 3-4: 2d6\nLevels 5-6: 3d6\nLevels 7-8: 4d6\nLevels 9-10: 5d6\nLevels 11-12: 6d6\nLevels 13-14: 7d6\nLevels 15-16: 8d6\nLevels 17-18: 9d6\nLevels 19-20: 10d6" },
  { name: "Cunning Action", classes: ["Rogue"], desc: "2nd Level: You can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide." },
  { name: "Steady Aim", classes: ["Rogue"], desc: "3rd Level: Use a bonus action to gain advantage on your next attack roll this turn. You can use this only if you haven't moved this turn, and your speed becomes 0 until the end of the turn." },
  { name: "Uncanny Dodge", classes: ["Rogue"], desc: "5th Level: When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you." },
  { name: "Evasion", classes: ["Rogue", "Monk"], desc: "7th Level: When subjected to an effect that allows a Dexterity saving throw to take only half damage, you take no damage on a success and only half damage on a failure." },
  { name: "Reliable Talent", classes: ["Rogue"], desc: "11th Level: Whenever you make an ability check that lets you add your proficiency bonus, treat a d20 roll of 9 or lower as a 10." },
  { name: "Assassinate", classes: ["Rogue"], desc: "3rd Level (Assassin): Advantage on attack rolls against creatures that haven't taken a turn in combat yet. Any hit you score against a creature that is surprised is automatically a critical hit." },

  { name: "Divine Smite", classes: ["Paladin"], desc: "2nd Level: When you hit a creature with a melee weapon attack, expend one spell slot to deal radiant damage: 2d8 for a 1st-level slot, plus 1d8 for each slot level above 1st (maximum 5d8). The damage increases by 1d8 if the target is an undead or a fiend (maximum 6d8)." },
  { name: "Lay on Hands", classes: ["Paladin"], desc: "1st Level: Heal wounds with a pool equal to your paladin level x 5. You can restore hit points, or spend 5 points from your pool to cure one disease or neutralize one poison." },
  { name: "Divine Sense", classes: ["Paladin"], desc: "1st Level: Open your awareness as an action. Until the end of your next turn, you know the location of any celestial, fiend, or undead within 60 feet not in total cover (usable 1 + Charisma modifier times per long rest)." },
  { name: "Aura of Protection", classes: ["Paladin"], desc: "You and friendly creatures within range gain a bonus to all saving throws equal to your Charisma modifier (minimum +1):\n6th Level: 10-foot radius\n18th Level: 30-foot radius" },
  { name: "Aura of Courage", classes: ["Paladin"], desc: "You and friendly creatures within range cannot be frightened while you are conscious:\n10th Level: 10-foot radius\n18th Level: 30-foot radius" },
  { name: "Improved Divine Smite", classes: ["Paladin"], desc: "11th Level: Your strikes are bathed in divine might. Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage." },

  { name: "Martial Arts", classes: ["Monk"], desc: "Use Dexterity instead of Strength for monk weapons and unarmed strikes, roll your martial arts damage die, and make an unarmed strike as a bonus action when taking the Attack action.\n\nMartial Arts Damage Die:\nLevels 1-4: 1d4\nLevels 5-10: 1d6\nLevels 11-16: 1d8\nLevels 17-20: 1d10" },
  { name: "Ki", classes: ["Monk"], desc: "2nd Level: Harness mystic energy (pool equals monk level, restores on short/long rest):\nFlurry of Blows: Spend 1 ki point to make two unarmed strikes as a bonus action.\nPatient Defense: Spend 1 ki point to take the Dodge action as a bonus action.\nStep of the Wind: Spend 1 ki point to Disengage or Dash as a bonus action and double jump distance." },
  { name: "Unarmored Movement", classes: ["Monk"], desc: "Your speed increases while not wearing armor or wielding a shield:\nLevels 2-5: +10 ft\nLevels 6-9: +15 ft\nLevels 10-13: +20 ft\nLevels 14-17: +25 ft\nLevels 18-20: +30 ft (also gain the ability to move across vertical surfaces and liquids on your turn)" },
  { name: "Deflect Missiles", classes: ["Monk"], desc: "3rd Level: Use your reaction to deflect or catch a missile when hit by a ranged weapon attack. Reduce damage by 1d10 + Dexterity modifier + monk level. If reduced to 0, spend 1 ki point to throw it back up to 60 feet." },
  { name: "Stunning Strike", classes: ["Monk"], desc: "5th Level: Spend 1 ki point when you hit with a melee weapon attack to force the target to make a Constitution save (DC 8 + proficiency bonus + Wisdom modifier) or become stunned until the end of your next turn." },

  { name: "Channel Divinity", classes: ["Cleric", "Paladin"], desc: "2nd Level: Channel divine energy directly from your deity to fuel Turn Undead and divine domain or oath features. Recharges on a short or long rest (1 use at 2nd level, 2 uses at 6th level, 3 uses at 18th level)." },
  { name: "Destroy Undead", classes: ["Cleric"], desc: "When an undead fails its save against Turn Undead, it is instantly obliterated:\n5th Level: CR 1/2 or lower\n8th Level: CR 1 or lower\n11th Level: CR 2 or lower\n14th Level: CR 3 or lower\n17th Level: CR 4 or lower" },
  { name: "Divine Intervention", classes: ["Cleric"], desc: "10th Level: Call upon your deity for aid as an action. Roll percentile dice: if you roll a number equal to or lower than your cleric level, your deity intervenes. At 20th level, the intervention succeeds automatically without rolling." },

  { name: "Wild Shape", classes: ["Druid"], desc: "2nd Level: Assume the shape of a beast you have seen before as an action (twice per short or long rest):\n2nd Level: Max CR 1/4 (no flying or swimming speed)\n4th Level: Max CR 1/2 (no flying speed)\n8th Level: Max CR 1\n\nMoon Druid (Combat Wild Shape):\n2nd Level: Max CR 1 (bonus action to transform)\n6th Level: Max CR equal to druid level divided by 3" },

  { name: "Bardic Inspiration", classes: ["Bard"], desc: "Bonus action to grant an ally within 60 feet an inspiration die for ability checks, attack rolls, or saving throws (usable Charisma modifier times per long rest, or short rest starting at 5th level):\nLevels 1-4: 1d6\nLevels 5-9: 1d8\nLevels 10-14: 1d10\nLevels 15-20: 1d12" },
  { name: "Jack of All Trades", classes: ["Bard"], desc: "2nd Level: Add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus." },
  { name: "Song of Rest", classes: ["Bard"], desc: "Allies regaining hit points by spending Hit Dice on a short rest get extra healing:\nLevels 2-8: 1d6\nLevels 9-12: 1d8\nLevels 13-16: 1d10\nLevels 17-20: 1d12" },

  { name: "Font of Magic", classes: ["Sorcerer"], desc: "2nd Level: Tap into sorcery points equal to your sorcerer level (recharges on long rest). Use a bonus action to convert sorcery points into spell slots or expend spell slots to gain sorcery points." },
  { name: "Metamagic", classes: ["Sorcerer"], desc: "3rd Level: Alter spells using sorcery points:\nCareful Spell: 1 pt to protect allies from save damage.\nQuickened Spell: 2 pts to cast an action spell as a bonus action.\nTwinned Spell: Spend points equal to spell level to target two creatures.\nSubtle Spell: 1 pt to cast without verbal or somatic components.\nEmpowered Spell: 1 pt to reroll damage dice up to Charisma modifier." },

  { name: "Eldritch Invocations", classes: ["Warlock"], desc: "2nd Level: Gain custom magical gifts from your patron. Choose 2 at 2nd level, scaling up to 8 invocations by 18th level (such as Agonizing Blast, Devil's Sight, Armor of Shadows, or Eldritch Sight)." },
  { name: "Pact Boon", classes: ["Warlock"], desc: "3rd Level: Receive a gift from your otherworldly patron:\nPact of the Blade: Summon magical melee weapons.\nPact of the Tome: A grimoire containing three extra cantrips from any class.\nPact of the Chain: Cast find familiar to summon an imp, pseudodragon, quasit, or sprite.\nPact of the Talisman: An amulet that adds 1d4 to failed ability checks." },

  { name: "Arcane Recovery", classes: ["Wizard"], desc: "1st Level: Once per day when you finish a short rest, choose expended spell slots to recover with a combined level equal to or less than half your wizard level (rounded up), with none being 6th level or higher." },
  { name: "Portent", classes: ["Wizard"], desc: "2nd Level (Divination): Roll two d20s at the end of a long rest and record the results. Replace any attack roll, saving throw, or ability check made by you or a seen creature with one of the foretelling rolls (increases to three d20 rolls at 14th level)." },

  { name: "Infuse Item", classes: ["Artificer"], desc: "2nd Level: Imbue mundane items with magic infusions (such as Enhanced Weapon +1, Repeating Shot, Enhanced Defense +1, or Replicate Magic Item) up to your active infusion maximum." },
  { name: "Flash of Genius", classes: ["Artificer"], desc: "7th Level: When you or a creature within 30 feet makes an ability check or saving throw, use your reaction to add your Intelligence modifier to the roll (usable Intelligence modifier times per long rest)." },

  { name: "Darkvision", races: ["Dwarf", "Elf", "Gnome", "Half-Elf", "Half-Orc", "Tiefling", "Aasimar"], desc: "Accustomed to life underground or in twilight, you can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
  { name: "Fey Ancestry", races: ["Elf", "Half-Elf"], desc: "You have advantage on saving throws against being charmed, and magic cannot put you to sleep." },
  { name: "Trance", races: ["Elf"], desc: "Elves don't need to sleep. Instead, they meditate deeply for 4 hours a day, gaining the full benefits of an 8-hour rest." },
  { name: "Drow Magic", races: ["Elf"], desc: "You know the Dancing Lights cantrip. At 3rd level, you can cast Faerie Fire once per long rest. At 5th level, you can cast Darkness once per long rest using Charisma as your spellcasting ability." },
  { name: "Dwarven Resilience", races: ["Dwarf"], desc: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
  { name: "Stonecunning", races: ["Dwarf"], desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, you add double your proficiency bonus to the check." },
  { name: "Lucky", races: ["Halfling"], desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
  { name: "Relentless Endurance", races: ["Half-Orc"], desc: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead once per long rest." },
  { name: "Savage Attacks", races: ["Half-Orc"], desc: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage." },
  { name: "Hellish Resistance", races: ["Tiefling"], desc: "You have resistance to fire damage." },
  { name: "Infernal Legacy", races: ["Tiefling"], desc: "You know the Thaumaturgy cantrip. At 3rd level, cast Hellish Rebuke as a 2nd-level spell once per long rest. At 5th level, cast Darkness once per long rest using Charisma as your spellcasting ability." },
  { name: "Breath Weapon", races: ["Dragonborn"], desc: "Exhale destructive energy based on your ancestry (15-foot cone or 5-by-30-foot line). Creatures take damage on a failed save:\nLevels 1-5: 2d6 damage\nLevels 6-10: 3d6 damage\nLevels 11-15: 4d6 damage\nLevels 16-20: 5d6 damage" },
  { name: "Gnome Cunning", races: ["Gnome"], desc: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." }
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

  container.innerHTML = myCharacterTraits.map((trait, idx) => {
    if (!trait) return "";
    return `
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
    `;
  }).join("");
}

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet. Click "+ Add Spell" above to browse the compendium.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells.map((spell, idx) => {
    if (!spell) return "";
    const typeVal = spell.type || spell.levelTag || "Spell";
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

function renderBlurredPills() {
  document.querySelectorAll(".field-pill[data-blur-id]").forEach((pill) => {
    const blurId = pill.dataset.blurId;
    if (myBlurredPills.includes(blurId)) {
      pill.classList.add("blurred");
    } else {
      pill.classList.remove("blurred");
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

async function syncRosterToCloud(roster) {
  if (!currentUser || !db) return;
  try {
    await db.collection("users").doc(currentUser.uid).set({
      roster: roster,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error("Cloud sync failed:", err);
  }
}

function saveRoster(roster) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  syncRosterToCloud(roster);
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
    conditions: myActiveConditions,
    blurredPills: myBlurredPills
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
      if (el.type === "checkbox") {
        el.checked = fields[id];
      } else {
        el.value = fields[id];
      }
    }
  });

  myCharacterSpells = charData.spells || [];
  myCharacterTraits = charData.traits || [];
  myActiveConditions = charData.conditions || [];
  myBlurredPills = charData.blurredPills || [];
  myCharacterWeapons = charData.weapons && charData.weapons.length >= 2 ? charData.weapons : [
    { name: "", atk: "", dmg: "", notes: "" },
    { name: "", atk: "", dmg: "" , notes: "" }
  ];

  renderWeapons();
  renderMySpells();
  renderMyTraits();
  renderConditionChips();
  renderBlurredPills();
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
      renderBlurredPills();
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
    } else if (field.id === "hitDiceCur" || field.id === "hitDiceMax") {
      field.value = 1;
    } else if (
      field.classList.contains("dual-input") ||
      field.classList.contains("pill-sub-input") ||
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
  myBlurredPills = [];
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
  renderBlurredPills();
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
    const filtered = allTraitsCache.filter((t) => {
      const matchName = (t.name || "").toLowerCase().includes(query);
      const matchType = (t.type || "").toLowerCase().includes(query);
      const matchClass = (t.classes || []).some(c => c.toLowerCase().includes(query));
      const matchRace = (t.races || []).some(r => r.toLowerCase().includes(query));
      const matchDesc = (t.desc || "").toLowerCase().includes(query);
      return matchName || matchType || matchClass || matchRace || matchDesc;
    });
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
        const isRace = ["elf", "dwarf", "tiefling", "dragonborn", "halfling", "half-orc", "gnome", "half-elf", "human", "drow", "genasi", "aasimar", "triton"].some(r => cls.toLowerCase().includes(r));
        const pillClass = isRace ? getRaceCssClass(cls) : getClassCssClass(cls);
        tagsHtml += `<span class="tag-pill ${pillClass}">${escapeHtml(cls)}</span>`;
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

function switchMainTab(targetId) {
  document.querySelectorAll(".main-tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.main-tab[data-target="${targetId}"]`)?.classList.add("active");
  document.getElementById(targetId)?.classList.add("active");
}

function setAuthError(message) {
  const el = document.getElementById("authErrorMsg");
  if (el) el.textContent = message || "";
}

function updateAuthUI(user) {
  const authBtn = document.getElementById("authModalBtn");
  const loggedOutView = document.getElementById("authLoggedOutView");
  const loggedInView = document.getElementById("authLoggedInView");
  const userText = document.getElementById("currentUserText");

  if (user) {
    if (authBtn) authBtn.textContent = user.displayName || user.email.split("@")[0];
    if (loggedOutView) loggedOutView.style.display = "none";
    if (loggedInView) loggedInView.style.display = "block";
    if (userText) userText.textContent = user.email;
  } else {
    if (authBtn) authBtn.textContent = "Account";
    if (loggedOutView) loggedOutView.style.display = "block";
    if (loggedInView) loggedInView.style.display = "none";
    if (userText) userText.textContent = "";
  }
}

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    updateAuthUI(user);

    if (user && db) {
      try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists && doc.data()?.roster) {
          const cloudRoster = doc.data().roster;
          const localRoster = getRoster();
          const merged = { ...localRoster, ...cloudRoster };
          localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(merged));
          loadSheet();
          showStatus("Cloud Synced");
        } else {
          const localRoster = getRoster();
          if (Object.keys(localRoster).length > 0) {
            syncRosterToCloud(localRoster);
          }
        }
      } catch (err) {
        console.error("Cloud sync load error:", err);
      }
    }
  });
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

  if (e.target.closest(".blur-toggle-btn")) {
    const btn = e.target.closest(".blur-toggle-btn");
    const pill = btn.closest(".field-pill");
    if (pill) {
      pill.classList.toggle("blurred");
      const blurId = pill.dataset.blurId;
      if (pill.classList.contains("blurred")) {
        if (!myBlurredPills.includes(blurId)) myBlurredPills.push(blurId);
      } else {
        myBlurredPills = myBlurredPills.filter((id) => id !== blurId);
      }
      saveSheet(true);
    }
    return;
  }

  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach((d) => d.classList.remove("open"));
  }

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

  if (e.target.id === "saveBtn") saveSheet(false);
  if (e.target.id === "newBtn") {
    if (confirm("Create a new blank character sheet?")) resetSheet();
  }
  if (e.target.id === "loadBtn") {
    renderCharList();
    document.getElementById("loadModal")?.classList.add("open");
  }

  if (e.target.id === "authModalBtn" || e.target.closest("#authModalBtn")) {
    setAuthError("");
    document.getElementById("authModal")?.classList.add("open");
    return;
  }

  if (e.target.id === "closeAuthModal" || e.target.closest("#closeAuthModal")) {
    document.getElementById("authModal")?.classList.remove("open");
    return;
  }

  if (e.target.id === "emailLoginBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value;
    setAuthError("");
    try {
      await auth.signInWithEmailAndPassword(email, password);
      showStatus("Logged In!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
  }

  if (e.target.id === "emailSignUpBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value;
    setAuthError("");
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      showStatus("Account Created!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
  }

  if (e.target.id === "googleLoginBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    setAuthError("");
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      showStatus("Logged In!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
  }

  if (e.target.id === "logoutBtn") {
    if (!auth) return;
    try {
      await auth.signOut();
      currentUser = null;
      localStorage.removeItem(ROSTER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CHAR_ID_KEY);
      activeCharId = "default";
      resetSheet();
      showStatus("Signed Out");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
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
      renderCharList();
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
      conditions: myActiveConditions,
      blurredPills: myBlurredPills
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

    if (detail) {
      myCharacterSpells.push({
        name: detail.name || name,
        type: detail.type || detail.levelTag || getSpellLevelTag(detail) || "Spell",
        casting_time: detail.casting_time || "1 Action",
        range: detail.range || "30 ft",
        duration: detail.duration || "Instantaneous",
        desc: Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "")
      });
    } else {
      myCharacterSpells.push({
        name: name,
        type: getSpellLevelTag({ name }),
        casting_time: "1 Action",
        range: "30 ft",
        duration: "Instantaneous",
        desc: ""
      });
    }

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

    if (detail) {
      myCharacterTraits.push({
        name: detail.name || name,
        type: detail.type || type,
        desc: Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || ""),
        isExpanded: false
      });
    } else {
      myCharacterTraits.push({
        name: name,
        type: type,
        desc: "",
        isExpanded: false
      });
    }

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

let spellFilterTimeout = null;
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearTimeout(spellFilterTimeout);
  spellFilterTimeout = setTimeout(() => {
    const filtered = allSpellsCache.filter((s) => {
      const matchName = (s.name || "").toLowerCase().includes(query);
      const matchClass = (s.classesTag || "").toLowerCase().includes(query);
      const matchSchool = (s.schoolTag || "").toLowerCase().includes(query);
      const matchLevel = (s.levelTag || "").toLowerCase().includes(query);
      return matchName || matchClass || matchSchool || matchLevel;
    });
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
      const matchName = (t.name || "").toLowerCase().includes(query);
      const matchType = (t.type || "").toLowerCase().includes(query);
      const matchClass = (t.classes || []).some(c => c.toLowerCase().includes(query));
      const matchRace = (t.races || []).some(r => r.toLowerCase().includes(query));
      const matchDesc = (t.desc || "").toLowerCase().includes(query);
      return matchName || matchType || matchClass || matchRace || matchDesc;
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
        const keys = Object.keys(parsed.allRoster);
        if (keys.length > 0) {
          activeCharId = keys[0];
          localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
        }
      } else if (parsed.character) {
        const charId = parsed.character.id || "char_" + Date.now();
        roster[charId] = parsed.character;
        activeCharId = charId;
        localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
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
