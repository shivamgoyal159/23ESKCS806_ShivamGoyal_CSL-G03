/*
 * analysis.js - Why transposition ciphers are weak.
 *
 *  1. letterFrequencies(): transposition only MOVES letters, so the
 *     ciphertext has exactly the same letter counts as the plaintext.
 *  2. bruteForceRail():    a rail fence key is just a number from 2 to n-1,
 *     so every key can be tried in milliseconds.
 *  3. bruteForceColumnar(): for short keywords all k! column orders can be
 *     tried (5040 orders for a 7-letter key).
 *
 * Candidates are ranked with englishScore(): how "English-like" the text is,
 * measured with common English letter pairs (bigrams) and common words.
 * Letter frequencies cannot rank transposition candidates, because every
 * candidate contains the same letters.
 */
(function (root) {
  "use strict";

  const RailFence = typeof module !== "undefined" ? require("./railfence.js") : root.RailFence;
  const Columnar = typeof module !== "undefined" ? require("./columnar.js") : root.Columnar;

  // Approximate frequency (%) of the most common English bigrams
  // (P. Norvig, "English Letter Frequency Counts", Google Books corpus).
  const BIGRAMS = {
    TH: 3.56, HE: 3.07, IN: 2.43, ER: 2.05, AN: 1.99, RE: 1.85, ON: 1.76, AT: 1.49,
    EN: 1.45, ND: 1.35, TI: 1.34, ES: 1.34, OR: 1.28, TE: 1.20, OF: 1.17, ED: 1.17,
    IS: 1.13, IT: 1.12, AL: 1.09, AR: 1.07, ST: 1.05, TO: 1.04, NT: 1.04, NG: 0.95,
    SE: 0.93, HA: 0.93, AS: 0.87, OU: 0.87, IO: 0.83, LE: 0.83, VE: 0.83, CO: 0.79,
    ME: 0.79, DE: 0.76, HI: 0.76, RI: 0.73, RO: 0.73, IC: 0.70, NE: 0.69, EA: 0.69,
    RA: 0.69, CE: 0.65, LI: 0.62, CH: 0.60, LL: 0.58, BE: 0.58, MA: 0.57, SI: 0.55,
    OM: 0.55, UR: 0.54,
  };
  const UNKNOWN = Math.log10(0.005);   // penalty for a pair not in the table
  const WORDS = ["THE", "AND", "THAT", "HAVE", "FOR", "NOT", "WITH", "YOU", "THIS",
                 "ARE", "WAS", "FROM", "THEY", "WILL", "WHICH", "THERE", "ATTACK", "MEET"];

  function lettersOnly(text) {
    return text.toUpperCase().replace(/[^A-Z]/g, "");
  }

  function letterFrequencies(text) {
    const counts = {};
    for (let c = 65; c <= 90; c++) counts[String.fromCharCode(c)] = 0;
    for (const ch of lettersOnly(text)) counts[ch]++;
    return counts;
  }

  /* Higher = more English-like: average log-probability of each
   * letter pair, plus a small bonus for every common word found. */
  function englishScore(text) {
    const t = lettersOnly(text);
    if (t.length < 2) return -Infinity;
    let sum = 0;
    for (let i = 0; i < t.length - 1; i++) {
      const f = BIGRAMS[t[i] + t[i + 1]];
      sum += f ? Math.log10(f) : UNKNOWN;
    }
    let bonus = 0;
    for (const w of WORDS) if (t.includes(w)) bonus += 0.15;
    return sum / (t.length - 1) + bonus;
  }

  function bruteForceRail(cipher, maxRails) {
    const n = Array.from(cipher).length;
    const limit = Math.min(maxRails || n - 1, n - 1);
    const results = [];
    for (let rails = 2; rails <= limit; rails++) {
      const text = RailFence.decrypt(cipher, rails);
      results.push({ key: rails, text, score: englishScore(text) });
    }
    results.sort((a, b) => b.score - a.score);
    return { tried: results.length, results };
  }

  /* Heap's algorithm: calls visit() with every permutation of 0..k-1 */
  function permutations(k, visit) {
    const a = Array.from({ length: k }, (_, i) => i);
    const c = new Array(k).fill(0);
    visit(a);
    let i = 0;
    while (i < k) {
      if (c[i] < i) {
        const j = i % 2 === 0 ? 0 : c[i];
        [a[j], a[i]] = [a[i], a[j]];
        visit(a);
        c[i]++;
        i = 0;
      } else {
        c[i] = 0;
        i++;
      }
    }
  }

  function bruteForceColumnar(cipher, maxKeyLength, keep) {
    const top = [];
    const keepTop = keep || 5;
    let tried = 0;
    for (let k = 2; k <= maxKeyLength; k++) {
      permutations(k, (order) => {
        tried++;
        const text = Columnar.decryptWithOrder(cipher, order);
        const score = englishScore(text);
        if (top.length < keepTop || score > top[top.length - 1].score) {
          top.push({ key: order.map((c) => c + 1).join("-"), length: k, text, score });
          top.sort((a, b) => b.score - a.score);
          if (top.length > keepTop) top.pop();
        }
      });
    }
    return { tried, results: top };
  }

  const api = { lettersOnly, letterFrequencies, englishScore, bruteForceRail,
                permutations, bruteForceColumnar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Analysis = api;
})(this);
