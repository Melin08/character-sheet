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
let myCharacterWeapons = [{ name: "", dmg: "", dmg_type: "", notes: "" }, { name: "", dmg: "", dmg_type: "", notes: "" }];
let diceRollHistory = [];

let draggedSpellIndex = null;
let touchDraggedIndex = null;
let currentDropTarget = null;

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
      <button class="btn outline blue" id="logoutBtn" type="button" style="border:1px solid #3b4c68; background:transparent;">Log Out</button>
    `;
    try {
      const docSnap = await getDoc(doc(db, "user_rosters", user.uid));
      if (docSnap.exists()) localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(docSnap.data().data));
      else saveRoster(getRoster());
      loadSheet();
    } catch (e) { console.error("Cloud pull failed", e); }
  } else {
    currentUser = null;
    authGroup.innerHTML = `
      <button class="btn outline blue" id="loginNavBtn" type="button" style="border:1px solid #3b4c68; background:transparent;">Log In</button>
      <button class="btn red" id="signupNavBtn" type="button">Sign Up</button>
    `;
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

function getModifier(score) { return Math.floor((score - 10) / 2); }
function getProfBonus(level) { return Math.ceil(1 + level / 4); }

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
      let saveVal = isSaveChecked ? mod + prof : mod;
      saveValElem.textContent = saveVal >= 0 ? `+${saveVal}` : saveVal;
    }
  });

  document.querySelectorAll(".skill-card").forEach((card) => {
    const stat = card.dataset.stat;
    const statMod = mods[stat] ?? 0;
    const isProf = card.querySelector(".prof-cb")?.checked;
    const isExp = card.querySelector(".exp-cb")?.checked;

    let total = statMod;
    if (isProf) total += prof;
    if (isExp) total += prof;

    const valElem = card.querySelector(".skill-val");
    if (valElem) valElem.textContent = total >= 0 ? `+${total}` : total;
  });
}

function renderWeapons() {
  const container = document.getElementById("weaponsContainer");
  if (!container) return;

  while (myCharacterWeapons.length < 2) {
    myCharacterWeapons.push({ name: "", dmg: "", dmg_type: "", notes: "" });
  }

  container.innerHTML = myCharacterWeapons.map((wpn, idx) => `
      <div class="attack-entry" data-index="${idx}">
        <input type="text" class="inline-input wpn-field" data-prop="name" value="${escapeHtml(wpn.name || "")}" placeholder="Weapon" />
        <input type="text" class="inline-input wpn-field" data-prop="dmg" value="${escapeHtml(wpn.dmg || "")}" placeholder="1d8" />
        <input type="text" class="inline-input wpn-field" data-prop="dmg_type" value="${escapeHtml(wpn.dmg_type || "")}" placeholder="Piercing" />
        <input type="text" class="inline-input wpn-field" data-prop="notes" value="${escapeHtml(wpn.notes || "")}" placeholder="Notes, Range, etc..." />
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
    container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No spells added yet.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells.map((spell, idx) => `
      <div class="spell-card" draggable="true" data-index="${idx}">
        <div class="spell-card-header">
          <span class="spell-drag-handle" title="Drag to reorder">⋮⋮</span>
          <input type="text" class="spell-custom-title-input custom-spell-field" data-prop="name" value="${escapeHtml(spell.name || "")}" placeholder="Spell Name" />
          <button class="spell-card-delete" data-index="${idx}" type="button" title="Remove spell">&times;</button>
        </div>
        <div class="spell-card-meta">
          <div class="meta-field-group">
            <span class="meta-label">Type</span>
            <input type="text" class="spell-meta-input custom-spell-field" data-prop="type" value="${escapeHtml(spell.type || "")}" placeholder="Cantrip" />
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
        <textarea class="spell-custom-desc-textarea custom-spell-field" data-prop="desc" placeholder="Spell description and effects...">${escapeHtml(Array.isArray(spell.desc) ? spell.desc.join("\n\n") : (spell.desc || ""))}</textarea>
      </div>
  `).join("");

  document.querySelectorAll(".spell-custom-desc-textarea").forEach(autoExpandTextarea);
  attachSpellDragEvents();
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
    } catch (e) { console.error("Cloud save failed", e); }
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
    { name: "", dmg: "", dmg_type: "", notes: "" }, { name: "", dmg: "", dmg_type: "", notes: "" }
  ];

  renderWeapons(); renderMySpells(); renderMyTraits(); recalculateAll(); syncAllStatInputs();
}

