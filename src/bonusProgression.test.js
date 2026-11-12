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

function rulesWith({ thresholds = [10, 40, 70], maxWinStakeMultiplier = 5000 } = {}) {
    return {
        ...GAME_RULES,
        maxWinStakeMultiplier,
        bonusMeter: {
            ...GAME_RULES.bonusMeter,
            thresholds
        }
    };
}

function randomForSymbol(symbol) {
    return () => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length;
}

function createBonusSlot(path, random, rules) {
    const slot = new SlotLogic(10000, random, rules);
    slot.buyBonus(path);
    slot.selectRelic('PETRIFICATION');
    return slot;
}

function primeFinalTyphonStage(slot, powerLevel = 2) {
    slot.survivalStage = 4;
    slot.typhonPowerLevel = powerLevel;
    slot.typhonTriggered = true;
    if (slot.inBonus) slot.setBonusLifecycleState('FINAL_TYPHON_BONUS');
}

const baseSlot = new SlotLogic(10000, randomForSymbol('SKULL'), rulesWith({ thresholds: [1, 2, 3] }));
const baseStageEvents = [];
for (let spin = 0; spin < 100; spin++) {
    const outcome = baseSlot.generateSpinOutcome();
    assert(outcome && !outcome.bonusTriggered, `Base spin ${spin + 1} remains outside a bonus round`);
    baseStageEvents.push(...outcome.stageEvents);
}
baseSlot.creditPayout(100, { progressMeter: true, stageEvents: baseStageEvents });
assert(baseSlot.bonusState === 'BASE_GAME' && baseSlot.typhonMeterProgress === 0
    && baseSlot.typhonMeter === 0 && baseSlot.survivalProgress === 0,
'One hundred base-game wins and explicit base payout calls leave the meter empty and inactive');
assert(baseStageEvents.length === 0 && !baseSlot.typhonTriggered,
    'Base-game payouts never activate a bonus stage');

const crossRules = rulesWith({ thresholds: [1, 5, 15] });

const bonusPowerRules = {
    ...crossRules,
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [1, 2, 3] }
};
const bonusPowerSlot = createBonusSlot('RIFT', randomForSymbol('ZEUS'), bonusPowerRules);
const bonusPowerOutcome = bonusPowerSlot.generateSpinOutcome();
assert(bonusPowerOutcome.stageEvents.map(event => event.stage).join(',') === '1', 'A bonus win completes only the active survival stage');
assert(bonusPowerSlot.survivalStage === 2 && bonusPowerSlot.bonusSpinsLeft === 19, 'Stage completion starts the next ten-spin challenge');
assert(bonusPowerSlot.unlockedCharacterFeatures.length === 2, 'The next character feature unlocks after successful progression');

const persistentMeterRules = {
    ...rulesWith({ thresholds: [10000, 20000, 30000] }),
    bonusSurvival: { ...GAME_RULES.bonusSurvival, stageThresholds: [10000, 20000, 30000] }
};
const persistentMeterSlot = createBonusSlot('RIFT', randomForSymbol('SKULL'), persistentMeterRules);
for (let turn = 0; turn < GAME_RULES.bonusTurns; turn++) persistentMeterSlot.generateSpinOutcome();
const meterBeforeFeatureSettlement = persistentMeterSlot.survivalProgress;
const featureSettlement = persistentMeterSlot.checkBonusEnd();
assert(featureSettlement.ended && meterBeforeFeatureSettlement > 0, 'Failed survival feature settles after retaining progress through payout settlement');
assert(persistentMeterSlot.survivalProgress === 0 && persistentMeterSlot.survivalStage === 0
    && persistentMeterSlot.survivalSpinsLeft === 0 && persistentMeterSlot.unlockedCharacterFeatures.length === 0,
'Bonus failure resets meter progress, stage, spins, and unlocked features');
assert(persistentMeterSlot.bonusState === 'BONUS_FAILED' && !persistentMeterSlot.isBonusActive,
'Failed lifecycle is inactive after settlement');

