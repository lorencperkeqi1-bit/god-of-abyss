import { GAME_RULES } from './gameRules.js';
import { evaluateGrid, evaluateLine } from './slotMath.js';

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) {
        passed++;
        console.log(`[PASS] ${name}`);
    } else {
        failed++;
        console.error(`[FAIL] ${name}`);
    }
}

for (const [symbol, payouts] of Object.entries(GAME_RULES.paytable)) {
    for (const [countText, multiplier] of Object.entries(payouts)) {
        const count = Number(countText);
        const line = [...Array(count).fill(symbol), ...Array(5 - count).fill('SEAL')];
        const win = evaluateLine(line, 10);
        assert(win?.targetSymbol === symbol, `${symbol} ${count}-symbol paytable entry selects the symbol`);
        assert(win?.matchCount === count, `${symbol} ${count}-symbol entry stops at the correct length`);
        assert(win?.payout === multiplier * 10, `${symbol} ${count}-symbol entry pays its configured multiplier`);
    }
}

const wildWin = evaluateLine(['HADES', 'ZEUS', 'HADES', 'SEAL', 'SEAL'], 10);
assert(wildWin?.targetSymbol === 'HADES' && wildWin.matchCount === 3, 'Zeus substitutes for a line symbol');
const wildOnlyWin = evaluateLine(['ZEUS', 'ZEUS', 'ZEUS', 'SEAL', 'SEAL'], 10);
assert(wildOnlyWin?.targetSymbol === 'ZEUS', 'All-wild lines use the Zeus paytable');
assert(evaluateLine(['HADES', 'SEAL', 'HADES', 'HADES', 'HADES'], 10) === null, 'Wins must start on the first reel and remain consecutive');

const fourRowGrid = Array.from({ length: 4 }, () => Array(5).fill('SEAL'));
for (let column = 0; column < 5; column++) fourRowGrid[0][column] = 'SIGIL';
const fourRowResult = evaluateGrid(fourRowGrid, 10);
assert(fourRowResult.wins.length === 1, 'A payline win is counted once');
assert(fourRowResult.totalWin === 8 / 10 * 10, 'Line payout uses stake divided across configured paylines');
assert(fourRowResult.bonusTriggered, 'Three scatters trigger Divine Convergence');
const sameWinAt25 = evaluateGrid(fourRowGrid, 25);
assert(sameWinAt25.totalWin === fourRowResult.totalWin * 2.5,
    'Line payouts scale proportionally with the selected total bet');

const fiveRowGrid = Array.from({ length: 5 }, () => Array(5).fill('SEAL'));
for (let column = 0; column < 5; column++) fiveRowGrid[4][column] = 'SIGIL';
const fiveRowResult = evaluateGrid(fiveRowGrid, 10);
assert(fiveRowResult.wins.some(win => win.paylineIndex === 10), 'The fifth row participates in bonus paylines');

let invalidStakeRejected = false;
try {
    evaluateGrid(fourRowGrid, 0);
} catch {
    invalidStakeRejected = true;
}
assert(invalidStakeRejected, 'Invalid stake is rejected before evaluation');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
