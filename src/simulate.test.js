import { simulatePurchasedBonuses, simulateSessions } from './simulate.js';

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

const first = simulateSessions(1000, 123, 10);
const repeated = simulateSessions(1000, 123, 10);
const otherSeed = simulateSessions(1000, 124, 10);

assert(JSON.stringify(first) === JSON.stringify(repeated), 'Simulation reproduces the full report for the same seed');
assert(JSON.stringify(first) !== JSON.stringify(otherSeed), 'A different seed changes the simulation sequence');
assert(first.totalWagers === first.sessionCount * first.stake, 'Only paid base sessions contribute wager');
assert(first.totalPayouts === first.baseGamePayout + first.bonusPayout + first.typhonPayout, 'Payout categories sum exactly once');
assert(first.rtp === first.totalPayouts / first.totalWagers * 100, 'RTP uses total qualifying payouts divided by paid wagers');
assert(first.bonusCount <= first.sessionCount, 'Natural bonus entry is counted at most once per paid session');
assert(first.scatterQualifiedCount >= first.bonusCount, 'Natural triggers are limited to scatter-qualified boards');
assert(first.baseGameSpins === 1000 && first.totalSpins === first.baseGameSpins + first.bonusSpins,
    'Simulation reports base-game and bonus spins separately');
assert(first.bonusContribution === first.freeSpinRtp + first.typhonContribution,
    'Bonus RTP contribution includes free-spin and Typhon awards');

const purchaseRun = simulatePurchasedBonuses(10, 321, 10, 'UNDERWORLD');
const repeatedPurchaseRun = simulatePurchasedBonuses(10, 321, 10, 'UNDERWORLD');
assert(JSON.stringify(purchaseRun) === JSON.stringify(repeatedPurchaseRun), 'Purchased-bonus simulation reproduces for the same seed');
assert(purchaseRun.purchaseCost === 10 * 100 * 10, 'Purchased-bonus cost uses configured stake multiplier');
assert(purchaseRun.returnPercentage === purchaseRun.totalPayouts / purchaseRun.purchaseCost * 100, 'Purchased return uses payouts divided by purchase cost');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