const cappedRules = rulesWith({ thresholds: [1, 2, 3], maxWinStakeMultiplier: 1 });
const normalCapSlot = new SlotLogic(1000, randomForSymbol('ZEUS'), cappedRules);
const normalCap = normalCapSlot.generateSpinOutcome();
assert(normalCap.totalWin === 10 && normalCap.maxWinReached, 'A normal-spin payout is clipped to the 5,000x-configured round cap');
assert(normalCapSlot.creditPayout(100) === 0 && normalCapSlot.getRoundPayout() === 10, 'No additional payout accumulates after MAX WIN');

const freeSpinCapSlot = createBonusSlot('RIFT', randomForSymbol('ZEUS'), cappedRules);
const freeSpinBalance = freeSpinCapSlot.getBalance();
const freeSpinCap = freeSpinCapSlot.generateSpinOutcome();
assert(freeSpinCap.totalWin === 10 && freeSpinCap.maxWinReached, 'Free-spin payout is subject to the same round cap');
assert(!freeSpinCapSlot.canSpin() && freeSpinCapSlot.checkBonusEnd().ended, 'MAX WIN stops further free spins and settles the feature');
assert(freeSpinCapSlot.getBalance() === freeSpinBalance + 10, 'Capped free-spin winnings are credited exactly once');

const aresCapSlot = createBonusSlot('UNDERWORLD', randomForSymbol('ARES'), cappedRules);
const aresCap = aresCapSlot.generateSpinOutcome();
assert(aresCap.totalWin === 10 && aresCap.maxWinReached, 'Ares contract and spin payouts share the round cap');

const zeusCapSlot = createBonusSlot('OLYMPUS', randomForSymbol('HADES'), cappedRules);
zeusCapSlot.pendingZeusAction = true;
zeusCapSlot.zeusCharges[0][0] = 1;
zeusCapSlot.zeusCharges[0][1] = 1;
zeusCapSlot.zeusCharges[0][2] = 1;
zeusCapSlot.currentBonusBoard = Array.from({ length: 5 }, () => Array(5).fill('HADES'));
zeusCapSlot.currentBonusCellStates = Array.from({ length: 5 }, () => Array(5).fill(null).map(() => ({
    wild: false, chargeLevel: 1, cursed: false
})));
const zeusCap = zeusCapSlot.applyZeusAction('DISCHARGE');
assert(zeusCap.totalWin === 10 && zeusCap.maxWinReached, 'Zeus Discharge payout cannot exceed MAX WIN');

const wrathCapSlot = createBonusSlot('RIFT', randomForSymbol('SKULL'), cappedRules);
wrathCapSlot.roundPayout = 5;
wrathCapSlot.currentBonusWin = 5;
wrathCapSlot.bonusSpinsLeft = 1;
wrathCapSlot.soulBank = 100;
primeFinalTyphonStage(wrathCapSlot);
assert(wrathCapSlot.selectTyphonAction('ABYSSAL_WRATH'), 'Typhon reward resolves when only part of MAX WIN remains');
assert(wrathCapSlot.roundPayout === 10 && wrathCapSlot.currentBonusWin === 10, 'Typhon reward is clipped to the remaining MAX WIN allowance');

const soulCapSlot = createBonusSlot('UNDERWORLD', randomForSymbol('SKULL'), cappedRules);
soulCapSlot.roundPayout = 5;
soulCapSlot.currentBonusWin = 5;
soulCapSlot.bonusSpinsLeft = 0;
soulCapSlot.soulBank = 100;
const soulCapEnd = soulCapSlot.checkBonusEnd();
assert(soulCapEnd.totalBonusWin === 10 && soulCapEnd.soulReward === 5, 'Soul Bank release is capped after prior bonus payouts');
assert(soulCapSlot.getRoundPayout() === 10 && soulCapSlot.getBalance() === 9010, 'MAX WIN Soul Bank settlement credits no more than the cap');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