function loadSheet() {
  const roster = getRoster();
  if (roster[activeCharId]) applyCharacterData(roster[activeCharId]);
  else {
    const keys = Object.keys(roster);
    if (keys.length > 0) {
      activeCharId = keys[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); applyCharacterData(roster[activeCharId]);
    } else {
      recalculateAll(); renderWeapons(); renderMySpells(); renderMyTraits(); syncAllStatInputs();
    }
  }
}

function resetSheet() {
  activeCharId = "char_" + Date.now(); localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId);
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") field.checked = false;
    else if (field.id === "charLevel") field.value = 1;
    else if (field.id === "ac" || field.id === "curHp" || field.id === "maxHp") field.value = 10;
    else if (field.classList.contains("attr-score-input")) field.value = 10;
    else if (field.id === "charSpeed") field.value = 30;
    else if (field.classList.contains("dual-input") || field.classList.contains("coin-input") || field.classList.contains("slot-input")) field.value = 0;
    else field.value = "";
  });
  myCharacterSpells = []; myCharacterTraits = []; myCharacterWeapons = [{ name: "", dmg: "", dmg_type: "", notes: "" }, { name: "", dmg: "", dmg_type: "", notes: "" }];
  diceRollHistory = [];
  
  renderDiceHistory(); recalculateAll(); renderWeapons(); renderMySpells(); renderMyTraits(); syncAllStatInputs(); saveSheet(); showStatus("New Character Created!");
}

function renderCharList() {
  const container = document.getElementById("charList");
  if (!container) return;
  const roster = getRoster(); const keys = Object.keys(roster);
  if (keys.length === 0) { container.innerHTML = `<p class="loading-text">No saved characters found.</p>`; return; }
  container.innerHTML = keys.map((id) => {
    const char = roster[id]; const isActive = id === activeCharId;
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

// ==========================================
// 5. GLOBAL EVENT DELEGATION
// ==========================================

document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.classList.contains("save-field")) {
    recalculateAll(); saveSheet();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll(); saveSheet();
  }
  if (e.target.classList.contains("spell-stat-input")) autoResizeStatInput(e.target);
  
  if (e.target.classList.contains("custom-spell-field")) {
    const card = e.target.closest(".spell-card");
    if(card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterSpells[idx]) {
        myCharacterSpells[idx][e.target.dataset.prop] = e.target.value; saveSheet();
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }

  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    if(card) {
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterTraits[idx]) {
        myCharacterTraits[idx][e.target.dataset.prop] = e.target.value; saveSheet();
      }
      if (e.target.tagName.toLowerCase() === "textarea") autoExpandTextarea(e.target);
    }
  }

  if (e.target.classList.contains("wpn-field")) {
    const entry = e.target.closest(".attack-entry");
    if(entry) {
        const idx = parseInt(entry.dataset.index, 10);
        if (myCharacterWeapons[idx]) {
            myCharacterWeapons[idx][e.target.dataset.prop] = e.target.value; saveSheet();
        }
    }
  }
});

