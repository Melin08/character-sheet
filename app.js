const STORAGE_KEY = "simple_rpg_character";

// Calculate modifier: (score - 10) / 2 rounded down
function calculateModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Update modifier displays
function updateAllModifiers() {
  document.querySelectorAll(".stat-card").forEach((card) => {
    const stat = card.dataset.stat;
    const scoreInput = document.getElementById(`score_${stat}`);
    const modDisplay = document.getElementById(`mod_${stat}`);
    if (scoreInput && modDisplay) {
      const score = parseInt(scoreInput.value, 10) || 10;
      modDisplay.textContent = calculateModifier(score);
    }
  });
}

// Save all field values to localStorage
function saveCharacter() {
  const characterData = {};
  document.querySelectorAll(".save-field").forEach((field) => {
    characterData[field.id] = field.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characterData));
}

// Load values back into fields
function loadCharacter() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach((id) => {
      const field = document.getElementById(id);
      if (field) {
        field.value = data[id];
      }
    });
  } catch (err) {
    console.error("Failed to load character data:", err);
  }
  updateAllModifiers();
}

// Tab navigation
document.querySelectorAll(".tab-link").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-link").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

    button.classList.add("active");
    const target = button.dataset.tab;
    document.getElementById(target).classList.add("active");
  });
});

// Auto-save whenever user types or changes an input
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("save-field")) {
    if (e.target.classList.contains("stat-score")) {
      updateAllModifiers();
    }
    saveCharacter();
  }
});

// Backup file download
document.getElementById("exportBtn").addEventListener("click", () => {
  const raw = localStorage.getItem(STORAGE_KEY) || "{}";
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "character-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

// Clear character
document.getElementById("newBtn").addEventListener("click", () => {
  if (confirm("Reset this character? Unsaved changes will be cleared.")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

// Start up
loadCharacter();
