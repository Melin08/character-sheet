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

let auth = null;
let db = null;
let currentUser = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialization skipped or running offline:", e);
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
let diceRollHistory = [];

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

let allSpellsIndex = [];
let allTraitsIndex = [];
let allClassesCache = [];
let allRacesCache = [];

const apiCache = {};

const FALLBACK_SPELLS = [
  { name: "Fire Bolt", level: 0, school: { name: "Evocation" }, casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage." },
  { name: "Mage Hand", level: 0, school: { name: "Conjuration" }, casting_time: "1 Action", range: "30 ft", duration: "1 minute", desc: "A spectral, floating hand appears at a point you choose within range. You can use your action to control the hand." },
  { name: "Prestidigitation", level: 0, school: { name: "Transmutation" }, casting_time: "1 Action", range: "10 ft", duration: "Up to 1 hour", desc: "This spell is a minor magical trick that novice spellcasters use for practice." },
  { name: "Shield", level: 1, school: { name: "Abjuration" }, casting_time: "1 Reaction", range: "Self", duration: "1 round", desc: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC." },
  { name: "Magic Missile", level: 1, school: { name: "Evocation" }, casting_time: "1 Action", range: "120 ft", duration: "Instantaneous", desc: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range, dealing 1d4 + 1 force damage." },
  { name: "Cure Wounds", level: 1, school: { name: "Evocation" }, casting_time: "1 Action", range: "Touch", duration: "Instantaneous", desc: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier." },
  { name: "Healing Word", level: 1, school: { name: "Evocation" }, casting_time: "1 Bonus Action", range: "60 ft", duration: "Instantaneous", desc: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier." },
  { name: "Misty Step", level: 2, school: { name: "Conjuration" }, casting_time: "1 Bonus Action", range: "Self", duration: "Instantaneous", desc: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see." },
  { name: "Fireball", level: 3, school: { name: "Evocation" }, casting_time: "1 Action", range: "150 ft", duration: "Instantaneous", desc: "A bright streak flashes from your pointing finger to a point you choose within range and blossoms into an explosion of flame dealing 8d6 fire damage." },
  { name: "Counterspell", level: 3, school: { name: "Abjuration" }, casting_time: "1 Reaction", range: "60 ft", duration: "Instantaneous", desc: "You attempt to interrupt a creature in the process of casting a spell. If the spell is 3rd level or lower, it fails." }
];

const FALLBACK_TRAITS = [
  { name: "Action Surge", type: "Class Feature", desc: "On your turn, you can take one additional action on top of your regular action and a possible bonus action." },
  { name: "Sneak Attack", type: "Class Feature", desc: "Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll." },
  { name: "Rage", type: "Class Feature", desc: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action, gaining bonus damage and physical damage resistance." },
  { name: "Bardic Inspiration", type: "Class Feature", desc: "You can inspire others through stirring words or music. A creature gains a d6 to add to one ability check, attack roll, or saving throw." },
  { name: "Divine Smite", type: "Class Feature", desc: "When you hit a creature with a melee weapon attack, you can expend one spell slot to deal extra radiant damage." },
  { name: "Wild Shape", type: "Class Feature", desc: "You can magically assume the shape of a beast that you have seen before." },
  { name: "Cunning Action", type: "Class Feature", desc: "Starting at 2nd level, you can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide." },
  { name: "Darkvision", type: "Racial Trait", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
  { name: "Fey Ancestry", type: "Racial Trait", desc: "You have advantage on saving throws against being charmed, and magic cannot put you to sleep." },
  { name: "Lucky", type: "Racial Trait", desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die." }
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
  if (!input) return;
  if (input.classList.contains("concentration-input")) return;
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

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet. Click "+ Add Spell" above to add one.</p>`;
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
      saveSheet(false);
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
            saveSheet(false);
            renderMySpells();
          }
        }
        touchDraggedIndex = null;
        currentDropTarget = null;
      });
    }
  });
}

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

  container.innerHTML = diceRollHistory.map((item) => `
    <div class="dice-history-item">
      <span class="dice-history-desc">${escapeHtml(item.desc)} <small style="color:#64748b;">(${item.time})</small></span>
      <span class="dice-history-val">${escapeHtml(String(item.total))}</span>
    </div>
  `).join("");
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
      await setDoc(doc(db, "user_rosters", currentUser.uid), { data: roster });
    } catch (e) {
      console.warn("Cloud save sync failed:", e);
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
    weapons: myCharacterWeapons
  };

  saveRoster(roster);
  localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  if (!quiet) {
    showStatus("Saved!");
  }
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
  saveSheet(false);
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
  } catch (e) {
    return null;
  }
}

async function loadAllSpells() {
  if (allSpellsIndex.length > 0) return allSpellsIndex;
  const data = await fetchAPI("https://www.dnd5eapi.co/api/spells");
  if (data && data.results && data.results.length > 0) {
    allSpellsIndex = data.results;
  } else {
    allSpellsIndex = FALLBACK_SPELLS.map((s) => ({
      name: s.name,
      url: null,
      localData: s
    }));
  }
  return allSpellsIndex;
}

async function loadAllTraits() {
  if (allTraitsIndex.length > 0) return allTraitsIndex;
  const [f, t] = await Promise.all([
    fetchAPI("https://www.dnd5eapi.co/api/features"),
    fetchAPI("https://www.dnd5eapi.co/api/traits")
  ]);
  let combined = [];
  if (f && f.results) {
    combined.push(...f.results.map((item) => ({ ...item, type: "Class Feature" })));
  }
  if (t && t.results) {
    combined.push(...t.results.map((item) => ({ ...item, type: "Racial Trait" })));
  }
  if (combined.length > 0) {
    allTraitsIndex = combined.filter((item) => !item.name.includes("Dragon Ancestor (") && !item.name.includes("Draconic Ancestry ("));
  } else {
    allTraitsIndex = FALLBACK_TRAITS.map((item) => ({
      name: item.name,
      type: item.type,
      url: null,
      localData: item
    }));
  }
  return allTraitsIndex;
}

function renderModalSpells(matches) {
  const container = document.getElementById("spellApiList");
  if (!container) return;
  if (!matches || matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching spells found.</p>`;
    return;
  }

  container.innerHTML = matches.slice(0, 50).map((spell) => `
    <div class="spell-option-item spell-add-item" data-url="${spell.url || ''}" data-name="${escapeHtml(spell.name)}">
      <div>
        <div style="font-weight: 600; color: #f8fafc;">${escapeHtml(spell.name)}</div>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `).join("");
}

function renderModalTraits(matches) {
  const container = document.getElementById("traitApiList");
  if (!container) return;
  if (!matches || matches.length === 0) {
    container.innerHTML = `<p class="loading-text">No matching abilities found.</p>`;
    return;
  }

  container.innerHTML = matches.slice(0, 50).map((trait) => `
    <div class="spell-option-item trait-option-item" data-url="${trait.url || ''}" data-name="${escapeHtml(trait.name)}" data-type="${escapeHtml(trait.type || 'Feature')}">
      <div>
        <div style="font-weight: 600; color: #f8fafc;">${escapeHtml(trait.name)}</div>
        <div class="spell-meta-tags"><span class="tag-pill blue">${escapeHtml(trait.type || 'Feature')}</span></div>
      </div>
      <span class="spell-add-badge">+ Add</span>
    </div>
  `).join("");
}

async function openSpellPicker() {
  const modal = document.getElementById("spellModal");
  if (!modal) return;
  modal.classList.add("open");
  const input = document.getElementById("spellSearchInput");
  if (input) input.value = "";
  const container = document.getElementById("spellApiList");
  if (container) container.innerHTML = `<p class="loading-text">Loading 5e spells...</p>`;
  const spells = await loadAllSpells();
  renderModalSpells(spells);
}

async function openTraitPicker() {
  const modal = document.getElementById("traitModal");
  if (!modal) return;
  modal.classList.add("open");
  const input = document.getElementById("traitSearchInput");
  if (input) input.value = "";
  const container = document.getElementById("traitApiList");
  if (container) container.innerHTML = `<p class="loading-text">Loading 5e features and traits...</p>`;
  const traits = await loadAllTraits();
  renderModalTraits(traits);
}

let spellSearchTimeout = null;
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearTimeout(spellSearchTimeout);
  spellSearchTimeout = setTimeout(() => {
    const filtered = allSpellsIndex.filter((s) => s.name.toLowerCase().includes(query));
    renderModalSpells(filtered);
  }, 200);
});

let traitSearchTimeout = null;
document.getElementById("traitSearchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearTimeout(traitSearchTimeout);
  traitSearchTimeout = setTimeout(() => {
    const filtered = allTraitsIndex.filter((t) => t.name.toLowerCase().includes(query));
    renderModalTraits(filtered);
  }, 200);
});

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
  onAuthStateChanged(auth, async (user) => {
    const authGroup = document.getElementById("authNavGroup");
    if (!authGroup) return;
    if (user) {
      currentUser = user;
      authGroup.innerHTML = `
        <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 700; padding: 0 0.5rem;">${escapeHtml(user.email || "Player")}</span>
        <button class="btn outline blue" id="logoutBtn" type="button">Log Out</button>
      `;
      if (db) {
        try {
          const docSnap = await getDoc(doc(db, "user_rosters", user.uid));
          if (docSnap.exists()) {
            localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(docSnap.data().data));
          } else {
            saveRoster(getRoster());
          }
          loadSheet();
        } catch (e) {
          console.warn("Cloud sync error:", e);
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

function renderDropdown(dropdownEl, items, filter = "") {
  if (!dropdownEl) return;
  const q = filter.toLowerCase().trim();
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q));
  dropdownEl.innerHTML = filtered.map((i) => `
    <div class="dropdown-item" data-index="${i.index}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}</div>
  `).join("");
}

const classInput = document.getElementById("charClass");
const classDropdown = document.getElementById("classDropdown");
const raceInput = document.getElementById("charRace");
const raceDropdown = document.getElementById("raceDropdown");

classInput?.addEventListener("focus", async () => {
  if (!classDropdown.classList.contains("open")) {
    if (allClassesCache.length === 0) {
      const data = await fetchAPI("https://www.dnd5eapi.co/api/classes");
      if (data && data.results) allClassesCache = data.results;
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
      if (data && data.results) allRacesCache = data.results;
    }
    renderDropdown(raceDropdown, allRacesCache, raceInput.value);
    raceDropdown.classList.add("open");
  }
});

raceInput?.addEventListener("input", () => {
  renderDropdown(raceDropdown, allRacesCache, raceInput.value);
  raceDropdown.classList.add("open");
});

classDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  classInput.value = item.dataset.name;
  classDropdown.classList.remove("open");
  saveSheet(false);
});

raceDropdown?.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  raceInput.value = item.dataset.name;
  raceDropdown.classList.remove("open");
  saveSheet(false);
});

document.addEventListener("click", async (e) => {
  if (e.target.id === "loginNavBtn") openAuthModal("login");
  if (e.target.id === "signupNavBtn") openAuthModal("signup");
  if (e.target.id === "closeAuthModal") document.getElementById("authModal")?.classList.remove("open");

  if (e.target.id === "logoutBtn" && auth) {
    await signOut(auth);
    showStatus("Logged out");
  }

  if (e.target.id === "authSubmitBtn" && auth) {
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
      document.getElementById("authModal")?.classList.remove("open");
    } catch (err) {
      errEl.textContent = err.message.replace("Firebase: ", "");
      errEl.style.display = "block";
    }
  }

  if (e.target.id === "googleAuthBtn" && auth) {
    const provider = new GoogleAuthProvider();
    const errEl = document.getElementById("authError");
    errEl.style.display = "none";
    try {
      await signInWithPopup(auth, provider);
      document.getElementById("authModal")?.classList.remove("open");
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
  if (e.target.id === "closeLoadModal") document.getElementById("loadModal")?.classList.remove("open");

  if (e.target.id === "deleteBtn") {
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
  }

  if (e.target.id === "backupBtn") {
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
  }

  if (e.target.id === "helpLinkBtn") document.getElementById("helpModal")?.classList.add("open");
  if (e.target.id === "closeHelpModal") document.getElementById("helpModal")?.classList.remove("open");

  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
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
    const scrollTarget = e.target.dataset.scroll;
    const elId = scrollTarget === "attr" ? ".attributes-group" : scrollTarget === "skills" ? ".skills-group" : scrollTarget === "spells" ? "#spellsList" : "#tab-journal";
    document.querySelector(elId)?.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.closest("#shortRestBtn")) {
    if (confirm("Take a Short Rest? Use your hit dice to heal!")) {
      showStatus("Short Rest Taken!");
    }
  }

  if (e.target.closest("#longRestBtn")) {
    if (confirm("Take a Long Rest? This restores all HP, Hit Dice, and Spell Slots.")) {
      const maxHp = document.getElementById("maxHp");
      if (document.getElementById("curHp") && maxHp) {
        document.getElementById("curHp").value = maxHp.value;
      }
      const maxHd = document.getElementById("hitDiceMax");
      if (document.getElementById("hitDiceCur") && maxHd) {
        document.getElementById("hitDiceCur").value = maxHd.value;
      }
      for (let i = 1; i <= 9; i++) {
        let cur = document.getElementById(`slot${i}_cur`);
        let max = document.getElementById(`slot${i}_max`);
        if (cur && max) cur.value = max.value;
      }
      saveSheet(false);
      showStatus("Long Rest Taken!");
    }
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
    let label = "";
    if (e.target.dataset.type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (e.target.dataset.type === "skill") {
      const id = e.target.dataset.id;
      const row = e.target.closest(".skill-row");
      bonus = parseInt(row?.querySelector(".skill-val")?.textContent, 10) || 0;
      let rawText = row?.querySelector(".skill-label")?.textContent || "Skill";
      label = rawText.replace(/\(.*\)$/, "").trim();
    }
    const total = roll + bonus;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = total;
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    addDiceHistory(`${label} (${roll} ${sign})`, total);
  }

  if (e.target.closest("#addSpellBtn")) {
    openSpellPicker();
  }

  if (e.target.closest("#closeSpellModal")) {
    document.getElementById("spellModal")?.classList.remove("open");
  }

  if (e.target.closest("#addCustomSpellBtn")) {
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
    document.getElementById("spellModal")?.classList.remove("open");
  }

  const spellRow = e.target.closest(".spell-add-item");
  if (spellRow) {
    const badge = spellRow.querySelector(".spell-add-badge");
    if (badge) badge.textContent = "Adding...";
    const spellName = spellRow.dataset.name;
    const spellUrl = spellRow.dataset.url;

    let spellData = FALLBACK_SPELLS.find((s) => s.name.toLowerCase() === spellName.toLowerCase());

    if (spellUrl) {
      const fetched = await fetchAPI("https://www.dnd5eapi.co" + spellUrl);
      if (fetched) spellData = fetched;
    }

    let finalDesc = spellData ? (Array.isArray(spellData.desc) ? spellData.desc.join("\n\n") : spellData.desc) : "Description not available.";
    let finalType = spellData ? (spellData.level === 0 ? "Cantrip" : `Level ${spellData.level} ${spellData.school?.name || ""}`.trim()) : "Spell";

    myCharacterSpells.push({
      name: spellName,
      type: finalType,
      casting_time: spellData?.casting_time || "1 Action",
      range: spellData?.range || "30 ft",
      duration: spellData?.duration || "Instantaneous",
      desc: finalDesc
    });

    saveSheet(false);
    renderMySpells();
    document.getElementById("spellModal")?.classList.remove("open");
  }

  if (e.target.closest("#addTraitBtn")) {
    openTraitPicker();
  }

  if (e.target.closest("#closeTraitModal")) {
    document.getElementById("traitModal")?.classList.remove("open");
  }

  if (e.target.closest("#addCustomTraitBtn")) {
    myCharacterTraits.push({
      name: "New Ability",
      type: "Feature",
      desc: "",
      isExpanded: true
    });
    saveSheet(false);
    renderMyTraits();
    document.getElementById("traitModal")?.classList.remove("open");
  }

  const traitRow = e.target.closest(".trait-option-item");
  if (traitRow) {
    const badge = traitRow.querySelector(".spell-add-badge");
    if (badge) badge.textContent = "Adding...";
    const traitName = traitRow.dataset.name;
    const traitUrl = traitRow.dataset.url;

    let traitData = FALLBACK_TRAITS.find((t) => t.name.toLowerCase() === traitName.toLowerCase());

    if (traitUrl) {
      const fetched = await fetchAPI("https://www.dnd5eapi.co" + traitUrl);
      if (fetched) traitData = fetched;
    }

    let finalDesc = traitData ? (Array.isArray(traitData.desc) ? traitData.desc.join("\n\n") : traitData.desc) : "Description not available.";

    myCharacterTraits.push({
      name: traitName,
      type: traitRow.dataset.type || "Feature",
      desc: finalDesc,
      isExpanded: false
    });

    saveSheet(false);
    renderMyTraits();
    document.getElementById("traitModal")?.classList.remove("open");
  }

  if (e.target.closest("#addWeaponBtn")) {
    myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    saveSheet(false);
    renderWeapons();
  }

  if (e.target.closest(".weapon-delete-btn")) {
    const idx = parseInt(e.target.closest(".weapon-delete-btn").dataset.index, 10);
    myCharacterWeapons.splice(idx, 1);
    while (myCharacterWeapons.length < 2) {
      myCharacterWeapons.push({ name: "", atk: "", dmg: "", notes: "" });
    }
    saveSheet(false);
    renderWeapons();
  }

  if (e.target.closest(".trait-card-delete")) {
    const idx = parseInt(e.target.closest(".trait-card-delete").dataset.index, 10);
    myCharacterTraits.splice(idx, 1);
    saveSheet(false);
    renderMyTraits();
  }

  if (e.target.closest(".trait-expand-btn")) {
    const card = e.target.closest(".trait-card");
    const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded");
    const isExp = card.classList.contains("expanded");
    e.target.closest(".trait-expand-btn").textContent = isExp ? "Collapse" : "Expand";
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = isExp;
    saveSheet(true);
  }

  if (e.target.closest(".spell-card-delete")) {
    const idx = parseInt(e.target.closest(".spell-card-delete").dataset.index, 10);
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
    document.getElementById("loadModal")?.classList.remove("open");
    showStatus("Character Loaded!");
  }
});

document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet(false);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
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
      if (e.target.tagName.toLowerCase() === "textarea") {
        autoExpandTextarea(e.target);
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
      if (e.target.tagName.toLowerCase() === "textarea") {
        autoExpandTextarea(e.target);
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
});

document.addEventListener("focusout", (e) => {
  if (
    e.target.classList.contains("save-field") ||
    e.target.classList.contains("custom-spell-field") ||
    e.target.classList.contains("custom-trait-field") ||
    e.target.classList.contains("wpn-field")
  ) {
    saveSheet(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
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
      showStatus("Restored successfully!");
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