document.addEventListener("click", async (e) => {
  // Auth Triggers
  if (e.target.id === "loginNavBtn") openAuthModal("login");
  if (e.target.id === "signupNavBtn") openAuthModal("signup");
  if (e.target.id === "closeAuthModal") document.getElementById("authModal").classList.remove("open");
  if (e.target.id === "authSubmitBtn") {
       const email = document.getElementById("authEmail").value;
       const pass = document.getElementById("authPassword").value;
       const errEl = document.getElementById("authError");
       errEl.style.display = "none";
       try {
           if (authMode === "login") await signInWithEmailAndPassword(auth, email, pass);
           else await createUserWithEmailAndPassword(auth, email, pass);
           document.getElementById("authModal").classList.remove("open");
       } catch (err) { errEl.textContent = err.message.replace("Firebase: ", ""); errEl.style.display = "block"; }
  }
  if (e.target.id === "googleAuthBtn") {
       const provider = new GoogleAuthProvider(); const errEl = document.getElementById("authError"); errEl.style.display = "none";
       try { await signInWithPopup(auth, provider); document.getElementById("authModal").classList.remove("open"); } 
       catch (err) { errEl.textContent = err.message.replace("Firebase: ", ""); errEl.style.display = "block"; }
  }

  // Save / Load / New / Delete Triggers
  if (e.target.id === "saveBtn") saveSheet();
  if (e.target.id === "newBtn") { if (confirm("Create a new blank character sheet?")) resetSheet(); }
  if (e.target.id === "loadBtn") { renderCharList(); document.getElementById("loadModal")?.classList.add("open"); }
  if (e.target.id === "closeLoadModal") document.getElementById("loadModal")?.classList.remove("open");
  if (e.target.id === "deleteBtn") {
    const roster = getRoster();
    if (confirm("Permanently delete current character?")) {
      delete roster[activeCharId]; saveRoster(roster);
      const keys = Object.keys(roster);
      if (keys.length > 0) { activeCharId = keys[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); loadSheet(); } 
      else resetSheet();
    }
  }
  
  if (e.target.id === "backupBtn") {
    const roster = getRoster();
    const currentChar = roster[activeCharId] || { id: activeCharId, name: "Character", fields: getCurrentSheetData(), spells: myCharacterSpells, traits: myCharacterTraits, weapons: myCharacterWeapons };
    const blob = new Blob([JSON.stringify({ character: currentChar, allRoster: roster }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `character-backup.json`; a.click(); URL.revokeObjectURL(url); showStatus("Backup downloaded!");
  }
  if (e.target.id === "helpLinkBtn") document.getElementById("helpModal")?.classList.add("open");
  if (e.target.id === "closeHelpModal") document.getElementById("helpModal")?.classList.remove("open");
  if (e.target.classList.contains("modal-backdrop")) e.target.classList.remove("open");

  if (e.target.classList.contains("char-delete-btn")) {
    const row = e.target.closest(".char-item-row"); const roster = getRoster();
    if (confirm(`Delete character "${roster[row.dataset.id]?.name || "Unnamed"}"?`)) {
      delete roster[row.dataset.id]; saveRoster(roster);
      if (activeCharId === row.dataset.id) {
        const remaining = Object.keys(roster);
        if (remaining.length > 0) { activeCharId = remaining[0]; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); loadSheet(); } else resetSheet();
      }
      renderCharList();
    }
  } else if (e.target.closest(".char-item-info") || e.target.classList.contains("char-select-btn")) {
    const row = e.target.closest(".char-item-row"); const roster = getRoster();
    activeCharId = row.dataset.id; localStorage.setItem(ACTIVE_CHAR_ID_KEY, activeCharId); applyCharacterData(roster[activeCharId]);
    document.getElementById("loadModal")?.classList.remove("open"); showStatus("Character Loaded!");
  }

  // Tabbing
  if (e.target.classList.contains("main-tab")) {
    document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active"); document.getElementById(e.target.dataset.target)?.classList.add("active");
  }
  if (e.target.classList.contains("sub-tab")) {
    document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".subtab-page").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active"); document.getElementById(e.target.dataset.sub)?.classList.add("active");
  }
  if (e.target.classList.contains("footer-nav-btn")) {
    const tabTarget = e.target.dataset.tab;
    document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    document.querySelector(`.main-tab[data-target="${tabTarget}"]`)?.classList.add("active");
    document.getElementById(tabTarget)?.classList.add("active");
    const scrollTarget = e.target.dataset.scroll;
    const elId = scrollTarget === "attr" ? ".attributes-group" : scrollTarget === "skills" ? ".skills-group" : scrollTarget === "spells" ? "#spellsList" : "#tab-journal";
    document.querySelector(elId)?.scrollIntoView({ behavior: "smooth" });
  }

  // Weapons List Add/Delete
  if (e.target.closest("#addWeaponBtn")) {
    myCharacterWeapons.push({ name: "", dmg: "", dmg_type: "", notes: "" }); saveSheet(); renderWeapons();
  }
  if (e.target.closest(".weapon-delete-btn")) {
    const idx = parseInt(e.target.closest(".weapon-delete-btn").dataset.index, 10);
    myCharacterWeapons.splice(idx, 1);
    while (myCharacterWeapons.length < 2) myCharacterWeapons.push({ name: "", dmg: "", dmg_type: "", notes: "" });
    saveSheet(); renderWeapons();
  }

  // Traits Expander
  if (e.target.closest(".trait-expand-btn")) {
    const card = e.target.closest(".trait-card"); const idx = parseInt(card.dataset.index, 10);
    card.classList.toggle("expanded"); const isExp = card.classList.contains("expanded");
    e.target.closest(".trait-expand-btn").textContent = isExp ? "Collapse" : "Expand";
    if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = isExp; saveSheet();
  }
  if (e.target.classList.contains("custom-trait-field")) {
    const card = e.target.closest(".trait-card");
    if (card && !card.classList.contains("expanded")) {
      card.classList.add("expanded"); const btn = card.querySelector(".trait-expand-btn"); if (btn) btn.textContent = "Collapse";
      const idx = parseInt(card.dataset.index, 10);
      if (myCharacterTraits[idx]) myCharacterTraits[idx].isExpanded = true; saveSheet();
    }
  }

  // Close Modals
  if (e.target.closest("#closeChoiceModal")) document.getElementById("choiceModal")?.classList.remove("open");
  if (e.target.closest("#closeSpellModal")) document.getElementById("spellModal")?.classList.remove("open");
  if (e.target.closest("#closeTraitModal")) document.getElementById("traitModal")?.classList.remove("open");
  
  // Resting
  if (e.target.id === "longRestBtn") {
      if (confirm("Take a Long Rest? This restores all HP, Hit Dice, and Spell Slots.")) {
        const maxHp = document.getElementById("maxHp")?.value || 0; if (document.getElementById("curHp")) document.getElementById("curHp").value = maxHp;
        const maxHd = document.getElementById("hitDiceMax")?.value || 0; if (document.getElementById("hitDiceCur")) document.getElementById("hitDiceCur").value = maxHd;
        for (let i = 1; i <= 9; i++) { let cur = document.getElementById(`slot${i}_cur`); let max = document.getElementById(`slot${i}_max`); if (cur && max) cur.value = max.value; }
        saveSheet(); showStatus("Rested!");
      }
  }
  if (e.target.id === "shortRestBtn") { if (confirm("Take a Short Rest? Use your hit dice to heal!")) showStatus("Rested!"); }

  // Dice Rolls
  if (e.target.classList.contains("dice-btn")) {
     const sides = parseInt(e.target.dataset.sides, 10);
     const roll = Math.floor(Math.random() * sides) + 1;
     const out = document.getElementById("rollResult");
     if (out) out.textContent = roll;
     addDiceHistory(`1d${sides}`, roll);
  }

  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0, label = "";
    if (e.target.dataset.type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
      label = `${attr.toUpperCase()} Save`;
    } else if (e.target.dataset.type === "skill") {
      const id = e.target.dataset.id;
      const row = e.target.closest(".skill-card");
      bonus = parseInt(row?.querySelector(".skill-val")?.textContent, 10) || 0;
      label = row?.querySelector(".skill-name")?.textContent || "Skill";
    }
    const total = roll + bonus;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = total;
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    addDiceHistory(`${label} (${roll} ${sign})`, total);
  }

  // Spell & Trait Wizard Add Buttons
  if (e.target.closest("#addSpellBtn")) {
    document.getElementById("spellModal")?.classList.add("open");
    document.getElementById("spellSearchInput").value = "";
    document.getElementById("spellApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
    const results = await searchSpells(""); const detailed = await fetchDetailedSpells(results); renderModalSpellsList(detailed);
  }
  if (e.target.closest("#addTraitBtn")) {
    document.getElementById("traitModal")?.classList.add("open");
    document.getElementById("traitSearchInput").value = "";
    document.getElementById("traitApiList").innerHTML = `<p class="loading-text">Loading...</p>`;
    const results = await searchTraits(""); const detailed = await fetchDetailedTraits(results); renderModalTraitsList(detailed);
  }
  if (e.target.closest("#addCustomSpellBtn")) {
    myCharacterSpells.push({ name: "", type: "", casting_time: "", range: "", duration: "", desc: "" }); saveSheet(); renderMySpells(); document.getElementById("spellModal")?.classList.remove("open");
  }
  if (e.target.closest("#addCustomTraitBtn")) {
    myCharacterTraits.push({ name: "", type: "", desc: "", isExpanded: true }); saveSheet(); renderMyTraits(); document.getElementById("traitModal")?.classList.remove("open");
  }

  // Variant Add Listeners (Spells / Traits)
  if (e.target.closest(".temp-spell-btn")) {
     const tBtn = e.target.closest(".temp-spell-btn");
     let sName = tBtn.dataset.name;
     let spellDesc = Array.isArray(tempSpellHold.desc) ? tempSpellHold.desc.join("\n\n") : (tempSpellHold.desc || "");
     spellDesc += `\n\nSelected Variant: ${sName}`;
     if (tempSpellHold.higher_level) spellDesc += "\n\nAt Higher Levels: " + (Array.isArray(tempSpellHold.higher_level) ? tempSpellHold.higher_level.join(" ") : tempSpellHold.higher_level);
     myCharacterSpells.push({
         name: `${tempSpellHold.name} (${sName})`, type: tempSpellHold.level === 0 ? "Cantrip" : `Level ${tempSpellHold.level} ${tempSpellHold.school?.name || ""}`.trim(),
         casting_time: tempSpellHold.casting_time || "1 Action", range: tempSpellHold.range || "30 ft", duration: tempSpellHold.duration || "Instantaneous", desc: spellDesc
     });
     saveSheet(); renderMySpells(); document.getElementById("choiceModal").classList.remove("open");
  }

  if (e.target.closest(".temp-trait-btn")) {
     const tBtn = e.target.closest(".temp-trait-btn");
     let sName = tBtn.dataset.name;
     let sUrl = tBtn.dataset.url;
     let tDesc = Array.isArray(tempTraitHold.desc) ? tempTraitHold.desc.join("\n\n") : (tempTraitHold.desc || "");
     if (sUrl) { const sub = await fetchAPI("https://www.dnd5eapi.co" + sUrl); if (sub && sub.desc) tDesc += "\n\n" + (Array.isArray(sub.desc) ? sub.desc.join("\n\n") : sub.desc); } 
     else tDesc += `\n\nSelected Variant: ${sName}`;
     if (tempTraitHold.name === "Breath Weapon") {
         let dName = ""; const cols = ["Black", "Blue", "Brass", "Bronze", "Copper", "Gold", "Green", "Red", "Silver", "White"];
         for (let c of cols) { if (sName.includes(c)) dName = c; }
         let drag = DRAGON_ANCESTRY_MAP[dName];
         if (drag) myCharacterTraits.push({ name: `Breath Weapon (${drag.damage})`, type: "Racial Trait", desc: `Exhale destructive energy. It is a ${drag.breath} dealing ${drag.damage} damage. Save: ${drag.save}.`, isExpanded: false });
         else myCharacterTraits.push({ name: `${tempTraitHold.name} (${sName})`, type: "Racial Trait", desc: tDesc, isExpanded: false });
     } else myCharacterTraits.push({ name: `${tempTraitHold.name} (${sName})`, type: tempTraitHold.url?.includes("/features/") ? "Class Feature" : "Racial Trait", desc: tDesc, isExpanded: false });
     saveSheet(); renderMyTraits(); document.getElementById("choiceModal").classList.remove("open");
  }

  // API List Selection
  const spellAddRow = e.target.closest(".spell-add-item");
  if (spellAddRow) {
    const badge = spellAddRow.querySelector(".spell-add-badge"); if (badge) badge.textContent = "Adding...";
    let detail = null; if (spellAddRow.dataset.url) detail = await fetchAPI("https://www.dnd5eapi.co" + spellAddRow.dataset.url);
    if (detail && (detail.damage_type_options || detail.choice)) {
        tempSpellHold = detail; document.getElementById("spellModal")?.classList.remove("open");
        if (badge) badge.textContent = "+ Add";
        let cData = detail.damage_type_options || detail.choice; let oArr = [];
        if (cData && cData.from && cData.from.options) oArr = cData.from.options; else if (Array.isArray(cData)) oArr = cData;
        let rHtml = `<div class="equip-options-grid">`;
        oArr.forEach((opt, idx) => {
          let n = opt.notes || opt.item?.name || opt.choice?.desc || opt.desc || opt.trait?.name || opt.spell?.name || opt.damage_type?.name || opt.feature?.name || "Variant " + (idx+1);
          rHtml += `<div class="choice-option-wrapper"><button type="button" class="choice-option-btn temp-spell-btn" data-name="${escapeHtml(n)}"><strong>${escapeHtml(n)}</strong></button></div>`;
        });
        rHtml += `</div>`;
        document.getElementById("choiceModalTitle").textContent = `Choose Variant: ${detail.name}`;
        document.getElementById("choiceModalBody").innerHTML = `<div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">Pick Variant:</div>${rHtml}`;
        document.getElementById("choiceModal").classList.add("open"); return;
    }
    let finalDesc = "Description not available."; let finalType = "Spell"; let finalCast = "1 Action"; let finalRange = "30 ft"; let finalDur = "Instantaneous";
    if (detail) {
        finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "");
        if (detail.higher_level) finalDesc += "\n\nAt Higher Levels: " + (Array.isArray(detail.higher_level) ? detail.higher_level.join(" ") : detail.higher_level);
        finalType = detail.level === 0 ? "Cantrip" : `Level ${detail.level} ${detail.school?.name || ""}`.trim();
        finalCast = detail.casting_time || finalCast; finalRange = detail.range || finalRange; finalDur = detail.duration || finalDur;
    }
    myCharacterSpells.push({ name: spellAddRow.dataset.name, type: finalType, casting_time: finalCast, range: finalRange, duration: finalDur, desc: finalDesc });
    saveSheet(); renderMySpells(); document.getElementById("spellModal")?.classList.remove("open"); if (badge) badge.textContent = "+ Add";
  }

  const traitAddRow = e.target.closest(".trait-option-item");
  if (traitAddRow) {
    const badge = traitAddRow.querySelector(".spell-add-badge"); if (badge) badge.textContent = "Adding...";
    let detail = null; if (traitAddRow.dataset.url) detail = await fetchAPI("https://www.dnd5eapi.co" + traitAddRow.dataset.url);
    let hasVariants = false; let specific = detail?.trait_specific || detail?.feature_specific || detail?.choice;
    if (specific && (specific.subtrait_options || specific.spell_options || specific.damage_type_options || specific.choice || specific.breath_weapon_options || specific.subfeature_options || specific.expertise_options || specific.from)) hasVariants = true;
    if (detail?.name === "Breath Weapon") { hasVariants = true; detail.choice = { desc: "Draconic Ancestry Variant", from: { options: Object.keys(DRAGON_ANCESTRY_MAP).map(c => ({ item: { name: c } })) } }; }
    if (hasVariants) {
        tempTraitHold = detail; document.getElementById("traitModal")?.classList.remove("open"); if (badge) badge.textContent = "+ Add";
        let cData = detail.trait_specific?.subtrait_options || detail.trait_specific?.spell_options || detail.trait_specific?.damage_type_options || detail.trait_specific?.choice || detail.trait_specific?.breath_weapon_options || detail.feature_specific?.subfeature_options || detail.feature_specific?.expertise_options || detail.feature_specific?.choice || (detail.trait_specific?.from ? detail.trait_specific : null) || (detail.feature_specific?.from ? detail.feature_specific : null) || detail.choice || detail.damage_type_options;
        let oArr = []; if (cData && cData.from && cData.from.options) oArr = cData.from.options; else if (Array.isArray(cData)) oArr = cData;
        let rHtml = `<div class="equip-options-grid">`;
        oArr.forEach((opt, idx) => {
          let n = opt.notes || opt.item?.name || opt.choice?.desc || opt.desc || opt.trait?.name || opt.spell?.name || opt.damage_type?.name || opt.feature?.name || "Variant " + (idx+1);
          let u = opt.item?.url || opt.trait?.url || opt.feature?.url || null; 
          rHtml += `<div class="choice-option-wrapper"><button type="button" class="choice-option-btn temp-trait-btn" data-name="${escapeHtml(n)}" data-url="${u || ''}"><strong>${escapeHtml(n)}</strong></button></div>`;
        });
        rHtml += `</div>`;
        document.getElementById("choiceModalTitle").textContent = `Choose Variant: ${detail.name}`;
        document.getElementById("choiceModalBody").innerHTML = `<div class="wizard-intro" style="font-size: 1.15rem; color: #cbd5e1; text-align: center; margin-bottom: 1.5rem;">Pick Variant:</div>${rHtml}`;
        document.getElementById("choiceModal").classList.add("open"); return;
    }
    let finalDesc = "Description not available."; if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n\n") : (detail.desc || "");
    myCharacterTraits.push({ name: traitAddRow.dataset.name, type: traitAddRow.dataset.type || "Feature", desc: finalDesc, isExpanded: false });
    saveSheet(); renderMyTraits(); document.getElementById("traitModal")?.classList.remove("open"); if (badge) badge.textContent = "+ Add";
  }

});

