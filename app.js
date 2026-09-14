// Local Storage Keys
const SHEET_STORAGE_KEY = "badman_char_sheet_data";
const SPELLS_STORAGE_KEY = "badman_char_sheet_spells";

let allSpellsCache = [];
let myCharacterSpells = [];

const SHEET_STORAGE_KEY = "badman_char_sheet_data";
const SPELLS_STORAGE_KEY = "badman_char_sheet_spells";
const WEAPONS_STORAGE_KEY = "badman_char_sheet_weapons";

let myCharacterWeapons = [
  { name: "", atk: "", dmg: "", notes: "" },
  { name: "", atk: "", dmg: "", notes: "" }
];

// Flash helper to show user action feedback
function showStatus(text) {
  const statusElem = document.getElementById("saveStatus");
  if (!statusElem) return;
  statusElem.textContent = text;
  setTimeout(() => {
    statusElem.textContent = "";
  }, 2500);
}

// Math calculation helpers
function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

function getProfBonus(level) {
  return Math.ceil(1 + level / 4);
}

// Recalculate proficiency, ability modifiers, saves, and skill totals
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

  // Calculate 18 skill values
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

// Save fields & spells to localStorage
function saveSheet() {
  const data = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") {
      data[field.id] = field.checked;
    } else {
      data[field.id] = field.value;
    }
  });
  localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(SPELLS_STORAGE_KEY, JSON.stringify(myCharacterSpells));
  showStatus("Saved!");
}

// Load saved data from localStorage
function loadSheet() {
  const rawData = localStorage.getItem(SHEET_STORAGE_KEY);
  if (rawData) {
    try {
      const data = JSON.parse(rawData);
      Object.keys(data).forEach((id) => {
        const field = document.getElementById(id);
        if (field) {
          if (field.type === "checkbox") {
            field.checked = data[id];
          } else {
            field.value = data[id];
          }
        }
      });
    } catch (e) {
      console.error("Failed to parse sheet data", e);
    }
  }

  const rawSpells = localStorage.getItem(SPELLS_STORAGE_KEY);
  if (rawSpells) {
    try {
      myCharacterSpells = JSON.parse(rawSpells);
    } catch (e) {
      myCharacterSpells = [];
    }
  } else {
    myCharacterSpells = [];
  }

  recalculateAll();
  renderMySpells();
}

// Reset sheet to clean blank state
function resetSheet() {
  localStorage.removeItem(SHEET_STORAGE_KEY);
  localStorage.removeItem(SPELLS_STORAGE_KEY);
  location.reload();
}

// ================= PRIMARY TAB & SUB-TAB SWITCHING ================= //
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

// Footer quick links jump to correct tab and scroll smoothly
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

// ================= DICE ROLLER ================= //
document.querySelectorAll(".dice-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sides = parseInt(btn.dataset.sides, 10);
    const roll = Math.floor(Math.random() * sides) + 1;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = `(d${sides}): ${roll}`;
  });
});

document.getElementById("clearRollBtn")?.addEventListener("click", () => {
  const out = document.getElementById("rollResult");
  if (out) out.textContent = "";
});

// Red Hex Die icons roll d20 + corresponding bonus
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
    const sign = bonus >= 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`;
    const out = document.getElementById("rollResult");
    if (out) out.textContent = `${label}: ${roll} ${sign} = ${total}`;
  }
});

// ================= SPELL MODAL & API INTEGRATION ================= //
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
        <div class="spell-option-item" data-index="${spell.index}" data-name="${spell.name}">
          <span>${spell.name}</span>
          <span class="spell-add-badge">+ Add</span>
        </div>
      `
    )
    .join("");
}

function renderMySpells() {
  const container = document.getElementById("spellsList");
  if (!container) return;

  if (myCharacterSpells.length === 0) {
    container.innerHTML = `<p style="font-size: 0.88rem; color: #888;">No spells added yet.</p>`;
    return;
  }

  container.innerHTML = myCharacterSpells
    .map((spell, idx) => {
      const levelText = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;
      const schoolText = spell.school?.name || "";
      const timeText = spell.casting_time || "—";
      const rangeText = spell.range || "—";
      const durationText = spell.duration || "—";

      let summary = "";
      if (Array.isArray(spell.desc)) {
        summary = spell.desc.join(" ");
      } else if (typeof spell.desc === "string") {
        summary = spell.desc;
      }
      if (summary.length > 220) {
        summary = summary.substring(0, 220) + "...";
      }

      return `
        <div class="spell-card">
          <div class="spell-card-header">
            <span class="spell-card-title">${spell.name}</span>
            <button class="spell-card-delete" data-index="${idx}" type="button" title="Remove spell">&times;</button>
          </div>
          <div class="spell-card-meta">
            <span><strong>Type:</strong> ${levelText} ${schoolText}</span>
            <span><strong>Casting:</strong> ${timeText}</span>
            <span><strong>Range:</strong> ${rangeText}</span>
            <span><strong>Duration:</strong> ${durationText}</span>
          </div>
          <p class="spell-card-desc">${summary || "No description provided."}</p>
        </div>
      `;
    })
    .join("");
}

