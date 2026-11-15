# Rail Fence & Columnar Transposition Visualizer

Project code: CSL-G03 | Shivam Goyal (23ESKCS806) | CS-D-G1
Cyber Security Lab (7CS4-22), SKIT Jaipur | Linked experiment: Exp 1 (Substitution & Transposition Ciphers)

A web page that animates, step by step, how a message is written into and
read out of the grid of a Rail Fence cipher and a Columnar (row/column)
transposition cipher, for both encryption and decryption. A third tab shows
why these ciphers are weak: letter counts never change, and every key can be
tried by brute force in milliseconds.

## Run

No installation or internet needed. Double-click `index.html`
(Chrome, Edge or Firefox).

## Use

1. Pick a tab: Rail Fence or Columnar.
2. Choose Encrypt or Decrypt, type the message and the key
   (number of rails, or a keyword and optional padding character).
3. Press "Show the steps". Use Play/Pause, Back, Next, Start, Result and the
   speed slider. Keyboard: Space = play/pause, Left/Right = step, Home/End.
4. After encrypting, switch to Decrypt: the ciphertext is filled in for you.
5. "Why it breaks" tab: enter a message, rails and keyword, then
   "Encrypt and attack".

## Tests and benchmark (need Node.js)

    node tests/run_tests.js     # 26 test cases, including published test vectors
    node tools/benchmark.js     # brute-force time for growing key sizes

## Files

    index.html          page layout
    css/style.css       chalkboard theme
    js/railfence.js     rail fence encrypt / decrypt / animation steps
    js/columnar.js      columnar encrypt / decrypt / animation steps
    js/analysis.js      letter counts, English scoring, brute-force attacks
    js/app.js           step player, grid drawing, analysis tab
    tests/run_tests.js  test cases
    tools/benchmark.js  attack timing

## Ethics

The project runs entirely in the browser on the author's own computer and
attacks only ciphertexts it creates itself. No network or other system is
involved.
