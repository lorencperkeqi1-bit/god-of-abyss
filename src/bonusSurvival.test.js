import { GAME_RULES } from './gameRules.js';
import { SlotLogic } from './slotLogic.js';

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

function randomForSymbol(symbol) {
    return () => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length;
}

function startSurvival({ path = 'OLYMPUS', relic = 'SOUL', rules = GAME_RULES, symbol = 'SKULL' } = {}) {
    const slot = new SlotLogic(10000, randomForSymbol(symbol), rules);
    slot.buyBonus(path);
    slot.selectRelic(relic);
    return slot;
}

const survivalRules = {
    ...GAME_RULES,
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [8, 24, 45] }
};

const slot = startSurvival({ rules: survivalRules });
assert(slot.survivalStage === 1 && slot.survivalProgress === 0, 'Survival starts at blue stage one with an empty meter');
assert(slot.bonusSpinsLeft === 10 && slot.survivalSpinsLeft === 10, 'The first stage starts with exactly ten spins');
assert(slot.unlockedCharacterFeatures.join(',') === 'ZEUS', 'Only the chosen path character is active in stage one');

const firstSpin = slot.generateSpinOutcome();
const stageOneEvent = firstSpin.stageEvents[0];
assert(stageOneEvent?.stage === 1, 'Actual settled winnings complete the blue threshold');
assert(slot.survivalStage === 2 && slot.survivalProgress === 0, 'Completing stage one begins yellow progress at zero');
assert(slot.unlockedCharacterFeatures.join(',') === 'ZEUS,HADES', 'Stage one unlocks the selected relic character for stage two');
assert(slot.survivalSpinsLeft === 10 && slot.bonusSpinsLeft === 19, 'Stage one awards exactly ten spins once');
assert(slot.getRoundPayout() === firstSpin.totalWin, 'A spin payout is credited to the round exactly once');

const firstPayout = slot.getRoundPayout();
const secondSpin = slot.generateSpinOutcome();
assert(secondSpin.stageEvents.length === 0 && Math.abs(slot.survivalProgress - 16) < 1e-9, 'Consecutive payout progress accumulates without advancing early');
assert(slot.getRoundPayout() > firstPayout, 'Consecutive stage wins add their actual payout once each');
const thirdSpin = slot.generateSpinOutcome();
assert(thirdSpin.stageEvents.length === 1 && thirdSpin.stageEvents[0].stage === 2, 'Accumulated winnings complete only the yellow threshold');
assert(slot.unlockedCharacterFeatures.join(',') === 'ZEUS,HADES,POSEIDON', 'Stage two unlocks the third character feature');
assert(slot.survivalSpinsLeft === 10, 'Ascension awards ten spins for stage three');

slot.generateSpinOutcome();
slot.generateSpinOutcome();
const sixthSpin = slot.generateSpinOutcome();
assert(sixthSpin.stageEvents[0]?.stage === 3 && slot.typhonTriggered, 'Purple completion activates the existing Typhon choice');
assert(slot.getTyphonChoices().join(',') === 'ABYSSAL_WRATH,TITAN_ASCENDANCE', 'The final Typhon choice remains available after survival');
assert(slot.unlockedCharacterFeatures.length === 3, 'All three unlocked character features carry into the finale');
assert(slot.selectTyphonAction('TITAN_ASCENDANCE'), 'Titan Ascendance resolves as the stage-three choice');
assert(slot.survivalStage === 4 && slot.survivalSpinsLeft === 18, 'Titan adds its capped extra turns to the ten-spin finale');
assert(slot.megaWildSpins === 8, 'Titan Ascendance preserves its existing Mega Wild effect');
assert(slot.typhonPowerLevel === 3 && slot.survivalCompletedStages.length === 3,
'Typhon choice does not clear completed meter stages before the finale ends');
const payoutBeforeFinaleSettlement = slot.getRoundPayout();
const balanceBeforeFinaleSettlement = slot.getBalance();
slot.bonusSpinsLeft = 0;
slot.survivalSpinsLeft = 0;
const completedBonus = slot.checkBonusEnd();
assert(completedBonus.ended && !completedBonus.failed
    && slot.getBalance() >= balanceBeforeFinaleSettlement + payoutBeforeFinaleSettlement,
'Final Typhon completion settles its payout before resetting progression');
assert(slot.bonusState === 'BONUS_COMPLETE' && !slot.isBonusActive
    && slot.survivalStage === 0 && slot.survivalProgress === 0
    && slot.survivalCompletedStages.length === 0 && slot.typhonMeterProgress === 0
    && slot.bonusSpinsLeft === 0 && slot.survivalSpinsLeft === 0
    && slot.unlockedCharacterFeatures.length === 0,
'Successful final settlement clears all meter, stage, spin, and feature state');
assert(slot.buyBonus('RIFT').success && slot.survivalStage === 1
    && slot.survivalProgress === 0 && slot.bonusSpinsLeft === 10,
'A subsequent bonus cycle begins fresh in Stage 1');
slot.selectRelic('PETRIFICATION');

