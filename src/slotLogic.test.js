import { SlotLogic } from './slotLogic.js';
import { GAME_RULES } from './gameRules.js';

function runSlotLogicTests() {
    console.log('=== RUNNING SLOT LOGIC TESTS ===');
    let passed = 0;
    let failed = 0;

    function assert(condition, name) {
        if (condition) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            failed++;
        }
    }

    function primeFinalTyphonStage(slot) {
        slot.typhonMeterProgress = slot.rules.bonusMeter.thresholds[2] - 1;
        slot.typhonMeter = slot.typhonMeterProgress / slot.rules.bonusMeter.thresholds[2] * 100;
        slot.typhonStage = 3;
        slot.typhonPowerLevel = 3;
        slot.typhonTriggered = true;
        if (slot.inBonus) slot.survivalStage = 4;
    }

    const slot = new SlotLogic(2000, () => 0);

    assert(slot.getBalance() === 2000, 'Starting balance is retained');
    let invalidBalanceRejected = false;
    try {
        new SlotLogic(-1);
    } catch {
        invalidBalanceRejected = true;
    }
    assert(invalidBalanceRejected, 'Negative starting balance is rejected');
    assert(slot.setStake(5), 'Minimum stake is accepted');
    assert(!slot.setStake(4), 'Stake below minimum is rejected');
    assert(slot.setStake(500), 'Maximum stake is accepted');
    assert(!slot.setStake(505), 'Stake above maximum is rejected');
    for (const level of GAME_RULES.betting.stakeLevels) {
        assert(slot.setStake(level) && slot.getStake() === level, `Configured stake level ${level} is accepted`);
    }
    assert(!slot.setStake(20), 'An unconfigured stake level is rejected');
    slot.setStake(10);

    assert(slot.getBuyBonusCost() === 1000, 'Bonus cost is 100 times stake');
    const purchase = slot.buyBonus('OLYMPUS');
    assert(purchase.success, 'Bonus purchase succeeds with sufficient balance');
    assert(slot.getBalance() === 1000, 'Bonus purchase deducts its cost');
    assert(slot.rows === 5 && slot.bonusSpinsLeft === 10, 'Bonus purchase initializes five rows and ten survival turns');
    assert(slot.pendingRelicSelection, 'Bonus entry offers exactly one relic selection');
    assert(slot.selectRelic('LIGHTNING'), 'A valid relic can be selected');
    assert(!slot.selectRelic('LIGHTNING'), 'Relic selection cannot be repeated');
    assert(!slot.setStake(15), 'Stake cannot change during a bonus');

    let bonusEndResult = { ended: false };
    for (let spin = 0; spin < GAME_RULES.bonusMaxAwardedTurns + 2 && slot.inBonus; spin++) {
        const outcome = slot.generateSpinOutcome();
        if (outcome.typhonTriggered) slot.selectTyphonAction('ABYSSAL_WRATH');
        bonusEndResult = slot.checkBonusEnd();
    }
    assert(bonusEndResult.ended, 'Final bonus turn settles exactly once');
    assert(!slot.inBonus && slot.rows === 4, 'Bonus completion restores base-game state');
    assert(slot.getBalance() === 1000 + slot.getRoundPayout(), 'Bonus wins and Typhon rewards are credited once at completion');
    assert(!slot.checkBonusEnd().ended, 'Bonus completion cannot settle a second time');

    for (const path of ['OLYMPUS', 'UNDERWORLD', 'RIFT']) {
        const purchasedPath = new SlotLogic(2000, () => 0);
        const pathPurchase = purchasedPath.buyBonus(path);
        assert(pathPurchase.success && purchasedPath.bonusChoice === path, `Buy Bonus enters ${path} directly`);
        assert(purchasedPath.pendingRelicSelection && !purchasedPath.canSpin(), `${path} purchase waits for its relic choice`);
    }

    const poorSlot = new SlotLogic(999, () => 0);
    assert(!poorSlot.canBuyBonus(), 'Bonus purchase is blocked when balance is insufficient');
    assert(!poorSlot.buyBonus().success, 'Insufficient balance does not start a bonus');
        const emptySlot = new SlotLogic(0, () => 0);
        assert(!emptySlot.canSpin(), 'Spin is blocked when balance is below stake');
        assert(emptySlot.generateSpinOutcome() === null, 'Blocked spin does not generate an outcome');

        const invalidRandomSlot = new SlotLogic(100, () => 1);
        let invalidRandomRejected = false;
        try {
            invalidRandomSlot.generateSpinOutcome();
        } catch {
            invalidRandomRejected = true;
        }
        assert(invalidRandomRejected, 'Out-of-range random values are rejected');
        assert(invalidRandomSlot.getBalance() === 100, 'Failed outcome generation does not deduct stake');

        const historySlot = new SlotLogic(100, () => 0);
        historySlot.generateSpinOutcome();
        const historySnapshot = historySlot.getEventHistory();
        historySnapshot.find(event => event.type === 'spin-resolved').totalWin = -1;
        const historySpin = historySlot.getEventHistory().find(event => event.type === 'spin-resolved');
        assert(historySpin.totalWin >= 0, 'History snapshots cannot mutate engine records');
        assert(historySpin.turn === 1 && historySpin.mode === 'base', 'Base spin event records its paid turn');

        const turnHistorySlot = new SlotLogic(2000, () => 0);
        turnHistorySlot.buyBonus('OLYMPUS');
        turnHistorySlot.selectRelic('LIGHTNING');
        const turnOutcome = turnHistorySlot.generateSpinOutcome();
        turnHistorySlot.typhonTriggered = true;
        turnHistorySlot.typhonPowerLevel = 2;
        turnHistorySlot.selectTyphonAction('ABYSSAL_WRATH');
        turnHistorySlot.bonusSpinsLeft = 0;
        turnHistorySlot.checkBonusEnd();
        const bonusEvents = turnHistorySlot.getEventHistory();
        const bonusStart = bonusEvents.find(event => event.type === 'bonus-start');
        const relicEvent = bonusEvents.find(event => event.type === 'relic-selected');
        const spinEvent = bonusEvents.find(event => event.type === 'spin-resolved');
        const typhonEvent = bonusEvents.find(event => event.type === 'typhon-choice');
        const bonusEndEvent = bonusEvents.find(event => event.type === 'bonus-end');
        assert(bonusStart.turn === 0 && bonusStart.mode === 'bonus' && bonusStart.path === 'OLYMPUS', 'Bonus start event records path at turn zero');
        assert(relicEvent.turn === 0 && relicEvent.path === 'OLYMPUS', 'Relic selection is attributed to the bonus entry');
        assert(spinEvent.bonusTurn === 1 && spinEvent.type === 'spin-resolved', 'First bonus spin records bonus turn one');
        assert(typhonEvent.turn === 1 && typhonEvent.path === 'OLYMPUS', 'Typhon choice records the interrupted bonus turn');
        assert(bonusEndEvent.turn === 1 && bonusEndEvent.path === 'OLYMPUS', 'Bonus end preserves final turn and path after cleanup');
        assert(bonusEvents.every((event, index) => event.sequence === index + 1), 'Event sequence remains strictly chronological');

        const baseTyphonHistory = new SlotLogic(1000, () => 0);
        baseTyphonHistory.generateSpinOutcome();
        baseTyphonHistory.typhonTriggered = true;
        baseTyphonHistory.typhonPowerLevel = 3;
        baseTyphonHistory.selectTyphonAction('TITAN_ASCENDANCE');
        const titanEvent = baseTyphonHistory.getEventHistory().find(event => event.type === 'typhon-choice');
        assert(titanEvent.sourceMode === 'base' && titanEvent.sourceTurn === 1, 'Base-game Ascendance retains the triggering paid-spin turn');
        assert(titanEvent.megaWildSpinsAdded === 8, 'Ascension power improves Titan Ascendance Mega Wild turns');

        for (const path of ['OLYMPUS', 'UNDERWORLD', 'RIFT']) {
            const pathSymbols = [0.8, 0.8, 0.8, ...Array(97).fill(0)];
            let pathIndex = 0;
            const pathSlot = new SlotLogic(1000, () => pathSymbols[pathIndex++] ?? 0);
            const trigger = pathSlot.generateSpinOutcome();
            assert(trigger.bonusTriggered, `${path} fixture naturally triggers Divine Convergence`);
            assert(pathSlot.selectBonusPath(path), `${path} accepts a valid pending choice`);
            assert(pathSlot.bonusChoice === path && pathSlot.bonusSpinsLeft === 10, `${path} starts a ten-spin survival bonus`);
            assert(pathSlot.rows === 5, `${path} path uses five bonus rows`);
            assert(!pathSlot.selectBonusPath(path), `${path} rejects duplicate entry`);
            assert(pathSlot.selectRelic('LIGHTNING'), `${path} accepts one valid relic selection`);
        }

        const sealSymbols = [0.8, 0.8, 0.8, ...Array(17).fill(0)];
        let sealIndex = 0;
        const sealSlot = new SlotLogic(1000, () => sealSymbols[sealIndex++] ?? 0);
        const sealOutcome = sealSlot.generateSpinOutcome();
        assert(sealOutcome.bonusTriggered, 'Three or more Seals trigger the bonus');
        assert(sealOutcome.matrix.flat().filter(symbol => symbol === 'SEAL').length === 3, 'Seal trigger uses the generated grid');

        const twoSealSymbols = [0.8, 0.8, ...Array(18).fill(0)];
        let twoSealIndex = 0;
        const twoSealSlot = new SlotLogic(1000, () => twoSealSymbols[twoSealIndex++] ?? 0);
        assert(!twoSealSlot.generateSpinOutcome().bonusTriggered, 'Fewer than three Seals do not trigger the bonus');

        const simultaneousSymbols = [0.8, 0.8, 0.8, ...Array(17).fill(0.5), 0];
        let simultaneousIndex = 0;
        const simultaneousSlot = new SlotLogic(1000, () => simultaneousSymbols[simultaneousIndex++] ?? 0.5);
        const simultaneousOutcome = simultaneousSlot.generateSpinOutcome();
        assert(simultaneousOutcome.bonusTriggered && !simultaneousOutcome.typhonTriggered, 'Base-game bonus entry does not also activate a meter stage');
        assert(!simultaneousSlot.canSpin(), 'Both simultaneous choices block the next spin');
        assert(simultaneousSlot.selectBonusPath('RIFT'), 'Queued natural entry accepts the selected path');
        assert(simultaneousSlot.bonusSpinsLeft === 10 && simultaneousSlot.survivalSpinsLeft === 10
            && simultaneousSlot.megaWildSpins === 0, 'Natural bonus starts with a fresh ten-spin stage and no inherited meter rewards');
        assert(simultaneousSlot.selectRelic('PETRIFICATION'), 'Simultaneous bonus resolves its relic choice');
        const megaWildOutcome = simultaneousSlot.generateSpinOutcome();
        assert(!megaWildOutcome.matrix.flat().every(symbol => symbol === 'ZEUS'), 'Base-game payouts grant no bonus-stage Mega Wild turns');

        const triggerValues = [...Array(3).fill(0.8), ...Array(17).fill(0), 0.009];
        let triggerIndex = 0;
        const naturalTriggerSlot = new SlotLogic(1000, () => triggerValues[triggerIndex++] ?? 0.009);
        naturalTriggerSlot.setStake(25);
        const naturalTriggerOutcome = naturalTriggerSlot.generateSpinOutcome();
        assert(naturalTriggerOutcome.bonusTriggered, 'A scatter-qualified board triggers when the independent gate roll is below 1%');
        assert(naturalTriggerOutcome.scatterCount === 3, 'Natural bonus trigger preserves the scatter threshold');
        assert(naturalTriggerSlot.getBalance() === 1000 - 25 + naturalTriggerOutcome.totalWin,
            'Natural bonus trigger deducts the selected 25-credit stake exactly once');
        const firstNaturalPathSelection = naturalTriggerSlot.selectBonusPath('OLYMPUS');
        const duplicateNaturalPathSelection = naturalTriggerSlot.selectBonusPath('OLYMPUS');
        assert(firstNaturalPathSelection && !duplicateNaturalPathSelection, 'One natural trigger can enter its bonus only once');

        const missedTriggerValues = [...Array(3).fill(0.8), ...Array(17).fill(0), 0.01];
        let missedTriggerIndex = 0;
        const missedTriggerSlot = new SlotLogic(1000, () => missedTriggerValues[missedTriggerIndex++] ?? 0);
        const missedTriggerOutcome = missedTriggerSlot.generateSpinOutcome();
        assert(missedTriggerOutcome.scatterCount === 3 && !missedTriggerOutcome.bonusTriggered,
            'A scatter-qualified board does not trigger when its gate roll is outside the configured probability');
        assert(!missedTriggerSlot.pendingBonusEntry, 'A missed natural trigger roll does not create pending bonus state');

    const titanSlot = new SlotLogic(2000, () => 0);
    primeFinalTyphonStage(titanSlot);
    titanSlot.generateSpinOutcome();
    titanSlot.selectTyphonAction('TITAN_ASCENDANCE');
    assert(titanSlot.inBonus && titanSlot.bonusSpinsLeft === GAME_RULES.bonusTurns + 8, 'Titan Ascendance adds carried Stage 1 and 2 power to the standard bonus turns');
    assert(titanSlot.megaWildSpins === 8 && titanSlot.pendingRelicSelection, 'Powered Titan Ascendance starts Mega Wild turns and requests one relic');

    console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}\n`);
    if (failed > 0) process.exitCode = 1;
}

runSlotLogicTests();