const STORAGE_KEY = "rpg_sheet_data_final";
const DND_API = "https://www.dnd5eapi.co/api";
const OPEN5E_API = "https://api.open5e.com/v1";

let character = {
  meta: {},
  weapons: [
    { id: Date.now(), name: "", atk: "", dmg: "", notes: "" },
    { id: Date.now() + 1, name: "", atk: "", dmg: "", notes: "" }
  ],
  traits: [],
  spells: []
};

let draggedItemIndex = null;
let currentDragContext = null;

let spellCachePromise = null;
let traitCachePromise = null;
let spellCache = [];
let traitCache = [];

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupTabs();
  setupAutoExpand();
  setupStaticListeners();
  renderAll();
  
  spellCachePromise = buildSpellCache();
  traitCachePromise = buildTraitCache();
});

async function fetchAPI(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API fail");
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function buildSpellCache() {
  try {
    const open5eSpells = await fetchAPI(`${OPEN5E_API}/spells/?limit=3000`);
    if (open5eSpells && open5eSpells.results) {
      spellCache = open5eSpells.results.map(s => ({
        name: s.name,
        type: s.level === "Cantrip" ? "Cantrip" : `Level ${s.level} ${s.school}`,
        desc: `${s.casting_time} | ${s.range} | ${s.duration}\n\n${s.desc}`
      }));
    }
    const dnd5eSpells = await fetchAPI(`${DND_API}/spells`);
    if (dnd5eSpells && dnd5eSpells.results) {
      const existingNames = new Set(spellCache.map(s => s.name.toLowerCase()));
      dnd5eSpells.results.forEach(s => {
        if(!existingNames.has(s.name.toLowerCase())) {
          spellCache.push({ name: s.name, type: "Spell", url: s.url }); 
        }
      });
    }
  } catch(e) {
    console.log("Spell fetch failed", e);
  }
}

async function buildTraitCache() {
  try {
    const [classesRes, racesRes, featsRes] = await Promise.all([
      fetchAPI(`${DND_API}/classes`),
      fetchAPI(`${DND_API}/races`),
      fetchAPI(`${DND_API}/features`) 
    ]);

    let tempTraits = [];

    if (classesRes && classesRes.results) {
      const classPromises = classesRes.results.map(c => 
        fetchAPI(`${DND_API}/classes/${c.index}/features`).then(res => ({ className: c.name, features: res?.results || [] }))
      );
      const classData = await Promise.all(classPromises);
      classData.forEach(cd => {
        cd.features.forEach(f => {
          tempTraits.push({ name: f.name, type: `Class Feature (${cd.className})`, url: f.url });
        });
      });
    }

    if (racesRes && racesRes.results) {
      const racePromises = racesRes.results.map(r => 
        fetchAPI(`${DND_API}/races/${r.index}/traits`).then(res => ({ raceName: r.name, traits: res?.results || [] }))
      );
      const raceData = await Promise.all(racePromises);
      raceData.forEach(rd => {
        rd.traits.forEach(t => {
          tempTraits.push({ name: t.name, type: `Racial Trait (${rd.raceName})`, url: t.url });
        });
      });
    }

    if (featsRes && featsRes.results) {
      featsRes.results.forEach(f => {
        tempTraits.push({ name: f.name, type: "Official Feature / Feat", url: f.url });
      });
    }

    const uniqueTraits = [];
    const seen = new Set();
    tempTraits.forEach(t => {
      const id = `${t.name}-${t.type}`;
      if (!seen.has(id)) {
        seen.add(id);
        uniqueTraits.push(t);
      }
    });

    traitCache = uniqueTraits;
  } catch(e) {
    console.log("Trait fetch failed", e);
  }
}

function renderAll() {
  renderAttributesAndSkills();
  renderWeapons();
  renderTraits();
  renderSpells();
  populateFields();
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      character = { ...character, ...parsed };
    } catch (e) {
      console.error("Save error.", e);
    }
  }
}

