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

function randomForSymbols(matrix) {
    const values = matrix.flat().map(symbol => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length);
    let index = 0;
    return () => values[index++] ?? 0;
}

function createBonusSlot(path, matrix, rules = GAME_RULES) {
    const slot = new SlotLogic(10000, randomForSymbols(matrix), rules);
    slot.inBonus = true;
    slot.bonusChoice = path;
    slot.bonusSpinsLeft = GAME_RULES.bonusTurns;
    slot.bonusTurnsAwarded = GAME_RULES.bonusTurns;
    slot.survivalStage = 4;
    slot.setBonusLifecycleState('FINAL_TYPHON_BONUS');
    slot.survivalSpinsLeft = GAME_RULES.bonusTurns;
    slot.survivalFeatureRoster = ['ZEUS', 'HADES', 'TYPHON', 'POSEIDON', 'MEDUSA'];
    slot.unlockedCharacterFeatures = [...slot.survivalFeatureRoster];
    slot.currentBonusWin = 0;
    slot.rows = GAME_RULES.bonusRows;
    slot.zeusCharges = Array.from({ length: 5 }, () => Array(5).fill(0));
    slot.medusaCurseTurns = Array.from({ length: 5 }, () => Array(5).fill(0));
    slot.petrifiedTurns = Array.from({ length: 5 }, () => Array(5).fill(0));
    slot.pendingRelicSelection = false;
    slot.aresChallenge = {
        objective: 'Test Ares contract', target: GAME_RULES.ares.target, progress: 0,
        turnsLeft: GAME_RULES.ares.turns, completed: false, failed: false, paid: false
    };
    return slot;
}

function primeFinalTyphonStage(slot) {
    slot.survivalStage = 3;
    slot.survivalProgress = slot.rules.bonusSurvival.stageThresholds[2] - 1;
    slot.survivalSpinsLeft = 1;
    slot.bonusSpinsLeft = 1;
}

const olympusGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
[0, 1, 2].forEach(column => { olympusGrid[0][column] = 'CHARGE'; });
const zeus = createBonusSlot('OLYMPUS', olympusGrid);
const zeusOutcome = zeus.generateSpinOutcome();
assert(zeusOutcome.pendingZeusAction, 'Three orthogonally connected charged cells open a Zeus choice');
assert(zeus.getQualifyingZeusNetworks()[0].length === 3, 'Network includes exactly its connected charged cells');
assert(zeusOutcome.cellStates[0][0].chargeLevel === 1, 'Charge level is attached to its cell identity');
assert(zeus.getZeusChoices().includes('OVERCHARGE'), 'Overcharge is offered below the charge cap');
const overcharge = zeus.applyZeusAction('OVERCHARGE');
assert(zeus.zeusCharges[0][0] === 2, 'Overcharge increments eligible network cells by one');
assert(overcharge.totalWin > 0, 'Overcharge settles the board’s existing payline through the evaluator');
assert(zeus.currentBonusWin === overcharge.totalWin, 'Overcharge board payout is credited once');
assert(zeus.applyZeusAction('OVERCHARGE') === null, 'A resolved Zeus choice cannot be repeated');

const dischargeGrid = Array.from({ length: 5 }, () => Array(5).fill('HADES'));
[0, 1, 2].forEach(column => { dischargeGrid[0][column] = 'CHARGE'; });
dischargeGrid[4].fill('CHARGE');
const dischargeSlot = createBonusSlot('OLYMPUS', dischargeGrid);
dischargeSlot.zeusCharges[0][0] = 3;
dischargeSlot.zeusCharges[0][1] = 3;
dischargeSlot.zeusCharges[0][2] = 3;
const dischargeOutcome = dischargeSlot.generateSpinOutcome();
assert(dischargeOutcome?.pendingZeusAction, 'Discharge fixture reaches a pending network checkpoint');
assert(dischargeOutcome.totalWin === 0, 'Network spin does not award its line win before the player action');
assert(dischargeOutcome.pendingWins.length > 0, 'Deferred Zeus result retains the winning line details');
assert(dischargeSlot.currentBonusBoard !== null, 'Discharge checkpoint retains the evaluated board');
assert(dischargeSlot.getZeusChoices().includes('DISCHARGE'), 'Discharge is offered for a qualifying network');
const bonusWinBeforeDischarge = dischargeSlot.currentBonusWin;
const discharge = dischargeSlot.applyZeusAction('DISCHARGE');
assert(discharge.matrix[0].slice(0, 3).every(symbol => symbol === 'ZEUS'), 'Discharge transforms qualifying cells into Zeus Wilds');
assert(dischargeSlot.zeusCharges[0].slice(0, 3).every(level => level === 0), 'Discharge consumes the network charge levels');
assert(discharge.totalWin >= 0, 'Discharge resolves its transformed board through the normal evaluator');
assert(dischargeSlot.currentBonusWin === bonusWinBeforeDischarge + discharge.totalWin, 'Transformed-board payout is credited exactly once');
assert(dischargeSlot.applyZeusAction('DISCHARGE') === null, 'Discharge cannot award the same transformed board twice');

