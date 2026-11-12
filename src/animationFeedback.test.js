import { GAME_RULES } from './gameRules.js';
import { SlotLogic } from './slotLogic.js';
import { evaluateGrid } from './slotMath.js';
import { formatCredits, getWinningCellKeys, VisualFeedback } from './visualFeedback.js';

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

const grid = Array.from({ length: 4 }, () => Array(5).fill('SEAL'));
for (let column = 0; column < 5; column++) grid[0][column] = 'SIGIL';
const evaluation = evaluateGrid(grid, 10);
const highlighted = getWinningCellKeys(evaluation.wins, GAME_RULES.paylines[4]);
assert(evaluation.wins.length > 0, 'Fixture includes actual engine wins');
assert(evaluation.wins.every(win => GAME_RULES.paylines[4][win.paylineIndex]
    .slice(0, win.matchCount)
    .every((row, column) => highlighted.has(`${row},${column}`))), 'Highlights map to exact winning engine cells');
assert(formatCredits(12) === '12 CR' && formatCredits(12.345) === '12.35 CR', 'Payout display is readable and rounded to cents');

const listeners = {};
const fakeScene = {
    events: { once: (name, callback) => { listeners[name] = callback; } },
    textures: { exists: () => true }
};
const feedback = new VisualFeedback(fakeScene, () => true);
const speedFeedback = new VisualFeedback(fakeScene, () => false);
assert(speedFeedback.duration(300) === 300, 'Default animation speed preserves configured duration');
speedFeedback.setSpeedMultiplier(2);
assert(speedFeedback.duration(300) === 150, 'Animation speed setting scales feedback timing');
let rejectedInvalidSpeed = false;
try {
    speedFeedback.setSpeedMultiplier(5);
} catch (error) {
    rejectedInvalidSpeed = error instanceof RangeError;
}
assert(rejectedInvalidSpeed, 'Animation speed rejects out-of-range multipliers');
speedFeedback.destroy();
const slot = new SlotLogic(1000, () => 0.1);
const outcome = slot.generateSpinOutcome();
const balanceBeforePresentation = slot.getBalance();
const presentationGrid = outcome.matrix.map(row => row.map(() => ({
    texture: null,
    scale: null,
    scaleX: 0.8,
    scaleY: 0.8,
    setTexture(value) { this.texture = value; },
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; this.scale = [x, y]; },
    setDisplaySize(width, height) { this.displaySize = [width, height]; }
})));
let reelCompletionCount = 0;
feedback.animateReels(outcome.matrix, presentationGrid, GAME_RULES.symbols, () => reelCompletionCount++);
assert(reelCompletionCount === 1, 'Reduced-motion reel completion calls back exactly once');
assert(presentationGrid.every((row, r) => row.every((sprite, c) => sprite.texture === outcome.matrix[r][c])), 'Reels display the exact engine matrix');
assert(presentationGrid.every(row => row.every(sprite => sprite.displaySize[0] === 80 && sprite.displaySize[1] === 64)), 'Reel animation restores configured tile dimensions');
assert(slot.getBalance() === balanceBeforePresentation, 'Reel animation does not mutate the settled balance');
assert(JSON.stringify(outcome.matrix) === JSON.stringify(presentationGrid.map(row => row.map(sprite => sprite.texture))), 'Presentation result remains synchronized with engine output');

const payoutLabel = { text: '0 CR', setText(value) { this.text = value; } };
let counterCompletionCount = 0;
feedback.countUp(payoutLabel, outcome.totalWin, 320, () => counterCompletionCount++);
assert(payoutLabel.text === formatCredits(outcome.totalWin), 'Reduced-motion payout counter reaches authoritative payout');
assert(counterCompletionCount === 1, 'Payout completion callback runs once');

let crossFadeCompletionCount = 0;
const background = { texture: 'base', alpha: 1, setTexture(value) { this.texture = value; }, setAlpha(value) { this.alpha = value; } };
feedback.crossFadeBackground(background, 'underworld', () => crossFadeCompletionCount++);
assert(background.texture === 'underworld' && background.alpha === 1, 'Reduced-motion environment transition reaches selected background');
assert(crossFadeCompletionCount === 1, 'Background transition completion callback runs once');
const sweepTarget = { x: 120, y: 80 };
feedback.sweep([sweepTarget], 'x', 12, 0x55ccff);
assert(sweepTarget.x === 120 && sweepTarget.y === 80, 'Reduced-motion shift cue leaves authoritative cell positions unchanged');
feedback.destroy();

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