const zeusFeature = startSurvival({ relic: 'LIGHTNING', symbol: 'CHARGE' });
const zeusFeatureSpin = zeusFeature.generateSpinOutcome();
assert(zeusFeatureSpin.pendingZeusAction && zeusFeature.getQualifyingZeusNetworks().length > 0, 'The stage-one Zeus feature creates its existing charged-network gameplay');
assert(zeusFeature.getEventHistory().some(event => event.type === 'survival-progress' && event.added > 0), 'An actual Zeus network event contributes configured stage progress');

const hadesRules = {
    ...GAME_RULES,
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [1, 1000, 2000] }
};
const hadesFeature = startSurvival({ rules: hadesRules, symbol: 'DRACHMA' });
hadesFeature.creditPayout(10);
assert(hadesFeature.survivalStage === 2 && hadesFeature.unlockedCharacterFeatures.includes('HADES'), 'The relic character becomes active only after Ascension unlocks it');
hadesFeature.generateSpinOutcome();
assert(hadesFeature.soulBank > 0, 'The unlocked Hades feature collects its existing Soul Bank reward');

const pendingZeusRules = {
    ...GAME_RULES,
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [10000, 20000, 30000] }
};
const lastSpinZeus = startSurvival({ rules: pendingZeusRules, relic: 'LIGHTNING', symbol: 'CHARGE' });
lastSpinZeus.bonusSpinsLeft = 1;
lastSpinZeus.survivalSpinsLeft = 1;
const pendingZeusSpin = lastSpinZeus.generateSpinOutcome();
assert(pendingZeusSpin.pendingZeusAction && !lastSpinZeus.survivalFailed, 'A pending Zeus choice delays last-spin failure');
lastSpinZeus.applyZeusAction('DISCHARGE');
assert(lastSpinZeus.survivalFailed, 'A deferred Zeus payout resolves before the stage failure decision');

const noWinPaytable = Object.fromEntries(GAME_RULES.symbols.map(symbol => [
    symbol,
    Object.freeze({ 3: 0, 4: 0, 5: 0 })
]));
const noWinRules = {
    ...GAME_RULES,
    paytable: noWinPaytable,
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [8, 24, 45] }
};
const failedStage = startSurvival({ rules: noWinRules, symbol: 'SKULL' });
for (let spin = 0; spin < 10; spin++) failedStage.generateSpinOutcome();
assert(failedStage.survivalFailed && failedStage.survivalFailureStage === 1, 'Using all ten spins without sufficient progress fails stage one');
assert(failedStage.bonusSpinsLeft === 0 && !failedStage.canSpin(), 'A failed stage prevents any further spins');
const failedSettlement = failedStage.checkBonusEnd();
assert(failedSettlement.ended && failedSettlement.failed && failedSettlement.failureStage === 1, 'Failure ends the bonus and reports the failed stage');
failedStage.buyBonus('RIFT');
failedStage.selectRelic('PETRIFICATION');
assert(failedStage.survivalStage === 1 && failedStage.survivalProgress === 0
    && failedStage.survivalCompletedStages.length === 0, 'A new bonus cycle resets stage progress and unlocks');

const failedAscension = startSurvival({ rules: noWinRules, symbol: 'SKULL' });
failedAscension.creditPayout(80);
for (let spin = 0; spin < 10; spin++) failedAscension.generateSpinOutcome();
assert(failedAscension.survivalFailed && failedAscension.survivalFailureStage === 2, 'The same ten-spin failure rule applies to Ascension');
const ascensionFailureResult = failedAscension.checkBonusEnd();
assert(ascensionFailureResult.ended && failedAscension.survivalStage === 0
    && failedAscension.survivalProgress === 0 && failedAscension.unlockedCharacterFeatures.length === 0,
'Failed Ascension resets its progress and unlocked features after settlement');

const failedDivineRules = {
    ...noWinRules,
    bonusSurvival: { ...noWinRules.bonusSurvival, stageThresholds: [1, 1, 1000] }
};
const failedDivine = startSurvival({ rules: failedDivineRules, symbol: 'SKULL' });
failedDivine.creditPayout(10);
failedDivine.creditPayout(10);
for (let spin = 0; spin < 10; spin++) failedDivine.generateSpinOutcome();
assert(failedDivine.survivalFailed && failedDivine.survivalFailureStage === 3, 'The Divine stage also fails after its tenth unsuccessful spin');
const divineFailureResult = failedDivine.checkBonusEnd();
assert(divineFailureResult.ended && failedDivine.survivalStage === 0
    && failedDivine.survivalProgress === 0 && failedDivine.unlockedCharacterFeatures.length === 0,
'Failed Divine Power resets after its final winnings are settled');

const cappedRules = {
    ...survivalRules,
    maxWinStakeMultiplier: 1
};
const cappedBonus = startSurvival({ rules: cappedRules, relic: 'LIGHTNING', symbol: 'ZEUS' });
const balanceBeforeCappedSettlement = cappedBonus.getBalance();
const cappedOutcome = cappedBonus.generateSpinOutcome();
assert(cappedOutcome.maxWinReached && cappedBonus.getRoundPayout() === 10, 'Bonus payout is clipped at the configured round MAX WIN');
assert(!cappedBonus.canSpin(), 'MAX WIN prevents additional survival payouts');
const cappedSettlement = cappedBonus.checkBonusEnd();
assert(cappedSettlement.ended && cappedBonus.getBalance() === balanceBeforeCappedSettlement + 10, 'Capped bonus settlement credits no more than MAX WIN');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
