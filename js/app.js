/*
 * app.js - connects the page to the cipher modules.
 *
 * Flow: the form builds a "trace" (list of steps) with RailFence or Columnar.
 * The player keeps a step counter `index`; render() rebuilds the picture of
 * the grid after `index` steps, so Back and Next work the same way.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TILE = 38, GAP = 4;          // must match --tile and the grid gap in CSS
  const MAX_LEN = 150;               // keeps the grid readable

  const state = {
    view: "rail",                    // "rail" | "col" | "ana"
    mode: "encrypt",
    trace: null,
    index: 0,                        // number of steps already shown
    timer: null,
    cells: [],                       // cells[row][col] -> <div>
    keyCells: [],                    // columnar header cells
    lastOutput: "",
  };

  /* ------------------------------------------------------------ input */
  function cleanText(text) {
    return $("clean").checked ? text.toUpperCase().replace(/[^A-Z0-9]/g, "") : text;
  }

  function buildTrace() {
    const text = cleanText($("text").value);
    if (!text.length) throw new Error("Type a message first.");
    if (Array.from(text).length > MAX_LEN) {
      throw new Error(`Use at most ${MAX_LEN} characters so the grid stays readable.`);
    }
    const enc = state.mode === "encrypt";
    if (state.view === "rail") {
      const rails = Number($("rails").value);
      if (!Number.isInteger(rails) || rails < 2 || rails > 12) {
        throw new Error("Choose between 2 and 12 rails.");
      }
      return enc ? RailFence.encryptTrace(text, rails) : RailFence.decryptTrace(text, rails);
    }
    const key = $("keyword").value.trim();
    if (Array.from(key).length < 2) throw new Error("The keyword needs at least 2 letters.");
    const pad = $("pad").value;
    return enc ? Columnar.encryptTrace(text, key, pad) : Columnar.decryptTrace(text, key, pad);
  }

  /* ------------------------------------------------------------ board */
  function buildBoard() {
    const board = $("board");
    board.textContent = "";
    state.cells = [];
    state.keyCells = [];
    const t = state.trace;
    const grid = document.createElement("div");
    grid.className = "grid";

    if (state.view === "rail") {
      grid.style.gridTemplateColumns = `repeat(${t.width}, ${TILE}px)`;
      for (let r = 0; r < t.rails; r++) {
        state.cells.push([]);
        for (let c = 0; c < t.width; c++) {
          const cell = document.createElement("div");
          grid.appendChild(cell);
          state.cells[r].push(cell);
        }
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "thread");
      svg.setAttribute("width", t.width * (TILE + GAP));
      svg.setAttribute("height", t.rails * (TILE + GAP));
      svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "polyline"));
      board.appendChild(svg);
    } else {
      const k = t.key.length;
      grid.style.gridTemplateColumns = `repeat(${k}, ${TILE}px)`;
      t.key.forEach((letter, c) => {               // header: key letter + rank
        const head = document.createElement("div");
        head.className = "keycell";
        head.textContent = letter;
        const small = document.createElement("small");
        small.textContent = t.rank[c];
        head.appendChild(small);
        grid.appendChild(head);
        state.keyCells.push(head);
      });
      for (let r = 0; r < t.rows; r++) {
        state.cells.push([]);
        for (let c = 0; c < k; c++) {
          const cell = document.createElement("div");
          grid.appendChild(cell);
          state.cells[r].push(cell);
        }
      }
    }
    board.appendChild(grid);
  }

  /* Picture of the grid after `index` steps */
  function render() {
    const t = state.trace;
    if (!t) return;
    const used = new Set(t.steps.map((s) => s.row + "," + s.col));
    const isCol = state.view === "col";
    const model = state.cells.map((row, r) => row.map((_, c) => ({
      ch: "",
      kind: isCol && used.has(r + "," + c) ? "slot" : "unused",
    })));
    let output = "";
    for (let i = 0; i < state.index; i++) {
      const s = t.steps[i];
      const cell = model[s.row][s.col];
      if (s.phase === "write" || s.phase === "fill") {
        cell.ch = s.ch; cell.kind = "letter";
      } else if (s.phase === "pad") {
        cell.ch = s.ch; cell.kind = "letter padding";
      } else if (s.phase === "mark") {
        cell.kind = "slot";
      } else if (s.phase === "read") {
        cell.kind = cell.kind.replace("letter", "letter read");
        output += s.ch;
      }
    }
    const current = state.index > 0 ? t.steps[state.index - 1] : null;

    model.forEach((row, r) => row.forEach((m, c) => {
      const el = state.cells[r][c];
      const isCurrent = current && current.row === r && current.col === c;
      el.className = "cell " + m.kind + (isCurrent ? " current" : "");
      el.textContent = m.ch;
    }));

    if (state.view === "rail") {      // zig-zag line through used cells
      const points = [];
      for (let c = 0; c < t.width; c++) {
        for (let r = 0; r < t.rails; r++) {
          if (model[r][c].kind !== "unused") {
            const x = c * (TILE + GAP) + TILE / 2;
            const y = r * (TILE + GAP) + TILE / 2;
            points.push(`${x},${y}`);
          }
        }
      }
      const line = $("board").querySelector("polyline");
      line.setAttribute("points", points.join(" "));
    } else {
      state.keyCells.forEach((el, c) => {
        const active = !!current && current.col === c &&
          (current.phase === "read" || current.phase === "fill");
        el.classList.toggle("reading", active);
      });
    }

    const done = state.index === t.steps.length;
    const removed = done
      ? Array.from(output).length - Array.from(t.output).length : 0;
    // the final result has the padding removed
    $("tape").textContent = done ? t.output : output;
    $("counter").textContent = `${state.index} / ${t.steps.length}`;
    $("narration").textContent = narrate(current, done, removed);
    $("btn-play").textContent = state.timer ? "Pause" : "Play";
  }

  function narrate(s, done, removed) {
    if (!s) return "Press Play or Next to start.";
    const q = `“${s.ch}”`;
    let text;
    if (state.view === "rail") {
      const where = `rail ${s.row + 1}, column ${s.col + 1}`;
      text = {
        write: `Writing ${q} on ${where}, following the zig-zag.`,
        mark: `Marking the zig-zag cell on ${where}.`,
        fill: `Filling rail ${s.row + 1} from left to right: ${q} goes to column ${s.col + 1}.`,
        read: state.mode === "encrypt"
          ? `Reading rail ${s.row + 1} from left to right: ${q}.`
          : `Reading along the zig-zag: ${q}.`,
      }[s.phase];
    } else {
      const t = state.trace;
      const col = `column ${t.key[s.col]} (rank ${t.rank[s.col]})`;
      text = {
        write: `Writing ${q} in row ${s.row + 1} under ${t.key[s.col]}.`,
        pad: `Last row is short, padding with ${q}.`,
        fill: `Filling ${col} from top to bottom: ${q}.`,
        read: state.mode === "encrypt"
          ? `Reading ${col} from top to bottom: ${q}.`
          : `Reading row ${s.row + 1} from left to right: ${q}.`,
      }[s.phase];
    }
    if (!done) return text;
    const tail = removed > 0 ? ` The ${removed} padding character${removed > 1 ? "s were" : " was"} removed.` : "";
    return `Done. ${state.mode === "encrypt" ? "Ciphertext" : "Plaintext"} is ready below.${tail}`;
  }

  /* ------------------------------------------------------------ player */
  function delay() { return 760 - Number($("speed").value) * 70; }   // 690 ms .. 60 ms

  function stop() { clearInterval(state.timer); state.timer = null; }

  function play() {
    if (!state.trace) return;
    if (state.index >= state.trace.steps.length) state.index = 0;
    state.timer = setInterval(() => {
      if (state.index >= state.trace.steps.length) { stop(); render(); return; }
      state.index++;
      render();
    }, delay());
    render();
  }

  function go(index) {
    if (!state.trace) return;
    stop();
    state.index = Math.max(0, Math.min(index, state.trace.steps.length));
    render();
  }

  /* ------------------------------------------------------------ events */
  function start(event) {
    if (event) event.preventDefault();
    stop();
    $("error").textContent = "";
    try {
      state.trace = buildTrace();
    } catch (err) {
      $("error").textContent = err.message;
      return;
    }
    state.lastOutput = state.trace.output;
    state.index = 0;
    buildBoard();
    render();
    play();
  }

  function setView(view) {
    stop();
    state.view = view;
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.view === view));
    });
    $("cipher-view").hidden = view === "ana";
    $("analysis-view").hidden = view !== "ana";
    $("rail-key").hidden = view !== "rail";
    $("col-key").hidden = view !== "col";
    state.trace = null;
    $("board").textContent = "";
    $("tape").textContent = "";
    $("counter").textContent = "0 / 0";
    $("narration").textContent = "Enter a message and press “Show the steps”.";
    if (view === "ana" && !$("freq-chart").childNodes.length) runAnalysis();
  }

  function setMode(mode) {
    state.mode = mode;
    $("text-label").textContent = mode === "encrypt" ? "Plaintext" : "Ciphertext";
    $("tape-label").textContent = mode === "encrypt" ? "Ciphertext" : "Plaintext";
    if (state.lastOutput) $("text").value = state.lastOutput;  // try the reverse direction
  }

  $("controls").addEventListener("submit", start);
  document.querySelectorAll("input[name=mode]").forEach((r) =>
    r.addEventListener("change", () => setMode(r.value)));
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.view)));
  $("btn-play").addEventListener("click", () => (state.timer ? (stop(), render()) : play()));
  $("btn-next").addEventListener("click", () => go(state.index + 1));
  $("btn-back").addEventListener("click", () => go(state.index - 1));
  $("btn-reset").addEventListener("click", () => go(0));
  $("btn-end").addEventListener("click", () => go(Infinity));
  $("speed").addEventListener("input", () => { if (state.timer) { stop(); play(); } });
  $("copy").addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText($("tape").textContent);
  });
  document.addEventListener("keydown", (e) => {
    if (state.view === "ana" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const keys = { ArrowRight: () => go(state.index + 1), ArrowLeft: () => go(state.index - 1),
                   Home: () => go(0), End: () => go(Infinity),
                   " ": () => (state.timer ? (stop(), render()) : play()) };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  /* ------------------------------------------------------------ analysis view */
  function frequencyChart(plain, cipher) {
    const ns = "http://www.w3.org/2000/svg";
    const fp = Analysis.letterFrequencies(plain), fc = Analysis.letterFrequencies(cipher);
    const max = Math.max(1, ...Object.values(fp));
    const W = 26 * 32, H = 170, base = 140;
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Letter counts of plaintext and ciphertext, side by side");
    Object.keys(fp).forEach((letter, i) => {
      [[fp[letter], "#eef2ec", 6], [fc[letter], "#f2b544", 17]].forEach(([v, color, dx]) => {
        const h = (v / max) * 120;
        const bar = document.createElementNS(ns, "rect");
        bar.setAttribute("x", i * 32 + dx); bar.setAttribute("y", base - h);
        bar.setAttribute("width", 10); bar.setAttribute("height", h);
        bar.setAttribute("fill", color);
        svg.appendChild(bar);
      });
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", i * 32 + 16); label.setAttribute("y", base + 20);
      label.setAttribute("text-anchor", "middle");
      label.textContent = letter;
      svg.appendChild(label);
    });
    return svg;
  }

  function fillTable(table, headers, rows, bestIndex) {
    table.textContent = "";
    const head = table.insertRow();
    headers.forEach((h) => { const th = document.createElement("th"); th.textContent = h; head.appendChild(th); });
    rows.forEach((cells, i) => {
      const tr = table.insertRow();
      if (i === bestIndex) tr.className = "best";
      cells.forEach((v, j) => {
        const td = tr.insertCell();
        td.textContent = v;
        if (j === cells.length - 1) td.className = "text";
      });
    });
  }

  function runAnalysis() {
    $("ana-error").textContent = "";
    const plain = Analysis.lettersOnly($("ana-text").value);
    const rails = Number($("ana-rails").value);
    const key = $("ana-key").value.trim().toUpperCase();
    const maxLen = Number($("ana-max").value);
    if (plain.length < 20) { $("ana-error").textContent = "Use a message of at least 20 letters."; return; }
    if (!(rails >= 2 && rails <= 12)) { $("ana-error").textContent = "Choose 2 to 12 rails."; return; }
    if (key.length < 2 || key.length > 7) { $("ana-error").textContent = "Keyword must be 2 to 7 letters."; return; }

    const railCipher = RailFence.encrypt(plain, rails);
    const colCipher = Columnar.encrypt(plain, key);
    $("freq-chart").textContent = "";
    $("freq-chart").appendChild(frequencyChart(plain, railCipher));
    const same = JSON.stringify(Analysis.letterFrequencies(plain)) ===
                 JSON.stringify(Analysis.letterFrequencies(colCipher));
    $("freq-note").textContent = `White bars: plaintext. Amber bars: rail fence ciphertext ${railCipher.slice(0, 24)}… ` +
      `Every pair has the same height${same ? ", and the columnar ciphertext matches too" : ""}: ` +
      "transposition hides the order of letters, not the letters themselves.";

    let t0 = performance.now();
    const rf = Analysis.bruteForceRail(railCipher);
    let ms = (performance.now() - t0).toFixed(1);
    const rfOk = rf.results[0].text === plain;
    $("rail-note").textContent = `Tried all ${rf.tried} possible keys in ${ms} ms. ` +
      `Best guess: ${rf.results[0].key} rails (${rfOk ? "correct" : "wrong"}). Top 8 by English score:`;
    fillTable($("rail-table"), ["Rails", "Score", "Decrypted text"],
      rf.results.slice(0, 8).map((r) => [r.key, r.score.toFixed(2), r.text.slice(0, 60)]), 0);

    t0 = performance.now();
    const ct = Analysis.bruteForceColumnar(colCipher, maxLen, 5);
    ms = (performance.now() - t0).toFixed(0);
    const ctOk = ct.results[0].text === plain;
    $("col-note").textContent = `Tried ${ct.tried.toLocaleString()} column orders (keys of 2 to ${maxLen} letters) in ${ms} ms. ` +
      (ctOk ? "The best guess is the original message." :
        key.length > maxLen ? `The real key has ${key.length} letters, so allow longer keys.` :
        "The best guess is wrong; a longer message gives the scorer more to work with.");
    fillTable($("col-table"), ["Column reading order", "Score", "Decrypted text"],
      ct.results.map((r) => [r.key, r.score.toFixed(2), r.text.slice(0, 60)]), 0);
  }
  $("ana-run").addEventListener("click", runAnalysis);

  setView("rail");
})();
