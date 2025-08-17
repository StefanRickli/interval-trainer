import { OwnWebSynth, ToneSynthEngine, ToneSamplerEngine } from "./synth.js";

let toneLoaded = false;
async function ensureToneLoaded() {
  if (toneLoaded || window.Tone) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/tone@14.8.49/build/Tone.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  toneLoaded = true;
}

// ---------- Music utils ----------
const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const ENHARMONIC_EQUIV = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};
function midiToName(midi, { showOctave = true, enharmonic = true } = {}) {
  const pcIdx = ((midi % 12) + 12) % 12;
  const base = NOTE_NAMES_SHARP[pcIdx];
  const oct = Math.floor(midi / 12) - 1; // MIDI standard
  if (enharmonic && base.includes("#")) {
    const flat = ENHARMONIC_EQUIV[base];
    return showOctave ? `${base}${oct}/${flat}${oct}` : `${base}/${flat}`;
  }
  return showOctave ? `${base}${oct}` : base;
}
function nameToMidi(name) {
  // Accept forms like C4, C#/Db4, Db3, etc.
  const cleaned = name.trim().toUpperCase().replace(/\s+/g, "");
  // If slash form, take first part
  const first = cleaned.split("/")[0];
  const m = first.match(/^([A-G])([#B]?)(-?\d+)$/);
  if (!m) return null;
  const [_, L, acc, octStr] = m;
  const baseIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[L];
  let semi = baseIndex + (acc === "#" ? 1 : acc === "B" ? -1 : 0);
  const oct = parseInt(octStr, 10);
  return 12 * (oct + 1) + semi;
}

// Intervals in semitones with names
const INTERVALS = [
  { id: "m2", name: "m2", semitones: 1 },
  { id: "M2", name: "M2", semitones: 2 },
  { id: "m3", name: "m3", semitones: 3 },
  { id: "M3", name: "M3", semitones: 4 },
  { id: "P4", name: "P4", semitones: 5 },
  { id: "TT", name: "TT", semitones: 6 }, // tritone
  { id: "P5", name: "P5", semitones: 7 },
  { id: "m6", name: "m6", semitones: 8 },
  { id: "M6", name: "M6", semitones: 9 },
  { id: "m7", name: "m7", semitones: 10 },
  { id: "M7", name: "M7", semitones: 11 },
  { id: "P8", name: "P8", semitones: 12 },
];

// ---------- State & Persistence ----------
const DEFAULTS = {
  rangeMin: "A2", // midi 45
  rangeMax: "E4", // midi 64
  showOctaves: true,
  engine: "tone-sampler",
  pool: [
    "m2",
    "M2",
    "m3",
    "M3",
    "P4",
    "TT",
    "P5",
    "m6",
    "M6",
    "m7",
    "M7",
    "P8",
  ],
};
const LS_KEY = "interval-trainer-settings-v1";

function loadSettings() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const obj = JSON.parse(raw);
    return { ...DEFAULTS, ...obj };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// ---------- Engines ----------
const engines = {
  web: new OwnWebSynth(),
  "tone-synth": new ToneSynthEngine(),
  "tone-sampler": new ToneSamplerEngine(),
};
async function ensureToneStarted() {
  await ensureToneLoaded();
  if (window.Tone && Tone.context.state !== "running") {
    try {
      await Tone.start();
    } catch {}
  }
}

// ---------- UI refs ----------
const prevText = document.getElementById("prev-text");
const targetText = document.getElementById("target-text");
const intervalText = document.getElementById("interval-text");
const btnReveal = document.getElementById("btn-reveal");
const btnNext = document.getElementById("btn-next");
const btnPlayPrev = document.getElementById("btn-play-prev");

const dlg = document.getElementById("settings-dialog");
const btnOpenSettings = document.getElementById("open-settings");
const poolBox = document.getElementById("interval-pool");
const rangeMinInput = document.getElementById("range-min");
const rangeMaxInput = document.getElementById("range-max");
const showOctavesInput = document.getElementById("show-octaves");
const engineStatus = document.getElementById("engine-status");

// dynamic generated radio NodeList later
let engineRadios;

// ---------- Card generation ----------
let settings = loadSettings();
let current = {
  prevMidi: null,
  targetMidi: null,
  intervalId: null,
  up: true,
  revealed: false,
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randint(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function getRangeMidi() {
  const lo = nameToMidi(settings.rangeMin);
  const hi = nameToMidi(settings.rangeMax);
  if (lo === null || hi === null || lo > hi) {
    // fall back safely
    return [nameToMidi(DEFAULTS.rangeMin), nameToMidi(DEFAULTS.rangeMax)];
  }
  return [lo, hi];
}

function drawValidCard() {
  const [lo, hi] = getRangeMidi();
  let base = current.targetMidi;
  if (base === null) {
    base = nameToMidi(settings.rangeMin) + nameToMidi(settings.rangeMax) / 2;
  }
  const pool = INTERVALS.filter((i) => settings.pool.includes(i.id));
  if (pool.length === 0) {
    // enforce at least one (fallback)
    pool.push(INTERVALS.find((i) => i.id === "P5"));
  }
  // Try a number of times to find a valid pair
  for (let tries = 0; tries < 1000; tries++) {
    const itv = randomChoice(pool);
    const up = Math.random() < 0.5;
    const tgt = up ? base + itv.semitones : base - itv.semitones;
    if (tgt >= lo && tgt <= hi) {
      return { prevMidi: base, targetMidi: tgt, intervalId: itv.id, up };
    }
  }
  // As a last resort clamp target within range
  const itv = pool[0];
  const up = true;
  const tgt = Math.min(hi, base + itv.semitones);
  return { prevMidi: base, targetMidi: tgt, intervalId: itv.id, up };
}

function renderCard() {
  prevText.textContent = midiToName(current.prevMidi, {
    showOctave: settings.showOctaves,
  });
  const upArrow = current.up ? "↑" : "↓";
  intervalText.textContent = `${current.intervalId} ${upArrow}`;
  targetText.textContent = midiToName(current.targetMidi, {
    showOctave: settings.showOctaves,
  });
  targetText.classList.toggle("blur", !current.revealed);
}

function newCard() {
  current = { ...drawValidCard(), revealed: false };
  renderCard();
  // Reset reveal button text
  btnReveal.textContent = "Reveal & Play";
}

async function playPrev(ms = 600) {
  await playNote(current.prevMidi, ms);
}

async function revealAndPlay() {
  await ensureToneStarted();
  if (!current.revealed) {
    current.revealed = true;
    renderCard();
  }
  // Play Target Note
  await playNote(current.targetMidi);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Engine selection ----------
function getActiveEngine() {
  const id = settings.engine;
  return engines[id] || engines["web"];
}
async function playNote(midi, ms) {
  const eng = getActiveEngine();
  await eng.init();
  try {
    await eng.playNote(midi, ms);
  } catch (e) {
    console.warn("playNote failed", e);
  }
}

// ---------- Settings UI build ----------
function buildPoolUI() {
  poolBox.innerHTML = "";
  INTERVALS.forEach((itv) => {
    const id = `pool_${itv.id}`;
    const wrap = document.createElement("label");
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" value="${itv.id}">
      <span>${itv.name}</span>
    `;
    poolBox.appendChild(wrap);
  });
}
function setupDatalistFullList(id) {
  const el = document.getElementById(id);
  el.addEventListener("focus", () => {
    el.dataset.prev = el.value; // remember current
    el.value = ""; // clear so the whole list shows
    // On Chromium, open the picker immediately (if supported)
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {}
    }
  });
  // If user didn’t pick anything, put the old value back
  el.addEventListener("blur", () => {
    if (!el.value && el.dataset.prev) el.value = el.dataset.prev;
  });
  // Nice to have: ESC restores and closes
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.dataset.prev) {
      el.value = el.dataset.prev;
      el.blur();
    }
  });
}
function fillNoteDatalist() {
  const dl = document.getElementById("note-list");
  dl.innerHTML = "";
  // Offer from C1..C7
  for (let midi = 24; midi <= 96; midi++) {
    const opt = document.createElement("option");
    opt.value = midiToName(midi, { showOctave: true, enharmonic: false }); // single form
    dl.appendChild(opt);
  }
}
function applySettingsToUI() {
  rangeMinInput.value = settings.rangeMin;
  rangeMaxInput.value = settings.rangeMax;
  showOctavesInput.checked = settings.showOctaves;
  // engine radios
  engineRadios = [...document.querySelectorAll('input[name="engine"]')];
  engineRadios.forEach((r) => (r.checked = r.value === settings.engine));
  // pool
  INTERVALS.forEach((itv) => {
    const cb = document.getElementById(`pool_${itv.id}`);
    cb.checked = settings.pool.includes(itv.id);
  });
  updateEngineStatus();
}
function readSettingsFromUI() {
  const pool = INTERVALS.map((i) => i.id).filter(
    (id) => document.getElementById(`pool_${id}`).checked
  );
  settings = {
    ...settings,
    rangeMin: rangeMinInput.value || DEFAULTS.rangeMin,
    rangeMax: rangeMaxInput.value || DEFAULTS.rangeMax,
    showOctaves: showOctavesInput.checked,
    engine: engineRadios.find((r) => r.checked)?.value || DEFAULTS.engine,
    pool: pool.length ? pool : DEFAULTS.pool,
  };
}

function updateEngineStatus() {
  const eng = getActiveEngine();
  let name =
    {
      web: "OwnWebSynth",
      "tone-synth": "Tone Synth",
      "tone-sampler": "Tone Sampler",
    }[settings.engine] || "Unknown";
  let extra = "";
  if (settings.engine.startsWith("tone")) {
    if (window.Tone) {
      extra = ` | Tone ctx: ${Tone.context.state}`;
      if (settings.engine === "tone-sampler") {
        extra += ` | samples: ${eng.loaded ? "loaded" : "loading…"}`;
      }
    } else {
      extra = " | Tone.js not available";
    }
  }
  engineStatus.textContent = `Engine: ${name}${extra}`;
}

// ---------- Event wiring ----------
btnOpenSettings.addEventListener("click", () => {
  if (typeof dlg.showModal === "function") {
    dlg.showModal();
  } else {
    alert("Your browser doesn't support <dialog>. Use a modern browser.");
  }
});

document.getElementById("save-settings").addEventListener("click", (ev) => {
  ev.preventDefault();
  readSettingsFromUI();
  saveSettings(settings);
  updateEngineStatus();
  dlg.close();
  // make sure the new range/pool applies immediately
  newCard();
});

btnNext.addEventListener("click", () => {
  newCard();
});

btnPlayPrev.addEventListener("click", async () => {
  await ensureToneStarted();
  await playPrev();
});

btnReveal.addEventListener("click", async () => {
  await ensureToneStarted();
  // First click reveals + plays; subsequent clicks replay
  await revealAndPlay();
  btnReveal.textContent = "Replay";
});

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  // Avoid typing in inputs triggering shortcuts
  const tag =
    e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
  if (tag === "input" || tag === "textarea") return;

  if (e.code === "Space") {
    e.preventDefault();
    btnReveal.click();
  } else if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    btnNext.click();
  } else if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    btnPlayPrev.click();
  }
});

// ---------- Boot ----------
function initPoolChecks() {
  buildPoolUI();
}
function init() {
  initPoolChecks();
  fillNoteDatalist();
  applySettingsToUI();
  newCard();
}
document.addEventListener("DOMContentLoaded", init);
setupDatalistFullList("range-min");
setupDatalistFullList("range-max");