const chainSlot = createBonusSlot('OLYMPUS', olympusGrid);
chainSlot.generateSpinOutcome();
chainSlot.pendingZeusAction = true;
chainSlot.zeusCharges[0][0] = 1;
chainSlot.zeusCharges[0][1] = 1;
chainSlot.zeusCharges[0][2] = 1;
chainSlot.zeusCharges[2][0] = 1;
chainSlot.zeusCharges[2][1] = 1;
chainSlot.zeusCharges[2][2] = 1;
assert(chainSlot.getZeusChoices().includes('CHAIN_LIGHTNING'), 'Chain Lightning is offered for two qualifying networks within range');
chainSlot.applyZeusAction('CHAIN_LIGHTNING');
assert(chainSlot.getQualifyingZeusNetworks().length === 1, 'Chain Lightning connects eligible networks');
assert(new Set(chainSlot.zeusLinks).size === chainSlot.zeusLinks.length, 'Chain Lightning does not duplicate links');
assert(chainSlot.pendingZeusAction, 'Chain Lightning holds the checkpoint for the next valid action');

const underworldGrid = Array.from({ length: 5 }, () => Array(5).fill('DRACHMA'));
const noProgressionRewards = {
    ...GAME_RULES,
    bonusMeter: { ...GAME_RULES.bonusMeter, thresholds: [1000, 2000, 3000] }
};
const hades = createBonusSlot('UNDERWORLD', underworldGrid, noProgressionRewards);
hades.random = () => (GAME_RULES.symbols.indexOf('DRACHMA') + 0.25) / GAME_RULES.symbols.length;
hades.activeRelic = 'SOUL';
let hadesOutcome;
for (let turn = 0; turn < GAME_RULES.bonusMaxAwardedTurns && hades.inBonus; turn++) {
    hadesOutcome = hades.generateSpinOutcome();
    if (hadesOutcome?.typhonTriggered) hades.selectTyphonAction('ABYSSAL_WRATH');
    if (hades.bonusSpinsLeft <= 0 && !hades.typhonTriggered) break;
}
assert(hades.soulBank === GAME_RULES.hades.soulCap, 'Hades collection respects the configured Soul Bank cap');
assert(hades.getEventHistory().some(event => event.type === 'souls-collected'), 'Soul collection is recorded in engine history');
const balanceBeforeCollection = hades.getBalance();
const accumulatedHadesWin = hades.currentBonusWin;
const hadesEnd = hades.checkBonusEnd();
assert(hadesEnd.ended && hadesEnd.totalBonusWin === accumulatedHadesWin + GAME_RULES.hades.soulCap, 'Bonus end releases uncollected souls once');
assert(hadesEnd.soulReward === GAME_RULES.hades.soulCap, 'Hades release amount is exposed for separate RTP accounting');
assert(hades.getBalance() === balanceBeforeCollection + hadesEnd.totalBonusWin, 'Soul release is included in the authoritative balance settlement');
assert(hades.soulBank === 0, 'Soul Bank clears after release');
assert(!hades.checkBonusEnd().ended, 'Soul Bank reward cannot be collected twice');

const lightningRelicSlot = createBonusSlot('OLYMPUS', olympusGrid);
lightningRelicSlot.activeRelic = 'LIGHTNING';
const lightningResult = lightningRelicSlot.generateSpinOutcome();
assert(lightningResult.cellStates[0][0].chargeLevel === 1, 'Lightning Relic retains per-cell charge state');
assert(lightningRelicSlot.rules.zeus.relicChargeCap === 4, 'Lightning Relic has a documented finite cap');

