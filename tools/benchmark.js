/*
 * benchmark.js - how long a brute-force attack takes as the key grows.
 * Run:  node tools/benchmark.js
 */
"use strict";
const RailFence = require("../js/railfence.js");
const Columnar = require("../js/columnar.js");
const Analysis = require("../js/analysis.js");

const MSG = Analysis.lettersOnly(
  "THE SECRET MEETING WILL TAKE PLACE AT THE OLD LIBRARY NEAR THE RIVER ON FRIDAY EVENING");
const KEYS = { 2: "GO", 3: "CAT", 4: "LION", 5: "TIGER", 6: "JAGUAR", 7: "PANTHER", 8: "ELEPHANT" };

function timeIt(fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  return { result, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

console.log(`Message: ${MSG.length} letters\n`);
console.log("Columnar transposition - try every column order up to the real key length");
console.log("key  letters  orders (k!)  total tried   time (ms)  found?");
const rows = [];
for (let k = 2; k <= 8; k++) {
  const cipher = Columnar.encrypt(MSG, KEYS[k]);
  const { result, ms } = timeIt(() => Analysis.bruteForceColumnar(cipher, k, 1));
  const found = result.results[0].text === MSG;
  let fact = 1; for (let i = 2; i <= k; i++) fact *= i;
  rows.push([k, fact, result.tried, ms]);
  console.log(`${KEYS[k].padEnd(9)}${String(k).padStart(2)}  ${String(fact).padStart(11)}` +
              `  ${String(result.tried).padStart(11)}  ${ms.toFixed(1).padStart(10)}  ${found ? "yes" : "no"}`);
}

console.log("\nRail fence - try every number of rails");
console.log("letters  keys tried  time (ms)  found?");
for (const n of [50, 100, 200, 400, 800]) {
  const text = MSG.repeat(Math.ceil(n / MSG.length)).slice(0, n);
  const cipher = RailFence.encrypt(text, 7);
  const { result, ms } = timeIt(() => Analysis.bruteForceRail(cipher));
  console.log(`${String(n).padStart(7)}  ${String(result.tried).padStart(10)}  ${ms.toFixed(1).padStart(9)}` +
              `  ${result.results[0].key === 7 ? "yes" : "no"}`);
}
console.log("\nEach extra keyword letter multiplies the work: 8 letters = 40,320 orders.");
