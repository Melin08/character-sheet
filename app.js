const STORAGE_KEY = "badman_style_sheet";

// Calculate modifier from ability score
function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

// Calculate proficiency bonus based on level
function getProfBonus(level) {
  return Math.ceil(1 + level / 4);
}

// Update all calculated fields
function recalculateAll() {
  const levelInput = document.getElementById("charLevel");
  const level = parseInt(levelInput?.value, 10) || 1;
  const prof = getProfBonus(level);

  const profBonusDisplay = document.getElementById("profBonusDisplay");
  if (profBonusDisplay) {
    profBonusDisplay.textContent = prof >= 0 ? `+${prof}` : `${prof}`;
  }

  // Update Attributes & Saves
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

  // Update Skills
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

// Save all fields to LocalStorage
function saveSheet() {
  const data = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    if (field.type === "checkbox") {
      data[field.id] = field.checked;
    } else {
      data[field.id] = field.value;
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Load saved data
function loadSheet() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
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
  } catch (err) {
    console.error("Could not parse saved sheet", err);
  }
  recalculateAll();
}

// Tabs switching
document.querySelectorAll(".main-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".main-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const target = btn.dataset.target;
    document.getElementById(target)?.classList.add("active");
  });
});

// Dice Roller
document.querySelectorAll(".dice-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sides = parseInt(btn.dataset.sides, 10);
    const roll = Math.floor(Math.random() * sides) + 1;
    document.getElementById("rollResult").textContent = `(d${sides}): ${roll}`;
  });
});

document.getElementById("clearRollBtn")?.addEventListener("click", () => {
  document.getElementById("rollResult").textContent = "";
});

// Hex Die Roll Click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roll-btn")) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let bonus = 0;
    const type = e.target.dataset.type;

    if (type === "save") {
      const attr = e.target.dataset.attr;
      bonus = parseInt(document.getElementById(`save_val_${attr}`)?.textContent, 10) || 0;
    } else if (type === "skill") {
      const id = e.target.dataset.id;
      bonus = parseInt(document.getElementById(`val_${id}`)?.textContent, 10) || 0;
    }

    const total = roll + bonus;
    document.getElementById("rollResult").textContent = `Rolled ${roll} + (${bonus}) = ${total}`;
  }
});

// Auto-save & calculate on input
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    recalculateAll();
    saveSheet();
  }
});

// Buttons
document.getElementById("saveBtn")?.addEventListener("click", () => {
  saveSheet();
  alert("Character saved to browser storage!");
});

document.getElementById("newBtn")?.addEventListener("click", () => {
  if (confirm("Reset current sheet?")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

document.getElementById("backupBtn")?.addEventListener("click", () => {
  const data = localStorage.getItem(STORAGE_KEY) || "{}";
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "character-sheet.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("restoreFile")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      loadSheet();
      alert("Character restored successfully!");
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("deleteBtn")?.addEventListener("click", () => {
  if (confirm("Delete this character profile?")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

// Initialize on page load
loadSheet();