function saveData() {
  document.querySelectorAll(".data-bind").forEach(el => {
    if (el.id) {
      character.meta[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
  
  const indicator = document.getElementById("save-indicator");
  indicator.textContent = "Saved!";
  setTimeout(() => indicator.textContent = "", 2000);
}

function populateFields() {
  document.querySelectorAll(".data-bind").forEach(el => {
    if (character.meta[el.id] !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = character.meta[el.id];
      } else {
        el.value = character.meta[el.id];
      }
    }
  });
}

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("data-bind")) {
    saveData();
    if (["char-level", "ac"].includes(e.target.id) || e.target.id.startsWith("attr-") || e.target.classList.contains("prof-check")) {
      renderAttributesAndSkills();
    }
  }
});

function getMod(score) {
  return Math.floor((score - 10) / 2);
}

function getProfBonus() {
  const level = parseInt(character.meta["char-level"]) || 1;
  return Math.ceil(1 + (level / 4));
}

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const SKILLS = [
  { id: "acro", name: "Acrobatics", stat: "DEX" },
  { id: "anim", name: "Animal Handling", stat: "WIS" },
  { id: "arca", name: "Arcana", stat: "INT" },
  { id: "athl", name: "Athletics", stat: "STR" },
  { id: "dece", name: "Deception", stat: "CHA" },
  { id: "hist", name: "History", stat: "INT" },
  { id: "insi", name: "Insight", stat: "WIS" },
  { id: "inti", name: "Intimidation", stat: "CHA" },
  { id: "inve", name: "Investigation", stat: "INT" },
  { id: "medi", name: "Medicine", stat: "WIS" },
  { id: "natu", name: "Nature", stat: "INT" },
  { id: "perc", name: "Perception", stat: "WIS" },
  { id: "perf", name: "Performance", stat: "CHA" },
  { id: "pers", name: "Persuasion", stat: "CHA" },
  { id: "reli", name: "Religion", stat: "INT" },
  { id: "slei", name: "Sleight of Hand", stat: "DEX" },
  { id: "stea", name: "Stealth", stat: "DEX" },
  { id: "surv", name: "Survival", stat: "WIS" }
];

function renderAttributesAndSkills() {
  const prof = getProfBonus();
  document.getElementById("prof-display").textContent = `+${prof}`;

  const attrContainer = document.getElementById("attributes-container");
  attrContainer.innerHTML = "";
  const mods = {};

  STATS.forEach(stat => {
    const fieldId = `attr-${stat.toLowerCase()}`;
    const saveId = `save-${stat.toLowerCase()}`;
    const score = parseInt(character.meta[fieldId]) || 10;
    const mod = getMod(score);
    mods[stat] = mod;
    
    const isProficient = character.meta[saveId] === true || character.meta[saveId] === "true";
    const saveTotal = isProficient ? mod + prof : mod;
    
    attrContainer.innerHTML += `
      <div class="attr-row">
        <span class="attr-name">${stat}</span>
        <input type="number" id="${fieldId}" class="data-bind attr-score" value="${score}" />
        <span class="attr-mod">${mod >= 0 ? '+'+mod : mod}</span>
        <input type="checkbox" id="${saveId}" class="data-bind prof-check" ${isProficient ? "checked" : ""} />
        <span style="font-size:0.8rem; width:50px;">Save: ${saveTotal >= 0 ? '+'+saveTotal : saveTotal}</span>
        <button class="roll-btn" data-roll="1d20+${saveTotal}" data-label="${stat} Save">Roll</button>
      </div>
    `;
  });

  const skillContainer = document.getElementById("skills-container");
  skillContainer.innerHTML = "";
  
  SKILLS.forEach(skill => {
    const profId = `skill-${skill.id}`;
    const isProficient = character.meta[profId] === true || character.meta[profId] === "true";
    const total = mods[skill.stat] + (isProficient ? prof : 0);
    
    skillContainer.innerHTML += `
      <div class="skill-row">
        <input type="checkbox" id="${profId}" class="data-bind prof-check" ${isProficient ? "checked" : ""} />
        <span class="skill-name">${skill.name} <small>(${skill.stat})</small></span>
        <span class="skill-total">${total >= 0 ? '+'+total : total}</span>
        <button class="roll-btn" data-roll="1d20+${total}" data-label="${skill.name}">Roll</button>
      </div>
    `;
  });
}

