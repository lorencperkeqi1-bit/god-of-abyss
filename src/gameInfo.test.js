import { GAME_RULES } from './gameRules.js';
import { renderGameInfoContent } from './gameInfo.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`[PASS] ${message}`);
    } else {
        failed++;
        console.error(`[FAIL] ${message}`);
    }
}

const currentStake = 25;
const content = renderGameInfoContent(GAME_RULES, currentStake);

for (const symbol of GAME_RULES.symbols) {
    assert(content.includes(`>${symbol}<`), `Information content includes configured symbol ${symbol}`);
}

for (const [symbol, payouts] of Object.entries(GAME_RULES.paytable)) {
    for (const [count, multiplier] of Object.entries(payouts)) {
        const formatted = `${Number(multiplier).toFixed(2).replace(/\.?0+$/, '')}×`;
        assert(content.includes(`${count} × ${formatted}`),
            `${symbol} ${count}-symbol payout is sourced from the configured paytable`);
    }
}

assert(content.includes(`${(currentStake * GAME_RULES.maxWinStakeMultiplier).toLocaleString('en-US')} CR`),
    'Maximum win value uses the current bet and configured round cap');
assert(content.includes(`${(currentStake * GAME_RULES.buyBonusStakeMultiplier).toLocaleString('en-US')} CR`),
    'Buy Bonus price uses the current bet and configured multiplier');
assert(content.includes(`${(GAME_RULES.naturalBonus.scatterTriggerChance * 100).toFixed(2)}%`),
    'Natural bonus gate is sourced from game configuration');
assert(content.includes(`${GAME_RULES.ares.rewardStakeMultiplier}×`),
    'Ares reward multiplier is sourced from game configuration');
assert(content.includes(`${GAME_RULES.hades.soulCap} CR`),
    'Soul Bank cap is sourced from game configuration');
assert(content.includes('Overcharge and Chain Lightning are not selectable in the current scene'),
    'Information discloses Zeus actions not selectable in the current game scene');
assert(content.includes('No boss health bar or separate boss-combat system is implemented'),
    'Information distinguishes Typhon progression from an unimplemented boss battle');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