function openModal() {
  const modal = document.getElementById("spellModal");
  modal?.classList.add("open");
  const searchInput = document.getElementById("spellSearchInput");
  if (searchInput) {
    searchInput.value = "";
    setTimeout(() => searchInput.focus(), 50);
  }
}

function closeModal() {
  const modal = document.getElementById("spellModal");
  modal?.classList.remove("open");
}

// Open modal and fetch spell list if needed
document.getElementById("addSpellBtn")?.addEventListener("click", async () => {
  openModal();
  const list = document.getElementById("spellApiList");
  if (list && allSpellsCache.length === 0) {
    list.innerHTML = `<p class="loading-text">Loading official 5e spells...</p>`;
    await fetchOfficialSpells();
  }
  renderModalSpells();
});

// Close button click
document.getElementById("closeSpellModal")?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeModal();
});

// Click outside modal box on the backdrop to dismiss
document.getElementById("spellModal")?.addEventListener("click", (e) => {
  if (e.target.id === "spellModal") {
    closeModal();
  }
});

// Escape key dismisses modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

// Filter spells as user types
document.getElementById("spellSearchInput")?.addEventListener("input", (e) => {
  renderModalSpells(e.target.value);
});

// Click spell to fetch details and add
document.getElementById("spellApiList")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".spell-option-item");
  if (!row) return;

  const spellIndex = row.dataset.index;
  const spellName = row.dataset.name;

  if (myCharacterSpells.some((s) => s.name === spellName)) {
    closeModal();
    return;
  }

  const badge = row.querySelector(".spell-add-badge");
  if (badge) badge.textContent = "Adding...";

  const details = await fetchSpellDetails(spellIndex);
  if (details) {
    myCharacterSpells.push(details);
    saveSheet();
    renderMySpells();
  }

  closeModal();
  if (badge) badge.textContent = "+ Add";
});

// Delete individual spell from card list
document.getElementById("spellsList")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("spell-card-delete")) {
    const index = parseInt(e.target.dataset.index, 10);
    myCharacterSpells.splice(index, 1);
    saveSheet();
    renderMySpells();
  }
});

// ================= BUTTON BAR HANDLERS ================= //
// Save
document.getElementById("saveBtn")?.addEventListener("click", () => {
  saveSheet();
});

// Load
document.getElementById("loadBtn")?.addEventListener("click", () => {
  loadSheet();
  showStatus("Loaded!");
});

// New
document.getElementById("newBtn")?.addEventListener("click", () => {
  if (confirm("Reset current character sheet? Any unsaved changes will be lost.")) {
    resetSheet();
  }
});

// Delete
document.getElementById("deleteBtn")?.addEventListener("click", () => {
  if (confirm("Permanently delete this character and all its spells?")) {
    resetSheet();
  }
});

// Backup
document.getElementById("backupBtn")?.addEventListener("click", () => {
  const rawSheet = localStorage.getItem(SHEET_STORAGE_KEY) || "{}";
  const rawSpells = localStorage.getItem(SPELLS_STORAGE_KEY) || "[]";

  const fullBackup = {
    sheet: JSON.parse(rawSheet),
    spells: JSON.parse(rawSpells),
    version: 1
  };

  const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const charName = document.getElementById("charName")?.value.trim() || "character";
  a.href = url;
  a.download = `${charName.toLowerCase().replace(/\s+/g, "_")}-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Backup downloaded!");
});

// Restore
document.getElementById("restoreFile")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed.sheet && parsed.spells) {
        localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(parsed.sheet));
        localStorage.setItem(SPELLS_STORAGE_KEY, JSON.stringify(parsed.spells));
      } else {
        localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(parsed));
      }
      loadSheet();
      showStatus("Restored successfully!");
    } catch (err) {
      alert("Invalid JSON file provided.");
    }
  };
  reader.readAsText(file);
});

// Auto-calculate & save changes live on input
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
});

// Initialize on page load
loadSheet();
