/*
 * columnar.js - Row/column (columnar) transposition cipher.
 *
 * Write the message row by row under a keyword, then read the columns in
 * the alphabetical order of the keyword's letters.
 *
 *   key  :  Z E B R A S        reading order of columns:
 *   rank :  6 3 2 4 1 5        A(col 4) B(2) E(1) R(3) S(5) Z(0)
 *           W E A R E D
 *           I S C O V E  ...
 *
 * Equal letters are ranked left to right (key "BALL": B=2 A=1 L=3 L=4).
 * Padding: with a pad character the last row is filled (regular grid);
 * without it the last row stays short (irregular grid).
 */
(function (root) {
  "use strict";

  function checkKey(key) {
    if (typeof key !== "string" || Array.from(key.trim()).length < 2) {
      throw new RangeError("Keyword must have at least 2 characters");
    }
  }

  /* order[i] = index of the column that is read i-th */
  function keyOrder(key) {
    checkKey(key);
    const letters = Array.from(key.trim().toUpperCase());
    const cols = letters.map((_, i) => i);
    cols.sort((a, b) => {
      if (letters[a] === letters[b]) return a - b;  // tie: left to right
      return letters[a] < letters[b] ? -1 : 1;
    });
    return cols;
  }

  /* rank[col] = 1-based position of that column in the reading order */
  function keyRank(key) {
    const order = keyOrder(key);
    const rank = new Array(order.length);
    order.forEach((col, i) => { rank[col] = i + 1; });
    return rank;
  }

  function padTo(chars, k, pad) {
    const out = chars.slice();
    if (pad) while (out.length % k !== 0) out.push(pad);
    return out;
  }

  /* Length of every column when n characters are written into k columns */
  function columnLengths(n, k) {
    const rows = Math.ceil(n / k);
    const longCols = n % k === 0 ? k : n % k;  // these get the extra row
    return Array.from({ length: k },
                      (_, c) => (c < longCols ? rows : rows - 1));
  }

  function encryptWithOrder(chars, order) {
    const k = order.length;
    const out = [];
    for (const col of order) {
      for (let i = col; i < chars.length; i += k) out.push(chars[i]);
    }
    return out.join("");
  }

  function encrypt(text, key, pad = "") {
    const order = keyOrder(key);
    return encryptWithOrder(padTo(Array.from(text), order.length, pad), order);
  }

  /* Decryption only needs the reading order, so the brute-force attack in
   * analysis.js can call it with every possible order. */
  function decryptWithOrder(cipher, order) {
    const chars = Array.from(cipher);
    const k = order.length;
    const lengths = columnLengths(chars.length, k);
    const columns = new Array(k);
    let pos = 0;
    for (const col of order) {            // fill columns in key order
      columns[col] = chars.slice(pos, pos + lengths[col]);
      pos += lengths[col];
    }
    const out = [];
    for (let r = 0; r < lengths[0]; r++) {           // read row by row
      for (let c = 0; c < k; c++) {
        if (r < lengths[c]) out.push(columns[c][r]);
      }
    }
    return out.join("");
  }

  function decrypt(cipher, key, pad = "") {
    let plain = decryptWithOrder(cipher, keyOrder(key));
    if (pad) {                                       // remove at most k-1 pad chars
      const k = Array.from(key.trim()).length;
      let removed = 0;
      while (removed < k - 1 && plain.endsWith(pad)) {
        plain = plain.slice(0, -pad.length);
        removed++;
      }
    }
    return plain;
  }

  /* ---------- traces for the animation ---------------------------------
   *   "write" : plaintext char into (row, col)     (encrypt)
   *   "pad"   : padding char into (row, col)       (encrypt)
   *   "fill"  : ciphertext char into (row, col)    (decrypt, column by column)
   *   "read"  : char from (row, col) to the output
   */
  function encryptTrace(text, key, pad = "") {
    const order = keyOrder(key);
    const k = order.length;
    const original = Array.from(text);
    const chars = padTo(original, k, pad);
    const steps = chars.map((ch, i) => ({
      phase: i < original.length ? "write" : "pad",
      row: Math.floor(i / k), col: i % k, ch,
    }));
    for (const col of order) {
      for (let i = col; i < chars.length; i += k) {
        steps.push({ phase: "read", row: Math.floor(i / k), col, ch: chars[i] });
      }
    }
    return { key: Array.from(key.trim().toUpperCase()), rank: keyRank(key),
             rows: Math.ceil(chars.length / k), steps, output: encryptWithOrder(chars, order) };
  }

  function decryptTrace(cipher, key, pad = "") {
    const order = keyOrder(key);
    const k = order.length;
    const chars = Array.from(cipher);
    const lengths = columnLengths(chars.length, k);
    const steps = [];
    const grid = [];
    let pos = 0;
    for (const col of order) {
      for (let r = 0; r < lengths[col]; r++) {
        (grid[r] = grid[r] || [])[col] = chars[pos];
        steps.push({ phase: "fill", row: r, col, ch: chars[pos++] });
      }
    }
    for (let r = 0; r < lengths[0]; r++) {
      for (let c = 0; c < k; c++) {
        if (r < lengths[c]) steps.push({ phase: "read", row: r, col: c, ch: grid[r][c] });
      }
    }
    return { key: Array.from(key.trim().toUpperCase()), rank: keyRank(key),
             rows: lengths[0], steps, output: decrypt(cipher, key, pad) };
  }

  const api = { keyOrder, keyRank, columnLengths, encrypt, decrypt,
                encryptWithOrder, decryptWithOrder, encryptTrace, decryptTrace };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Columnar = api;
})(this);
