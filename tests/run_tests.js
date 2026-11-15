/*
 * run_tests.js - test cases for both ciphers and the analysis module.
 * Run:  node tests/run_tests.js        (needs only Node.js, no packages)
 */
"use strict";
const RailFence = require("../js/railfence.js");
const Columnar = require("../js/columnar.js");
const Analysis = require("../js/analysis.js");

const results = [];
function test(id, name, fn) {
  try {
    fn();
    results.push([id, name, "PASS", ""]);
  } catch (err) {
    results.push([id, name, "FAIL", err.message]);
  }
}
function equal(actual, expected) {
  if (actual !== expected) throw new Error(`expected "${expected}", got "${actual}"`);
}
function throws(fn) {
  try { fn(); } catch (e) { return; }
  throw new Error("expected an error");
}

// A small random generator with a fixed seed, so every run is identical.
let seed = 2026;
function rand(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
function randomText(len) {
  const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcxyz0123.,!";
  let s = "";
  for (let i = 0; i < len; i++) s += pool[rand(pool.length)];
  return s;
}

const MSG = "WEAREDISCOVEREDFLEEATONCE";

// ---------------- Rail fence ----------------
test("RF-01", "Known vector, 3 rails", () =>
  equal(RailFence.encrypt(MSG, 3), "WECRLTEERDSOEEFEAOCAIVDEN"));
test("RF-02", "Decrypt known vector, 3 rails", () =>
  equal(RailFence.decrypt("WECRLTEERDSOEEFEAOCAIVDEN", 3), MSG));
test("RF-03", "Known vector, 2 rails", () => equal(RailFence.encrypt("HELLOWORLD", 2), "HLOOLELWRD"));
test("RF-04", "Rails >= length leaves text readable top-down", () =>
  equal(RailFence.encrypt("ABC", 5), "ABC"));
test("RF-05", "Zig-zag pattern for 4 rails", () =>
  equal(RailFence.railPattern(8, 4).join(""), "01232101"));
test("RF-06", "Rails = 1 or not a number is rejected", () => {
  throws(() => RailFence.encrypt("ABC", 1));
  throws(() => RailFence.encrypt("ABC", 2.5));
});
test("RF-07", "Empty text gives empty output", () => equal(RailFence.encrypt("", 3), ""));
test("RF-08", "Spaces, digits and Unicode survive a round trip", () =>
  equal(RailFence.decrypt(RailFence.encrypt("Hi 2026 नमस्ते!", 3), 3), "Hi 2026 नमस्ते!"));
test("RF-09", "300 random round trips (rails 2-10)", () => {
  for (let i = 0; i < 300; i++) {
    const t = randomText(1 + rand(80)); const r = 2 + rand(9);
    equal(RailFence.decrypt(RailFence.encrypt(t, r), r), t);
  }
});
test("RF-10", "Animation trace output equals encrypt()", () => {
  const tr = RailFence.encryptTrace(MSG, 4);
  equal(tr.output, RailFence.encrypt(MSG, 4));
  equal(tr.steps.length, MSG.length * 2);
});

// ---------------- Columnar ----------------
test("CT-01", "Key order for ZEBRAS", () =>
  equal(Columnar.keyOrder("ZEBRAS").join(","), "4,2,1,3,5,0"));
test("CT-02", "Repeated key letters ranked left to right (BALL)", () =>
  equal(Columnar.keyRank("BALL").join(","), "2,1,3,4"));
test("CT-03", "Known vector ZEBRAS, irregular grid", () =>
  equal(Columnar.encrypt(MSG, "ZEBRAS"), "EVLNACDTESEAROFODEECWIREE"));
test("CT-04", "Known vector ZEBRAS with padding QKJEU", () =>
  equal(Columnar.encrypt(MSG + "QKJEU", "ZEBRAS"), "EVLNEACDTKESEAQROFOJDEECUWIREE"));
test("CT-05", "Decrypt irregular ZEBRAS vector", () =>
  equal(Columnar.decrypt("EVLNACDTESEAROFODEECWIREE", "ZEBRAS"), MSG));
test("CT-06", "Pad with X, then padding removed on decrypt", () => {
  const c = Columnar.encrypt("ATTACKATDAWN", "KEYS", "X");
  equal(c.length % 4, 0);
  equal(Columnar.decrypt(c, "KEYS", "X"), "ATTACKATDAWN");
});
test("CT-07", "Column lengths for 25 letters, 6 columns", () =>
  equal(Columnar.columnLengths(25, 6).join(","), "5,4,4,4,4,4"));
test("CT-08", "Keyword shorter than 2 is rejected", () => {
  throws(() => Columnar.encrypt("ABC", "K"));
  throws(() => Columnar.encrypt("ABC", "   "));
});
test("CT-09", "Lower-case key gives same result as upper-case", () =>
  equal(Columnar.encrypt(MSG, "zebras"), Columnar.encrypt(MSG, "ZEBRAS")));
test("CT-10", "300 random round trips (random keys)", () => {
  for (let i = 0; i < 300; i++) {
    const t = randomText(1 + rand(80));
    let key = ""; const k = 2 + rand(8);
    for (let j = 0; j < k; j++) key += "ABCDEFGHIJ"[rand(10)];
    equal(Columnar.decrypt(Columnar.encrypt(t, key), key), t);
  }
});
test("CT-11", "Decrypt trace output equals decrypt()", () => {
  const c = Columnar.encrypt(MSG, "CIPHER");
  equal(Columnar.decryptTrace(c, "CIPHER").output, MSG);
});

// ---------------- Analysis ----------------
const LONG = "THESECRETMEETINGWILLTAKEPLACEATTHEOLDLIBRARYNEARTHERIVERONFRIDAYEVENING";
test("AN-01", "Letter frequencies unchanged by rail fence", () =>
  equal(JSON.stringify(Analysis.letterFrequencies(RailFence.encrypt(LONG, 5))),
        JSON.stringify(Analysis.letterFrequencies(LONG))));
test("AN-02", "Letter frequencies unchanged by columnar", () =>
  equal(JSON.stringify(Analysis.letterFrequencies(Columnar.encrypt(LONG, "LIBRARY"))),
        JSON.stringify(Analysis.letterFrequencies(LONG))));
test("AN-03", "English scores higher than its ciphertext", () => {
  if (!(Analysis.englishScore(LONG) > Analysis.englishScore(RailFence.encrypt(LONG, 4))))
    throw new Error("score not higher");
});
test("AN-04", "Brute force finds rail fence key 5", () => {
  const r = Analysis.bruteForceRail(RailFence.encrypt(LONG, 5));
  equal(r.results[0].key, 5); equal(r.results[0].text, LONG);
});
test("AN-05", "Brute force finds a 5-letter columnar key", () => {
  const r = Analysis.bruteForceColumnar(Columnar.encrypt(LONG, "TIGER"), 6);
  equal(r.results[0].text, LONG);
  equal(r.tried, 2 + 6 + 24 + 120 + 720);
});

// ---------------- report ----------------
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("ID", 7) + pad("Test case", 52) + "Result");
console.log("-".repeat(66));
for (const [id, name, res, msg] of results) {
  console.log(pad(id, 7) + pad(name, 52) + res + (msg ? "  " + msg : ""));
}
const passed = results.filter((r) => r[2] === "PASS").length;
console.log("-".repeat(66));
console.log(`${passed}/${results.length} test cases passed`);
process.exit(passed === results.length ? 0 : 1);