function renderWeapons() {
  const container = document.getElementById("weapons-list");
  container.innerHTML = "";
  character.weapons.forEach((wpn, index) => {
    container.innerHTML += `
      <div class="weapon-row">
        <input type="text" value="${wpn.name}" oninput="updateWeapon(${index}, 'name', this.value)" placeholder="Sword" />
        <input type="text" value="${wpn.atk}" oninput="updateWeapon(${index}, 'atk', this.value)" placeholder="+5" />
        <input type="text" value="${wpn.dmg}" oninput="updateWeapon(${index}, 'dmg', this.value)" placeholder="1d8+3" />
        <input type="text" value="${wpn.notes}" oninput="updateWeapon(${index}, 'notes', this.value)" placeholder="Slashing" />
        <button class="delete-btn" onclick="deleteWeapon(${index})">&times;</button>
      </div>
    `;
  });
}

window.updateWeapon = function(index, field, value) {
  character.weapons[index][field] = value;
  saveData();
};

window.deleteWeapon = function(index) {
  character.weapons.splice(index, 1);
  saveData();
  renderWeapons();
};

document.getElementById("btn-add-weapon").addEventListener("click", () => {
  character.weapons.push({ id: Date.now(), name: "", atk: "", dmg: "", notes: "" });
  saveData();
  renderWeapons();
});

function renderTraits() {
  const grid = document.getElementById("traits-grid");
  grid.innerHTML = "";
  character.traits.forEach((trait, index) => {
    grid.innerHTML += `
      <div class="data-card trait-card" draggable="true" data-index="${index}" data-context="traits" onclick="this.classList.toggle('expanded')">
        <div class="card-header">
          <span class="drag-handle">⋮⋮</span>
          <input type="text" class="card-title-input" value="${trait.name}" onclick="event.stopPropagation()" oninput="updateItem('traits', ${index}, 'name', this.value)" placeholder="Ability Name"/>
          <button class="delete-btn" onclick="event.stopPropagation(); deleteItem('traits', ${index})">&times;</button>
        </div>
        <input type="text" class="card-meta-input" value="${trait.type}" onclick="event.stopPropagation()" oninput="updateItem('traits', ${index}, 'type', this.value)" placeholder="Type"/>
        <textarea class="card-desc-input" onclick="event.stopPropagation()" oninput="updateItem('traits', ${index}, 'desc', this.value)" placeholder="Description...">${trait.desc}</textarea>
      </div>
    `;
  });
  attachDragEvents();
}

function renderSpells() {
  const grid = document.getElementById("spells-grid");
  grid.innerHTML = "";
  character.spells.forEach((spell, index) => {
    grid.innerHTML += `
      <div class="data-card spell-card" draggable="true" data-index="${index}" data-context="spells" onclick="this.classList.toggle('expanded')">
        <div class="card-header">
          <span class="drag-handle">⋮⋮</span>
          <input type="text" class="card-title-input" value="${spell.name}" onclick="event.stopPropagation()" oninput="updateItem('spells', ${index}, 'name', this.value)" placeholder="Spell Name"/>
          <button class="delete-btn" onclick="event.stopPropagation(); deleteItem('spells', ${index})">&times;</button>
        </div>
        <input type="text" class="card-meta-input" value="${spell.type}" onclick="event.stopPropagation()" oninput="updateItem('spells', ${index}, 'type', this.value)" placeholder="Level & School"/>
        <textarea class="card-desc-input" onclick="event.stopPropagation()" oninput="updateItem('spells', ${index}, 'desc', this.value)" placeholder="Description...">${spell.desc}</textarea>
      </div>
    `;
  });
  attachDragEvents();
}

window.updateItem = function(collection, index, field, value) {
  character[collection][index][field] = value;
  saveData();
};

