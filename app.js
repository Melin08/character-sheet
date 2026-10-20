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
    if (firebase.analytics) analytics = firebase.analytics();
  }
} catch (err) {
  console.warn("Firebase initialization skipped or failed:", err);
}

const ROSTER_STORAGE_KEY = "badman_char_roster_v1";
const ACTIVE_CHAR_ID_KEY = "badman_active_char_id";
const THEME_STORAGE_KEY = "badman_active_theme_v2";
const CAMPAIGN_ROOM_KEY = "badman_active_campaign_room";
const RECENT_ROOMS_KEY = "badman_recent_rooms_v1";
const CREATED_ROOMS_KEY = "badman_created_dm_rooms_v1";
const DM_ROOM_KEY = "badman_active_dm_room";

let activeCharId = localStorage.getItem(ACTIVE_CHAR_ID_KEY) || "default";
let connectedCampaignRoom = localStorage.getItem(CAMPAIGN_ROOM_KEY) || "";
let activeDMRoomCode = localStorage.getItem(DM_ROOM_KEY) || "";

let myCharacterAvatar = "";
let myCharacterSpells = [];
let myCharacterTraits = [];
let myCharacterWeapons = [
  { name: "", dmg: "", type: "", notes: "" },
  { name: "", dmg: "", type: "", notes: "" }
];
let myCustomResources = [];
let myStructuredInventory = [];
let myCompanions = [];
let myActiveConditions = [];
let myBlurredPills = [];
let myHandouts = [];
let myClaimedHandoutIds = [];
let partyRoomHandouts = [];
let activeHandoutFilter = "all";
let currentExplainingCondition = null;
let activeDiscordFormat = "markdown";
let diceRollHistory = [];
let lastBroadcastRoll = null;

// UI Filter & Dice States
let currentDiceMode = "norm"; // "norm" | "adv" | "dis"
let isDiceRollerOpen = false;
let activeTraitCategoryFilter = "all";
let activeSpellLevelFilter = "all";
let isPartyDockCollapsed = false;
let filterProficientSkillsOnly = false;

// Party Chat State
let partyChatUnsubscribe = null;
let partyHandoutsUnsubscribe = null;
let cachedChatMessages = [];
let isFloatingChatOpen = false;
let unreadChatCount = 0;
let activeChatRoomOverride = null;
let isJoinedViaAdminPanel = false;

function getActiveChatRoomCode() {
  return activeChatRoomOverride || connectedCampaignRoom || activeDMRoomCode || "";
}
let partyChannels = [
  { id: "general", name: "general", isDefault: true, allowedMembers: [] }
];
let activePartyChannelId = "general";
let unreadPerChannel = {};

let draggedSpellIndex = null;
const apiCache = {};

let allSpellsCache = [];
let allTraitsCache = [];

// DM & Player Real-Time Listener State
let dmListenerUnsubscribe = null;
let playerPartyListUnsubscribe = null;
let playerRoomDocUnsubscribe = null;
let currentInspectedMemberId = null;
let cachedRoomMembers = [];

const DND_CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer",
  "Warlock", "Wizard", "Artificer", "Blood Hunter"
];

const DND_RACES_CATALOG = [
  { race: "Dragonborn", subraces: ["Black Dragonborn", "Blue Dragonborn", "Brass Dragonborn", "Bronze Dragonborn", "Copper Dragonborn", "Gold Dragonborn", "Green Dragonborn", "Red Dragonborn", "Silver Dragonborn", "White Dragonborn"] },
  { race: "Dwarf", subraces: ["Hill Dwarf", "Mountain Dwarf", "Duergar"] },
  { race: "Elf", subraces: ["High Elf", "Wood Elf", "Dark Elf (Drow)", "Eladrin", "Sea Elf", "Shadar-kai"] },
  { race: "Gnome", subraces: ["Forest Gnome", "Rock Gnome", "Deep Gnome (Svirfneblin)"] },
  { race: "Half-Elf", subraces: ["Half-Elf (Standard)", "Half-Elf (Aquatic)", "Half-Elf (Drow)", "Half-Elf (Wood Elf)"] },
  { race: "Half-Orc", subraces: ["Half-Orc"] },
  { race: "Halfling", subraces: ["Lightfoot Halfling", "Stout Halfling", "Ghostwise Halfling"] },
  { race: "Human", subraces: ["Standard Human", "Variant Human"] },
  { race: "Tiefling", subraces: ["Tiefling (Bloodline of Asmodeus)", "Tiefling (Bloodline of Baalzebul)", "Tiefling (Bloodline of Dispater)", "Tiefling (Bloodline of Fierna)", "Tiefling (Bloodline of Glasya)", "Tiefling (Bloodline of Levistus)", "Tiefling (Bloodline of Mammon)", "Tiefling (Bloodline of Mephistopheles)", "Tiefling (Bloodline of Zariel)", "Feral Tiefling"] },
  { race: "Aasimar", subraces: ["Protector Aasimar", "Scourge Aasimar", "Fallen Aasimar"] },
  { race: "Genasi", subraces: ["Air Genasi", "Earth Genasi", "Fire Genasi", "Water Genasi"] },
  { race: "Goliath", subraces: ["Goliath"] },
  { race: "Tabaxi", subraces: ["Tabaxi"] },
  { race: "Tortle", subraces: ["Tortle"] },
  { race: "Kenku", subraces: ["Kenku"] },
  { race: "Firbolg", subraces: ["Firbolg"] },
  { race: "Changeling", subraces: ["Changeling"] },
  { race: "Warforged", subraces: ["Warforged"] }
];

const SRD_SPELL_LEVELS = {
  "acid-arrow": 2, "acid-splash": 0, "aid": 2, "alarm": 1, "alter-self": 2, "animal-friendship": 1,
  "animal-messenger": 2, "animal-shapes": 8, "animate-dead": 3, "animate-objects": 5, "antimagic-field": 8,
  "antipathy-sympathy": 8, "arcane-eye": 4, "arcane-hand": 5, "arcane-lock": 2, "arcane-sword": 7,
  "arcanists-magic-aura": 2, "astral-projection": 9, "augury": 2, "awaken": 5, "bane": 1, "banishment": 4,
  "barkskin": 2, "beacon-of-hope": 3, "bestow-curse": 3, "black-tentacles": 4, "blade-barrier": 6,
  "bless": 1, "blight": 4, "blindness-deafness": 2, "blink": 3, "blur": 2, "branding-smite": 2,
  "burning-hands": 1, "call-lightning": 3, "calm-emotions": 2, "chain-lightning": 6, "charm-person": 1,
  "chill-touch": 0, "circle-of-death": 6, "clairvoyance": 3, "clone": 8, "cloudkill": 5, "color-spray": 1,
  "command": 1, "commune": 5, "commune-with-nature": 5, "comprehend-languages": 1, "cone-of-cold": 5,
  "confusion": 4, "conjure-animals": 3, "conjure-celestial": 7, "conjure-elemental": 5, "conjure-fey": 6,
  "conjure-minor-elementals": 4, "conjure-woodland-beings": 4, "contact-other-plane": 5, "contagion": 5,
  "contingency": 6, "continual-flame": 2, "control-water": 4, "control-weather": 8, "counterspell": 3,
  "create-food-and-water": 3, "create-or-destroy-water": 1, "create-undead": 6, "creation": 5,
  "cure-wounds": 1, "darkness": 2, "darkvision": 2, "daylight": 3, "death-ward": 4, "delayed-blast-fireball": 7,
  "demiplane": 8, "detect-evil-and-good": 1, "detect-magic": 1, "detect-poison-and-disease": 1,
  "detect-thoughts": 2, "dimension-door": 4, "disguise-self": 1, "disintegrate": 6, "dispel-evil-and-good": 5,
  "dispel-magic": 3, "divination": 4, "divine-favor": 1, "divine-word": 7, "dominate-beast": 4,
  "dominate-monster": 8, "dominate-person": 5, "dream": 5, "earthquake": 8, "eldritch-blast": 0,
  "enhance-ability": 2, "enlarge-reduce": 2, "entangle": 1, "enthrall": 2, "etherealness": 7,
  "expeditious-retreat": 1, "eyebite": 6, "fabricate": 4, "faerie-fire": 1, "faithful-hound": 4,
  "false-life": 1, "fear": 3, "feather-fall": 1, "feeblemind": 8, "find-familiar": 1, "find-steed": 2,
  "find-the-path": 6, "find-traps": 2, "finger-of-death": 7, "fire-shield": 4, "fire-storm": 7,
  "fireball": 3, "fire-bolt": 0, "flame-blade": 2, "flame-strike": 5, "flaming-sphere": 2, "flesh-to-stone": 6,
  "fly": 3, "fog-cloud": 1, "forbiddance": 6, "forcecage": 7, "foresight": 9, "freedom-of-movement": 4,
  "freezing-sphere": 6, "gaseous-form": 3, "gate": 9, "geas": 5, "gentle-repose": 2, "glibness": 8,
  "globe-of-invulnerability": 6, "glyph-of-warding": 3, "grease": 1, "greater-invisibility": 4,
  "greater-restoration": 5, "guardian-of-faith": 4, "guards-and-wards": 6, "guidance": 0, "guiding-bolt": 1,
  "gust-of-wind": 2, "hallow": 5, "hallucinatory-terrain": 4, "harm": 6, "haste": 3, "heal": 6,
  "healing-word": 1, "heat-metal": 2, "hellish-rebuke": 1, "heroes-feast": 6, "heroism": 1, "hideous-laughter": 1,
  "hold-monster": 5, "hold-person": 2, "holy-aura": 8, "hunters-mark": 1, "hypnotic-pattern": 3,
  "ice-storm": 4, "identify": 1, "illusory-script": 1, "imprisonment": 9, "incendiary-cloud": 8,
  "inflict-wounds": 1, "insect-plague": 5, "instant-summons": 6, "invisibility": 2, "jump": 1, "knock": 2,
  "legend-lore": 5, "lesser-restoration": 2, "levitate": 2, "light": 0, "lightning-bolt": 3,
  "locate-animals-or-plants": 2, "locate-creature": 4, "locate-object": 2, "longstrider": 1, "mage-armor": 1,
  "mage-hand": 0, "magic-circle": 3, "magic-jar": 6, "magic-missile": 1, "magic-mouth": 2, "magic-weapon": 2,
  "magnificent-mansion": 7, "major-image": 3, "mass-cure-wounds": 5, "mass-heal": 9, "mass-healing-word": 3,
  "mass-suggestion": 6, "maze": 8, "meld-into-stone": 3, "mending": 0, "message": 0, "meteor-swarm": 9,
  "mind-blank": 8, "minor-illusion": 0, "mirage-arcane": 7, "mirror-image": 2, "mislead": 5, "misty-step": 2,
  "modify-memory": 5, "moonbeam": 2, "move-earth": 6, "nondetection": 3, "pass-without-trace": 2,
  "passwall": 5, "phantasmal-killer": 4, "phantom-steed": 3, "planar-ally": 6, "planar-binding": 5,
  "plane-shift": 7, "plant-growth": 3, "poison-spray": 0, "polymorph": 4, "power-word-kill": 9,
  "power-word-stun": 8, "prayer-of-healing": 2, "prestidigitation": 0, "prismatic-spray": 7,
  "prismatic-wall": 9, "produce-flame": 0, "programmed-illusion": 6, "project-image": 7,
  "protection-from-energy": 3, "protection-from-evil-and-good": 1, "protection-from-poison": 2,
  "purify-food-and-drink": 1, "raise-dead": 5, "ray-of-enfeeblement": 2, "ray-of-frost": 0,
  "regenerate": 7, "reincarnate": 5, "remove-curse": 3, "resilient-sphere": 4, "resistance": 0,
  "resurrection": 7, "reverse-gravity": 7, "revivify": 3, "rope-trick": 2, "sacred-flame": 0,
  "sanctuary": 1, "scorching-ray": 2, "scrying": 5, "secret-chest": 4, "see-invisibility": 2, "seeming": 5,
  "sending": 3, "sequester": 7, "shapechange": 9, "shatter": 2, "shield": 1, "shield-of-faith": 1,
  "shillelagh": 0, "shocking-grasp": 0, "silence": 2, "silent-image": 1, "simulacrum": 7, "sleep": 1,
  "sleet-storm": 3, "slow": 3, "speak-with-animals": 1, "speak-with-dead": 3, "speak-with-plants": 3,
  "spider-climb": 2, "spike-growth": 2, "spirit-guardians": 3, "spiritual-weapon": 2, "stinking-cloud": 3,
  "stone-shape": 4, "stoneskin": 4, "storm-of-vengeance": 9, "suggestion": 2, "sunbeam": 6, "sunburst": 8,
  "symbol": 7, "telekinesis": 5, "telepathic-bond": 5, "teleport": 7, "teleportation-circle": 5,
  "thaumaturgy": 0, "thunderwave": 1, "time-stop": 9, "tiny-hut": 3, "tongues": 3, "transport-via-plants": 6,
  "tree-stride": 5, "true-polymorph": 9, "true-resurrection": 9, "true-seeing": 6, "true-strike": 0,
  "unseen-servant": 1, "vampiric-touch": 3, "vicious-mockery": 0, "wall-of-fire": 4, "wall-of-force": 5,
  "wall-of-ice": 6, "wall-of-stone": 5, "wall-of-thorns": 6, "warding-bond": 2, "water-breathing": 3,
  "water-walk": 3, "web": 2, "weird": 9, "wind-walk": 6, "wind-wall": 3, "wish": 9, "word-of-recall": 6,
  "zone-of-truth": 2, "hail-of-thorns": 1, "ensnaring-strike": 1, "zephyr-strike": 1, "cordon-of-arrows": 2,
  "healing-spirit": 2, "conjure-barrage": 3, "lightning-arrow": 3, "guardian-of-nature": 4, "conjure-volley": 5,
  "swift-quiver": 5, "compelled-duel": 1, "searing-smite": 1, "thunderous-smite": 1, "wrathful-smite": 1,
  "blinding-smite": 3, "crusaders-mantle": 3, "aura-of-vitality": 3, "staggering-smite": 4, "aura-of-life": 4,
  "aura-of-purity": 4, "banishing-smite": 5, "destructive-wave": 5, "circle-of-power": 5, "holy-weapon": 5,
  "find-greater-steed": 4, "armor-of-agathys": 1, "arms-of-hadar": 1, "hex": 1, "witch-bolt": 1,
  "crown-of-madness": 2, "shadow-blade": 2, "hunger-of-hadar": 3, "shadow-of-moil": 4, "sickening-radiance": 4,
  "synaptic-static": 5, "danse-macabre": 5, "negative-energy-flood": 5, "infernal-calling": 5,
  "maddening-darkness": 8, "booming-blade": 0, "green-flame-blade": 0, "lightning-lure": 0, "sword-burst": 0,
  "toll-the-dead": 0, "word-of-radiance": 0, "primal-savagery": 0, "infestation": 0, "mind-sliver": 0,
  "create-bonfire": 0, "frostbite": 0, "mold-earth": 0, "shape-water": 0, "thunderclap": 0, "absorb-elements": 1,
  "catapult": 1, "ice-knife": 1, "chaos-bolt": 1, "dissonant-whispers": 1, "chromatic-orb": 1, "earth-tremor": 1,
  "ray-of-sickness": 1, "tashas-caustic-brew": 1, "ceremony": 1, "cloud-of-daggers": 2, "dragons-breath": 2,
  "mind-spike": 2, "phantasmal-force": 2, "tashas-mind-whip": 2, "rimes-binding-ice": 2, "aganazzars-scorcher": 2,
  "maximilians-earthen-grasp": 2, "warding-wind": 2, "earthbind": 2, "tidal-wave": 3, "thunder-step": 3,
  "enemies-abound": 3, "tiny-servant": 3, "catnap": 3, "life-transference": 3, "summon-lesser-demons": 3,
  "melfs-minute-meteors": 3, "ashardalons-stride": 3, "summon-greater-demon": 4, "storm-sphere": 4,
  "vitriolic-sphere": 4, "watery-sphere": 4, "steel-wind-strike": 5, "wall-of-light": 5, "far-step": 5,
  "enervation": 5, "immolation": 5, "transmute-rock": 5, "mental-prison": 6, "scatter": 6, "soul-cage": 6,
  "tensers-transformation": 6, "crown-of-stars": 7, "power-word-pain": 7, "whirlwind": 7,
  "draconic-transformation": 7, "abi-dalzims-horrid-wilting": 8, "illusory-dragon": 8, "psychic-scream": 9,
  "blade-of-disaster": 9, "invulnerability": 9, "mass-polymorph": 9
};

const BUILTIN_SPELLS = [
  // Core built-in standards
  { name: "Hunter's Mark", levelTag: "Level 1", schoolTag: "Divination", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "90 ft", duration: "Concentration, up to 1 hour", desc: "Mark quarry for extra 1d6 damage whenever you hit it with a weapon attack. You have advantage on Wisdom (Perception) and (Survival) checks to find it." },
  { name: "Shield", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Sorcerer, Wizard", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "Gain +5 bonus to AC until start of your next turn and take no magic missile damage." },
  { name: "Fireball", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A 20-foot radius burst of flame deals 8d6 fire damage on failed Dexterity save (half on success)." },
  { name: "Cure Wounds", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Cleric, Druid, Paladin, Ranger", casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "Restore 1d8 + spellcasting modifier hit points to a touched creature." },
  { name: "Misty Step", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Teleport up to 30 feet to an unoccupied space you can see." },
  { name: "Eldritch Blast", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Warlock", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage." },

  // Ranger signature spells (frequently missing from SRD)
  { name: "Hail of Thorns", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a ranged weapon attack before the spell ends, this spell creates a rain of thorns that sprouts from your weapon or ammunition. In addition to the normal effect of the attack, the target of the attack and each creature within 5 feet of it must make a Dexterity saving throw. A creature takes 1d10 piercing damage on a failed save, or half as much damage on a successful one.\n\nAt Higher Levels: When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d10 for each slot level above 1st (to a maximum of 6d10)." },
  { name: "Ensnaring Strike", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a weapon attack, writhing thorny vines wrap around the target. It must succeed on a Strength saving throw or be restrained until the spell ends. A restrained creature takes 1d6 piercing damage at the start of each of its turns." },
  { name: "Zephyr Strike", levelTag: "Level 1", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "You move like the wind. Your movement doesn't provoke opportunity attacks. Once before the spell ends, you can give yourself advantage on one weapon attack roll on your turn. That attack deals an extra 1d8 force damage on a hit, and your walking speed increases by 30 feet until the end of that turn." },
  { name: "Cordon of Arrows", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Action", range: "5 ft", duration: "8 hours", desc: "You plant four pieces of nonmagical ammunition in the ground. Whenever a creature comes within 30 feet of them, one piece of ammunition flies to strike it: DC Dexterity save or take 1d6 piercing damage." },
  { name: "Healing Spirit", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Druid, Ranger", casting_time: "1 Bonus Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Call forth a transparent nature spirit occupying a 5-foot cube. Whenever you or a creature you can see enters the spirit's space for the first time on a turn or starts its turn there, you can cause the spirit to restore 1d6 hit points to that creature." },
  { name: "Conjure Barrage", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Action", range: "Self (60-foot cone)", duration: "Instantaneous", desc: "You throw a nonmagical weapon or fire a piece of ammunition into the air to create a cone of identical weapons. Each creature in a 60-foot cone must make a Dexterity save, taking 3d8 damage on a fail, or half on a success." },
  { name: "Lightning Arrow", levelTag: "Level 3", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you make a ranged weapon attack, the ammunition transforms into a bolt of lightning. Make the attack roll as normal. The target takes 4d8 lightning damage on a hit, or half on a miss. Whether you hit or miss, each creature within 10 feet of the target must make a Dexterity save, taking 2d8 lightning damage on a fail, or half on a success." },
  { name: "Guardian of Nature", levelTag: "Level 4", schoolTag: "Transmutation", classesTag: "Druid, Ranger", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Transform into Primal Beast (walking speed +10 ft, darkvision 120 ft, advantage on STR attacks, melee attacks deal +1d6 force) or Great Tree (10 temp HP, advantage on CON saves, advantage on DEX and WIS attacks, 15-ft difficult terrain aura)." },
  { name: "Conjure Volley", levelTag: "Level 5", schoolTag: "Conjuration", classesTag: "Ranger", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "Launch a piece of ammunition into the air. Hundreds of duplicate arrows or blades rain down in a 40-foot radius, 20-foot-high cylinder. Each creature makes a Dexterity save: 8d8 damage on a failed save, or half on success." },
  { name: "Swift Quiver", levelTag: "Level 5", schoolTag: "Transmutation", classesTag: "Ranger", casting_time: "1 Bonus Action", range: "Touch", duration: "Concentration, up to 1 minute", desc: "Transmute your quiver to produce endless ammunition. On each of your turns until the spell ends, you can use a bonus action to make two attacks with a weapon that uses ammunition from the quiver." },
  { name: "Steel Wind Strike", levelTag: "Level 5", schoolTag: "Conjuration", classesTag: "Ranger, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Flourish the weapon used in the casting and then vanish to strike like the wind. Choose up to 5 creatures within 30 feet. Make a melee spell attack against each target. On a hit, a target takes 6d10 force damage. Then teleport to an unoccupied space within 5 feet of one target." },
  { name: "Wrath of Nature", levelTag: "Level 5", schoolTag: "Evocation", classesTag: "Druid, Ranger", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "Call out to the spirits of nature in a 60-foot cube. Grass and undergrowth become difficult terrain; trees lash out with branches for 4d6 slashing; roots trip for DEX save or prone; rocks strike for 3d8 bludgeoning." },

  // Paladin Smite Spells & Auras
  { name: "Compelled Duel", levelTag: "Level 1", schoolTag: "Enchantment", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "30 ft", duration: "Concentration, up to 1 minute", desc: "Attempt to compel a creature into a duel. Target makes a Wisdom save or has disadvantage on attack rolls against anyone other than you, and must make a Wisdom save to move more than 30 feet away." },
  { name: "Searing Smite", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a melee weapon attack, your weapon flares with white-hot intensity: extra 1d6 fire damage and ignites target. It takes 1d6 fire damage at the start of each turn until it passes a CON save." },
  { name: "Thunderous Smite", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Your weapon rings with thunder. The next time you hit with a melee weapon attack, deal an extra 2d6 thunder damage. The target must succeed on a Strength saving throw or be pushed 10 feet away and knocked prone." },
  { name: "Wrathful Smite", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit with a melee weapon attack, deal an extra 1d6 psychic damage. If the target is a creature, it must make a Wisdom saving throw or become frightened of you until the spell ends." },
  { name: "Blinding Smite", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a melee weapon attack, your weapon flares with blinding light: extra 3d8 radiant damage and target is blinded until it succeeds on a Constitution save at the end of its turn." },
  { name: "Crusader's Mantle", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Holy power radiates from you in a 30-foot radius aura. You and any friendly creatures in the aura deal an extra 1d4 radiant damage when hitting with a weapon attack." },
  { name: "Aura of Vitality", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Cleric, Druid, Paladin", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Healing energy radiates in a 30-foot radius aura. On this turn and as a bonus action on subsequent turns, you can cause one creature in the aura to regain 2d6 hit points." },
  { name: "Staggering Smite", levelTag: "Level 4", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a melee weapon attack, deal an extra 4d6 psychic damage. Target must succeed on a Wisdom saving throw or have disadvantage on attack rolls and ability checks, and can't take reactions until the end of its next turn." },
  { name: "Aura of Life", levelTag: "Level 4", schoolTag: "Abjuration", classesTag: "Paladin", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Life-preserving energy radiates in a 30-foot aura. Living creatures in the aura have resistance to necrotic damage, max HP cannot be reduced, and regain 1 HP at the start of their turn if at 0 HP." },
  { name: "Aura of Purity", levelTag: "Level 4", schoolTag: "Abjuration", classesTag: "Paladin", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Purifying energy radiates in a 30-foot aura. Friendly creatures have resistance to poison damage and advantage on saving throws against being blinded, charmed, deafened, frightened, paralyzed, poisoned, and stunned." },
  { name: "Find Greater Steed", levelTag: "Level 4", schoolTag: "Conjuration", classesTag: "Paladin", casting_time: "10 Minutes", range: "30 ft", duration: "Instantaneous", desc: "Summon an otherworldly spirit that takes the form of a loyal steed: Griffon, Pegasus, Peryton, Dire Wolf, Rhinoceros, or Saber-toothed Tiger." },
  { name: "Banishing Smite", levelTag: "Level 5", schoolTag: "Abjuration", classesTag: "Paladin", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "The next time you hit a creature with a weapon attack, deal an extra 5d10 force damage. If this damage reduces the target to 50 hit points or fewer, you banish it to a harmless demiplane." },
  { name: "Circle of Power", levelTag: "Level 5", schoolTag: "Abjuration", classesTag: "Paladin, Wizard", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Divine energy radiates in a 30-foot radius aura. Friendly creatures have advantage on saving throws against spells and magical effects, and take no damage on a successful save against effects that deal half damage on a success." },
  { name: "Destructive Wave", levelTag: "Level 5", schoolTag: "Evocation", classesTag: "Paladin", casting_time: "1 Action", range: "Self (30-foot radius)", duration: "Instantaneous", desc: "Strike the ground with burst of divine power: 5d6 thunder damage and 5d6 radiant or necrotic damage, and knocked prone on a failed Constitution save (half damage on success)." },
  { name: "Holy Weapon", levelTag: "Level 5", schoolTag: "Evocation", classesTag: "Cleric, Paladin", casting_time: "1 Bonus Action", range: "Touch", duration: "Concentration, up to 1 hour", desc: "Imbue a weapon with holy radiance: it emits bright light and deals an extra 2d8 radiant damage on a hit. You can dismiss the spell as a bonus action to cause a flash of light dealing 4d8 radiant damage and blinding enemies." },
  { name: "Ceremony", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Cleric, Paladin", casting_time: "1 Action (Ritual)", range: "Touch", duration: "Instantaneous", desc: "Perform one of several special rites: Atonement, Bless Water, Coming of Age, Dedication, Funeral Rite, Investiture, or Wedding." },

  // Warlock Signature Spells
  { name: "Armor of Agathys", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Warlock", casting_time: "1 Action", range: "Self", duration: "1 hour", desc: "A protective spectral frost surrounds you. You gain 5 temporary hit points. If a creature hits you with a melee attack while you have these hit points, the creature takes 5 cold damage. Scales by 5 HP and 5 cold damage per slot level above 1st." },
  { name: "Arms of Hadar", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Warlock", casting_time: "1 Action", range: "Self (10-foot radius)", duration: "Instantaneous", desc: "Tendrils of dark energy erupt from you. Each creature within 10 feet must make a Strength saving throw. On a failed save, a target takes 2d6 necrotic damage and can't take reactions until its next turn." },
  { name: "Hex", levelTag: "Level 1", schoolTag: "Enchantment", classesTag: "Warlock", casting_time: "1 Bonus Action", range: "90 ft", duration: "Concentration, up to 1 hour", desc: "Curse a creature within range. You deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack. Also choose one ability: the target has disadvantage on ability checks made with that ability." },
  { name: "Witch Bolt", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Concentration, up to 1 minute", desc: "A beam of crackling blue energy streaks toward a target within range: 1d12 lightning damage on a hit. On each of your subsequent turns, you can use your action to deal 1d12 lightning damage to the target automatically." },
  { name: "Crown of Madness", levelTag: "Level 2", schoolTag: "Enchantment", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "One humanoid within range must succeed on a Wisdom save or become charmed by you. A twisted crown of jagged iron appears on its head, forcing it to use its action to make a melee attack against a creature you choose." },
  { name: "Shadow Blade", levelTag: "Level 2", schoolTag: "Illusion", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Weave threads of gloom to create a sword of solidified shadow. It is a simple melee weapon with finesse, light, and thrown (20/60). It deals 2d8 psychic damage. When attacking in dim light or darkness, you have advantage on the attack roll." },
  { name: "Hunger of Hadar", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Warlock", casting_time: "1 Action", range: "150 ft", duration: "Concentration, up to 1 minute", desc: "Open a gateway to the dark void: 20-foot radius sphere of blackness and bitter cold. Blinds creatures; difficult terrain; 2d6 cold damage at start of turn, 2d6 acid at end of turn on DEX save." },
  { name: "Shadow of Moil", levelTag: "Level 4", schoolTag: "Necromancy", classesTag: "Warlock", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Flame-like shadows wreathe your body until the spell ends, causing you to become heavily obscured to others. You have resistance to radiant damage. Whenever a creature within 10 feet hits you with an attack, shadows lash out to deal 2d8 necrotic damage." },
  { name: "Sickening Radiance", levelTag: "Level 4", schoolTag: "Evocation", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 10 minutes", desc: "Dim, greenish light spreads in a 30-foot sphere. Creatures in the area must succeed on a Constitution save or take 4d10 radiant damage, gain 1 level of exhaustion, and emit a dim green light that negates invisibility." },
  { name: "Synaptic Static", levelTag: "Level 5", schoolTag: "Enchantment", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Cause psychic energy to erupt in a 20-foot radius sphere. Each creature makes an Intelligence saving throw: 8d6 psychic damage and its thoughts are muddied for 1 minute (subtract 1d6 from all attack rolls, ability checks, and Concentration saves)." },
  { name: "Danse Macabre", levelTag: "Level 5", schoolTag: "Necromancy", classesTag: "Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 hour", desc: "Animate up to 5 Small or Medium corpses as zombies or skeletons. Each undead adds your spellcasting ability modifier to its attack rolls and damage rolls." },
  { name: "Negative Energy Flood", levelTag: "Level 5", schoolTag: "Necromancy", classesTag: "Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Send ribbons of negative energy at one creature: 5d12 necrotic damage on a failed Constitution save. A humanoid killed by this damage rises as a zombie under your control." },
  { name: "Infernal Calling", levelTag: "Level 5", schoolTag: "Conjuration", classesTag: "Warlock, Wizard", casting_time: "1 Minute", range: "90 ft", duration: "Concentration, up to 1 hour", desc: "Utter dark words summoning a devil of challenge rating 6 or lower (e.g. Barbed Devil, Bearded Devil) from the Nine Hells." },
  { name: "Maddening Darkness", levelTag: "Level 8", schoolTag: "Evocation", classesTag: "Warlock, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Concentration, up to 10 minutes", desc: "Magical darkness spreads from a point in a 60-foot radius sphere filled with shrieks. Each creature starting its turn there takes 8d8 psychic damage on a failed Wisdom save (half on success)." },

  // Essential Cantrips
  { name: "Booming Blade", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "Self (5-foot radius)", duration: "1 round", desc: "Brandish the weapon used in casting and make a melee weapon attack. On a hit, the target suffers normal effects and becomes sheathed in booming energy. If the target willingly moves 5 feet or more before your next turn, it takes 1d8 thunder damage. Scales at 5th, 11th, and 17th levels." },
  { name: "Green-Flame Blade", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "Self (5-foot radius)", duration: "Instantaneous", desc: "Brandish a weapon and make a melee weapon attack. On a hit, target suffers normal effects, and green fire leaps to a second creature within 5 feet, dealing fire damage equal to your spellcasting ability modifier. Scales at 5th, 11th, and 17th levels." },
  { name: "Lightning Lure", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "15 ft", duration: "Instantaneous", desc: "Create a lash of lightning energy. Target must succeed on a Strength saving throw or be pulled up to 10 feet straight toward you and take 1d8 lightning damage if within 5 feet of you." },
  { name: "Sword Burst", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Artificer, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "Self (5-foot radius)", duration: "Instantaneous", desc: "Create a momentary circle of spectral blades. Each creature within 5 feet must succeed on a Dexterity saving throw or take 1d6 force damage." },
  { name: "Toll the Dead", levelTag: "Cantrip", schoolTag: "Necromancy", classesTag: "Cleric, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Point at one creature within range. The sound of a dolorous bell fills the air. Target must succeed on a Wisdom saving throw or take 1d8 necrotic damage (or 1d12 necrotic damage if it is missing any of its hit points)." },
  { name: "Word of Radiance", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Cleric", casting_time: "1 Action", range: "Self (5-foot radius)", duration: "Instantaneous", desc: "Utter a divine word. Each chosen creature in range must succeed on a Constitution saving throw or take 1d6 radiant damage." },
  { name: "Primal Savagery", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Druid", casting_time: "1 Action", range: "Self", duration: "Instantaneous", desc: "Your teeth or fingernails lengthen and sharpen with corrosive acid. Make a melee spell attack against one creature within 5 feet: 1d10 acid damage on a hit." },
  { name: "Infestation", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Druid, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Cause a cloud of mites and fleas to appear on one creature: 1d6 poison damage on a failed Constitution save, and moves 5 feet in a random direction." },
  { name: "Mind Sliver", levelTag: "Cantrip", schoolTag: "Enchantment", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "1 round", desc: "Drive a disorienting spike of psychic energy into target's mind. Intelligence save or take 1d6 psychic damage and subtract 1d4 from the next saving throw it makes before the end of your next turn." },
  { name: "Create Bonfire", levelTag: "Cantrip", schoolTag: "Conjuration", classesTag: "Artificer, Druid, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Create a bonfire on ground filling a 5-foot cube. Any creature that enters the area for the first time on a turn or ends its turn there takes 1d8 fire damage on failed Dexterity save." },
  { name: "Frostbite", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Druid, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Cause numbing frost to form on a creature: 1d6 cold damage and disadvantage on its next weapon attack roll before end of its next turn on failed Constitution save." },
  { name: "Mold Earth", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous or 1 hour", desc: "Excavate loose earth, cause dirt to become difficult terrain, or create shapes and colors on soil." },
  { name: "Shape Water", levelTag: "Cantrip", schoolTag: "Transmutation", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous or 1 hour", desc: "Move, freeze, color, or shape an area of water up to a 5-foot cube." },
  { name: "Thunderclap", levelTag: "Cantrip", schoolTag: "Evocation", classesTag: "Artificer, Bard, Druid, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "Self (5-foot radius)", duration: "Instantaneous", desc: "Create a burst of thunderous sound audible out to 100 feet. Each creature within 5 feet must succeed on a Constitution save or take 1d6 thunder damage." },

  // Essential 1st-Level Spells
  { name: "Absorb Elements", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Artificer, Druid, Ranger, Sorcerer, Wizard", casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "Trigger: You take acid, cold, fire, lightning, or thunder damage. You gain resistance to the triggering damage type until start of your next turn. Also, the first time you hit with a melee attack on your next turn, the target takes an extra 1d6 damage of the triggering type." },
  { name: "Catapult", levelTag: "Level 1", schoolTag: "Transmutation", classesTag: "Artificer, Sorcerer, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Choose one object weighing 1 to 5 pounds within range. The object flies in a straight line up to 90 feet in a direction you choose before falling to the ground, stopping early if it impacts a solid surface. If the object would strike a creature, that creature must make a Dexterity saving throw: 3d8 bludgeoning damage on a failed save." },
  { name: "Ice Knife", levelTag: "Level 1", schoolTag: "Conjuration", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target: 1d10 piercing damage on hit. Hit or miss, the shard explodes: 2d6 cold damage to target and creatures within 5 feet on failed Dexterity save." },
  { name: "Chaos Bolt", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Hurl an undulating beam of chaotic energy: ranged spell attack for 2d8 + 1d6 damage of a type determined by the 2d8 (Acid, Cold, Fire, Force, Lightning, Poison, Psychic, or Thunder). If both d8s roll the same number, the bolt leaps to a new target." },
  { name: "Dissonant Whispers", levelTag: "Level 1", schoolTag: "Enchantment", classesTag: "Bard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Whisper a discordant melody audible only to one creature: 3d6 psychic damage and must immediately use its reaction to move as far away from you as its speed allows on a failed Wisdom save (half damage on success)." },
  { name: "Chromatic Orb", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "90 ft", duration: "Instantaneous", desc: "Hurl a 4-inch sphere of energy (acid, cold, fire, lightning, poison, or thunder) at a creature: 3d8 damage of chosen type on a ranged spell attack hit." },
  { name: "Earth Tremor", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Bard, Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "Self (10-foot radius)", duration: "Instantaneous", desc: "Cause a tremor in the ground: each creature within 10 feet takes 1d6 bludgeoning damage and is knocked prone on a failed Dexterity save; ground becomes difficult terrain." },
  { name: "Ray of Sickness", levelTag: "Level 1", schoolTag: "Necromancy", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "A ray of sickening greenish energy lashes out: 2d8 poison damage on a ranged spell attack hit, and target must make a Constitution save or be poisoned until end of your next turn." },
  { name: "Tasha's Caustic Brew", levelTag: "Level 1", schoolTag: "Evocation", classesTag: "Artificer, Sorcerer, Wizard", casting_time: "1 Action", range: "Self (30-foot line)", duration: "Concentration, up to 1 minute", desc: "A stream of acid 30 feet long and 5 feet wide erupts from your hand. Each creature in the line is covered in acid on failed Dexterity save, taking 2d4 acid damage at the start of each of its turns until someone uses an action to scrape it off." },
  { name: "Snare", levelTag: "Level 1", schoolTag: "Abjuration", classesTag: "Artificer, Druid, Ranger, Wizard", casting_time: "1 Minute", range: "Touch", duration: "8 hours", desc: "Create an invisible magical trap in a 5-foot radius. When a Small, Medium, or Large creature steps inside, Dexterity save or hoisted upside down and restrained." },

  // Essential 2nd-Level Spells
  { name: "Cloud of Daggers", levelTag: "Level 2", schoolTag: "Conjuration", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Fill the air with spinning daggers in a 5-foot cube: 4d4 slashing damage when a creature enters the area or starts its turn there." },
  { name: "Dragon's Breath", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Sorcerer, Wizard", casting_time: "1 Bonus Action", range: "Touch", duration: "Concentration, up to 1 minute", desc: "Touch a willing creature to imbue it with breath weapon (acid, cold, fire, lightning, or poison). Until the spell ends, the creature can use an action to exhale a 15-foot cone dealing 3d6 damage on a failed Dexterity save." },
  { name: "Mind Spike", levelTag: "Level 2", schoolTag: "Divination", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 hour", desc: "Drive a spike of psychic energy into target's mind: 3d8 psychic damage on a failed Wisdom save, and you always know the target's exact location until the spell ends." },
  { name: "Phantasmal Force", levelTag: "Level 2", schoolTag: "Illusion", classesTag: "Bard, Sorcerer, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Craft an illusion that takes root in target's mind on a failed Intelligence save. Target treats the phantasm as entirely real, taking 1d6 psychic damage per turn if phantasm is harmful." },
  { name: "Tasha's Mind Whip", levelTag: "Level 2", schoolTag: "Enchantment", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "90 ft", duration: "1 round", desc: "Lash target's mind with psychic energy: 3d6 psychic damage on a failed Intelligence save. Moreover, on its next turn it can take only an action, a bonus action, or move (choose one), and cannot take reactions." },
  { name: "Rime's Binding Ice", levelTag: "Level 2", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "Self (30-foot cone)", duration: "Instantaneous", desc: "Burst of cold radiates in a 30-foot cone: 3d8 cold damage on a failed Constitution save, and its speed is reduced to 0 until someone uses an action to break the ice." },
  { name: "Aganazzar's Scorcher", levelTag: "Level 2", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "A line of roaring flame 30 feet long and 5 feet wide emanates from you: 3d8 fire damage on a failed Dexterity save (half on success)." },
  { name: "Maximilian's Earthen Grasp", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Concentration, up to 1 minute", desc: "A Medium hand made of compacted soil rises: reaches out to grab one creature for 2d6 bludgeoning damage and restrains it on a failed Strength save." },
  { name: "Warding Wind", levelTag: "Level 2", schoolTag: "Evocation", classesTag: "Bard, Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 10 minutes", desc: "A strong wind swirls around you in a 10-foot radius. Extinguishes small flames, deafens creatures in the area, imposes disadvantage on ranged weapon attacks through it, and creates difficult terrain." },
  { name: "Earthbind", levelTag: "Level 2", schoolTag: "Transmutation", classesTag: "Druid, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "300 ft", duration: "Concentration, up to 1 minute", desc: "Yellow strips of magical energy entwine a flying creature on a failed Strength save, pulling it toward the ground and reducing its flying speed to 0." },

  // Essential 3rd-Level Spells
  { name: "Tidal Wave", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Conjure a wave of water: 4d8 bludgeoning damage and knocked prone on a failed Dexterity save; extinguishes nonmagical flames in its area." },
  { name: "Thunder Step", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "90 ft", duration: "Instantaneous", desc: "Teleport up to 90 feet to an unoccupied space. Each creature within 10 feet of the space you left takes 3d10 thunder damage on a failed Constitution save. You can bring along one willing creature." },
  { name: "Enemies Abound", levelTag: "Level 3", schoolTag: "Enchantment", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "Reach into target's mind: Intelligence save or target loses the ability to distinguish friend from foe, regarding all creatures as enemies and targeting randomly." },
  { name: "Tiny Servant", levelTag: "Level 3", schoolTag: "Transmutation", classesTag: "Artificer, Wizard", casting_time: "1 Minute", range: "Touch", duration: "8 hours", desc: "Touch a Tiny nonmagical object to bring it to life as an animated servant following your mental commands." },
  { name: "Catnap", levelTag: "Level 3", schoolTag: "Enchantment", classesTag: "Artificer, Bard, Sorcerer, Wizard", casting_time: "1 Action", range: "30 ft", duration: "10 minutes", desc: "Up to 3 willing creatures fall into a refreshing sleep for 10 minutes, gaining all benefits of a short rest upon waking." },
  { name: "Life Transference", levelTag: "Level 3", schoolTag: "Necromancy", classesTag: "Cleric, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Sacrifice your vitality: take 4d8 necrotic damage (cannot be reduced) and heal one creature within range for twice the necrotic damage taken." },
  { name: "Summon Lesser Demons", levelTag: "Level 3", schoolTag: "Conjuration", classesTag: "Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 hour", desc: "Utter dark words to summon demons (e.g. 8 dretches or 2 quasits) that attack the nearest non-demon each round." },
  { name: "Melf's Minute Meteors", levelTag: "Level 3", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 10 minutes", desc: "Create 6 tiny meteors orbiting your head. Send up to 2 meteors as a bonus action to detonate within 120 feet for 2d6 fire damage each." },
  { name: "Ashardalon's Stride", levelTag: "Level 3", schoolTag: "Transmutation", classesTag: "Artificer, Ranger, Sorcerer, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Speed increases by 20 feet and movement does not provoke opportunity attacks. Whenever you move within 5 feet of a creature, it takes 1d6 fire damage." },

  // Essential 4th & 5th-Level Spells
  { name: "Summon Greater Demon", levelTag: "Level 4", schoolTag: "Conjuration", classesTag: "Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 hour", desc: "Summon a demon of challenge rating 5 or lower (e.g. Barlgura, Shadow Demon). Requires Charisma save each turn to obey commands." },
  { name: "Storm Sphere", levelTag: "Level 4", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Concentration, up to 1 minute", desc: "20-foot radius sphere of howling wind: 2d6 bludgeoning damage on failed Strength save; use a bonus action on each turn to zap a target within 60 feet for 4d6 lightning." },
  { name: "Vitriolic Sphere", levelTag: "Level 4", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A glowing ball of emerald acid explodes in a 20-foot radius: 10d4 acid damage immediately plus 5d4 acid damage at end of its next turn on a failed Dexterity save." },
  { name: "Watery Sphere", levelTag: "Level 4", schoolTag: "Conjuration", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "90 ft", duration: "Concentration, up to 1 minute", desc: "Conjure a 5-foot radius sphere of water that can trap up to 4 Medium creatures on a failed Strength save." },
  { name: "Wall of Light", levelTag: "Level 5", schoolTag: "Evocation", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 10 minutes", desc: "A shimmering wall of radiant light up to 60 feet long: blinds creatures on failed Constitution save; can fire rays of radiant light for 4d8 damage." },
  { name: "Far Step", levelTag: "Level 5", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Teleport up to 60 feet. On each subsequent turn as a bonus action, you can teleport up to 60 feet again." },
  { name: "Enervation", levelTag: "Level 5", schoolTag: "Necromancy", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "A black tendril of inky darkness drains life: 4d8 necrotic damage on failed Dexterity save, and you regain hit points equal to half the necrotic damage." },
  { name: "Immolation", levelTag: "Level 5", schoolTag: "Evocation", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "90 ft", duration: "Concentration, up to 1 minute", desc: "Engulf a creature in flames: 8d6 fire damage on failed Dexterity save, plus 4d6 fire damage at end of each of its turns until it makes a save." },
  { name: "Transmute Rock", levelTag: "Level 5", schoolTag: "Transmutation", classesTag: "Artificer, Druid, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "Transmute rock into mud (40-foot cube difficult terrain, restrains creatures) or mud into rock." },

  // Essential 6th-9th Level Spells
  { name: "Mental Prison", levelTag: "Level 6", schoolTag: "Illusion", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Trap target in a hallucinatory mental prison: 5d10 psychic damage on failed Intelligence save. If the target moves out of the prison, it takes 10d10 psychic damage." },
  { name: "Scatter", levelTag: "Level 6", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "30 ft", duration: "Instantaneous", desc: "Air quivers around up to 5 creatures: teleport each target up to 120 feet to unoccupied spaces you can see." },
  { name: "Soul Cage", levelTag: "Level 6", schoolTag: "Necromancy", classesTag: "Warlock, Wizard", casting_time: "1 Reaction", range: "60 ft", duration: "8 hours", desc: "Snatch the soul of a humanoid that dies within 60 feet into a tiny silver cage. Exploit the soul up to 6 times to heal, gain advantage, or ask questions." },
  { name: "Tenser's Transformation", levelTag: "Level 6", schoolTag: "Transmutation", classesTag: "Wizard", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 10 minutes", desc: "Endow yourself with martial prowess: 50 temporary hit points, advantage on attack rolls with simple and martial weapons, +2d12 force damage on weapon hits." },
  { name: "Crown of Stars", levelTag: "Level 7", schoolTag: "Evocation", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "Self", duration: "1 hour", desc: "7 star-like motes orbit your head. Use a bonus action on each turn to shoot a mote dealing 4d12 radiant damage on a ranged spell attack." },
  { name: "Power Word Pain", levelTag: "Level 7", schoolTag: "Enchantment", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "60 ft", duration: "Instantaneous", desc: "Speak a word of power: if target has 100 HP or fewer, speed is capped at 10 feet, disadvantage on attacks and saves, and must pass a Constitution save to cast spells." },
  { name: "Whirlwind", levelTag: "Level 7", schoolTag: "Evocation", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Action", range: "300 ft", duration: "Concentration, up to 1 minute", desc: "Whirlwind 10-ft radius, 30 ft high: 10d6 bludgeoning damage and sucks creatures inside on failed Dexterity save." },
  { name: "Draconic Transformation", levelTag: "Level 7", schoolTag: "Transmutation", classesTag: "Druid, Sorcerer, Wizard", casting_time: "1 Bonus Action", range: "Self", duration: "Concentration, up to 1 minute", desc: "Gain blindsight 30 ft, 60 ft fly speed, and use bonus action to exhale 60-foot cone of force dealing 6d8 force damage." },
  { name: "Abi-Dalzim's Horrid Wilting", levelTag: "Level 8", schoolTag: "Necromancy", classesTag: "Sorcerer, Wizard", casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "Draw moisture from every creature in a 30-foot cube: 10d8 necrotic damage on failed Constitution save (half on success)." },
  { name: "Illusory Dragon", levelTag: "Level 8", schoolTag: "Illusion", classesTag: "Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 minute", desc: "Summon a shadow dragon: frightens creatures within 30 feet, and exhales a 60-foot cone dealing 7d6 damage of chosen energy type." },
  { name: "Psychic Scream", levelTag: "Level 9", schoolTag: "Enchantment", classesTag: "Bard, Sorcerer, Warlock, Wizard", casting_time: "1 Action", range: "90 ft", duration: "Instantaneous", desc: "Blast the minds of up to 10 creatures: 14d6 psychic damage and stunned on failed Intelligence save. If a target dies, its head explodes." },
  { name: "Blade of Disaster", levelTag: "Level 9", schoolTag: "Conjuration", classesTag: "Sorcerer, Warlock, Wizard", casting_time: "1 Bonus Action", range: "60 ft", duration: "Concentration, up to 1 minute", desc: "Create a planar blade: make 2 melee spell attacks for 4d12 force each, crits on 18-20 for 12d12 force." },
  { name: "Invulnerability", levelTag: "Level 9", schoolTag: "Abjuration", classesTag: "Wizard", casting_time: "1 Action", range: "Self", duration: "Concentration, up to 10 minutes", desc: "You are immune to all damage until the spell ends." },
  { name: "Mass Polymorph", levelTag: "Level 9", schoolTag: "Transmutation", classesTag: "Bard, Sorcerer, Wizard", casting_time: "1 Action", range: "120 ft", duration: "Concentration, up to 1 hour", desc: "Transform up to 10 creatures into beasts of challenge rating equal to their level or lower." }
];

const BUILTIN_TRAITS = [
  { name: "Action Surge", classes: ["Fighter"], type: "Class Feature", desc: "Take one additional action on your turn once per short or long rest." },
  { name: "Second Wind", classes: ["Fighter"], type: "Class Feature", desc: "Regain 1d10 + fighter level hit points as a bonus action once per short or long rest." },
  { name: "Sneak Attack", classes: ["Rogue"], type: "Class Feature", desc: "Deal extra damage once per turn with advantage or adjacent ally." },
  { name: "Cunning Action", classes: ["Rogue"], type: "Class Feature", desc: "Take a bonus action on each turn to Dash, Disengage, or Hide." },
  { name: "Rage", classes: ["Barbarian"], type: "Class Feature", desc: "Enter a rage for advantage on Strength checks, weapon damage bonus, and physical resistance." },
  { name: "Reckless Attack", classes: ["Barbarian"], type: "Class Feature", desc: "Gain advantage on melee weapon attack rolls using Strength during your turn." },
  { name: "Divine Smite", classes: ["Paladin"], type: "Class Feature", desc: "Expending a spell slot deals radiant damage to a struck creature." },
  { name: "Lay on Hands", classes: ["Paladin"], type: "Class Feature", desc: "Pool of healing power replenishing on long rest (5 × paladin level)." },
  { name: "Wild Shape", classes: ["Druid"], type: "Class Feature", desc: "Magically assume the shape of a beast you have seen before." },
  { name: "Bardic Inspiration", classes: ["Bard"], type: "Class Feature", desc: "Add an inspiration die to an ability check, attack roll, or saving throw." },
  { name: "Ki / Flurry of Blows", classes: ["Monk"], type: "Class Feature", desc: "Harness martial energy to make extra unarmed strikes or dodge." },
  { name: "Font of Magic", classes: ["Sorcerer"], type: "Class Feature", desc: "Metamagic and sorcery points to alter or create spell slots." },
  { name: "Eldritch Invocations", classes: ["Warlock"], type: "Class Feature", desc: "Occult lore fragments that bestow permanent magical abilities." },
  { name: "Darkvision", races: ["Elf", "Dwarf", "Tiefling", "Gnome", "Half-Orc"], type: "Racial Trait", desc: "See in dim light within 60 feet as if it were bright light, and in darkness as if dim light." },
  { name: "Fey Ancestry", races: ["Elf", "Half-Elf"], type: "Racial Trait", desc: "Advantage on saving throws against being charmed, and magic cannot put you to sleep." },
  { name: "Dwarven Resilience", races: ["Dwarf"], type: "Racial Trait", desc: "Advantage on saving throws against poison, and resistance against poison damage." },
  { name: "Lucky", type: "Feat", desc: "You have 3 luck points per long rest. Whenever you make an attack roll, an ability check, or a saving throw, you can spend one luck point to roll an additional d20." },
  { name: "War Caster", type: "Feat", desc: "You have advantage on Constitution saving throws that you make to maintain your concentration on a spell when you take damage." },
  { name: "Great Weapon Master", type: "Feat", desc: "Before you make a melee attack with a heavy weapon that you are proficient with, you can choose to take a -5 penalty to the attack roll to add +10 to the attack's damage." },
  { name: "Sharpshooter", type: "Feat", desc: "Attacking at long range doesn't impose disadvantage. Before making an attack with a ranged weapon, you can take a -5 penalty to hit for +10 damage." }
];

/* ==========================================================================
   UTILITIES, OS DETECTION & HELPERS
   ========================================================================== */

function detectOSAndSetShortcut() {
  const kbdEl = document.getElementById("quickActionShortcutKbd");
  const btnEl = document.getElementById("commandPaletteBtn");
  if (!kbdEl) return;

  const isTouchOnly = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (isTouchOnly) {
    kbdEl.style.display = "none";
    return;
  }

  const platform = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  const isMac = platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad");
  const shortcutText = isMac ? "⌘K" : "Ctrl+K";

  kbdEl.textContent = shortcutText;
  if (btnEl) btnEl.title = `Quick Search (${shortcutText})`;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function formatSigned(val) {
  return val >= 0 ? `+${val}` : `${val}`;
}

function getSchoolCssClass(school) {
  if (!school) return "school-transmutation";
  const s = school.toLowerCase();
  if (s.includes("abjur")) return "school-abjuration";
  if (s.includes("conjur")) return "school-conjuration";
  if (s.includes("divin")) return "school-divination";
  if (s.includes("enchant")) return "school-enchantment";
  if (s.includes("evoc")) return "school-evocation";
  if (s.includes("illus")) return "school-illusion";
  if (s.includes("necro")) return "school-necromancy";
  if (s.includes("transmut")) return "school-transmutation";
  return "school-transmutation";
}

function getClassCssClass(className) {
  if (!className) return "class-fighter";
  const c = className.toLowerCase();
  if (c.includes("barbarian")) return "class-barbarian";
  if (c.includes("bard")) return "class-bard";
  if (c.includes("cleric")) return "class-cleric";
  if (c.includes("druid")) return "class-druid";
  if (c.includes("fighter")) return "class-fighter";
  if (c.includes("monk")) return "class-monk";
  if (c.includes("paladin")) return "class-paladin";
  if (c.includes("ranger")) return "class-ranger";
  if (c.includes("rogue")) return "class-rogue";
  if (c.includes("sorcerer")) return "class-sorcerer";
  if (c.includes("warlock")) return "class-warlock";
  if (c.includes("wizard")) return "class-wizard";
  if (c.includes("artificer")) return "class-artificer";
  return "class-fighter";
}

// Themes: Fantasy RPG Aesthetic Suite
function applyTheme(themeName) {
  const themes = [
    "theme-nexus", "theme-parchment", "theme-midnight", "theme-emerald", "theme-crimson",
    "theme-amber", "theme-violet", "theme-monolith", "theme-cyberpunk"
  ];
  themes.forEach((t) => document.body.classList.remove(t));
  const validTheme = themes.includes(themeName) ? themeName : "theme-nexus";
  document.body.classList.add(validTheme);
  localStorage.setItem(THEME_STORAGE_KEY, validTheme);
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = validTheme;
}

/* ==========================================================================
   CORE CALCULATIONS & HUD UPDATES
   ========================================================================== */

function updateXpBar() {
  const xpInput = document.getElementById("charExp");
  const fill = document.getElementById("xpBarFill");
  const nextLabel = document.getElementById("xpNextTierText");
  if (!xpInput || !fill) return;

  const raw = parseInt(String(xpInput.value).replace(/\D/g, ""), 10) || 0;
  const level = Math.min(20, Math.max(1, parseInt(document.getElementById("charLevel")?.value, 10) || 1));
  const xpThresholds = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
  ];
  const curTier = xpThresholds[level - 1] || 0;
  const nextTier = xpThresholds[level] || 355000;
  const span = Math.max(1, nextTier - curTier);
  const progress = level >= 20 ? 100 : Math.min(100, Math.max(0, ((raw - curTier) / span) * 100));
  fill.style.width = `${progress}%`;
  if (nextLabel) {
    nextLabel.textContent = level >= 20 ? "/ MAX" : `/ ${nextTier.toLocaleString()}`;
  }
}

function updateHealthBars() {
  const curHp = parseInt(document.getElementById("curHp")?.value, 10) || 0;
  const maxHp = Math.max(1, parseInt(document.getElementById("maxHp")?.value, 10) || 10);
  const tempHp = Math.max(0, parseInt(document.getElementById("tempHp")?.value, 10) || 0);

  const hpPct = Math.min(100, Math.max(0, Math.round((curHp / maxHp) * 100)));
  const tempPct = Math.min(100 - hpPct, Math.max(0, Math.round((tempHp / maxHp) * 100)));

  const hpFill = document.getElementById("heroHpBarFill");
  const tempFill = document.getElementById("heroTempHpBarFill");
  const caption = document.getElementById("hpStatusCaption");

  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (tempFill) tempFill.style.width = `${tempPct}%`;

  if (caption) {
    if (curHp <= 0) caption.textContent = "Unconscious / Dying (0%)";
    else if (hpPct <= 25) caption.textContent = `Critical (${hpPct}%)`;
    else if (hpPct <= 50) caption.textContent = `Bloodied (${hpPct}%)`;
    else caption.textContent = `HP (${hpPct}%)${tempHp > 0 ? ` +${tempHp} Temp` : ""}`;
  }

  const hpCard = document.querySelector(".hp-card");
  const hpStrip = document.getElementById("heroHealthStrip");
  const isCrit = curHp <= 0 || (hpPct <= 25 && curHp > 0);
  if (hpCard) hpCard.classList.toggle("critical-hp", isCrit);
  if (hpStrip) hpStrip.classList.toggle("critical-hp", isCrit);
  if (typeof updateOwlbearVitalsHUD === "function") updateOwlbearVitalsHUD();
}

function updateConcentrationBanner() {
  const concInput = document.getElementById("spellConcentration");
  const banner = document.getElementById("globalConcentrationBanner");
  const nameEl = document.getElementById("globalConcentrationName");
  const spellVal = concInput?.value?.trim() || "";

  if (banner && nameEl) {
    if (spellVal) {
      banner.style.display = "inline-flex";
      nameEl.textContent = spellVal;
    } else {
      banner.style.display = "none";
      nameEl.textContent = "None";
    }
  }

  document.querySelectorAll(".spell-conc-btn").forEach((btn) => {
    const cardSpellName = btn.dataset.spellName || "";
    if (spellVal && cardSpellName.toLowerCase() === spellVal.toLowerCase()) {
      btn.classList.add("active");
      btn.textContent = "Concentrating";
    } else {
      btn.classList.remove("active");
      btn.textContent = "Concentrate";
    }
  });
}

function updateWealthAndEncumbrance() {
  const cp = parseInt(document.getElementById("coin_cp")?.value, 10) || 0;
  const sp = parseInt(document.getElementById("coin_sp")?.value, 10) || 0;
  const ep = parseInt(document.getElementById("coin_ep")?.value, 10) || 0;
  const gp = parseInt(document.getElementById("coin_gp")?.value, 10) || 0;
  const pp = parseInt(document.getElementById("coin_pp")?.value, 10) || 0;

  const totalGp = gp + (pp * 10) + (ep * 0.5) + (sp * 0.1) + (cp * 0.01);
  const wealthEl = document.getElementById("totalWealthGpDisplay");
  if (wealthEl) {
    wealthEl.textContent = `Total Value: ${totalGp.toLocaleString(undefined, { maximumFractionDigits: 2 })} GP`;
  }

  const strScore = parseInt(document.getElementById("attr_str")?.value, 10) || 10;
  const maxCarry = strScore * 15;

  let carriedLbs = 0;
  if (Array.isArray(myStructuredInventory)) {
    myStructuredInventory.forEach((item) => {
      const q = parseFloat(item.qty) || 0;
      const w = parseFloat(item.weight) || 0;
      carriedLbs += q * w;
    });
  }

  const weightDisplay = document.getElementById("carryWeightDisplay");
  const barFill = document.getElementById("encumbranceBarFill");
  const statusText = document.getElementById("encumbranceStatusText");

  if (weightDisplay) {
    weightDisplay.textContent = `${carriedLbs.toFixed(1).replace(/\.0$/, "")} / ${maxCarry} lbs`;
  }

  const pct = Math.min(100, Math.max(0, (carriedLbs / Math.max(1, maxCarry)) * 100));
  if (barFill) {
    barFill.style.width = `${pct}%`;
    barFill.style.background = carriedLbs > maxCarry ? "#ef4444" : (pct > 66 ? "#f59e0b" : "#10b981");
  }
  if (statusText) {
    if (carriedLbs > maxCarry) {
      statusText.textContent = `Overencumbered! Speed reduced (Max = ${maxCarry} lbs)`;
    } else {
      statusText.textContent = `Unencumbered (Max = STR × 15 = ${maxCarry} lbs)`;
    }
  }
}

function updateTabCounters() {
  const traitsBadge = document.getElementById("traitsCountBadge");
  const spellsBadge = document.getElementById("spellsCountBadge");
  if (traitsBadge) traitsBadge.textContent = myCharacterTraits.length;
  if (spellsBadge) spellsBadge.textContent = myCharacterSpells.length;
}

function filterSkillsMatrix() {
  const q = (document.getElementById("quickSkillSearch")?.value || "").toLowerCase().trim();

  document.querySelectorAll(".skill-attr-column").forEach((col) => {
    let visibleCount = 0;
    col.querySelectorAll(".skill-row").forEach((row) => {
      const label = (row.querySelector(".skill-label")?.textContent || "").toLowerCase();
      const isProf = !!row.querySelector(".prof-cb")?.checked;
      const isExp = !!row.querySelector(".exp-cb")?.checked;

      const matchesSearch = !q || label.includes(q);
      const matchesProf = !filterProficientSkillsOnly || isProf || isExp;

      if (matchesSearch && matchesProf) {
        row.style.display = "flex";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });
    col.style.display = visibleCount > 0 ? "flex" : "none";
  });
}

function recalculateAll() {
  const levelInput = document.getElementById("charLevel");
  const level = Math.min(20, Math.max(1, parseInt(levelInput?.value, 10) || 1));
  const prof = getProfBonus(level);
  const isJackOfAllTrades = !!document.getElementById("jackOfAllTradesCb")?.checked;
  const halfProf = Math.floor(prof / 2);

  const profBonusDisplay = document.getElementById("profBonusDisplay");
  if (profBonusDisplay) profBonusDisplay.textContent = formatSigned(prof);

  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  const mods = {};

  stats.forEach((stat) => {
    const scoreVal = parseInt(document.getElementById(`attr_${stat}`)?.value, 10) || 10;
    const mod = getModifier(scoreVal);
    mods[stat] = mod;

    const modElem = document.getElementById(`mod_${stat}`);
    if (modElem) modElem.textContent = formatSigned(mod);

    const isSaveChecked = document.getElementById(`save_${stat}`)?.checked;
    const saveValElem = document.getElementById(`save_val_${stat}`);
    if (saveValElem) {
      const saveTotal = isSaveChecked ? mod + prof : mod;
      saveValElem.textContent = formatSigned(saveTotal);
    }
  });

  // Initiative Orb Calculation
  const initMisc = parseInt(document.getElementById("initBonusMod")?.value, 10) || 0;
  const initTotal = (mods["dex"] || 0) + initMisc + (isJackOfAllTrades ? halfProf : 0);
  const initDisplay = document.getElementById("initiativeDisplay");
  if (initDisplay) initDisplay.textContent = formatSigned(initTotal);

  let percBonus = mods["wis"] || 0;
  let insBonus = mods["wis"] || 0;
  let invBonus = mods["int"] || 0;

  document.querySelectorAll(".skill-row").forEach((row) => {
    const stat = row.dataset.stat;
    const statMod = mods[stat] ?? 0;
    const isProf = row.querySelector(".prof-cb")?.checked;
    const isExp = row.querySelector(".exp-cb")?.checked;

    let total = statMod;
    if (isProf) total += prof;
    if (isExp) total += prof;
    if (!isProf && !isExp && isJackOfAllTrades) total += halfProf;

    const valElem = row.querySelector(".skill-val");
    if (valElem) valElem.textContent = formatSigned(total);

    if (row.id === "row_perc") percBonus = total;
    if (row.id === "row_ins") insBonus = total;
    if (row.id === "row_inv") invBonus = total;
  });

  const passPercEl = document.getElementById("passivePerception");
  if (passPercEl) passPercEl.textContent = 10 + percBonus;

  const passInsEl = document.getElementById("passiveInsight");
  if (passInsEl) passInsEl.textContent = 10 + insBonus;

  const passInvEl = document.getElementById("passiveInvestigation");
  if (passInvEl) passInvEl.textContent = 10 + invBonus;

  updateXpBar();
  updateHealthBars();
  updateConcentrationBanner();
  updateWealthAndEncumbrance();
  updateTabCounters();
  filterSkillsMatrix();
}

/* ==========================================================================
   DYNAMIC SECTION RENDERERS
   ========================================================================== */

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

  if (!Array.isArray(myCharacterWeapons)) {
    myCharacterWeapons = [];
  }

  while (myCharacterWeapons.length < 2) {
    myCharacterWeapons.push({ name: "", dmg: "", type: "", notes: "" });
  }

  container.innerHTML = myCharacterWeapons.map((wpn, idx) => `
    <div class="attack-entry weapon-row-card" data-index="${idx}">
      <input type="text" class="save-field wpn-field wpn-name-input" data-prop="name" value="${escapeHtml(wpn.name || "")}" placeholder="Weapon..." />
      <div class="wpn-cell-with-roll">
        <input type="text" class="save-field wpn-field wpn-dmg-input center" data-prop="dmg" value="${escapeHtml(wpn.dmg || "")}" placeholder="1d8+3" />
        <button type="button" class="wpn-roll-btn wpn-roll-dmg-btn" data-index="${idx}" title="Roll Weapon Damage">&#9876;</button>
      </div>
      <input type="text" class="save-field wpn-field wpn-type-input center" data-prop="type" value="${escapeHtml(wpn.type || wpn.atk || "")}" placeholder="Type..." />
      <input type="text" class="save-field wpn-field wpn-notes-input" data-prop="notes" value="${escapeHtml(wpn.notes || "")}" placeholder="Properties / Notes..." />
      <button type="button" class="weapon-delete-btn" data-index="${idx}" title="Delete weapon">&times;</button>
    </div>
  `).join("");
}

function renderCustomResources() {
  const container = document.getElementById("customResourcesList");
  if (!container) return;

  if (!Array.isArray(myCustomResources)) myCustomResources = [];

  if (myCustomResources.length === 0) {
    container.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-dim); font-style: italic;">No custom trackers yet. Click "+ Add Counter" to track Arrows, Bardic Inspiration, Luck, or Channel Divinity.</span>`;
    return;
  }

  container.innerHTML = myCustomResources.map((res, idx) => `
    <div class="custom-res-card" data-index="${idx}">
      <input type="text" class="custom-res-name custom-res-field" data-prop="name" value="${escapeHtml(res.name || "")}" placeholder="Resource..." />
      <div class="custom-res-controls">
        <input type="number" class="custom-res-input custom-res-field" data-prop="cur" value="${res.cur ?? 0}" />
        <span style="color: var(--text-dim); font-weight: 800;">/</span>
        <input type="number" class="custom-res-input custom-res-field" data-prop="max" value="${res.max ?? 0}" />
        <button type="button" class="custom-res-del" data-index="${idx}" title="Remove tracker">&times;</button>
      </div>
    </div>
  `).join("");
}

function renderStructuredInventory() {
  const container = document.getElementById("structuredInventoryList");
  if (!container) return;

  if (!Array.isArray(myStructuredInventory)) myStructuredInventory = [];

  if (myStructuredInventory.length === 0) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-dim); font-style: italic; padding: 0.4rem 0;">No individual weight-tracked items yet. Click "+ Add Tracked Item" to calculate encumbrance automatically.</p>`;
    updateWealthAndEncumbrance();
    return;
  }

  container.innerHTML = myStructuredInventory.map((item, idx) => `
    <div class="inv-item-row" data-index="${idx}">
      <input type="checkbox" class="inv-item-field" data-prop="equipped" ${item.equipped ? "checked" : ""} title="Equipped / Carried" />
      <input type="text" class="inv-item-field" data-prop="name" value="${escapeHtml(item.name || "")}" placeholder="Item name..." />
      <input type="number" class="inv-item-field center" data-prop="qty" value="${item.qty ?? 1}" min="0" title="Quantity" placeholder="Qty" />
      <input type="number" class="inv-item-field center" data-prop="weight" value="${item.weight ?? 0}" min="0" step="0.5" title="Weight (lbs per item)" placeholder="lbs" />
      <button type="button" class="weapon-delete-btn inv-item-delete" data-index="${idx}" title="Remove item">&times;</button>
    </div>
  `).join("");

  updateWealthAndEncumbrance();
}

function renderCompanions() {
  const container = document.getElementById("companionsList");
  if (!container) return;

  if (!Array.isArray(myCompanions)) myCompanions = [];

  if (myCompanions.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.88rem; color: #64748b; font-style: italic; padding: 2rem 0; text-align: center;">No companions, familiars, mounts, or creatures added yet. Click "+ Add Creature" above to create a statblock.</p>`;
    return;
  }

  container.innerHTML = myCompanions.map((comp, idx) => `
    <div class="companion-card" data-index="${idx}">
      <div class="trait-card-header">
        <input type="text" class="trait-name-input companion-field" data-prop="name" value="${escapeHtml(comp.name || "")}" placeholder="Creature Name (e.g. Owl Familiar, Dire Wolf)" />
        <button type="button" class="trait-card-delete companion-delete-btn" data-index="${idx}" title="Delete creature">&times;</button>
      </div>
      <div class="trait-type-wrap">
        <input type="text" class="trait-type-input companion-field" data-prop="type" value="${escapeHtml(comp.type || "Beast / Familiar")}" placeholder="Type &amp; CR" />
      </div>
      <div class="comp-stats-row">
        <div class="comp-stat-pill">
          <label>AC</label>
          <input type="number" class="companion-field" data-prop="ac" value="${comp.ac ?? 12}" />
        </div>
        <div class="comp-stat-pill">
          <label>Hit Points</label>
          <input type="text" class="companion-field" data-prop="hp" value="${escapeHtml(comp.hp || "10 / 10")}" placeholder="15 / 15" />
        </div>
        <div class="comp-stat-pill">
          <label>Speed</label>
          <input type="text" class="companion-field" data-prop="speed" value="${escapeHtml(comp.speed || "30 ft.")}" placeholder="30 ft., fly 60 ft." />
        </div>
      </div>
      <textarea class="trait-desc-input companion-field" data-prop="notes" placeholder="STR 10 DEX 14 CON 12... Attacks, Keen Senses, Flyby, Pack Tactics...">${escapeHtml(comp.notes || "")}</textarea>
    </div>
  `).join("");
}

function renderMyTraits() {
  const container = document.getElementById("traitsList");
  if (!container) return;

  updateTabCounters();

  if (myCharacterTraits.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.88rem; color: #64748b; font-style: italic; padding: 2rem 0; text-align: center;">No abilities added yet. Click "+ Add Ability" above to browse the compendium.</p>`;
    return;
  }

  const searchQuery = (document.getElementById("filterTraitsInput")?.value || "").toLowerCase().trim();

  container.innerHTML = myCharacterTraits.map((trait, idx) => {
    if (!trait) return "";
    const isExpanded = !!trait.isExpanded;
    const tName = (trait.name || "").toLowerCase();
    const tType = (trait.type || "FEATURE").toLowerCase();
    const tDesc = (trait.desc || "").toLowerCase();

    let matchesCat = true;
    if (activeTraitCategoryFilter === "class") matchesCat = tType.includes("class");
    else if (activeTraitCategoryFilter === "racial") matchesCat = tType.includes("rac") || tType.includes("species");
    else if (activeTraitCategoryFilter === "feat") matchesCat = tType.includes("feat");

    const matchesSearch = !searchQuery || tName.includes(searchQuery) || tType.includes(searchQuery) || tDesc.includes(searchQuery);
    const hiddenStyle = (matchesCat && matchesSearch) ? "" : "display: none;";

    return `
      <div class="trait-card ${isExpanded ? "expanded" : ""}" data-index="${idx}" style="${hiddenStyle}">
        <div class="trait-card-header">
          <input type="text" class="trait-name-input custom-trait-field" data-prop="name" value="${escapeHtml(trait.name || "")}" placeholder="Ability Name" />
          <button class="trait-card-delete" data-index="${idx}" type="button" title="Delete ability">&times;</button>
        </div>
        <div class="trait-type-wrap">
          <input type="text" class="trait-type-input custom-trait-field" data-prop="type" value="${escapeHtml(trait.type || "FEATURE")}" placeholder="Category (e.g. Class Feature, Feat)" />
        </div>
        <textarea class="trait-desc-input custom-trait-field" data-prop="desc" placeholder="Ability description and rules...">${escapeHtml(trait.desc || "")}</textarea>
        <div class="trait-card-footer">
          <button type="button" class="trait-expand-btn">
            ${isExpanded ? "Collapse" : "Expand"}
            <span class="trait-expand-icon">&blacktriangledown;</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  updateTabCounters();

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.88rem; color: #64748b; text-align: center; font-style: italic; padding: 1.5rem 0;">No spells added yet. Click "+ Add Spell" above to browse the compendium.</p>`;
    return;
  }

  const searchQ = (document.getElementById("filterSpellbookInput")?.value || "").toLowerCase().trim();
  const activeConc = (document.getElementById("spellConcentration")?.value || "").trim().toLowerCase();

  container.innerHTML = myCharacterSpells.map((spell, idx) => {
    if (!spell) return "";
    const typeVal = spell.type || spell.levelTag || "Cantrip";
    const descVal = Array.isArray(spell.desc) ? spell.desc.join("\n\n") : (spell.desc || "");
    const sName = spell.name || "";
    const isConcentrating = activeConc && sName.toLowerCase() === activeConc;

    let matchesLvl = true;
    const lowerType = typeVal.toLowerCase();
    if (activeSpellLevelFilter === "cantrip") {
      matchesLvl = lowerType.includes("cantrip") || lowerType.includes("0");
    } else if (activeSpellLevelFilter === "5") {
      matchesLvl = /[56789]/.test(lowerType);
    } else if (activeSpellLevelFilter !== "all") {
      matchesLvl = lowerType.includes(activeSpellLevelFilter);
    }

    const matchesSearch = !searchQ ||
      sName.toLowerCase().includes(searchQ) ||
      lowerType.includes(searchQ) ||
      descVal.toLowerCase().includes(searchQ);

    const isExpanded = !!spell.isExpanded;
    const hiddenStyle = (matchesLvl && matchesSearch) ? "" : "display: none;";

    return `
      <div class="spell-card ${isExpanded ? "expanded" : ""}" draggable="true" data-index="${idx}" style="${hiddenStyle}">
        <div class="spell-card-header">
          <span class="spell-drag-handle" title="Drag to reorder">&vellip;&vellip;</span>
          <input type="text" class="spell-custom-title-input custom-spell-field" data-prop="name" value="${escapeHtml(sName)}" placeholder="Spell Name" />
          <div class="spell-card-actions">
            <button type="button" class="spell-conc-btn ${isConcentrating ? "active" : ""}" data-spell-name="${escapeHtml(sName)}" title="Set as active concentration spell">
              ${isConcentrating ? "Concentrating" : "Concentrate"}
            </button>
            <button class="spell-card-delete" data-index="${idx}" type="button" title="Delete spell">&times;</button>
          </div>
        </div>
        <div class="spell-card-meta">
          <div class="spell-meta-badge">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="type" value="${escapeHtml(typeVal)}" placeholder="Level / Type" />
          </div>
          <div class="spell-meta-badge">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="casting_time" value="${escapeHtml(spell.casting_time || "")}" placeholder="1 Action" />
          </div>
          <div class="spell-meta-badge">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="range" value="${escapeHtml(spell.range || "")}" placeholder="30 ft" />
          </div>
          <div class="spell-meta-badge">
            <input type="text" class="spell-meta-input custom-spell-field center" data-prop="duration" value="${escapeHtml(spell.duration || "")}" placeholder="Instant" />
          </div>
        </div>
        <textarea class="spell-custom-desc-textarea custom-spell-field" data-prop="desc" placeholder="Spell description and effects...">${escapeHtml(descVal)}</textarea>
        <div class="trait-card-footer">
          <button type="button" class="spell-expand-btn">
            ${isExpanded ? "Collapse" : "Expand"}
            <span class="trait-expand-icon">${isExpanded ? "&blacktriangle;" : "&blacktriangledown;"}</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  attachSpellDragEvents();
}

function attachSpellDragEvents() {
  document.querySelectorAll(".spell-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA", "BUTTON"].includes(e.target.tagName)) {
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

function renderSpellSlotGrid(savedFields = null) {
  const container = document.getElementById("slotsGridContainer");
  if (!container) return;

  const suffixes = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  let html = "";

  for (let lvl = 1; lvl <= 9; lvl++) {
    const curVal = savedFields
      ? (parseInt(savedFields[`slot${lvl}_cur`], 10) || 0)
      : (parseInt(document.getElementById(`slot${lvl}_cur`)?.value, 10) || 0);
    const maxVal = savedFields
      ? (parseInt(savedFields[`slot${lvl}_max`], 10) || 0)
      : (parseInt(document.getElementById(`slot${lvl}_max`)?.value, 10) || 0);

    let pipsHtml = "";
    for (let i = 0; i < maxVal; i++) {
      const isAvailable = i < curVal;
      pipsHtml += `<span class="slot-pip ${isAvailable ? "active" : ""}" data-slot-lvl="${lvl}" data-pip-idx="${i}" title="${isAvailable ? "Click to Expend Slot" : "Click to Recover Slot"}"></span>`;
    }

    html += `
      <div class="slot-tile" data-slot-lvl="${lvl}">
        <span class="slot-level">${suffixes[lvl - 1]}</span>
        <div class="slot-pips-container">
          ${pipsHtml || '<span style="font-size:0.65rem; color:#475569;">No Slots</span>'}
        </div>
        <div class="slot-counter">
          <input type="number" id="slot${lvl}_cur" class="save-field slot-input center" value="${curVal}" min="0" />
          <span class="slot-divider">/</span>
          <input type="number" id="slot${lvl}_max" class="save-field slot-input center" value="${maxVal}" min="0" />
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateSlotPips(lvl) {
  const tile = document.querySelector(`.slot-tile[data-slot-lvl="${lvl}"]`);
  if (!tile) return;
  const cur = parseInt(document.getElementById(`slot${lvl}_cur`)?.value, 10) || 0;
  const max = parseInt(document.getElementById(`slot${lvl}_max`)?.value, 10) || 0;
  const pipsBox = tile.querySelector(".slot-pips-container");
  if (!pipsBox) return;

  let pipsHtml = "";
  for (let i = 0; i < max; i++) {
    const isAvailable = i < cur;
    pipsHtml += `<span class="slot-pip ${isAvailable ? "active" : ""}" data-slot-lvl="${lvl}" data-pip-idx="${i}" title="${isAvailable ? "Click to Expend Slot" : "Click to Recover Slot"}"></span>`;
  }
  pipsBox.innerHTML = pipsHtml || '<span style="font-size:0.65rem; color:#475569;">No Slots</span>';
}

function renderAvatar() {
  const imgEl = document.getElementById("charAvatarImg");
  const placeholderEl = document.getElementById("avatarPlaceholder");
  if (!imgEl || !placeholderEl) return;

  if (myCharacterAvatar) {
    imgEl.src = myCharacterAvatar;
    imgEl.style.display = "block";
    placeholderEl.style.display = "none";
  } else {
    imgEl.src = "";
    imgEl.style.display = "none";
    placeholderEl.style.display = "flex";
  }
}

/* ==========================================================================
   DICE ENGINE (ADVANTAGE / DISADVANTAGE, CRITS & LIVE PARTY BROADCAST)
   ========================================================================== */

function performD20Roll(bonus = 0, label = "Roll") {
  const r1 = Math.floor(Math.random() * 20) + 1;
  const r2 = Math.floor(Math.random() * 20) + 1;

  let chosen = r1;
  let rollDetail = `${r1}`;

  if (currentDiceMode === "adv") {
    chosen = Math.max(r1, r2);
    rollDetail = `ADV [${r1}, ${r2}] → ${chosen}`;
  } else if (currentDiceMode === "dis") {
    chosen = Math.min(r1, r2);
    rollDetail = `DIS [${r1}, ${r2}] → ${chosen}`;
  }

  const total = chosen + bonus;
  const bonusStr = bonus !== 0 ? (bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`) : "";

  updateDiceBadgeDisplay(total, `${label} (${rollDetail}${bonusStr})`, chosen === 20, chosen === 1);
  addDiceHistory(`${label} (${rollDetail}${bonusStr})`, total);
  return { chosen, total };
}

function updateDiceBadgeDisplay(total, captionText = "Result", isCritSuccess = false, isCritFail = false) {
  const out = document.getElementById("rollResult");
  const cap = document.getElementById("rollDetailCaption");
  const badge = document.getElementById("diceResultBadge");

  // Normalize any uppercase 'D' in dice formulas like 1D100 -> 1d100
  const normalizedCap = (captionText || "").replace(/(\d+)D(\d+)/g, "$1d$2");

  if (out) out.textContent = total;
  if (cap) {
    if (isCritSuccess) cap.textContent = "NATURAL 20!";
    else if (isCritFail) cap.textContent = "NATURAL 1!";
    else cap.textContent = normalizedCap.length > 22 ? normalizedCap.slice(0, 22) + "…" : normalizedCap;
  }

  if (badge) {
    badge.classList.remove("crit-success", "crit-fail", "dice-pop-anim");
    void badge.offsetWidth; // Reflow to restart animation smoothly
    badge.classList.add("dice-pop-anim");
    if (isCritSuccess) badge.classList.add("crit-success");
    else if (isCritFail) badge.classList.add("crit-fail");
  }
}

function toggleDiceRoller(forceState) {
  const bar = document.getElementById("diceStationBar");
  const btn = document.getElementById("floatingD20RollerBtn");
  if (!bar) return;

  if (typeof forceState === "boolean") {
    isDiceRollerOpen = forceState;
  } else {
    isDiceRollerOpen = !isDiceRollerOpen;
  }

  if (isDiceRollerOpen) {
    bar.classList.add("open");
    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-expanded", "true");
    }
  } else {
    bar.classList.remove("open");
    if (btn) {
      btn.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    }
  }
}

function rollCustomFormula(formulaStr, customLabel = "") {
  const rawMatch = (formulaStr || "").toLowerCase().match(/(\d*d\d+(?:\s*[+-]\s*\d+)?)/);
  const clean = rawMatch ? rawMatch[1].replace(/\s+/g, "") : (formulaStr || "").replace(/\s+/g, "").toLowerCase();
  if (!clean) return;

  const regex = /^(\d*)d(\d+)([+-]\d+)?$/;
  const match = clean.match(regex);
  if (!match) {
    alert("Invalid dice formula. Use formats like: 2d6+4, 8d6, 1d8-1, or d20+5");
    return;
  }

  const count = Math.min(100, Math.max(1, parseInt(match[1] || "1", 10)));
  const sides = Math.max(2, parseInt(match[2], 10));
  const mod = match[3] ? parseInt(match[3], 10) : 0;

  if (count === 1 && sides === 20) {
    performD20Roll(mod, customLabel || clean);
    return;
  }

  const rolls = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  const total = sum + mod;
  const modText = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
  const labelPrefix = customLabel ? `${customLabel}: ` : "";
  const detail = `${labelPrefix}${count}d${sides}${modText} [${rolls.join(", ")}]`;

  updateDiceBadgeDisplay(total, customLabel || `${count}d${sides}${modText}`);
  addDiceHistory(detail, total);
}

function addDiceHistory(desc, total) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const charName = document.getElementById("charName")?.value?.trim() || "Adventurer";

  diceRollHistory.unshift({ desc, total, time });
  if (diceRollHistory.length > 25) diceRollHistory.pop();
  renderDiceHistory();

  lastBroadcastRoll = {
    charName,
    desc,
    total: String(total),
    timestamp: Date.now()
  };

  if (db && connectedCampaignRoom && activeCharId) {
    if (!activeDMRoomCode || activeDMRoomCode !== connectedCampaignRoom) {
      db.collection("campaigns")
        .doc(connectedCampaignRoom)
        .collection("members")
        .doc(activeCharId)
        .set({ lastRoll: lastBroadcastRoll, updatedAt: Date.now() }, { merge: true })
        .catch(() => {});
    }
  }
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
    if (myActiveConditions.includes(cond)) chip.classList.add("active");
    else chip.classList.remove("active");
  });
}

function renderBlurredPills() {
  document.querySelectorAll("[data-blur-id]").forEach((el) => {
    const blurId = el.dataset.blurId;
    if (myBlurredPills.includes(blurId)) el.classList.add("blurred");
    else el.classList.remove("blurred");
  });
}

/* ==========================================================================
   ROSTER, LOCALSTORAGE & FIREBASE CLOUD SYNC
   ========================================================================== */

function getRoster() {
  try {
    return JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function extractFullCharacterPayload(charData) {
  const f = charData.fields || {};

  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  const attributes = {};
  stats.forEach((s) => {
    const score = parseInt(f[`attr_${s}`], 10) || 10;
    const mod = getModifier(score);
    const save = f[`save_${s}`] ? mod + getProfBonus(parseInt(f.charLevel, 10) || 1) : mod;
    attributes[s] = { score, mod, save, isSaveProf: !!f[`save_${s}`] };
  });

  const spellSlots = {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    spellSlots[lvl] = {
      cur: parseInt(f[`slot${lvl}_cur`], 10) || 0,
      max: parseInt(f[`slot${lvl}_max`], 10) || 0
    };
  }

  const curHp = parseInt(f.curHp, 10) || 0;
  const maxHp = parseInt(f.maxHp, 10) || 10;
  const tempHp = parseInt(f.tempHp, 10) || 0;

  const payload = {
    id: activeCharId,
    ownerUid: auth?.currentUser?.uid || "anon",
    name: charData.name || "Unnamed Adventurer",
    charClass: f.charClass || "",
    charSubclass: f.charSubclass || "",
    charRace: f.charRace || "",
    charBackground: f.charBackground || "",
    charAlignment: f.charAlignment || "",
    level: parseInt(f.charLevel, 10) || 1,
    avatar: myCharacterAvatar || "",
    hp: { cur: curHp, max: maxHp, temp: tempHp },
    ac: parseInt(f.ac, 10) || 10,
    speed: parseInt(f.charSpeed, 10) || 30,
    deathSaves: {
      succ: parseInt(f.deathSucc, 10) || 0,
      fail: parseInt(f.deathFail, 10) || 0
    },
    classPoints: {
      cur: parseInt(f.classPtsCur, 10) || 0,
      max: parseInt(f.classPtsMax, 10) || 0
    },
    hitDice: {
      cur: f.hitDiceCur || "1",
      max: f.hitDiceMax || "1"
    },
    attributes,
    spellSlots,
    spells: myCharacterSpells || [],
    traits: myCharacterTraits || [],
    weapons: myCharacterWeapons || [],
    customResources: myCustomResources || [],
    structuredInventory: myStructuredInventory || [],
    companions: myCompanions || [],
    conditions: myActiveConditions || [],
    concentration: (f.spellConcentration || "").trim(),
    otherProfs: f.otherProfs || "",
    passivePerception: parseInt(document.getElementById("passivePerception")?.textContent, 10) || 10,
    passiveInsight: parseInt(document.getElementById("passiveInsight")?.textContent, 10) || 10,
    passiveInvestigation: parseInt(document.getElementById("passiveInvestigation")?.textContent, 10) || 10,
    inspiration: f.charInspiration || "",
    heroicInspiration: !!f.heroicInspirationToggle,
    updatedAt: Date.now()
  };

  if (lastBroadcastRoll) {
    payload.lastRoll = lastBroadcastRoll;
  }

  return payload;
}

async function ensureAuthenticated() {
  if (!auth) return;
  if (!auth.currentUser) {
    try {
      await auth.signInAnonymously();
    } catch (e) {
      // Unauthenticated access to campaign rooms and party features is fully supported
    }
  }
}

async function syncToLiveCampaign(charData) {
  if (!db || !connectedCampaignRoom || !charData) return;
  // If the user is currently hosting this room as the DM, do not sync character as a player
  if (activeDMRoomCode && activeDMRoomCode === connectedCampaignRoom) return;
  try {
    await ensureAuthenticated();
    const payload = extractFullCharacterPayload(charData);
    await db.collection("campaigns").doc(connectedCampaignRoom).collection("members").doc(activeCharId).set(payload, { merge: true });
  } catch (err) {
    console.error("Live party sync failed:", err);
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
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  } catch (err) {
    console.error("Local storage save error:", err);
    showStatus("Storage Full: Could not save locally!");
  }
  syncRosterToCloud(roster);
}

function getCurrentSheetData() {
  const fields = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.id) {
      fields[field.id] = field.type === "checkbox" ? field.checked : field.value;
    }
  });
  return fields;
}

function saveSheet(quiet = false) {
  const roster = getRoster();
  const fields = getCurrentSheetData();
  const name = fields.charName?.trim() || "Unnamed Character";
  const charClass = fields.charClass?.trim() || "";
  const subclass = fields.charSubclass?.trim() || "";
  const level = fields.charLevel || 1;

  const classLabel = subclass ? `${subclass} ${charClass}`.trim() : charClass;

  const charRecord = {
    id: activeCharId,
    name: name,
    summary: classLabel ? `${classLabel} (Lvl ${level})` : `Level ${level}`,
    updatedAt: Date.now(),
    avatar: myCharacterAvatar,
    fields: fields,
    spells: myCharacterSpells,
    traits: myCharacterTraits,
    weapons: myCharacterWeapons,
    customResources: myCustomResources,
    structuredInventory: myStructuredInventory,
    companions: myCompanions,
    conditions: myActiveConditions,
    blurredPills: myBlurredPills,
    handouts: myHandouts,
    claimedHandouts: myClaimedHandoutIds
  };

  roster[activeCharId] = charRecord;
  saveRoster(roster);
  localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  syncToLiveCampaign(charRecord);
  if (typeof sendSessionHeartbeat === "function") sendSessionHeartbeat();
  if (!quiet) showStatus("Saved!");
}

function applyCharacterData(charData) {
  if (!charData) return;
  const fields = charData.fields || {};

  renderSpellSlotGrid(fields);

  Object.keys(fields).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") el.checked = !!fields[id];
      else el.value = fields[id];
    }
  });

  // Migrate legacy Hit Dice strings (e.g. "d10" or "2d10" in hitDiceMax) cleanly into #hitDieSize
  const hdMaxEl = document.getElementById("hitDiceMax");
  const hdSizeEl = document.getElementById("hitDieSize");
  if (hdMaxEl && typeof hdMaxEl.value === "string" && hdMaxEl.value.toLowerCase().includes("d")) {
    const match = hdMaxEl.value.toLowerCase().match(/(\d*)d(\d+)/);
    if (match) {
      const countPart = parseInt(match[1], 10) || parseInt(fields.charLevel, 10) || 1;
      const diePart = match[2];
      hdMaxEl.value = countPart;
      if (hdSizeEl && ["6", "8", "10", "12"].includes(diePart)) {
        hdSizeEl.value = diePart;
      }
    }
  }

  myCharacterAvatar = charData.avatar || "";
  myCharacterSpells = charData.spells || [];
  myCharacterTraits = charData.traits || [];
  myCustomResources = charData.customResources || [];
  myStructuredInventory = charData.structuredInventory || [];
  myCompanions = charData.companions || [];
  myActiveConditions = charData.conditions || [];
  myBlurredPills = charData.blurredPills || [];
  myHandouts = charData.handouts || [];
  myClaimedHandoutIds = charData.claimedHandouts || [];
  myCharacterWeapons = charData.weapons && charData.weapons.length >= 2 ? charData.weapons : [
    { name: "", dmg: "", type: "", notes: "" },
    { name: "", dmg: "", type: "", notes: "" }
  ];

  renderAvatar();
  renderWeapons();
  renderCustomResources();
  renderStructuredInventory();
  renderCompanions();
  renderMySpells();
  renderMyTraits();
  renderConditionChips();
  renderBlurredPills();
  renderHandoutsGrid();
  recalculateAll();
  syncToLiveCampaign(charData);
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
      renderSpellSlotGrid();
      recalculateAll();
      renderAvatar();
      renderWeapons();
      renderCustomResources();
      renderStructuredInventory();
      renderCompanions();
      renderMySpells();
      renderMyTraits();
      renderConditionChips();
      renderBlurredPills();
      renderHandoutsGrid();
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
    else if (field.id === "hitDiceCur" || field.id === "hitDiceMax") field.value = 1;
    else if (field.id === "hitDieSize") field.value = 8;
    else if (
      field.classList.contains("hitdice-input") ||
      field.classList.contains("coin-input") ||
      field.classList.contains("slot-input") ||
      field.classList.contains("death-input") ||
      field.classList.contains("res-input") ||
      field.classList.contains("exhaustion-input") ||
      field.id === "tempHp" ||
      field.id === "initBonusMod"
    ) field.value = 0;
    else field.value = "";
  });

  myCharacterAvatar = "";
  myCharacterSpells = [];
  myCharacterTraits = [];
  myCustomResources = [];
  myStructuredInventory = [];
  myCompanions = [];
  myActiveConditions = [];
  myBlurredPills = [];
  myHandouts = [];
  myClaimedHandoutIds = [];
  myCharacterWeapons = [
    { name: "", dmg: "", type: "", notes: "" },
    { name: "", dmg: "", type: "", notes: "" }
  ];
  diceRollHistory = [];

  renderSpellSlotGrid();
  renderAvatar();
  renderDiceHistory();
  renderWeapons();
  renderCustomResources();
  renderStructuredInventory();
  renderCompanions();
  renderMySpells();
  renderMyTraits();
  renderConditionChips();
  renderBlurredPills();
  renderHandoutsGrid();
  recalculateAll();
  saveSheet(false);
  showStatus("New Sheet Created!");
}

function switchMainTab(targetId) {
  if (!targetId) return;
  document.querySelectorAll(".main-tab").forEach((b) => {
    if (b.dataset.target === targetId) b.classList.add("active");
    else b.classList.remove("active");
  });
  document.querySelectorAll(".tab-page").forEach((p) => {
    if (p.id === targetId) p.classList.add("active");
    else p.classList.remove("active");
  });
  if (targetId === "tab-owlbear") {
    if (typeof updateOwlbearVitalsHUD === "function") updateOwlbearVitalsHUD();
    if (typeof resizeAndRenderOwlbearCanvas === "function") {
      requestAnimationFrame(() => {
        if (!vttCameraInitialized) {
          resetVttCameraToFit();
        }
        resizeAndRenderOwlbearCanvas();
      });
    }
  }
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove("open");
}

function closeAllModals() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
}

function renderCharList() {
  const container = document.getElementById("charList");
  if (!container) return;
  const roster = getRoster();
  const keys = Object.keys(roster);

  if (keys.length === 0) {
    container.innerHTML = `<p class="loading-text" style="color: #64748b; font-style: italic;">No saved characters found.</p>`;
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

  dropdown.innerHTML = html || `<div class="dropdown-item" style="color:#64748b; cursor:default;">No races match</div>`;
}

function setAuthError(message) {
  const el = document.getElementById("authErrorMsg");
  if (el) el.textContent = message || "";
}

const PRIMARY_ADMIN_EMAIL = "ludvigpoulsen08@gmail.com";
let additionalAdminEmails = [];
try {
  additionalAdminEmails = JSON.parse(localStorage.getItem("codex_admin_emails") || "[]");
  if (!Array.isArray(additionalAdminEmails)) additionalAdminEmails = [];
} catch (e) {
  additionalAdminEmails = [];
}

function isAdminSession(user = (auth?.currentUser || currentUser)) {
  if (!user || user.isAnonymous) return false;
  const email = (user.email || "").trim().toLowerCase();
  if (!email) return false;
  if (email === PRIMARY_ADMIN_EMAIL.toLowerCase()) return true;
  if (additionalAdminEmails.map((e) => (e || "").toLowerCase()).includes(email)) return true;
  return false;
}

function updateAuthUI(user) {
  const authBtn = document.getElementById("authModalBtn");
  const loggedOutView = document.getElementById("authLoggedOutView");
  const loggedInView = document.getElementById("authLoggedInView");
  const userText = document.getElementById("currentUserText");
  const topNavAdminBtn = document.getElementById("topNavAdminBtn");
  const adminBadgeInAccount = document.getElementById("adminBadgeInAccount");
  const openAdminFromAuthModalBtn = document.getElementById("openAdminFromAuthModalBtn");

  const isAdmin = isAdminSession(user);

  if (topNavAdminBtn) topNavAdminBtn.style.display = isAdmin ? "inline-flex" : "none";
  if (adminBadgeInAccount) adminBadgeInAccount.style.display = isAdmin ? "block" : "none";
  if (openAdminFromAuthModalBtn) openAdminFromAuthModalBtn.style.display = isAdmin ? "block" : "none";
  const partyQuickRow = document.getElementById("adminPartyModalQuickChatRow");
  if (partyQuickRow) partyQuickRow.style.display = isAdmin ? "flex" : "none";

  if (!isAdmin) {
    closeAdminModal();
    if (activeChatRoomOverride) {
      activeChatRoomOverride = null;
    }
  }

  if (typeof updatePartyStatusUI === "function") {
    updatePartyStatusUI();
  }
  if (typeof updateAdminChatBarUI === "function") {
    updateAdminChatBarUI();
  }

  if (user && !user.isAnonymous) {
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
    if (typeof sendSessionHeartbeat === "function") {
      sendSessionHeartbeat(true);
    }

    if (user && !user.isAnonymous && db) {
      try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists && doc.data()?.roster) {
          const merged = { ...getRoster(), ...doc.data().roster };
          localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(merged));
          loadSheet();
          showStatus("Cloud Synced");
        } else {
          const localRoster = getRoster();
          if (Object.keys(localRoster).length > 0) syncRosterToCloud(localRoster);
        }
      } catch (err) {
        console.error("Cloud sync load error:", err);
      }
    }
  });
}

/* ==========================================================================
   API FETCH CACHE & COMPENDIUM LOADERS
   ========================================================================== */

async function fetchAPI(url) {
  if (apiCache[url]) return apiCache[url];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache[url] = data;
    return data;
  } catch (err) {
    console.warn("API fetch failed:", url, err);
    return null;
  }
}

async function loadAllSpells() {
  allSpellsCache = [...BUILTIN_SPELLS];
  try {
    const data = await fetchAPI("https://www.dnd5eapi.co/api/spells");
    if (data && Array.isArray(data.results)) {
      const existing = new Set(allSpellsCache.map((s) => s.name.toLowerCase()));
      data.results.forEach((s) => {
        if (!existing.has(s.name.toLowerCase())) {
          const lvl = SRD_SPELL_LEVELS[s.index] !== undefined ? SRD_SPELL_LEVELS[s.index] : 1;
          allSpellsCache.push({
            name: s.name,
            levelTag: lvl === 0 ? "Cantrip" : `Level ${lvl}`,
            type: lvl === 0 ? "Cantrip" : `Level ${lvl}`,
            url: s.url,
            index: s.index
          });
        }
      });
    }
  } catch (err) {
    console.warn("Spells API offline; using built-ins only.", err);
  }
  allSpellsCache.sort((a, b) => a.name.localeCompare(b.name));
}

function filterAndRenderSpells(query = "") {
  const container = document.getElementById("spellApiList");
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = allSpellsCache.filter((s) => {
    return !q ||
      s.name.toLowerCase().includes(q) ||
      (s.levelTag && s.levelTag.toLowerCase().includes(q)) ||
      (s.schoolTag && s.schoolTag.toLowerCase().includes(q)) ||
      (s.classesTag && s.classesTag.toLowerCase().includes(q));
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p class="loading-text">No spells found matching "${escapeHtml(query)}".</p>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map((spell) => {
    const isCantrip = (spell.levelTag || "").toLowerCase().includes("cantrip");
    return `
      <div class="spell-option-item spell-pick-row" data-name="${escapeHtml(spell.name)}" data-url="${escapeHtml(spell.url || "")}">
        <div class="spell-option-details">
          <span class="spell-option-title">${escapeHtml(spell.name)}</span>
          <div class="spell-meta-tags">
            <span class="tag-pill ${isCantrip ? "tag-cantrip" : "tag-level"}">${escapeHtml(spell.levelTag || "Spell")}</span>
            ${spell.schoolTag ? `<span class="tag-pill ${getSchoolCssClass(spell.schoolTag)}">${escapeHtml(spell.schoolTag)}</span>` : ""}
            ${spell.classesTag ? `<span class="tag-pill ${getClassCssClass(spell.classesTag)}">${escapeHtml(spell.classesTag)}</span>` : ""}
          </div>
        </div>
        <button type="button" class="spell-add-badge">+ Add</button>
      </div>
    `;
  }).join("");
}

async function loadAllTraits() {
  allTraitsCache = [...BUILTIN_TRAITS];
  try {
    const data = await fetchAPI("https://www.dnd5eapi.co/api/features");
    if (data && Array.isArray(data.results)) {
      const existing = new Set(allTraitsCache.map((t) => t.name.toLowerCase()));
      data.results.forEach((f) => {
        if (!existing.has(f.name.toLowerCase())) {
          allTraitsCache.push({
            name: f.name,
            type: "Class Feature",
            url: f.url,
            index: f.index
          });
        }
      });
    }
  } catch (err) {
    console.warn("Features API offline; using built-ins only.", err);
  }
}

function filterAndRenderTraits(query = "") {
  const container = document.getElementById("traitApiList");
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = allTraitsCache.filter((t) => {
    return !q ||
      t.name.toLowerCase().includes(q) ||
      (t.type && t.type.toLowerCase().includes(q)) ||
      (t.classes && t.classes.some((c) => c.toLowerCase().includes(q))) ||
      (t.races && t.races.some((r) => r.toLowerCase().includes(q)));
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p class="loading-text">No features or traits found matching "${escapeHtml(query)}".</p>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map((trait) => {
    const classTag = trait.classes ? trait.classes.join(", ") : (trait.races ? trait.races.join(", ") : "");
    return `
      <div class="spell-option-item trait-pick-row" data-name="${escapeHtml(trait.name)}" data-url="${escapeHtml(trait.url || "")}" data-type="${escapeHtml(trait.type || "Feature")}">
        <div class="spell-option-details">
          <span class="spell-option-title">${escapeHtml(trait.name)}</span>
          <div class="spell-meta-tags">
            <span class="tag-pill tag-cantrip">${escapeHtml(trait.type || "Feature")}</span>
            ${classTag ? `<span class="tag-pill ${getClassCssClass(classTag)}">${escapeHtml(classTag)}</span>` : ""}
          </div>
        </div>
        <button type="button" class="spell-add-badge">+ Add</button>
      </div>
    `;
  }).join("");
}

/* ==========================================================================
   QUICK SEARCH SYSTEM (CTRL+K / CMD+K)
   ========================================================================== */

let currentQuickSearchResults = [];
let quickSearchSelectedIndex = 0;

function pulseHighlightElement(el) {
  if (!el) return;
  // If target is inside a vital pod, card or row, prefer pulsing the whole container card
  const container = el.closest(
    ".vital-pod, .ac-card, .hp-card, .resource-card, .death-card, .attr-pod, .skill-row, .attack-entry, .trait-card, .spell-card, .inv-item-row, .companion-card, .handout-card, .currency-vault-card, .attunement-card, .encumbrance-card, .passive-senses-bar, .action-economy-strip, .exhaustion-meter, .defenses-summary-card"
  ) || el;

  container.classList.remove("quick-search-pulse-highlight");
  void container.offsetWidth; // Force CSS reflow
  container.classList.add("quick-search-pulse-highlight");
  setTimeout(() => {
    container.classList.remove("quick-search-pulse-highlight");
  }, 1200);
}

function updateQuickSearchSelectionHighlight() {
  const items = document.querySelectorAll("#commandPaletteResults .cmd-palette-item");
  items.forEach((item, idx) => {
    const isSelected = idx === quickSearchSelectedIndex;
    item.classList.toggle("selected", isSelected);
    if (isSelected) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function navigateToSearchedThing(item) {
  if (!item) return;

  closeModal("commandPaletteModal");

  // Standalone actions
  if (item.action === "set-theme") {
    applyTheme(item.targetTheme);
    showStatus(`Theme set to ${item.title.replace(/^Theme:\s*/, "")}`);
    return;
  }
  if (item.action === "open-party") {
    openPartyModal();
    return;
  }
  if (item.action === "open-admin") {
    openAdminModal();
    return;
  }
  if (item.action === "open-chat") {
    toggleFloatingPartyChat(true);
    const chat = document.getElementById("floatingPartyChat") || document.getElementById("floatingPartyChatContainer");
    if (chat) pulseHighlightElement(chat);
    return;
  }
  if (item.action === "export-json") {
    exportCharacterJson();
    return;
  }
  if (item.action === "open-discord") {
    openDiscordExportModal();
    return;
  }
  if (item.action === "open-cond-rules") {
    openConditionExplainer(item.conditionId || "blinded");
    return;
  }
  if (item.action === "dice-roller") {
    if (typeof toggleDiceRoller === "function") toggleDiceRoller(true);
    const diceBar = document.getElementById("diceStationBar") || document.getElementById("floatingDiceBtn");
    if (diceBar) {
      diceBar.scrollIntoView({ behavior: "smooth", block: "center" });
      pulseHighlightElement(diceBar);
    }
    return;
  }
  if (item.action === "open-spell-compendium") {
    openSpellModal();
    const sInput = document.getElementById("spellSearchInput");
    if (sInput) {
      sInput.value = item.spellName;
      filterAndRenderSpells(item.spellName);
      setTimeout(() => {
        const firstOpt = document.querySelector("#spellSearchResults .spell-browser-card, #spellSearchResults .spell-option-item");
        if (firstOpt) {
          firstOpt.scrollIntoView({ behavior: "smooth", block: "center" });
          pulseHighlightElement(firstOpt);
        }
      }, 180);
    }
    return;
  }
  if (item.action === "open-trait-browser") {
    openTraitModal();
    const tInput = document.getElementById("traitSearchInput");
    if (tInput && item.traitName) {
      tInput.value = item.traitName;
      filterAndRenderTraits(item.traitName);
      setTimeout(() => {
        const firstOpt = document.querySelector("#traitApiList .trait-pick-row");
        if (firstOpt) {
          firstOpt.scrollIntoView({ behavior: "smooth", block: "center" });
          pulseHighlightElement(firstOpt);
        }
      }, 180);
    }
    return;
  }

  // 1. Switch main tab if specified
  if (item.tab) {
    switchMainTab(item.tab);
  }

  // 2. Switch subtab if specified
  if (item.subtab) {
    document.querySelector(`.sub-tab[data-sub="${item.subtab}"]`)?.click();
  }

  // 3. Clear category/text filters in the active view so the item is guaranteed visible
  if (item.traitIndex !== undefined) {
    const tf = document.getElementById("filterTraitsInput");
    if (tf && tf.value) tf.value = "";
    activeTraitCategoryFilter = "all";
    document.querySelectorAll("#traitCategoryFilterBar .cat-pill").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    if (myCharacterTraits[item.traitIndex]) {
      myCharacterTraits[item.traitIndex].isExpanded = true;
    }
    renderMyTraits();
  }

  if (item.spellIndex !== undefined) {
    const sf = document.getElementById("filterSpellbookInput");
    if (sf && sf.value) sf.value = "";
    activeSpellLevelFilter = "all";
    document.querySelectorAll("#spellLevelFilterBar .cat-pill").forEach((b) => b.classList.toggle("active", b.dataset.lvl === "all"));
    if (myCharacterSpells[item.spellIndex]) {
      myCharacterSpells[item.spellIndex].isExpanded = true;
    }
    renderMySpells();
  }

  if (item.handoutId) {
    activeHandoutFilter = "all";
    document.querySelectorAll(".handout-filter-chip").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    renderHandoutsGrid();
  }

  // 4. In a small timeout to let tab transition & DOM render complete:
  setTimeout(() => {
    let targetEl = null;
    if (item.selector) {
      targetEl = document.querySelector(item.selector);
    }

    if (targetEl) {
      // Scroll smoothly into view
      targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

      // Apply 1-second pulsing highlight
      pulseHighlightElement(targetEl);

      // Focus if it's an input or textarea
      const focusTarget = targetEl.matches("input, textarea, select")
        ? targetEl
        : targetEl.querySelector("input:not([type=hidden]), textarea");
      if (focusTarget) {
        try { focusTarget.focus({ preventScroll: true }); } catch (err) {}
      }

      // Execute associated action if requested
      if (item.action === "roll-skill") {
        targetEl.querySelector(".roll-btn")?.click();
      } else if (item.action === "roll-save") {
        targetEl.querySelector(`.roll-btn[data-type="save"]`)?.click();
      } else if (item.action === "roll-init") {
        document.getElementById("rollInitiativeOrb")?.click();
      } else if (item.action === "roll-death") {
        document.getElementById("rollDeathSaveBtn")?.click();
      } else if (item.action === "short-rest") {
        applyShortRest();
      } else if (item.action === "long-rest") {
        applyLongRest();
      } else if (item.action === "open-hp") {
        document.getElementById("openHpModalBtn")?.click();
      } else if (item.action === "reset-turn") {
        document.getElementById("resetTurnEconomyBtn")?.click();
      } else if (item.action === "focus-spell") {
        const concEl = document.getElementById("spellConcentration");
        if (concEl && item.spellName) {
          concEl.value = item.spellName;
          updateConcentrationBanner();
          renderMySpells();
          saveSheet(false);
          showStatus(`Concentrating on ${item.spellName}`);
        }
      }
    }
  }, 120);
}

function openCommandPalette() {
  const modal = document.getElementById("commandPaletteModal");
  const input = document.getElementById("commandPaletteInput");
  if (!modal || !input) return;
  input.value = "";
  renderCommandPaletteResults("");
  modal.classList.add("open");
  setTimeout(() => input.focus(), 50);
}

function buildQuickSearchIndex(query = "") {
  const q = query.toLowerCase().trim();
  const items = [];

  // 1. MAIN NAVIGATION TABS
  if (isAdminSession()) {
    items.push({
      title: "Master Admin Control Panel",
      sub: "Restricted campaign rooms inspector, global broadcast & system health",
      tag: "Admin",
      action: "open-admin",
      keywords: "admin master panel rooms broadcast owner system"
    });
  }
  items.push(
    { title: "Combat & Core Tab", sub: "Vitals, Ability Scores, Skills & Weapon Attacks", tag: "Navigation", tab: "tab-stats", selector: "#tab-stats", keywords: "combat core vitals hp ac stats sheet" },
    { title: "Features & Traits Tab", sub: "Class Features, Feats & Racial Traits", tag: "Navigation", tab: "tab-traits", selector: "#tab-traits", keywords: "features traits abilities feats class" },
    { title: "Spells & Grimoire Tab", sub: "Prepared Spells, Cantrips, Spell Slots & DC", tag: "Navigation", tab: "tab-spells", selector: "#tab-spells", keywords: "spells grimoire cantrips slots magic casting" },
    { title: "Inventory & Vault Tab", sub: "Currency, Attunement, Items & Encumbrance", tag: "Navigation", tab: "tab-inventory", selector: "#tab-inventory", keywords: "inventory vault coins gold bag gear equipment weight" },
    { title: "Companions & Creatures Tab", sub: "Familiars, Mounts, Summons & Pets", tag: "Navigation", tab: "tab-companions", selector: "#tab-companions", keywords: "companions creatures familiars pets mounts summons" },
    { title: "Notes & Quests Tab", sub: "Campaign Log, Quests, NPCs & Handouts", tag: "Navigation", tab: "tab-journal", selector: "#tab-journal", keywords: "notes quests journal campaign handouts npcs" },
    { title: "Campaign Log (Session Chronicle)", sub: "Session notes and campaign narrative", tag: "Journal", tab: "tab-journal", subtab: "sub-notes", selector: "#campaignNotes", keywords: "campaign log session notes chronicle journal story recap" },
    { title: "Active & Completed Quests", sub: "Quest tracker, goals and rewards", tag: "Quests", tab: "tab-journal", subtab: "sub-quests", selector: "#activeQuestsNotes", keywords: "quests active completed tracker missions goals bounties" },
    { title: "Personality, Ideals, Bonds & Flaws", sub: "Roleplay traits and character backstory", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#traits", keywords: "personality ideals bonds flaws backstory roleplay character" },
    { title: "NPCs & Factions Directory", sub: "Dramatis personae and faction relations", tag: "NPCs", tab: "tab-journal", subtab: "sub-npcs", selector: "#npcList", keywords: "npcs factions people characters allies enemies dramatis personae" },
    { title: "Party Handouts, Letters & Clues", sub: "Letters, maps, contracts, coin and item handouts", tag: "Handouts", tab: "tab-journal", subtab: "sub-handouts", selector: "#handoutsGrid", keywords: "handouts letters clues maps coins items contracts" }
  );

  // 2. CHARACTER HEADER IDENTITY
  const cName = document.getElementById("charName")?.value || "";
  const cClass = document.getElementById("charClass")?.value || "";
  const cSub = document.getElementById("charSubclass")?.value || "";
  const cRace = document.getElementById("charRace")?.value || "";
  const cBg = document.getElementById("charBackground")?.value || "";
  const cAlign = document.getElementById("charAlignment")?.value || "";
  const cXp = document.getElementById("charExp")?.value || "";

  items.push(
    { title: `Character Name: ${cName || "Unnamed Hero"}`, sub: "Header character name", tag: "Identity", selector: "#charName", keywords: `character name hero ${cName}` },
    { title: `Class: ${cClass || "Class"}`, sub: cSub ? `Subclass: ${cSub}` : "Class progression", tag: "Identity", selector: "#charClass", keywords: `class fighter wizard rogue cleric paladin bard monk ranger sorcerer druid warlock barbarian ${cClass} ${cSub}` },
    { title: `Race / Ancestry: ${cRace || "Ancestry"}`, sub: "Character species or lineage", tag: "Identity", selector: "#charRace", keywords: `race ancestry species human elf dwarf dragonborn tiefling halfling gnome ${cRace}` },
    { title: `Background: ${cBg || "Background"}`, sub: "Character origin & background proficiencies", tag: "Identity", selector: "#charBackground", keywords: `background folk hero soldier noble criminal acolyte sage ${cBg}` },
    { title: `Alignment: ${cAlign || "Neutral"}`, sub: "Ethical and moral compass", tag: "Identity", selector: "#charAlignment", keywords: `alignment lawful good neutral chaotic evil ${cAlign}` },
    { title: `Experience Points: ${cXp || 0} XP`, sub: "Character XP progression", tag: "Identity", selector: "#charExp", keywords: `xp exp experience points level ${cXp}` },
    { title: "Character Portrait / Avatar", sub: "Custom token image or character art URL", tag: "Identity", selector: "#avatarFrame", keywords: "avatar portrait image art token picture photo" }
  );

  // 3. CORE COMBAT VITALS
  const curHpVal = document.getElementById("curHp")?.value || "0";
  const maxHpVal = document.getElementById("maxHp")?.value || "0";
  const tempHpVal = document.getElementById("tempHp")?.value || "0";
  const acVal = document.getElementById("ac")?.value || "10";
  const initVal = document.getElementById("initiativeDisplay")?.textContent || document.getElementById("initiative")?.value || "+0";
  const spdVal = document.getElementById("charSpeed")?.value ? `${document.getElementById("charSpeed").value} ft.` : "30 ft.";
  const profVal = document.getElementById("profBonusDisplay")?.textContent || "+2";
  const lvlVal = document.getElementById("charLevel")?.value || "1";
  const hdCurVal = document.getElementById("hitDiceCur")?.value || "1";
  const hdMaxVal = document.getElementById("hitDiceMax")?.value || "1";
  const classResLabel = document.getElementById("classResourceName")?.value || document.getElementById("classPtsLabel")?.value || "Class Resource";
  const classResCur = document.getElementById("classPtsCur")?.value || "0";
  const classResMax = document.getElementById("classPtsMax")?.value || "0";
  const defVal = document.getElementById("charResistances")?.value || document.getElementById("resistancesSummary")?.value || "";

  items.push(
    { title: `Armor Class (AC: ${acVal})`, sub: "Base AC, shield & armor protection", tag: "Vitality", tab: "tab-stats", selector: "#ac", keywords: `ac armor class shield defense protection ${acVal}` },
    { title: `Hit Points (HP: ${curHpVal} / ${maxHpVal})`, sub: "Current and maximum vitality", tag: "Vitality", tab: "tab-stats", selector: "#curHp", keywords: `hp hit points health wound damage heal curhp maxhp vitality ${curHpVal}` },
    { title: `Temporary Hit Points (${tempHpVal} Temp HP)`, sub: "Damage buffer before taking real HP loss", tag: "Vitality", tab: "tab-stats", selector: "#tempHp", keywords: `temp hp temporary hit points shield buffer ${tempHpVal}` },
    { title: `Roll Initiative (${initVal})`, sub: "Combat turn order roll", tag: "Combat", tab: "tab-stats", selector: "#rollInitiativeOrb", action: "roll-init", keywords: `initiative init roll turn order speed reaction d20 ${initVal}` },
    { title: `Speed: ${spdVal}`, sub: "Base walking speed per round", tag: "Vitality", tab: "tab-stats", selector: "#charSpeed", keywords: `speed movement move fly swim climb feet ft ${spdVal}` },
    { title: `Proficiency Bonus (${profVal})`, sub: "Added to proficient skills, attacks & saves", tag: "Vitality", tab: "tab-stats", selector: "#profBonusDisplay", keywords: `proficiency bonus prof pb ${profVal}` },
    { title: `Character Level: ${lvlVal}`, sub: "Overall character level and tier", tag: "Vitality", tab: "tab-stats", selector: "#charLevel", keywords: `level progression tier lvl ${lvlVal}` },
    { title: `Hit Dice (${hdCurVal} / ${hdMaxVal})`, sub: "Short rest healing dice pool", tag: "Recovery", tab: "tab-stats", selector: "#hitDiceCur", keywords: `hit dice hd rest recovery healing ${hdCurVal}` },
    { title: "Roll Death Saving Throw", sub: "Life or death saving throw (3 saves / 3 fails)", tag: "Combat", tab: "tab-stats", selector: "#rollDeathSaveBtn", action: "roll-death", keywords: "death saves saving throws dying unconscious stabilize d20" },
    { title: `${classResLabel} (${classResCur} / ${classResMax})`, sub: "Ki, Sorcery Points, Superiority Dice, Rages", tag: "Resource", tab: "tab-stats", selector: "#classPtsCur", keywords: `class resource pool ki sorcery points rages superiority bardic ${classResLabel}` },
    { title: "Turn Action Economy", sub: "Action, Bonus Action, Reaction status indicators", tag: "Combat", tab: "tab-stats", selector: ".action-economy-strip", keywords: "action bonus action reaction turn economy economy strip" },
    { title: "Exhaustion Track", sub: "Track exhaustion levels 1 through 6", tag: "Vitality", tab: "tab-stats", selector: ".exhaustion-meter", keywords: "exhaustion levels tired fatigue debuff penalties" },
    { title: "Passive Senses (Perception, Investigation, Insight)", sub: "Passive awareness scores", tag: "Core", tab: "tab-stats", selector: ".passive-senses-bar", keywords: "passive senses perception investigation insight awareness" },
    { title: "Defenses & Resistances", sub: defVal || "Resistances, immunities, vulnerabilities", tag: "Vitality", tab: "tab-stats", selector: "#charResistances", keywords: `defenses resistances immunities vulnerabilities damage types ${defVal}` },
    { title: "Conditions & Status Effects", sub: "Track Blinded, Charmed, Poisoned, Prone, Stunned", tag: "Vitality", tab: "tab-stats", selector: "#conditionChips", keywords: "conditions status effects blinded charmed deafened poisoned prone stunned" }
  );

  // 4. ABILITY SCORES & SAVING THROWS
  const attrNames = {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma"
  };

  ["str", "dex", "con", "int", "wis", "cha"].forEach((attr) => {
    const scoreVal = document.getElementById(attr)?.value || "10";
    const modVal = document.getElementById(`mod_${attr}`)?.textContent || "+0";
    const saveVal = document.getElementById(`save_val_${attr}`)?.textContent || "+0";
    const fullName = attrNames[attr] || attr.toUpperCase();

    // Ability Score Pod
    items.push({
      title: `${fullName} Score (${scoreVal} / ${modVal})`,
      sub: `${fullName} ability score & modifier`,
      tag: "Ability",
      tab: "tab-stats",
      selector: `.attr-${attr}`,
      keywords: `${attr} ${fullName} ability score modifier ${scoreVal} ${modVal}`
    });

    // Saving Throw
    items.push({
      title: `Roll ${fullName} Saving Throw (${saveVal})`,
      sub: `Saving throw with ${saveVal} modifier`,
      tag: "Saving Throw",
      tab: "tab-stats",
      selector: `.attr-${attr}`,
      action: "roll-save",
      attr: attr,
      keywords: `save saving throw ${attr} ${fullName} roll d20 ${saveVal}`
    });
  });

  // 5. 18 SKILLS
  document.querySelectorAll(".skill-row").forEach((row) => {
    const label = row.querySelector(".skill-label")?.textContent?.trim() || "Skill";
    const val = row.querySelector(".skill-val")?.textContent?.trim() || "+0";
    const attrTag = row.querySelector(".skill-attr")?.textContent?.trim() || "";
    items.push({
      title: `Roll ${label} Check (${val})`,
      sub: `${attrTag ? attrTag + " skill check • " : ""}Click to jump and roll`,
      tag: "Skill Check",
      tab: "tab-stats",
      selector: `#${row.id}`,
      action: "roll-skill",
      rowId: row.id,
      keywords: `${label} skill check ${attrTag} roll d20 proficiency ${val}`
    });
  });

  // 6. WEAPONS & ATTACK ARSENAL
  myCharacterWeapons.forEach((wpn, idx) => {
    if (wpn && (wpn.name || wpn.atk || wpn.dmg)) {
      const wName = wpn.name || `Weapon #${idx + 1}`;
      const atkText = wpn.atk ? `Atk: ${wpn.atk}` : "";
      const dmgText = wpn.dmg ? `Dmg: ${wpn.dmg}` : "";
      const subParts = [atkText, dmgText, wpn.notes].filter(Boolean).join(" | ");
      items.push({
        title: `Weapon: ${wName}`,
        sub: subParts || "Weapon attack entry",
        tag: "Weapon",
        tab: "tab-stats",
        selector: `.attack-entry[data-index="${idx}"]`,
        wpnIndex: idx,
        keywords: `weapon attack ${wName} ${wpn.dmg || ""} ${wpn.atk || ""} ${wpn.notes || ""}`
      });
    }
  });

  items.push({
    title: "Add New Weapon / Attack",
    sub: "Create a new weapon card in your combat arsenal",
    tag: "Weapon",
    tab: "tab-stats",
    selector: "#addWeaponBtn",
    keywords: "add weapon attack arsenal create dagger sword bow"
  });

  // 7. CUSTOM TRACKERS
  myCustomResources.forEach((res, idx) => {
    if (res && res.name) {
      items.push({
        title: `Tracker: ${res.name} (${res.cur ?? 0} / ${res.max ?? 0})`,
        sub: "Custom counter tracker",
        tag: "Tracker",
        tab: "tab-stats",
        selector: `.custom-res-card[data-index="${idx}"]`,
        resIndex: idx,
        keywords: `tracker counter resource charges pool ${res.name}`
      });
    }
  });

  items.push({
    title: "Add Custom Resource Counter",
    sub: "Create a new counter for arrows, inspiration, or charges",
    tag: "Tracker",
    tab: "tab-stats",
    selector: "#addCustomResourceBtn",
    keywords: "add custom resource counter charges pool arrows luck"
  });

  // 8. FEATURES & TRAITS
  myCharacterTraits.forEach((tr, idx) => {
    if (tr && (tr.name || tr.desc)) {
      const tName = tr.name || `Ability #${idx + 1}`;
      const tType = tr.type || "Feature";
      items.push({
        title: `Feature: ${tName}`,
        sub: `${tType}${tr.desc ? ` • ${tr.desc.slice(0, 60)}...` : ""}`,
        tag: "Trait / Feature",
        tab: "tab-traits",
        selector: `.trait-card[data-index="${idx}"]`,
        traitIndex: idx,
        keywords: `trait feature ability feat passive ${tName} ${tType} ${tr.desc || ""}`
      });
    }
  });

  items.push({
    title: "Add Feature / Trait (+ Compendium Browser)",
    sub: "Browse class features, feats and racial abilities",
    tag: "Trait / Feature",
    tab: "tab-traits",
    selector: "#addTraitBtn",
    keywords: "add feature trait ability feat compendium browser"
  });

  // 9. SPELLS & GRIMOIRE
  myCharacterSpells.forEach((sp, idx) => {
    if (sp && sp.name) {
      const typeTag = sp.type || sp.levelTag || "Spell";
      const metaParts = [typeTag, sp.casting_time, sp.range, sp.duration].filter(Boolean).join(" • ");
      items.push({
        title: `Spell: ${sp.name}`,
        sub: metaParts || "Grimoire Spell",
        tag: "Spell",
        tab: "tab-spells",
        selector: `.spell-card[data-index="${idx}"]`,
        spellIndex: idx,
        spellName: sp.name,
        keywords: `spell grimoire magic ${sp.name} ${typeTag} ${sp.casting_time || ""} ${sp.range || ""} cast concentrate`
      });
    }
  });

  const spAbility = document.getElementById("spellAbility")?.value || "INT";
  const spDc = document.getElementById("spellDc")?.value || "13";
  const spAtk = document.getElementById("spellAtkBonus")?.value || "+5";
  const spConc = document.getElementById("spellConcentration")?.value || "None";

  items.push(
    { title: `Spell Save DC: ${spDc}`, sub: "Difficulty class for enemies resisting your spells", tag: "Magic", tab: "tab-spells", selector: "#spellDc", keywords: `spell save dc difficulty class magic dc ${spDc}` },
    { title: `Spell Attack Bonus (${spAtk})`, sub: "Bonus added to ranged/melee spell attack rolls", tag: "Magic", tab: "tab-spells", selector: "#spellAtkBonus", keywords: `spell attack bonus atk magic roll ${spAtk}` },
    { title: `Spellcasting Ability: ${spAbility}`, sub: "Primary spellcasting attribute", tag: "Magic", tab: "tab-spells", selector: "#spellAbility", keywords: `spellcasting ability int wis cha magic ${spAbility}` },
    { title: "Spell Slots Grid (Levels 1–9 & Pact Magic)", sub: "Track spell slots and pact magic", tag: "Magic", tab: "tab-spells", selector: "#slotsGridContainer", keywords: "spell slots grid level 1 2 3 4 5 6 7 8 9 pact magic slots" },
    { title: `Active Concentration: ${spConc}`, sub: "Currently maintained concentration spell", tag: "Magic", tab: "tab-spells", selector: "#spellConcentration", keywords: `active concentration spell focus maintaining ${spConc}` },
    { title: "Add Spell (+ Compendium Browser)", sub: "Search 5e spell compendium and add to grimoire", tag: "Magic", tab: "tab-spells", selector: "#addSpellBtn", keywords: "add spell browse compendium grimoire learn spell" }
  );

  // 10. INVENTORY & VAULT
  const cpVal = document.getElementById("coin_cp")?.value || "0";
  const spVal = document.getElementById("coin_sp")?.value || "0";
  const epVal = document.getElementById("coin_ep")?.value || "0";
  const gpVal = document.getElementById("coin_gp")?.value || "0";
  const ppVal = document.getElementById("coin_pp")?.value || "0";

  items.push(
    { title: `Treasury / Currency Vault (${gpVal} GP)`, sub: `Coins: ${cpVal} CP, ${spVal} SP, ${epVal} EP, ${gpVal} GP, ${ppVal} PP`, tag: "Treasury", tab: "tab-inventory", selector: ".currency-vault-card", keywords: `treasury currency coins gold gp silver sp copper cp electrum ep platinum pp money wealth ${gpVal}` },
    { title: "Magic Item Attunement Slots (3 Max)", sub: "Track attuned magic items", tag: "Inventory", tab: "tab-inventory", selector: ".attunement-card", keywords: "attunement slots magic items attuned" },
    { title: "Encumbrance & Carrying Capacity", sub: "Weight calculation vs carrying capacity", tag: "Inventory", tab: "tab-inventory", selector: ".encumbrance-card", keywords: "encumbrance weight capacity lbs heavy carry" },
    { title: "Additional Equipment & Gear", sub: "Free-form equipment notes and backpack gear", tag: "Inventory", tab: "tab-inventory", selector: "#inventory", keywords: "additional equipment gear inventory backpack items notes" },
    { title: "Other Proficiencies & Spoken Languages", sub: "Armor, weapons, tools and spoken languages", tag: "Proficiencies", tab: "tab-inventory", selector: "#otherProfs", keywords: "proficiencies languages armor weapons tools spoken otherprofs" }
  );

  myStructuredInventory.forEach((item, idx) => {
    if (item && item.name) {
      const qtyStr = item.qty !== undefined ? `Qty: ${item.qty}` : "";
      const wtStr = item.weight !== undefined ? `Weight: ${item.weight} lbs` : "";
      const eqStr = item.equipped ? "Equipped" : "";
      const subParts = [qtyStr, wtStr, eqStr].filter(Boolean).join(" • ");
      items.push({
        title: `Item: ${item.name}`,
        sub: subParts || "Inventory item",
        tag: "Inventory",
        tab: "tab-inventory",
        selector: `.inv-item-row[data-index="${idx}"]`,
        invIndex: idx,
        keywords: `item inventory equipment gear ${item.name} weight lbs`
      });
    }
  });

  items.push({
    title: "Add Tracked Inventory Item",
    sub: "Add item with weight and quantity to calculate encumbrance",
    tag: "Inventory",
    tab: "tab-inventory",
    selector: "#addInventoryItemBtn",
    keywords: "add item tracked inventory gear weight"
  });

  // 11. COMPANIONS & CREATURES
  myCompanions.forEach((comp, idx) => {
    if (comp && comp.name) {
      const cType = comp.type || "Creature";
      const stats = `AC ${comp.ac ?? 12} • HP ${comp.hp || "10/10"} • Speed ${comp.speed || "30 ft."}`;
      items.push({
        title: `Companion: ${comp.name}`,
        sub: `${cType} • ${stats}`,
        tag: "Companion",
        tab: "tab-companions",
        selector: `.companion-card[data-index="${idx}"]`,
        companionIndex: idx,
        keywords: `companion creature pet mount familiar summon ${comp.name} ${cType} ${comp.notes || ""}`
      });
    }
  });

  items.push({
    title: "Add Companion / Creature (+ Statblock)",
    sub: "Create a statblock for a pet, familiar, mount or summon",
    tag: "Companion",
    tab: "tab-companions",
    selector: "#addCompanionBtn",
    keywords: "add companion creature pet mount familiar summon statblock"
  });

  // 12. NOTES, QUESTS, PERSONALITY & HANDOUTS
  const trRole = document.getElementById("traits")?.value || "";
  const idRole = document.getElementById("ideals")?.value || "";
  const bnRole = document.getElementById("bonds")?.value || "";
  const flRole = document.getElementById("flaws")?.value || "";
  const bkRole = document.getElementById("backstory")?.value || "";

  items.push(
    { title: "Personality Traits", sub: trRole ? trRole.slice(0, 60) + "..." : "Roleplay mannerisms & quirks", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#traits", keywords: `personality traits mannerisms roleplay habits ${trRole}` },
    { title: "Character Ideals", sub: idRole ? idRole.slice(0, 60) + "..." : "Beliefs, morality and principles", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#ideals", keywords: `ideals beliefs morality principles values ${idRole}` },
    { title: "Character Bonds", sub: bnRole ? bnRole.slice(0, 60) + "..." : "Ties to people, places and events", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#bonds", keywords: `bonds connections family loyalty oath tie ${bnRole}` },
    { title: "Character Flaws", sub: flRole ? flRole.slice(0, 60) + "..." : "Weaknesses, vices and fears", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#flaws", keywords: `flaws weaknesses vices fears secrets ${flRole}` },
    { title: "Character Backstory", sub: bkRole ? bkRole.slice(0, 60) + "..." : "Origin story and past history", tag: "Roleplay", tab: "tab-journal", subtab: "sub-personality", selector: "#backstory", keywords: `backstory history origin lore childhood past ${bkRole}` },
    { title: "NPCs & Factions Journal", sub: "Notable contacts, rivals and factions in your chronicle", tag: "NPCs", tab: "tab-journal", subtab: "sub-npcs", selector: "#npcList", keywords: "npc faction character person entry contact rivals allies factions journal" },
    { title: "Create Handout (Item, Coins, Letter, Map, Clue)", sub: "Award loot, maps, letters, or clues to the party", tag: "Handout", tab: "tab-journal", subtab: "sub-handouts", selector: "#createHandoutBtn", keywords: "create handout award loot item coins letter map clue" }
  );

  const activeHandoutsRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (activeHandoutsRoom) {
    partyRoomHandouts.forEach((h) => {
      if (h && (h.title || h.content) && canISeeHandout(h)) {
        const hTitle = h.title || "Untitled Handout";
        const hType = (h.type || "letter").toUpperCase();
        let extra = "";
        if (h.type === "item" && h.item) {
          extra = `Item: ${h.item.name}`;
        } else if (h.type === "coin" && h.coins) {
          extra = `Coins: ${h.coins.gp || 0} GP`;
        } else if (h.content) {
          extra = h.content.slice(0, 50) + "...";
        }
        items.push({
          title: `Handout: ${hTitle}`,
          sub: `${hType} • ${h.author ? `By ${h.author} • ` : ""}${extra}`,
          tag: "Handout",
          tab: "tab-journal",
          subtab: "sub-handouts",
          selector: `.handout-card[data-id="${h.id}"]`,
          handoutId: h.id,
          keywords: `handout loot letter clue map coins item ${hTitle} ${h.type || ""} ${h.content || ""}`
        });
      }
    });
  }

  // 13. UTILITIES, ACTIONS & REST
  items.push(
    { title: "Dice Roller Dock", sub: "Interactive 3D/dock dice roller (d4, d6, d8, d10, d12, d20, d100)", tag: "Dice", action: "dice-roller", keywords: "dice roller dice roll d20 d6 d8 d12 formula roll" },
    { title: "Take a Short Rest", sub: "Spend Hit Dice to recover hit points", tag: "Recovery", action: "short-rest", keywords: "short rest hit dice recovery heal" },
    { title: "Take a Long Rest", sub: "Full heal, reset spell slots, recover half hit dice", tag: "Recovery", action: "long-rest", keywords: "long rest full recovery spell slots reset hit dice" },
    { title: "HP Calculator (Damage / Healing)", sub: "Apply damage, healing, or temp HP calculation", tag: "Vitality", action: "open-hp", keywords: "hp calculator damage healing heal hurt wounds math" },
    { title: "Party Hub & DM Room", sub: "Connect with party members, sync HP, shared handouts", tag: "Party", action: "open-party", keywords: "party dm room multiplayer join campaign connect sync" },
    { title: "Party Chat Window", sub: "Open floating group chat for party communication", tag: "Chat", action: "open-chat", keywords: "party chat message messages floating group chat communication" },
    { title: "Export Character Sheet as JSON", sub: "Download backup JSON file of your character", tag: "Export", action: "export-json", keywords: "export json backup download save file" },
    { title: "Export Statblock (Discord, Avrae, Text)", sub: "Format statblock for Discord markdown, Avrae, or print", tag: "Export", action: "open-discord", keywords: "export statblock discord avrae text card format" },
    { title: "5e Conditions Explainer", sub: "Rules reference for all standard 5e condition effects", tag: "Rules", action: "open-cond-rules", keywords: "conditions rules reference blinded charmed deafened poisoned prone stunned" },
    { title: "Reset Turn Economy (New Turn)", sub: "Refresh Action, Bonus Action, Reaction for next round", tag: "Combat", action: "reset-turn", keywords: "reset turn economy round action bonus reaction new turn" }
  );

  // 14. VISUAL THEMES
  items.push(
    { title: "Theme: Ancient Parchment (Fantasy Grimoire)", sub: "Ornate fantasy parchment with rich aged tones", tag: "Theme", action: "set-theme", targetTheme: "theme-parchment", keywords: "theme parchment ancient fantasy grimoire style visual" },
    { title: "Theme: Linear Indigo (Studio)", sub: "Modern dark studio theme with indigo glow", tag: "Theme", action: "set-theme", targetTheme: "theme-nexus", keywords: "theme linear indigo studio nexus dark" },
    { title: "Theme: Linear Cyber Sapphire", sub: "Deep navy and sapphire blue neon glow", tag: "Theme", action: "set-theme", targetTheme: "theme-midnight", keywords: "theme cyber sapphire blue midnight neon" },
    { title: "Theme: Linear Mint Matrix", sub: "Cyberpunk emerald and matrix mint green", tag: "Theme", action: "set-theme", targetTheme: "theme-emerald", keywords: "theme mint matrix emerald green" },
    { title: "Theme: Linear Crimson Syndicate", sub: "Vampiric blood crimson and dark slate", tag: "Theme", action: "set-theme", targetTheme: "theme-crimson", keywords: "theme crimson syndicate red blood vampiric" },
    { title: "Theme: Linear Solar Forge", sub: "Molten gold and amber forge glow", tag: "Theme", action: "set-theme", targetTheme: "theme-amber", keywords: "theme solar forge amber gold molten" },
    { title: "Theme: Linear Nebula Ultraviolet", sub: "Deep purple and cosmic ultraviolet glow", tag: "Theme", action: "set-theme", targetTheme: "theme-violet", keywords: "theme nebula ultraviolet purple violet cosmic" },
    { title: "Theme: Linear Monolith (OLED Minimal)", sub: "True black OLED high-contrast dark theme", tag: "Theme", action: "set-theme", targetTheme: "theme-monolith", keywords: "theme monolith oled minimal true black" },
    { title: "Theme: Linear Sunset (Neon Dusk)", sub: "Synthwave sunset pink, magenta and neon orange", tag: "Theme", action: "set-theme", targetTheme: "theme-cyberpunk", keywords: "theme sunset neon dusk synthwave magenta pink cyberpunk" }
  );

  // 15. COMPENDIUM SPELLS (Matches for spells not already on character sheet)
  if (q.length >= 2 && Array.isArray(allSpellsCache) && allSpellsCache.length > 0) {
    const existingSpellNames = new Set(myCharacterSpells.map((s) => (s?.name || "").toLowerCase()));
    allSpellsCache.forEach((sp) => {
      if (sp && sp.name && !existingSpellNames.has(sp.name.toLowerCase())) {
        const sLower = sp.name.toLowerCase();
        if (sLower.includes(q) || (sp.type && sp.type.toLowerCase().includes(q))) {
          items.push({
            title: `Compendium Spell: ${sp.name}`,
            sub: `${sp.type || sp.levelTag || "5e Spell"} • Compendium (Click to browse & add)`,
            tag: "Compendium",
            action: "open-spell-compendium",
            spellName: sp.name,
            keywords: `compendium spell ${sp.name} ${sp.type || ""}`
          });
        }
      }
    });
  }

  // 16. COMPENDIUM FEATURES & TRAITS
  if (q.length >= 2 && Array.isArray(allTraitsCache) && allTraitsCache.length > 0) {
    const existingTraitNames = new Set(myCharacterTraits.map((t) => (t?.name || "").toLowerCase()));
    allTraitsCache.forEach((tr) => {
      if (tr && tr.name && !existingTraitNames.has(tr.name.toLowerCase())) {
        const tLower = tr.name.toLowerCase();
        if (tLower.includes(q)) {
          items.push({
            title: `Compendium Feature: ${tr.name}`,
            sub: `${tr.type || "5e Feature"} • Compendium (Click to browse & add)`,
            tag: "Compendium",
            action: "open-trait-browser",
            traitName: tr.name,
            keywords: `compendium feature trait ${tr.name} ${tr.type || ""}`
          });
        }
      }
    });
  }

  return items;
}

function renderCommandPaletteResults(query = "") {
  const container = document.getElementById("commandPaletteResults");
  if (!container) return;
  const q = query.toLowerCase().trim();

  const allItems = buildQuickSearchIndex(q);

  let filtered = [];

  if (!q) {
    // Curated starter list when search input is empty
    filtered = allItems.filter((item) => {
      return (
        item.tag === "Navigation" ||
        item.tag === "Dice" ||
        item.action === "roll-init" ||
        item.action === "roll-death" ||
        item.action === "short-rest" ||
        item.action === "long-rest" ||
        item.action === "open-party" ||
        item.action === "open-chat" ||
        item.action === "export-json" ||
        item.action === "open-discord"
      );
    });
  } else {
    const tokens = q.split(/\s+/).filter(Boolean);

    const scored = [];
    allItems.forEach((item) => {
      const titleLower = item.title.toLowerCase();
      const subLower = (item.sub || "").toLowerCase();
      const tagLower = (item.tag || "").toLowerCase();
      const kwLower = (item.keywords || "").toLowerCase();
      const combined = `${titleLower} ${subLower} ${tagLower} ${kwLower}`;

      const matchesAll = tokens.every((tok) => combined.includes(tok));
      if (!matchesAll) return;

      let score = 0;
      if (titleLower === q) score += 1000;
      else if (titleLower.startsWith(q)) score += 500;
      else if (titleLower.includes(q)) score += 200;

      tokens.forEach((tok) => {
        if (titleLower.includes(tok)) score += 80;
        if (subLower.includes(tok)) score += 30;
        if (tagLower.includes(tok)) score += 20;
        if (kwLower.includes(tok)) score += 15;
      });

      scored.push({ item, score });
    });

    scored.sort((a, b) => b.score - a.score);
    filtered = scored.map((s) => s.item);
  }

  currentQuickSearchResults = filtered.slice(0, 30);
  quickSearchSelectedIndex = 0;

  if (currentQuickSearchResults.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching stats, spells, items, features, or notes found for "${escapeHtml(query)}".</p>`;
    return;
  }

  container.innerHTML = currentQuickSearchResults.map((item, idx) => `
    <div class="spell-option-item cmd-palette-item ${idx === 0 ? "selected" : ""}" data-idx="${idx}">
      <div class="spell-option-details">
        <span class="spell-option-title">${escapeHtml(item.title)}</span>
        ${item.sub ? `<span class="cmd-palette-sub">${escapeHtml(item.sub)}</span>` : ""}
      </div>
      <span class="tag-pill">${escapeHtml(item.tag)}</span>
    </div>
  `).join("");
}

/* ==========================================================================
   PARTY & DM DASHBOARD (WITH ROOM CREATOR LOCK & PLAYER PRIVACY)
   ========================================================================== */

function getCreatedRooms() {
  try {
    return JSON.parse(localStorage.getItem(CREATED_ROOMS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function addCreatedRoom(code) {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  const list = getCreatedRooms().filter((r) => r !== clean);
  list.unshift(clean);
  localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(list));
}

function removeCreatedRoom(code) {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  const list = getCreatedRooms().filter((r) => r !== clean);
  localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(list));
}

function isLocalRoomCreator(code) {
  if (!code) return false;
  return getCreatedRooms().includes(code.trim().toUpperCase());
}

function getRecentRooms() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function addRecentRoom(code) {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  let list = getRecentRooms().filter((r) => r !== clean);
  list.unshift(clean);
  if (list.length > 6) list = list.slice(0, 6);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list));
  renderRecentRoomsBar();
}

function removeRecentRoom(code) {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  const list = getRecentRooms().filter((r) => r !== clean);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list));
  renderRecentRoomsBar();
}

function renderRecentRoomsBar() {
  const bar = document.getElementById("recentRoomsBar");
  const listEl = document.getElementById("recentRoomsList");
  if (!bar || !listEl) return;

  const rooms = getRecentRooms();
  if (rooms.length === 0) {
    bar.style.display = "none";
    return;
  }

  const current = (activeDMRoomCode || connectedCampaignRoom || "").trim().toUpperCase();
  bar.style.display = "flex";
  listEl.innerHTML = rooms.map((code) => {
    const isCurrent = (current && current === code);
    return `
      <button type="button" class="recent-room-chip ${isCurrent ? 'is-current' : ''}" data-room="${escapeHtml(code)}" title="Click to connect to ${escapeHtml(code)}">
        ${isCurrent ? '<span class="recent-chip-dot"></span>' : ''}${escapeHtml(code)}
      </button>
    `;
  }).join("");
}

function copyRoomInviteLink(roomCode) {
  const clean = (roomCode || connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!clean || clean === "NONE") return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", clean);
  navigator.clipboard.writeText(url.toString()).then(() => {
    showStatus(`Invite Link Copied for ${clean}!`);
  });
}

function renderLivePartyDock(members) {
  const dock = document.getElementById("livePartyDock");
  const dockCode = document.getElementById("dockRoomCodeText");
  const roleBadge = document.getElementById("dockRoleBadge");
  const dockBody = document.getElementById("livePartyDockBody");
  const lastRollEl = document.getElementById("livePartyLastRollText");

  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  if (!dock) return;

  if (!activeRoom) {
    dock.style.display = "none";
    return;
  }

  const isCreatorDM = Boolean(activeDMRoomCode && activeDMRoomCode === activeRoom);

  dock.style.display = "flex";
  if (dockCode) dockCode.textContent = activeRoom;
  if (roleBadge) {
    roleBadge.textContent = isCreatorDM ? "DM / Creator" : "Player";
    roleBadge.classList.toggle("is-dm", isCreatorDM);
  }
  const dmHandoutBtn = document.getElementById("dockDmHandoutBtn");
  if (dmHandoutBtn) {
    dmHandoutBtn.style.display = isCreatorDM ? "inline-flex" : "none";
  }
  if (dockBody) dockBody.style.display = isPartyDockCollapsed ? "none" : "flex";

  // Filter out any DM entries so the Dungeon Master is NEVER rendered as a player member
  const playerMembers = (Array.isArray(members) ? members : []).filter((m) => {
    if (!m) return false;
    const mid = String(m.id || "");
    const mname = String(m.name || "");
    const mclass = String(m.charClass || "");
    if (mid === "dm_presence" || mid.startsWith("dm_")) return false;
    if (mname === "Dungeon Master" || mclass === "DM" || m.isDM) return false;
    return true;
  });

  if (playerMembers.length === 0) {
    if (dockBody) {
      dockBody.innerHTML = `<span style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Waiting for party members to join ${escapeHtml(activeRoom)}...</span>`;
    }
    if (lastRollEl) {
      lastRollEl.textContent = "No party rolls yet";
    }
    return;
  }

  let latestRoll = null;
  playerMembers.forEach((m) => {
    if (m.lastRoll && m.lastRoll.timestamp) {
      if (!latestRoll || m.lastRoll.timestamp > latestRoll.timestamp) {
        latestRoll = { ...m.lastRoll, charName: m.name || m.lastRoll.charName || "Adventurer" };
      }
    }
  });

  if (lastRollEl) {
    if (latestRoll) {
      lastRollEl.textContent = `${latestRoll.charName}: ${latestRoll.desc} = ${latestRoll.total}`;
    } else {
      lastRollEl.textContent = "No party rolls yet";
    }
  }

  // Strictly render ONLY Name, AC, HP, Conditions, and Concentration in the dock
  if (dockBody) {
    dockBody.innerHTML = playerMembers.map((m) => {
      const hp = m.hp || { cur: 10, max: 10, temp: 0 };
      const pct = Math.min(100, Math.max(0, Math.round((hp.cur / (hp.max || 1)) * 100)));
      const conds = (m.conditions || []).join(", ");
      const conc = (m.concentration || "").trim();
      const isDead = hp.cur <= 0;

      return `
        <div class="dock-member-pill ${isDead ? "unconscious" : ""} ${isCreatorDM ? "dm-clickable" : ""}"
             ${isCreatorDM ? `data-member-id="${escapeHtml(m.id || "")}"` : ""}
             title="${isCreatorDM ? "Click to inspect full character sheet (DM Only)" : "Party Member Vitals"}">
          <div class="dock-member-top">
            <span class="dock-member-name">${escapeHtml(m.name || "Unnamed")}</span>
            <span class="dock-member-ac">AC ${m.ac || 10}</span>
          </div>
          <div class="dock-member-hp-row">
            <span>HP: ${hp.cur}/${hp.max}${hp.temp > 0 ? ` (+${hp.temp})` : ""}</span>
            <span>${pct}%</span>
          </div>
          <div class="dm-health-track">
            <div class="dm-health-fill" style="width: ${pct}%;"></div>
          </div>
          ${conds ? `<span class="dock-member-conds">Cond: ${escapeHtml(conds)}</span>` : ""}
          ${conc ? `<span class="dock-member-conc">Conc: ${escapeHtml(conc)}</span>` : ""}
        </div>
      `;
    }).join("");
  }
}

function updatePartyStatusUI() {
  const statusBox = document.getElementById("partyStatusBox");
  const statusText = document.getElementById("partyStatusText");
  const roomInput = document.getElementById("campaignRoomInput");
  const joinBtn = document.getElementById("joinCampaignBtn");
  const copyPlayerCodeBtn = document.getElementById("copyPlayerRoomCodeBtn");
  const copyInviteBtn = document.getElementById("copyInviteLinkBtn");
  const leaveBtn = document.getElementById("leaveCampaignBtn");
  const playerSection = document.getElementById("playerPartySection");
  const headerDot = document.getElementById("headerPartyDot");
  const headerBtnText = document.getElementById("headerPartyBtnText");

  const dot = statusBox?.querySelector(".status-dot");

  renderRecentRoomsBar();

  if (connectedCampaignRoom) {
    if (dot) { dot.classList.remove("disconnected"); dot.classList.add("connected"); }
    if (headerDot) headerDot.classList.add("connected");
    if (headerBtnText) headerBtnText.textContent = `Party: ${connectedCampaignRoom}`;
    if (statusText) statusText.textContent = `Connected to room: ${connectedCampaignRoom}`;
    if (roomInput) roomInput.value = connectedCampaignRoom;
    if (joinBtn) joinBtn.style.display = "none";
    if (copyPlayerCodeBtn) copyPlayerCodeBtn.style.display = "inline-flex";
    if (copyInviteBtn) copyInviteBtn.style.display = "inline-flex";
    if (leaveBtn) leaveBtn.style.display = "inline-flex";
    if (playerSection) playerSection.style.display = "block";
    startPlayerPartyListener();
  } else {
    if (dot) {
      dot.classList.toggle("connected", !!activeDMRoomCode);
      dot.classList.toggle("disconnected", !activeDMRoomCode);
    }
    if (headerDot) headerDot.classList.toggle("connected", !!activeDMRoomCode);
    if (headerBtnText) headerBtnText.textContent = activeDMRoomCode ? `DM: ${activeDMRoomCode}` : "Party";
    if (statusText) statusText.textContent = activeDMRoomCode ? `Hosting as DM: ${activeDMRoomCode}` : "Not connected to any campaign room.";
    if (joinBtn) joinBtn.style.display = "inline-flex";
    if (copyPlayerCodeBtn) copyPlayerCodeBtn.style.display = "none";
    if (copyInviteBtn) copyInviteBtn.style.display = "none";
    if (leaveBtn) leaveBtn.style.display = "none";
    if (playerSection) playerSection.style.display = "none";
    if (playerPartyListUnsubscribe) {
      playerPartyListUnsubscribe();
      playerPartyListUnsubscribe = null;
    }
    if (playerRoomDocUnsubscribe) {
      playerRoomDocUnsubscribe();
      playerRoomDocUnsubscribe = null;
    }
    if (!activeDMRoomCode) renderLivePartyDock([]);
  }

  const dmCodeText = document.getElementById("dmActiveRoomCode");
  const dmInput = document.getElementById("dmRoomCodeInput");
  const copyBtn = document.getElementById("copyRoomCodeBtn");
  const copyDMInviteBtn = document.getElementById("copyDMInviteLinkBtn");
  const closeBtn = document.getElementById("closeCampaignBtn");
  const dmHandoutBtn = document.getElementById("dmQuickHandoutBtn");
  const dmActiveCard = document.getElementById("dmActiveSessionCard");
  const dmCreateCard = document.getElementById("dmCreateRoomCard");

  if (activeDMRoomCode) {
    if (dmActiveCard) dmActiveCard.style.display = "block";
    if (dmCreateCard) dmCreateCard.style.display = "none";
    if (dmCodeText) dmCodeText.textContent = activeDMRoomCode;
    if (copyBtn) copyBtn.style.display = "inline-flex";
    if (copyDMInviteBtn) copyDMInviteBtn.style.display = "inline-flex";
    if (closeBtn) closeBtn.style.display = "inline-flex";
    if (dmHandoutBtn) dmHandoutBtn.style.display = "inline-flex";
  } else {
    if (dmActiveCard) dmActiveCard.style.display = "none";
    if (dmCreateCard) dmCreateCard.style.display = "block";
    if (dmCodeText) dmCodeText.textContent = "NONE";
    if (copyBtn) copyBtn.style.display = "none";
    if (copyDMInviteBtn) copyDMInviteBtn.style.display = "none";
    if (closeBtn) closeBtn.style.display = "none";
    if (dmHandoutBtn) dmHandoutBtn.style.display = "none";
  }

  // Update Bottom-Left Party Chat Trigger Button Visibility
  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  const isMasterAdmin = isAdminSession();
  const effectiveChatRoom = activeChatRoomOverride || activeRoom;
  const bottomChatBtn = document.getElementById("bottomLeftPartyChatBtn");
  const bottomRoomBadge = document.getElementById("bottomChatRoomBadge");
  if (bottomChatBtn) {
    bottomChatBtn.style.display = (activeRoom || isMasterAdmin) ? "inline-flex" : "none";
    if (bottomRoomBadge && (activeRoom || isMasterAdmin)) {
      bottomRoomBadge.textContent = effectiveChatRoom || "ADMIN";
    }
  }
  if (!activeRoom && !isMasterAdmin && !activeChatRoomOverride) {
    const chatPanel = document.getElementById("floatingPartyChat");
    if (chatPanel) chatPanel.style.display = "none";
    isFloatingChatOpen = false;
  }
}

function handlePlayerKicked(reason = "The DM closed the room. You have been disconnected.") {
  if (!connectedCampaignRoom) return;
  const closedRoom = connectedCampaignRoom;
  connectedCampaignRoom = "";
  localStorage.removeItem(CAMPAIGN_ROOM_KEY);
  removeRecentRoom(closedRoom);

  if (playerPartyListUnsubscribe) {
    playerPartyListUnsubscribe();
    playerPartyListUnsubscribe = null;
  }
  if (playerRoomDocUnsubscribe) {
    playerRoomDocUnsubscribe();
    playerRoomDocUnsubscribe = null;
  }
  stopPartyChatListener();
  stopPartyHandoutsListener();
  cachedRoomMembers = [];
  renderLivePartyDock([]);
  updatePartyStatusUI();
  closeModal("dmInspectModal");
  showStatus(reason);
  alert(reason);
}

async function joinCampaignRoom(roomCode) {
  if (!db) {
    alert("Firebase database connection is unavailable.");
    return;
  }
  const cleanCode = roomCode.trim().toUpperCase();
  if (!cleanCode) return;

  await ensureAuthenticated();

  // Verify that the campaign room exists before attempting to join
  try {
    const roomSnap = await db.collection("campaigns").doc(cleanCode).get();
    if (!roomSnap.exists) {
      alert(`Campaign room "${cleanCode}" does not exist or has been closed by the DM.`);
      return;
    }

    // If this client is hosting this room as the DM, do not connect as a player
    if (activeDMRoomCode && activeDMRoomCode === cleanCode) {
      alert(`You are currently hosting room "${cleanCode}" as the Dungeon Master. Use the DM Live Dashboard to manage your party.`);
      updatePartyStatusUI();
      return;
    }

    // Purge any lingering legacy dm_presence document if present
    try {
      const dmDoc = await db.collection("campaigns").doc(cleanCode).collection("members").doc("dm_presence").get();
      if (dmDoc.exists) {
        dmDoc.ref.delete().catch(() => {});
      }
    } catch (e) {}
  } catch (err) {
    console.error("Could not check room existence before joining:", err);
    alert(`Could not connect to room "${cleanCode}": ${err.message || "Network error"}`);
    return;
  }

  connectedCampaignRoom = cleanCode;
  localStorage.setItem(CAMPAIGN_ROOM_KEY, connectedCampaignRoom);
  addRecentRoom(cleanCode);

  updatePartyStatusUI();

  const roster = getRoster();
  if (roster[activeCharId]) {
    await syncToLiveCampaign(roster[activeCharId]);
  } else {
    saveSheet(true);
  }
  showStatus(`Connected to Room ${cleanCode}!`);
}

async function leaveCampaignRoom() {
  const roomToLeave = connectedCampaignRoom;
  if (playerPartyListUnsubscribe) {
    playerPartyListUnsubscribe();
    playerPartyListUnsubscribe = null;
  }
  if (playerRoomDocUnsubscribe) {
    playerRoomDocUnsubscribe();
    playerRoomDocUnsubscribe = null;
  }
  stopPartyChatListener();
  stopPartyHandoutsListener();
  isJoinedViaAdminPanel = false;
  if (roomToLeave) {
    try { sessionStorage.removeItem("admin_joined_room_" + roomToLeave); } catch (e) {}
  }
  connectedCampaignRoom = "";
  localStorage.removeItem(CAMPAIGN_ROOM_KEY);
  cachedRoomMembers = [];
  renderLivePartyDock([]);
  updatePartyStatusUI();

  if (db && roomToLeave && activeCharId) {
    try {
      await db.collection("campaigns").doc(roomToLeave).collection("members").doc(activeCharId).delete();
    } catch (e) {
      console.warn("Could not remove character doc:", e);
    }
  }
  showStatus("Left Campaign Room");
}

let lastPartyActiveCharId = null;
let playerHasRegisteredSelf = false;

function startPlayerPartyListener() {
  if (!db || !connectedCampaignRoom) return;
  if (playerPartyListUnsubscribe) {
    playerPartyListUnsubscribe();
    playerPartyListUnsubscribe = null;
  }
  if (playerRoomDocUnsubscribe) {
    playerRoomDocUnsubscribe();
    playerRoomDocUnsubscribe = null;
  }

  const roomListeningTo = connectedCampaignRoom;
  playerHasRegisteredSelf = false;
  lastPartyActiveCharId = activeCharId;

  startPartyChatListener(roomListeningTo);
  startPartyHandoutsListener(roomListeningTo);

  const grid = document.getElementById("playerPartyGrid");
  const countEl = document.getElementById("playerMemberCount");

  // Real-time listener on the campaign room document itself:
  // If DM closes/deletes the room, trigger auto-kick for all players immediately
  playerRoomDocUnsubscribe = db.collection("campaigns").doc(roomListeningTo)
    .onSnapshot((docSnap) => {
      if (!docSnap.exists) {
        handlePlayerKicked(`Party room "${roomListeningTo}" was closed by the DM. You have been disconnected.`);
      }
    }, (err) => {
      console.warn("Room doc listener error:", err);
    });

  // Real-time listener on the members subcollection
  playerPartyListUnsubscribe = db.collection("campaigns").doc(roomListeningTo).collection("members")
    .onSnapshot((snapshot) => {
      // If character was switched locally, reset registration check
      if (lastPartyActiveCharId !== activeCharId) {
        lastPartyActiveCharId = activeCharId;
        playerHasRegisteredSelf = false;
      }

      const members = [];
      let foundSelf = false;

      snapshot.forEach((doc) => {
        const docId = String(doc.id || "");
        const data = doc.data() || {};
        const memberId = String(data.id || docId);
        const memberName = String(data.name || "");
        const memberClass = String(data.charClass || "");

        // Purge and ignore any DM presence records so DM is NEVER a player
        if (docId === "dm_presence" || docId.startsWith("dm_") || memberId === "dm_presence" || memberId.startsWith("dm_") || memberName === "Dungeon Master" || memberClass === "DM" || data.isDM) {
          try {
            doc.ref.delete().catch(() => {});
          } catch (e) {}
          return;
        }

        members.push(data);
        if (data.id === activeCharId) {
          foundSelf = true;
        }

        // Apply remote DM adjustments to our own character if any
        if (data.id === activeCharId && data.dmAdjustedAt && data.dmAdjustedAt > (window._lastAppliedDmAdjust || 0)) {
          window._lastAppliedDmAdjust = data.dmAdjustedAt;
          const curHpEl = document.getElementById("curHp");
          const inspToggle = document.getElementById("heroicInspirationToggle");
          if (curHpEl && data.hp && typeof data.hp.cur === "number") {
            curHpEl.value = data.hp.cur;
          }
          if (inspToggle && typeof data.heroicInspiration === "boolean") {
            inspToggle.checked = data.heroicInspiration;
          }
          updateHealthBars();
          saveSheet(true);
        }
      });

      if (foundSelf) {
        playerHasRegisteredSelf = true;
      } else if (playerHasRegisteredSelf && connectedCampaignRoom === roomListeningTo) {
        // Player was registered, but character doc is no longer in members collection
        handlePlayerKicked(`You were removed from party room "${roomListeningTo}" by the DM.`);
        return;
      }

      cachedRoomMembers = members;
      renderLivePartyDock(members);

      if (countEl) countEl.textContent = `${members.length} Active`;
      if (!grid) return;

      if (members.length === 0) {
        grid.innerHTML = `<p class="dm-empty-msg">No adventurers in this party yet.</p>`;
        return;
      }

      // Strictly display ONLY Name, Avatar, HP, AC, Conditions, and Concentration for players
      grid.innerHTML = members.map((m) => {
        const hp = m.hp || { cur: 10, max: 10, temp: 0 };
        const pct = Math.min(100, Math.max(0, Math.round((hp.cur / (hp.max || 1)) * 100)));
        const conds = (m.conditions || []).join(", ") || "None";
        const conc = (m.concentration || "").trim() || "None";
        const isDead = hp.cur <= 0;

        return `
          <div class="player-party-card ${isDead ? "unconscious" : ""}">
            <div class="dm-card-header">
              ${m.avatar ? `<img src="${m.avatar}" class="dm-player-avatar" alt="Avatar" />` : `<div class="dm-avatar-placeholder">&dagger;</div>`}
              <div class="dm-player-info">
                <span class="dm-player-name">${escapeHtml(m.name || "Unnamed")}</span>
              </div>
              <span class="dock-member-ac">AC ${m.ac || 10}</span>
            </div>
            <div class="dm-health-gauge">
              <div class="dm-health-labels">
                <span class="dm-hp-val">HP: ${hp.cur}/${hp.max} ${hp.temp > 0 ? `(+${hp.temp})` : ""}</span>
                <span>${pct}%</span>
              </div>
              <div class="dm-health-track">
                <div class="dm-health-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8;"><strong>Conditions:</strong> ${escapeHtml(conds)}</div>
            <div style="font-size: 0.72rem; color: #d8b4fe;"><strong>Concentration:</strong> ${escapeHtml(conc)}</div>
          </div>
        `;
      }).join("");
    }, (err) => {
      console.warn("Party listener error:", err);
    });
}

let dmHeartbeatTimer = null;

async function createNewCampaignRoom() {
  if (!db) {
    alert("Firebase database connection is unavailable.");
    return;
  }
  await ensureAuthenticated();

  const dmInput = document.getElementById("dmRoomCodeInput");
  const rawCode = dmInput?.value?.trim() || "";
  let code = "";

  const createBtn = document.getElementById("createCampaignBtn");
  if (createBtn) createBtn.disabled = true;

  try {
    if (rawCode) {
      code = rawCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (code.length < 3) {
        alert("Custom room code must be at least 3 characters long (letters, numbers, dashes).");
        return;
      }

      // Check if room code already exists in Firestore — multiple parties CANNOT use the same code!
      const existingDoc = await db.collection("campaigns").doc(code).get();
      if (existingDoc.exists) {
        alert(`Party code "${code}" is already in use by an active party. Multiple parties cannot use the same code. Please choose a different room code.`);
        return;
      }
    } else {
      // Generate a unique random code that does not exist in Firestore
      let foundUnique = false;
      let attempts = 0;
      while (attempts < 20) {
        code = "REALM-" + Math.floor(1000 + Math.random() * 9000);
        try {
          const checkDoc = await db.collection("campaigns").doc(code).get();
          if (!checkDoc.exists) {
            foundUnique = true;
            break;
          }
        } catch (e) {
          foundUnique = true;
          break;
        }
        attempts++;
      }
      if (!foundUnique) {
        code = "REALM-" + Math.floor(10000 + Math.random() * 90000);
      }
    }

    // If client was previously connected as a player in any room, disconnect player side first
    if (connectedCampaignRoom) {
      await leaveCampaignRoom();
    }

    addCreatedRoom(code);

    // Save campaign room document with creator UID and optional creator email
    const basePayload = {
      creatorUid: auth?.currentUser?.uid || "local",
      createdAt: Date.now()
    };
    const creatorEmail = (auth?.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email) ? auth.currentUser.email.trim() : "";
    if (creatorEmail) {
      try {
        await db.collection("campaigns").doc(code).set({
          ...basePayload,
          creatorEmail: creatorEmail
        });
      } catch (e) {
        console.warn("Could not write creatorEmail directly to room doc, falling back to base payload:", e);
        await db.collection("campaigns").doc(code).set(basePayload);
      }
    } else {
      await db.collection("campaigns").doc(code).set(basePayload);
    }

    if (dmInput) dmInput.value = "";
    await startDMLiveListener(code, true);
    showStatus(`Created party room ${code}!`);
  } catch (err) {
    console.error("Could not create campaign room:", err);
    alert(`Could not create party room "${code}": ${err.message || "Database permission denied"}`);
  } finally {
    if (createBtn) createBtn.disabled = false;
  }
}

async function startDMLiveListener(roomCode, isNewlyCreated = false) {
  if (!db) {
    alert("Firebase database connection is unavailable.");
    return;
  }
  const cleanCode = roomCode.trim().toUpperCase();
  if (!cleanCode) return;

  await ensureAuthenticated();

  // Verify that this user is actually the creator of the room before granting DM access
  if (!isNewlyCreated) {
    let isAuthorized = isLocalRoomCreator(cleanCode);
    try {
      const roomDoc = await db.collection("campaigns").doc(cleanCode).get();
      if (!roomDoc.exists) {
        activeDMRoomCode = "";
        localStorage.removeItem(DM_ROOM_KEY);
        updatePartyStatusUI();
        return;
      }
      if (roomDoc.exists && roomDoc.data()?.creatorUid) {
        if (auth?.currentUser?.uid && roomDoc.data().creatorUid === auth.currentUser.uid) {
          isAuthorized = true;
          addCreatedRoom(cleanCode);
        }
      }
    } catch (e) {
      console.warn("Room creator check note:", e);
    }

    if (!isAuthorized) {
      activeDMRoomCode = "";
      localStorage.removeItem(DM_ROOM_KEY);
      updatePartyStatusUI();
      alert("Access Denied: Only the DM who created this room can open the DM Live Dashboard and inspect full player character sheets.");
      return;
    }
  }

  if (dmHeartbeatTimer) {
    clearInterval(dmHeartbeatTimer);
    dmHeartbeatTimer = null;
  }

  // Delete any legacy dm_presence document in members subcollection
  try {
    db.collection("campaigns").doc(cleanCode).collection("members").doc("dm_presence").delete().catch(() => {});
  } catch (e) {}

  if (dmListenerUnsubscribe) dmListenerUnsubscribe();

  activeDMRoomCode = cleanCode;
  localStorage.setItem(DM_ROOM_KEY, activeDMRoomCode);
  addRecentRoom(activeDMRoomCode);
  updatePartyStatusUI();
  startPartyChatListener(activeDMRoomCode);
  startPartyHandoutsListener(activeDMRoomCode);

  const grid = document.getElementById("dmPartyGrid");
  const countEl = document.getElementById("dmMemberCount");

  dmListenerUnsubscribe = db.collection("campaigns").doc(activeDMRoomCode).collection("members")
    .onSnapshot((snapshot) => {
      cachedRoomMembers = [];
      snapshot.forEach((doc) => {
        const docId = String(doc.id || "");
        const d = doc.data() || {};
        const memberId = String(d.id || docId);
        const memberName = String(d.name || "");
        const memberClass = String(d.charClass || "");

        // Purge and ignore any DM presence records
        if (docId === "dm_presence" || docId.startsWith("dm_") || memberId === "dm_presence" || memberId.startsWith("dm_") || memberName === "Dungeon Master" || memberClass === "DM" || d.isDM) {
          try {
            doc.ref.delete().catch(() => {});
          } catch (e) {}
          return;
        }
        cachedRoomMembers.push(d);
      });
      if (countEl) countEl.textContent = `${cachedRoomMembers.length} Active`;

      renderLivePartyDock(cachedRoomMembers);

      if (!grid) return;
      if (cachedRoomMembers.length === 0) {
        grid.innerHTML = `
          <div class="dm-empty-state-box">
            <div class="dm-empty-halo">
              <span class="dm-empty-halo-icon">🏰</span>
            </div>
            <h4 class="dm-empty-headline">Your Realm is Ready</h4>
            <p class="dm-empty-instruction">Share your Room Code <strong>${escapeHtml(activeDMRoomCode)}</strong> or send the invite link. As soon as your players connect, their live HP, AC, conditions, and vitals will appear here.</p>
            <div class="dm-empty-cta-row">
              <button type="button" class="btn btn-primary btn-sm dm-empty-copy-code-btn" data-room="${escapeHtml(activeDMRoomCode)}">
                <span>📋</span> Copy Room Code
              </button>
              <button type="button" class="btn btn-dark-glass btn-sm dm-empty-copy-link-btn" data-room="${escapeHtml(activeDMRoomCode)}">
                <span>🔗</span> Copy 1-Click Invite Link
              </button>
            </div>
          </div>
        `;
        return;
      }

      grid.innerHTML = cachedRoomMembers.map((m) => {
        const hp = m.hp || { cur: 10, max: 10, temp: 0 };
        const pct = Math.min(100, Math.max(0, Math.round((hp.cur / (hp.max || 1)) * 100)));
        const isDead = hp.cur <= 0;

        return `
          <div class="dm-player-card ${isDead ? "unconscious" : ""}" data-member-id="${escapeHtml(m.id)}">
            <div class="dm-card-header">
              ${m.avatar ? `<img src="${m.avatar}" class="dm-player-avatar" alt="Avatar" />` : `<div class="dm-avatar-placeholder">&dagger;</div>`}
              <div class="dm-player-info">
                <span class="dm-player-name">${escapeHtml(m.name || "Unnamed")} ${m.heroicInspiration ? "&#10022;" : ""}</span>
                <span class="dm-player-sub">${escapeHtml(m.charRace || "")} ${escapeHtml(m.charClass || "")} (Lvl ${m.level || 1})</span>
              </div>
            </div>
            <div class="dm-health-gauge">
              <div class="dm-health-labels">
                <span class="dm-hp-val">HP: ${hp.cur} / ${hp.max}</span>
                ${hp.temp > 0 ? `<span class="dm-temp-val">+${hp.temp} Temp</span>` : ""}
              </div>
              <div class="dm-health-track">
                <div class="dm-health-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div class="dm-stats-strip">
              <span class="dm-stat-item">AC: <strong>${m.ac || 10}</strong></span>
              <span class="dm-stat-item">PP: <strong>${m.passivePerception || 10}</strong></span>
              <span class="dm-stat-item">PI: <strong>${m.passiveInsight || 10}</strong></span>
              <span class="dm-stat-item">Spd: <strong>${m.speed || 30}ft</strong></span>
            </div>
            <div class="dm-conditions-list">
              ${(m.conditions || []).map((c) => `<span class="dm-cond-badge">${escapeHtml(c)}</span>`).join("")}
              ${m.concentration ? `<span class="dm-cond-badge" style="background:rgba(192,132,252,0.2);color:#d8b4fe;">Conc: ${escapeHtml(m.concentration)}</span>` : ""}
            </div>
            <div class="dm-quick-actions">
              <button type="button" class="dm-quick-btn dmg" data-dm-act="hp" data-delta="-5" data-member-id="${escapeHtml(m.id)}" title="Deal 5 Damage">-5 HP</button>
              <button type="button" class="dm-quick-btn dmg" data-dm-act="hp" data-delta="-1" data-member-id="${escapeHtml(m.id)}" title="Deal 1 Damage">-1</button>
              <button type="button" class="dm-quick-btn heal" data-dm-act="hp" data-delta="1" data-member-id="${escapeHtml(m.id)}" title="Heal 1 HP">+1</button>
              <button type="button" class="dm-quick-btn heal" data-dm-act="hp" data-delta="5" data-member-id="${escapeHtml(m.id)}" title="Heal 5 HP">+5 HP</button>
              <button type="button" class="dm-quick-btn insp" data-dm-act="inspire" data-member-id="${escapeHtml(m.id)}" title="Toggle Heroic Inspiration">&#10022; Inspire</button>
            </div>
          </div>
        `;
      }).join("");
    }, (err) => {
      console.warn("DM listener error:", err);
    });

  showStatus(`DM Session Active: ${activeDMRoomCode}`);
}

async function dmQuickAdjustPlayer(memberId, actionType, delta = 0) {
  if (!activeDMRoomCode || !db || !memberId) return;
  const member = cachedRoomMembers.find((m) => m.id === memberId);
  if (!member) return;

  try {
    await ensureAuthenticated();
    if (actionType === "hp") {
      const cur = member.hp?.cur ?? 10;
      const max = member.hp?.max ?? 10;
      const temp = member.hp?.temp ?? 0;
      const nextCur = Math.min(max, Math.max(0, cur + delta));
      await db.collection("campaigns").doc(activeDMRoomCode).collection("members").doc(memberId).set({
        hp: { cur: nextCur, max, temp },
        dmAdjustedAt: Date.now()
      }, { merge: true });
      showStatus(`${member.name}: HP → ${nextCur}/${max}`);
    } else if (actionType === "inspire") {
      const nextInsp = !member.heroicInspiration;
      await db.collection("campaigns").doc(activeDMRoomCode).collection("members").doc(memberId).set({
        heroicInspiration: nextInsp,
        dmAdjustedAt: Date.now()
      }, { merge: true });
      showStatus(`${member.name}: ${nextInsp ? "Granted Inspiration!" : "Inspiration Removed"}`);
    }
  } catch (err) {
    console.error("DM quick adjust failed:", err);
  }
}

async function closeDMCampaignRoom() {
  const roomToClose = activeDMRoomCode;
  if (!roomToClose) return;

  if (!confirm(`Are you sure you want to close room "${roomToClose}"? All connected players will be automatically kicked.`)) {
    return;
  }

  showStatus(`Closing room ${roomToClose}...`);

  try {
    await ensureAuthenticated();

    // 1. Delete all member documents so real-time listeners for all connected players fire immediately
    const membersSnap = await db.collection("campaigns").doc(roomToClose).collection("members").get();
    if (!membersSnap.empty) {
      const deletePromises = membersSnap.docs.map((doc) => doc.ref.delete().catch((e) => console.warn("Member delete err:", e)));
      await Promise.all(deletePromises);
    }

    // 2. Delete the campaign room document itself
    await db.collection("campaigns").doc(roomToClose).delete().catch((e) => console.warn("Campaign doc delete err:", e));
  } catch (err) {
    console.error("Error closing campaign room in Firestore:", err);
  }

  // 3. Clear DM heartbeat timer and detach DM listener
  if (dmHeartbeatTimer) {
    clearInterval(dmHeartbeatTimer);
    dmHeartbeatTimer = null;
  }
  if (db && roomToClose) {
    try {
      db.collection("campaigns").doc(roomToClose).collection("members").doc("dm_presence").delete().catch(() => {});
    } catch (e) {}
  }
  if (dmListenerUnsubscribe) {
    dmListenerUnsubscribe();
    dmListenerUnsubscribe = null;
  }
  activeDMRoomCode = "";
  localStorage.removeItem(DM_ROOM_KEY);
  removeCreatedRoom(roomToClose);
  removeRecentRoom(roomToClose);

  // 4. If DM client was also joined as a player to this same room, disconnect player side too
  if (connectedCampaignRoom === roomToClose) {
    if (playerPartyListUnsubscribe) {
      playerPartyListUnsubscribe();
      playerPartyListUnsubscribe = null;
    }
    if (playerRoomDocUnsubscribe) {
      playerRoomDocUnsubscribe();
      playerRoomDocUnsubscribe = null;
    }
    connectedCampaignRoom = "";
    localStorage.removeItem(CAMPAIGN_ROOM_KEY);
  }

  cachedRoomMembers = [];
  stopPartyChatListener();
  stopPartyHandoutsListener();
  renderLivePartyDock([]);
  updatePartyStatusUI();

  const grid = document.getElementById("dmPartyGrid");
  if (grid) {
    grid.innerHTML = `
      <div class="dm-empty-state-box">
        <div class="dm-empty-halo">
          <span class="dm-empty-halo-icon">👑</span>
        </div>
        <h4 class="dm-empty-headline">No Active DM Session</h4>
        <p class="dm-empty-instruction">Host a campaign realm above to monitor your players live and inspect their full character sheets.</p>
      </div>
    `;
  }
  showStatus(`DM Room ${roomToClose} closed. All players have been kicked.`);
}

window.addEventListener("beforeunload", () => {
  if (db && activeDMRoomCode) {
    try {
      db.collection("campaigns").doc(activeDMRoomCode).collection("members").doc("dm_presence").delete().catch(() => {});
    } catch (e) {}
  }
});

function openInspectModal(memberId) {
  if (!activeDMRoomCode) return;

  const member = cachedRoomMembers.find((m) => m.id === memberId);
  if (!member) return;
  currentInspectedMemberId = memberId;

  const content = document.getElementById("dmInspectContent");
  const title = document.getElementById("inspectCharTitle");
  if (title) title.textContent = `DM Inspection: ${member.name || "Adventurer"}`;

  const attrs = member.attributes || {};
  const hp = member.hp || { cur: 10, max: 10, temp: 0 };

  if (content) {
    content.innerHTML = `
      <div class="inspect-char-banner">
        ${member.avatar ? `<div class="inspect-avatar-wrap"><img src="${member.avatar}" class="inspect-avatar-img" alt="Avatar" /></div>` : ""}
        <div class="inspect-char-info">
          <span class="inspect-char-name">${escapeHtml(member.name || "Unnamed")}</span>
          <span class="inspect-char-meta-line">${escapeHtml(member.charRace || "")} ${escapeHtml(member.charSubclass || "")} ${escapeHtml(member.charClass || "")} &bull; Level ${member.level || 1} &bull; ${escapeHtml(member.charAlignment || "")}</span>
        </div>
      </div>

      <div class="inspect-vitals-ribbon">
        <div class="inspect-stat-card"><span class="inspect-stat-card-label">Hit Points</span><span class="inspect-stat-card-val">${hp.cur}/${hp.max} ${hp.temp > 0 ? `(+${hp.temp})` : ""}</span></div>
        <div class="inspect-stat-card"><span class="inspect-stat-card-label">Armor Class</span><span class="inspect-stat-card-val">${member.ac || 10}</span></div>
        <div class="inspect-stat-card"><span class="inspect-stat-card-label">Passive Perc</span><span class="inspect-stat-card-val">${member.passivePerception || 10}</span></div>
        <div class="inspect-stat-card"><span class="inspect-stat-card-label">Passive Ins</span><span class="inspect-stat-card-val">${member.passiveInsight || 10}</span></div>
        <div class="inspect-stat-card"><span class="inspect-stat-card-label">Speed</span><span class="inspect-stat-card-val">${member.speed || 30} ft</span></div>
      </div>

      <div class="inspect-section">
        <h4 class="inspect-section-title">Ability Scores &amp; Saves</h4>
        <div class="inspect-ability-grid">
          ${["str", "dex", "con", "int", "wis", "cha"].map((s) => {
            const a = attrs[s] || { score: 10, mod: 0, save: 0, isSaveProf: false };
            return `
              <div class="inspect-ability-cell">
                <span class="inspect-attr-tag">${s.toUpperCase()}</span>
                <span class="inspect-attr-mod">${formatSigned(a.mod)}</span>
                <span class="inspect-attr-score">(${a.score})</span>
                <span class="inspect-attr-save">Save: ${formatSigned(a.save)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="inspect-section">
        <h4 class="inspect-section-title">Weapons &amp; Attacks</h4>
        <div class="inspect-weapons-list">
          ${(member.weapons || []).filter((w) => w.name).map((w) => `
            <div class="inspect-weapon-row">
              <span class="inspect-wpn-name">${escapeHtml(w.name)}</span>
              <span class="inspect-wpn-type">${escapeHtml(w.atk || "-")}</span>
              <span class="inspect-wpn-dmg">${escapeHtml(w.dmg || "-")}</span>
              <span class="inspect-wpn-notes">${escapeHtml(w.notes || "")}</span>
            </div>
          `).join("") || '<p class="loading-text">No weapons logged.</p>'}
        </div>
      </div>

      <div class="inspect-section">
        <h4 class="inspect-section-title">Abilities &amp; Traits</h4>
        <div class="inspect-grid-blocks">
          ${(member.traits || []).map((t) => `
            <div class="inspect-mini-card">
              <span class="inspect-mini-title">${escapeHtml(t.name)}</span>
              <span class="inspect-mini-tag">${escapeHtml(t.type || "Feature")}</span>
              <p class="inspect-mini-desc">${escapeHtml(t.desc || "")}</p>
            </div>
          `).join("") || '<p class="loading-text">No features listed.</p>'}
        </div>
      </div>
    `;
  }

  document.getElementById("dmInspectModal")?.classList.add("open");
}

async function kickPlayerFromRoom(memberId) {
  if (!activeDMRoomCode || !db || !memberId) return;
  if (!confirm("Kick player from party?")) return;
  try {
    await db.collection("campaigns").doc(activeDMRoomCode).collection("members").doc(memberId).delete();
    closeModal("dmInspectModal");
    currentInspectedMemberId = null;
    showStatus("Player removed from party");
  } catch (err) {
    console.error("Kick error:", err);
  }
}

/* ==========================================================================
   HP CALCULATOR, INLINE STEPPERS & REST ACTIONS
   ========================================================================== */

function applyQuickHpStep(delta) {
  const curHpEl = document.getElementById("curHp");
  const maxHpEl = document.getElementById("maxHp");
  const tempHpEl = document.getElementById("tempHp");

  let curHp = parseInt(curHpEl?.value, 10) || 0;
  const maxHp = parseInt(maxHpEl?.value, 10) || 10;
  let tempHp = parseInt(tempHpEl?.value, 10) || 0;

  if (delta < 0) {
    const dmg = Math.abs(delta);
    if (tempHp > 0) {
      if (dmg <= tempHp) tempHp -= dmg;
      else {
        const rem = dmg - tempHp;
        tempHp = 0;
        curHp = Math.max(0, curHp - rem);
      }
    } else {
      curHp = Math.max(0, curHp - dmg);
    }

    const concSpell = document.getElementById("spellConcentration")?.value?.trim();
    if (concSpell) {
      showStatus(`-1 HP! Roll CON Save (DC 10) for ${concSpell}!`);
    }
  } else if (delta > 0) {
    curHp = Math.min(maxHp, curHp + delta);
  }

  if (curHpEl) curHpEl.value = curHp;
  if (tempHpEl) tempHpEl.value = tempHp;
  recalculateAll();
  saveSheet(true);
}

function applyHpAdjustment(type) {
  const amtInput = document.getElementById("hpModalAmount");
  const amt = parseInt(amtInput?.value, 10);
  if (!amt || isNaN(amt) || amt <= 0) {
    alert("Please enter a valid positive number.");
    return;
  }

  const curHpEl = document.getElementById("curHp");
  const maxHpEl = document.getElementById("maxHp");
  const tempHpEl = document.getElementById("tempHp");

  let curHp = parseInt(curHpEl?.value, 10) || 0;
  const maxHp = parseInt(maxHpEl?.value, 10) || 10;
  let tempHp = parseInt(tempHpEl?.value, 10) || 0;

  if (type === "damage") {
    if (tempHp > 0) {
      if (amt <= tempHp) {
        tempHp -= amt;
      } else {
        const remaining = amt - tempHp;
        tempHp = 0;
        curHp = Math.max(0, curHp - remaining);
      }
    } else {
      curHp = Math.max(0, curHp - amt);
    }

    const concSpell = document.getElementById("spellConcentration")?.value?.trim();
    if (concSpell) {
      const dc = Math.max(10, Math.floor(amt / 2));
      showStatus(`Took ${amt} dmg! Roll CON Save (DC ${dc}) for ${concSpell}!`);
    } else {
      showStatus(`Took ${amt} damage!`);
    }
  } else if (type === "heal") {
    curHp = Math.min(maxHp, curHp + amt);
    showStatus(`Healed for ${amt} HP!`);
  } else if (type === "temp") {
    tempHp = Math.max(tempHp, amt);
    showStatus(`Set Temp HP to ${tempHp}!`);
  }

  if (curHpEl) curHpEl.value = curHp;
  if (tempHpEl) tempHpEl.value = tempHp;

  recalculateAll();
  saveSheet(false);
  closeModal("hpModal");
}

function applyShortRest() {
  const curHDEl = document.getElementById("hitDiceCur");
  const curHpEl = document.getElementById("curHp");
  const maxHpEl = document.getElementById("maxHp");
  const dieSides = parseInt(document.getElementById("hitDieSize")?.value, 10) || 8;

  let curHD = parseInt(curHDEl?.value, 10) || 0;
  let curHp = parseInt(curHpEl?.value, 10) || 0;
  const maxHp = parseInt(maxHpEl?.value, 10) || 10;
  const conMod = getModifier(parseInt(document.getElementById("attr_con")?.value, 10) || 10);

  if (curHD <= 0) {
    alert("You have no Hit Dice left to spend during this Short Rest.");
    return;
  }

  const spend = prompt(`Short Rest: You have ${curHD}d${dieSides} Hit Dice available.\nHow many would you like to spend to recover HP?`, "1");
  const count = parseInt(spend, 10);
  if (!count || isNaN(count) || count <= 0) return;

  const toSpend = Math.min(curHD, count);
  let totalHealed = 0;
  for (let i = 0; i < toSpend; i++) {
    const roll = Math.floor(Math.random() * dieSides) + 1;
    totalHealed += Math.max(1, roll + conMod);
  }

  curHD -= toSpend;
  curHp = Math.min(maxHp, curHp + totalHealed);

  if (curHDEl) curHDEl.value = curHD;
  if (curHpEl) curHpEl.value = curHp;

  const pactMax = parseInt(document.getElementById("pactSlotsMax")?.value, 10) || 0;
  const pactCurEl = document.getElementById("pactSlotsCur");
  if (pactCurEl && pactMax > 0) pactCurEl.value = pactMax;

  addDiceHistory(`Short Rest (${toSpend}d${dieSides})`, `+${totalHealed} HP`);
  recalculateAll();
  saveSheet(false);
  showStatus(`Short Rest: Spent ${toSpend}d${dieSides}, healed ${totalHealed} HP!`);
}

function applyLongRest() {
  if (!confirm("Take a Long Rest? This will restore all HP, reset spell slots, restore class points, and recover half your Hit Dice.")) return;

  const maxHp = parseInt(document.getElementById("maxHp")?.value, 10) || 10;
  const curHpEl = document.getElementById("curHp");
  if (curHpEl) curHpEl.value = maxHp;

  const tempHpEl = document.getElementById("tempHp");
  if (tempHpEl) tempHpEl.value = 0;

  const maxHD = parseInt(document.getElementById("hitDiceMax")?.value, 10) || 1;
  const curHDEl = document.getElementById("hitDiceCur");
  if (curHDEl) {
    let curHD = parseInt(curHDEl.value, 10) || 0;
    curHD = Math.min(maxHD, curHD + Math.max(1, Math.floor(maxHD / 2)));
    curHDEl.value = curHD;
  }

  for (let lvl = 1; lvl <= 9; lvl++) {
    const maxVal = parseInt(document.getElementById(`slot${lvl}_max`)?.value, 10) || 0;
    const curEl = document.getElementById(`slot${lvl}_cur`);
    if (curEl) curEl.value = maxVal;
    updateSlotPips(lvl);
  }

  const pactMax = parseInt(document.getElementById("pactSlotsMax")?.value, 10) || 0;
  const pactCurEl = document.getElementById("pactSlotsCur");
  if (pactCurEl) pactCurEl.value = pactMax;

  const dSucc = document.getElementById("deathSucc");
  const dFail = document.getElementById("deathFail");
  if (dSucc) dSucc.value = 0;
  if (dFail) dFail.value = 0;

  const classPtsMax = parseInt(document.getElementById("classPtsMax")?.value, 10) || 0;
  const curClassPts = document.getElementById("classPtsCur");
  if (curClassPts) curClassPts.value = classPtsMax;

  myCustomResources.forEach((r) => {
    if (r.max) r.cur = r.max;
  });
  renderCustomResources();

  const exEl = document.getElementById("exhaustionLevel");
  if (exEl) {
    const curEx = parseInt(exEl.value, 10) || 0;
    if (curEx > 0) exEl.value = curEx - 1;
  }

  recalculateAll();
  saveSheet(false);
  showStatus("Long Rest Complete! Vitals & Slots Restored.");
}

/* ==========================================================================
   MULTI-PLATFORM IMPORTERS
   ========================================================================== */

function importFromPconParchment(parsed) {
  const data = Array.isArray(parsed) ? parsed[0] : (parsed.character || parsed.data || parsed);
  if (!data) throw new Error("Unrecognized parchment format");

  resetSheet();

  const charName = data.name || data.charName || "Imported Character";
  document.getElementById("charName").value = charName;
  if (data.level || data.charLevel) document.getElementById("charLevel").value = data.level || data.charLevel;
  if (data.race || data.charRace) document.getElementById("charRace").value = data.race || data.charRace;
  if (data.class || data.charClass) document.getElementById("charClass").value = data.class || data.charClass;

  const stats = ["str", "dex", "con", "int", "wis", "cha"];
  stats.forEach((s) => {
    const val = data.stats?.[s] || data.attributes?.[s]?.score || data[`attr_${s}`] || 10;
    const el = document.getElementById(`attr_${s}`);
    if (el) el.value = val;
  });

  if (data.hp || data.maxHp) {
    const max = data.hp?.max || data.maxHp || 10;
    const cur = data.hp?.cur || data.curHp || max;
    document.getElementById("maxHp").value = max;
    document.getElementById("curHp").value = cur;
  }

  if (Array.isArray(data.spells)) myCharacterSpells = data.spells;
  if (Array.isArray(data.traits)) myCharacterTraits = data.traits;
  if (Array.isArray(data.weapons)) myCharacterWeapons = data.weapons;

  recalculateAll();
  renderWeapons();
  renderMySpells();
  renderMyTraits();
  saveSheet(false);
  showStatus("Imported from PC on Parchment!");
}

function importFromDnDBeyond(parsed) {
  const d = parsed.data || parsed;
  if (!d) throw new Error("Invalid D&D Beyond format");

  resetSheet();

  document.getElementById("charName").value = d.name || "D&D Beyond Character";
  if (d.race?.fullName) document.getElementById("charRace").value = d.race.fullName;

  if (Array.isArray(d.classes) && d.classes.length > 0) {
    const primary = d.classes[0];
    document.getElementById("charClass").value = primary.definition?.name || "";
    document.getElementById("charSubclass").value = primary.subclassDefinition?.name || "";
    document.getElementById("charLevel").value = primary.level || 1;
  }

  const statMap = ["str", "dex", "con", "int", "wis", "cha"];
  if (Array.isArray(d.stats)) {
    d.stats.forEach((s, idx) => {
      const statCode = statMap[idx];
      const el = document.getElementById(`attr_${statCode}`);
      if (el) el.value = s.value || 10;
    });
  }

  const baseHp = d.baseHitPoints || 10;
  const bonusHp = d.bonusHitPoints || 0;
  const totalMax = baseHp + bonusHp;
  document.getElementById("maxHp").value = totalMax;
  document.getElementById("curHp").value = totalMax - (d.removedHitPoints || 0);

  if (Array.isArray(d.inventory)) {
    myCharacterWeapons = [];
    myStructuredInventory = [];
    const lvl = parseInt(d.classes?.[0]?.level, 10) || 1;
    const prof = getProfBonus(lvl);
    const strVal = d.stats?.[0]?.value || 10;
    const dexVal = d.stats?.[1]?.value || 10;
    const strMod = getModifier(strVal);
    const dexMod = getModifier(dexVal);

    d.inventory.forEach((item) => {
      if (item.definition?.filterType === "Weapon" && item.equipped) {
        const isRanged = item.definition.attackType === 2;
        const hasFinesse = Array.isArray(item.definition.properties) && item.definition.properties.some((p) => (p.name || "").toLowerCase().includes("finesse"));
        const chosenMod = isRanged ? dexMod : (hasFinesse ? Math.max(strMod, dexMod) : strMod);
        const calcAtk = formatSigned(prof + chosenMod);
        const attackCategory = isRanged ? "Ranged" : "Melee";

        myCharacterWeapons.push({
          name: item.definition.name || "Weapon",
          atk: calcAtk,
          dmg: item.definition.damage?.diceString || "1d6",
          notes: `${attackCategory}${item.definition.snippet ? " • " + item.definition.snippet : ""}`
        });
      }
      if (item.definition?.name) {
        myStructuredInventory.push({
          equipped: !!item.equipped,
          name: item.definition.name,
          qty: item.quantity || 1,
          weight: item.definition.weight || 0
        });
      }
    });
  }

  recalculateAll();
  renderWeapons();
  renderStructuredInventory();
  saveSheet(false);
  showStatus("Imported from D&D Beyond!");
}

function importFromGenericOrRoll20(parsed) {
  resetSheet();
  const d = parsed.character || parsed.data || parsed;

  if (d.name) document.getElementById("charName").value = d.name;

  if (Array.isArray(d.attribs)) {
    const getAttr = (name) => d.attribs.find((a) => a.name === name)?.current;
    if (getAttr("class")) document.getElementById("charClass").value = getAttr("class");
    if (getAttr("race")) document.getElementById("charRace").value = getAttr("race");
    if (getAttr("level")) document.getElementById("charLevel").value = parseInt(getAttr("level"), 10) || 1;
    if (getAttr("ac")) document.getElementById("ac").value = parseInt(getAttr("ac"), 10) || 10;
    if (getAttr("hp")) {
      document.getElementById("curHp").value = parseInt(getAttr("hp"), 10) || 10;
      const max = d.attribs.find((a) => a.name === "hp")?.max;
      document.getElementById("maxHp").value = parseInt(max || getAttr("hp"), 10) || 10;
    }
    const statNames = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
    Object.keys(statNames).forEach((short) => {
      const v = getAttr(statNames[short]);
      if (v) document.getElementById(`attr_${short}`).value = parseInt(v, 10) || 10;
    });
  } else {
    importFromPconParchment(d);
    return;
  }

  recalculateAll();
  saveSheet(false);
  showStatus("Imported Character JSON!");
}

/* ==========================================================================
   DIRECT MODAL OPEN HANDLERS
   ========================================================================== */

function openPartyModal() {
  updatePartyStatusUI();
  const modal = document.getElementById("partyModal");
  if (modal) {
    if (activeDMRoomCode && !connectedCampaignRoom) {
      modal.querySelector('.party-mode-tabs .sub-tab[data-sub="party-dm-view"]')?.click();
    }
    modal.classList.add("open");
  }
}

function openSpellModal() {
  const input = document.getElementById("spellSearchInput");
  if (input) input.value = "";
  loadAllSpells();
  filterAndRenderSpells("");
  document.getElementById("spellModal")?.classList.add("open");
  setTimeout(() => input?.focus(), 60);
}

function openTraitModal() {
  const input = document.getElementById("traitSearchInput");
  if (input) input.value = "";
  loadAllTraits();
  filterAndRenderTraits("");
  document.getElementById("traitModal")?.classList.add("open");
  setTimeout(() => input?.focus(), 60);
}

/* ==========================================================================
   MASTER CLICK EVENT DELEGATION
   ========================================================================== */

document.addEventListener("click", async (e) => {
  // 1. MAIN WORKSPACE TABS ROUTING
  const mainTab = e.target.closest(".main-tab");
  if (mainTab && mainTab.dataset.target) {
    e.preventDefault();
    switchMainTab(mainTab.dataset.target);
    return;
  }

  // 2. SUBTABS ROUTING
  const subTab = e.target.closest(".sub-tab");
  if (subTab && subTab.dataset.sub) {
    e.preventDefault();
    const parentContainer = subTab.closest(".subtab-controls");
    if (parentContainer) {
      parentContainer.querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("active"));
      subTab.classList.add("active");
      const parentScope = parentContainer.parentElement;
      parentScope.querySelectorAll(".subtab-page").forEach((p) => p.classList.remove("active"));
      document.getElementById(subTab.dataset.sub)?.classList.add("active");
    }
    return;
  }

  // 3. TRAIT & SPELL CATEGORY FILTER PILLS
  const catPill = e.target.closest(".cat-pill");
  if (catPill) {
    const bar = catPill.parentElement;
    bar.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
    catPill.classList.add("active");

    if (bar.id === "traitCategoryFilterBar") {
      activeTraitCategoryFilter = catPill.dataset.filter || "all";
      renderMyTraits();
    } else if (bar.id === "spellLevelFilterBar") {
      activeSpellLevelFilter = catPill.dataset.lvl || "all";
      renderMySpells();
    }
    return;
  }

  // Proficient-Only Skills Filter Button
  if (e.target.id === "filterProficientSkillsBtn") {
    filterProficientSkillsOnly = !filterProficientSkillsOnly;
    e.target.classList.toggle("active", filterProficientSkillsOnly);
    filterSkillsMatrix();
    return;
  }

  // 4. FOOTER QUICKNAV
  const footerBtn = e.target.closest(".footer-nav-btn");
  if (footerBtn && footerBtn.dataset.tab) {
    e.preventDefault();
    switchMainTab(footerBtn.dataset.tab);
    const map = {
      attr: ".attributes-group",
      skills: ".skills-attribute-matrix",
      traits: "#tab-traits",
      spells: "#tab-spells",
      journal: "#tab-journal"
    };
    if (footerBtn.dataset.scroll && map[footerBtn.dataset.scroll]) {
      document.querySelector(map[footerBtn.dataset.scroll])?.scrollIntoView({ behavior: "smooth" });
    }
    return;
  }

  // Modal Close Buttons
  if (e.target.classList.contains("modal-close-btn") || e.target.closest(".modal-close-btn")) {
    e.preventDefault();
    e.target.closest(".modal-backdrop")?.classList.remove("open");
    if (e.target.closest("#dmInspectModal")) currentInspectedMemberId = null;
    return;
  }
  if (e.target.classList.contains("modal-backdrop")) {
    e.preventDefault();
    e.target.classList.remove("open");
    if (e.target.id === "dmInspectModal") currentInspectedMemberId = null;
    return;
  }

  // Command Palette Trigger & Items
  if (e.target.id === "commandPaletteBtn" || e.target.closest("#commandPaletteBtn")) {
    e.preventDefault();
    openCommandPalette();
    return;
  }

  const cmdItem = e.target.closest(".cmd-palette-item");
  if (cmdItem) {
    const idx = parseInt(cmdItem.dataset.idx, 10);
    if (!isNaN(idx) && currentQuickSearchResults[idx]) {
      navigateToSearchedThing(currentQuickSearchResults[idx]);
    }
    return;
  }

  // Global Concentration Clear Button
  if (e.target.id === "clearConcentrationBtn" || e.target.closest("#globalConcentrationBanner")) {
    const concEl = document.getElementById("spellConcentration");
    if (concEl) {
      concEl.value = "";
      updateConcentrationBanner();
      renderMySpells();
      saveSheet(false);
      showStatus("Concentration Ended");
    }
    return;
  }

  // Spell Card Concentration Toggle Button
  const spellConcBtn = e.target.closest(".spell-conc-btn");
  if (spellConcBtn) {
    const sName = spellConcBtn.dataset.spellName || "";
    const concEl = document.getElementById("spellConcentration");
    if (concEl) {
      if (concEl.value.trim().toLowerCase() === sName.toLowerCase()) {
        concEl.value = "";
        showStatus("Concentration Ended");
      } else {
        concEl.value = sName;
        showStatus(`Concentrating on ${sName}!`);
      }
      updateConcentrationBanner();
      renderMySpells();
      saveSheet(false);
    }
    return;
  }

  // Auto-Calculate Spell Save DC & Spell Attack Bonus
  if (e.target.id === "autoCalcSpellStatsBtn") {
    const abilRaw = (document.getElementById("spellAbility")?.value || "int").toLowerCase().trim();
    const statKey = ["str", "dex", "con", "int", "wis", "cha"].find((k) => abilRaw.includes(k)) || "int";
    const score = parseInt(document.getElementById(`attr_${statKey}`)?.value, 10) || 10;
    const mod = getModifier(score);
    const level = parseInt(document.getElementById("charLevel")?.value, 10) || 1;
    const prof = getProfBonus(level);

    const dcEl = document.getElementById("spellDc");
    const atkEl = document.getElementById("spellAtkBonus");
    const abilEl = document.getElementById("spellAbility");
    if (abilEl && !abilEl.value.trim()) abilEl.value = statKey.toUpperCase();
    if (dcEl) dcEl.value = 8 + prof + mod;
    if (atkEl) atkEl.value = formatSigned(prof + mod);
    saveSheet(false);
    showStatus(`Synced Spell Stats from ${statKey.toUpperCase()}!`);
    return;
  }

  // Roll Spell Attack Button
  if (e.target.id === "rollSpellAttackBtn") {
    const bonus = parseInt(document.getElementById("spellAtkBonus")?.value, 10) || 0;
    performD20Roll(bonus, "Spell Attack");
    return;
  }

  // 1-Click Weapon Attack Roll & Damage Roll Buttons
  const wpnAtkBtn = e.target.closest(".wpn-roll-atk-btn");
  if (wpnAtkBtn) {
    const idx = parseInt(wpnAtkBtn.dataset.index, 10);
    const wpn = myCharacterWeapons[idx] || {};
    const name = wpn.name?.trim() || "Weapon";
    const numMatch = String(wpn.atk || "").match(/[+-]?\d+/);
    const bonus = numMatch ? parseInt(numMatch[0], 10) : 0;
    performD20Roll(bonus, `${name} Atk`);
    return;
  }

  const wpnDmgBtn = e.target.closest(".wpn-roll-dmg-btn");
  if (wpnDmgBtn) {
    const idx = parseInt(wpnDmgBtn.dataset.index, 10);
    const wpn = myCharacterWeapons[idx] || {};
    const name = wpn.name?.trim() || "Weapon";
    const rawDmg = (wpn.dmg || "1d6").trim();
    rollCustomFormula(rawDmg, `${name} Dmg`);
    return;
  }

  // TOP BAR COMMAND BUTTONS & LIVE PARTY DOCK ACTIONS
  if (e.target.id === "partyModalBtn" || e.target.closest("#partyModalBtn") || e.target.id === "dockOpenFullPartyBtn") {
    e.preventDefault();
    openPartyModal();
    return;
  }

  if (e.target.id === "dockCopyCodeBtn" || e.target.id === "copyPlayerRoomCodeBtn") {
    const code = connectedCampaignRoom || activeDMRoomCode;
    if (code) {
      navigator.clipboard.writeText(code).then(() => showStatus(`Room Code ${code} Copied!`));
    }
    return;
  }

  if (e.target.id === "dockCopyLinkBtn" || e.target.closest("#dockCopyLinkBtn") ||
      e.target.id === "copyInviteLinkBtn" || e.target.closest("#copyInviteLinkBtn") ||
      e.target.id === "copyDMInviteLinkBtn" || e.target.closest("#copyDMInviteLinkBtn")) {
    copyRoomInviteLink(connectedCampaignRoom || activeDMRoomCode);
    return;
  }

  if (e.target.id === "dockToggleCollapseBtn") {
    isPartyDockCollapsed = !isPartyDockCollapsed;
    e.target.innerHTML = isPartyDockCollapsed ? "&#9660;" : "&#9650;";
    const body = document.getElementById("livePartyDockBody");
    if (body) body.style.display = isPartyDockCollapsed ? "none" : "flex";
    return;
  }

  if (e.target.id === "dockLeaveRoomBtn") {
    if (connectedCampaignRoom) await leaveCampaignRoom();
    if (activeDMRoomCode) await closeDMCampaignRoom();
    return;
  }

  // Dock member pill click: ONLY opens inspect modal if user is the verified DM of the room
  const dockPill = e.target.closest(".dock-member-pill.dm-clickable");
  if (dockPill && activeDMRoomCode) {
    const memberId = dockPill.dataset.memberId;
    if (memberId) openInspectModal(memberId);
    return;
  }

  // Recent Room Chips (1-Click Rejoin)
  const recentChip = e.target.closest(".recent-room-chip");
  if (recentChip && recentChip.dataset.room) {
    const code = recentChip.dataset.room;
    const dmTabActive = document.getElementById("party-dm-view")?.classList.contains("active");
    if (dmTabActive) {
      await startDMLiveListener(code, false);
    } else {
      await joinCampaignRoom(code);
    }
    return;
  }

  // DM Quick-Adjust Buttons on Player Cards
  const dmQuickBtn = e.target.closest(".dm-quick-btn");
  if (dmQuickBtn) {
    e.stopPropagation();
    const memberId = dmQuickBtn.dataset.memberId;
    const act = dmQuickBtn.dataset.dmAct;
    const delta = parseInt(dmQuickBtn.dataset.delta, 10) || 0;
    await dmQuickAdjustPlayer(memberId, act, delta);
    return;
  }

  if (e.target.id === "authModalBtn" || e.target.closest("#authModalBtn")) {
    setAuthError("");
    document.getElementById("authModal")?.classList.add("open");
    return;
  }

  if (e.target.id === "saveBtn" || e.target.closest("#saveBtn")) {
    saveSheet(false);
    return;
  }

  if (e.target.id === "loadBtn" || e.target.closest("#loadBtn")) {
    renderCharList();
    document.getElementById("loadModal")?.classList.add("open");
    return;
  }

  if (e.target.id === "newBtn" || e.target.closest("#newBtn")) {
    if (confirm("Create a new blank character sheet?")) resetSheet();
    return;
  }

  if (e.target.id === "printSheetBtn" || e.target.closest("#printSheetBtn")) {
    window.print();
    return;
  }

function exportCharacterJson() {
  const roster = getRoster();
  const currentChar = roster[activeCharId] || {
    id: activeCharId,
    name: "Character",
    avatar: myCharacterAvatar,
    fields: getCurrentSheetData(),
    spells: myCharacterSpells,
    traits: myCharacterTraits,
    weapons: myCharacterWeapons,
    customResources: myCustomResources,
    structuredInventory: myStructuredInventory,
    companions: myCompanions,
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
  showStatus("Character JSON Exported");
}

  // Export Character JSON (from menu, modal, or shortcut)
  if (e.target.id === "exportJsonMenuItem" || e.target.closest("#exportJsonMenuItem") ||
      e.target.id === "modalExportJsonBtn" || e.target.closest("#modalExportJsonBtn") ||
      e.target.id === "backupBtn" || e.target.closest("#backupBtn")) {
    exportCharacterJson();
    document.getElementById("exportDropdownMenu")?.classList.remove("open");
    document.getElementById("exportBtn")?.setAttribute("aria-expanded", "false");
    return;
  }

  // Toggle Export Dropdown Menu
  if (e.target.id === "exportBtn" || e.target.closest("#exportBtn")) {
    const menu = document.getElementById("exportDropdownMenu");
    const btn = document.getElementById("exportBtn");
    if (menu) {
      const isOpen = menu.classList.toggle("open");
      if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
    return;
  }

  // Export Statblock Formats from Dropdown Menu
  const statblockItem = e.target.closest(".export-menu-item[data-format]");
  if (statblockItem) {
    const format = statblockItem.dataset.format || "markdown";
    openDiscordExportModal(format);
    document.getElementById("exportDropdownMenu")?.classList.remove("open");
    document.getElementById("exportBtn")?.setAttribute("aria-expanded", "false");
    return;
  }

  if (e.target.id === "openStatblockModalMenuItem" || e.target.closest("#openStatblockModalMenuItem")) {
    openDiscordExportModal("markdown");
    document.getElementById("exportDropdownMenu")?.classList.remove("open");
    document.getElementById("exportBtn")?.setAttribute("aria-expanded", "false");
    return;
  }

  // Close Export Dropdown if clicked outside
  if (!e.target.closest(".export-dropdown-wrapper")) {
    const menu = document.getElementById("exportDropdownMenu");
    if (menu && menu.classList.contains("open")) {
      menu.classList.remove("open");
      document.getElementById("exportBtn")?.setAttribute("aria-expanded", "false");
    }
  }

  if (e.target.id === "importHubBtn" || e.target.closest("#importHubBtn")) {
    const pTxt = document.getElementById("parchmentJsonInput");
    const dTxt = document.getElementById("dndbeyondJsonInput");
    const rTxt = document.getElementById("roll20JsonInput");
    if (pTxt) pTxt.value = "";
    if (dTxt) dTxt.value = "";
    if (rTxt) rTxt.value = "";
    document.getElementById("importHubModal")?.classList.add("open");
    return;
  }

  if (e.target.id === "deleteBtn" || e.target.closest("#deleteBtn")) {
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
    return;
  }

  if (e.target.id === "cancelImportHubBtn" || e.target.closest("#cancelImportHubBtn") || e.target.id === "cancelDnDBeyondBtn") {
    closeModal("importHubModal");
    return;
  }

  if (e.target.id === "parseParchmentBtn") {
    const txt = document.getElementById("parchmentJsonInput")?.value.trim();
    if (!txt) return alert("Please paste the character JSON or select a file first.");
    try {
      importFromPconParchment(JSON.parse(txt));
      closeModal("importHubModal");
    } catch (err) {
      alert("Invalid JSON format. Please verify the copied text.");
    }
    return;
  }

  if (e.target.id === "parseDnDBeyondBtn") {
    const txt = document.getElementById("dndbeyondJsonInput")?.value.trim();
    if (!txt) return alert("Please paste the D&D Beyond character JSON or select a file first.");
    try {
      importFromDnDBeyond(JSON.parse(txt));
      closeModal("importHubModal");
    } catch (err) {
      alert("Invalid D&D Beyond JSON format. Please verify the copied text.");
    }
    return;
  }

  if (e.target.id === "parseRoll20Btn") {
    const txt = document.getElementById("roll20JsonInput")?.value.trim();
    if (!txt) return alert("Please paste the JSON first.");
    try {
      importFromGenericOrRoll20(JSON.parse(txt));
      closeModal("importHubModal");
    } catch (err) {
      alert("Invalid JSON format.");
    }
    return;
  }

  // Compendium & Custom Additions
  if (e.target.id === "addSpellBtn" || e.target.closest("#addSpellBtn") || e.target.closest(".btn-add-spell")) {
    e.preventDefault();
    openSpellModal();
    return;
  }

  if (e.target.id === "addTraitBtn" || e.target.closest("#addTraitBtn")) {
    e.preventDefault();
    openTraitModal();
    return;
  }

  if (e.target.id === "addCustomSpellBtn" || e.target.closest("#addCustomSpellBtn")) {
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
    return;
  }

  if (e.target.id === "addCustomTraitBtn" || e.target.closest("#addCustomTraitBtn")) {
    myCharacterTraits.push({
      name: "New Ability",
      type: "Class Feature",
      desc: "",
      isExpanded: true
    });
    saveSheet(false);
    renderMyTraits();
    closeModal("traitModal");
    return;
  }

  // Custom Resource Counter Add / Delete
  if (e.target.id === "addCustomResourceBtn") {
    myCustomResources.push({ name: "Counter", cur: 3, max: 3 });
    renderCustomResources();
    saveSheet(false);
    return;
  }
  if (e.target.classList.contains("custom-res-del")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCustomResources.splice(idx, 1);
    renderCustomResources();
    saveSheet(false);
    return;
  }

  // Structured Inventory Add / Delete
  if (e.target.id === "addInventoryItemBtn") {
    myStructuredInventory.push({ equipped: true, name: "", qty: 1, weight: 1 });
    renderStructuredInventory();
    saveSheet(false);
    return;
  }
  if (e.target.classList.contains("inv-item-delete")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myStructuredInventory.splice(idx, 1);
    renderStructuredInventory();
    saveSheet(false);
    return;
  }

  // Companions Add / Delete
  if (e.target.id === "addCompanionBtn") {
    myCompanions.push({
      name: "New Companion / Creature",
      type: "Beast (CR 1/4)",
      ac: 13,
      hp: "15 / 15",
      speed: "40 ft.",
      notes: "STR 12 (+1) DEX 15 (+2) CON 12 (+1)\nKeen Hearing and Smell. Bite: +4 to hit, 1d6+2 piercing."
    });
    renderCompanions();
    saveSheet(false);
    showStatus("Creature Added!");
    return;
  }
  if (e.target.classList.contains("companion-delete-btn")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCompanions.splice(idx, 1);
    renderCompanions();
    saveSheet(false);
    return;
  }

  // Turn Economy Reset
  if (e.target.id === "resetTurnEconomyBtn") {
    ["econ_action", "econ_bonus", "econ_reaction", "econ_move"].forEach((id) => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    });
    saveSheet(true);
    showStatus("New Turn Started!");
    return;
  }

  // Pick Spell from Compendium
  const spellRow = e.target.closest(".spell-pick-row");
  if (spellRow) {
    const name = spellRow.dataset.name;
    const url = spellRow.dataset.url;
    const detail = allSpellsCache.find((s) => s.name.toLowerCase() === name.toLowerCase());

    const newSpell = {
      name: detail?.name || name,
      type: detail?.type || detail?.levelTag || "Cantrip",
      casting_time: detail?.casting_time || "1 Action",
      range: detail?.range || "30 ft",
      duration: detail?.duration || "Instantaneous",
      desc: detail?.desc || ""
    };
    myCharacterSpells.push(newSpell);

    saveSheet(false);
    renderMySpells();
    closeModal("spellModal");
    showStatus(`Added ${name}!`);

    if (url && (!detail || !detail.desc)) {
      fetchAPI("https://www.dnd5eapi.co" + url).then((fetched) => {
        if (fetched && fetched.desc && !newSpell.desc) {
          newSpell.desc = Array.isArray(fetched.desc) ? fetched.desc.join("\n\n") : (fetched.desc || "");
          if (fetched.casting_time) newSpell.casting_time = fetched.casting_time;
          if (fetched.range) newSpell.range = fetched.range;
          if (fetched.duration) newSpell.duration = fetched.duration;
          saveSheet(true);
          renderMySpells();
        }
      }).catch(() => {});
    }
    return;
  }

  // Pick Trait from Compendium
  const traitRow = e.target.closest(".trait-pick-row");
  if (traitRow) {
    const name = traitRow.dataset.name;
    const url = traitRow.dataset.url;
    const detail = allTraitsCache.find((t) => t.name.toLowerCase() === name.toLowerCase());

    const newTrait = {
      name: detail?.name || name,
      type: detail?.type || traitRow.dataset.type || "Feature",
      desc: detail?.desc || "",
      isExpanded: false
    };
    myCharacterTraits.push(newTrait);

    saveSheet(false);
    renderMyTraits();
    closeModal("traitModal");
    showStatus(`Added ${name}!`);

    if (url && (!detail || !detail.desc)) {
      fetchAPI("https://www.dnd5eapi.co" + url).then((fetched) => {
        if (fetched && fetched.desc && !newTrait.desc) {
          newTrait.desc = Array.isArray(fetched.desc) ? fetched.desc.join("\n\n") : (fetched.desc || "");
          saveSheet(true);
          renderMyTraits();
        }
      }).catch(() => {});
    }
    return;
  }

  // Auth Buttons
  if (e.target.id === "emailLoginBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    const email = document.getElementById("authEmail")?.value.trim();
    const pass = document.getElementById("authPassword")?.value;
    if (!email || !pass) return setAuthError("Please enter your email and password.");
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showStatus("Logged In!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
    return;
  }

  if (e.target.id === "emailSignUpBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    const email = document.getElementById("authEmail")?.value.trim();
    const pass = document.getElementById("authPassword")?.value;
    if (!email || !pass) return setAuthError("Please enter an email and password.");
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      showStatus("Account Created!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
    return;
  }

  if (e.target.id === "googleLoginBtn") {
    if (!auth) return setAuthError("Firebase is not initialized.");
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      showStatus("Logged In!");
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      setAuthError(err.message);
    }
    return;
  }

  if (e.target.id === "logoutBtn") {
    if (!auth) return;
    await auth.signOut();
    currentUser = null;
    showStatus("Signed Out");
    document.getElementById("authModal")?.classList.remove("open");
    return;
  }

  // Party Room Actions
  if (e.target.id === "joinCampaignBtn" || e.target.closest("#joinCampaignBtn")) {
    const input = document.getElementById("campaignRoomInput");
    if (input && input.value.trim()) {
      await joinCampaignRoom(input.value.trim());
    } else {
      alert("Please enter a room code (e.g. REALM-4200).");
    }
    return;
  }

  if (e.target.id === "leaveCampaignBtn" || e.target.closest("#leaveCampaignBtn")) {
    await leaveCampaignRoom();
    return;
  }

  if (e.target.id === "createCampaignBtn" || e.target.closest("#createCampaignBtn")) {
    await createNewCampaignRoom();
    return;
  }

  if (e.target.id === "copyRoomCodeBtn" || e.target.closest("#copyRoomCodeBtn") || e.target.id === "dmQuickCopyIconBtn" || e.target.closest("#dmQuickCopyIconBtn")) {
    const code = document.getElementById("dmActiveRoomCode")?.textContent?.trim();
    if (code && code !== "NONE") {
      navigator.clipboard.writeText(code).then(() => showStatus(`Room Code ${code} Copied!`));
    }
    return;
  }

  if (e.target.id === "copyPlayerRoomCodeBtn" || e.target.closest("#copyPlayerRoomCodeBtn")) {
    const code = connectedCampaignRoom;
    if (code) {
      navigator.clipboard.writeText(code).then(() => showStatus(`Room Code ${code} Copied!`));
    }
    return;
  }

  if (e.target.id === "dmRandomizeCodeBtn" || e.target.closest("#dmRandomizeCodeBtn")) {
    const prefixes = ["REALM", "VALOR", "QUEST", "HAVEN", "CODEX", "DRAGON", "FORGE", "MYTH", "NEXUS", "SHADOW"];
    const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const input = document.getElementById("dmRoomCodeInput");
    if (input) {
      input.value = `${pre}-${num}`;
      input.focus();
    }
    return;
  }

  if (e.target.id === "dmToggleCreateOtherBtn" || e.target.closest("#dmToggleCreateOtherBtn")) {
    const createCard = document.getElementById("dmCreateRoomCard");
    const toggleBtn = document.getElementById("dmToggleCreateOtherBtn");
    if (createCard) {
      const isVisible = createCard.style.display !== "none" && createCard.style.display !== "";
      createCard.style.display = isVisible ? "none" : "block";
      if (toggleBtn) {
        toggleBtn.innerHTML = isVisible ? "<span>➕</span> Host a different room" : "<span>✖</span> Hide room creator";
      }
      if (!isVisible) {
        createCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
    return;
  }

  const emptyCopyCode = e.target.closest(".dm-empty-copy-code-btn");
  if (emptyCopyCode) {
    const code = emptyCopyCode.dataset.room || activeDMRoomCode;
    if (code) {
      navigator.clipboard.writeText(code).then(() => showStatus(`Room Code ${code} Copied!`));
    }
    return;
  }

  const emptyCopyLink = e.target.closest(".dm-empty-copy-link-btn");
  if (emptyCopyLink) {
    const code = emptyCopyLink.dataset.room || activeDMRoomCode;
    if (code) {
      copyRoomInviteLink(code);
    }
    return;
  }

  if (e.target.id === "closeCampaignBtn" || e.target.closest("#closeCampaignBtn")) {
    await closeDMCampaignRoom();
    return;
  }

  const dmPlayerCard = e.target.closest(".dm-player-card");
  if (dmPlayerCard && activeDMRoomCode) {
    const memberId = dmPlayerCard.dataset.memberId;
    if (memberId) openInspectModal(memberId);
    return;
  }

  if (e.target.id === "inspectKickBtn") {
    if (currentInspectedMemberId) {
      await kickPlayerFromRoom(currentInspectedMemberId);
    }
    return;
  }

  // Avatar Click
  if (e.target.id === "avatarFrame" || e.target.closest("#avatarFrame")) {
    document.getElementById("avatarFileInput")?.click();
    return;
  }

  // Quick Inline HP Steppers (-1 / +1)
  if (e.target.id === "quickHpMinusBtn") {
    applyQuickHpStep(-1);
    return;
  }
  if (e.target.id === "quickHpPlusBtn") {
    applyQuickHpStep(1);
    return;
  }

  // HP Calculator Modal Actions
  if (
    e.target.id === "openHpModalBtn" ||
    e.target.closest("#openHpModalBtn") ||
    e.target.id === "hpTitleClick" ||
    e.target.closest("#hpTitleClick") ||
    e.target.id === "heroHealthStrip" ||
    e.target.closest("#heroHealthStrip") ||
    e.target.classList.contains("hp-corner-btn") ||
    e.target.closest(".hp-corner-btn")
  ) {
    const amtInput = document.getElementById("hpModalAmount");
    if (amtInput) amtInput.value = "";
    document.getElementById("hpModal")?.classList.add("open");
    setTimeout(() => amtInput?.focus(), 50);
    return;
  }

  const hpPresetBtn = e.target.closest(".hp-preset-btn");
  if (hpPresetBtn) {
    const addVal = parseInt(hpPresetBtn.dataset.val, 10) || 0;
    const amtInput = document.getElementById("hpModalAmount");
    if (amtInput) {
      const cur = parseInt(amtInput.value, 10) || 0;
      amtInput.value = cur + addVal;
    }
    return;
  }

  if (e.target.id === "hpApplyDamageBtn") {
    applyHpAdjustment("damage");
    return;
  }
  if (e.target.id === "hpApplyHealBtn") {
    applyHpAdjustment("heal");
    return;
  }
  if (e.target.id === "hpApplyTempBtn") {
    applyHpAdjustment("temp");
    return;
  }

  // Rest Actions
  if (e.target.id === "shortRestBtn" || e.target.closest("#shortRestBtn")) {
    applyShortRest();
    return;
  }
  if (e.target.id === "longRestBtn" || e.target.closest("#longRestBtn")) {
    applyLongRest();
    return;
  }

  // Spell Slot Pip Click
  if (e.target.classList.contains("slot-pip")) {
    const lvl = parseInt(e.target.dataset.slotLvl, 10);
    const pipIdx = parseInt(e.target.dataset.pipIdx, 10);
    const curEl = document.getElementById(`slot${lvl}_cur`);
    if (curEl) {
      let curVal = parseInt(curEl.value, 10) || 0;
      if (e.target.classList.contains("active")) {
        curVal = Math.max(0, pipIdx);
      } else {
        curVal = Math.max(curVal, pipIdx + 1);
      }
      curEl.value = curVal;
      updateSlotPips(lvl);
      saveSheet(true);
    }
    return;
  }

  // Blur Toggle
  const blurBtn = e.target.closest(".blur-toggle-btn");
  if (blurBtn) {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = blurBtn.closest("[data-blur-id]");
    if (wrapper) {
      wrapper.classList.toggle("blurred");
      const blurId = wrapper.dataset.blurId;
      if (wrapper.classList.contains("blurred")) {
        if (!myBlurredPills.includes(blurId)) myBlurredPills.push(blurId);
        wrapper.querySelectorAll(".dropdown-menu").forEach((d) => d.classList.remove("open"));
      } else {
        myBlurredPills = myBlurredPills.filter((id) => id !== blurId);
      }
      saveSheet(true);
    }
    return;
  }

  // Close dropdowns when clicking outside
  if (!e.target.closest(".dropdown-pill-wrapper")) {
    document.querySelectorAll(".dropdown-menu").forEach((d) => d.classList.remove("open"));
  }

  if (e.target.classList.contains("select-class-item")) {
    const classInput = document.getElementById("charClass");
    if (classInput) {
      classInput.value = e.target.dataset.name;
      saveSheet(false);
    }
    document.getElementById("classDropdown")?.classList.remove("open");
    return;
  }

  if (e.target.classList.contains("select-race-item")) {
    const raceInput = document.getElementById("charRace");
    if (raceInput) {
      raceInput.value = e.target.dataset.name;
      saveSheet(false);
    }
    document.getElementById("raceDropdown")?.classList.remove("open");
    return;
  }

  // Conditions Chips & Clear All
  if (e.target.id === "clearConditionsBtn") {
    myActiveConditions = [];
    renderConditionChips();
    closeConditionExplainer();
    saveSheet(false);
    showStatus("All Conditions Cleared");
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
    openConditionExplainer(cond);
    saveSheet(true);
    return;
  }

  // Condition Explainer Controls
  if (e.target.id === "condExplainerCloseBtn") {
    closeConditionExplainer();
    return;
  }
  if (e.target.id === "condExplainerToggleBtn") {
    toggleConditionFromExplainer();
    return;
  }

  // Discord Statblock Exporter Modal Trigger & Formatting Tabs
  if (e.target.id === "discordExportBtn" || e.target.closest("#discordExportBtn")) {
    openDiscordExportModal();
    return;
  }
  const discordTab = e.target.closest(".discord-format-tabs .sub-tab");
  if (discordTab && discordTab.dataset.format) {
    document.querySelectorAll(".discord-format-tabs .sub-tab").forEach((t) => t.classList.remove("active"));
    discordTab.classList.add("active");
    activeDiscordFormat = discordTab.dataset.format;
    renderDiscordExport();
    return;
  }
  if (e.target.id === "copyDiscordStatblockBtn") {
    const textEl = document.getElementById("discordStatblockText");
    if (textEl) {
      navigator.clipboard.writeText(textEl.value).then(() => {
        showStatus("Copied Discord Statblock to clipboard!");
      }).catch(() => {
        textEl.select();
        document.execCommand("copy");
        showStatus("Copied to clipboard!");
      });
    }
    return;
  }

  // Master Admin Panel Trigger Controls
  if (e.target.id === "topNavAdminBtn" || e.target.closest("#topNavAdminBtn") || e.target.id === "openAdminFromAuthModalBtn" || e.target.closest("#openAdminFromAuthModalBtn")) {
    openAdminModal();
    return;
  }
  if (e.target.id === "closeAdminModal" || e.target.closest("#closeAdminModal")) {
    closeAdminModal();
    return;
  }
  const adminTabBtn = e.target.closest(".admin-tab-btn");
  if (adminTabBtn && adminTabBtn.dataset.tab) {
    switchAdminTab(adminTabBtn.dataset.tab);
    return;
  }
  const adminInspectBtn = e.target.closest(".admin-inspect-room-btn");
  if (adminInspectBtn && adminInspectBtn.dataset.room) {
    inspectAdminRoom(adminInspectBtn.dataset.room);
    return;
  }
  const adminOpenChatBtn = e.target.closest(".admin-open-chat-room-btn");
  if (adminOpenChatBtn && adminOpenChatBtn.dataset.room) {
    const roomCode = adminOpenChatBtn.dataset.room.trim().toUpperCase();
    isJoinedViaAdminPanel = true;
    try { sessionStorage.setItem("admin_joined_room_" + roomCode, "true"); } catch (err) {}
    closeAdminModal();
    switchAdminChatRoom(roomCode);
    toggleFloatingPartyChat(true);
    showStatus(`Admin: Opened party chat for "${roomCode}"`);
    return;
  }
  if (e.target.id === "adminModalOpenPartyChatBtn" || e.target.closest("#adminModalOpenPartyChatBtn")) {
    isJoinedViaAdminPanel = true;
    closeModal("partyModal");
    openAdminChatWithoutRoom();
    return;
  }
  if (e.target.id === "adminQuickSwitchCampaignPill" || e.target.closest("#adminQuickSwitchCampaignPill")) {
    const select = document.getElementById("adminChatCampaignSelect");
    if (select) {
      select.focus();
      if (typeof select.showPicker === "function") {
        try { select.showPicker(); } catch (err) {}
      }
    }
    return;
  }
  const adminJoinBtn = e.target.closest(".admin-join-room-btn");
  if (adminJoinBtn && adminJoinBtn.dataset.room) {
    const roomCode = adminJoinBtn.dataset.room.trim().toUpperCase();
    isJoinedViaAdminPanel = true;
    try { sessionStorage.setItem("admin_joined_room_" + roomCode, "true"); } catch (err) {}
    closeAdminModal();
    switchAdminChatRoom(roomCode);
    toggleFloatingPartyChat(true);
    showStatus(`Admin: Opened party chat for "${roomCode}"`);
    return;
  }
  const adminDeleteBtn = e.target.closest(".admin-delete-room-btn");
  if (adminDeleteBtn && adminDeleteBtn.dataset.room) {
    e.preventDefault();
    e.stopPropagation();
    deleteAdminRoom(adminDeleteBtn.dataset.room);
    return;
  }
  if (e.target.id === "globalNoticeCloseBtn" || e.target.closest("#globalNoticeCloseBtn")) {
    dismissGlobalSiteNotice(true);
    return;
  }
  if (e.target.id === "adminClearTopNoticeBtn" || e.target.closest("#adminClearTopNoticeBtn")) {
    clearActiveTopNoticeBanner();
    return;
  }
  const adminPresetBtn = e.target.closest(".admin-preset-time-btn");
  if (adminPresetBtn && adminPresetBtn.dataset.preset) {
    const preset = adminPresetBtn.dataset.preset;
    let msToAdd = 15000;
    if (preset === "15s") msToAdd = 15000;
    else if (preset === "5m") msToAdd = 5 * 60 * 1000;
    else if (preset === "15m") msToAdd = 15 * 60 * 1000;
    else if (preset === "1h") msToAdd = 60 * 60 * 1000;
    else if (preset === "24h") msToAdd = 24 * 60 * 60 * 1000;

    const targetDate = new Date(Date.now() + msToAdd);
    const endInput = document.getElementById("adminNoticeEndTime");
    if (endInput) {
      endInput.value = formatDateTimeLocal(targetDate);
    }
    return;
  }
  if (e.target.id === "adminCloseDrawerBtn" || e.target.closest("#adminCloseDrawerBtn")) {
    const drawer = document.getElementById("adminRoomDetailDrawer");
    if (drawer) drawer.style.display = "none";
    document.querySelectorAll(".admin-room-item").forEach(item => item.classList.remove("is-inspecting"));
    return;
  }
  if (e.target.id === "adminFetchRoomsBtn" || e.target.id === "adminQuickScanRoomsBtn") {
    switchAdminTab("adminTabCampaigns");
    loadAdminCampaigns();
    return;
  }
  if (e.target.id === "adminRefreshStatsBtn" || e.target.id === "adminRefreshUsersBtn") {
    loadAdminOverview();
    startAdminPresenceListener();
    showStatus("Refreshed live user presence!");
    return;
  }
  const presenceFilterBtn = e.target.closest("[data-presence-filter]");
  if (presenceFilterBtn) {
    document.querySelectorAll("[data-presence-filter]").forEach((b) => b.classList.remove("active"));
    presenceFilterBtn.classList.add("active");
    activePresenceFilter = presenceFilterBtn.dataset.presenceFilter || "all";
    renderAdminPresenceUI();
    return;
  }
  if (e.target.id === "adminQuickExportDumpBtn" || e.target.id === "adminFullDumpBtn") {
    exportMasterJsonDump();
    return;
  }
  if (e.target.id === "adminPingBtn") {
    benchmarkFirestoreLatency();
    return;
  }
  const removeEmailBtn = e.target.closest(".admin-remove-email-btn");
  if (removeEmailBtn && removeEmailBtn.dataset.email) {
    removeAdditionalAdminEmail(removeEmailBtn.dataset.email);
    return;
  }
  if (e.target.id === "adminAddEmailBtn") {
    const input = document.getElementById("adminNewEmailInput");
    if (input) {
      addAdditionalAdminEmail(input.value);
      input.value = "";
    }
    return;
  }

  // Live Party Chat Controls
  if (e.target.id === "bottomLeftPartyChatBtn" || e.target.closest("#bottomLeftPartyChatBtn") || e.target.id === "dockChatToggleBtn" || e.target.closest("#dockChatToggleBtn")) {
    toggleFloatingPartyChat();
    return;
  }
  if (e.target.id === "floatingChatCloseBtn" || e.target.closest("#floatingChatCloseBtn")) {
    toggleFloatingPartyChat(false);
    return;
  }
  if (e.target.id === "floatingChatExpandBtn" || e.target.closest("#floatingChatExpandBtn")) {
    toggleFloatingChatExpanded();
    return;
  }
  if (e.target.id === "chatCreateChannelBtn" || e.target.closest("#chatCreateChannelBtn")) {
    openCreateChannelModal();
    return;
  }
  if (e.target.id === "closeCreateChatModalBtn" || e.target.closest("#closeCreateChatModalBtn") || e.target.id === "cancelCreateChatBtn" || e.target.closest("#cancelCreateChatBtn")) {
    closeCreateChannelModal();
    return;
  }
  if (e.target.id === "confirmCreateChatBtn" || e.target.closest("#confirmCreateChatBtn")) {
    confirmCreateChannel();
    return;
  }
  const clickedChanPill = e.target.closest(".chat-chan-pill");
  if (clickedChanPill && clickedChanPill.dataset.chanId) {
    switchPartyChannel(clickedChanPill.dataset.chanId);
    return;
  }
  if (e.target.id === "floatingChatShareRollBtn" || e.target.id === "partyModalShareRollBtn") {
    shareLastRollToPartyChat();
    return;
  }

  // Party Handouts System Controls
  if (e.target.id === "handoutsConnectPartyBtn" || e.target.closest("#handoutsConnectPartyBtn")) {
    openPartyModal();
    return;
  }
  if (e.target.id === "createHandoutBtn") {
    const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
    if (!activeRoom) {
      showStatus("Please join or host a party before creating party handouts.");
      openPartyModal();
      return;
    }
    openHandoutEditor();
    return;
  }
  if (e.target.id === "dmQuickHandoutBtn" || e.target.id === "dockDmHandoutBtn" || e.target.closest("#dockDmHandoutBtn")) {
    const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
    if (!activeRoom) {
      showStatus("Please join or host a party before creating party handouts.");
      openPartyModal();
      return;
    }
    closeModal("partyModal");
    openHandoutEditor();
    return;
  }
  const handoutFilterChip = e.target.closest(".handout-filter-chip");
  if (handoutFilterChip && handoutFilterChip.dataset.filter) {
    document.querySelectorAll(".handout-filter-chip").forEach((c) => c.classList.remove("active"));
    handoutFilterChip.classList.add("active");
    activeHandoutFilter = handoutFilterChip.dataset.filter;
    renderHandoutsGrid();
    return;
  }
  const claimWeaponBtn = e.target.closest(".claim-weapon-btn");
  if (claimWeaponBtn && claimWeaponBtn.dataset.id) {
    claimHandoutWeapon(claimWeaponBtn.dataset.id);
    return;
  }
  const claimItemBtn = e.target.closest(".claim-item-btn");
  if (claimItemBtn && claimItemBtn.dataset.id) {
    claimHandoutItem(claimItemBtn.dataset.id, 1);
    return;
  }
  const claimCoinsBtn = e.target.closest(".claim-coins-btn");
  if (claimCoinsBtn && claimCoinsBtn.dataset.id) {
    claimHandoutCoins(claimCoinsBtn.dataset.id);
    return;
  }
  if (e.target.id === "parchmentClaimBtn") {
    const id = e.target.dataset.id;
    const type = e.target.dataset.type;
    if (type === "weapon") claimHandoutWeapon(id);
    else if (type === "item") claimHandoutItem(id, 1);
    else if (type === "coin") claimHandoutCoins(id);
    return;
  }
  const openHandoutBtn = e.target.closest(".open-handout-btn");
  if (openHandoutBtn && openHandoutBtn.dataset.id) {
    openHandoutViewer(openHandoutBtn.dataset.id);
    return;
  }
  const deleteHandoutBtn = e.target.closest(".delete-handout-btn");
  if (deleteHandoutBtn && deleteHandoutBtn.dataset.id) {
    deleteHandout(deleteHandoutBtn.dataset.id);
    return;
  }
  const openSharedBtn = e.target.closest(".open-shared-handout-btn");
  if (openSharedBtn && openSharedBtn.dataset.handoutId) {
    openHandoutViewer(openSharedBtn.dataset.handoutId);
    return;
  }
  if (e.target.id === "editCurrentHandoutBtn") {
    const id = e.target.dataset.id;
    openHandoutEditor(id);
    return;
  }
  if (e.target.id === "shareCurrentHandoutBtn") {
    const id = e.target.dataset.id;
    shareHandoutToParty(id);
    return;
  }
  if (e.target.id === "copyHandoutTextBtn") {
    const text = document.getElementById("parchmentContent")?.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      showStatus("Copied handout text to clipboard!");
    });
    return;
  }
  // Category visual nav tab click
  const catBtn = e.target.closest(".handout-cat-btn");
  if (catBtn && catBtn.dataset.type) {
    const typeSelect = document.getElementById("handoutFormType");
    if (typeSelect) {
      typeSelect.value = catBtn.dataset.type;
      updateHandoutFormVisibility();
    }
    return;
  }

  // Quick preset template chip click
  const presetChip = e.target.closest(".handout-preset-chip");
  if (presetChip && presetChip.dataset.presetIndex !== undefined) {
    const pIdx = parseInt(presetChip.dataset.presetIndex, 10);
    applyLootPreset(pIdx);
    return;
  }

  // Recipient chip click
  const recipChip = e.target.closest(".recipient-chip");
  if (recipChip) {
    document.querySelectorAll(".recipient-chip").forEach((c) => c.classList.remove("active"));
    recipChip.classList.add("active");
    const rVal = recipChip.dataset.recipient || "all";
    const sel = document.getElementById("handoutFormRecipient");
    if (sel) {
      sel.value = rVal;
    }
    return;
  }

  // Coin quick add buttons
  const coinQuickBtn = e.target.closest(".coin-quick-btn");
  if (coinQuickBtn && coinQuickBtn.dataset.addGp) {
    const add = parseInt(coinQuickBtn.dataset.addGp, 10) || 0;
    const gpInput = document.getElementById("handoutCoinGP");
    if (gpInput) {
      gpInput.value = (parseInt(gpInput.value, 10) || 0) + add;
      updateHandoutCoinSplit();
    }
    return;
  }

  if (e.target.id === "clearHandoutCoinsBtn") {
    ["handoutCoinCP", "handoutCoinSP", "handoutCoinEP", "handoutCoinGP", "handoutCoinPP"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = 0;
    });
    updateHandoutCoinSplit();
    return;
  }

  if (e.target.id === "handoutGiftFromSheetBtn") {
    openHandoutGiftPicker();
    return;
  }

  if (e.target.id === "saveDraftHandoutBtn") {
    saveHandoutFromForm(true);
    return;
  }

  if (e.target.id === "cancelHandoutEditBtn") {
    closeModal("handoutModal");
    return;
  }
  if (e.target.id === "saveHandoutBtn") {
    saveHandoutFromForm(false);
    return;
  }

  // Floating D20 Dice Roller Toggle
  if (e.target.id === "floatingD20RollerBtn" || e.target.closest("#floatingD20RollerBtn")) {
    toggleDiceRoller();
    return;
  }

  // Close Dice Station Button
  if (e.target.id === "closeDiceStationBtn" || e.target.closest("#closeDiceStationBtn")) {
    toggleDiceRoller(false);
    return;
  }

  // Dice Mode Toggle (ADV / NORM / DIS)
  const modeBtn = e.target.closest(".dice-mode-btn");
  if (modeBtn) {
    currentDiceMode = modeBtn.dataset.mode || "norm";
    document.querySelectorAll(".dice-mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === currentDiceMode);
    });
    return;
  }

  // Clear Dice History
  if (e.target.id === "clearDiceHistoryBtn") {
    diceRollHistory = [];
    renderDiceHistory();
    return;
  }

  // Roll Custom Formula Button
  if (e.target.id === "rollFormulaBtn") {
    const input = document.getElementById("customDiceFormulaInput");
    if (input && input.value.trim()) {
      rollCustomFormula(input.value.trim());
    }
    return;
  }

  // Roll Initiative Orb
  if (e.target.id === "rollInitiativeOrb" || e.target.closest("#rollInitiativeOrb")) {
    if (e.target.id === "initBonusMod") return;
    const bonus = parseInt(document.getElementById("initiativeDisplay")?.textContent, 10) || 0;
    performD20Roll(bonus, "Initiative");
    return;
  }

  // Roll Death Save Button
  if (e.target.id === "rollDeathSaveBtn") {
    const { chosen } = performD20Roll(0, "Death Save");
    const succEl = document.getElementById("deathSucc");
    const failEl = document.getElementById("deathFail");
    if (chosen === 20) {
      const curHpEl = document.getElementById("curHp");
      if (curHpEl && parseInt(curHpEl.value, 10) <= 0) curHpEl.value = 1;
      if (succEl) succEl.value = 0;
      if (failEl) failEl.value = 0;
      showStatus("NATURAL 20! You regain 1 HP!");
    } else if (chosen === 1) {
      if (failEl) failEl.value = Math.min(3, (parseInt(failEl.value, 10) || 0) + 2);
      showStatus("Natural 1! 2 Death Save Failures!");
    } else if (chosen >= 10) {
      if (succEl) succEl.value = Math.min(3, (parseInt(succEl.value, 10) || 0) + 1);
    } else {
      if (failEl) failEl.value = Math.min(3, (parseInt(failEl.value, 10) || 0) + 1);
    }
    recalculateAll();
    saveSheet(true);
    return;
  }

  // Standard Dice Rack Buttons
  if (e.target.classList.contains("dice-btn")) {
    const sides = parseInt(e.target.dataset.sides, 10);
    if (sides === 20) {
      performD20Roll(0, "1d20");
    } else {
      const roll = Math.floor(Math.random() * sides) + 1;
      updateDiceBadgeDisplay(roll, `1d${sides}`);
      addDiceHistory(`1d${sides}`, roll);
    }
    return;
  }

  // Skill, Save, and Ability Check Roll Buttons
  const rollTrigger = e.target.closest(".roll-btn");
  if (rollTrigger) {
    let bonus = 0;
    let label = "Check";

    if (rollTrigger.dataset.type === "save") {
      const attr = rollTrigger.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (rollTrigger.dataset.type === "check") {
      const attr = rollTrigger.dataset.attr;
      bonus = parseInt(document.getElementById(`mod_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Check`;
    } else if (rollTrigger.dataset.type === "skill") {
      const row = rollTrigger.closest(".skill-row");
      bonus = parseInt(row?.querySelector(".skill-val")?.textContent, 10) || 0;
      label = row?.querySelector(".skill-label")?.textContent.trim() || "Skill";
    }

    performD20Roll(bonus, label);
    return;
  }

  // Weapons Add / Delete
  if (e.target.id === "addWeaponBtn" || e.target.closest("#addWeaponBtn") || e.target.closest(".btn-add-weapon")) {
    if (!Array.isArray(myCharacterWeapons)) myCharacterWeapons = [];
    myCharacterWeapons.push({ name: "", dmg: "", type: "", notes: "" });
    saveSheet(false);
    renderWeapons();
    showStatus("Weapon Added!");
    return;
  }

  if (e.target.classList.contains("weapon-delete-btn") && !e.target.classList.contains("inv-item-delete")) {
    const idx = parseInt(e.target.dataset.index, 10);
    myCharacterWeapons.splice(idx, 1);
    while (myCharacterWeapons.length < 2) {
      myCharacterWeapons.push({ name: "", dmg: "", type: "", notes: "" });
    }
    saveSheet(false);
    renderWeapons();
    return;
  }

  if (e.target.classList.contains("trait-card-delete") && !e.target.classList.contains("companion-delete-btn")) {
    myCharacterTraits.splice(parseInt(e.target.dataset.index, 10), 1);
    saveSheet(false);
    renderMyTraits();
    return;
  }

  if (e.target.classList.contains("trait-expand-btn") || e.target.closest(".trait-expand-btn")) {
    const btn = e.target.closest(".trait-expand-btn");
    const card = btn.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    const isExp = card.classList.contains("expanded");
    btn.innerHTML = `${isExp ? "Collapse" : "Expand"} <span class="trait-expand-icon">&blacktriangledown;</span>`;
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = isExp;
    saveSheet(true);
    return;
  }

  if (e.target.classList.contains("spell-expand-btn") || e.target.closest(".spell-expand-btn")) {
    const btn = e.target.closest(".spell-expand-btn");
    const card = btn.closest(".spell-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    const isExp = card.classList.contains("expanded");
    btn.innerHTML = `${isExp ? "Collapse" : "Expand"} <span class="trait-expand-icon">${isExp ? "&blacktriangle;" : "&blacktriangledown;"}</span>`;
    if (myCharacterSpells[idx]) myCharacterSpells[idx].isExpanded = isExp;
    saveSheet(true);
    return;
  }

  if (e.target.id === "toggleAllTraitsBtn") {
    const shouldExpand = e.target.textContent.includes("Expand");
    myCharacterTraits.forEach((t) => { t.isExpanded = shouldExpand; });
    e.target.textContent = shouldExpand ? "Collapse All" : "Expand All";
    saveSheet(true);
    renderMyTraits();
    return;
  }

  if (e.target.id === "toggleAllSpellsBtn") {
    const shouldExpand = e.target.textContent.includes("Expand");
    myCharacterSpells.forEach((s) => { s.isExpanded = shouldExpand; });
    e.target.textContent = shouldExpand ? "Collapse All" : "Expand All";
    saveSheet(true);
    renderMySpells();
    return;
  }

  if (e.target.classList.contains("spell-card-delete")) {
    myCharacterSpells.splice(parseInt(e.target.dataset.index, 10), 1);
    saveSheet(false);
    renderMySpells();
    return;
  }

  if (e.target.classList.contains("char-delete-btn")) {
    const row = e.target.closest(".char-item-row");
    const roster = getRoster();
    if (confirm(`Permanently delete "${roster[row.dataset.id]?.name || "character"}"?`)) {
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
    return;
  }

  if (e.target.closest(".char-item-info") || e.target.classList.contains("char-select-btn")) {
    const row = e.target.closest(".char-item-row");
    activeCharId = row.dataset.id;
    localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
    applyCharacterData(getRoster()[activeCharId]);
    closeModal("loadModal");
    showStatus("Character Loaded");
    return;
  }

  if (e.target.id === "helpLinkBtn") {
    document.getElementById("helpModal")?.classList.add("open");
    return;
  }
});

/* ==========================================================================
   INPUT, CHANGE & KEYBOARD LISTENERS
   ========================================================================== */

document.getElementById("themeSelect")?.addEventListener("change", (e) => {
  applyTheme(e.target.value);
});

document.getElementById("quickSkillSearch")?.addEventListener("input", () => {
  filterSkillsMatrix();
});

document.getElementById("avatarFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const rawData = evt.target.result;
    const img = new Image();
    img.onload = () => {
      const maxDim = 320;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      myCharacterAvatar = canvas.toDataURL("image/jpeg", 0.82);
      renderAvatar();
      saveSheet(false);
      showStatus("Avatar Updated!");
    };
    img.onerror = () => {
      myCharacterAvatar = rawData;
      renderAvatar();
      saveSheet(false);
      showStatus("Avatar Updated!");
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
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

document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  filterAndRenderSpells(e.target.value);
});

document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  filterAndRenderTraits(e.target.value);
});

document.getElementById("commandPaletteInput")?.addEventListener("input", (e) => {
  renderCommandPaletteResults(e.target.value);
});

document.getElementById("commandPaletteInput")?.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (currentQuickSearchResults.length > 0) {
      quickSearchSelectedIndex = (quickSearchSelectedIndex + 1) % currentQuickSearchResults.length;
      updateQuickSearchSelectionHighlight();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (currentQuickSearchResults.length > 0) {
      quickSearchSelectedIndex = (quickSearchSelectedIndex - 1 + currentQuickSearchResults.length) % currentQuickSearchResults.length;
      updateQuickSearchSelectionHighlight();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (currentQuickSearchResults.length > 0 && currentQuickSearchResults[quickSearchSelectedIndex]) {
      navigateToSearchedThing(currentQuickSearchResults[quickSearchSelectedIndex]);
    }
  }
});

document.getElementById("filterSpellbookInput")?.addEventListener("input", () => {
  renderMySpells();
});

document.getElementById("filterTraitsInput")?.addEventListener("input", () => {
  renderMyTraits();
});

document.getElementById("customDiceFormulaInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    rollCustomFormula(e.target.value.trim());
  }
});

document.getElementById("campaignRoomInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("joinCampaignBtn")?.click();
  }
});

document.getElementById("dmRoomCodeInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("createCampaignBtn")?.click();
  }
});

document.getElementById("hpModalAmount")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyHpAdjustment("damage");
  }
});

document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet(false);
  }
  if (e.target.id === "hitDieSize") {
    saveSheet(true);
  }
  if (e.target.classList.contains("inv-item-field") && e.target.type === "checkbox") {
    const row = e.target.closest(".inv-item-row");
    if (row) {
      const idx = parseInt(row.dataset.index, 10);
      if (myStructuredInventory[idx]) {
        myStructuredInventory[idx].equipped = e.target.checked;
        saveSheet(true);
      }
    }
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field") && e.target.type !== "checkbox") {
    recalculateAll();
    saveSheet(true);

    if (e.target.id && e.target.id.startsWith("slot")) {
      const lvl = e.target.id.replace(/\D/g, "");
      if (lvl) updateSlotPips(lvl);
    }
  }

  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    if (card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterSpells[idx]) {
        myCharacterSpells[idx][e.target.dataset.prop] = e.target.value;
        if (e.target.dataset.prop === "name") {
          const concBtn = card.querySelector(".spell-conc-btn");
          if (concBtn) concBtn.dataset.spellName = e.target.value;
        }
        saveSheet(true);
      }
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

  if (e.target.classList.contains("custom-res-field")) {
    const card = e.target.closest(".custom-res-card");
    if (card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCustomResources[idx]) {
        const prop = e.target.dataset.prop;
        myCustomResources[idx][prop] = prop === "name" ? e.target.value : (parseInt(e.target.value, 10) || 0);
        saveSheet(true);
      }
    }
  }

  if (e.target.classList.contains("inv-item-field") && e.target.type !== "checkbox") {
    const row = e.target.closest(".inv-item-row");
    if (row) {
      const idx = parseInt(row.dataset.index, 10);
      if (myStructuredInventory[idx]) {
        const prop = e.target.dataset.prop;
        myStructuredInventory[idx][prop] = prop === "name" ? e.target.value : (parseFloat(e.target.value) || 0);
        updateWealthAndEncumbrance();
        saveSheet(true);
      }
    }
  }

  if (e.target.classList.contains("companion-field")) {
    const card = e.target.closest(".companion-card");
    if (card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCompanions[idx]) {
        myCompanions[idx][e.target.dataset.prop] = e.target.value;
        saveSheet(true);
      }
    }
  }

  if (e.target.id && e.target.id.startsWith("handoutCoin")) {
    updateHandoutCoinSplit();
  }
  if (e.target.id === "handoutSearchInput") {
    renderHandoutsGrid();
  }
  if (e.target.id === "quickWeaponFilterInput") {
    renderHandoutPresets(e.target.value);
  }
});

document.addEventListener("focusout", (e) => {
  if (
    e.target.classList.contains("save-field") ||
    e.target.classList.contains("custom-spell-field") ||
    e.target.classList.contains("custom-trait-field") ||
    e.target.classList.contains("wpn-field") ||
    e.target.classList.contains("custom-res-field") ||
    e.target.classList.contains("inv-item-field") ||
    e.target.classList.contains("companion-field")
  ) {
    if (e.target.type !== "checkbox") saveSheet(true);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllModals();
    currentInspectedMemberId = null;
    if (isDiceRollerOpen) toggleDiceRoller(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveSheet(false);
  }
});

/* ==========================================================================
   FILE RESTORE & IMPORTER LISTENERS
   ========================================================================== */

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

document.getElementById("parchmentFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      importFromPconParchment(parsed);
      closeModal("importHubModal");
    } catch (err) {
      alert("Invalid PC on Parchment JSON file.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("dndbeyondFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      importFromDnDBeyond(parsed);
      closeModal("importHubModal");
    } catch (err) {
      alert("Invalid D&D Beyond JSON file.");
    }
  };
  reader.readAsText(file);
});

/* ==========================================================================
   5E CONDITIONS EXPLAINER (RULES & MECHANICS ON CLICK)
   ========================================================================== */

const CONDITIONS_DATA = {
  blinded: {
    name: "Blinded",
    icon: "👁️",
    summary: "A blinded creature can't see and automatically fails any ability check that requires sight.",
    rules: [
      "Attack rolls against the creature have Advantage.",
      "The creature's attack rolls have Disadvantage.",
      "Automatically fails any ability check requiring vision or sight."
    ]
  },
  charmed: {
    name: "Charmed",
    icon: "💖",
    summary: "A charmed creature cannot attack the charmer or target them with harmful abilities or magical effects.",
    rules: [
      "Cannot attack the charmer or target the charmer with harmful abilities or magical effects.",
      "The charmer has Advantage on any ability check to interact socially with the creature."
    ]
  },
  deafened: {
    name: "Deafened",
    icon: "🔇",
    summary: "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
    rules: [
      "Automatically fails any ability check that requires hearing.",
      "Unaffected by auditory or verbal spell effects that rely strictly on sound."
    ]
  },
  frightened: {
    name: "Frightened",
    icon: "😱",
    summary: "A frightened creature is overwhelmed by terror from the source of its fear.",
    rules: [
      "Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.",
      "Cannot willingly move closer to the source of its fear."
    ]
  },
  grappled: {
    name: "Grappled",
    icon: "🤼",
    summary: "A grappled creature is held fast. Its speed becomes 0, and it cannot benefit from any speed bonuses.",
    rules: [
      "Speed becomes 0 and cannot benefit from any bonus to its speed.",
      "Condition ends if the grappler is incapacitated or an effect moves the creature out of reach (e.g. Thunderwave)."
    ]
  },
  incapacitated: {
    name: "Incapacitated",
    icon: "💫",
    summary: "An incapacitated creature is unable to act or react in any capacity.",
    rules: [
      "Cannot take any actions or reactions.",
      "Concentration on spells is immediately broken."
    ]
  },
  invisible: {
    name: "Invisible",
    icon: "🌫️",
    summary: "An invisible creature is impossible to see without the aid of magic or a special sense.",
    rules: [
      "Heavily obscured for the purpose of hiding; location can still be detected by noises or tracks.",
      "Attack rolls against the creature have Disadvantage.",
      "The creature's attack rolls have Advantage."
    ]
  },
  paralyzed: {
    name: "Paralyzed",
    icon: "⚡",
    summary: "A paralyzed creature is incapacitated and entirely unable to move or speak.",
    rules: [
      "Incapacitated: cannot take actions or reactions.",
      "Speed is 0 and cannot move or speak.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have Advantage.",
      "Any attack that hits the creature within 5 feet is an automatic Critical Hit!"
    ]
  },
  petrified: {
    name: "Petrified",
    icon: "🗿",
    summary: "Transformed, along with nonmagical objects worn or carried, into an inanimate stone substance.",
    rules: [
      "Incapacitated, unaware of surroundings, ceases aging, and weight multiplies tenfold.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have Advantage.",
      "Resistance to all damage types; immune to poison and disease."
    ]
  },
  poisoned: {
    name: "Poisoned",
    icon: "🧪",
    summary: "A poisoned creature is afflicted by bodily toxins or venom.",
    rules: [
      "Disadvantage on all attack rolls and ability checks."
    ]
  },
  prone: {
    name: "Prone",
    icon: "🛌",
    summary: "The creature is lying flat on the ground.",
    rules: [
      "Only movement option is crawling (costs 1 extra foot per foot moved).",
      "Standing up costs half of total movement speed.",
      "The creature's attack rolls have Disadvantage.",
      "Melee attacks against the creature within 5 feet have Advantage.",
      "Ranged attack rolls against the creature beyond 5 feet have Disadvantage."
    ]
  },
  restrained: {
    name: "Restrained",
    icon: "⛓️",
    summary: "A restrained creature's limbs or body are pinned, bound, or entangled.",
    rules: [
      "Speed becomes 0 and cannot benefit from any bonus to speed.",
      "Attack rolls against the creature have Advantage.",
      "The creature's attack rolls have Disadvantage.",
      "Disadvantage on Dexterity saving throws."
    ]
  },
  stunned: {
    name: "Stunned",
    icon: "💫",
    summary: "A stunned creature is dazed, incapacitated, and unable to react effectively.",
    rules: [
      "Incapacitated: cannot take actions or reactions.",
      "Speed is 0 and can speak only falteringly.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have Advantage."
    ]
  },
  unconscious: {
    name: "Unconscious",
    icon: "💀",
    summary: "An unconscious creature is incapacitated, completely unaware, and in a state of total helplessness.",
    rules: [
      "Incapacitated: cannot take actions or reactions.",
      "Drops whatever it is holding and falls Prone.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have Advantage.",
      "Any attack that hits the creature within 5 feet is an automatic Critical Hit!"
    ]
  },
  exhaustion: {
    name: "Exhaustion",
    icon: "😴",
    summary: "Exhaustion is measured in six cumulative levels. A Long Rest reduces exhaustion by 1 level if food and water were consumed.",
    rules: [
      "Level 1: Disadvantage on ability checks",
      "Level 2: Speed halved",
      "Level 3: Disadvantage on attack rolls and saving throws",
      "Level 4: Hit point maximum halved",
      "Level 5: Speed reduced to 0",
      "Level 6: Immediate Death"
    ]
  }
};

function openConditionExplainer(condKey) {
  const card = document.getElementById("conditionExplainerCard");
  const data = CONDITIONS_DATA[condKey];
  if (!card || !data) return;

  currentExplainingCondition = condKey;
  const exhVal = parseInt(document.getElementById("exhaustionLevel")?.value, 10) || 0;
  const isActive = condKey === "exhaustion" ? exhVal > 0 : myActiveConditions.includes(condKey);

  const iconEl = document.getElementById("condExplainerIcon");
  const nameEl = document.getElementById("condExplainerName");
  if (iconEl) iconEl.textContent = data.icon;
  if (nameEl) nameEl.textContent = data.name;

  const badge = document.getElementById("condExplainerBadge");
  if (badge) {
    badge.textContent = isActive ? "Active" : "Inactive";
    badge.className = `condition-explainer-badge ${isActive ? "active" : "inactive"}`;
  }

  const toggleBtn = document.getElementById("condExplainerToggleBtn");
  if (toggleBtn) {
    toggleBtn.textContent = isActive ? "Remove Condition" : "Apply Condition";
    toggleBtn.className = `btn btn-xs ${isActive ? "btn-danger-ghost" : "btn-outline"}`;
  }

  const summaryEl = document.getElementById("condExplainerSummary");
  if (summaryEl) summaryEl.textContent = data.summary;

  const listEl = document.getElementById("condExplainerRulesList");
  if (listEl) {
    listEl.innerHTML = data.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  }

  card.style.display = "block";
}

function closeConditionExplainer() {
  const card = document.getElementById("conditionExplainerCard");
  if (card) card.style.display = "none";
  currentExplainingCondition = null;
}

function toggleConditionFromExplainer() {
  if (!currentExplainingCondition) return;
  if (currentExplainingCondition === "exhaustion") {
    const el = document.getElementById("exhaustionLevel");
    if (el) {
      const cur = parseInt(el.value, 10) || 0;
      el.value = cur > 0 ? 0 : 1;
      saveSheet(false);
      openConditionExplainer("exhaustion");
    }
    return;
  }

  if (myActiveConditions.includes(currentExplainingCondition)) {
    myActiveConditions = myActiveConditions.filter((c) => c !== currentExplainingCondition);
  } else {
    myActiveConditions.push(currentExplainingCondition);
  }
  renderConditionChips();
  openConditionExplainer(currentExplainingCondition);
  saveSheet(true);
}

/* ==========================================================================
   DISCORD STATBLOCK & AVRAE MACRO EXPORTER
   ========================================================================== */

function openDiscordExportModal(format = "markdown") {
  const modal = document.getElementById("discordModal");
  if (!modal) return;
  activeDiscordFormat = format || "markdown";
  document.querySelectorAll(".discord-format-tabs .sub-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.format === activeDiscordFormat);
  });
  renderDiscordExport();
  modal.classList.add("open");
}

function renderDiscordExport() {
  const textEl = document.getElementById("discordStatblockText");
  if (!textEl) return;
  const data = getCurrentSheetData();
  const full = extractFullCharacterPayload({ fields: data, spells: myCharacterSpells, traits: myCharacterTraits, weapons: myCharacterWeapons });

  if (activeDiscordFormat === "markdown") {
    textEl.value = generateDiscordMarkdown(full);
  } else if (activeDiscordFormat === "avrae") {
    textEl.value = generateAvraeMacros(full);
  } else {
    textEl.value = generateCompactDiscordCard(full);
  }
}

function generateDiscordMarkdown(c) {
  const name = c.name || "Adventurer";
  const charClass = c.class || "Hero";
  const race = c.race || "";
  const lvl = c.level || 1;
  const hp = c.hp || { cur: 10, max: 10, temp: 0 };
  const pb = c.proficiency || 2;
  const attrs = c.attributes || {};

  const statStr = ["str", "dex", "con", "int", "wis", "cha"].map((s) => {
    const att = attrs[s] || { score: 10, mod: 0 };
    const sign = att.mod >= 0 ? `+${att.mod}` : `${att.mod}`;
    return `\`${s.toUpperCase()}\` ${att.score} (${sign})`;
  }).join(" • ");

  const weaponsList = (c.weapons || []).filter(w => w && w.name).map((w) => {
    return `• **${w.name}**: +${w.atk || 0} to hit | ${w.dmg || "1d6"} dmg ${w.notes ? `(${w.notes})` : ""}`;
  }).join("\n") || "• None equipped";

  const spellsList = (c.spells || []).slice(0, 8).map(s => s.name).join(", ") || "None prepared";
  const traitsList = (c.traits || []).slice(0, 5).map(t => t.name).join(" • ") || "None";

  return `>>> ⚔️ **${name}** — Level ${lvl} ${race ? `${race} ` : ""}${charClass}
❤️ **HP:** ${hp.cur}/${hp.max}${hp.temp > 0 ? ` (+${hp.temp} temp)` : ""} | 🛡️ **AC:** ${c.ac || 10} | 🏃 **Speed:** ${c.speed || 30}ft | 🎯 **Proficiency:** +${pb} | 🎲 **Init:** ${c.initiative >= 0 ? `+${c.initiative}` : c.initiative}

**ABILITY SCORES**
${statStr}

⚔️ **WEAPONS ARSENAL**
${weaponsList}

🔮 **PREPARED SPELLS**
${spellsList}

✨ **KEY TRAITS & FEATS**
${traitsList}`;
}

function generateAvraeMacros(c) {
  const name = c.name || "Adventurer";
  const weapons = (c.weapons || []).filter(w => w && w.name);
  const spells = (c.spells || []).filter(s => s && s.name);

  let out = `# Avrae Discord Bot Commands for ${name}\n\n`;
  out += `# Core Checks & Saves\n`;
  out += `!check init\n`;
  out += `!check perception\n`;
  out += `!check stealth\n`;
  out += `!save con\n`;
  out += `!save dex\n`;
  out += `!save wis\n\n`;

  if (weapons.length > 0) {
    out += `# Weapon Attacks\n`;
    weapons.forEach((w) => {
      out += `!a "${w.name}"\n`;
    });
    out += `\n`;
  }

  if (spells.length > 0) {
    out += `# Spells\n`;
    spells.slice(0, 10).forEach((s) => {
      out += `!cast "${s.name}"\n`;
    });
  }

  return out;
}

function generateCompactDiscordCard(c) {
  const hp = c.hp || { cur: 10, max: 10, temp: 0 };
  const conds = (myActiveConditions || []).join(", ") || "None";
  const conc = (document.getElementById("spellConcentration")?.value || document.getElementById("concentrationSpellInput")?.value || "").trim() || "None";
  return `> **${c.name || "Adventurer"}** (Lvl ${c.level || 1} ${c.class || "Hero"}) — HP: **${hp.cur}/${hp.max}**${hp.temp > 0 ? ` (+${hp.temp})` : ""} | AC: **${c.ac || 10}** | Conc: *${conc}* | Status: [${conds}]`;
}

/* ==========================================================================
   PARTY CHAT ENGINE (FIREBASE FIRESTORE REAL-TIME CHAT)
   ========================================================================== */

function playChatNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

function isUserAllowedInChannel(chan) {
  if (!chan || chan.id === "general" || chan.isDefault) return true;
  if (isAdminSession()) return true; // Admins have universal oversight across all channels
  const myCharId = activeCharId;
  const myUid = auth?.currentUser?.uid;
  const myName = (document.getElementById("charName")?.value || "").trim().toLowerCase();
  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === (connectedCampaignRoom || activeDMRoomCode));

  if (chan.creatorId === myCharId || chan.creatorId === myUid) return true;
  if (isDM && Array.isArray(chan.allowedMembers) && chan.allowedMembers.includes("DM")) return true;

  if (Array.isArray(chan.allowedMembers)) {
    return chan.allowedMembers.some((m) => {
      if (m === myCharId || m === myUid) return true;
      if (myName && String(m).toLowerCase() === myName) return true;
      return false;
    });
  }
  return false;
}

function startPartyChatListener(roomCode) {
  if (!db || !roomCode) return;
  if (partyChatUnsubscribe) {
    partyChatUnsubscribe();
    partyChatUnsubscribe = null;
  }

  cachedChatMessages = [];
  renderPartyChatMessages();

  const titleEl = document.getElementById("floatingChatRoomTitle");
  const badgeEl = document.getElementById("floatingChatRoomBadge");
  const bottomBadge = document.getElementById("bottomChatRoomBadge");
  const myRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  const isOverride = Boolean(activeChatRoomOverride && activeChatRoomOverride === roomCode && activeChatRoomOverride !== myRoom);

  if (titleEl) titleEl.textContent = isOverride ? `Party Chat: ${roomCode}` : `Party: ${roomCode}`;
  if (badgeEl) {
    badgeEl.textContent = isOverride ? `${roomCode} (ADMIN)` : roomCode;
    badgeEl.classList.toggle("admin-override", isOverride);
  }
  if (bottomBadge) bottomBadge.textContent = roomCode;

  partyChatUnsubscribe = db.collection("campaigns").doc(roomCode).collection("chat")
    .orderBy("timestamp", "asc")
    .limitToLast(120)
    .onSnapshot((snapshot) => {
      const messages = [];
      const discoveredChannels = {
        general: { id: "general", name: "general", isDefault: true, allowedMembers: [] }
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        const msg = { id: doc.id, ...data };
        messages.push(msg);

        // Detect dynamic custom channel definitions
        if (msg.type === "system" && msg.payload && msg.payload.action === "create_channel" && msg.payload.channel) {
          const ch = msg.payload.channel;
          if (ch && ch.id) {
            discoveredChannels[ch.id] = ch;
          }
        }
      });

      // Filter channels so each player/DM only sees channels they were invited to
      const visibleChannels = [];
      Object.values(discoveredChannels).forEach((chan) => {
        if (isUserAllowedInChannel(chan)) {
          visibleChannels.push(chan);
        }
      });
      partyChannels = visibleChannels;

      // Keep active channel valid
      if (!partyChannels.some((c) => c.id === activePartyChannelId)) {
        activePartyChannelId = "general";
      }

      // Check for incoming unread messages
      if (messages.length > cachedChatMessages.length && cachedChatMessages.length > 0) {
        const newest = messages[messages.length - 1];
        const msgChan = newest.channelId || newest.payload?.channelId || "general";
        const currentChannelObj = partyChannels.find((c) => c.id === msgChan);

        // Only notify if message is in a channel this user has access to and didn't send themselves
        if (currentChannelObj && newest.senderId !== activeCharId) {
          if (!isFloatingChatOpen || activePartyChannelId !== msgChan) {
            unreadChatCount++;
            unreadPerChannel[msgChan] = (unreadPerChannel[msgChan] || 0) + 1;
            playChatNotificationSound();
          }
        }
      }

      cachedChatMessages = messages;
      renderChatChannelsBar();
      renderPartyChatMessages();
      updateChatUnreadBadges();
    }, (err) => {
      console.warn("Party chat listener error:", err);
    });
}

function stopPartyChatListener() {
  if (partyChatUnsubscribe) {
    partyChatUnsubscribe();
    partyChatUnsubscribe = null;
  }
  cachedChatMessages = [];
  partyChannels = [{ id: "general", name: "general", isDefault: true, allowedMembers: [] }];
  activePartyChannelId = "general";
  unreadPerChannel = {};
  renderChatChannelsBar();
  renderPartyChatMessages();
  updateChatUnreadBadges();
}

function updateChatInputPlaceholder() {
  const input = document.getElementById("floatingChatInput");
  if (!input) return;
  const current = partyChannels.find((c) => c.id === activePartyChannelId) || partyChannels[0];
  const activeRoom = getActiveChatRoomCode();
  const isMasterAdmin = isAdminSession();
  const isAdminJoined = isMasterAdmin && (
    isJoinedViaAdminPanel ||
    Boolean(activeChatRoomOverride) ||
    (activeRoom && sessionStorage.getItem("admin_joined_room_" + activeRoom) === "true")
  );

  if (isAdminJoined) {
    input.placeholder = `Message #${current.name} as Admin [Dev]... (Enter to send)`;
  } else {
    input.placeholder = `Message #${current.name}... (Enter to send)`;
  }
}

function switchPartyChannel(chanId) {
  if (!partyChannels.some((c) => c.id === chanId)) return;
  activePartyChannelId = chanId;
  unreadPerChannel[chanId] = 0;

  renderChatChannelsBar();
  renderPartyChatMessages();
  updateChatUnreadBadges();

  const input = document.getElementById("floatingChatInput");
  if (input) {
    updateChatInputPlaceholder();
    input.focus();
  }
}

function renderChatChannelsBar() {
  const list = document.getElementById("chatChannelsList");
  const infoTag = document.getElementById("chatCurrentChannelTag");
  const infoPrivacy = document.getElementById("chatCurrentChannelPrivacy");
  if (!list) return;

  let channelsHtml = partyChannels.map((chan) => {
    const isActive = chan.id === activePartyChannelId;
    const isPrivate = !chan.isDefault && chan.id !== "general";
    const unread = unreadPerChannel[chan.id] || 0;
    return `
      <button type="button" class="chat-chan-pill ${isActive ? 'active' : ''}" data-chan-id="${escapeHtml(chan.id)}" title="${escapeHtml(chan.name)}">
        <span># ${escapeHtml(chan.name)} ${isPrivate ? '🔒' : ''}</span>
        ${unread > 0 && !isActive ? `<span class="chan-unread-dot"></span>` : ''}
      </button>
    `;
  }).join("");

  if (isAdminSession()) {
    channelsHtml += `
      <button type="button" class="chat-chan-pill admin-rooms-pill" id="adminQuickSwitchCampaignPill" title="Admin: Switch between campaign chats">
        <span>🏰 Other Campaigns ▾</span>
      </button>
    `;
  }

  list.innerHTML = channelsHtml;

  const current = partyChannels.find((c) => c.id === activePartyChannelId) || partyChannels[0];
  if (infoTag) infoTag.textContent = `# ${current.name} ${current.isDefault ? '' : '🔒'}`;
  if (infoPrivacy) {
    if (current.isDefault || current.id === "general") {
      infoPrivacy.textContent = "👥 All Party";
    } else {
      const count = current.allowedMembers ? current.allowedMembers.length : 1;
      infoPrivacy.textContent = `🔒 Private (${count} invited)`;
    }
  }
}

function openCreateChannelModal() {
  const modal = document.getElementById("createChatModal");
  const list = document.getElementById("newChannelInviteList");
  const nameInput = document.getElementById("newChannelNameInput");
  if (!modal || !list) return;

  if (nameInput) nameInput.value = "";

  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === (connectedCampaignRoom || activeDMRoomCode));
  const myCharId = activeCharId;

  // Build members list to invite
  let membersHtml = "";

  // 1. The DM option
  membersHtml += `
    <label class="invitee-checkbox-row">
      <div class="invitee-info">
        <div class="invitee-avatar" style="background:var(--primary-red); color:#fff; font-weight:800;">DM</div>
        <div>
          <div class="invitee-name">Dungeon Master ${isDM ? "(You)" : ""}</div>
          <div class="invitee-role">Campaign Host</div>
        </div>
      </div>
      <input type="checkbox" name="channelInvitee" value="DM" ${isDM ? "checked disabled" : ""} />
    </label>
  `;

  // 2. All active room members (excluding DM to prevent duplicate or player DM)
  (cachedRoomMembers || []).forEach((m) => {
    if (!m) return;
    const mid = String(m.id || "");
    const mname = String(m.name || "");
    const mclass = String(m.charClass || "");
    if (mid === "dm_presence" || mid.startsWith("dm_") || mname === "Dungeon Master" || mclass === "DM" || m.isDM) {
      return;
    }
    const isMe = m.id === myCharId;
    membersHtml += `
      <label class="invitee-checkbox-row">
        <div class="invitee-info">
          ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" class="invitee-avatar" />` : `<div class="invitee-avatar">⚔️</div>`}
          <div>
            <div class="invitee-name">${escapeHtml(m.name || "Adventurer")} ${isMe ? "(You)" : ""}</div>
            <div class="invitee-role">Lvl ${m.level || 1} ${escapeHtml(m.charClass || "Hero")}</div>
          </div>
        </div>
        <input type="checkbox" name="channelInvitee" value="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name || '')}" ${isMe ? "checked disabled" : ""} />
      </label>
    `;
  });

  list.innerHTML = membersHtml;
  modal.style.display = "flex";
  modal.classList.add("open");
  if (nameInput) setTimeout(() => nameInput.focus(), 50);
}

function closeCreateChannelModal() {
  const modal = document.getElementById("createChatModal");
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("open");
  }
}

async function confirmCreateChannel() {
  const nameInput = document.getElementById("newChannelNameInput");
  const rawName = nameInput?.value?.trim() || "";
  const cleanName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  if (!cleanName || cleanName.length < 2) {
    alert("Please enter a valid chat name (at least 2 letters, numbers, or dashes).");
    return;
  }

  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === (connectedCampaignRoom || activeDMRoomCode));
  const myId = activeCharId || auth?.currentUser?.uid || "anon";
  const myName = isDM ? "Dungeon Master" : (document.getElementById("charName")?.value?.trim() || "Adventurer");

  const selectedMembers = [myId];
  if (isDM && !selectedMembers.includes("DM")) selectedMembers.push("DM");

  document.querySelectorAll('input[name="channelInvitee"]:checked').forEach((cb) => {
    const val = cb.value;
    if (val && !selectedMembers.includes(val)) {
      selectedMembers.push(val);
    }
    const charNameVal = cb.getAttribute("data-name");
    if (charNameVal && !selectedMembers.includes(charNameVal)) {
      selectedMembers.push(charNameVal);
    }
  });

  const channelId = "chan_" + Date.now();
  const channelObj = {
    id: channelId,
    name: cleanName,
    creatorId: myId,
    creatorName: myName,
    allowedMembers: selectedMembers,
    createdAt: Date.now()
  };

  closeCreateChannelModal();

  // Send channel creation event via system message (compliant with Firestore security rules)
  await sendPartyChatMessage(
    `🔒 Created private chat #${cleanName}`,
    "system",
    { action: "create_channel", channel: channelObj, channelId: channelId }
  );

  activePartyChannelId = channelId;
  showStatus(`Created chat #${cleanName}!`);
}

async function sendPartyChatMessage(text, type = "chat", payload = null) {
  const activeRoom = getActiveChatRoomCode();
  if (!db || !activeRoom) {
    showStatus("Not connected to a party room.");
    return;
  }

  const cleanText = text.trim();
  if (!cleanText && type === "chat") return;

  await ensureAuthenticated();
  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === activeRoom);
  const isMasterAdmin = isAdminSession();
  const isAdminJoined = isMasterAdmin && (
    isJoinedViaAdminPanel ||
    Boolean(activeChatRoomOverride) ||
    (activeRoom && sessionStorage.getItem("admin_joined_room_" + activeRoom) === "true")
  );

  let senderName = isDM ? "Dungeon Master" : (document.getElementById("charName")?.value?.trim() || "Adventurer");
  let senderId = activeCharId || auth?.currentUser?.uid || "anon";
  let senderRole = isDM ? "dm" : "player";
  let isDev = false;

  // When a chat is joined through the admin panel: name is "Admin" and role is "dev"
  if (isAdminJoined) {
    senderName = "Admin";
    senderRole = "dev";
    isDev = true;
    senderId = "admin_" + (auth?.currentUser?.uid || "root");
  }

  const targetChannelId = (payload && payload.channelId) || activePartyChannelId || "general";

  const messageDoc = {
    senderId: senderId,
    senderName: senderName,
    senderRole: senderRole,
    isDev: isDev,
    isDM: isDM && !isDev,
    type: type,
    text: cleanText,
    channelId: targetChannelId,
    payload: {
      ...(payload || {}),
      channelId: targetChannelId
    },
    timestamp: Date.now()
  };

  try {
    await db.collection("campaigns").doc(activeRoom).collection("chat").add(messageDoc);
  } catch (err) {
    console.error("Failed to send party chat message:", err);
    showStatus("Could not send chat message.");
  }
}

function renderPartyChatMessages() {
  const floatContainer = document.getElementById("floatingChatMessages");
  if (!floatContainer) return;

  // Filter messages belonging to the currently selected channel AND permissions
  const currentChan = partyChannels.find((c) => c.id === activePartyChannelId) || partyChannels[0];
  const channelMsgs = cachedChatMessages.filter((msg) => {
    const msgChan = msg.channelId || msg.payload?.channelId || "general";
    const inChan = activePartyChannelId === "general"
      ? (msgChan === "general" || !msg.channelId)
      : (msgChan === activePartyChannelId);
    if (!inChan) return false;

    // Handout targeting and claim status filter
    if (msg.type === "handout" && msg.payload) {
      if (isAdminSession()) return true; // Admins overseeing a campaign see all handouts
      const h = msg.payload;
      // 1. Only specified recipient (or DM/author) can see targeted handouts
      if (!canISeeHandout(h)) return false;

      // 2. If handout is fully claimed, the chat message disappears!
      const liveH = partyRoomHandouts.find((ph) => ph.id === h.id) || h;
      if (isHandoutFullyClaimed(liveH)) return false;
    }

    return true;
  });

  if (!channelMsgs || channelMsgs.length === 0) {
    let emptyHint = "Waiting for messages... Type below to start chatting!";
    if (currentChan && currentChan.id !== "general") {
      emptyHint = `🔒 This is the start of #${currentChan.name}. Only invited members can read or send messages here.`;
    }
    floatContainer.innerHTML = `<div class="chat-empty-hint">${escapeHtml(emptyHint)}</div>`;
    return;
  }

  const html = channelMsgs.map((msg) => {
    const isDevMsg = msg.isDev === true ||
                     msg.senderRole === "dev" ||
                     msg.role === "dev" ||
                     msg.senderId === "master_admin" ||
                     (msg.senderId && String(msg.senderId).startsWith("admin_")) ||
                     msg.senderName === "Admin" ||
                     (msg.senderName && String(msg.senderName).toLowerCase() === "admin");

    const isSystemMsg = !isDevMsg && (
                        msg.type === "system" ||
                        msg.senderId === "system" ||
                        (msg.senderName && (msg.senderName.includes("System") || msg.senderName.includes("Maintenance") || msg.senderName.includes("Decree"))));

    const isMe = msg.senderId === activeCharId || (isAdminSession() && (isDevMsg || msg.senderId === "system"));
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
    let contentHtml = `<div class="chat-msg-text">${escapeHtml(msg.text)}</div>`;

    if (msg.type === "roll" && msg.payload) {
      contentHtml += `
        <div class="chat-roll-card">
          <span class="chat-roll-desc">🎲 ${escapeHtml(msg.payload.desc || "Roll")}: ${escapeHtml(msg.payload.formula || "")}</span>
          <span class="chat-roll-total">${escapeHtml(String(msg.payload.total || 0))}</span>
        </div>
      `;
    } else if (msg.type === "handout" && msg.payload) {
      const h = partyRoomHandouts.find((ph) => ph.id === msg.payload.id) || msg.payload;
      let badge = "📜";
      let claimBtn = "";
      const isClaimed = myClaimedHandoutIds.includes(h.id);
      const canClaim = canIClaimHandout(h);
      const fullyClaimed = isHandoutFullyClaimed(h);
      const myCount = myClaimedHandoutIds.filter((id) => id === h.id).length;

      if (h.type === "weapon") {
        badge = "⚔️";
        if (canClaim) {
          claimBtn = `<button type="button" class="btn btn-xs btn-primary claim-weapon-btn" data-id="${escapeHtml(h.id || '')}" style="margin-left: auto;">⚔️ Claim Weapon</button>`;
        } else if (fullyClaimed) {
          claimBtn = `<span class="claimed-badge" style="margin-left: auto; opacity: 0.75;">${myCount > 0 ? '✓ In Arsenal' : 'Claimed'}</span>`;
        } else if (isClaimed) {
          claimBtn = `<span class="claimed-badge" style="margin-left: auto;">✓ In Arsenal</span>`;
        }
      } else if (h.type === "item") {
        badge = "🎒";
        const maxClaims = parseInt(h.maxClaims, 10) || 1;
        const currentClaimed = parseInt(h.claimedCount, 10) || 0;
        const left = Math.max(0, maxClaims - currentClaimed);

        if (canClaim && left > 0) {
          const myBadge = myCount > 0 ? `<span class="claimed-badge" style="font-size:0.65rem; padding:0.12rem 0.35rem;">Bag: ${myCount}</span>` : "";
          claimBtn = `
            <div style="margin-left: auto; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${myBadge}
              <button type="button" class="btn btn-xs btn-primary claim-item-btn" data-id="${escapeHtml(h.id || '')}">🎒 Claim</button>
            </div>
          `;
        } else if (fullyClaimed) {
          claimBtn = `<span class="claimed-badge" style="margin-left: auto; opacity: 0.75;">${myCount > 0 ? `✓ Claimed (${myCount})` : 'All Claimed'}</span>`;
        } else if (isClaimed) {
          claimBtn = `<span class="claimed-badge" style="margin-left: auto;">✓ Claimed (${myCount})</span>`;
        }
      } else if (h.type === "coin") {
        badge = "💰";
        if (canClaim) {
          claimBtn = `<button type="button" class="btn btn-xs btn-primary claim-coins-btn" data-id="${escapeHtml(h.id || '')}" style="margin-left: auto;">Claim Coins</button>`;
        } else if (fullyClaimed || isClaimed) {
          claimBtn = `<span class="claimed-badge" style="margin-left: auto;">✓ Claimed</span>`;
        }
      }

      let recipientBadge = "";
      if (h.recipient && h.recipient !== "all") {
        recipientBadge = `<span class="tag-pill" style="font-size:0.65rem; color:#60a5fa; border-color:rgba(96,165,250,0.3);">👤 For: ${escapeHtml(h.recipient)}</span>`;
      }

      contentHtml += `
        <div class="chat-roll-card" style="border-left-color: #f59e0b; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="chat-roll-desc">${badge} <strong>${escapeHtml(h.title || "Handout")}</strong></span>
          ${recipientBadge}
          ${claimBtn}
          <button type="button" class="btn btn-xs btn-outline open-shared-handout-btn" data-handout-id="${escapeHtml(h.id || '')}">View</button>
        </div>
      `;
    }

    let roleTag = "";
    if (isDevMsg) {
      roleTag = `<span class="chat-sender-role chat-sender-role-dev">Dev</span>`;
    } else if (isSystemMsg) {
      roleTag = `<span class="chat-sender-role chat-sender-role-system">SYSTEM</span>`;
    } else if (msg.isDM) {
      roleTag = `<span class="chat-sender-role">DM</span>`;
    }

    const senderDisplayName = isDevMsg ? "Admin" : (msg.senderName || (isSystemMsg ? "System" : "Adventurer"));

    return `
      <div class="chat-message-row ${isMe ? 'is-me' : ''} ${isDevMsg ? 'is-dev' : (isSystemMsg ? 'is-system' : (msg.isDM ? 'is-dm' : ''))}">
        <div class="chat-msg-header">
          <div class="chat-sender-info">
            <span class="chat-sender-name">${escapeHtml(senderDisplayName)}</span>
            ${roleTag}
          </div>
          <span class="chat-timestamp">${timeStr}</span>
        </div>
        ${contentHtml}
      </div>
    `;
  }).join("");

  floatContainer.innerHTML = html;
  floatContainer.scrollTop = floatContainer.scrollHeight;
}

function updateChatUnreadBadges() {
  const bottomBadge = document.getElementById("bottomChatUnreadBadge");
  const dockBadge = document.getElementById("dockChatBadge");

  [bottomBadge, dockBadge].forEach((b) => {
    if (b) {
      if (unreadChatCount > 0) {
        b.textContent = unreadChatCount;
        b.style.display = "inline-flex";
      } else {
        b.style.display = "none";
      }
    }
  });

  // Re-render channel pills so dots reflect unread count
  renderChatChannelsBar();
}

function toggleFloatingPartyChat(forceOpen = null) {
  const panel = document.getElementById("floatingPartyChat");
  if (!panel) return;

  if (forceOpen === false) {
    panel.style.display = "none";
    isFloatingChatOpen = false;
    const bottomChatBtn = document.getElementById("bottomLeftPartyChatBtn");
    if (bottomChatBtn) bottomChatBtn.classList.remove("active");
    return;
  }

  const activeRoom = getActiveChatRoomCode();
  const isMasterAdmin = isAdminSession();

  if (!activeRoom) {
    if (isMasterAdmin) {
      openAdminChatWithoutRoom();
      return;
    }
    showStatus("Connect to a party room first to chat!");
    openPartyModal();
    return;
  }

  isFloatingChatOpen = forceOpen !== null ? forceOpen : (panel.style.display === "none");

  if (isFloatingChatOpen) {
    panel.style.display = "flex";
    clampFloatingChatToBounds();
    unreadChatCount = 0;
    unreadPerChannel[activePartyChannelId] = 0;
    updateChatUnreadBadges();
    updateAdminChatBarUI();
    updateChatInputPlaceholder();
    const input = document.getElementById("floatingChatInput");
    if (input) setTimeout(() => input.focus(), 50);
    const msgs = document.getElementById("floatingChatMessages");
    if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
  } else {
    panel.style.display = "none";
  }

  const bottomChatBtn = document.getElementById("bottomLeftPartyChatBtn");
  if (bottomChatBtn) {
    bottomChatBtn.classList.toggle("active", isFloatingChatOpen);
  }
}

let preExpandedChatSize = null;

function toggleFloatingChatExpanded() {
  const panel = document.getElementById("floatingPartyChat");
  const expandBtn = document.getElementById("floatingChatExpandBtn");
  if (!panel) return;

  const willBeExpanded = !panel.classList.contains("expanded");

  if (willBeExpanded) {
    preExpandedChatSize = {
      width: panel.style.width,
      height: panel.style.height
    };
    panel.classList.add("expanded");
  } else {
    panel.classList.remove("expanded");
    if (preExpandedChatSize) {
      if (preExpandedChatSize.width) panel.style.width = preExpandedChatSize.width;
      if (preExpandedChatSize.height) panel.style.height = preExpandedChatSize.height;
    }
  }

  if (expandBtn) {
    const expandIcon = expandBtn.querySelector(".expand-icon");
    const compressIcon = expandBtn.querySelector(".compress-icon");
    if (expandIcon && compressIcon) {
      expandIcon.style.display = willBeExpanded ? "none" : "block";
      compressIcon.style.display = willBeExpanded ? "block" : "none";
    }
    const label = willBeExpanded ? "Restore Chat Size" : "Expand / Maximize Chat";
    expandBtn.setAttribute("title", label);
    expandBtn.setAttribute("aria-label", label);
  }

  clampFloatingChatToBounds();

  const msgs = document.getElementById("floatingChatMessages");
  if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 60);
}

function clampFloatingChatToBounds() {
  const panel = document.getElementById("floatingPartyChat");
  if (!panel || panel.style.display === "none") return;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - 50);

  if (panel.style.top && panel.style.top !== "auto") {
    let curLeft = parseFloat(panel.style.left) || rect.left;
    let curTop = parseFloat(panel.style.top) || rect.top;
    if (curLeft > maxLeft) curLeft = maxLeft;
    if (curLeft < 0) curLeft = 0;
    if (curTop > maxTop) curTop = maxTop;
    if (curTop < 0) curTop = 0;
    panel.style.left = `${curLeft}px`;
    panel.style.top = `${curTop}px`;
  }
}

function shareLastRollToPartyChat() {
  if (!lastBroadcastRoll) {
    showStatus("No recent roll to share. Roll some dice first!");
    return;
  }
  const text = `Rolled ${lastBroadcastRoll.desc} = ${lastBroadcastRoll.total}`;
  sendPartyChatMessage(text, "roll", lastBroadcastRoll);
  showStatus("Shared roll to chat!");
}

/* ==========================================================================
   ADMIN PURGED CAMPAIGN ROOMS REGISTRY
   ========================================================================== */

const ADMIN_PURGED_ROOMS_KEY = "codex_admin_purged_rooms";

function getPurgedRooms() {
  try {
    const raw = localStorage.getItem(ADMIN_PURGED_ROOMS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map((r) => String(r || "").trim().toUpperCase()).filter(Boolean) : []);
  } catch (e) {
    return new Set();
  }
}

function addPurgedRoom(code) {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  const set = getPurgedRooms();
  set.add(clean);
  try {
    localStorage.setItem(ADMIN_PURGED_ROOMS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

async function syncPurgedRoomsToCloud(code) {
  if (!db || !code) return;
  const clean = code.trim().toUpperCase();
  try {
    const ref = db.collection("campaigns").doc("CODEX_GLOBAL_SYSTEM").collection("handouts").doc("purged_campaigns");
    const snap = await ref.get().catch(() => null);
    let list = [];
    if (snap && snap.exists) {
      try {
        const d = snap.data();
        list = JSON.parse(d.content || "[]");
      } catch (err) {}
    }
    if (!Array.isArray(list)) list = [];
    if (!list.includes(clean)) list.push(clean);
    if (list.length > 250) list = list.slice(list.length - 250);

    await ref.set({
      id: "purged_campaigns",
      title: "Purged Campaigns Registry",
      type: "system",
      author: "Admin",
      content: JSON.stringify(list),
      isShared: true,
      updatedAt: Date.now()
    }, { merge: true }).catch(() => {});
  } catch (e) {}
}

/* ==========================================================================
   ADMIN PARTY CHAT CAMPAIGN SWITCHER & MONITOR
   ========================================================================== */

async function getAdminActiveCampaignRoomsList() {
  const roomSet = new Set();

  // 1. Current rooms
  if (connectedCampaignRoom) roomSet.add(connectedCampaignRoom.trim().toUpperCase());
  if (activeDMRoomCode) roomSet.add(activeDMRoomCode.trim().toUpperCase());
  if (activeChatRoomOverride) roomSet.add(activeChatRoomOverride.trim().toUpperCase());

  // 2. Local created and recent rooms
  getCreatedRooms().forEach((r) => roomSet.add(r.trim().toUpperCase()));
  getRecentRooms().forEach((r) => roomSet.add(r.trim().toUpperCase()));

  // 3. Firestore query if admin
  if (db && isAdminSession()) {
    try {
      const snap = await db.collection("campaigns").limit(50).get();
      snap.forEach((doc) => {
        const id = doc.id;
        if (id && !id.startsWith("__") && id !== "CODEX_PRESENCE" && id !== "CODEX_GLOBAL_SYSTEM" && id !== "GLOBAL_PRESENCE" && id !== "GLOBAL_SYSTEM") {
          roomSet.add(id.trim().toUpperCase());
        }
      });
    } catch (err) {
      console.warn("getAdminActiveCampaignRoomsList query error:", err);
    }
  }

  // Filter out any purged rooms
  const purged = getPurgedRooms();
  purged.forEach((code) => roomSet.delete(code));

  return Array.from(roomSet).filter(Boolean);
}

function switchAdminChatRoom(roomCode) {
  if (!roomCode) return;
  const targetCode = roomCode.trim().toUpperCase();
  const myRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();

  isJoinedViaAdminPanel = true;
  try { sessionStorage.setItem("admin_joined_room_" + targetCode, "true"); } catch (err) {}

  if (myRoom && targetCode === myRoom) {
    activeChatRoomOverride = null;
  } else {
    activeChatRoomOverride = targetCode;
  }

  // Stealth Spectator Mode:
  // When joining/monitoring a chat through the admin panel, the admin must NOT notify the room owner
  // and must NOT be shown or registered as a player in the party.
  // Silently remove any admin character document from the members subcollection so admin never appears in the party dock.
  if (db && activeCharId && isAdminSession()) {
    try {
      db.collection("campaigns").doc(targetCode).collection("members").doc(activeCharId).delete().catch(() => {});
    } catch (e) {}
  }

  startPartyChatListener(targetCode);
  updateAdminChatBarUI();
  updatePartyStatusUI();
  updateChatInputPlaceholder();
  showStatus(`Admin: Switched party chat to campaign "${targetCode}"`);
}

function returnToMyAdminPartyRoom() {
  activeChatRoomOverride = null;
  isJoinedViaAdminPanel = false;
  const myRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (myRoom) {
    try { sessionStorage.removeItem("admin_joined_room_" + myRoom); } catch (err) {}
    startPartyChatListener(myRoom);
    showStatus(`Returned to your campaign room "${myRoom}"`);
  } else {
    updateAdminChatBarUI();
  }
  updateAdminChatBarUI();
  updatePartyStatusUI();
  updateChatInputPlaceholder();
}

async function openAdminChatWithoutRoom() {
  showStatus("Opening Party Chat in Admin Mode...");
  isJoinedViaAdminPanel = true;
  const rooms = await getAdminActiveCampaignRoomsList();

  if (rooms.length > 0) {
    const targetRoom = rooms[0];
    switchAdminChatRoom(targetRoom);
    toggleFloatingPartyChat(true);
  } else {
    const custom = prompt("Admin Party Chat Monitor: Enter a Campaign Room Code to inspect:");
    if (custom && custom.trim()) {
      const cleanCustom = custom.trim().toUpperCase();
      switchAdminChatRoom(cleanCustom);
      toggleFloatingPartyChat(true);
    } else {
      showStatus("No campaign room selected.");
    }
  }
}

async function updateAdminChatBarUI() {
  const bar = document.getElementById("adminChatCampaignBar");
  const select = document.getElementById("adminChatCampaignSelect");
  const myRoomBtn = document.getElementById("adminChatMyRoomBtn");
  const badgeEl = document.getElementById("floatingChatRoomBadge");
  const titleEl = document.getElementById("floatingChatRoomTitle");
  if (!bar || !select) return;

  if (!isAdminSession()) {
    bar.style.display = "none";
    if (badgeEl) badgeEl.classList.remove("admin-override");
    return;
  }

  bar.style.display = "flex";

  const myRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  const currentRoom = (activeChatRoomOverride || myRoom || "").trim().toUpperCase();

  // Populate options
  const rooms = await getAdminActiveCampaignRoomsList();

  let optionsHtml = "";
  if (myRoom) {
    optionsHtml += `<option value="${escapeHtml(myRoom)}">⭐ My Room (${escapeHtml(myRoom)})</option>`;
  }

  rooms.forEach((r) => {
    if (r !== myRoom) {
      optionsHtml += `<option value="${escapeHtml(r)}">🏰 Campaign: ${escapeHtml(r)}</option>`;
    }
  });

  optionsHtml += `<option value="__custom__">➕ Custom Room Code...</option>`;

  select.innerHTML = optionsHtml;
  if (currentRoom) {
    select.value = currentRoom;
  }

  // Toggle "↩ My Room" button and titles
  if (myRoom && activeChatRoomOverride && activeChatRoomOverride !== myRoom) {
    if (myRoomBtn) {
      myRoomBtn.style.display = "inline-flex";
      myRoomBtn.textContent = `↩ My Room (${myRoom})`;
    }
    if (badgeEl) {
      badgeEl.textContent = `${activeChatRoomOverride} (ADMIN)`;
      badgeEl.classList.add("admin-override");
    }
    if (titleEl) {
      titleEl.textContent = `Party Chat: ${activeChatRoomOverride}`;
    }
  } else {
    if (myRoomBtn) myRoomBtn.style.display = "none";
    if (badgeEl) {
      badgeEl.classList.remove("admin-override");
      if (currentRoom) badgeEl.textContent = currentRoom;
    }
    if (titleEl) {
      titleEl.textContent = currentRoom ? `Party: ${currentRoom}` : "Party Chat";
    }
  }
}

function initAdminChatSwitcherListeners() {
  const select = document.getElementById("adminChatCampaignSelect");
  if (select) {
    select.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "__custom__") {
        const custom = prompt("Enter Campaign Room Code to open chat:");
        if (custom && custom.trim()) {
          switchAdminChatRoom(custom.trim().toUpperCase());
        } else {
          updateAdminChatBarUI();
        }
      } else if (val) {
        switchAdminChatRoom(val);
      }
    });
  }

  const refreshBtn = document.getElementById("adminChatRefreshRoomsBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("codex-spin-icon");
      await updateAdminChatBarUI();
      setTimeout(() => refreshBtn.classList.remove("codex-spin-icon"), 400);
      showStatus("Refreshed campaign rooms list!");
    });
  }

  const myRoomBtn = document.getElementById("adminChatMyRoomBtn");
  if (myRoomBtn) {
    myRoomBtn.addEventListener("click", () => {
      returnToMyAdminPartyRoom();
    });
  }
}

/* ==========================================================================
   PARTY HANDOUTS & CLUES SYSTEM
   ========================================================================== */

function canISeeHandout(h) {
  if (!h) return false;
  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!activeRoom) return false; // Handouts only belong to active party rooms
  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === activeRoom);
  if (isDM) return true;

  if (h.authorUid && auth?.currentUser?.uid && h.authorUid === auth.currentUser.uid) return true;

  const rec = (h.recipient || "all").trim().toLowerCase();
  if (rec === "all" || rec === "") return true;

  const curCharName = (document.getElementById("charName")?.value || "").trim().toLowerCase();
  const roster = getRoster();
  const activeRosterName = (roster[activeCharId]?.name || "").trim().toLowerCase();

  if (rec === curCharName || (activeRosterName && rec === activeRosterName)) return true;
  if (h.recipientId && activeCharId && h.recipientId === activeCharId) return true;

  return false;
}

function isHandoutFullyClaimed(h) {
  if (!h) return false;
  const maxClaims = parseInt(h.maxClaims, 10) || 1;
  const claimedCount = parseInt(h.claimedCount, 10) || (Array.isArray(h.claimedBy) ? h.claimedBy.length : 0);
  return claimedCount >= maxClaims;
}

function canIClaimHandout(h) {
  if (!h) return false;
  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!activeRoom) return false;
  if (!canISeeHandout(h)) return false;

  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === activeRoom);
  if (isDM) return false;

  // Handout can be claimed by eligible players as long as remaining copies exist
  if (isHandoutFullyClaimed(h)) return false;

  return true;
}

function canIEditOrDeleteHandout(h) {
  if (!h) return false;
  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!activeRoom) return false;
  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === activeRoom);
  if (isDM) return true;
  if (h.authorUid && auth?.currentUser?.uid && h.authorUid === auth.currentUser.uid) return true;
  return false;
}

function renderHandoutsGrid() {
  const grid = document.getElementById("handoutsGrid");
  const countBadge = document.getElementById("handoutsCountBadge");
  if (!grid) return;

  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();

  // If not currently connected to any party room, do NOT show party handouts
  if (!activeRoom) {
    if (countBadge) countBadge.textContent = "0";
    grid.innerHTML = `
      <div class="handout-empty-state">
        <div class="handout-empty-icon">📜</div>
        <div class="handout-empty-title">No Active Party Connected</div>
        <div class="handout-empty-desc">Connect to a campaign room or host as Dungeon Master to view, claim, and distribute live party handouts, loot, and quest clues.</div>
        <button type="button" class="btn btn-primary btn-sm" id="handoutsConnectPartyBtn" style="margin-top: 0.35rem;">
          <span>⚔️</span> Join or Host Party
        </button>
      </div>
    `;
    return;
  }

  // When in a party: Only show handouts belonging to the active party room (filter out system documents)
  const roomHandouts = partyRoomHandouts.filter((h) => h && h.id !== "global_notice" && h.id !== "owlbear_vtt" && h.id !== "owlbear_vtt_state" && h.type !== "system");

  // Only handouts the current player is allowed to see
  const visibleHandouts = roomHandouts.filter((h) => canISeeHandout(h));

  if (countBadge) countBadge.textContent = visibleHandouts.length;

  const searchInput = document.getElementById("handoutSearchInput");
  const searchQ = (searchInput?.value || "").trim().toLowerCase();

  let filtered = activeHandoutFilter === "all"
    ? visibleHandouts
    : visibleHandouts.filter((h) => {
        const t = (h.type || "letter").toLowerCase();
        if (activeHandoutFilter === "weapon") return t === "weapon";
        if (activeHandoutFilter === "item") return t === "item";
        if (activeHandoutFilter === "coin") return t === "coin";
        if (activeHandoutFilter === "letter") return t === "letter" || t === "note" || t === "contract" || t === "map" || t === "clue" || t === "bounty";
        return t === activeHandoutFilter;
      });

  if (searchQ) {
    filtered = filtered.filter((h) => {
      const title = (h.title || "").toLowerCase();
      const content = (h.content || "").toLowerCase();
      const author = (h.author || "").toLowerCase();
      const wpn = h.weapon || h.item || {};
      const wpnName = (wpn.name || "").toLowerCase();
      const wpnDmg = (wpn.dmg || "").toLowerCase();
      const wpnType = (wpn.type || "").toLowerCase();
      const wpnNotes = (wpn.notes || "").toLowerCase();
      return title.includes(searchQ) || content.includes(searchQ) || author.includes(searchQ) ||
             wpnName.includes(searchQ) || wpnDmg.includes(searchQ) || wpnType.includes(searchQ) || wpnNotes.includes(searchQ);
    });
  }

  if (filtered.length === 0) {
    const isSearch = Boolean(searchQ);
    grid.innerHTML = `
      <div class="handout-empty-state">
        <div class="handout-empty-title">${isSearch ? `No handouts match "${escapeHtml(searchQ)}"` : "No handouts yet in this category"}</div>
        <div class="handout-empty-desc">${isSearch ? "Try adjusting your search terms or clearing the search bar." : "Award weapons, magic items, treasure coins, or secret clues directly to your adventuring party."}</div>
        ${!isSearch ? `
          <div class="handout-empty-actions">
            <button type="button" class="btn btn-primary btn-xs" onclick="openHandoutEditor('weapon')">Add Weapon</button>
            <button type="button" class="btn btn-outline btn-xs" onclick="openHandoutEditor('item')">Add Item</button>
            <button type="button" class="btn btn-outline btn-xs" onclick="openHandoutEditor('coin')">Distribute Coins</button>
          </div>
        ` : `<button type="button" class="btn btn-outline btn-xs" onclick="document.getElementById('handoutSearchInput').value=''; renderHandoutsGrid();">Clear Search</button>`}
      </div>
    `;
    return;
  }

  const typeIcons = {
    weapon: "Weapon",
    item: "Item Loot",
    coin: "Coins",
    letter: "Lore & Notes",
    bounty: "Bounty",
    clue: "Clue",
    map: "Map",
    contract: "Contract",
    note: "Note"
  };

  grid.innerHTML = filtered.map((h) => {
    const typeLabel = typeIcons[h.type] || "Handout";
    const authorStr = h.author ? `By ${escapeHtml(h.author)}` : "Author Unknown";
    const dateStr = h.date ? escapeHtml(h.date) : "Undated";
    const isShared = Boolean(h.isShared);
    const isClaimed = myClaimedHandoutIds.includes(h.id);
    const fullyClaimed = isHandoutFullyClaimed(h);
    const canClaim = canIClaimHandout(h);
    const canManage = canIEditOrDeleteHandout(h);

    let badgeClass = "badge-lore";
    if (h.type === "weapon") badgeClass = "badge-weapon";
    else if (h.type === "item") badgeClass = "badge-item";
    else if (h.type === "coin") badgeClass = "badge-coin";

    let snippet = h.content || "";
    let weaponStatHtml = "";
    if (h.type === "weapon" && (h.item || h.weapon)) {
      const w = h.weapon || h.item;
      const parts = [];
      if (w.dmg) parts.push(`Dmg: ${w.dmg}`);
      if (w.type || w.atk) parts.push(`Type: ${w.type || w.atk}`);
      if (parts.length > 0) {
        weaponStatHtml = `<div class="handout-weapon-stat-pill">${escapeHtml(parts.join(" • "))}</div>`;
      }
      snippet = [w.notes, h.content].filter(Boolean).join(" — ");
      if (!snippet) snippet = "Arsenal Weapon";
    } else if (h.type === "item" && h.item) {
      snippet = `Item: ${h.item.name} (x${h.item.qty || 1}${h.item.weight ? `, ${h.item.weight} lbs` : ""}) ${h.content ? `— ${h.content}` : ""}`;
    } else if (h.type === "coin" && h.coins) {
      const parts = [];
      if (h.coins.pp) parts.push(`${h.coins.pp} PP`);
      if (h.coins.gp) parts.push(`${h.coins.gp} GP`);
      if (h.coins.ep) parts.push(`${h.coins.ep} EP`);
      if (h.coins.sp) parts.push(`${h.coins.sp} SP`);
      if (h.coins.cp) parts.push(`${h.coins.cp} CP`);
      snippet = `Treasure: ${parts.join(", ")} ${h.content ? `— ${h.content}` : ""}`;
    }

    let claimActionHtml = "";
    const myCount = myClaimedHandoutIds.filter((id) => id === h.id).length;
    if (h.type === "weapon") {
      if (canClaim) {
        claimActionHtml = `<button type="button" class="btn btn-xs btn-primary claim-weapon-btn" data-id="${escapeHtml(h.id)}">Claim</button>`;
      } else if (fullyClaimed) {
        claimActionHtml = `<span class="claimed-badge" style="opacity: 0.65;">${myCount > 0 ? 'In Arsenal' : 'Claimed'}</span>`;
      } else if (isClaimed) {
        claimActionHtml = `<span class="claimed-badge">In Arsenal</span>`;
      }
    } else if (h.type === "item" || h.type === "coin") {
      const btnClass = h.type === "item" ? "claim-item-btn" : "claim-coins-btn";
      const maxClaims = parseInt(h.maxClaims, 10) || 1;
      const claimedCount = parseInt(h.claimedCount, 10) || 0;
      const left = Math.max(0, maxClaims - claimedCount);

      if (canClaim && left > 0) {
        claimActionHtml = `
          <div style="display:inline-flex; align-items:center; gap:0.35rem;">
            ${myCount > 0 ? `<span class="claimed-badge" style="font-size:0.65rem; padding:0.1rem 0.35rem;">Bag: ${myCount}</span>` : ''}
            <button type="button" class="btn btn-xs btn-primary ${btnClass}" data-id="${escapeHtml(h.id)}">Claim</button>
          </div>
        `;
      } else if (fullyClaimed) {
        claimActionHtml = `<span class="claimed-badge" style="opacity: 0.65;">${myCount > 0 ? `Claimed (${myCount})` : 'All Claimed'}</span>`;
      } else if (isClaimed) {
        claimActionHtml = `<span class="claimed-badge">Claimed (${myCount})</span>`;
      }
    }

    let recipientBadge = "";
    if (h.recipient && h.recipient !== "all") {
      recipientBadge = `<span class="tag-pill" style="color:#60a5fa; border-color: rgba(96,165,250,0.3);">${escapeHtml(h.recipient)}</span>`;
    }

    let qtyBadge = "";
    if (h.maxClaims && h.maxClaims > 1) {
      const left = Math.max(0, h.maxClaims - (h.claimedCount || 0));
      qtyBadge = `<span class="tag-pill" style="color:#f59e0b; border-color: rgba(245,158,11,0.3);">${left}/${h.maxClaims} Left</span>`;
    }

    return `
      <div class="handout-card" data-id="${escapeHtml(h.id)}">
        <div class="handout-card-top">
          <span class="handout-type-badge ${badgeClass}">${typeLabel}</span>
          ${recipientBadge}
          ${qtyBadge}
          ${isShared ? `<span class="tag-pill" style="color:#34d399; border-color: rgba(16,185,129,0.3);">Shared</span>` : ''}
        </div>
        <div class="handout-card-title">${escapeHtml(h.title || "Untitled Handout")}</div>
        ${weaponStatHtml}
        <div class="handout-card-snippet">${escapeHtml(snippet || "No details provided...")}</div>
        <div class="handout-card-meta">
          <span>${authorStr} • ${dateStr}</span>
          <div class="handout-card-actions">
            ${claimActionHtml}
            <button type="button" class="btn btn-xs btn-outline open-handout-btn" data-id="${escapeHtml(h.id)}">View</button>
            ${canManage ? `<button type="button" class="btn btn-xs btn-ghost delete-handout-btn" data-id="${escapeHtml(h.id)}" title="Delete">&times;</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function openHandoutViewer(handoutId) {
  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!activeRoom) {
    showStatus("Connect to a party room to view party handouts.");
    return;
  }
  const combined = [...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (!h || !canISeeHandout(h)) return;

  const modal = document.getElementById("handoutModal");
  const viewMode = document.getElementById("handoutViewMode");
  const editMode = document.getElementById("handoutEditMode");
  if (!modal || !viewMode || !editMode) return;

  document.getElementById("handoutModalTitle").textContent = h.title || "Party Handout";
  document.getElementById("parchmentTitle").textContent = h.title || "Ancient Parchment";

  let typeBadgeText = (h.type || "letter").toUpperCase();
  if (h.recipient && h.recipient !== "all") {
    typeBadgeText += ` • FOR: ${h.recipient.toUpperCase()}`;
  }
  document.getElementById("parchmentTypeBadge").textContent = typeBadgeText;
  document.getElementById("parchmentOrigin").textContent = h.author ? `Origin: ${h.author}` : "Origin: Unknown";
  document.getElementById("parchmentDate").textContent = h.date ? `Date: ${h.date}` : "Date: 1492 DR";

  // Seal Icon
  const sealEl = document.getElementById("parchmentSealIcon");
  if (sealEl) {
    sealEl.textContent = "";
  }

  // Interactive Claim Box
  const claimBox = document.getElementById("parchmentClaimBox");
  const claimInfo = document.getElementById("parchmentClaimInfo");
  const claimBtn = document.getElementById("parchmentClaimBtn");
  const isClaimed = myClaimedHandoutIds.includes(h.id);
  const canClaim = canIClaimHandout(h);
  const fullyClaimed = isHandoutFullyClaimed(h);

  if (claimBox && claimInfo && claimBtn) {
    if (h.type === "weapon" && (h.item || h.weapon)) {
      const w = h.weapon || h.item;
      claimBox.style.display = "flex";
      const statParts = [];
      if (w.dmg) statParts.push(`Damage: ${w.dmg}`);
      if (w.type || w.atk) statParts.push(`Type: ${w.type || w.atk}`);
      const statDesc = statParts.length > 0 ? statParts.join(" • ") : "Arsenal Weapon";
      const notesDesc = w.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(w.notes)}</div>` : "";

      claimInfo.innerHTML = `
        <span class="claim-info-title">${escapeHtml(w.name || h.title)}</span>
        <span class="claim-info-sub">${escapeHtml(statDesc)}</span>
        ${notesDesc}
      `;
      if (canClaim) {
        claimBtn.style.display = "inline-flex";
        claimBtn.textContent = "Claim";
        claimBtn.className = "btn btn-primary claim-weapon-btn";
        claimBtn.dataset.id = h.id;
        claimBtn.dataset.type = "weapon";
      } else if (fullyClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += `<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.65;">${myCount > 0 ? 'In Weapons Arsenal' : 'Already claimed'}</span>`;
      } else if (isClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem;">In Weapons Arsenal</span>';
      } else {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.65;">Not claimable</span>';
      }
    } else if (h.type === "item" && h.item) {
      claimBox.style.display = "flex";
      const maxClaims = parseInt(h.maxClaims, 10) || 1;
      const claimedCount = parseInt(h.claimedCount, 10) || 0;
      const left = Math.max(0, maxClaims - claimedCount);
      const myCount = myClaimedHandoutIds.filter((id) => id === h.id).length;

      let countNote = "";
      if (maxClaims > 1) {
        countNote = ` • Available: ${left}/${maxClaims}`;
      }
      if (myCount > 0) {
        countNote += ` (You claimed: ${myCount})`;
      }

      claimInfo.innerHTML = `
        <span class="claim-info-title">${escapeHtml(h.item.name || h.title)} (x${h.item.qty || 1}${countNote})</span>
        <span class="claim-info-sub">Weight: ${h.item.weight || 0} lbs each</span>
      `;
      if (left > 0 && canClaim) {
        claimBtn.style.display = "inline-flex";
        claimBtn.className = "btn btn-primary claim-item-btn";
        claimBtn.dataset.id = h.id;
        claimBtn.dataset.type = "item";
        claimBtn.dataset.qty = "1";
        claimBtn.textContent = "Claim";
      } else if (fullyClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += `<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.75;">All ${maxClaims} claimed${myCount > 0 ? ` (You have ${myCount})` : ''}</span>`;
      } else if (isClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += `<span class="claimed-badge" style="margin-top:0.35rem;">Claimed (${myCount}) in Inventory</span>`;
      } else {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.65;">Not claimable</span>';
      }
    } else if (h.type === "coin" && h.coins) {
      claimBox.style.display = "flex";
      let pills = "";
      if (h.coins.pp) pills += `<span class="coin-pill pp">${h.coins.pp} PP</span>`;
      if (h.coins.gp) pills += `<span class="coin-pill gp">${h.coins.gp} GP</span>`;
      if (h.coins.ep) pills += `<span class="coin-pill ep">${h.coins.ep} EP</span>`;
      if (h.coins.sp) pills += `<span class="coin-pill sp">${h.coins.sp} SP</span>`;
      if (h.coins.cp) pills += `<span class="coin-pill cp">${h.coins.cp} CP</span>`;
      claimInfo.innerHTML = `
        <span class="claim-info-title">Treasure Coins</span>
        <div class="handout-coins-pills">${pills}</div>
      `;
      if (isClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem;">Claimed in Vault</span>';
      } else if (canClaim) {
        claimBtn.style.display = "inline-flex";
        claimBtn.textContent = "Claim";
        claimBtn.className = "btn btn-primary claim-coins-btn";
        claimBtn.dataset.id = h.id;
        claimBtn.dataset.type = "coin";
      } else if (fullyClaimed) {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.65;">All treasure claimed</span>';
      } else {
        claimBtn.style.display = "none";
        claimInfo.innerHTML += '<span class="claimed-badge" style="margin-top:0.35rem; opacity:0.65;">Not claimable</span>';
      }
    } else {
      claimBox.style.display = "none";
    }
  }

  const imgWrap = document.getElementById("parchmentImageWrap");
  const imgEl = document.getElementById("parchmentImage");
  if (imgWrap && imgEl) {
    if (h.imageUrl && h.imageUrl.trim()) {
      imgEl.src = h.imageUrl.trim();
      imgWrap.style.display = "block";
    } else {
      imgWrap.style.display = "none";
    }
  }

  document.getElementById("parchmentContent").textContent = h.content || "";

  // Only allow DM or creator to edit/reshare
  const canManage = canIEditOrDeleteHandout(h);
  const editBtn = document.getElementById("editCurrentHandoutBtn");
  const shareBtn = document.getElementById("shareCurrentHandoutBtn");
  if (editBtn) {
    editBtn.style.display = canManage ? "inline-flex" : "none";
    editBtn.dataset.id = h.id;
  }
  if (shareBtn) {
    shareBtn.style.display = canManage ? "inline-flex" : "none";
    shareBtn.dataset.id = h.id;
  }

  viewMode.style.display = "block";
  editMode.style.display = "none";
  modal.classList.add("open");
}

/* ==========================================================================
   PARTY HANDOUTS & LOOT SYSTEM (ENHANCED PRESETS & WORKFLOWS)
   ========================================================================== */

const SIMPLE_WEAPONS = [
  // Most Common & Popular Standard Weapons
  { label: "Dagger", name: "Dagger", dmg: "1d4", type: "Piercing", notes: "Finesse, Light, Thrown (20/60)" },
  { label: "Shortsword", name: "Shortsword", dmg: "1d6", type: "Piercing", notes: "Finesse, Light" },
  { label: "Longsword", name: "Longsword", dmg: "1d8", type: "Slashing", notes: "Versatile (1d10)" },
  { label: "Greatsword", name: "Greatsword", dmg: "2d6", type: "Slashing", notes: "Heavy, Two-Handed" },
  { label: "Shortbow", name: "Shortbow", dmg: "1d6", type: "Piercing", notes: "Ammunition (80/320), Two-Handed" },
  { label: "Longbow", name: "Longbow", dmg: "1d8", type: "Piercing", notes: "Ammunition (150/600), Heavy, Two-Handed" },
  { label: "Light Crossbow", name: "Light Crossbow", dmg: "1d8", type: "Piercing", notes: "Ammunition (80/320), Loading, Two-Handed" },
  { label: "Heavy Crossbow", name: "Heavy Crossbow", dmg: "1d10", type: "Piercing", notes: "Ammunition (100/400), Heavy, Loading, Two-Handed" },
  { label: "Hand Crossbow", name: "Hand Crossbow", dmg: "1d6", type: "Piercing", notes: "Ammunition (30/120), Light, Loading" },
  { label: "Rapier", name: "Rapier", dmg: "1d8", type: "Piercing", notes: "Finesse" },
  { label: "Scimitar", name: "Scimitar", dmg: "1d6", type: "Slashing", notes: "Finesse, Light" },
  { label: "Handaxe", name: "Handaxe", dmg: "1d6", type: "Slashing", notes: "Light, Thrown (20/60)" },
  { label: "Battleaxe", name: "Battleaxe", dmg: "1d8", type: "Slashing", notes: "Versatile (1d10)" },
  { label: "Greataxe", name: "Greataxe", dmg: "1d12", type: "Slashing", notes: "Heavy, Two-Handed" },
  { label: "Spear", name: "Spear", dmg: "1d6", type: "Piercing", notes: "Thrown (20/60), Versatile (1d8)" },
  { label: "Quarterstaff", name: "Quarterstaff", dmg: "1d6", type: "Bludgeoning", notes: "Versatile (1d8)" },
  { label: "Mace", name: "Mace", dmg: "1d6", type: "Bludgeoning", notes: "" },
  { label: "Warhammer", name: "Warhammer", dmg: "1d8", type: "Bludgeoning", notes: "Versatile (1d10)" },
  { label: "Maul", name: "Maul", dmg: "2d6", type: "Bludgeoning", notes: "Heavy, Two-Handed" },
  { label: "Javelin", name: "Javelin", dmg: "1d6", type: "Piercing", notes: "Thrown (30/120)" },
  { label: "Halberd", name: "Halberd", dmg: "1d10", type: "Slashing", notes: "Heavy, Reach, Two-Handed" },
  { label: "Glaive", name: "Glaive", dmg: "1d10", type: "Slashing", notes: "Heavy, Reach, Two-Handed" },
  { label: "Pike", name: "Pike", dmg: "1d10", type: "Piercing", notes: "Heavy, Reach, Two-Handed" },
  { label: "Trident", name: "Trident", dmg: "1d6", type: "Piercing", notes: "Thrown (20/60), Versatile (1d8)" },
  { label: "Club", name: "Club", dmg: "1d4", type: "Bludgeoning", notes: "Light" },
  { label: "Greatclub", name: "Greatclub", dmg: "1d8", type: "Bludgeoning", notes: "Two-Handed" },
  { label: "Light Hammer", name: "Light Hammer", dmg: "1d4", type: "Bludgeoning", notes: "Light, Thrown (20/60)" },
  { label: "Sickle", name: "Sickle", dmg: "1d4", type: "Slashing", notes: "Light" },
  { label: "Dart", name: "Dart", dmg: "1d4", type: "Piercing", notes: "Finesse, Thrown (20/60)" },
  { label: "Sling", name: "Sling", dmg: "1d4", type: "Bludgeoning", notes: "Ammunition (30/120)" },
  { label: "Whip", name: "Whip", dmg: "1d4", type: "Slashing", notes: "Finesse, Reach" },
  { label: "Morningstar", name: "Morningstar", dmg: "1d8", type: "Piercing", notes: "" },
  { label: "Flail", name: "Flail", dmg: "1d8", type: "Bludgeoning", notes: "" },
  { label: "War Pick", name: "War Pick", dmg: "1d8", type: "Piercing", notes: "" },
  { label: "Lance", name: "Lance", dmg: "1d12", type: "Piercing", notes: "Reach, Special" },
  { label: "Blowgun", name: "Blowgun", dmg: "1", type: "Piercing", notes: "Ammunition (25/100), Loading" },
  { label: "Net", name: "Net", dmg: "—", type: "Special", notes: "Thrown (5/15), Special" },
  { label: "Unarmed Strike", name: "Unarmed Strike", dmg: "1", type: "Bludgeoning", notes: "" }
];

function renderHandoutPresets(filterQuery = "") {
  const bar = document.getElementById("handoutPresetsBar");
  if (!bar) return;
  const q = (typeof filterQuery === "string" ? filterQuery : (document.getElementById("quickWeaponFilterInput")?.value || "")).trim().toLowerCase();
  const list = q
    ? SIMPLE_WEAPONS.map((p, idx) => ({ ...p, origIdx: idx })).filter((p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q))
    : SIMPLE_WEAPONS.map((p, idx) => ({ ...p, origIdx: idx }));

  if (list.length === 0) {
    bar.innerHTML = `<span style="font-size:0.72rem; color:var(--text-dim); font-style:italic;">No weapons match "${escapeHtml(q)}".</span>`;
    return;
  }
  bar.innerHTML = list.map((p) => `
    <button type="button" class="handout-preset-chip" data-preset-index="${p.origIdx}">
      ${p.label}
    </button>
  `).join("");
}

function applyLootPreset(index) {
  const p = SIMPLE_WEAPONS[index];
  if (!p) return;

  const typeSelect = document.getElementById("handoutFormType");
  if (typeSelect && typeSelect.value !== "weapon") {
    typeSelect.value = "weapon";
    updateHandoutFormVisibility();
  }

  const nameEl = document.getElementById("handoutWpnName");
  const dmgEl = document.getElementById("handoutWpnDmg");
  const typeEl = document.getElementById("handoutWpnType");
  const notesEl = document.getElementById("handoutWpnNotes");
  if (nameEl) nameEl.value = p.name || "";
  if (dmgEl) dmgEl.value = p.dmg || "";
  if (typeEl) typeEl.value = p.type || "";
  if (notesEl) notesEl.value = p.notes || "";
  showStatus(`Applied: ${p.name}`);
}

function updateHandoutCoinSplit() {
  const cp = parseInt(document.getElementById("handoutCoinCP")?.value, 10) || 0;
  const sp = parseInt(document.getElementById("handoutCoinSP")?.value, 10) || 0;
  const ep = parseInt(document.getElementById("handoutCoinEP")?.value, 10) || 0;
  const gp = parseInt(document.getElementById("handoutCoinGP")?.value, 10) || 0;
  const pp = parseInt(document.getElementById("handoutCoinPP")?.value, 10) || 0;

  const totalGP = (pp * 10) + gp + (ep * 0.5) + (sp * 0.1) + (cp * 0.01);
  const partyCount = (Array.isArray(cachedRoomMembers) && cachedRoomMembers.length > 0)
    ? Math.max(1, cachedRoomMembers.filter(m => m && !m.isDM && m.name !== "Dungeon Master" && m.id !== "dm_presence").length)
    : 4;

  const splitVal = (totalGP / partyCount).toFixed(1);
  const splitEl = document.getElementById("coinSplitText");
  if (splitEl) {
    splitEl.innerHTML = `Total Value: <strong>~${Math.round(totalGP)} GP</strong> • Split: <strong>~${splitVal} GP</strong> per adventurer (${partyCount} in party)`;
  }
}

function playLootClaimSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    if (type === "coin") {
      [1046.5, 1318.5, 1567.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.06, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    } else if (type === "weapon") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {}
}

function openHandoutGiftPicker() {
  const options = [];
  if (Array.isArray(myCharacterWeapons)) {
    myCharacterWeapons.forEach((w) => {
      if (w && w.name?.trim()) {
        options.push({ category: "weapon", name: w.name, dmg: w.dmg || "", type: w.type || "", notes: w.notes || "" });
      }
    });
  }
  if (Array.isArray(myStructuredInventory)) {
    myStructuredInventory.forEach((item) => {
      if (item && item.name?.trim()) {
        options.push({ category: "item", name: item.name, qty: item.qty || 1, weight: item.weight || 0, notes: item.notes || "" });
      }
    });
  }

  if (options.length === 0) {
    showStatus("Your Weapons Arsenal and Inventory are empty.");
    return;
  }

  const promptText = options.map((opt, i) => `${i + 1}. [${opt.category === "weapon" ? "Weapon" : "Item"}] ${opt.name}`).join("\n");
  const choice = prompt(`Select an item/weapon from your sheet to gift (enter number 1-${options.length}):\n\n${promptText}`);
  if (!choice) return;
  const num = parseInt(choice, 10);
  if (isNaN(num) || num < 1 || num > options.length) {
    showStatus("Invalid selection.");
    return;
  }

  const chosen = options[num - 1];
  const typeSelect = document.getElementById("handoutFormType");
  if (typeSelect) {
    typeSelect.value = chosen.category;
    updateHandoutFormVisibility();
  }

  if (chosen.category === "weapon") {
    const nameEl = document.getElementById("handoutWpnName");
    const dmgEl = document.getElementById("handoutWpnDmg");
    const typeEl = document.getElementById("handoutWpnType");
    const notesEl = document.getElementById("handoutWpnNotes");
    if (nameEl) nameEl.value = chosen.name;
    if (dmgEl) dmgEl.value = chosen.dmg;
    if (typeEl) typeEl.value = chosen.type;
    if (notesEl) notesEl.value = chosen.notes;
  } else {
    const nameEl = document.getElementById("handoutItemName");
    const qtyEl = document.getElementById("handoutItemQty");
    const weightEl = document.getElementById("handoutItemWeight");
    const notesEl = document.getElementById("handoutFormContent");
    if (nameEl) nameEl.value = chosen.name;
    if (qtyEl) qtyEl.value = chosen.qty;
    if (weightEl) weightEl.value = chosen.weight;
    if (notesEl) notesEl.value = chosen.notes;
  }

  showStatus(`Loaded "${chosen.name}" from your sheet! Choose recipient and click Award.`);
}

function updateHandoutFormVisibility() {
  const typeSelect = document.getElementById("handoutFormType");
  const val = typeSelect?.value || "weapon";
  const wpnBox = document.getElementById("handoutWeaponFields");
  const itemBox = document.getElementById("handoutItemFields");
  const coinBox = document.getElementById("handoutCoinFields");
  const stdBox = document.getElementById("handoutStandardFields");
  const presetsWrap = document.getElementById("handoutPresetsWrap");
  const label = document.getElementById("handoutContentLabel");
  const content = document.getElementById("handoutFormContent");

  // Sync category visual nav pills
  document.querySelectorAll(".handout-cat-btn").forEach((btn) => {
    if (btn.dataset.type) {
      btn.classList.toggle("active", btn.dataset.type === val);
    }
  });

  // Render presets (all simple weapons) and display when on weapon category
  if (presetsWrap) {
    presetsWrap.style.display = (val === "weapon") ? "block" : "none";
  }
  if (val === "weapon") {
    renderHandoutPresets();
  }

  if (wpnBox) wpnBox.style.display = (val === "weapon") ? "block" : "none";
  if (itemBox) itemBox.style.display = (val === "item") ? "block" : "none";
  if (coinBox) {
    coinBox.style.display = (val === "coin") ? "block" : "none";
    if (val === "coin") updateHandoutCoinSplit();
  }
  if (stdBox) stdBox.style.display = (val === "weapon" || val === "item" || val === "coin") ? "none" : "block";

  if (label && content) {
    if (val === "weapon") {
      label.textContent = "Weapon Lore & Special Effects";
      content.placeholder = "e.g. Forged by dwarven smiths of Mithral Hall. On a critical hit, deals extra fire damage...";
    } else if (val === "item") {
      label.textContent = "Item Description & Properties";
      content.placeholder = "e.g. Requires attunement. While holding this magical item, you gain...";
    } else if (val === "coin") {
      label.textContent = "Treasure Message / Notes";
      content.placeholder = "e.g. Loot retrieved from the necromancer's chest in the crypt...";
    } else {
      label.textContent = "Description & Lore Notes";
      content.placeholder = "Write or paste the letter, clue, contract or message here...";
    }
  }
}

function openHandoutEditor(handoutId = null) {
  const activeRoom = (connectedCampaignRoom || activeDMRoomCode || "").trim().toUpperCase();
  if (!activeRoom) {
    showStatus("Connect to a party room to create or edit handouts.");
    openPartyModal();
    return;
  }
  let preselectedType = null;
  if (typeof handoutId === "string" && ["weapon", "item", "coin", "letter"].includes(handoutId)) {
    preselectedType = handoutId;
    handoutId = null;
  }

  const modal = document.getElementById("handoutModal");
  const viewMode = document.getElementById("handoutViewMode");
  const editMode = document.getElementById("handoutEditMode");
  if (!modal || !viewMode || !editMode) return;

  const combined = [...partyRoomHandouts];
  const existingHandout = handoutId ? combined.find((item) => item.id === handoutId) : null;

  if (existingHandout && !canIEditOrDeleteHandout(existingHandout)) {
    showStatus("Only the DM or creator can edit this handout.");
    return;
  }

  const hiddenId = document.getElementById("editingHandoutId");
  const titleInput = document.getElementById("handoutFormTitle");
  const typeSelect = document.getElementById("handoutFormType");
  const recipientSelect = document.getElementById("handoutFormRecipient");
  const authorInput = document.getElementById("handoutFormAuthor");
  const dateInput = document.getElementById("handoutFormDate");
  const imageInput = document.getElementById("handoutFormImageUrl");
  const contentInput = document.getElementById("handoutFormContent");

  const wpnNameInput = document.getElementById("handoutWpnName");
  const wpnDmgInput = document.getElementById("handoutWpnDmg");
  const wpnTypeInput = document.getElementById("handoutWpnType");
  const wpnNotesInput = document.getElementById("handoutWpnNotes");
  const wpnWeightInput = document.getElementById("handoutWpnWeight");

  const itemNameInput = document.getElementById("handoutItemName");
  const itemQtyInput = document.getElementById("handoutItemQty");
  const itemWeightInput = document.getElementById("handoutItemWeight");

  const coinCP = document.getElementById("handoutCoinCP");
  const coinSP = document.getElementById("handoutCoinSP");
  const coinEP = document.getElementById("handoutCoinEP");
  const coinGP = document.getElementById("handoutCoinGP");
  const coinPP = document.getElementById("handoutCoinPP");

  if (typeSelect) {
    typeSelect.onchange = updateHandoutFormVisibility;
  }

  // Populate recipient options with connected party members (excluding DM)
  if (recipientSelect) {
    let opts = '<option value="all">Everyone in Party</option>';
    let chipsHtml = `<button type="button" class="recipient-chip ${(!existingHandout || existingHandout.recipient === 'all') ? 'active' : ''}" data-recipient="all">Everyone in Party</button>`;

    if (Array.isArray(cachedRoomMembers)) {
      cachedRoomMembers.forEach((m) => {
        if (!m) return;
        const mid = String(m.id || "");
        const mname = String(m.name || "");
        const mclass = String(m.charClass || "");
        if (mid === "dm_presence" || mid.startsWith("dm_") || mname === "Dungeon Master" || mclass === "DM" || m.isDM) {
          return;
        }
        if (m.name) {
          const isSelected = existingHandout && (existingHandout.recipient === m.name || existingHandout.recipientId === m.id);
          opts += `<option value="${escapeHtml(m.name)}" data-member-id="${escapeHtml(m.id || "")}" ${isSelected ? "selected" : ""}>${escapeHtml(m.name)}</option>`;
          chipsHtml += `<button type="button" class="recipient-chip ${isSelected ? 'active' : ''}" data-recipient="${escapeHtml(m.name)}" data-member-id="${escapeHtml(m.id || '')}">${escapeHtml(m.name)}</button>`;
        }
      });
    }
    recipientSelect.innerHTML = opts;
    const chipsContainer = document.getElementById("handoutRecipientChips");
    if (chipsContainer) chipsContainer.innerHTML = chipsHtml;
  }

  if (existingHandout) {
    const h = existingHandout;
    if (hiddenId) hiddenId.value = h.id;
    if (typeSelect) typeSelect.value = h.type || "weapon";
    if (recipientSelect) recipientSelect.value = h.recipient || "all";
    if (titleInput) titleInput.value = h.title || "";
    if (authorInput) authorInput.value = h.author || "";
    if (dateInput) dateInput.value = h.date || "";
    if (imageInput) imageInput.value = h.imageUrl || "";
    if (contentInput) contentInput.value = h.content || "";

    if (h.type === "weapon" || h.item?.isWeapon) {
      const w = h.weapon || h.item || {};
      if (wpnNameInput) wpnNameInput.value = w.name || h.title || "";
      if (wpnDmgInput) wpnDmgInput.value = w.dmg || "";
      if (wpnTypeInput) wpnTypeInput.value = w.type || w.atk || "";
      if (wpnNotesInput) wpnNotesInput.value = w.notes || "";
      if (wpnWeightInput) wpnWeightInput.value = (w.weight !== undefined) ? w.weight : 0;
    } else {
      if (wpnNameInput) wpnNameInput.value = "";
      if (wpnDmgInput) wpnDmgInput.value = "";
      if (wpnTypeInput) wpnTypeInput.value = "";
      if (wpnNotesInput) wpnNotesInput.value = "";
      if (wpnWeightInput) wpnWeightInput.value = 0;
    }

    if (h.item && !h.item?.isWeapon) {
      if (itemNameInput) itemNameInput.value = h.item.name || h.title || "";
      if (itemQtyInput) itemQtyInput.value = h.item.qty || 1;
      if (itemWeightInput) itemWeightInput.value = h.item.weight || 0;
    }
    if (h.coins) {
      if (coinCP) coinCP.value = h.coins.cp || 0;
      if (coinSP) coinSP.value = h.coins.sp || 0;
      if (coinEP) coinEP.value = h.coins.ep || 0;
      if (coinGP) coinGP.value = h.coins.gp || 0;
      if (coinPP) coinPP.value = h.coins.pp || 0;
    }
    document.getElementById("handoutModalTitle").textContent = "Edit Handout";
  } else {
    if (hiddenId) hiddenId.value = "";
    if (typeSelect) typeSelect.value = preselectedType || "weapon";
    if (recipientSelect) recipientSelect.value = "all";
    if (titleInput) titleInput.value = "";
    if (authorInput) authorInput.value = "";
    if (dateInput) dateInput.value = "";
    if (imageInput) imageInput.value = "";
    if (contentInput) contentInput.value = "";

    if (wpnNameInput) wpnNameInput.value = "";
    if (wpnDmgInput) wpnDmgInput.value = "";
    if (wpnTypeInput) wpnTypeInput.value = "";
    if (wpnNotesInput) wpnNotesInput.value = "";
    if (wpnWeightInput) wpnWeightInput.value = 0;

    if (itemNameInput) itemNameInput.value = "";
    if (itemQtyInput) itemQtyInput.value = 1;
    if (itemWeightInput) itemWeightInput.value = 0;

    if (coinCP) coinCP.value = 0;
    if (coinSP) coinSP.value = 0;
    if (coinEP) coinEP.value = 0;
    if (coinGP) coinGP.value = 0;
    if (coinPP) coinPP.value = 0;

    document.getElementById("handoutModalTitle").textContent = "New Handout / Reward";
  }

  const filterInput = document.getElementById("quickWeaponFilterInput");
  if (filterInput) filterInput.value = "";
  updateHandoutFormVisibility();
  viewMode.style.display = "none";
  editMode.style.display = "block";
  modal.classList.add("open");
}

function saveHandoutFromForm(isDraft = false) {
  const id = document.getElementById("editingHandoutId")?.value || ("handout_" + Date.now());
  const type = document.getElementById("handoutFormType")?.value || "weapon";
  const recipientSelect = document.getElementById("handoutFormRecipient");
  const recipient = recipientSelect?.value || "all";
  const recipientId = recipientSelect?.selectedOptions?.[0]?.dataset?.memberId || "";
  const content = document.getElementById("handoutFormContent")?.value || "";

  let title = "";
  let author = "";
  let date = "";
  let imageUrl = "";
  let itemData = null;
  let coinData = null;
  let maxClaims = 1;

  if (type === "weapon") {
    const wpnName = document.getElementById("handoutWpnName")?.value.trim() || "Mystic Weapon";
    const wpnDmg = document.getElementById("handoutWpnDmg")?.value.trim() || "";
    const wpnType = document.getElementById("handoutWpnType")?.value.trim() || "";
    const wpnNotes = document.getElementById("handoutWpnNotes")?.value.trim() || "";
    title = wpnName;
    itemData = {
      name: wpnName,
      dmg: wpnDmg,
      type: wpnType,
      notes: wpnNotes,
      qty: 1,
      isWeapon: true
    };
    maxClaims = 1;
  } else if (type === "item") {
    const itemName = document.getElementById("handoutItemName")?.value.trim() || "Mysterious Item";
    const itemQty = parseInt(document.getElementById("handoutItemQty")?.value, 10) || 1;
    const itemWeight = parseFloat(document.getElementById("handoutItemWeight")?.value) || 0;
    title = itemName;
    itemData = {
      name: itemName,
      qty: itemQty,
      weight: itemWeight,
      isWeapon: false
    };
    // Total available claims is the item quantity
    maxClaims = Math.max(1, itemQty);
  } else if (type === "coin") {
    const cp = parseInt(document.getElementById("handoutCoinCP")?.value, 10) || 0;
    const sp = parseInt(document.getElementById("handoutCoinSP")?.value, 10) || 0;
    const ep = parseInt(document.getElementById("handoutCoinEP")?.value, 10) || 0;
    const gp = parseInt(document.getElementById("handoutCoinGP")?.value, 10) || 0;
    const pp = parseInt(document.getElementById("handoutCoinPP")?.value, 10) || 0;
    coinData = { cp, sp, ep, gp, pp };
    const parts = [];
    if (pp) parts.push(`${pp} PP`);
    if (gp) parts.push(`${gp} GP`);
    if (ep) parts.push(`${ep} EP`);
    if (sp) parts.push(`${sp} SP`);
    if (cp) parts.push(`${cp} CP`);
    title = parts.length > 0 ? parts.join(", ") : "Treasure Coins";
    maxClaims = 1;
  } else {
    title = document.getElementById("handoutFormTitle")?.value.trim() || "Untitled Handout";
    author = document.getElementById("handoutFormAuthor")?.value.trim() || "";
    date = document.getElementById("handoutFormDate")?.value.trim() || "";
    imageUrl = document.getElementById("handoutFormImageUrl")?.value.trim() || "";
    maxClaims = 1;
  }

  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === (connectedCampaignRoom || activeDMRoomCode));

  const handoutObj = {
    id,
    title,
    type,
    recipient,
    recipientId,
    claimedBy: [],
    claimedCount: 0,
    maxClaims,
    author: author || (isDM ? "Dungeon Master" : (document.getElementById("charName")?.value?.trim() || "Adventurer")),
    authorUid: auth?.currentUser?.uid || "anon",
    date: date || new Date().toLocaleDateString(),
    imageUrl,
    content,
    item: itemData,
    coins: coinData,
    isShared: false,
    updatedAt: Date.now()
  };

  const existingIdx = myHandouts.findIndex((h) => h.id === id);
  if (existingIdx >= 0) {
    myHandouts[existingIdx] = { ...myHandouts[existingIdx], ...handoutObj };
  } else {
    myHandouts.unshift(handoutObj);
  }

  renderHandoutsGrid();
  saveSheet(false);
  closeModal("handoutModal");

  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  if (isDraft) {
    showStatus(`Saved "${title}" to your private stash!`);
  } else if (activeRoom) {
    shareHandoutToParty(id);
  } else {
    showStatus(`Handout "${title}" saved!`);
  }
}

async function claimHandoutWeapon(handoutId) {
  const combined = [...myHandouts, ...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (!h) return;
  const w = h.weapon || h.item;
  if (!w) return;

  if (!canIClaimHandout(h)) {
    if (isHandoutFullyClaimed(h)) {
      showStatus("This weapon has already been claimed!");
    } else {
      showStatus("This handout is not assigned to you.");
    }
    return;
  }

  playLootClaimSound("weapon");

  const weaponName = w.name || h.title || "Weapon";
  const weaponDmg = w.dmg || "";
  const weaponType = w.type || w.atk || "";
  const weaponNotes = w.notes || h.content || "";

  // 1. Add directly to Weapons Arsenal (myCharacterWeapons on Combat tab)
  if (!Array.isArray(myCharacterWeapons)) myCharacterWeapons = [];

  // Search for an empty row to fill first
  const emptyIndex = myCharacterWeapons.findIndex(
    (wpn) => !wpn.name && !wpn.dmg && !wpn.type && !wpn.atk && !wpn.notes
  );

  const newWeapon = {
    name: weaponName,
    dmg: weaponDmg,
    type: weaponType,
    notes: weaponNotes
  };

  if (emptyIndex !== -1) {
    myCharacterWeapons[emptyIndex] = newWeapon;
  } else {
    myCharacterWeapons.push(newWeapon);
  }

  // Handed out weapons only go into Arsenal, not into inventory

  // 2. Mark as claimed locally
  myClaimedHandoutIds.push(handoutId);

  // 4. Update claim counts on shared handout in Firestore
  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  const myIdentifier = activeCharId || document.getElementById("charName")?.value?.trim() || "Adventurer";
  const nextClaimedBy = Array.isArray(h.claimedBy) ? [...h.claimedBy] : [];
  if (!nextClaimedBy.includes(myIdentifier)) nextClaimedBy.push(myIdentifier);
  const nextClaimedCount = (parseInt(h.claimedCount, 10) || 0) + 1;
  const isNowMax = nextClaimedCount >= (parseInt(h.maxClaims, 10) || 1);

  h.claimedBy = nextClaimedBy;
  h.claimedCount = nextClaimedCount;

  if (db && activeRoom) {
    try {
      await db.collection("campaigns").doc(activeRoom).collection("handouts").doc(handoutId).set({
        claimedBy: nextClaimedBy,
        claimedCount: nextClaimedCount,
        updatedAt: Date.now()
      }, { merge: true });

      // If max amount is claimed, remove chat announcement
      if (isNowMax) {
        const chatSnaps = await db.collection("campaigns").doc(activeRoom).collection("chat")
          .where("type", "==", "handout")
          .get();
        chatSnaps.forEach((doc) => {
          const d = doc.data();
          if (d.payload && d.payload.id === handoutId) {
            doc.ref.delete().catch((e) => console.warn("Could not delete claimed weapon chat message:", e));
          }
        });
      }
    } catch (e) {
      console.warn("Could not sync weapon claim to Firestore:", e);
    }
  }

  renderWeapons();
  renderStructuredInventory();
  updateWealthAndEncumbrance();
  renderHandoutsGrid();
  renderPartyChatMessages();
  saveSheet(true);

  if (document.getElementById("handoutModal")?.classList.contains("open")) {
    openHandoutViewer(handoutId);
  }

  showStatus(`"${weaponName}" claimed! Added directly to your Weapons Arsenal.`);
}

async function claimHandoutItem(handoutId, qtyToClaim = 1) {
  const combined = [...myHandouts, ...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (!h || !h.item) return;

  if (!canIClaimHandout(h)) {
    if (isHandoutFullyClaimed(h)) {
      showStatus("This loot item has already been fully claimed!");
    } else {
      showStatus("This handout is not assigned to you.");
    }
    return;
  }

  playLootClaimSound("item");

  if (!Array.isArray(myStructuredInventory)) myStructuredInventory = [];

  const maxClaims = parseInt(h.maxClaims, 10) || 1;
  const currentClaimed = parseInt(h.claimedCount, 10) || 0;
  const remaining = Math.max(1, maxClaims - currentClaimed);
  const countClaimed = Math.min(Math.max(1, parseInt(qtyToClaim, 10) || 1), remaining);

  const itemName = h.item.name || h.title || "Loot Item";
  const itemWeight = parseFloat(h.item.weight) || 0;

  // Stacking: If an item with the same name already exists in inventory, increment quantity!
  const existingItem = myStructuredInventory.find(
    (it) => it.name && it.name.trim().toLowerCase() === itemName.trim().toLowerCase()
  );

  if (existingItem) {
    existingItem.qty = (parseInt(existingItem.qty, 10) || 0) + countClaimed;
  } else {
    myStructuredInventory.push({
      equipped: false,
      name: itemName,
      qty: countClaimed,
      weight: itemWeight,
      notes: h.content || ""
    });
  }

  // Record claim
  for (let i = 0; i < countClaimed; i++) {
    myClaimedHandoutIds.push(handoutId);
  }

  // Update claim counts on shared handout
  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  const myIdentifier = activeCharId || document.getElementById("charName")?.value?.trim() || "Adventurer";
  const nextClaimedBy = Array.isArray(h.claimedBy) ? [...h.claimedBy] : [];
  if (!nextClaimedBy.includes(myIdentifier)) nextClaimedBy.push(myIdentifier);
  const nextClaimedCount = currentClaimed + countClaimed;
  const isNowMax = nextClaimedCount >= maxClaims;

  h.claimedBy = nextClaimedBy;
  h.claimedCount = nextClaimedCount;

  if (db && activeRoom) {
    try {
      await db.collection("campaigns").doc(activeRoom).collection("handouts").doc(handoutId).set({
        claimedBy: nextClaimedBy,
        claimedCount: nextClaimedCount,
        updatedAt: Date.now()
      }, { merge: true });

      // If max amount is claimed, delete chat message so it disappears from party chat
      if (isNowMax) {
        const chatSnaps = await db.collection("campaigns").doc(activeRoom).collection("chat")
          .where("type", "==", "handout")
          .get();
        chatSnaps.forEach((doc) => {
          const d = doc.data();
          if (d.payload && d.payload.id === handoutId) {
            doc.ref.delete().catch((e) => console.warn("Could not delete claimed handout chat message:", e));
          }
        });
      }
    } catch (e) {
      console.warn("Could not sync handout claim to Firestore:", e);
    }
  }

  renderStructuredInventory();
  updateWealthAndEncumbrance();
  renderHandoutsGrid();
  renderPartyChatMessages();
  saveSheet(false);

  if (document.getElementById("handoutModal")?.classList.contains("open")) {
    openHandoutViewer(handoutId);
  }

  const claimQtyMsg = countClaimed > 1 ? ` (x${countClaimed})` : "";
  showStatus(`Added "${itemName}"${claimQtyMsg} to your inventory!`);
}

async function claimHandoutCoins(handoutId) {
  const combined = [...myHandouts, ...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (!h || !h.coins) return;

  if (!canIClaimHandout(h)) {
    if (isHandoutFullyClaimed(h)) {
      showStatus("These coins have already been claimed!");
    } else if (myClaimedHandoutIds.includes(handoutId)) {
      showStatus("You have already claimed these coins!");
    } else {
      showStatus("This handout is not assigned to you.");
    }
    return;
  }

  playLootClaimSound("coin");

  const cpInput = document.getElementById("coin_cp");
  const spInput = document.getElementById("coin_sp");
  const epInput = document.getElementById("coin_ep");
  const gpInput = document.getElementById("coin_gp");
  const ppInput = document.getElementById("coin_pp");

  if (cpInput && h.coins.cp) cpInput.value = (parseInt(cpInput.value, 10) || 0) + (parseInt(h.coins.cp, 10) || 0);
  if (spInput && h.coins.sp) spInput.value = (parseInt(spInput.value, 10) || 0) + (parseInt(h.coins.sp, 10) || 0);
  if (epInput && h.coins.ep) epInput.value = (parseInt(epInput.value, 10) || 0) + (parseInt(h.coins.ep, 10) || 0);
  if (gpInput && h.coins.gp) gpInput.value = (parseInt(gpInput.value, 10) || 0) + (parseInt(h.coins.gp, 10) || 0);
  if (ppInput && h.coins.pp) ppInput.value = (parseInt(ppInput.value, 10) || 0) + (parseInt(h.coins.pp, 10) || 0);

  myClaimedHandoutIds.push(handoutId);

  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  const myIdentifier = activeCharId || document.getElementById("charName")?.value?.trim() || "Adventurer";
  const nextClaimedBy = Array.isArray(h.claimedBy) ? [...h.claimedBy] : [];
  if (!nextClaimedBy.includes(myIdentifier)) nextClaimedBy.push(myIdentifier);
  const nextClaimedCount = (parseInt(h.claimedCount, 10) || 0) + 1;
  const isNowMax = nextClaimedCount >= (parseInt(h.maxClaims, 10) || 1);

  h.claimedBy = nextClaimedBy;
  h.claimedCount = nextClaimedCount;

  if (db && activeRoom) {
    try {
      await db.collection("campaigns").doc(activeRoom).collection("handouts").doc(handoutId).set({
        claimedBy: nextClaimedBy,
        claimedCount: nextClaimedCount,
        updatedAt: Date.now()
      }, { merge: true });

      if (isNowMax) {
        const chatSnaps = await db.collection("campaigns").doc(activeRoom).collection("chat")
          .where("type", "==", "handout")
          .get();
        chatSnaps.forEach((doc) => {
          const d = doc.data();
          if (d.payload && d.payload.id === handoutId) {
            doc.ref.delete().catch((e) => console.warn("Could not delete claimed handout chat message:", e));
          }
        });
      }
    } catch (e) {
      console.warn("Could not sync coin claim to Firestore:", e);
    }
  }

  updateWealthAndEncumbrance();
  renderHandoutsGrid();
  renderPartyChatMessages();
  saveSheet(false);

  if (document.getElementById("handoutModal")?.classList.contains("open")) {
    openHandoutViewer(handoutId);
  }

  showStatus("Claimed treasure coins! Added to your Vault.");
}

async function deleteHandout(handoutId) {
  const combined = [...myHandouts, ...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (h && !canIEditOrDeleteHandout(h)) {
    showStatus("Only the DM or creator can delete this handout.");
    return;
  }

  if (!confirm("Are you sure you want to delete this handout?")) return;
  myHandouts = myHandouts.filter((item) => item.id !== handoutId);
  partyRoomHandouts = partyRoomHandouts.filter((item) => item.id !== handoutId);

  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  if (db && activeRoom) {
    try {
      await db.collection("campaigns").doc(activeRoom).collection("handouts").doc(handoutId).delete();
      const chatSnaps = await db.collection("campaigns").doc(activeRoom).collection("chat")
        .where("type", "==", "handout")
        .get();
      chatSnaps.forEach((doc) => {
        if (doc.data()?.payload?.id === handoutId) {
          doc.ref.delete().catch(() => {});
        }
      });
    } catch (e) {
      console.warn("Could not delete handout from Firestore:", e);
    }
  }

  renderHandoutsGrid();
  renderPartyChatMessages();
  saveSheet(false);
  closeModal("handoutModal");
  showStatus("Handout deleted.");
}

async function shareHandoutToParty(handoutId) {
  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  if (!db || !activeRoom) {
    showStatus("Connect to a party room to share handouts!");
    return;
  }

  const combined = [...myHandouts, ...partyRoomHandouts];
  const h = combined.find((item) => item.id === handoutId);
  if (!h) return;

  try {
    h.isShared = true;
    await db.collection("campaigns").doc(activeRoom).collection("handouts").doc(h.id).set(h, { merge: true });

    let chatText = `Shared a new handout: "${h.title}"`;
    if (h.type === "weapon") {
      chatText = h.recipient && h.recipient !== "all"
        ? `Awarded weapon to ${h.recipient}: "${h.title}"`
        : `Awarded weapon: "${h.title}"`;
    } else if (h.type === "item") {
      chatText = h.recipient && h.recipient !== "all"
        ? `Handed out loot for ${h.recipient}: "${h.title}"`
        : `Handed out loot: "${h.title}"`;
    } else if (h.type === "coin") {
      chatText = h.recipient && h.recipient !== "all"
        ? `Distributed treasure to ${h.recipient}: ${h.title}`
        : `Distributed treasure: ${h.title}`;
    }

    await sendPartyChatMessage(chatText, "handout", h);
    renderHandoutsGrid();
    renderPartyChatMessages();
    showStatus(`Shared "${h.title}" with the party!`);
  } catch (err) {
    console.error("Failed to share handout:", err);
    showStatus("Could not share handout to party room.");
  }
}

function startPartyHandoutsListener(roomCode) {
  if (!db || !roomCode) return;
  if (partyHandoutsUnsubscribe) partyHandoutsUnsubscribe();

  partyHandoutsUnsubscribe = db.collection("campaigns").doc(roomCode).collection("handouts")
    .onSnapshot((snapshot) => {
      const roomList = [];
      snapshot.forEach((doc) => {
        const d = doc.data() || {};
        if (doc.id === "owlbear_vtt" || d.id === "owlbear_vtt") {
          try {
            const parsed = JSON.parse(d.content || "{}");
            if (!vttUserLeftMap && parsed.url && typeof setOwlbearRoomUrl === "function" && parsed.url !== getStoredOwlbearUrl()) {
              setOwlbearRoomUrl(parsed.url, false);
            }
          } catch (e) {}
          return;
        }
        if (doc.id === "owlbear_vtt_state" || d.id === "owlbear_vtt_state") {
          if (typeof applyRemoteOwlbearVttState === "function") {
            applyRemoteOwlbearVttState(d);
          }
          return;
        }
        roomList.push(d);
      });
      partyRoomHandouts = roomList;
      renderHandoutsGrid();
      renderPartyChatMessages();
    }, (err) => {
      console.warn("Handouts listener error:", err);
    });
}

function stopPartyHandoutsListener() {
  if (partyHandoutsUnsubscribe) {
    partyHandoutsUnsubscribe();
    partyHandoutsUnsubscribe = null;
  }
  partyRoomHandouts = [];
  renderHandoutsGrid();
}

/* ==========================================================================
   OFFLINE PWA & NETWORK STATUS ENGINE
   ========================================================================== */

function initPWAAndNetworkStatus() {
  const badge = document.getElementById("networkStatusBadge");
  const text = document.getElementById("networkStatusText");

  function updateStatus(isOnline) {
    if (badge) {
      badge.classList.toggle("online", isOnline);
      badge.classList.toggle("offline", !isOnline);
      badge.title = isOnline ? "Network status: Online (PWA Ready)" : "Network status: Offline (Local Mode)";
    }
    if (text) text.textContent = isOnline ? "Online" : "Offline";
  }

  window.addEventListener("online", () => {
    updateStatus(true);
    showStatus("🌐 Back Online — Cloud sync active");
  });

  window.addEventListener("offline", () => {
    updateStatus(false);
    showStatus("📶 Offline Mode — Sheet is fully functional offline");
  });

  updateStatus(navigator.onLine);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=78", { updateViaCache: "none" }).then((reg) => {
        reg.update().catch(() => {});
        console.log("5e Sheet Service Worker registered:", reg.scope);
      }).catch((err) => {
        console.log("5e Sheet Service Worker failed:", err);
      });
    });
  }

  // Hook chat form submit listeners
  document.getElementById("floatingChatForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("floatingChatInput");
    if (!input || !input.value.trim()) return;
    sendPartyChatMessage(input.value.trim());
    input.value = "";
  });

  document.getElementById("partyModalChatForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("partyModalChatInput");
    if (!input || !input.value.trim()) return;
    sendPartyChatMessage(input.value.trim());
    input.value = "";
  });

  // Hook exhaustion input explainer
  const exhInput = document.getElementById("exhaustionLevel");
  if (exhInput) {
    exhInput.addEventListener("focus", () => openConditionExplainer("exhaustion"));
    exhInput.addEventListener("click", () => openConditionExplainer("exhaustion"));
    exhInput.addEventListener("input", () => openConditionExplainer("exhaustion"));
  }
}

function initFloatingPartyChatDragAndResize() {
  const panel = document.getElementById("floatingPartyChat");
  if (!panel) return;

  const header = panel.querySelector(".floating-chat-header");
  const resizeHandle = document.getElementById("chatResizeHandle");

  // Restore saved position/size if available
  try {
    const savedPos = JSON.parse(localStorage.getItem("partyChatPos") || "null");
    if (savedPos && typeof savedPos.left === "number" && typeof savedPos.top === "number") {
      const maxLeft = Math.max(0, window.innerWidth - (savedPos.width || 380));
      const maxTop = Math.max(0, window.innerHeight - 50);
      const left = Math.max(0, Math.min(savedPos.left, maxLeft));
      const top = Math.max(0, Math.min(savedPos.top, maxTop));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.bottom = "auto";
      panel.style.right = "auto";
      panel.style.margin = "0";
    }
    const savedSize = JSON.parse(localStorage.getItem("partyChatSize") || "null");
    if (savedSize && typeof savedSize.width === "number" && typeof savedSize.height === "number") {
      const width = Math.max(300, Math.min(savedSize.width, window.innerWidth - 10));
      const height = Math.max(320, Math.min(savedSize.height, window.innerHeight - 20));
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
    }
  } catch (err) {
    console.warn("Could not load party chat pos/size:", err);
  }

  // --- DRAGGING VIA HEADER ---
  if (header) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let panelWidth = 0;
    let panelHeight = 0;

    function startDrag(e) {
      if (e.target.closest("button, input, select, textarea, a, .chat-room-badge")) return;
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;

      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      panelWidth = rect.width;
      panelHeight = rect.height;

      panel.style.left = `${initialLeft}px`;
      panel.style.top = `${initialTop}px`;
      panel.style.bottom = "auto";
      panel.style.right = "auto";
      panel.style.margin = "0";

      document.body.classList.add("chat-dragging");

      if (e.type === "mousedown") {
        window.addEventListener("mousemove", onDragMove);
        window.addEventListener("mouseup", onDragEnd);
      } else if (e.type === "touchstart") {
        window.addEventListener("touchmove", onDragMove, { passive: false });
        window.addEventListener("touchend", onDragEnd);
      }
    }

    function onDragMove(e) {
      if (!isDragging) return;
      if (e.cancelable && e.type === "touchmove") e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = Math.max(0, window.innerWidth - panelWidth);
      const maxTop = Math.max(0, window.innerHeight - 50);

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    }

    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove("chat-dragging");

      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", onDragEnd);

      const rect = panel.getBoundingClientRect();
      try {
        localStorage.setItem("partyChatPos", JSON.stringify({ left: rect.left, top: rect.top, width: rect.width }));
      } catch (err) {}
    }

    header.addEventListener("mousedown", startDrag);
    header.addEventListener("touchstart", startDrag, { passive: true });

    // Double-click header to toggle expand/restore
    header.addEventListener("dblclick", (e) => {
      if (e.target.closest("button, input, select, textarea, a")) return;
      toggleFloatingChatExpanded();
    });
  }

  // --- RESIZING VIA CORNER HANDLE ---
  if (resizeHandle) {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    function startResize(e) {
      isResizing = true;
      e.preventDefault();
      e.stopPropagation();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;

      const rect = panel.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;

      document.body.classList.add("chat-resizing");

      if (e.type === "mousedown") {
        window.addEventListener("mousemove", onResizeMove);
        window.addEventListener("mouseup", onResizeEnd);
      } else if (e.type === "touchstart") {
        window.addEventListener("touchmove", onResizeMove, { passive: false });
        window.addEventListener("touchend", onResizeEnd);
      }
    }

    function onResizeMove(e) {
      if (!isResizing) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;

      const rect = panel.getBoundingClientRect();
      const maxW = window.innerWidth - rect.left - 10;
      const maxH = window.innerHeight - rect.top - 10;

      const newW = Math.max(300, Math.min(startWidth + dx, maxW));
      const newH = Math.max(320, Math.min(startHeight + dy, maxH));

      panel.style.width = `${newW}px`;
      panel.style.height = `${newH}px`;
    }

    function onResizeEnd() {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove("chat-resizing");

      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeEnd);
      window.removeEventListener("touchmove", onResizeMove);
      window.removeEventListener("touchend", onResizeEnd);

      const rect = panel.getBoundingClientRect();
      try {
        localStorage.setItem("partyChatSize", JSON.stringify({ width: rect.width, height: rect.height }));
      } catch (err) {}
    }

    resizeHandle.addEventListener("mousedown", startResize);
    resizeHandle.addEventListener("touchstart", startResize, { passive: false });
  }

  // Window resize bounds check
  window.addEventListener("resize", () => {
    clampFloatingChatToBounds();
  });
}

/* ==========================================================================
   MASTER ADMIN PANEL CONTROLLER (RESTRICTED TO OWNER EMAIL)
   ========================================================================== */

let currentSessionId = sessionStorage.getItem("codex_session_id");
if (!currentSessionId) {
  currentSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
  try {
    sessionStorage.setItem("codex_session_id", currentSessionId);
  } catch (e) {}
}

let presenceHeartbeatInterval = null;
let lastHeartbeatSentAt = 0;
let adminPresenceUnsubscribe = null;
let adminActivePresenceSessions = [];
let activePresenceFilter = "all";

function getDeviceDescription() {
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const os = /Macintosh|Mac OS X/i.test(ua) ? "Mac" :
    (/Windows/i.test(ua) ? "Windows" :
    (/Linux/i.test(ua) ? "Linux" :
    (/iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    (/Android/i.test(ua) ? "Android" : "Device"))));
  return `${isMobile ? "Mobile" : "Desktop"} (${os})`;
}

async function sendSessionHeartbeat(force = false) {
  if (!db) return;
  const now = Date.now();
  if (!force && now - lastHeartbeatSentAt < 12000) return;
  lastHeartbeatSentAt = now;

  try {
    const user = auth?.currentUser || currentUser;
    const email = (user && !user.isAnonymous && user.email) ? user.email.trim() : "";
    const charName = document.getElementById("charName")?.value?.trim() || "";
    const activeRoom = connectedCampaignRoom || activeDMRoomCode || "";
    const role = activeDMRoomCode ? "Dungeon Master" : (connectedCampaignRoom ? "Player" : "Stand-alone");

    const memberPayload = {
      id: currentSessionId,
      name: (charName || (email ? email.split("@")[0] : "Adventurer")).substring(0, 100),
      charClass: (email || "Guest Visitor").substring(0, 100),
      charRace: getDeviceDescription().substring(0, 100),
      charBackground: (activeRoom ? `Party: ${activeRoom}` : "Solo Sheet").substring(0, 100),
      charAlignment: (role || "Stand-alone").substring(0, 100),
      ownerUid: (user?.uid || "anon").substring(0, 128),
      updatedAt: now
    };

    await db.collection("campaigns").doc("CODEX_PRESENCE").collection("members").doc(currentSessionId).set(memberPayload, { merge: true });
  } catch (err) {
    // Non-blocking background heartbeat
  }
}

function initSessionPresence() {
  sendSessionHeartbeat(true);

  if (!presenceHeartbeatInterval) {
    presenceHeartbeatInterval = setInterval(() => {
      sendSessionHeartbeat();
    }, 28000);
  }

  // Trigger heartbeat when user returns to tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      sendSessionHeartbeat(true);
    }
  });

  // Trigger throttled heartbeat on user interactions
  const throttledActivity = () => {
    const now = Date.now();
    if (now - lastHeartbeatSentAt > 15000) {
      sendSessionHeartbeat();
    }
  };
  window.addEventListener("click", throttledActivity, { passive: true });
  window.addEventListener("keydown", throttledActivity, { passive: true });

  // On page unload, attempt to remove session
  window.addEventListener("beforeunload", () => {
    if (db && currentSessionId) {
      try {
        db.collection("campaigns").doc("CODEX_PRESENCE").collection("members").doc(currentSessionId).delete().catch(() => {});
      } catch (e) {}
    }
  });
}

function startAdminPresenceListener() {
  if (!db || !isAdminSession()) return;
  stopAdminPresenceListener();

  const container = document.getElementById("adminActiveUsersList");
  if (container && (!adminActivePresenceSessions || adminActivePresenceSessions.length === 0)) {
    container.innerHTML = `<div class="admin-empty-notice"><span class="codex-spin-icon">⏳</span> Synchronizing live site users...</div>`;
  }

  adminPresenceUnsubscribe = db.collection("campaigns").doc("CODEX_PRESENCE").collection("members")
    .onSnapshot((snapshot) => {
      const now = Date.now();
      const activeCutoff = now - (3.5 * 60 * 1000); // 3.5 minutes
      const staleCutoff = now - (25 * 60 * 1000);  // 25 minutes
      const sessions = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;
        const lastSeen = data.updatedAt || 0;
        if (lastSeen >= activeCutoff) {
          const email = (data.charClass && data.charClass.includes("@")) ? data.charClass : "";
          sessions.push({
            id: doc.id,
            sessionId: doc.id,
            email: email,
            displayName: data.name || (email ? email.split("@")[0] : "Adventurer"),
            activeCharName: data.name || "",
            device: data.charRace || "Device",
            activeRoom: (data.charBackground || "").replace(/^Party:\s*/, ""),
            role: data.charAlignment || "Player",
            uid: data.ownerUid || "anon",
            lastSeen: lastSeen
          });
        } else if (lastSeen < staleCutoff) {
          doc.ref.delete().catch(() => {});
        }
      });

      // Sort: Logged-in users with email first, then newest lastSeen
      sessions.sort((a, b) => {
        const aHas = Boolean(a.email);
        const bHas = Boolean(b.email);
        if (aHas !== bHas) return bHas ? 1 : -1;
        return (b.lastSeen || 0) - (a.lastSeen || 0);
      });

      adminActivePresenceSessions = sessions;
      renderAdminPresenceUI();
    }, (err) => {
      console.warn("Admin presence listener error:", err);
      const listEl = document.getElementById("adminActiveUsersList");
      if (listEl) {
        listEl.innerHTML = `<div class="admin-empty-notice" style="color: #f87171;">Could not connect to live presence stream: ${escapeHtml(err.message)}</div>`;
      }
    });
}

function stopAdminPresenceListener() {
  if (adminPresenceUnsubscribe) {
    adminPresenceUnsubscribe();
    adminPresenceUnsubscribe = null;
  }
}

function renderAdminPresenceUI() {
  const onlineStatEl = document.getElementById("adminStatOnlineUsers");
  const onlineSubEl = document.getElementById("adminStatOnlineSub");
  const countAllEl = document.getElementById("adminCountAllUsers");
  const countEmailEl = document.getElementById("adminCountEmailUsers");
  const countGuestEl = document.getElementById("adminCountGuestUsers");
  const listContainer = document.getElementById("adminActiveUsersList");

  const sessions = adminActivePresenceSessions || [];
  const loggedUsers = sessions.filter((s) => Boolean(s.email));
  const guestUsers = sessions.filter((s) => !s.email);

  const totalCount = sessions.length;
  const loggedCount = loggedUsers.length;
  const guestCount = guestUsers.length;

  if (onlineStatEl) onlineStatEl.textContent = totalCount;
  if (onlineSubEl) {
    onlineSubEl.textContent = `${loggedCount} logged-in (${loggedCount === 1 ? '1 email' : loggedCount + ' emails'}) &bull; ${guestCount} guest(s)`;
  }
  if (countAllEl) countAllEl.textContent = totalCount;
  if (countEmailEl) countEmailEl.textContent = loggedCount;
  if (countGuestEl) countGuestEl.textContent = guestCount;

  if (!listContainer) return;

  let filtered = sessions;
  if (activePresenceFilter === "logged") {
    filtered = loggedUsers;
  } else if (activePresenceFilter === "guest") {
    filtered = guestUsers;
  }

  if (filtered.length === 0) {
    if (activePresenceFilter === "logged") {
      listContainer.innerHTML = `<div class="admin-empty-notice">No users with registered emails are currently active.</div>`;
    } else if (activePresenceFilter === "guest") {
      listContainer.innerHTML = `<div class="admin-empty-notice">No guest/anonymous visitors active.</div>`;
    } else {
      listContainer.innerHTML = `<div class="admin-empty-notice">No active visitors detected. Waiting for connections...</div>`;
    }
    return;
  }

  const now = Date.now();
  listContainer.innerHTML = filtered.map((s) => {
    const isMe = (s.sessionId === currentSessionId || (auth?.currentUser && s.uid === auth.currentUser.uid));
    const isOwner = Boolean(s.email && s.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase());
    const isSecondaryAdmin = Boolean(s.email && additionalAdminEmails.map(e => e.toLowerCase()).includes(s.email.toLowerCase()));

    const ageSec = Math.max(0, Math.round((now - (s.lastSeen || now)) / 1000));
    const isIdle = ageSec > 50;
    const statusText = isIdle ? `Idle (${Math.round(ageSec / 60)}m ago)` : "Active Now";
    const statusClass = isIdle ? "idle-now" : "active-now";

    const roomText = s.activeRoom ? `Room: ${s.activeRoom} (${s.role || 'Member'})` : `Solo Session`;
    const charText = s.activeCharName || s.displayName || "Adventurer";
    const deviceText = s.device || "Browser";

    return `
      <div class="admin-user-card ${isMe ? 'is-self' : ''} ${s.email ? 'is-logged' : ''}">
        <div class="admin-user-main">
          <div class="admin-user-email-row">
            ${s.email
              ? `<span class="admin-user-email">📧 ${escapeHtml(s.email)}</span>`
              : `<span class="admin-user-guest">👤 Guest Visitor</span>`
            }
            ${isOwner ? '<span class="admin-badge-pill" style="color: #fbbf24;">👑 Owner</span>' : ''}
            ${(!isOwner && isSecondaryAdmin) ? '<span class="admin-badge-pill" style="color: #60a5fa;">🛡️ Admin</span>' : ''}
            ${(!isOwner && !isSecondaryAdmin && s.email) ? '<span class="admin-badge-pill" style="color: #93c5fd;">Player</span>' : ''}
            ${isMe ? '<span class="admin-badge-pill" style="color: #34d399;">(You)</span>' : ''}
          </div>
          <div class="admin-user-details">
            <span class="admin-user-char">⚔️ ${escapeHtml(charText)}</span>
            <span class="admin-user-sep">&bull;</span>
            <span class="admin-user-room">${escapeHtml(roomText)}</span>
          </div>
        </div>
        <div class="admin-user-meta">
          <span class="admin-user-device">${escapeHtml(deviceText)}</span>
          <span class="admin-user-status ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function openAdminModal() {
  if (!isAdminSession()) {
    showStatus("Access restricted to master administrator.", 3000);
    return;
  }
  const modal = document.getElementById("adminModal");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("open");
  }
  loadAdminOverview();
  startAdminPresenceListener();
}

function closeAdminModal() {
  const modal = document.getElementById("adminModal");
  if (modal) {
    modal.classList.remove("open");
    modal.style.display = "none";
  }
  stopAdminPresenceListener();
}

function switchAdminTab(tabId) {
  const tabs = document.querySelectorAll(".admin-tab-btn");
  tabs.forEach((tab) => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  const panes = document.querySelectorAll(".admin-tab-pane");
  panes.forEach((pane) => {
    if (pane.id === tabId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  if (tabId === "adminTabCampaigns") {
    stopAdminPresenceListener();
    loadAdminCampaigns();
  } else if (tabId === "adminTabOverview") {
    loadAdminOverview();
    startAdminPresenceListener();
  } else {
    stopAdminPresenceListener();
    if (tabId === "adminTabDiagnostics") {
      renderAdminEmailsList();
    }
  }
}

function loadAdminOverview() {
  const emailEl = document.getElementById("adminUserEmailText");
  const uidEl = document.getElementById("adminUserUidText");
  const rosterCountEl = document.getElementById("adminStatRosterCount");
  const roomEl = document.getElementById("adminStatPartyRoom");
  const roleEl = document.getElementById("adminStatPartyRole");
  const storageEl = document.getElementById("adminStatStorageSize");

  const curUser = auth?.currentUser;
  if (emailEl) emailEl.textContent = (curUser && curUser.email) || PRIMARY_ADMIN_EMAIL;
  if (uidEl) uidEl.textContent = `UID: ${(curUser && curUser.uid) || "Local/Dev"}`;

  try {
    const roster = JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY) || "{}");
    if (rosterCountEl) rosterCountEl.textContent = Object.keys(roster).length;
  } catch (e) {
    if (rosterCountEl) rosterCountEl.textContent = "1";
  }

  const activeRoom = connectedCampaignRoom || activeDMRoomCode;
  if (roomEl) roomEl.textContent = activeRoom || "None";
  if (roleEl) {
    roleEl.textContent = activeDMRoomCode ? "Hosting as DM" : (connectedCampaignRoom ? "Connected as Player" : "Stand-alone Mode");
  }

  try {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += ((localStorage[key].length + key.length) * 2);
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    if (storageEl) storageEl.textContent = `${kb} KB`;
  } catch (e) {
    if (storageEl) storageEl.textContent = "Unknown";
  }

  // Pre-fill target room inputs if active
  const broadcastInput = document.getElementById("adminCustomRoomCode");
  if (broadcastInput && activeRoom && !broadcastInput.value) {
    broadcastInput.value = activeRoom;
  }
  const dispenserRoom = document.getElementById("adminDispenserRoom");
  if (dispenserRoom && activeRoom && !dispenserRoom.value) {
    dispenserRoom.value = activeRoom;
  }

  sendSessionHeartbeat(true);
}

async function loadAdminCampaigns() {
  const container = document.getElementById("adminRoomsList");
  if (!container) return;

  container.innerHTML = `<div class="admin-empty-notice"><span class="codex-spin-icon">⏳</span> Querying Firestore campaign records...</div>`;

  // Fetch cloud purged registry if available
  if (db) {
    try {
      const purgedSnap = await db.collection("campaigns").doc("CODEX_GLOBAL_SYSTEM").collection("handouts").doc("purged_campaigns").get().catch(() => null);
      if (purgedSnap && purgedSnap.exists) {
        const cloudPurged = JSON.parse(purgedSnap.data()?.content || "[]");
        if (Array.isArray(cloudPurged)) {
          cloudPurged.forEach((r) => addPurgedRoom(r));
        }
      }
    } catch (e) {}
  }

  const purgedRooms = getPurgedRooms();
  const discoveredRooms = new Map();

  // 1. Gather all local created and recent rooms (skipping purged)
  getCreatedRooms().forEach((code) => {
    const clean = (code || "").trim().toUpperCase();
    if (clean && !purgedRooms.has(clean)) {
      discoveredRooms.set(clean, { code: clean, isCreatedByMe: true, source: "Local Creator Registry" });
    }
  });
  getRecentRooms().forEach((code) => {
    const clean = (code || "").trim().toUpperCase();
    if (clean && !purgedRooms.has(clean) && !discoveredRooms.has(clean)) {
      discoveredRooms.set(clean, { code: clean, source: "Recent History" });
    }
  });
  if (connectedCampaignRoom) {
    const clean = connectedCampaignRoom.trim().toUpperCase();
    if (clean && !purgedRooms.has(clean) && !discoveredRooms.has(clean)) {
      discoveredRooms.set(clean, { code: clean, source: "Active Session" });
    }
  }
  if (activeDMRoomCode) {
    const clean = activeDMRoomCode.trim().toUpperCase();
    if (clean && !purgedRooms.has(clean) && !discoveredRooms.has(clean)) {
      discoveredRooms.set(clean, { code: clean, isCreatedByMe: true, source: "Active DM Session" });
    }
  }

  // 2. Query Firestore collection
  if (db) {
    try {
      const snap = await db.collection("campaigns").limit(50).get();
      snap.forEach((doc) => {
        const rawCode = doc.id;
        if (!rawCode || rawCode.startsWith("__") || rawCode === "CODEX_PRESENCE" || rawCode === "CODEX_GLOBAL_SYSTEM" || rawCode === "GLOBAL_PRESENCE" || rawCode === "GLOBAL_SYSTEM") return;
        const code = rawCode.trim().toUpperCase();
        if (purgedRooms.has(code)) return;
        const data = doc.data() || {};
        discoveredRooms.set(code, {
          code,
          creatorUid: data.creatorUid || "unknown",
          creatorEmail: data.creatorEmail || "",
          createdAt: data.createdAt,
          isCreatedByMe: data.creatorUid === auth?.currentUser?.uid,
          source: "Live Firestore"
        });
      });
    } catch (err) {
      console.warn("Admin could not list all campaigns directly from Firestore:", err);
    }
  }

  if (discoveredRooms.size === 0) {
    container.innerHTML = `
      <div class="admin-empty-notice">
        No active or historic campaign rooms found. When rooms are created or joined, they will appear here.
      </div>
    `;
    return;
  }

  const roomItems = Array.from(discoveredRooms.values());
  container.innerHTML = roomItems.map((room) => {
    const isCurrent = (connectedCampaignRoom === room.code || activeDMRoomCode === room.code);
    const dateStr = room.createdAt ? new Date(room.createdAt).toLocaleDateString() : (room.source || "Active");

    let ownerDisplay = "Guest";
    if (room.creatorEmail) {
      ownerDisplay = room.creatorEmail;
    } else if (room.isCreatedByMe && auth?.currentUser?.email && !auth.currentUser.isAnonymous) {
      ownerDisplay = auth.currentUser.email;
    } else if (Array.isArray(adminActivePresenceSessions) && adminActivePresenceSessions.length > 0) {
      const match = adminActivePresenceSessions.find((s) =>
        (s.uid && room.creatorUid && room.creatorUid !== "local" && s.uid === room.creatorUid && s.email) ||
        (s.activeRoom === room.code && s.role === "Dungeon Master" && s.email)
      );
      if (match && match.email) ownerDisplay = match.email;
    }
    const isGuest = (ownerDisplay === "Guest");

    return `
      <div class="admin-room-item">
        <div class="admin-room-info">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="admin-room-code">${escapeHtml(room.code)}</span>
            ${isCurrent ? '<span class="admin-badge-pill" style="color: #4ade80;">Active</span>' : ''}
            ${room.isCreatedByMe ? '<span class="admin-badge-pill" style="color: var(--accent-gold);">Host</span>' : ''}
          </div>
          <span class="admin-room-meta">Source: ${escapeHtml(room.source || "Firestore")} &bull; Logged: ${escapeHtml(dateStr)} &bull; Owner: <span style="color: ${isGuest ? 'var(--text-muted)' : '#60a5fa'}; font-weight: ${isGuest ? 'normal' : '600'};">${escapeHtml(ownerDisplay)}</span></span>
        </div>
        <div class="admin-room-btns">
          <button type="button" class="btn btn-gold-subtle btn-xs admin-open-chat-room-btn" data-room="${escapeHtml(room.code)}" title="Open live party chat for this campaign">💬 Open Chat</button>
          <button type="button" class="btn btn-outline btn-xs admin-inspect-room-btn" data-room="${escapeHtml(room.code)}">Inspect</button>
          <button type="button" class="btn red btn-xs admin-delete-room-btn" data-room="${escapeHtml(room.code)}">Purge</button>
        </div>
      </div>
    `;
  }).join("");
}

async function resolveRoomOwnerEmail(roomCode, roomData) {
  // 1. Direct field on roomDoc
  if (roomData && roomData.creatorEmail && typeof roomData.creatorEmail === "string" && roomData.creatorEmail.trim()) {
    return roomData.creatorEmail.trim();
  }

  const creatorUid = roomData?.creatorUid || "";

  // 2. Local check: if current user created this room locally
  if (isLocalRoomCreator(roomCode) || activeDMRoomCode === roomCode) {
    if (auth?.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email) {
      return auth.currentUser.email.trim();
    }
  }

  // 3. Search in cached live presence sessions (adminActivePresenceSessions)
  if (Array.isArray(adminActivePresenceSessions) && adminActivePresenceSessions.length > 0) {
    if (creatorUid && creatorUid !== "local" && creatorUid !== "anon") {
      const match = adminActivePresenceSessions.find((s) => s.uid === creatorUid && s.email);
      if (match && match.email) return match.email.trim();
    }
    const dmMatch = adminActivePresenceSessions.find((s) => s.activeRoom === roomCode && s.role === "Dungeon Master" && s.email);
    if (dmMatch && dmMatch.email) return dmMatch.email.trim();

    const roomMatch = adminActivePresenceSessions.find((s) => s.activeRoom === roomCode && s.email);
    if (roomMatch && roomMatch.email) return roomMatch.email.trim();
  }

  // 4. Query CODEX_PRESENCE members subcollection from Firestore
  if (db && creatorUid && creatorUid !== "local" && creatorUid !== "anon") {
    try {
      const snap = await db.collection("campaigns").doc("CODEX_PRESENCE").collection("members").limit(50).get();
      if (snap && !snap.empty) {
        let found = "";
        snap.forEach((doc) => {
          if (found) return;
          const d = doc.data() || {};
          const emailVal = (d.charClass && d.charClass.includes("@")) ? d.charClass.trim() : "";
          if (d.ownerUid === creatorUid && emailVal) {
            found = emailVal;
          } else if (d.charBackground === `Party: ${roomCode}` && d.charAlignment === "Dungeon Master" && emailVal) {
            found = emailVal;
          }
        });
        if (found) return found;
      }
    } catch (err) {
      console.warn("CODEX_PRESENCE owner email query err:", err);
    }
  }

  return "";
}

async function inspectAdminRoom(roomCode) {
  const drawer = document.getElementById("adminRoomDetailDrawer");
  const title = document.getElementById("adminDrawerTitle");
  const content = document.getElementById("adminDrawerContent");
  if (!drawer || !content) return;

  // Visual active highlight on clicked room item
  document.querySelectorAll(".admin-room-item").forEach(item => item.classList.remove("is-inspecting"));
  try {
    const escaped = (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(roomCode) : roomCode;
    const clickedBtn = document.querySelector(`.admin-inspect-room-btn[data-room="${escaped}"]`);
    if (clickedBtn) {
      const parentCard = clickedBtn.closest(".admin-room-item");
      if (parentCard) parentCard.classList.add("is-inspecting");
    }
  } catch (e) {
    console.warn("Could not highlight active room card:", e);
  }

  drawer.style.display = "block";
  if (title) title.textContent = `Inspecting Room: ${roomCode}`;
  content.innerHTML = `<div style="text-align:center; padding: 1.25rem; color: var(--text-dim);"><span class="codex-spin-icon">⏳</span> Fetching live room data from Firestore...</div>`;
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  showStatus(`Inspecting room ${roomCode}...`);

  if (!db) {
    content.innerHTML = `<div style="color: #f87171; padding: 0.5rem;">Firestore is not connected.</div>`;
    return;
  }

  try {
    const roomRef = db.collection("campaigns").doc(roomCode);
    const [roomDoc, membersSnap, chatSnap, handoutsSnap] = await Promise.all([
      roomRef.get().catch((err) => { console.warn("roomDoc fetch err:", err); return null; }),
      roomRef.collection("members").get().catch((err) => { console.warn("membersSnap fetch err:", err); return null; }),
      roomRef.collection("chat").limit(20).get().catch((err) => { console.warn("chatSnap fetch err:", err); return null; }),
      roomRef.collection("handouts").get().catch((err) => { console.warn("handoutsSnap fetch err:", err); return null; })
    ]);

    const roomData = roomDoc && roomDoc.exists ? roomDoc.data() : null;
    const members = [];
    if (membersSnap) {
      membersSnap.forEach((d) => members.push({ id: d.id, ...d.data() }));
    }
    const messages = [];
    if (chatSnap) {
      chatSnap.forEach((d) => messages.push({ id: d.id, ...d.data() }));
      messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    const handouts = [];
    if (handoutsSnap) {
      handoutsSnap.forEach((d) => handouts.push({ id: d.id, ...d.data() }));
    }

    const createdDate = roomData?.createdAt ? new Date(roomData.createdAt).toLocaleString() : "Active (Subcollections)";

    const ownerEmail = await resolveRoomOwnerEmail(roomCode, roomData);
    const isGuest = !ownerEmail;
    const ownerDisplay = ownerEmail || "Guest";

    let html = `
      <!-- Room Owner Banner -->
      <div style="background: rgba(0,0,0,0.35); padding: 0.65rem 0.85rem; border-radius: 6px; margin-bottom: 0.75rem; border: 1px solid var(--border-subtle); border-left: 3px solid ${isGuest ? 'var(--border-subtle)' : 'var(--accent-gold)'}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase; letter-spacing: 0.05em; font-weight: 600;">Room Owner</span><br>
          <div style="display: flex; align-items: center; gap: 0.45rem; margin-top: 0.15rem;">
            <strong style="color: ${isGuest ? 'var(--text-muted)' : '#60a5fa'}; font-size: 0.9rem; font-family: ${isGuest ? 'inherit' : 'monospace'};">
              ${escapeHtml(ownerDisplay)}
            </strong>
            ${isGuest ? '<span class="admin-badge-pill" style="color: var(--text-dim); background: rgba(255,255,255,0.06);">Guest (Not Logged In)</span>' : '<span class="admin-badge-pill" style="color: #4ade80; background: rgba(74,222,128,0.12);">Logged In</span>'}
          </div>
        </div>
        ${roomData?.creatorUid && roomData.creatorUid !== "local" ? `<span style="font-size: 0.68rem; color: var(--text-dim); font-family: monospace;">UID: ${escapeHtml(roomData.creatorUid.substring(0, 16))}...</span>` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem;">
        <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px;">
          <span style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase;">Room Document</span><br>
          <strong style="color: ${roomDoc?.exists ? '#4ade80' : '#fbbf24'};">${roomDoc?.exists ? 'Verified Active' : 'Virtual Session'}</strong>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px;">
          <span style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase;">Registered Members</span><br>
          <strong style="color: #60a5fa;">${members.length} player(s)</strong>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px;">
          <span style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase;">Loot Handouts</span><br>
          <strong style="color: var(--accent-gold);">${handouts.length} item(s)</strong>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px;">
          <span style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase;">Created Date</span><br>
          <span style="font-size:0.75rem;">${escapeHtml(createdDate)}</span>
        </div>
      </div>
    `;

    // Members list
    html += `<h5 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.78rem; text-transform: uppercase; color: var(--accent-gold);">Party Members (${members.length})</h5>`;
    if (members.length === 0) {
      html += `<p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 0.5rem;">No members currently registered in this room.</p>`;
    } else {
      html += `<div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem;">`;
      members.forEach((m) => {
        const hpCur = m.hp?.cur !== undefined ? m.hp.cur : "-";
        const hpMax = m.hp?.max !== undefined ? m.hp.max : "-";
        const ac = m.ac !== undefined ? m.ac : "-";
        const charCls = [m.charClass, m.level ? `Lvl ${m.level}` : ""].filter(Boolean).join(" ");
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 0.45rem 0.65rem; border-radius: 4px; border: 1px solid var(--border-subtle);">
            <div>
              <strong style="color: #ffffff;">${escapeHtml(m.name || "Unnamed Adventurer")}</strong>
              <span style="font-size: 0.7rem; color: var(--text-dim); margin-left: 0.4rem;">${escapeHtml(charCls || "Adventurer")}</span>
            </div>
            <div style="font-size: 0.74rem; font-family: 'JetBrains Mono', monospace;">
              <span style="color: #4ade80;">HP: ${hpCur}/${hpMax}</span> &bull; <span>AC: ${ac}</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Recent Chat preview
    html += `<h5 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.78rem; text-transform: uppercase; color: var(--accent-gold);">Recent Chat Messages (${messages.length})</h5>`;
    if (messages.length === 0) {
      html += `<p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 0.5rem;">No chat messages recorded.</p>`;
    } else {
      html += `<div style="display: flex; flex-direction: column; gap: 0.25rem; max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px; font-size: 0.74rem;">`;
      messages.slice(0, 10).forEach((msg) => {
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : "";
        html += `
          <div>
            <span style="color: var(--accent-gold); font-weight: 700;">${escapeHtml(msg.senderName || "Unknown")}:</span>
            <span style="color: var(--text-main); margin-left: 0.3rem;">${escapeHtml((msg.text || "").substring(0, 90))}</span>
            <span style="color: var(--text-dim); font-size: 0.65rem; margin-left: 0.4rem;">${escapeHtml(time)}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Direct Action Buttons
    html += `
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-gold-subtle btn-xs admin-open-chat-room-btn" data-room="${escapeHtml(roomCode)}">💬 Open Chat</button>
        <button type="button" class="btn red btn-xs admin-delete-room-btn" data-room="${escapeHtml(roomCode)}">Purge Room</button>
      </div>
    `;

    content.innerHTML = html;
  } catch (err) {
    console.error("Inspect room error:", err);
    content.innerHTML = `<div style="color: #f87171; padding: 0.5rem;">Failed to inspect room: ${escapeHtml(err.message)}</div>`;
  }
}

async function deleteAdminRoom(roomCode) {
  if (!roomCode) return;
  const cleanCode = roomCode.trim().toUpperCase();

  if (!confirm(`Are you sure you want to permanently purge room "${cleanCode}"? All members, chat messages, and loot will be removed.`)) {
    return;
  }

  showStatus(`Purging campaign room "${cleanCode}"...`);

  // 1. Mark as purged locally immediately
  addPurgedRoom(cleanCode);
  removeCreatedRoom(cleanCode);
  removeRecentRoom(cleanCode);

  // 2. Clear current sessions if this room was active
  if (connectedCampaignRoom && connectedCampaignRoom.trim().toUpperCase() === cleanCode) {
    leaveCampaignRoom();
  }
  if (activeDMRoomCode && activeDMRoomCode.trim().toUpperCase() === cleanCode) {
    activeDMRoomCode = "";
    localStorage.removeItem(DM_ROOM_KEY);
  }
  if (activeChatRoomOverride && activeChatRoomOverride.trim().toUpperCase() === cleanCode) {
    activeChatRoomOverride = null;
    updateAdminChatBarUI();
  }

  // 3. Immediately close detail drawer if it was inspecting this room
  const drawer = document.getElementById("adminRoomDetailDrawer");
  if (drawer) drawer.style.display = "none";

  // 4. Immediately remove any corresponding DOM cards for instant responsive feedback
  document.querySelectorAll(".admin-room-item").forEach((card) => {
    const codeEl = card.querySelector(".admin-room-code");
    if (codeEl && codeEl.textContent.trim().toUpperCase() === cleanCode) {
      card.style.transition = "opacity 0.25s, transform 0.25s";
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      setTimeout(() => card.remove(), 250);
    }
  });

  try {
    if (db) {
      // 5. Purge subcollections and parent room doc in Firestore
      const roomRef = db.collection("campaigns").doc(cleanCode);

      const [membersSnap, chatSnap, handoutsSnap] = await Promise.all([
        roomRef.collection("members").get().catch(() => null),
        roomRef.collection("chat").get().catch(() => null),
        roomRef.collection("handouts").get().catch(() => null)
      ]);

      if (membersSnap && !membersSnap.empty) {
        const batch1 = db.batch();
        membersSnap.docs.forEach((d) => batch1.delete(d.ref));
        await batch1.commit().catch((e) => console.warn("Members purge note:", e));
      }

      if (chatSnap && !chatSnap.empty) {
        const batch2 = db.batch();
        chatSnap.docs.forEach((d) => batch2.delete(d.ref));
        await batch2.commit().catch((e) => console.warn("Chat purge note:", e));
      }

      if (handoutsSnap && !handoutsSnap.empty) {
        const batch3 = db.batch();
        handoutsSnap.docs.forEach((d) => batch3.delete(d.ref));
        await batch3.commit().catch((e) => console.warn("Handouts purge note:", e));
      }

      // 6. Delete the parent room document
      await roomRef.delete().catch((e) => console.warn("Parent room doc delete note:", e));

      // 7. Sync purged record to cloud registry so it never reappears
      await syncPurgedRoomsToCloud(cleanCode);
    }

    showStatus(`Room "${cleanCode}" successfully purged.`);
    await loadAdminCampaigns();
  } catch (err) {
    console.error("Purge room error:", err);
    showStatus(`Room "${cleanCode}" purged locally (${err.message})`, 4000);
    await loadAdminCampaigns();
  }
}

function formatDateTimeLocal(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

let globalNoticeCountdownTimer = null;
let globalNoticeUnsubscribe = null;
let activeTopNoticeData = null;

function initGlobalSiteNoticeListener() {
  if (!db) return;
  if (globalNoticeUnsubscribe) return;

  globalNoticeUnsubscribe = db.collection("campaigns")
    .doc("CODEX_GLOBAL_SYSTEM")
    .collection("handouts")
    .doc("global_notice")
    .onSnapshot((docSnap) => {
      if (!docSnap.exists) {
        dismissGlobalSiteNotice(false);
        updateAdminNoticeUI(null);
        return;
      }

      const handoutData = docSnap.data();
      if (!handoutData || !handoutData.isShared || !handoutData.content) {
        dismissGlobalSiteNotice(false);
        updateAdminNoticeUI(null);
        return;
      }

      let data;
      try {
        data = JSON.parse(handoutData.content);
      } catch (e) {
        data = null;
      }

      if (!data || data.cleared) {
        dismissGlobalSiteNotice(false);
        updateAdminNoticeUI(null);
        return;
      }

      activeTopNoticeData = data;
      updateAdminNoticeUI(data);

      const now = Date.now();
      const expiresAt = data.expiresAt || 0;
      const remainingMs = expiresAt - now;

      if (remainingMs <= 0) {
        dismissGlobalSiteNotice(false);
        return;
      }

      // Check if user dismissed this specific notice ID in this browser session
      if (sessionStorage.getItem("dismissed_notice_" + data.id)) {
        return;
      }

      renderGlobalSiteNoticeBanner(data, remainingMs);
    }, (err) => {
      console.warn("Global notice listener error:", err);
    });
}

function renderGlobalSiteNoticeBanner(data, remainingMs) {
  const banner = document.getElementById("globalSiteNoticeBanner");
  const msgEl = document.getElementById("globalNoticeMessage");
  const tagEl = document.getElementById("globalNoticeTag");
  const iconEl = document.getElementById("globalNoticeIcon");
  const timerEl = document.getElementById("globalNoticeTimer");
  const progBar = document.getElementById("globalNoticeProgressBar");
  if (!banner || !msgEl) return;

  if (globalNoticeCountdownTimer) {
    clearInterval(globalNoticeCountdownTimer);
    globalNoticeCountdownTimer = null;
  }

  banner.className = `global-site-notice-banner notice-style-${data.style || 'gold'}`;
  if (msgEl) msgEl.textContent = data.text || "System Notice";
  if (tagEl) tagEl.textContent = data.tag || "System Alert";
  if (iconEl) iconEl.textContent = data.icon || "📢";

  banner.style.display = "block";

  const totalDurationMs = Math.max(1000, (data.durationSeconds || 15) * 1000);
  const expiresAt = data.expiresAt || (Date.now() + remainingMs);

  function updateTicker() {
    const now = Date.now();
    const leftMs = Math.max(0, expiresAt - now);
    const leftSec = Math.ceil(leftMs / 1000);

    if (timerEl) {
      if (leftSec >= 86400) {
        const d = Math.floor(leftSec / 86400);
        const h = Math.floor((leftSec % 86400) / 3600);
        timerEl.textContent = `${d}d ${h}h`;
      } else if (leftSec >= 3600) {
        const h = Math.floor(leftSec / 3600);
        const m = Math.floor((leftSec % 3600) / 60);
        timerEl.textContent = `${h}h ${m}m`;
      } else if (leftSec >= 60) {
        const m = Math.floor(leftSec / 60);
        const s = leftSec % 60;
        timerEl.textContent = `${m}m ${s}s`;
      } else {
        timerEl.textContent = `${leftSec}s`;
      }
    }
    if (progBar) {
      const pct = Math.max(0, Math.min(100, (leftMs / totalDurationMs) * 100));
      progBar.style.width = `${pct}%`;
    }

    if (leftMs <= 0) {
      dismissGlobalSiteNotice(false);
    }
  }

  updateTicker();
  globalNoticeCountdownTimer = setInterval(updateTicker, 250);
}

function dismissGlobalSiteNotice(remember = true) {
  if (globalNoticeCountdownTimer) {
    clearInterval(globalNoticeCountdownTimer);
    globalNoticeCountdownTimer = null;
  }
  const banner = document.getElementById("globalSiteNoticeBanner");
  if (banner) {
    banner.style.display = "none";
  }
  if (remember && activeTopNoticeData && activeTopNoticeData.id) {
    try {
      sessionStorage.setItem("dismissed_notice_" + activeTopNoticeData.id, "true");
    } catch (e) {}
  }
}

async function clearActiveTopNoticeBanner() {
  if (!isAdminSession()) return;
  if (!db) return;
  try {
    await db.collection("campaigns").doc("CODEX_GLOBAL_SYSTEM").collection("handouts").doc("global_notice").set({
      id: "global_notice",
      title: "Notice Dismissed",
      type: "system",
      author: "Admin",
      content: JSON.stringify({ cleared: true, expiresAt: 0 }),
      isShared: false,
      updatedAt: Date.now()
    }, { merge: true });
    dismissGlobalSiteNotice(false);
    showStatus("Cleared top website notice banner.");
  } catch (err) {
    console.error("Clear banner error:", err);
    showStatus("Could not clear banner: " + err.message);
  }
}

function updateAdminNoticeUI(data) {
  const summaryEl = document.getElementById("adminActiveNoticeSummary");
  const clearBtn = document.getElementById("adminClearTopNoticeBtn");
  if (!summaryEl) return;

  if (!data || !data.expiresAt || data.expiresAt <= Date.now()) {
    summaryEl.textContent = "No active top notice banner.";
    if (clearBtn) clearBtn.style.display = "none";
    return;
  }

  const leftSec = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
  const endDateStr = new Date(data.expiresAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  let remainStr = `${leftSec}s`;
  if (leftSec >= 86400) {
    const d = Math.floor(leftSec / 86400);
    const h = Math.floor((leftSec % 86400) / 3600);
    remainStr = `${d}d ${h}h`;
  } else if (leftSec >= 3600) {
    const h = Math.floor(leftSec / 3600);
    const m = Math.floor((leftSec % 3600) / 60);
    remainStr = `${h}h ${m}m`;
  } else if (leftSec >= 60) {
    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    remainStr = `${m}m ${s}s`;
  }

  summaryEl.innerHTML = `<span style="color: #34d399; font-weight:700;">Active Top Banner (ends ${endDateStr} · ${remainStr} left):</span> "${escapeHtml((data.text || '').substring(0, 45))}${data.text && data.text.length > 45 ? '...' : ''}"`;
  if (clearBtn) clearBtn.style.display = "inline-block";
}

async function sendAdminBroadcast(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (!isAdminSession()) {
    showStatus("Unauthorized broadcast attempt.");
    return;
  }

  const targetSelect = document.getElementById("adminBroadcastTarget")?.value || "current";
  const customRoomInput = document.getElementById("adminCustomRoomCode")?.value?.trim().toUpperCase();
  const style = document.getElementById("adminBroadcastStyle")?.value || "system";
  const textInput = document.getElementById("adminBroadcastText");
  const rawText = textInput ? textInput.value.trim() : "";

  if (!rawText) {
    alert("Please enter the announcement text to broadcast.");
    return;
  }

  if (!db) {
    showStatus("Database offline. Broadcast could not be sent.");
    return;
  }

  // 1. TOP WEBSITE NOTICE BANNER BROADCAST (ALL SITE VISITORS)
  if (targetSelect === "top_banner") {
    const endInput = document.getElementById("adminNoticeEndTime");
    let expiresAt = 0;
    if (endInput && endInput.value) {
      const parsed = new Date(endInput.value).getTime();
      if (!isNaN(parsed) && parsed > Date.now()) {
        expiresAt = parsed;
      }
    }

    let durSec = 15;
    if (expiresAt > Date.now()) {
      durSec = Math.max(1, Math.round((expiresAt - Date.now()) / 1000));
    } else {
      // If no time period is specified or an expired time is picked, default to 15 seconds
      durSec = 15;
      expiresAt = Date.now() + 15000;
    }

    let tag = "System Notice";
    let icon = "📢";
    let noticeStyle = "info";

    if (style === "dm") {
      tag = "Admin Decree";
      icon = "👑";
      noticeStyle = "gold";
    } else if (style === "maint") {
      tag = "Maintenance Alert";
      icon = "⚠️";
      noticeStyle = "warning";
    }

    const timeDesc = durSec >= 3600
      ? `until ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `for ${durSec}s`;
    showStatus(`Broadcasting top website notice ${timeDesc}...`);

    try {
      const noticePayload = {
        id: "notice_" + Date.now(),
        text: rawText,
        tag: tag,
        icon: icon,
        style: noticeStyle,
        durationSeconds: durSec,
        createdAt: Date.now(),
        expiresAt: expiresAt
      };

      const handoutPayload = {
        id: "global_notice",
        title: (rawText || "System Notice").substring(0, 150),
        type: "system",
        author: "Admin",
        content: JSON.stringify(noticePayload),
        isShared: true,
        updatedAt: Date.now()
      };

      await db.collection("campaigns").doc("CODEX_GLOBAL_SYSTEM").collection("handouts").doc("global_notice").set(handoutPayload);

      if (textInput) textInput.value = "";
      if (endInput) endInput.value = "";
      showStatus(`Top website notice live ${timeDesc}!`);
    } catch (err) {
      console.error("Top banner broadcast failed:", err);
      showStatus("Broadcast failed: " + err.message);
    }
    return;
  }

  let targetRooms = [];
  if (targetSelect === "current") {
    const cur = connectedCampaignRoom || activeDMRoomCode;
    if (!cur) {
      alert("You are not currently connected to any campaign room. Choose 'Specific Room Code' or 'All Active Campaign Rooms'.");
      return;
    }
    targetRooms.push(cur);
  } else if (targetSelect === "custom") {
    if (!customRoomInput) {
      alert("Please enter the specific room code to broadcast to.");
      return;
    }
    targetRooms.push(customRoomInput);
  } else if (targetSelect === "all") {
    const set = new Set();
    getCreatedRooms().forEach((r) => set.add(r));
    getRecentRooms().forEach((r) => set.add(r));
    if (connectedCampaignRoom) set.add(connectedCampaignRoom);
    if (activeDMRoomCode) set.add(activeDMRoomCode);
    if (db) {
      try {
        const snap = await db.collection("campaigns").limit(50).get();
        snap.forEach((doc) => {
          const code = doc.id;
          if (code === "CODEX_PRESENCE" || code === "CODEX_GLOBAL_SYSTEM" || code === "GLOBAL_PRESENCE" || code === "GLOBAL_SYSTEM" || code.startsWith("__")) return;
          set.add(code);
        });
      } catch (err) {}
    }
    set.delete("CODEX_PRESENCE");
    set.delete("CODEX_GLOBAL_SYSTEM");
    set.delete("GLOBAL_PRESENCE");
    set.delete("GLOBAL_SYSTEM");
    targetRooms = Array.from(set);
    if (targetRooms.length === 0) {
      alert("No active campaign rooms found to broadcast to.");
      return;
    }
  }

  let formattedText = rawText;
  let senderName = "👑 Master Admin";
  if (style === "system") {
    senderName = "📢 System Alert";
    formattedText = `[SYSTEM NOTICE]: ${rawText}`;
  } else if (style === "maint") {
    senderName = "⚠️ Maintenance Notice";
    formattedText = `[SCHEDULED MAINTENANCE]: ${rawText}`;
  } else {
    senderName = "👑 Master Admin";
    formattedText = `[ADMIN DECREE]: ${rawText}`;
  }

  showStatus(`Transmitting broadcast to ${targetRooms.length} room(s)...`);

  if (!db) {
    showStatus("Database offline. Broadcast could not be sent.");
    return;
  }

  let successCount = 0;
  for (const roomCode of targetRooms) {
    try {
      await db.collection("campaigns").doc(roomCode).collection("chat").add({
        senderId: "system",
        senderName: senderName,
        isDM: false,
        type: "system",
        text: formattedText,
        timestamp: Date.now()
      });
      successCount++;
    } catch (err) {
      console.warn(`Failed to broadcast to ${roomCode}:`, err);
    }
  }

  if (textInput) textInput.value = "";
  showStatus(`Broadcast successfully sent to ${successCount} party room(s)!`);
}

async function spawnAdminItem(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (!isAdminSession()) {
    showStatus("Unauthorized item dispenser attempt.");
    return;
  }

  const roomInput = document.getElementById("adminDispenserRoom")?.value?.trim().toUpperCase();
  const targetRoom = roomInput || connectedCampaignRoom || activeDMRoomCode;
  if (!targetRoom) {
    alert("Please enter or connect to a campaign room to bestow items into.");
    return;
  }

  const name = document.getElementById("adminDispenserName")?.value?.trim() || "Mystic Relic";
  const type = document.getElementById("adminDispenserType")?.value || "item";
  const dmgVal = document.getElementById("adminDispenserDmg")?.value?.trim() || "";
  const recipient = document.getElementById("adminDispenserRecipient")?.value?.trim() || "all";
  const notes = document.getElementById("adminDispenserNotes")?.value?.trim() || "";

  if (!db) {
    showStatus("Database offline. Cannot bestow items.");
    return;
  }

  showStatus(`Bestowing "${name}" to room ${targetRoom}...`);

  const handoutId = "admin_loot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

  let itemPayload = null;
  let coinsPayload = null;
  let maxClaims = 1;

  if (type === "weapon") {
    itemPayload = {
      name: name,
      dmg: dmgVal || "1d8",
      type: "Melee Weapon",
      notes: notes,
      qty: 1,
      isWeapon: true
    };
    maxClaims = 1;
  } else if (type === "coin") {
    coinsPayload = {
      gp: parseInt(dmgVal, 10) || 500,
      pp: 50,
      sp: 100,
      ep: 0,
      cp: 0
    };
    maxClaims = 1;
  } else {
    const qty = parseInt(dmgVal, 10) || 1;
    itemPayload = {
      name: name,
      qty: qty,
      weight: 1,
      isWeapon: false
    };
    maxClaims = Math.max(1, qty);
  }

  const handoutObj = {
    id: handoutId,
    title: name,
    type: type,
    recipient: recipient,
    recipientId: "all",
    claimedBy: [],
    claimedCount: 0,
    maxClaims: maxClaims,
    author: "👑 Master Admin",
    date: new Date().toLocaleDateString(),
    imageUrl: "",
    content: notes,
    item: itemPayload,
    coins: coinsPayload,
    isShared: true,
    updatedAt: Date.now()
  };

  try {
    // 1. Add to handouts subcollection
    await db.collection("campaigns").doc(targetRoom).collection("handouts").doc(handoutId).set(handoutObj);

    // 2. Announce in chat
    await db.collection("campaigns").doc(targetRoom).collection("chat").add({
      senderId: "master_admin",
      senderName: "👑 Master Admin",
      isDM: true,
      type: "handout",
      text: `👑 Master Admin bestowed handout: "${name}"`,
      payload: { id: handoutId, title: name, type: type, recipient: recipient },
      timestamp: Date.now()
    });

    showStatus(`Successfully spawned "${name}" in ${targetRoom}!`);

    // Reset fields to custom
    const presetSelect = document.getElementById("adminPresetSelect");
    if (presetSelect) presetSelect.value = "custom";
    const nameInput = document.getElementById("adminDispenserName");
    if (nameInput) nameInput.value = "";
    const dmgInput = document.getElementById("adminDispenserDmg");
    if (dmgInput) dmgInput.value = "";
    const notesInput = document.getElementById("adminDispenserNotes");
    if (notesInput) notesInput.value = "";
  } catch (err) {
    console.error("Spawn item error:", err);
    showStatus(`Failed to spawn item: ${err.message}`, 4000);
  }
}

async function benchmarkFirestoreLatency() {
  const resultEl = document.getElementById("adminPingResult");
  if (resultEl) {
    resultEl.textContent = "Pinging Firestore...";
    resultEl.style.color = "var(--accent-gold)";
  }

  const start = performance.now();
  try {
    if (!db) throw new Error("Database SDK offline");
    await db.collection("campaigns").limit(1).get();
    const elapsed = Math.round(performance.now() - start);
    if (resultEl) {
      resultEl.textContent = `Latency: ${elapsed} ms (Healthy)`;
      resultEl.style.color = elapsed < 400 ? "#4ade80" : "var(--accent-gold)";
    }
    showStatus(`Firestore benchmark: ${elapsed} ms`);
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    if (resultEl) {
      resultEl.textContent = `Error (${elapsed} ms): ${err.message}`;
      resultEl.style.color = "#f87171";
    }
    showStatus(`Database ping error: ${err.message}`, 4000);
  }
}

function exportMasterJsonDump() {
  const dump = {
    archiveDate: new Date().toISOString(),
    primaryAdmin: PRIMARY_ADMIN_EMAIL,
    additionalAdmins: additionalAdminEmails,
    currentUser: auth?.currentUser ? {
      email: auth.currentUser.email,
      uid: auth.currentUser.uid,
      isAnonymous: auth.currentUser.isAnonymous
    } : null,
    storage: {}
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      dump.storage[key] = JSON.parse(localStorage.getItem(key));
    } catch (e) {
      dump.storage[key] = localStorage.getItem(key);
    }
  }

  const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", jsonString);
  dlAnchor.setAttribute("download", `codex_admin_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();

  showStatus("Master JSON archive downloaded!");
}

function renderAdminEmailsList() {
  const listEl = document.getElementById("adminEmailsList");
  if (!listEl) return;

  let html = `
    <span class="admin-email-pill primary">
      <span>👑 ${escapeHtml(PRIMARY_ADMIN_EMAIL)}</span>
      <span style="font-size:0.65rem; opacity:0.8;">(Owner)</span>
    </span>
  `;

  additionalAdminEmails.forEach((email) => {
    html += `
      <span class="admin-email-pill secondary">
        <span>${escapeHtml(email)}</span>
        <button type="button" class="admin-remove-email-btn" data-email="${escapeHtml(email)}" title="Remove administrator access">&times;</button>
      </span>
    `;
  });

  listEl.innerHTML = html;
}

function addAdditionalAdminEmail(rawEmail) {
  if (!rawEmail) return;
  const email = rawEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }
  if (email === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    alert("This email is already the permanent Master Owner.");
    return;
  }
  if (additionalAdminEmails.map((e) => e.toLowerCase()).includes(email)) {
    alert("This email is already in the trusted administrator list.");
    return;
  }

  additionalAdminEmails.push(email);
  try {
    localStorage.setItem("codex_admin_emails", JSON.stringify(additionalAdminEmails));
  } catch (err) {}

  renderAdminEmailsList();
  showStatus(`Added ${email} to admin list.`);
  updateAuthUI(auth?.currentUser);
}

function removeAdditionalAdminEmail(email) {
  if (!email) return;
  const target = email.trim().toLowerCase();
  additionalAdminEmails = additionalAdminEmails.filter((e) => e.toLowerCase() !== target);
  try {
    localStorage.setItem("codex_admin_emails", JSON.stringify(additionalAdminEmails));
  } catch (err) {}

  renderAdminEmailsList();
  showStatus(`Removed ${target} from admin list.`);
  updateAuthUI(auth?.currentUser);
}

function initAdminPanel() {
  // Preset selector auto-fill
  const presetSelect = document.getElementById("adminPresetSelect");
  if (presetSelect) {
    presetSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      const nameInput = document.getElementById("adminDispenserName");
      const typeSelect = document.getElementById("adminDispenserType");
      const dmgInput = document.getElementById("adminDispenserDmg");
      const notesInput = document.getElementById("adminDispenserNotes");

      if (val === "vorpal") {
        if (nameInput) nameInput.value = "Vorpal Greatsword (+3)";
        if (typeSelect) typeSelect.value = "weapon";
        if (dmgInput) dmgInput.value = "2d6+3 Slashing";
        if (notesInput) notesInput.value = "Requires Attunement. You gain a +3 bonus to attack and damage rolls made with this magic weapon. When you roll a 20 on an attack roll, you cut off one of the creature's heads.";
      } else if (val === "flametongue") {
        if (nameInput) nameInput.value = "Flame Tongue Longsword";
        if (typeSelect) typeSelect.value = "weapon";
        if (dmgInput) dmgInput.value = "1d8 Slashing + 2d6 Fire";
        if (notesInput) notesInput.value = "Requires Attunement. Bonus action speaks the command word to ignite the blade. Deals an extra 2d6 fire damage on hit and sheds bright light in a 40-foot radius.";
      } else if (val === "potions") {
        if (nameInput) nameInput.value = "Potion of Superior Healing (x5)";
        if (typeSelect) typeSelect.value = "item";
        if (dmgInput) dmgInput.value = "5";
        if (notesInput) notesInput.value = "Potion (Rare). Drinking this crimson potion regains 8d4 + 8 hit points. Bundle of 5 vials in a protective leather pouch.";
      } else if (val === "bag") {
        if (nameInput) nameInput.value = "Bag of Holding";
        if (typeSelect) typeSelect.value = "item";
        if (dmgInput) dmgInput.value = "1";
        if (notesInput) notesInput.value = "Wondrous Item (Uncommon). Holds up to 500 pounds and 64 cubic feet of volume while weighing only 15 pounds.";
      } else if (val === "goldchest") {
        if (nameInput) nameInput.value = "Hoard Treasure Chest";
        if (typeSelect) typeSelect.value = "coin";
        if (dmgInput) dmgInput.value = "500";
        if (notesInput) notesInput.value = "An iron-bound dwarven chest filled with 500 GP, 50 PP, and 100 SP.";
      }
    });
  }

  // Broadcast target selector toggle custom room code & end time inputs
  const targetSelect = document.getElementById("adminBroadcastTarget");
  if (targetSelect) {
    const updateBroadcastInputs = () => {
      const val = targetSelect.value;
      const customWrap = document.getElementById("adminCustomRoomCodeWrap");
      const endWrap = document.getElementById("adminNoticeEndTimeWrap") || document.getElementById("adminNoticeDurationWrap");
      const textInput = document.getElementById("adminBroadcastText");

      if (endWrap) endWrap.style.display = val === "top_banner" ? "block" : "none";
      if (customWrap) customWrap.style.display = val === "custom" ? "block" : "none";
      if (textInput) {
        textInput.placeholder = val === "top_banner"
          ? "Type notice to display at the top of the website for all visitors..."
          : "Type system announcement text here...";
      }
    };
    targetSelect.addEventListener("change", updateBroadcastInputs);
    updateBroadcastInputs();
  }

  // Form submit listeners
  const broadcastForm = document.getElementById("adminBroadcastForm");
  if (broadcastForm) {
    broadcastForm.addEventListener("submit", sendAdminBroadcast);
  }

  const dispenserForm = document.getElementById("adminDispenserForm");
  if (dispenserForm) {
    dispenserForm.addEventListener("submit", spawnAdminItem);
  }

  renderAdminEmailsList();
}

/* ==========================================================================
   OWLBEAR RODEO VTT INTEGRATION & NATIVE BATTLE MAP ENGINE
   ========================================================================== */

const OWLBEAR_ROOM_KEY = "codex_owlbear_room_url";
const OWLBEAR_STATE_PREFIX = "codex_owlbear_vtt_state_";

const VTT_SCENE_META = {
  forest_ambush: { title: "🌲 Forest Road Ambush", cols: 26, rows: 18 },
  dungeon_crypt: { title: "💀 Crypt of the Lich King", cols: 26, rows: 18 },
  tavern_inn: { title: "🍺 The Gilded Gryphon Inn", cols: 24, rows: 16 },
  magma_cavern: { title: "🌋 Dragon's Magma Lair", cols: 28, rows: 18 },
  arcane_sanctum: { title: "✨ Astral Arcane Sanctum", cols: 24, rows: 18 },
  pirate_galleon: { title: "⛵ High Seas Galleon", cols: 28, rows: 18 },
  parchment_mat: { title: "📜 Classic Parchment Grid", cols: 26, rows: 18 }
};

const VTT_PRESET_TOKENS = {
  owlbear: { name: "Owlbear", icon: "🦉", size: 2, hp: 59, ac: 13, color: "#d97706" },
  dragon: { name: "Red Dragon", icon: "🐉", size: 3, hp: 178, ac: 18, color: "#dc2626" },
  goblin: { name: "Goblin", icon: "👺", size: 1, hp: 7, ac: 15, color: "#16a34a" },
  skeleton: { name: "Skeleton", icon: "💀", size: 1, hp: 13, ac: 13, color: "#94a3b8" },
  orc: { name: "Orc Brute", icon: "👹", size: 1, hp: 15, ac: 13, color: "#ea580c" },
  bandit: { name: "Bandit", icon: "🗡️", size: 1, hp: 11, ac: 12, color: "#b91c1c" },
  wolf: { name: "Dire Wolf", icon: "🐺", size: 2, hp: 37, ac: 14, color: "#64748b" },
  beholder: { name: "Beholder", icon: "👁️", size: 2, hp: 180, ac: 18, color: "#9333ea" },
  lich: { name: "Lich", icon: "🧙‍♂️", size: 1, hp: 135, ac: 17, color: "#7c3aed" },
  knight: { name: "Knight", icon: "🛡️", size: 1, hp: 52, ac: 18, color: "#3b82f6" },
  mimic: { name: "Mimic", icon: "📦", size: 1, hp: 58, ac: 12, color: "#a16207" },
  cultist: { name: "Cultist", icon: "🕯️", size: 1, hp: 9, ac: 12, color: "#be123c" },
  chest: { name: "Loot Chest", icon: "💰", size: 1, hp: 20, ac: 10, color: "#eab308" },
  campfire: { name: "Campfire", icon: "🔥", size: 1, hp: 10, ac: 10, color: "#f97316" },
  trap: { name: "Hazard Trap", icon: "⚙️", size: 1, hp: 15, ac: 12, color: "#ef4444" },
  portal: { name: "Arcane Portal", icon: "🌀", size: 2, hp: 50, ac: 15, color: "#06b6d4" }
};

let vttActiveMode = "real_owlbear"; // 'real_owlbear' | 'native' | 'stream' | 'iframe'
let vttCurrentTool = "select"; // 'select' | 'pan' | 'measure' | 'ping' | 'draw' | 'aoe' | 'fog'
let vttDrawColor = "#d4af37";
let vttAoeShape = "sphere_20";
let vttFogBrushMode = "reveal"; // 'reveal' | 'hide'

let vttCamera = { x: 40, y: 30, zoom: 1.0, gridSize: 48 };
let vttShowGrid = true;
let vttSnapToGrid = true;
let vttSelectedTokenId = null;
let vttDraggingToken = null;
let vttDragOffset = { x: 0, y: 0 };
let vttIsPanning = false;
let vttPanStart = { x: 0, y: 0 };
let vttSpacePressed = false;

let vttActiveMeasure = null; // { x1, y1, x2, y2 } in grid coords
let vttActiveDrawStroke = null;
let vttActiveAoeDraft = null;
let vttActiveFogRect = null;
let vttPings = []; // [{ x, y, color, createdAt }]
let vttAnimFrameId = null;

let vttImageCache = {};
let vttRoomUnsubscribe = null;
let vttActiveSyncRoomId = "";
let vttLastLocalUpdateTs = 0;
let vttSyncDebounceTimer = null;
let vttMediaStream = null;
let vttUserLeftMap = false;
let vttCameraInitialized = false;

let vttState = {
  scene: "forest_ambush",
  customMapUrl: "",
  fogEnabled: false,
  fogRects: [], // [{ x, y, w, h, mode: 'reveal'|'hide' }] in grid coords
  drawings: [], // [{ color, points: [{x,y}] }]
  aoes: [],     // [{ id, shape, x1, y1, x2, y2, color }]
  tokens: []
};

function normalizeOwlbearUrl(raw) {
  if (!raw) return "";
  let clean = raw.trim();
  if (!clean) return "";
  if (/^(https?:\/\/)/i.test(clean)) return clean;
  if (clean.includes("owlbear.rodeo") || clean.includes("owlbear.app")) {
    return "https://" + clean;
  }
  return clean;
}

function extractOwlbearRoomId(rawUrl) {
  if (!rawUrl) return "";
  const clean = rawUrl.trim();
  if (!clean) return "";
  const roomMatch = clean.match(/\/room\/([a-zA-Z0-9_-]+)/i);
  if (roomMatch && roomMatch[1]) {
    return "OBR-" + roomMatch[1].replace(/[^a-zA-Z0-9]/g, "").slice(0, 20).toUpperCase();
  }
  const alnum = clean.replace(/^https?:\/\/(www\.)?owlbear\.(rodeo|app)\/?/i, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alnum.length >= 2) {
    return "OBR-" + alnum.slice(0, 20);
  }
  return "OBR-TABLETOP";
}

function extractOwlbearRoomDisplayName(rawUrl, fallbackId) {
  if (!rawUrl) return fallbackId || "OBR-TABLETOP";
  const clean = rawUrl.trim();
  const fullMatch = clean.match(/\/room\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_% -]+))?/i);
  if (fullMatch) {
    const slug = fullMatch[2] ? decodeURIComponent(fullMatch[2]).replace(/[-_]+/g, " ").trim() : "";
    const code = fullMatch[1].slice(0, 12);
    return slug ? `${slug} (${code})` : `Owlbear Room (${code})`;
  }
  return clean.length > 38 ? `${fallbackId} (${clean.slice(0, 32)}…)` : clean;
}

function inferSceneFromUrl(rawUrl) {
  const s = String(rawUrl || "").toLowerCase();
  if (/crypt|tomb|dungeon|lich|undead|catacomb|skeleton/.test(s)) return "dungeon_crypt";
  if (/tavern|inn|bar|pub|gryphon/.test(s)) return "tavern_inn";
  if (/lava|magma|dragon|volcano|inferno|hell|fire/.test(s)) return "magma_cavern";
  if (/astral|arcane|sanctum|void|tower|portal|magic/.test(s)) return "arcane_sanctum";
  if (/ship|pirate|galleon|sea|ocean|boat|naval/.test(s)) return "pirate_galleon";
  if (/parchment|grid|blank|mat/.test(s)) return "parchment_mat";
  return "forest_ambush";
}

function getStoredOwlbearUrl() {
  try {
    return localStorage.getItem(OWLBEAR_ROOM_KEY) || "";
  } catch (e) {
    return "";
  }
}

function updateOwlbearVitalsHUD() {
  const hpEl = document.getElementById("owlbearHpDisplay");
  const acEl = document.getElementById("owlbearAcDisplay");
  const percEl = document.getElementById("owlbearPercDisplay");
  const inspEl = document.getElementById("owlbearInspDisplay");

  const curHp = document.getElementById("curHp")?.value || 0;
  const maxHp = document.getElementById("maxHp")?.value || 0;
  const ac = document.getElementById("armorClass")?.value || 10;
  const perc = document.getElementById("passivePerception")?.value || 10;
  const hasInsp = document.getElementById("heroicInspirationToggle")?.checked || false;

  if (hpEl) hpEl.textContent = `${curHp}/${maxHp}`;
  if (acEl) acEl.textContent = ac;
  if (percEl) percEl.textContent = perc;
  if (inspEl) {
    inspEl.textContent = hasInsp ? "Yes" : "No";
    inspEl.style.color = hasInsp ? "#c084fc" : "var(--text-dim)";
  }
}

function switchOwlbearViewMode(mode) {
  vttActiveMode = mode || "real_owlbear";
  document.querySelectorAll(".owlbear-mode-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.vttMode === vttActiveMode);
  });

  const realLayer = document.getElementById("owlbearRealEngineLayer");
  const realFrame = document.getElementById("owlbearRealEngineFrame");
  const realHomeBtn = document.getElementById("owlbearRealHomeBtn");
  const sceneLabel = document.getElementById("vttActiveSceneLabel");
  const nativeLayer = document.getElementById("owlbearNativeVttLayer");
  const streamLayer = document.getElementById("owlbearStreamLayer");
  const iframeWrapper = document.getElementById("owlbearIframeWrapper");
  const iframe = document.getElementById("owlbearIframe");

  if (realLayer) realLayer.style.display = vttActiveMode === "real_owlbear" ? "flex" : "none";
  if (realHomeBtn) realHomeBtn.style.display = vttActiveMode === "real_owlbear" ? "inline-flex" : "none";
  if (sceneLabel) sceneLabel.style.display = vttActiveMode === "native" ? "inline-flex" : "none";
  if (nativeLayer) nativeLayer.style.display = vttActiveMode === "native" ? "block" : "none";
  if (streamLayer) streamLayer.style.display = vttActiveMode === "stream" ? "flex" : "none";
  if (iframeWrapper) iframeWrapper.style.display = vttActiveMode === "iframe" ? "flex" : "none";

  if (vttActiveMode === "real_owlbear" && realFrame) {
    const raw = getStoredOwlbearUrl();
    const roomId = extractOwlbearRoomId(raw || "OBR-TABLETOP");
    const targetSrc = `./owlbear/index.html#/game/${encodeURIComponent(roomId)}`;
    if (!realFrame.getAttribute("src") || !realFrame.getAttribute("src").includes(`#/game/${encodeURIComponent(roomId)}`)) {
      realFrame.src = targetSrc;
    }
  }

  if (vttActiveMode === "iframe" && iframe) {
    const raw = getStoredOwlbearUrl();
    const targetUrl = /^https?:\/\//i.test(raw) ? raw : "https://www.owlbear.rodeo";
    if (iframe.src !== targetUrl) {
      iframe.src = targetUrl;
    }
  }

  if (vttActiveMode === "native") {
    requestAnimationFrame(() => resizeAndRenderOwlbearCanvas());
  }
}

function setOwlbearRoomUrl(rawUrl, broadcast = true) {
  const cleanUrl = normalizeOwlbearUrl(rawUrl);
  try {
    if (cleanUrl) {
      vttUserLeftMap = false;
      localStorage.setItem(OWLBEAR_ROOM_KEY, cleanUrl);
    } else {
      localStorage.removeItem(OWLBEAR_ROOM_KEY);
    }
  } catch (e) {}

  const input = document.getElementById("owlbearRoomUrlInput");
  const wizardInput = document.getElementById("owlbearWizardRoomInput");
  const iframe = document.getElementById("owlbearIframe");
  const emptyState = document.getElementById("owlbearEmptyState");
  const activeContainer = document.getElementById("owlbearActiveContainer");
  const statusPill = document.getElementById("owlbearStatusPill");
  const statusText = document.getElementById("owlbearStatusText");
  const navBadge = document.getElementById("owlbearNavBadge");
  const leaveBtn = document.getElementById("owlbearLeaveBtn");
  const modeSwitcher = document.getElementById("owlbearModeSwitcher");
  const activeUrlDisplay = document.getElementById("owlbearActiveUrlDisplay");

  if (input) input.value = cleanUrl;
  if (wizardInput) wizardInput.value = cleanUrl;

  if (cleanUrl) {
    const roomId = extractOwlbearRoomId(cleanUrl);
    const displayName = extractOwlbearRoomDisplayName(cleanUrl, roomId);
    if (activeUrlDisplay) {
      activeUrlDisplay.textContent = displayName;
      activeUrlDisplay.title = cleanUrl;
    }
    if (emptyState) emptyState.style.display = "none";
    if (activeContainer) activeContainer.style.display = "flex";
    if (leaveBtn) leaveBtn.style.display = "inline-flex";
    if (modeSwitcher) modeSwitcher.style.display = "inline-flex";
    if (statusPill) statusPill.classList.add("is-active");
    if (statusText) statusText.textContent = `Active (${displayName})`;
    if (navBadge) navBadge.style.display = "inline-block";

    loadOwlbearRoomState(roomId, cleanUrl);
    const realFrame = document.getElementById("owlbearRealEngineFrame");
    if (realFrame) {
      realFrame.src = `./owlbear/index.html#/game/${encodeURIComponent(roomId)}`;
    }
    switchOwlbearViewMode(vttActiveMode || "real_owlbear");
  } else {
    if (vttSyncDebounceTimer) {
      clearTimeout(vttSyncDebounceTimer);
      vttSyncDebounceTimer = null;
    }
    stopOwlbearStream();
    if (vttRoomUnsubscribe) {
      vttRoomUnsubscribe();
      vttRoomUnsubscribe = null;
    }
    vttActiveSyncRoomId = "";
    selectVttToken(null);
    const realFrame = document.getElementById("owlbearRealEngineFrame");
    if (realFrame) realFrame.src = "";
    if (iframe) iframe.src = "";
    if (activeUrlDisplay) activeUrlDisplay.textContent = "";
    if (emptyState) emptyState.style.display = "flex";
    if (activeContainer) activeContainer.style.display = "none";
    if (leaveBtn) leaveBtn.style.display = "none";
    if (modeSwitcher) modeSwitcher.style.display = "none";
    if (statusPill) statusPill.classList.remove("is-active");
    if (statusText) statusText.textContent = "No Room Loaded";
    if (navBadge) navBadge.style.display = "none";
  }

  updateOwlbearVitalsHUD();

  if (broadcast && cleanUrl) {
    broadcastOwlbearUrlToParty(cleanUrl);
  }
}

function leaveOwlbearRoom(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();

  vttUserLeftMap = true;
  if (vttSyncDebounceTimer) {
    clearTimeout(vttSyncDebounceTimer);
    vttSyncDebounceTimer = null;
  }

  // Exit theater mode if active
  if (document.body.classList.contains("owlbear-theater-active")) {
    document.body.classList.remove("owlbear-theater-active");
    const label = document.getElementById("owlbearTheaterBtnLabel");
    if (label) label.textContent = "Theater Mode";
  }

  setOwlbearRoomUrl("", false);

  // Also clear the shared room URL in Firestore if user is DM or in a room so onSnapshot doesn't re-trigger it
  const roomCode = activeDMRoomCode || connectedCampaignRoom;
  if (db && roomCode) {
    db.collection("campaigns").doc(roomCode).collection("handouts").doc("owlbear_vtt").set({
      id: "owlbear_vtt",
      title: "Owlbear Rodeo Battle Map",
      type: "map",
      content: JSON.stringify({ url: "", updatedAt: Date.now() }),
      isShared: false,
      createdAt: Date.now()
    }, { merge: true }).catch(() => {});
  }

  showStatus("Closed Owlbear battle map.");
}

function copyOwlbearRoomUrl() {
  const url = normalizeOwlbearUrl(document.getElementById("owlbearRoomUrlInput")?.value || getStoredOwlbearUrl());
  if (!url) {
    showStatus("No active Owlbear room link to copy.");
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showStatus("Owlbear room link copied to clipboard!");
    }).catch(() => {
      prompt("Copy Owlbear room link:", url);
    });
  } else {
    prompt("Copy Owlbear room link:", url);
  }
}

async function broadcastOwlbearUrlToParty(roomUrl) {
  const roomCode = activeDMRoomCode || connectedCampaignRoom;
  if (!db || !roomCode || !roomUrl) return;
  const isDM = Boolean(activeDMRoomCode && activeDMRoomCode === roomCode);
  try {
    await db.collection("campaigns").doc(roomCode).collection("handouts").doc("owlbear_vtt").set({
      id: "owlbear_vtt",
      title: "Owlbear Rodeo Battle Map",
      type: "map",
      author: isDM ? "Dungeon Master" : "Party Member",
      content: JSON.stringify({ url: roomUrl, updatedAt: Date.now() }),
      isShared: true,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not broadcast Owlbear URL to party:", err);
  }
}

function toggleOwlbearTheaterMode() {
  const isActive = document.body.classList.toggle("owlbear-theater-active");
  const label = document.getElementById("owlbearTheaterBtnLabel");
  if (label) {
    label.textContent = isActive ? "Exit Theater" : "Theater Mode";
  }
  requestAnimationFrame(() => resizeAndRenderOwlbearCanvas());
  showStatus(isActive ? "Theater Mode: Fullscreen map view enabled." : "Exited Theater Mode.");
}

/* --------------------------------------------------------------------------
   STATE PERSISTENCE & REAL-TIME FIREBASE MULTIPLAYER SYNC
   -------------------------------------------------------------------------- */

function getDefaultTokensForNewMap() {
  const charName = document.getElementById("charName")?.value?.trim() || "Hero";
  const curHp = parseInt(document.getElementById("curHp")?.value, 10) || 24;
  const maxHp = parseInt(document.getElementById("maxHp")?.value, 10) || 24;
  const ac = parseInt(document.getElementById("armorClass")?.value, 10) || 16;
  const avatar = (typeof myCharacterAvatar !== "undefined" && myCharacterAvatar) ? myCharacterAvatar : "";
  const heroId = (typeof activeCharId !== "undefined" && activeCharId) ? activeCharId : "main";

  return [
    {
      id: "tok_hero_" + heroId,
      charId: heroId,
      name: charName,
      icon: "⚔️",
      avatar: avatar,
      x: 8,
      y: 9,
      size: 1,
      hpCur: curHp,
      hpMax: maxHp,
      ac: ac,
      color: "#d4af37",
      conditions: []
    },
    {
      id: "tok_owlbear_1",
      name: "Wild Owlbear",
      icon: "🦉",
      avatar: "",
      x: 15,
      y: 8,
      size: 2,
      hpCur: 59,
      hpMax: 59,
      ac: 13,
      color: "#d97706",
      conditions: []
    },
    {
      id: "tok_goblin_1",
      name: "Goblin Scout",
      icon: "👺",
      avatar: "",
      x: 13,
      y: 6,
      size: 1,
      hpCur: 7,
      hpMax: 7,
      ac: 15,
      color: "#16a34a",
      conditions: []
    }
  ];
}

function loadOwlbearRoomState(roomId, rawUrl = "") {
  const syncRoom = (activeDMRoomCode || connectedCampaignRoom || roomId || "OBR-TABLETOP").trim().toUpperCase();
  vttActiveSyncRoomId = syncRoom;
  vttCameraInitialized = false;
  const defaultScene = inferSceneFromUrl(rawUrl || roomId);

  // Load local cached state for instant startup
  try {
    const raw = localStorage.getItem(OWLBEAR_STATE_PREFIX + syncRoom);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        vttState.scene = parsed.scene || defaultScene;
        vttState.customMapUrl = parsed.customMapUrl || "";
        vttState.fogEnabled = Boolean(parsed.fogEnabled);
        vttState.fogRects = Array.isArray(parsed.fogRects) ? parsed.fogRects : [];
        vttState.drawings = Array.isArray(parsed.drawings) ? parsed.drawings : [];
        vttState.aoes = Array.isArray(parsed.aoes) ? parsed.aoes : [];
        vttState.tokens = Array.isArray(parsed.tokens) && parsed.tokens.length > 0 ? parsed.tokens : getDefaultTokensForNewMap();
      }
    } else {
      vttState = {
        scene: defaultScene,
        customMapUrl: "",
        fogEnabled: false,
        fogRects: [],
        drawings: [],
        aoes: [],
        tokens: getDefaultTokensForNewMap()
      };
    }
  } catch (e) {
    vttState.tokens = getDefaultTokensForNewMap();
  }

  syncVttUiControlsFromState();
  renderVttActiveTokensList();
  requestAnimationFrame(() => {
    resetVttCameraToFit();
    resizeAndRenderOwlbearCanvas();
  });

  startOwlbearDedicatedRoomListener(syncRoom);
}

async function startOwlbearDedicatedRoomListener(syncRoom) {
  if (!db || !syncRoom) return;
  if (vttRoomUnsubscribe) {
    vttRoomUnsubscribe();
    vttRoomUnsubscribe = null;
  }

  try {
    const campRef = db.collection("campaigns").doc(syncRoom);
    const snap = await campRef.get();
    if (!snap.exists) {
      await campRef.set({
        creatorUid: auth?.currentUser?.uid || "local",
        createdAt: Date.now()
      });
    }
  } catch (e) {}

  vttRoomUnsubscribe = db.collection("campaigns").doc(syncRoom).collection("handouts")
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") return;
        const doc = change.doc;
        const d = doc.data() || {};
        if (doc.id === "owlbear_vtt_state") {
          applyRemoteOwlbearVttState(d);
        } else if (doc.id === "owlbear_real_bridge" && d.content) {
          try {
            const msg = JSON.parse(d.content);
            const realFrame = document.getElementById("owlbearRealEngineFrame");
            if (realFrame && realFrame.contentWindow) {
              realFrame.contentWindow.postMessage(msg, "*");
            }
          } catch (e) {}
        }
      });
    }, (err) => {
      console.warn("Owlbear VTT room sync error:", err);
    });
}

function applyRemoteOwlbearVttState(docData) {
  if (!docData || !docData.content) return;
  if (docData.updatedAt && docData.updatedAt <= vttLastLocalUpdateTs) return;
  if (vttDraggingToken) return; // Don't interrupt active local token drag

  try {
    const parsed = JSON.parse(docData.content);
    if (!parsed || typeof parsed !== "object") return;

    vttState.scene = parsed.scene || "forest_ambush";
    vttState.customMapUrl = docData.imageUrl || parsed.customMapUrl || "";
    vttState.fogEnabled = Boolean(parsed.fogEnabled);
    vttState.fogRects = Array.isArray(parsed.fogRects) ? parsed.fogRects : [];
    vttState.drawings = Array.isArray(parsed.drawings) ? parsed.drawings : [];
    vttState.aoes = Array.isArray(parsed.aoes) ? parsed.aoes : [];
    if (Array.isArray(parsed.tokens)) {
      vttState.tokens = parsed.tokens;
    }

    if (parsed.lastPing && parsed.lastPing.createdAt && (Date.now() - parsed.lastPing.createdAt < 4000)) {
      const exists = vttPings.some((p) => p.createdAt === parsed.lastPing.createdAt);
      if (!exists) {
        vttPings.push(parsed.lastPing);
        startVttPingLoop();
      }
    }

    try {
      localStorage.setItem(OWLBEAR_STATE_PREFIX + vttActiveSyncRoomId, JSON.stringify(vttState));
    } catch (e) {}

    syncVttUiControlsFromState();
    renderVttActiveTokensList();
    updateSelectedTokenPopoverUI();
    renderOwlbearCanvas();
  } catch (err) {
    console.warn("Could not parse remote Owlbear state:", err);
  }
}

function saveAndSyncOwlbearState(extraPayload = {}) {
  const syncRoom = vttActiveSyncRoomId || extractOwlbearRoomId(getStoredOwlbearUrl()) || "OBR-TABLETOP";
  const now = Date.now();
  vttLastLocalUpdateTs = now;

  try {
    localStorage.setItem(OWLBEAR_STATE_PREFIX + syncRoom, JSON.stringify(vttState));
  } catch (e) {}

  if (!db || !syncRoom) return;

  if (vttSyncDebounceTimer) clearTimeout(vttSyncDebounceTimer);
  vttSyncDebounceTimer = setTimeout(async () => {
    try {
      // Keep token avatars lightweight for 50k content rule
      const compactTokens = vttState.tokens.map((t) => ({
        id: t.id,
        charId: t.charId || "",
        name: (t.name || "Token").slice(0, 50),
        icon: t.icon || "⚔️",
        avatar: (t.avatar && t.avatar.length < 18000) ? t.avatar : "",
        x: Math.round(t.x * 100) / 100,
        y: Math.round(t.y * 100) / 100,
        size: t.size || 1,
        hpCur: t.hpCur ?? 10,
        hpMax: t.hpMax ?? 10,
        ac: t.ac ?? 10,
        color: t.color || "#d4af37",
        conditions: Array.isArray(t.conditions) ? t.conditions : []
      }));

      const payloadObj = {
        scene: vttState.scene,
        fogEnabled: Boolean(vttState.fogEnabled),
        fogRects: (vttState.fogRects || []).slice(-60),
        drawings: (vttState.drawings || []).slice(-40),
        aoes: (vttState.aoes || []).slice(-25),
        tokens: compactTokens,
        ...extraPayload
      };

      const contentStr = JSON.stringify(payloadObj);
      const customImg = (vttState.customMapUrl && vttState.customMapUrl.length <= 480000) ? vttState.customMapUrl : "";

      await db.collection("campaigns").doc(syncRoom).collection("handouts").doc("owlbear_vtt_state").set({
        id: "owlbear_vtt_state",
        title: "Owlbear VTT Live State",
        type: "map",
        author: document.getElementById("charName")?.value?.trim() || "Adventurer",
        imageUrl: customImg,
        content: contentStr.slice(0, 49500),
        isShared: true,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.warn("Could not sync Owlbear state to Firestore:", err);
    }
  }, 120);
}

/* --------------------------------------------------------------------------
   PROCEDURAL FANTASY BATTLEMAP RENDERER + CANVAS ENGINE
   -------------------------------------------------------------------------- */

function getVttMapDimensions() {
  const meta = VTT_SCENE_META[vttState.scene] || VTT_SCENE_META.forest_ambush;
  return {
    cols: meta.cols,
    rows: meta.rows,
    width: meta.cols * vttCamera.gridSize,
    height: meta.rows * vttCamera.gridSize
  };
}

function resetVttCameraToFit() {
  const canvas = document.getElementById("owlbearMapCanvas");
  if (!canvas) return;
  const parent = canvas.parentElement || canvas;
  const rect = parent.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dims = getVttMapDimensions();
  const drawerOpen = document.getElementById("vttRightDrawer")?.classList.contains("open");
  const rightInset = drawerOpen ? 280 : 30;
  const availW = Math.max(300, rect.width - rightInset - 50);
  const availH = Math.max(300, rect.height - 40);
  const scaleX = availW / dims.width;
  const scaleY = availH / dims.height;
  vttCamera.zoom = Math.min(1.25, Math.max(0.45, Math.min(scaleX, scaleY) * 0.94));
  vttCamera.x = Math.max(54, (availW - dims.width * vttCamera.zoom) / 2 + 48);
  vttCamera.y = Math.max(16, (availH - dims.height * vttCamera.zoom) / 2 + 12);
  vttCameraInitialized = true;
  updateVttZoomLabel();
}

function updateVttZoomLabel() {
  const lbl = document.getElementById("vttZoomLabel");
  if (lbl) lbl.textContent = `${Math.round(vttCamera.zoom * 100)}%`;
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - vttCamera.x) / vttCamera.zoom,
    y: (sy - vttCamera.y) / vttCamera.zoom
  };
}

function screenToGrid(sx, sy) {
  const w = screenToWorld(sx, sy);
  return {
    gx: w.x / vttCamera.gridSize,
    gy: w.y / vttCamera.gridSize
  };
}

function getCachedVttImage(url) {
  if (!url) return null;
  if (vttImageCache[url]) {
    return vttImageCache[url].loaded ? vttImageCache[url].img : null;
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  vttImageCache[url] = { img, loaded: false };
  img.onload = () => {
    vttImageCache[url].loaded = true;
    renderOwlbearCanvas();
  };
  img.src = url;
  return null;
}

function drawProceduralBattlemap(ctx, scene, cols, rows, gs) {
  const W = cols * gs;
  const H = rows * gs;

  if (vttState.customMapUrl) {
    const customImg = getCachedVttImage(vttState.customMapUrl);
    if (customImg) {
      ctx.drawImage(customImg, 0, 0, W, H);
      return;
    }
  }

  if (scene === "forest_ambush") {
    // Rich woodland grass
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#192f1e");
    grad.addColorStop(0.5, "#213c26");
    grad.addColorStop(1, "#16291a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Winding dirt road (horizontal)
    ctx.fillStyle = "#5c4632";
    ctx.beginPath();
    ctx.moveTo(0, 7.5 * gs);
    ctx.bezierCurveTo(8 * gs, 6.5 * gs, 16 * gs, 9.5 * gs, W, 8 * gs);
    ctx.lineTo(W, 10.5 * gs);
    ctx.bezierCurveTo(16 * gs, 12 * gs, 8 * gs, 9 * gs, 0, 10 * gs);
    ctx.closePath();
    ctx.fill();

    // River cutting north-south
    ctx.fillStyle = "#1d4ed8";
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.moveTo(17 * gs, 0);
    ctx.bezierCurveTo(15.5 * gs, 6 * gs, 18.5 * gs, 12 * gs, 16.5 * gs, H);
    ctx.lineTo(19 * gs, H);
    ctx.bezierCurveTo(21 * gs, 12 * gs, 18 * gs, 6 * gs, 19.5 * gs, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Wooden Bridge at intersection
    ctx.fillStyle = "#784f2b";
    ctx.strokeStyle = "#3e2723";
    ctx.lineWidth = 3;
    ctx.fillRect(16.2 * gs, 8.1 * gs, 3.6 * gs, 2.4 * gs);
    ctx.strokeRect(16.2 * gs, 8.1 * gs, 3.6 * gs, 2.4 * gs);
    for (let bx = 16.5; bx < 19.6; bx += 0.45) {
      ctx.beginPath();
      ctx.moveTo(bx * gs, 8.1 * gs);
      ctx.lineTo(bx * gs, 10.5 * gs);
      ctx.stroke();
    }

    // Boulders
    const rocks = [[6, 5, 0.9], [11, 12, 1.1], [22, 6, 1.0], [14, 4, 0.7], [8, 13, 0.8]];
    ctx.fillStyle = "#475569";
    ctx.strokeStyle = "#1e293b";
    rocks.forEach(([rx, ry, r]) => {
      ctx.beginPath();
      ctx.arc(rx * gs, ry * gs, r * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Tree canopies
    const trees = [
      [3, 3, 1.6], [7, 2.5, 1.4], [12, 2.2, 1.5], [22, 3, 1.7], [24, 5, 1.3],
      [2.5, 14, 1.6], [6, 15.5, 1.5], [13, 15, 1.4], [22, 14.5, 1.7], [24.5, 12.5, 1.3]
    ];
    trees.forEach(([tx, ty, tr]) => {
      ctx.fillStyle = "rgba(10, 22, 12, 0.55)";
      ctx.beginPath();
      ctx.arc(tx * gs + 6, ty * gs + 6, tr * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#15803d";
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx * gs, ty * gs, tr * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc((tx - 0.3) * gs, (ty - 0.3) * gs, tr * 0.55 * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  } else if (scene === "dungeon_crypt") {
    // Stone Dungeon
    ctx.fillStyle = "#11131a";
    ctx.fillRect(0, 0, W, H);

    // Carved stone rooms
    ctx.fillStyle = "#262936";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    // West Entry Hall
    ctx.fillRect(2 * gs, 6 * gs, 6 * gs, 6 * gs);
    ctx.strokeRect(2 * gs, 6 * gs, 6 * gs, 6 * gs);
    // Corridor
    ctx.fillRect(8 * gs, 8 * gs, 3 * gs, 2 * gs);
    // Grand Crypt Chamber
    ctx.fillRect(11 * gs, 2 * gs, 13 * gs, 14 * gs);
    ctx.strokeRect(11 * gs, 2 * gs, 13 * gs, 14 * gs);

    // Glowing Arcane Ritual Circle in Crypt center
    const cx = 17.5 * gs;
    const cy = 9 * gs;
    const rGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 3 * gs);
    rGrad.addColorStop(0, "rgba(212, 175, 55, 0.32)");
    rGrad.addColorStop(0.6, "rgba(168, 85, 247, 0.18)");
    rGrad.addColorStop(1, "transparent");
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * gs, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(212, 175, 55, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2 * gs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6 * gs, 0, Math.PI * 2);
    ctx.stroke();

    // Stone Pillars
    const pillars = [[13, 4], [22, 4], [13, 14], [22, 14], [16, 4], [19, 4], [16, 14], [19, 14]];
    pillars.forEach(([px, py]) => {
      ctx.fillStyle = "#475569";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px * gs, py * gs, 0.45 * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Sarcophagi / Altar
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.fillRect(21 * gs, 8 * gs, 2 * gs, 2 * gs);
    ctx.strokeRect(21 * gs, 8 * gs, 2 * gs, 2 * gs);
  } else if (scene === "tavern_inn") {
    ctx.fillStyle = "#3b2314";
    ctx.fillRect(0, 0, W, H);

    // Wood plank lines
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += gs * 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Outer stone walls
    ctx.strokeStyle = "#78553a";
    ctx.lineWidth = 8;
    ctx.strokeRect(gs, gs, W - 2 * gs, H - 2 * gs);

    // Hearth Fireplace (North wall)
    ctx.fillStyle = "#475569";
    ctx.fillRect(10 * gs, gs, 4 * gs, 1.2 * gs);
    const fireGrad = ctx.createRadialGradient(12 * gs, 2 * gs, 4, 12 * gs, 2.5 * gs, 3.5 * gs);
    fireGrad.addColorStop(0, "rgba(251, 146, 60, 0.65)");
    fireGrad.addColorStop(1, "transparent");
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(12 * gs, 2.5 * gs, 3.5 * gs, 0, Math.PI * 2);
    ctx.fill();

    // Bar Counter
    ctx.fillStyle = "#5c341d";
    ctx.strokeStyle = "#271409";
    ctx.lineWidth = 3;
    ctx.fillRect(17 * gs, 3 * gs, 4 * gs, 1.2 * gs);
    ctx.strokeRect(17 * gs, 3 * gs, 4 * gs, 1.2 * gs);
    ctx.fillRect(17 * gs, 3 * gs, 1.2 * gs, 5 * gs);
    ctx.strokeRect(17 * gs, 3 * gs, 1.2 * gs, 5 * gs);

    // Banquet Tables
    const tables = [[4, 5, 3, 2], [4, 10, 3, 2], [10, 6, 4, 2], [10, 11, 4, 2], [17, 10, 3, 2]];
    ctx.fillStyle = "#6e4226";
    tables.forEach(([tx, ty, tw, th]) => {
      ctx.fillRect(tx * gs, ty * gs, tw * gs, th * gs);
      ctx.strokeRect(tx * gs, ty * gs, tw * gs, th * gs);
    });
  } else if (scene === "magma_cavern") {
    // Lava background
    const lavaGrad = ctx.createRadialGradient(W / 2, H / 2, gs, W / 2, H / 2, W * 0.7);
    lavaGrad.addColorStop(0, "#ea580c");
    lavaGrad.addColorStop(0.5, "#b91c1c");
    lavaGrad.addColorStop(1, "#450a0a");
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, W, H);

    // Obsidian islands
    ctx.fillStyle = "#1e1b24";
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 3;

    // West Island
    ctx.beginPath();
    ctx.ellipse(6 * gs, 9 * gs, 4.5 * gs, 5 * gs, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bridge
    ctx.fillRect(10 * gs, 8 * gs, 5 * gs, 2 * gs);

    // East Dragon Lair Island
    ctx.beginPath();
    ctx.ellipse(20 * gs, 9 * gs, 6 * gs, 6.5 * gs, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gold Hoard Pile
    const goldGrad = ctx.createRadialGradient(22 * gs, 9 * gs, 4, 22 * gs, 9 * gs, 2.5 * gs);
    goldGrad.addColorStop(0, "rgba(250, 204, 21, 0.85)");
    goldGrad.addColorStop(0.7, "rgba(202, 138, 4, 0.45)");
    goldGrad.addColorStop(1, "transparent");
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(22 * gs, 9 * gs, 2.5 * gs, 0, Math.PI * 2);
    ctx.fill();
  } else if (scene === "arcane_sanctum") {
    ctx.fillStyle = "#070512";
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const platGrad = ctx.createRadialGradient(cx, cy, gs, cx, cy, 7.5 * gs);
    platGrad.addColorStop(0, "#1e1b4b");
    platGrad.addColorStop(0.8, "#0f172a");
    platGrad.addColorStop(1, "#070512");
    ctx.fillStyle = platGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 7.5 * gs, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 3;
    [7.2, 5.2, 3.0, 1.2].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * gs, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (scene === "pirate_galleon") {
    // Ocean
    ctx.fillStyle = "#0c2d48";
    ctx.fillRect(0, 0, W, H);

    // Ship Hull
    ctx.fillStyle = "#5c3a21";
    ctx.strokeStyle = "#2b180a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4 * gs, 9 * gs);
    ctx.quadraticCurveTo(8 * gs, 4.5 * gs, 22 * gs, 5 * gs);
    ctx.lineTo(24 * gs, 9 * gs);
    ctx.lineTo(22 * gs, 13 * gs);
    ctx.quadraticCurveTo(8 * gs, 13.5 * gs, 4 * gs, 9 * gs);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3 Masts
    ctx.fillStyle = "#3e2723";
    [9, 14, 19].forEach((mx) => {
      ctx.beginPath();
      ctx.arc(mx * gs, 9 * gs, 0.55 * gs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else {
    // Parchment Mat
    ctx.fillStyle = "#d9c5a0";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#8c6d46";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }
}

function resizeAndRenderOwlbearCanvas() {
  const canvas = document.getElementById("owlbearMapCanvas");
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }

  if (!vttCameraInitialized) {
    resetVttCameraToFit();
  }

  renderOwlbearCanvas();
}

function renderOwlbearCanvas() {
  const canvas = document.getElementById("owlbearMapCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const viewW = canvas.width / dpr;
  const viewH = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Outer Tabletop Void Background (Owlbear dark slate with subtle dots)
  ctx.fillStyle = "#090710";
  ctx.fillRect(0, 0, viewW, viewH);

  // Apply Camera Pan & Zoom
  ctx.translate(vttCamera.x, vttCamera.y);
  ctx.scale(vttCamera.zoom, vttCamera.zoom);

  const dims = getVttMapDimensions();
  const gs = vttCamera.gridSize;

  // Map Drop Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(8, 10, dims.width, dims.height);

  // 1. Draw Battlemap Scene
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dims.width, dims.height);
  ctx.clip();
  drawProceduralBattlemap(ctx, vttState.scene, dims.cols, dims.rows, gs);

  // 2. Draw Tactical Grid Overlay
  if (vttShowGrid) {
    const isParchment = vttState.scene === "parchment_mat";
    ctx.strokeStyle = isParchment ? "rgba(70, 45, 20, 0.28)" : "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1 / vttCamera.zoom;

    ctx.beginPath();
    for (let c = 0; c <= dims.cols; c++) {
      ctx.moveTo(c * gs, 0);
      ctx.lineTo(c * gs, dims.height);
    }
    for (let r = 0; r <= dims.rows; r++) {
      ctx.moveTo(0, r * gs);
      ctx.lineTo(dims.width, r * gs);
    }
    ctx.stroke();
  }

  // 3. Draw Spell AoE Templates
  const allAoes = [...(vttState.aoes || [])];
  if (vttActiveAoeDraft) allAoes.push(vttActiveAoeDraft);
  allAoes.forEach((aoe) => drawVttAoeTemplate(ctx, aoe, gs));

  // 4. Draw Freehand Ink Strokes
  const allDrawings = [...(vttState.drawings || [])];
  if (vttActiveDrawStroke) allDrawings.push(vttActiveDrawStroke);
  allDrawings.forEach((stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color || "#d4af37";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * gs, stroke.points[0].y * gs);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * gs, stroke.points[i].y * gs);
    }
    ctx.stroke();
  });

  // 5. Draw Tokens
  (vttState.tokens || []).forEach((tok) => {
    drawVttToken(ctx, tok, gs);
  });

  // 6. Draw Fog of War
  if (vttState.fogEnabled) {
    drawVttFogOfWar(ctx, dims.width, dims.height, gs);
  }
  if (vttActiveFogRect) {
    ctx.strokeStyle = vttFogBrushMode === "reveal" ? "#4ade80" : "#f87171";
    ctx.lineWidth = 2 / vttCamera.zoom;
    ctx.setLineDash([6, 4]);
    const rx = Math.min(vttActiveFogRect.x1, vttActiveFogRect.x2) * gs;
    const ry = Math.min(vttActiveFogRect.y1, vttActiveFogRect.y2) * gs;
    const rw = Math.abs(vttActiveFogRect.x2 - vttActiveFogRect.x1) * gs;
    const rh = Math.abs(vttActiveFogRect.y2 - vttActiveFogRect.y1) * gs;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  // 7. Draw Active Ruler Measurement
  if (vttActiveMeasure) {
    drawVttRuler(ctx, vttActiveMeasure, gs);
  }

  // 8. Draw Animated Pings
  const now = Date.now();
  vttPings = vttPings.filter((p) => now - p.createdAt < 2800);
  vttPings.forEach((p) => {
    const age = (now - p.createdAt) / 2800;
    const px = p.x * gs;
    const py = p.y * gs;
    for (let ring = 0; ring < 3; ring++) {
      const rAge = (age * 2 + ring * 0.33) % 1;
      ctx.strokeStyle = p.color || "#d4af37";
      ctx.globalAlpha = (1 - rAge) * 0.85;
      ctx.lineWidth = 3 / vttCamera.zoom;
      ctx.beginPath();
      ctx.arc(px, py, rAge * gs * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  ctx.restore();

  // Map Border Frame
  ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
  ctx.lineWidth = 2 / vttCamera.zoom;
  ctx.strokeRect(0, 0, dims.width, dims.height);

  ctx.restore();
}

function drawVttAoeTemplate(ctx, aoe, gs) {
  const x1 = aoe.x1 * gs;
  const y1 = aoe.y1 * gs;
  const x2 = aoe.x2 * gs;
  const y2 = aoe.y2 * gs;
  const color = aoe.color || "#f97316";

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  if (aoe.shape.startsWith("sphere_")) {
    const feet = parseInt(aoe.shape.split("_")[1], 10) || 20;
    const radiusSq = feet / 5;
    const r = radiusSq * gs;
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(x1, y1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    drawCanvasBadge(ctx, x1, y1, `${feet}ft Sphere`);
  } else if (aoe.shape.startsWith("cube_")) {
    const feet = parseInt(aoe.shape.split("_")[1], 10) || 15;
    const side = (feet / 5) * gs;
    ctx.globalAlpha = 0.24;
    ctx.fillRect(x1 - side / 2, y1 - side / 2, side, side);
    ctx.globalAlpha = 0.85;
    ctx.strokeRect(x1 - side / 2, y1 - side / 2, side, side);
    drawCanvasBadge(ctx, x1, y1, `${feet}ft Cube`);
  } else if (aoe.shape.startsWith("cone_")) {
    const feet = parseInt(aoe.shape.split("_")[1], 10) || 15;
    const len = (feet / 5) * gs;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const halfSpread = Math.atan(0.5); // 5e 53-degree cone (width = distance)
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.arc(x1, y1, len, angle - halfSpread, angle + halfSpread);
    ctx.closePath();
    ctx.globalAlpha = 0.26;
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    drawCanvasBadge(ctx, x1 + Math.cos(angle) * len * 0.6, y1 + Math.sin(angle) * len * 0.6, `${feet}ft Cone`);
  } else if (aoe.shape.startsWith("line_")) {
    const feet = parseInt(aoe.shape.split("_")[1], 10) || 30;
    const len = (feet / 5) * gs;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.26;
    ctx.fillRect(0, -gs / 2, len, gs);
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(0, -gs / 2, len, gs);
  }
  ctx.restore();
}

function drawVttToken(ctx, tok, gs) {
  const sizeSq = parseFloat(tok.size) || 1;
  const diameter = sizeSq * gs;
  const radius = diameter * 0.44;
  const cx = (tok.x + sizeSq / 2) * gs;
  const cy = (tok.y + sizeSq / 2) * gs;
  const isSelected = tok.id === vttSelectedTokenId;
  const conds = Array.isArray(tok.conditions) ? tok.conditions : [];

  ctx.save();
  if (conds.includes("hidden")) {
    ctx.globalAlpha = 0.48;
  }

  // Selection Halo
  if (isSelected) {
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Drop Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, radius, 0, Math.PI * 2);
  ctx.fill();

  // Token Base Circle Fill
  ctx.fillStyle = "#181326";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Avatar or Icon
  const avatarImg = tok.avatar ? getCachedVttImage(tok.avatar) : null;
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    ctx.font = `${Math.round(radius * 1.05)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tok.icon || "⚔️", cx, cy + 1);
  }

  // Colored Metallic Ring
  ctx.strokeStyle = tok.color || "#d4af37";
  ctx.lineWidth = Math.max(3, radius * 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Dead overlay
  if (conds.includes("dead") || (tok.hpMax > 0 && tok.hpCur <= 0)) {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.6, cy - radius * 0.6);
    ctx.lineTo(cx + radius * 0.6, cy + radius * 0.6);
    ctx.moveTo(cx + radius * 0.6, cy - radius * 0.6);
    ctx.lineTo(cx - radius * 0.6, cy + radius * 0.6);
    ctx.stroke();
  }

  // Condition Badges around top-right of token
  const condEmojiMap = {
    bloodied: "🩸",
    poisoned: "☠️",
    concentrating: "💠",
    hexed: "🔮",
    blessed: "✨",
    prone: "⛓️",
    hidden: "👁️"
  };
  let badgeIdx = 0;
  conds.forEach((c) => {
    if (!condEmojiMap[c]) return;
    const angle = -Math.PI / 3 + badgeIdx * 0.48;
    const bx = cx + Math.cos(angle) * (radius + 2);
    const by = cy + Math.sin(angle) * (radius + 2);
    ctx.fillStyle = "rgba(10, 8, 16, 0.9)";
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(condEmojiMap[c], bx, by);
    badgeIdx++;
  });

  // HP Bar (Above Token)
  if (tok.hpMax > 0) {
    const barW = Math.max(38, diameter * 0.82);
    const barH = 7;
    const barX = cx - barW / 2;
    const barY = cy - radius - 12;
    const pct = Math.max(0, Math.min(1, (tok.hpCur ?? tok.hpMax) / tok.hpMax));

    ctx.fillStyle = "rgba(8, 6, 14, 0.88)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    ctx.fillStyle = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#eab308" : "#ef4444";
    ctx.fillRect(barX, barY, barW * pct, barH);
  }

  // Token Nameplate (Below Token)
  if (tok.name) {
    ctx.font = "bold 11px 'Inter', sans-serif";
    const textW = ctx.measureText(tok.name).width;
    const padX = 6;
    const pillW = textW + padX * 2;
    const pillH = 16;
    const pillX = cx - pillW / 2;
    const pillY = cy + radius + 4;

    ctx.fillStyle = "rgba(10, 8, 18, 0.88)";
    ctx.strokeStyle = isSelected ? "#4ade80" : "rgba(212, 175, 55, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tok.name, cx, pillY + pillH / 2);
  }

  ctx.restore();
}

function drawVttFogOfWar(ctx, mapW, mapH, gs) {
  ctx.save();
  // Create offscreen or path clipping for fog
  ctx.fillStyle = "rgba(6, 5, 11, 0.92)";
  ctx.fillRect(0, 0, mapW, mapH);

  (vttState.fogRects || []).forEach((r) => {
    const rx = r.x * gs;
    const ry = r.y * gs;
    const rw = r.w * gs;
    const rh = r.h * gs;
    if (r.mode === "reveal") {
      ctx.clearRect(rx, ry, rw, rh);
      // Redraw underlying scene + tokens inside revealed rect?
      // Wait: clearRect on main canvas would erase map! Instead, let's use an offscreen canvas for Fog of War!
    }
  });
  ctx.restore();
}

let vttFogOffscreenCanvas = null;
function renderFogLayerWithOffscreen(ctx, mapW, mapH, gs) {
  if (!vttFogOffscreenCanvas) {
    vttFogOffscreenCanvas = document.createElement("canvas");
  }
  if (vttFogOffscreenCanvas.width !== mapW || vttFogOffscreenCanvas.height !== mapH) {
    vttFogOffscreenCanvas.width = mapW;
    vttFogOffscreenCanvas.height = mapH;
  }
  const fctx = vttFogOffscreenCanvas.getContext("2d");
  fctx.clearRect(0, 0, mapW, mapH);
  fctx.fillStyle = "rgba(7, 5, 12, 0.9)";
  fctx.fillRect(0, 0, mapW, mapH);

  (vttState.fogRects || []).forEach((r) => {
    const rx = r.x * gs;
    const ry = r.y * gs;
    const rw = r.w * gs;
    const rh = r.h * gs;
    if (r.mode === "reveal") {
      fctx.clearRect(rx, ry, rw, rh);
    } else {
      fctx.fillStyle = "rgba(7, 5, 12, 0.9)";
      fctx.fillRect(rx, ry, rw, rh);
    }
  });

  ctx.drawImage(vttFogOffscreenCanvas, 0, 0);
}

// Override drawVttFogOfWar with proper offscreen compositing so revealed areas show the map & tokens underneath!
drawVttFogOfWar = renderFogLayerWithOffscreen;

function drawVttRuler(ctx, m, gs) {
  const x1 = m.x1 * gs;
  const y1 = m.y1 * gs;
  const x2 = m.x2 * gs;
  const y2 = m.y2 * gs;

  const dxSq = Math.abs(m.x2 - m.x1);
  const dySq = Math.abs(m.y2 - m.y1);
  // D&D 5e grid distance (Chebyshev / max axis or Euclidean)
  const euclidSq = Math.hypot(dxSq, dySq);
  const feet = Math.round(euclidSq * 5);
  const squares = (Math.round(euclidSq * 10) / 10).toFixed(1);

  ctx.save();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x1, y1, 5, 0, Math.PI * 2);
  ctx.arc(x2, y2, 6, 0, Math.PI * 2);
  ctx.fill();

  drawCanvasBadge(ctx, (x1 + x2) / 2, (y1 + y2) / 2 - 16, `📏 ${feet} ft (${squares} sq)`);
  ctx.restore();
}

function drawCanvasBadge(ctx, x, y, text) {
  ctx.save();
  ctx.font = "bold 12px 'JetBrains Mono', monospace";
  const w = ctx.measureText(text).width + 14;
  const h = 22;
  ctx.fillStyle = "rgba(12, 10, 20, 0.92)";
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#facc15";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function startVttPingLoop() {
  if (vttAnimFrameId) return;
  const step = () => {
    renderOwlbearCanvas();
    if (vttPings.length > 0) {
      vttAnimFrameId = requestAnimationFrame(step);
    } else {
      vttAnimFrameId = null;
    }
  };
  vttAnimFrameId = requestAnimationFrame(step);
}

/* --------------------------------------------------------------------------
   TOKEN MANAGEMENT, PARTY SPAWNING & CONTEXT POPOVER
   -------------------------------------------------------------------------- */

function findTokenAtGridPos(gx, gy) {
  const list = vttState.tokens || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    const sz = parseFloat(t.size) || 1;
    if (gx >= t.x && gx <= t.x + sz && gy >= t.y && gy <= t.y + sz) {
      return t;
    }
  }
  return null;
}

function selectVttToken(tokenId) {
  vttSelectedTokenId = tokenId;
  updateSelectedTokenPopoverUI();
  renderVttActiveTokensList();
  renderOwlbearCanvas();
}

function updateSelectedTokenPopoverUI() {
  const pop = document.getElementById("vttTokenPopover");
  if (!pop) return;
  const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
  if (!tok) {
    pop.style.display = "none";
    return;
  }

  pop.style.display = "flex";
  const nameIn = document.getElementById("vttTokNameInput");
  const hpCurIn = document.getElementById("vttTokHpCur");
  const hpMaxIn = document.getElementById("vttTokHpMax");
  const acIn = document.getElementById("vttTokAcInput");
  const sizeSel = document.getElementById("vttTokSizeSelect");

  if (nameIn && document.activeElement !== nameIn) nameIn.value = tok.name || "";
  if (hpCurIn && document.activeElement !== hpCurIn) hpCurIn.value = tok.hpCur ?? 10;
  if (hpMaxIn && document.activeElement !== hpMaxIn) hpMaxIn.value = tok.hpMax ?? 10;
  if (acIn && document.activeElement !== acIn) acIn.value = tok.ac ?? 10;
  if (sizeSel) sizeSel.value = String(tok.size || 1);

  const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
  document.querySelectorAll("#vttTokConditionsRow .vtt-cond-btn").forEach((btn) => {
    btn.classList.toggle("active", conds.includes(btn.dataset.cond));
  });
}

function renderVttActiveTokensList() {
  const container = document.getElementById("vttActiveTokensList");
  if (!container) return;
  const tokens = vttState.tokens || [];
  if (tokens.length === 0) {
    container.innerHTML = `<span style="font-size:0.7rem; color:var(--text-dim);">No tokens on map. Click a creature above to spawn!</span>`;
    return;
  }

  container.innerHTML = tokens.map((t) => `
    <div class="vtt-active-token-item ${t.id === vttSelectedTokenId ? "selected" : ""}" data-token-id="${escapeHtml(t.id)}">
      <div style="display:flex; align-items:center; gap:0.35rem; min-width:0;">
        <span>${escapeHtml(t.icon || "⚔️")}</span>
        <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-main);">${escapeHtml(t.name || "Token")}</strong>
      </div>
      <div style="display:flex; align-items:center; gap:0.4rem; font-family:'JetBrains Mono',monospace; font-size:0.68rem;">
        <span style="color:#4ade80;">${t.hpCur ?? 0}/${t.hpMax ?? 0}</span>
        <span style="color:var(--accent-gold);">AC ${t.ac ?? 10}</span>
      </div>
    </div>
  `).join("");
}

function spawnMyCharacterTokenOnVtt() {
  if (!getStoredOwlbearUrl()) {
    setOwlbearRoomUrl(activeDMRoomCode || connectedCampaignRoom || "OBR-TABLETOP", true);
  }
  if (vttActiveMode !== "native") {
    switchOwlbearViewMode("native");
  }

  const charName = document.getElementById("charName")?.value?.trim() || "Hero";
  const curHp = parseInt(document.getElementById("curHp")?.value, 10) || 20;
  const maxHp = parseInt(document.getElementById("maxHp")?.value, 10) || 20;
  const ac = parseInt(document.getElementById("armorClass")?.value, 10) || 15;
  const heroId = (typeof activeCharId !== "undefined" && activeCharId) ? activeCharId : "main";
  const myId = "tok_hero_" + heroId;
  const avatarUrl = (typeof myCharacterAvatar !== "undefined" && myCharacterAvatar) ? myCharacterAvatar : "";

  const existing = (vttState.tokens || []).find((t) => t.id === myId || (t.charId && t.charId === heroId));
  if (existing) {
    existing.name = charName;
    existing.hpCur = curHp;
    existing.hpMax = maxHp;
    existing.ac = ac;
    if (avatarUrl) existing.avatar = avatarUrl;
    selectVttToken(existing.id);
    saveAndSyncOwlbearState();
    showStatus(`Updated ${charName}'s token on the battle map!`);
    return;
  }

  const newTok = {
    id: myId,
    charId: heroId,
    name: charName,
    icon: "⚔️",
    avatar: avatarUrl,
    x: 6 + Math.floor(Math.random() * 4),
    y: 7 + Math.floor(Math.random() * 4),
    size: 1,
    hpCur: curHp,
    hpMax: maxHp,
    ac: ac,
    color: "#d4af37",
    conditions: []
  };

  vttState.tokens.push(newTok);
  selectVttToken(newTok.id);
  saveAndSyncOwlbearState();
  showStatus(`Spawned ${charName} onto the battle map!`);
}

function spawnCampaignPartyOnVtt() {
  if (!getStoredOwlbearUrl()) {
    setOwlbearRoomUrl(activeDMRoomCode || connectedCampaignRoom || "OBR-TABLETOP", true);
  }
  if (vttActiveMode !== "native") {
    switchOwlbearViewMode("native");
  }

  const members = (typeof cachedRoomMembers !== "undefined" && Array.isArray(cachedRoomMembers) && cachedRoomMembers.length > 0)
    ? cachedRoomMembers
    : [];
  if (members.length === 0) {
    spawnMyCharacterTokenOnVtt();
    return;
  }

  const partyColors = ["#d4af37", "#38bdf8", "#4ade80", "#c084fc", "#f472b6", "#fb923c"];
  let added = 0;

  members.forEach((m, idx) => {
    if (!m || !m.id) return;
    const tokId = "tok_hero_" + m.id;
    let tok = vttState.tokens.find((t) => t.id === tokId || t.charId === m.id);
    if (tok) {
      tok.name = m.name || "Hero";
      tok.hpCur = m.hp?.cur ?? 20;
      tok.hpMax = m.hp?.max ?? 20;
      tok.ac = m.ac ?? 15;
      if (m.avatar) tok.avatar = m.avatar;
    } else {
      vttState.tokens.push({
        id: tokId,
        charId: m.id,
        name: m.name || "Hero",
        icon: "🛡️",
        avatar: m.avatar || "",
        x: 5 + (idx % 3) * 2,
        y: 6 + Math.floor(idx / 3) * 2,
        size: 1,
        hpCur: m.hp?.cur ?? 20,
        hpMax: m.hp?.max ?? 20,
        ac: m.ac ?? 15,
        color: partyColors[idx % partyColors.length],
        conditions: []
      });
      added++;
    }
  });

  renderVttActiveTokensList();
  renderOwlbearCanvas();
  saveAndSyncOwlbearState();
  showStatus(added > 0 ? `Dropped ${added} party member(s) onto the battle map!` : "Synced all party tokens on the battle map!");
}

function spawnPresetTokenOnVtt(presetKey) {
  const preset = VTT_PRESET_TOKENS[presetKey];
  if (!preset) return;

  const sameCount = (vttState.tokens || []).filter((t) => (t.name || "").startsWith(preset.name)).length;
  const label = sameCount > 0 ? `${preset.name} ${sameCount + 1}` : preset.name;

  const newTok = {
    id: `tok_${presetKey}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
    name: label,
    icon: preset.icon,
    avatar: "",
    x: 11 + Math.floor(Math.random() * 5),
    y: 6 + Math.floor(Math.random() * 5),
    size: preset.size || 1,
    hpCur: preset.hp,
    hpMax: preset.hp,
    ac: preset.ac,
    color: preset.color,
    conditions: []
  };

  vttState.tokens.push(newTok);
  selectVttToken(newTok.id);
  saveAndSyncOwlbearState();
  showStatus(`Spawned ${label} on map!`);
}

function syncVttUiControlsFromState() {
  const sceneMeta = VTT_SCENE_META[vttState.scene] || VTT_SCENE_META.forest_ambush;
  const sceneLabel = document.getElementById("vttActiveSceneLabel");
  if (sceneLabel) {
    sceneLabel.textContent = vttState.customMapUrl ? "🗺️ Custom Battlemap" : sceneMeta.title;
  }

  document.querySelectorAll("#vttSceneList .vtt-scene-card").forEach((card) => {
    card.classList.toggle("active", !vttState.customMapUrl && card.dataset.scene === vttState.scene);
  });

  const fogCb = document.getElementById("vttFogEnabledCheckbox");
  if (fogCb) fogCb.checked = Boolean(vttState.fogEnabled);
}

function setVttTool(toolName) {
  vttCurrentTool = toolName || "select";
  document.querySelectorAll("#vttLeftDock .vtt-tool-btn[data-vtt-tool]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.vttTool === vttCurrentTool);
  });

  const canvas = document.getElementById("owlbearMapCanvas");
  if (canvas) {
    canvas.className = `owlbear-vtt-canvas tool-${vttCurrentTool}`;
  }

  const subBar = document.getElementById("vttSubToolbar");
  const drawGrp = document.getElementById("vttSubDrawGroup");
  const aoeGrp = document.getElementById("vttSubAoeGroup");
  const fogGrp = document.getElementById("vttSubFogGroup");

  if (subBar) {
    const showSub = vttCurrentTool === "draw" || vttCurrentTool === "aoe" || vttCurrentTool === "fog";
    subBar.style.display = showSub ? "flex" : "none";
    if (drawGrp) drawGrp.style.display = vttCurrentTool === "draw" ? "flex" : "none";
    if (aoeGrp) aoeGrp.style.display = vttCurrentTool === "aoe" ? "flex" : "none";
    if (fogGrp) fogGrp.style.display = vttCurrentTool === "fog" ? "flex" : "none";
  }
}

/* --------------------------------------------------------------------------
   MODE 2: LIVE OWLBEAR.RODEO TAB STREAM (navigator.mediaDevices.getDisplayMedia)
   -------------------------------------------------------------------------- */

async function startOwlbearStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert("Your browser does not support native tab streaming (getDisplayMedia). Use the Native VTT mode instead!");
    return;
  }
  try {
    stopOwlbearStream();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        frameRate: { ideal: 60, max: 60 }
      },
      audio: false
    });
    vttMediaStream = stream;
    const videoEl = document.getElementById("owlbearStreamVideo");
    const placeholderEl = document.getElementById("owlbearStreamPlaceholder");
    const stopBtn = document.getElementById("owlbearStopStreamBtn");

    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.style.display = "block";
      videoEl.play().catch(() => {});
    }
    if (placeholderEl) placeholderEl.style.display = "none";
    if (stopBtn) stopBtn.style.display = "inline-flex";

    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener("ended", () => {
        stopOwlbearStream();
      });
    }
    showStatus("Streaming Owlbear Rodeo tab live at 60fps!");
  } catch (err) {
    console.warn("Tab stream cancelled or denied:", err);
  }
}

function stopOwlbearStream() {
  if (vttMediaStream) {
    vttMediaStream.getTracks().forEach((t) => t.stop());
    vttMediaStream = null;
  }
  const videoEl = document.getElementById("owlbearStreamVideo");
  const placeholderEl = document.getElementById("owlbearStreamPlaceholder");
  const stopBtn = document.getElementById("owlbearStopStreamBtn");
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.style.display = "none";
  }
  if (placeholderEl) placeholderEl.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
}

function openExternalOwlbearRoomTab() {
  const raw = document.getElementById("owlbearRoomUrlInput")?.value || getStoredOwlbearUrl();
  const target = /^https?:\/\//i.test(raw) ? raw : "https://www.owlbear.rodeo";
  window.open(target, "_blank", "noopener,noreferrer");
}

/* --------------------------------------------------------------------------
   CANVAS POINTER / WHEEL / KEYBOARD INTERACTION LISTENERS
   -------------------------------------------------------------------------- */

function initOwlbearCanvasListeners() {
  const canvas = document.getElementById("owlbearMapCanvas");
  if (!canvas) return;

  const getPointerCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const g = screenToGrid(sx, sy);
    return { sx, sy, gx: g.gx, gy: g.gy };
  };

  canvas.addEventListener("mousedown", (e) => {
    const { sx, sy, gx, gy } = getPointerCoords(e);

    // Middle-click, right-click, Spacebar, or Pan tool -> Panning
    if (e.button === 1 || e.button === 2 || vttSpacePressed || vttCurrentTool === "pan") {
      e.preventDefault();
      vttIsPanning = true;
      vttPanStart = { x: sx - vttCamera.x, y: sy - vttCamera.y };
      return;
    }

    if (vttCurrentTool === "select") {
      const hitTok = findTokenAtGridPos(gx, gy);
      if (hitTok) {
        selectVttToken(hitTok.id);
        vttDraggingToken = hitTok;
        vttDragOffset = { x: gx - hitTok.x, y: gy - hitTok.y };
      } else {
        selectVttToken(null);
        vttIsPanning = true;
        vttPanStart = { x: sx - vttCamera.x, y: sy - vttCamera.y };
      }
    } else if (vttCurrentTool === "measure") {
      vttActiveMeasure = { x1: gx, y1: gy, x2: gx, y2: gy };
      renderOwlbearCanvas();
    } else if (vttCurrentTool === "ping") {
      const pingObj = { x: gx, y: gy, color: "#facc15", createdAt: Date.now() };
      vttPings.push(pingObj);
      startVttPingLoop();
      saveAndSyncOwlbearState({ lastPing: pingObj });
    } else if (vttCurrentTool === "draw") {
      vttActiveDrawStroke = { color: vttDrawColor, points: [{ x: gx, y: gy }] };
      renderOwlbearCanvas();
    } else if (vttCurrentTool === "aoe") {
      vttActiveAoeDraft = {
        id: "aoe_" + Date.now(),
        shape: vttAoeShape,
        x1: Math.round(gx * 2) / 2,
        y1: Math.round(gy * 2) / 2,
        x2: gx + 2,
        y2: gy,
        color: vttDrawColor
      };
      renderOwlbearCanvas();
    } else if (vttCurrentTool === "fog") {
      if (!vttState.fogEnabled) {
        vttState.fogEnabled = true;
        syncVttUiControlsFromState();
      }
      vttActiveFogRect = { x1: gx, y1: gy, x2: gx, y2: gy };
      renderOwlbearCanvas();
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!vttIsPanning && !vttDraggingToken && !vttActiveMeasure && !vttActiveDrawStroke && !vttActiveAoeDraft && !vttActiveFogRect) {
      return;
    }
    const { sx, sy, gx, gy } = getPointerCoords(e);

    if (vttIsPanning) {
      vttCamera.x = sx - vttPanStart.x;
      vttCamera.y = sy - vttPanStart.y;
      renderOwlbearCanvas();
    } else if (vttDraggingToken) {
      vttDraggingToken.x = gx - vttDragOffset.x;
      vttDraggingToken.y = gy - vttDragOffset.y;
      renderOwlbearCanvas();
    } else if (vttActiveMeasure) {
      vttActiveMeasure.x2 = gx;
      vttActiveMeasure.y2 = gy;
      renderOwlbearCanvas();
    } else if (vttActiveDrawStroke) {
      const pts = vttActiveDrawStroke.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(gx - last.x, gy - last.y) > 0.12) {
        pts.push({ x: Math.round(gx * 20) / 20, y: Math.round(gy * 20) / 20 });
        renderOwlbearCanvas();
      }
    } else if (vttActiveAoeDraft) {
      vttActiveAoeDraft.x2 = gx;
      vttActiveAoeDraft.y2 = gy;
      renderOwlbearCanvas();
    } else if (vttActiveFogRect) {
      vttActiveFogRect.x2 = gx;
      vttActiveFogRect.y2 = gy;
      renderOwlbearCanvas();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (vttIsPanning) {
      vttIsPanning = false;
    }
    if (vttDraggingToken) {
      if (vttSnapToGrid && !e.shiftKey) {
        vttDraggingToken.x = Math.round(vttDraggingToken.x * 2) / 2;
        vttDraggingToken.y = Math.round(vttDraggingToken.y * 2) / 2;
      }
      vttDraggingToken = null;
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
    }
    if (vttActiveMeasure) {
      vttActiveMeasure = null;
      renderOwlbearCanvas();
    }
    if (vttActiveDrawStroke) {
      if (vttActiveDrawStroke.points.length > 1) {
        vttState.drawings.push(vttActiveDrawStroke);
        saveAndSyncOwlbearState();
      }
      vttActiveDrawStroke = null;
      renderOwlbearCanvas();
    }
    if (vttActiveAoeDraft) {
      vttState.aoes.push(vttActiveAoeDraft);
      vttActiveAoeDraft = null;
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
    }
    if (vttActiveFogRect) {
      const rx = Math.min(vttActiveFogRect.x1, vttActiveFogRect.x2);
      const ry = Math.min(vttActiveFogRect.y1, vttActiveFogRect.y2);
      const rw = Math.abs(vttActiveFogRect.x2 - vttActiveFogRect.x1);
      const rh = Math.abs(vttActiveFogRect.y2 - vttActiveFogRect.y1);
      if (rw > 0.2 && rh > 0.2) {
        vttState.fogRects.push({
          x: Math.round(rx * 10) / 10,
          y: Math.round(ry * 10) / 10,
          w: Math.round(rw * 10) / 10,
          h: Math.round(rh * 10) / 10,
          mode: vttFogBrushMode
        });
        saveAndSyncOwlbearState();
      }
      vttActiveFogRect = null;
      renderOwlbearCanvas();
    }
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(3.0, Math.max(0.3, vttCamera.zoom * zoomFactor));

    vttCamera.x = mx - (mx - vttCamera.x) * (nextZoom / vttCamera.zoom);
    vttCamera.y = my - (my - vttCamera.y) * (nextZoom / vttCamera.zoom);
    vttCamera.zoom = nextZoom;

    updateVttZoomLabel();
    renderOwlbearCanvas();
  }, { passive: false });

  window.addEventListener("resize", () => {
    const tab = document.getElementById("tab-owlbear");
    if (tab && tab.classList.contains("active")) {
      resizeAndRenderOwlbearCanvas();
    }
  });

  window.addEventListener("keydown", (e) => {
    const tab = document.getElementById("tab-owlbear");
    if (!tab || !tab.classList.contains("active")) return;
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (e.code === "Space") {
      vttSpacePressed = true;
    } else if (e.key === "v" || e.key === "V") {
      setVttTool("select");
    } else if (e.key === "h" || e.key === "H") {
      setVttTool("pan");
    } else if (e.key === "m" || e.key === "M") {
      setVttTool("measure");
    } else if (e.key === "p" || e.key === "P") {
      setVttTool("ping");
    } else if (e.key === "d" || e.key === "D") {
      setVttTool("draw");
    } else if (e.key === "a" || e.key === "A") {
      setVttTool("aoe");
    } else if (e.key === "f" || e.key === "F") {
      setVttTool("fog");
    } else if (e.key === "g" || e.key === "G") {
      vttShowGrid = !vttShowGrid;
      document.getElementById("vttToggleGridBtn")?.classList.toggle("active", vttShowGrid);
      renderOwlbearCanvas();
    } else if ((e.key === "Delete" || e.key === "Backspace") && vttSelectedTokenId) {
      vttState.tokens = (vttState.tokens || []).filter((t) => t.id !== vttSelectedTokenId);
      selectVttToken(null);
      saveAndSyncOwlbearState();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") vttSpacePressed = false;
  });
}

/* --------------------------------------------------------------------------
   MAIN VTT CONTROLLER INITIALIZATION
   -------------------------------------------------------------------------- */

function initOwlbearVTT() {
  initOwlbearCanvasListeners();

  const loadBtn = document.getElementById("owlbearLoadBtn");
  const input = document.getElementById("owlbearRoomUrlInput");
  const leaveBtn = document.getElementById("owlbearLeaveBtn");
  const activeLeaveBtn = document.getElementById("owlbearActiveLeaveBtn");
  const copyBtn = document.getElementById("owlbearCopyRoomUrlBtn");
  const wizardBtn = document.getElementById("owlbearWizardConnectBtn");
  const wizardInput = document.getElementById("owlbearWizardRoomInput");
  const clearBtn = document.getElementById("owlbearClearInputBtn");
  const theaterBtn = document.getElementById("owlbearTheaterToggleBtn");
  const demoBtn = document.getElementById("owlbearUseDemoRoomBtn");

  // Connect / Load Map (Runs Real Owlbear Rodeo Natively In-Tab!)
  if (loadBtn && input) {
    loadBtn.addEventListener("click", () => {
      const url = input.value.trim() || wizardInput?.value?.trim() || activeDMRoomCode || connectedCampaignRoom || "https://www.owlbear.rodeo/room/codex-tabletop/Battlemap";
      setOwlbearRoomUrl(url, true);
      showStatus("Loaded Owlbear Rodeo room in-tab!");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadBtn.click();
      }
    });
  }

  if (wizardBtn && wizardInput) {
    wizardBtn.addEventListener("click", () => {
      const url = wizardInput.value.trim() || input?.value?.trim() || activeDMRoomCode || connectedCampaignRoom || "https://www.owlbear.rodeo/room/codex-tabletop/Battlemap";
      setOwlbearRoomUrl(url, true);
      showStatus("Connected to Owlbear Rodeo room in-tab!");
    });
    wizardInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        wizardBtn.click();
      }
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      const defaultRoom = activeDMRoomCode || connectedCampaignRoom || "https://www.owlbear.rodeo/room/codex-battlemap/Tabletop";
      vttActiveMode = "real_owlbear";
      setOwlbearRoomUrl(defaultRoom, true);
      showStatus("Launched Real Owlbear Rodeo in-tab!");
    });
  }

  document.getElementById("owlbearRealHomeBtn")?.addEventListener("click", () => {
    const realFrame = document.getElementById("owlbearRealEngineFrame");
    if (realFrame) {
      vttActiveMode = "real_owlbear";
      switchOwlbearViewMode("real_owlbear");
      realFrame.src = "./owlbear/index.html#/";
      showStatus("Opened Owlbear Rodeo Home Screen.");
    }
  });

  window.addEventListener("message", (ev) => {
    const msg = ev.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "OBR_ROOM_CHANGED" && msg.gameId) {
      const newUrl = `https://www.owlbear.rodeo/room/${msg.gameId}`;
      try {
        localStorage.setItem(OWLBEAR_ROOM_KEY, newUrl);
      } catch (e) {}
      const inEl = document.getElementById("owlbearRoomUrlInput");
      const wizEl = document.getElementById("owlbearWizardRoomInput");
      const dispEl = document.getElementById("owlbearActiveUrlDisplay");
      if (inEl) inEl.value = newUrl;
      if (wizEl) wizEl.value = newUrl;
      if (dispEl) dispEl.textContent = `Owlbear Room (${msg.gameId})`;
      broadcastOwlbearUrlToParty(newUrl);
    } else if (msg.type === "OBR_BRIDGE_EVENT" && db && vttActiveSyncRoomId) {
      const serialized = JSON.stringify(msg);
      if (serialized.length <= 49500) {
        db.collection("campaigns").doc(vttActiveSyncRoomId).collection("handouts").doc("owlbear_real_bridge").set({
          id: "owlbear_real_bridge",
          title: "Owlbear Real-Time Packet",
          type: "map",
          content: serialized,
          isShared: true,
          updatedAt: Date.now()
        }).catch(() => {});
      }
    }
  });

  // Leave / Close Map Buttons (Direct + Delegated fallback)
  if (leaveBtn) leaveBtn.addEventListener("click", leaveOwlbearRoom);
  if (activeLeaveBtn) activeLeaveBtn.addEventListener("click", leaveOwlbearRoom);
  document.addEventListener("click", (e) => {
    const closeTarget = e.target.closest("#owlbearLeaveBtn, #owlbearActiveLeaveBtn, .owlbear-leave-map-btn");
    if (closeTarget) {
      leaveOwlbearRoom(e);
    }
  });

  // Copy Link & Clear Input (also closes active map when clicked!)
  if (copyBtn) copyBtn.addEventListener("click", copyOwlbearRoomUrl);
  if (clearBtn && input) {
    clearBtn.addEventListener("click", (e) => {
      input.value = "";
      if (wizardInput) wizardInput.value = "";
      if (getStoredOwlbearUrl() || document.getElementById("owlbearActiveContainer")?.style.display !== "none") {
        leaveOwlbearRoom(e);
      } else {
        input.focus();
      }
    });
  }

  if (theaterBtn) theaterBtn.addEventListener("click", toggleOwlbearTheaterMode);

  // Mode Switcher Pills (Native VTT | Live Tab Stream | Direct Iframe)
  document.querySelectorAll(".owlbear-mode-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      switchOwlbearViewMode(pill.dataset.vttMode);
    });
  });

  // Left Tool Dock Buttons
  document.querySelectorAll("#vttLeftDock .vtt-tool-btn[data-vtt-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setVttTool(btn.dataset.vttTool);
    });
  });

  document.getElementById("vttToggleGridBtn")?.addEventListener("click", (e) => {
    vttShowGrid = !vttShowGrid;
    e.currentTarget.classList.toggle("active", vttShowGrid);
    renderOwlbearCanvas();
  });

  document.getElementById("vttToggleSnapBtn")?.addEventListener("click", (e) => {
    vttSnapToGrid = !vttSnapToGrid;
    e.currentTarget.classList.toggle("active", vttSnapToGrid);
    showStatus(vttSnapToGrid ? "Snap-to-Grid enabled." : "Free token movement enabled.");
  });

  document.getElementById("vttClearDrawingsBtn")?.addEventListener("click", () => {
    vttState.drawings = [];
    vttState.aoes = [];
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
    showStatus("Cleared all drawings & spell AoE templates.");
  });

  document.getElementById("vttResetViewBtn")?.addEventListener("click", () => {
    resetVttCameraToFit();
    renderOwlbearCanvas();
  });

  // Zoom Buttons
  document.getElementById("vttZoomInBtn")?.addEventListener("click", () => {
    vttCamera.zoom = Math.min(3.0, vttCamera.zoom * 1.2);
    updateVttZoomLabel();
    renderOwlbearCanvas();
  });
  document.getElementById("vttZoomOutBtn")?.addEventListener("click", () => {
    vttCamera.zoom = Math.max(0.3, vttCamera.zoom / 1.2);
    updateVttZoomLabel();
    renderOwlbearCanvas();
  });

  // Sub-Toolbar Options (Draw Color, AoE Shape, Fog Controls)
  document.querySelectorAll("#vttSubDrawGroup .vtt-color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      vttDrawColor = sw.dataset.color || "#d4af37";
      document.querySelectorAll("#vttSubDrawGroup .vtt-color-swatch").forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
    });
  });

  document.getElementById("vttUndoDrawingBtn")?.addEventListener("click", () => {
    if (vttState.drawings.length > 0) {
      vttState.drawings.pop();
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
    }
  });

  document.getElementById("vttAoeShapeSelect")?.addEventListener("change", (e) => {
    vttAoeShape = e.target.value;
  });

  document.getElementById("vttFogEnabledCheckbox")?.addEventListener("change", (e) => {
    vttState.fogEnabled = e.target.checked;
    if (vttState.fogEnabled && (!vttState.fogRects || vttState.fogRects.length === 0)) {
      // Reveal a starter area around hero spawn so user immediately sees how fog works
      vttState.fogRects = [{ x: 5, y: 5, w: 8, h: 8, mode: "reveal" }];
    }
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttFogModeRevealBtn")?.addEventListener("click", (e) => {
    vttFogBrushMode = "reveal";
    e.currentTarget.className = "btn btn-gold-subtle btn-xs active";
    const hideBtn = document.getElementById("vttFogModeHideBtn");
    if (hideBtn) hideBtn.className = "btn btn-outline btn-xs";
  });

  document.getElementById("vttFogModeHideBtn")?.addEventListener("click", (e) => {
    vttFogBrushMode = "hide";
    e.currentTarget.className = "btn btn-gold-subtle btn-xs active";
    const revBtn = document.getElementById("vttFogModeRevealBtn");
    if (revBtn) revBtn.className = "btn btn-outline btn-xs";
  });

  document.getElementById("vttFogCoverAllBtn")?.addEventListener("click", () => {
    vttState.fogEnabled = true;
    vttState.fogRects = [];
    syncVttUiControlsFromState();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttFogResetBtn")?.addEventListener("click", () => {
    vttState.fogEnabled = false;
    vttState.fogRects = [];
    syncVttUiControlsFromState();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  // Token Context Popover Controls
  document.getElementById("vttTokCloseBtn")?.addEventListener("click", () => selectVttToken(null));

  document.getElementById("vttTokNameInput")?.addEventListener("input", (e) => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    tok.name = e.target.value;
    renderVttActiveTokensList();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.querySelectorAll(".vtt-hp-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
      if (!tok) return;
      const delta = parseInt(btn.dataset.hpDelta, 10) || 0;
      tok.hpCur = Math.max(0, Math.min(tok.hpMax || 999, (tok.hpCur ?? 0) + delta));
      updateSelectedTokenPopoverUI();
      renderVttActiveTokensList();
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
    });
  });

  document.getElementById("vttTokHpCur")?.addEventListener("change", (e) => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    tok.hpCur = parseInt(e.target.value, 10) || 0;
    renderVttActiveTokensList();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttTokHpMax")?.addEventListener("change", (e) => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    tok.hpMax = Math.max(1, parseInt(e.target.value, 10) || 1);
    renderVttActiveTokensList();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttTokAcInput")?.addEventListener("change", (e) => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    tok.ac = parseInt(e.target.value, 10) || 10;
    renderVttActiveTokensList();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttTokSizeSelect")?.addEventListener("change", (e) => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    tok.size = parseFloat(e.target.value) || 1;
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
  });

  document.querySelectorAll("#vttTokConditionsRow .vtt-cond-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
      if (!tok) return;
      if (!Array.isArray(tok.conditions)) tok.conditions = [];
      const c = btn.dataset.cond;
      if (tok.conditions.includes(c)) {
        tok.conditions = tok.conditions.filter((x) => x !== c);
      } else {
        tok.conditions.push(c);
      }
      updateSelectedTokenPopoverUI();
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
    });
  });

  document.getElementById("vttTokDupBtn")?.addEventListener("click", () => {
    const tok = (vttState.tokens || []).find((t) => t.id === vttSelectedTokenId);
    if (!tok) return;
    const copy = {
      ...tok,
      id: `tok_dup_${Date.now()}`,
      charId: "",
      name: `${tok.name} Copy`,
      x: tok.x + 1,
      y: tok.y + 1,
      conditions: [...(tok.conditions || [])]
    };
    vttState.tokens.push(copy);
    selectVttToken(copy.id);
    saveAndSyncOwlbearState();
  });

  document.getElementById("vttTokDelBtn")?.addEventListener("click", () => {
    if (!vttSelectedTokenId) return;
    vttState.tokens = (vttState.tokens || []).filter((t) => t.id !== vttSelectedTokenId);
    selectVttToken(null);
    saveAndSyncOwlbearState();
  });

  // Right Drawer Toggle & Tabs
  const drawer = document.getElementById("vttRightDrawer");
  document.getElementById("vttDrawerToggleBtn")?.addEventListener("click", () => {
    drawer?.classList.toggle("open");
  });
  document.getElementById("vttDrawerCloseBtn")?.addEventListener("click", () => {
    drawer?.classList.remove("open");
  });

  document.querySelectorAll(".vtt-drawer-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const target = tabBtn.dataset.drawerTab;
      document.querySelectorAll(".vtt-drawer-tab").forEach((b) => b.classList.toggle("active", b === tabBtn));
      const tokPane = document.getElementById("vttDrawerPaneTokens");
      const mapPane = document.getElementById("vttDrawerPaneMaps");
      if (tokPane) tokPane.style.display = target === "tokens" ? "flex" : "none";
      if (mapPane) mapPane.style.display = target === "maps" ? "flex" : "none";
    });
  });

  // Spawning Tokens
  document.getElementById("vttSpawnSelfBtn")?.addEventListener("click", spawnMyCharacterTokenOnVtt);
  document.getElementById("owlbearDropMyTokenBtn")?.addEventListener("click", spawnMyCharacterTokenOnVtt);
  document.getElementById("vttSpawnPartyBtn")?.addEventListener("click", spawnCampaignPartyOnVtt);
  document.getElementById("owlbearSyncPartyTokensBtn")?.addEventListener("click", spawnCampaignPartyOnVtt);

  document.querySelectorAll("#vttPresetTokensGrid .vtt-preset-token-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      spawnPresetTokenOnVtt(btn.dataset.preset);
    });
  });

  document.getElementById("vttAddCustomTokBtn")?.addEventListener("click", () => {
    const name = document.getElementById("vttCustomTokName")?.value?.trim() || "Custom Token";
    const hp = parseInt(document.getElementById("vttCustomTokHp")?.value, 10) || 25;
    const size = parseFloat(document.getElementById("vttCustomTokSize")?.value) || 1;
    const color = document.getElementById("vttCustomTokColor")?.value || "#ef4444";
    const imgUrl = document.getElementById("vttCustomTokImg")?.value?.trim() || "";

    const newTok = {
      id: `tok_custom_${Date.now()}`,
      name,
      icon: "⚔️",
      avatar: imgUrl,
      x: 10,
      y: 8,
      size,
      hpCur: hp,
      hpMax: hp,
      ac: 14,
      color,
      conditions: []
    };
    vttState.tokens.push(newTok);
    selectVttToken(newTok.id);
    saveAndSyncOwlbearState();
    showStatus(`Spawned ${name} on map!`);
  });

  document.getElementById("vttClearAllTokensBtn")?.addEventListener("click", () => {
    vttState.tokens = [];
    selectVttToken(null);
    saveAndSyncOwlbearState();
    showStatus("Cleared all tokens from the battle map.");
  });

  document.getElementById("vttActiveTokensList")?.addEventListener("click", (e) => {
    const item = e.target.closest(".vtt-active-token-item");
    if (!item) return;
    selectVttToken(item.dataset.tokenId);
  });

  // Switching Battlemap Scenes
  document.querySelectorAll("#vttSceneList .vtt-scene-card").forEach((card) => {
    card.addEventListener("click", () => {
      const sceneKey = card.dataset.scene;
      if (!sceneKey) return;
      vttState.scene = sceneKey;
      vttState.customMapUrl = "";
      syncVttUiControlsFromState();
      renderOwlbearCanvas();
      saveAndSyncOwlbearState();
      showStatus(`Switched battlemap to ${VTT_SCENE_META[sceneKey]?.title || sceneKey}!`);
    });
  });

  document.getElementById("vttApplyMapUrlBtn")?.addEventListener("click", () => {
    const url = document.getElementById("vttCustomMapUrlInput")?.value?.trim() || "";
    if (!url) return;
    vttState.customMapUrl = url;
    syncVttUiControlsFromState();
    renderOwlbearCanvas();
    saveAndSyncOwlbearState();
    showStatus("Applied custom battlemap image!");
  });

  document.getElementById("vttUploadMapInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement("canvas");
        const maxDim = 1400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        off.width = w;
        off.height = h;
        off.getContext("2d").drawImage(img, 0, 0, w, h);
        vttState.customMapUrl = off.toDataURL("image/jpeg", 0.78);
        syncVttUiControlsFromState();
        renderOwlbearCanvas();
        saveAndSyncOwlbearState();
        showStatus("Uploaded custom battlemap!");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Live Tab Stream Controls (Mode 2)
  document.getElementById("owlbearOpenForStreamBtn")?.addEventListener("click", openExternalOwlbearRoomTab);
  document.getElementById("owlbearStreamOpenHeroBtn")?.addEventListener("click", openExternalOwlbearRoomTab);
  document.getElementById("owlbearStartStreamBtn")?.addEventListener("click", startOwlbearStream);
  document.getElementById("owlbearStreamStartHeroBtn")?.addEventListener("click", startOwlbearStream);
  document.getElementById("owlbearStopStreamBtn")?.addEventListener("click", stopOwlbearStream);

  // Direct Iframe Controls (Mode 3)
  document.getElementById("owlbearReloadIframeBtn")?.addEventListener("click", () => {
    const iframe = document.getElementById("owlbearIframe");
    if (iframe) {
      const cur = iframe.src;
      iframe.src = "";
      setTimeout(() => { iframe.src = cur; }, 60);
    }
  });
  document.getElementById("owlbearSwitchToNativeBtn")?.addEventListener("click", () => {
    switchOwlbearViewMode("native");
  });

  // Quick Combat Rolls in Tactical Strip
  const initBtn = document.getElementById("owlbearRollInitBtn");
  if (initBtn) {
    initBtn.addEventListener("click", () => {
      const bonus = parseInt(document.getElementById("initiativeDisplay")?.textContent, 10) || 0;
      performD20Roll(bonus, "Initiative");
    });
  }

  const atkBtn = document.getElementById("owlbearRollAtkBtn");
  if (atkBtn) {
    atkBtn.addEventListener("click", () => {
      const firstWpn = (Array.isArray(myCharacterWeapons) && myCharacterWeapons[0]) ? myCharacterWeapons[0] : null;
      if (firstWpn && firstWpn.name) {
        const numMatch = String(firstWpn.atk || "").match(/[+-]?\d+/);
        const bonus = numMatch ? parseInt(numMatch[0], 10) : 0;
        performD20Roll(bonus, `${firstWpn.name} Atk`);
      } else {
        performD20Roll(0, "Unarmed Strike");
      }
    });
  }

  const chatBtn = document.getElementById("owlbearPartyChatBtn");
  if (chatBtn) {
    chatBtn.addEventListener("click", () => {
      toggleFloatingPartyChat(true);
    });
  }

  // Restore saved Owlbear room URL AFTER all button listeners are safely registered
  try {
    const savedUrl = getStoredOwlbearUrl();
    if (savedUrl) {
      setOwlbearRoomUrl(savedUrl, false);
    }
  } catch (err) {
    console.warn("Could not restore saved Owlbear room:", err);
  }
}

/* ==========================================================================
   INITIALIZATION & URL INVITE LINK CHECK
   ========================================================================== */

detectOSAndSetShortcut();
applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "theme-nexus");
loadSheet();
loadAllSpells();
loadAllTraits();
initPWAAndNetworkStatus();
initFloatingPartyChatDragAndResize();
initAdminPanel();
initAdminChatSwitcherListeners();
initSessionPresence();
initGlobalSiteNoticeListener();
initOwlbearVTT();

// Check if user opened a 1-click ?room=CODE invite link
const urlParams = new URLSearchParams(window.location.search);
const invitedRoom = urlParams.get("room");
if (invitedRoom && invitedRoom.trim()) {
  const cleanInvite = invitedRoom.trim().toUpperCase();
  window.history.replaceState({}, document.title, window.location.pathname);
  if (activeDMRoomCode && activeDMRoomCode === cleanInvite) {
    startDMLiveListener(activeDMRoomCode);
  } else {
    joinCampaignRoom(cleanInvite);
  }
} else {
  if (activeDMRoomCode) {
    startDMLiveListener(activeDMRoomCode);
  }
  updatePartyStatusUI();
}