// Drag and Drop (Spells & Traits)
function attachSpellDragEvents() {
  const cards = document.querySelectorAll(".spell-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) { e.preventDefault(); return; }
      draggedSpellIndex = parseInt(card.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", draggedSpellIndex); card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); document.querySelectorAll(".spell-card").forEach(c => c.classList.remove("drag-over")); draggedSpellIndex = null; });
    card.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    card.addEventListener("dragenter", () => { if (draggedSpellIndex !== null && parseInt(card.dataset.index, 10) !== draggedSpellIndex) card.classList.add("drag-over"); });
    card.addEventListener("dragleave", () => { card.classList.remove("drag-over"); });
    card.addEventListener("drop", (e) => {
      e.preventDefault(); card.classList.remove("drag-over"); if (draggedSpellIndex === null) return;
      const targetIndex = parseInt(card.dataset.index, 10); if (draggedSpellIndex === targetIndex) return;
      const movedSpell = myCharacterSpells.splice(draggedSpellIndex, 1)[0];
      myCharacterSpells.splice(targetIndex, 0, movedSpell); saveSheet(); renderMySpells();
    });

    const handle = card.querySelector(".spell-drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", () => { touchDraggedIndex = parseInt(card.dataset.index, 10); card.classList.add("dragging"); }, { passive: true });
      handle.addEventListener("touchmove", (e) => {
        const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCard = targetElement ? targetElement.closest(".spell-card") : null;
        document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
        if (targetCard && targetCard !== card) { targetCard.classList.add("drag-over"); currentDropTarget = targetCard; } else currentDropTarget = null;
      });
      handle.addEventListener("touchend", () => {
        card.classList.remove("dragging"); document.querySelectorAll(".spell-card").forEach((c) => c.classList.remove("drag-over"));
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
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
      saveRoster(roster); loadSheet(); showStatus("Restored successfully!");
    } catch (err) { alert("Invalid backup file."); }
  };
  reader.readAsText(file);
});

// Initialization
loadSheet();
renderMyTraits();