window.deleteItem = function(collection, index) {
  character[collection].splice(index, 1);
  saveData();
  if (collection === 'traits') renderTraits();
  if (collection === 'spells') renderSpells();
};

document.getElementById("btn-add-custom-trait").addEventListener("click", () => {
  character.traits.push({ id: Date.now(), name: "", type: "", desc: "" });
  saveData();
  renderTraits();
});

document.getElementById("btn-add-custom-spell").addEventListener("click", () => {
  character.spells.push({ id: Date.now(), name: "", type: "", desc: "" });
  saveData();
  renderSpells();
});

function attachDragEvents() {
  const cards = document.querySelectorAll(".data-card");
  cards.forEach(card => {
    card.addEventListener("dragstart", (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        return;
      }
      draggedItemIndex = parseInt(card.dataset.index, 10);
      currentDragContext = card.dataset.context;
      e.dataTransfer.effectAllowed = "move";
      card.style.opacity = "0.5";
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
      document.querySelectorAll(".data-card").forEach(c => c.style.border = "");
      draggedItemIndex = null;
      currentDragContext = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (card.dataset.context === currentDragContext) {
        card.style.border = "1px solid #dc2626";
      }
    });

    card.addEventListener("dragleave", () => {
      card.style.border = "";
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.style.border = "";
      if (draggedItemIndex === null || card.dataset.context !== currentDragContext) return;
      
      const targetIndex = parseInt(card.dataset.index, 10);
      if (draggedItemIndex === targetIndex) return;

      const collection = currentDragContext;
      const movedItem = character[collection].splice(draggedItemIndex, 1)[0];
      character[collection].splice(targetIndex, 0, movedItem);
      
      saveData();
      if (collection === 'traits') renderTraits();
      if (collection === 'spells') renderSpells();
    });
  });
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roll-btn")) {
    const rollData = e.target.dataset.roll;
    const label = e.target.dataset.label;
    executeRoll(20, parseInt(rollData.split('+')[1] || rollData.split('-')[1] * -1 || 0), label);
  }
  if (e.target.classList.contains("die-btn")) {
    const sides = parseInt(e.target.dataset.die);
    executeRoll(sides, 0, `d${sides}`);
  }
});

