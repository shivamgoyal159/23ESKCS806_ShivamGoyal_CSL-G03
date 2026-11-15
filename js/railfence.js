/*
 * railfence.js - Rail Fence cipher: encrypt, decrypt and step-by-step traces
 * for the animation.
 *
 * Project : Rail Fence & Columnar Transposition Visualizer   [CSL-G03]
 * Author  : Shivam Goyal (23ESKCS806)
 *
 * Idea: write the message in a zig-zag over R rails (rows), then read the
 * rails one after another. Example with 3 rails, "WEAREDISCOVERED":
 *
 *   W . . . E . . . C . . . R . .
 *   . E . R . D . S . O . E . E .
 *   . . A . . . I . . . V . . . D
 *
 *   ciphertext = WECR + ERDSOEE + AIVD
 */
(function (root) {
  "use strict";

  function checkRails(rails) {
    if (!Number.isInteger(rails) || rails < 2) {
      throw new RangeError("Number of rails must be a whole number of 2 or more");
    }
  }

  /* Row (rail) used by each character position.
   * The pattern repeats every 2*(R-1) characters: R-1 down, R-1 up. */
  function railPattern(length, rails) {
    checkRails(rails);
    const cycle = 2 * (rails - 1);
    const rows = [];
    for (let i = 0; i < length; i++) {
      const p = i % cycle;
      rows.push(p < rails ? p : cycle - p);
    }
    return rows;
  }

  function encrypt(text, rails) {
    const chars = Array.from(text);          // handles any Unicode character
    const rows = railPattern(chars.length, rails);
    const lines = Array.from({ length: rails }, () => []);
    chars.forEach((ch, i) => lines[rows[i]].push(ch));
    return lines.map((line) => line.join("")).join("");
  }

  function decrypt(cipher, rails) {
    const chars = Array.from(cipher);
    const rows = railPattern(chars.length, rails);

    // 1. how many letters sit on each rail
    const counts = new Array(rails).fill(0);
    rows.forEach((r) => counts[r]++);

    // 2. cut the ciphertext into rails of those lengths
    const railText = [];
    let pos = 0;
    for (let r = 0; r < rails; r++) {
      railText.push(chars.slice(pos, pos + counts[r]));
      pos += counts[r];
    }

    // 3. walk the zig-zag again, taking the next letter from each rail
    const next = new Array(rails).fill(0);
    return rows.map((r) => railText[r][next[r]++]).join("");
  }

  /* ---------- traces for the animation ----------------------------------
   * A trace is a list of small steps. The UI replays them one at a time.
   *   phase "write" : put a character into grid cell (row, col)
   *   phase "mark"  : mark a zig-zag cell as used but still empty (decrypt)
   *   phase "fill"  : fill a marked cell with a ciphertext character
   *   phase "read"  : take the character from (row, col) into the output
   */
  function encryptTrace(text, rails) {
    const chars = Array.from(text);
    const rows = railPattern(chars.length, rails);
    const steps = [];
    chars.forEach((ch, col) => steps.push({ phase: "write", row: rows[col], col, ch }));
    for (let r = 0; r < rails; r++) {
      rows.forEach((row, col) => {
        if (row === r) steps.push({ phase: "read", row, col, ch: chars[col] });
      });
    }
    return { rails, width: chars.length, steps, output: encrypt(text, rails) };
  }

  function decryptTrace(cipher, rails) {
    const chars = Array.from(cipher);
    const rows = railPattern(chars.length, rails);
    const steps = [];
    rows.forEach((row, col) => steps.push({ phase: "mark", row, col }));
    // fill rail by rail, left to right, with the ciphertext letters in order
    let k = 0;
    const placed = {};
    for (let r = 0; r < rails; r++) {
      rows.forEach((row, col) => {
        if (row === r) {
          placed[col] = chars[k];
          steps.push({ phase: "fill", row, col, ch: chars[k++] });
        }
      });
    }
    rows.forEach((row, col) => steps.push({ phase: "read", row, col, ch: placed[col] }));
    return { rails, width: chars.length, steps, output: decrypt(cipher, rails) };
  }

  const api = { railPattern, encrypt, decrypt, encryptTrace, decryptTrace };
  if (typeof module !== "undefined" && module.exports) module.exports = api; // Node (tests)
  else root.RailFence = api;                                                  // browser
})(this);