const lightningCapSlot = createBonusSlot('OLYMPUS', olympusGrid);
lightningCapSlot.activeRelic = 'LIGHTNING';
lightningCapSlot.zeusCharges[0][0] = 3;
lightningCapSlot.zeusCharges[0][1] = 3;
lightningCapSlot.zeusCharges[0][2] = 3;
lightningCapSlot.pendingZeusAction = true;
lightningCapSlot.currentBonusBoard = olympusGrid.map(row => [...row]);
lightningCapSlot.currentBonusCellStates = olympusGrid.map(row => row.map(() => ({ wild: false, chargeLevel: 3, cursed: false })));
assert(lightningCapSlot.getZeusChoices().includes('OVERCHARGE'), 'Lightning Relic offers Overcharge from level three');
lightningCapSlot.applyZeusAction('OVERCHARGE');
assert(lightningCapSlot.zeusCharges[0][0] === 4, 'Lightning Relic Overcharge respects its extended cap');

const riftLightning = createBonusSlot('RIFT', olympusGrid);
riftLightning.activeRelic = 'LIGHTNING';
const riftLightningOutcome = riftLightning.generateSpinOutcome();
assert(riftLightningOutcome.pendingZeusAction, 'Lightning Relic enables a Zeus network on the Rift path');

const olympusSoulGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
olympusSoulGrid[0][0] = 'DRACHMA';
const olympusSoul = createBonusSlot('OLYMPUS', olympusSoulGrid);
olympusSoul.activeRelic = 'SOUL';
const olympusSoulOutcome = olympusSoul.generateSpinOutcome();
assert(olympusSoulOutcome.matrix[0][0] === 'DRACHMA', 'Olympus/Soul fixture lands its Drachma symbol');
assert(olympusSoul.soulBank === GAME_RULES.hades.relicSoulValueCap, 'Soul Relic enables capped collection on Olympus');

const underworldPetrifyGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
underworldPetrifyGrid[0][0] = 'MEDUSA';
const underworldPetrify = createBonusSlot('UNDERWORLD', underworldPetrifyGrid);
underworldPetrify.activeRelic = 'PETRIFICATION';
underworldPetrify.generateSpinOutcome();
let underworldPetrifyIndex = 0;
const underworldNoCurse = Array.from({ length: 25 }, () => (GAME_RULES.symbols.indexOf('SIGIL') + 0.25) / GAME_RULES.symbols.length);
underworldPetrify.random = () => underworldNoCurse[underworldPetrifyIndex++] ?? 0;
const underworldPetrified = underworldPetrify.generateSpinOutcome();
assert(underworldPetrified.matrix[0][0] === 'ZEUS' && underworldPetrify.petrifiedTurns[0][0] === 2, 'Petrification Relic preserves a Medusa Wild on Underworld');

const soulRelicGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
soulRelicGrid[0][0] = 'DRACHMA';
const soulRelicSlot = createBonusSlot('UNDERWORLD', soulRelicGrid);
soulRelicSlot.activeRelic = 'SOUL';
soulRelicSlot.generateSpinOutcome();
assert(soulRelicSlot.soulBank === 7, 'Soul Relic increases a Drachma collection by two CR');

const medusaGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
medusaGrid[0][0] = 'MEDUSA';
const medusaSlot = createBonusSlot('RIFT', medusaGrid);
const curseOutcome = medusaSlot.generateSpinOutcome();
assert(curseOutcome.cellStates[0][0].cursed, 'Medusa applies a one-turn curse to its cell');
let medusaIndex = 0;
const expiredCurseGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
const expiredCurseSymbols = expiredCurseGrid.flat().map(symbol => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length);
medusaSlot.random = () => expiredCurseSymbols[medusaIndex++] ?? 0;
const petrifyOutcome = medusaSlot.generateSpinOutcome();
assert(petrifyOutcome.matrix[0][0] === 'ZEUS' && petrifyOutcome.cellStates[0][0].petrified, 'An expired curse petrifies into a Wild');

const relicMedusaGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
relicMedusaGrid[0][0] = 'MEDUSA';
const relicMedusa = createBonusSlot('RIFT', relicMedusaGrid);
relicMedusa.activeRelic = 'PETRIFICATION';
relicMedusa.generateSpinOutcome();
let relicIndex = 0;
const relicExpiredGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
const relicSymbols = relicExpiredGrid.flat().map(symbol => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length);
relicMedusa.random = () => relicSymbols[relicIndex++] ?? 0;
relicMedusa.generateSpinOutcome();
const preserved = relicMedusa.generateSpinOutcome();
assert(preserved.matrix[0][0] === 'ZEUS' && relicMedusa.petrifiedTurns[0][0] === 1, 'Petrification Relic preserves the converted Wild for two turns');