function executeRoll(sides, modifier, label) {
  const roll = Math.floor(Math.random() * sides) + 1;
  const total = roll + modifier;
  const modStr = modifier === 0 ? "" : (modifier > 0 ? `+${modifier}` : modifier);
  
  const history = document.getElementById("dice-history");
  if (history.querySelector(".empty-text")) history.innerHTML = "";
  
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span>${label} (${roll}${modStr})</span> <span class="log-result">${total}</span>`;
  
  history.prepend(entry);
  if (history.children.length > 25) history.removeChild(history.lastChild);
}

const classInput = document.getElementById("char-class");
let allClassesCache = [];
const raceInput = document.getElementById("char-race");
let allRacesCache = [];

async function setupClassRaceSearch() {
  classInput.addEventListener("focus", async () => {
    if(!allClassesCache.length) {
      const data = await fetchAPI("https://www.dnd5eapi.co/api/classes");
      if(data) allClassesCache = data.results;
    }
    showApiDropdown("class-dropdown", allClassesCache, classInput.value, (item) => {
      classInput.value = item.name;
      document.getElementById("class-dropdown").classList.remove("show");
      saveData();
    });
  });

  raceInput.addEventListener("focus", async () => {
    if(!allRacesCache.length) {
      const data = await fetchAPI("https://www.dnd5eapi.co/api/races");
      if(data) allRacesCache = data.results;
    }
    showApiDropdown("race-dropdown", allRacesCache, raceInput.value, (item) => {
      raceInput.value = item.name;
      document.getElementById("race-dropdown").classList.remove("show");
      saveData();
    });
  });

  classInput.addEventListener("input", () => showApiDropdown("class-dropdown", allClassesCache, classInput.value));
  raceInput.addEventListener("input", () => showApiDropdown("race-dropdown", allRacesCache, raceInput.value));
}

function showApiDropdown(dropdownId, list, filter, onClick) {
  const drop = document.getElementById(dropdownId);
  drop.innerHTML = "";
  const filtered = list.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));
  
  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "api-item";
    div.textContent = item.name;
    if(onClick) div.onclick = () => onClick(item);
    drop.appendChild(div);
  });
  drop.classList.add("show");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".api-search-wrapper")) {
    document.querySelectorAll(".api-dropdown").forEach(d => d.classList.remove("show"));
  }
});

const modal = document.getElementById("api-modal");
let currentModalContext = "";

document.getElementById("btn-open-spell-modal").addEventListener("click", async () => {
  openModal("Search All Spells", "spells");
  if(spellCache.length === 0) {
    document.getElementById("modal-results").innerHTML = "<p>Loading massive spell library...</p>";
    await spellCachePromise;
  }
  renderModalList(spellCache);
});

document.getElementById("btn-open-trait-modal").addEventListener("click", async () => {
  openModal("Search Official Features & Feats", "traits");
  if(traitCache.length === 0) {
    document.getElementById("modal-results").innerHTML = "<p>Loading abilities library...</p>";
    await traitCachePromise;
  }
  renderModalList(traitCache);
});

function openModal(title, context) {
  currentModalContext = context;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-search").value = "";
  document.getElementById("modal-results").innerHTML = "<p>Loading data...</p>";
  modal.classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", () => modal.classList.add("hidden"));

document.getElementById("modal-search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const list = currentModalContext === "spells" ? spellCache : traitCache;
  const filtered = list.filter(i => i.name.toLowerCase().includes(q));
  renderModalList(filtered);
});

function renderModalList(list) {
  const container = document.getElementById("modal-results");
  container.innerHTML = "";
  
  const displayList = list.slice(0, 100); 
  
  displayList.forEach(item => {
    const div = document.createElement("div");
    div.className = "modal-list-item";
    div.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        ${item.type ? `<span class="modal-list-desc">${item.type}</span>` : ''}
      </div>
      <button class="modal-add-btn">+ Add</button>
    `;
    div.onclick = () => handleModalAdd(item);
    container.appendChild(div);
  });
  
  if(list.length > 100) {
    const p = document.createElement("p");
    p.textContent = `...and ${list.length - 100} more. Keep typing to filter.`;
    p.style.textAlign = "center";
    p.style.color = "#94a3b8";
    p.style.marginTop = "1rem";
    container.appendChild(p);
  }
}

async function handleModalAdd(item) {
  if (currentModalContext === "spells") {
    let finalDesc = item.desc || "";
    if (item.url && !finalDesc) {
      const detail = await fetchAPI(DND_API + item.url.replace("/api", ""));
      if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n") : detail.desc;
    }
    
    character.spells.push({
      id: Date.now(),
      name: item.name,
      type: item.type,
      desc: finalDesc
    });
    renderSpells();
  } else {
    let finalDesc = "Description not available.";
    if (item.url) {
      const detail = await fetchAPI(DND_API + item.url.replace("/api", ""));
      if (detail) finalDesc = Array.isArray(detail.desc) ? detail.desc.join("\n") : detail.desc;
    }
    character.traits.push({
      id: Date.now(),
      name: item.name,
      type: item.type,
      desc: finalDesc
    });
    renderTraits();
  }
  saveData();
  modal.classList.add("hidden");
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function setupAutoExpand() {
  document.querySelectorAll(".auto-expand").forEach(ta => {
    ta.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  });
}

function setupStaticListeners() {
  setupClassRaceSearch();
  
  document.getElementById("btn-save").addEventListener("click", saveData);
  
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("Wipe all data? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    saveData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(character));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = "character_backup.json";
    a.click();
  });

  document.getElementById("file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        character = parsed;
        saveData();
        renderAll();
      } catch (err) {
        alert("Invalid file format.");
      }
    };
    reader.readAsText(file);
  });
}