const aresGrid = Array.from({ length: 5 }, () => Array(5).fill('ARES'));
const aresSlot = createBonusSlot('UNDERWORLD', aresGrid, noProgressionRewards);
aresSlot.random = () => (GAME_RULES.symbols.indexOf('ARES') + 0.25) / GAME_RULES.symbols.length;
let aresReward = 0;
for (let turn = 0; turn < GAME_RULES.ares.target; turn++) {
    const outcome = aresSlot.generateSpinOutcome();
    aresReward += outcome.totalWin;
    if (outcome.typhonTriggered) aresSlot.selectTyphonAction('ABYSSAL_WRATH');
}
assert(aresSlot.aresChallenge.completed && aresSlot.aresChallenge.paid, 'Ares contract completes at its configured objective');
assert(aresReward > 0 && aresSlot.getEventHistory().filter(event => event.type === 'ares-contract-completed').length === 1, 'Ares reward is included in outcomes and paid once');

const failedAresGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
const failedAres = createBonusSlot('UNDERWORLD', failedAresGrid);
failedAres.aresChallenge = {
    objective: 'Test failure', target: 3, progress: 0, turnsLeft: 8,
    completed: false, failed: false, paid: false
};
const failedAresContract = failedAres.aresChallenge;
failedAres.random = () => (GAME_RULES.symbols.indexOf('SIGIL') + 0.25) / GAME_RULES.symbols.length;
for (let turn = 0; turn < GAME_RULES.bonusMaxAwardedTurns && failedAres.inBonus; turn++) {
    const outcome = failedAres.generateSpinOutcome();
    if (outcome?.typhonTriggered) failedAres.selectTyphonAction('ABYSSAL_WRATH');
    if (failedAres.checkBonusEnd().ended) break;
}
assert(failedAresContract.failed, 'Ares contract fails after its configured turns without progress');
assert(failedAres.getEventHistory().findIndex(event => event.type === 'ares-contract-failed') < failedAres.getEventHistory().findIndex(event => event.type === 'bonus-end'), 'Ares failure is logged before bonus end');
assert(failedAres.getEventHistory().filter(event => event.type === 'ares-contract-failed').length === 1, 'Ares contract failure is recorded exactly once');

const riftGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
['RIFT', 'ZEUS', 'HADES', 'MEDUSA', 'ARES'].forEach((symbol, row) => { riftGrid[row][0] = symbol; });
const rift = createBonusSlot('RIFT', riftGrid);
const riftOutcome = rift.generateSpinOutcome();
assert(riftOutcome.matrix.map(row => row[0]).join(',') === 'ARES,RIFT,ZEUS,HADES,MEDUSA', 'Rift rotates a marked column down with wraparound');
assert(riftOutcome.riftShifts === 1, 'A Rift-marked column shifts exactly once per turn');
assert(rift.getEventHistory().some(event => event.type === 'rift-columns-shifted'), 'Rift shift is recorded by the engine');

const poseidonGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
['POSEIDON', 'CHARGE', 'HADES', 'MEDUSA', 'ARES'].forEach((symbol, column) => { poseidonGrid[0][column] = symbol; });
const poseidon = createBonusSlot('OLYMPUS', poseidonGrid);
poseidon.zeusCharges[0][1] = 2;
poseidon.medusaCurseTurns[0][3] = 1;
const poseidonOutcome = poseidon.generateSpinOutcome();
assert(poseidonOutcome.matrix[0].join(',') === 'ARES,POSEIDON,CHARGE,HADES,ZEUS', 'Poseidon shifts a marked row right before the moved curse petrifies');
assert(poseidon.zeusCharges[0][2] === 3 && poseidonOutcome.cellStates[0][4].petrified, 'Poseidon moves charge and curse state with cells');

const zeusMedusaGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
[0, 1, 2].forEach(column => { zeusMedusaGrid[0][column] = 'CHARGE'; });
zeusMedusaGrid[1][0] = 'MEDUSA';
const zeusMedusa = createBonusSlot('OLYMPUS', zeusMedusaGrid);
const combinedOutcome = zeusMedusa.generateSpinOutcome();
assert(combinedOutcome.pendingZeusAction && combinedOutcome.cellStates[1][0].cursed, 'Zeus network checkpoint coexists with Medusa curse state');
const combinedDischarge = zeusMedusa.applyZeusAction('DISCHARGE');
assert(combinedDischarge.matrix[0].slice(0, 3).every(symbol => symbol === 'ZEUS'), 'Zeus discharge transforms only its charged network');
const postDischarge = zeusMedusa.generateSpinOutcome();
assert(postDischarge.matrix[1][0] === 'ZEUS' && postDischarge.cellStates[1][0].petrified, 'Medusa curse persists through Zeus action and petrifies next turn');

const medusaPoseidonGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
medusaPoseidonGrid[0] = ['SIGIL', 'MEDUSA', 'POSEIDON', 'SIGIL', 'SIGIL'];
const medusaPoseidon = createBonusSlot('RIFT', medusaPoseidonGrid);
medusaPoseidon.medusaCurseTurns[0][1] = 1;
const medusaPoseidonOutcome = medusaPoseidon.generateSpinOutcome();
assert(medusaPoseidonOutcome.matrix[0][2] === 'ZEUS' && medusaPoseidonOutcome.cellStates[0][2].petrified, 'Poseidon moves a cursed Medusa cell before petrification evaluation');

const hadesAresGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
hadesAresGrid[0][0] = 'DRACHMA';
hadesAresGrid[0][1] = 'ARES';
const hadesAres = createBonusSlot('UNDERWORLD', hadesAresGrid);
const hadesAresRolls = hadesAresGrid.flat().map(symbol => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length);
let hadesAresIndex = 0;
hadesAres.random = () => hadesAresRolls[hadesAresIndex++ % hadesAresRolls.length];
const hadesAresOutcome = hadesAres.generateSpinOutcome();
assert(hadesAres.soulBank === GAME_RULES.hades.soulValue && hadesAres.aresChallenge.progress === 1, 'Hades collection and Ares progress both resolve once on the same bonus turn');
assert(hadesAresOutcome.totalWin >= 0, 'Combined Hades/Ares turn still settles through one payout result');

const zeusTyphonGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
[0, 1, 2].forEach(column => { zeusTyphonGrid[0][column] = 'CHARGE'; });
zeusTyphonGrid[1].fill('ARES');
const zeusTyphon = createBonusSlot('OLYMPUS', zeusTyphonGrid);
primeFinalTyphonStage(zeusTyphon);
zeusTyphon.aresChallenge.progress = GAME_RULES.ares.target - 1;
const zeusTyphonOutcome = zeusTyphon.generateSpinOutcome();
assert(zeusTyphonOutcome.pendingZeusAction && zeusTyphonOutcome.typhonTriggered, 'Zeus network and Typhon choice can coexist');
zeusTyphon.selectTyphonAction('ABYSSAL_WRATH');
assert(!zeusTyphon.canSpin() && zeusTyphon.pendingZeusAction, 'Typhon resolution preserves the pending Zeus choice');
assert(zeusTyphon.applyZeusAction('DISCHARGE') !== null, 'Zeus action resumes after Typhon resolution');

const aresTyphonGrid = Array.from({ length: 5 }, () => Array(5).fill('ARES'));
const aresTyphon = createBonusSlot('UNDERWORLD', aresTyphonGrid);
primeFinalTyphonStage(aresTyphon);
const aresTyphonOutcome = aresTyphon.generateSpinOutcome();
assert(aresTyphonOutcome.typhonTriggered && aresTyphon.aresChallenge.progress === 1, 'Ares progress is retained when Typhon interrupts the bonus');
aresTyphon.selectTyphonAction('ABYSSAL_WRATH');
assert(aresTyphon.aresChallenge.progress === 1 && aresTyphon.aresChallenge.paid === false, 'Typhon resolution does not erase or prematurely pay Ares progress');

const retriggerGrid = Array.from({ length: 5 }, () => Array(5).fill('SIGIL'));
retriggerGrid[0][0] = 'SEAL';
retriggerGrid[1][1] = 'SEAL';
retriggerGrid[2][2] = 'SEAL';
const retriggerValues = retriggerGrid.flat().map(symbol => (GAME_RULES.symbols.indexOf(symbol) + 0.25) / GAME_RULES.symbols.length);
let retriggerIndex = 0;
const retriggerSlot = createBonusSlot('RIFT', retriggerGrid);
retriggerSlot.random = () => retriggerValues[retriggerIndex++ % retriggerValues.length];
const retriggerOutcome = retriggerSlot.generateSpinOutcome();
assert(!retriggerOutcome.bonusRetriggered && retriggerOutcome.bonusTurnsAdded === 0, 'Bonus scatters do not retrigger a survival stage');
assert(retriggerSlot.bonusSpinsLeft === 9 && retriggerSlot.survivalSpinsLeft === 9, 'Scatter symbols do not extend the fixed ten-spin stage');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
