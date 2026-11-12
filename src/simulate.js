import { pathToFileURL } from 'node:url';
import { GAME_RULES } from './gameRules.js';
import { SlotLogic } from './slotLogic.js';

const BONUS_PATHS = Object.freeze(['OLYMPUS', 'UNDERWORLD', 'RIFT']);

export function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function simulateSessions(sessionCount = 100000, seed = 42, stake = 10, path = 'OLYMPUS') {
    if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
        throw new RangeError('Session count must be a positive integer');
    }
    if (!GAME_RULES.betting.stakeLevels.includes(stake)) {
        throw new RangeError(`Stake must be one of the configured levels: ${GAME_RULES.betting.stakeLevels.join(', ')}`);
    }
    if (!BONUS_PATHS.includes(path)) throw new RangeError('Natural bonus path must be OLYMPUS, UNDERWORLD, or RIFT');

    const slot = new SlotLogic(1_000_000_000, createSeededRandom(seed));
    if (!slot.setStake(stake)) throw new Error('Engine rejected a configured simulation stake');

    let totalWagers = 0;
    let totalSpins = 0;
    let bonusSpins = 0;
    let baseGamePayout = 0;
    let bonusPayout = 0;
    let typhonPayout = 0;
    let bonusCount = 0;
    let scatterQualifiedCount = 0;
    let bonusAwardTotal = 0;
    let hitCount = 0;
    let maxSessionWin = 0;
    let rewardRatioSum = 0;
    let rewardRatioSquareSum = 0;

    for (let session = 0; session < sessionCount; session++) {
        totalWagers += stake;
        let sessionWin = 0;

        const resolveOutcome = (outcome, isBonusSpin) => {
            if (!outcome) throw new Error('Engine rejected a spin during a valid simulation session');

            totalSpins++;
            if (isBonusSpin) bonusSpins++;
            sessionWin += outcome.totalWin;
            if (isBonusSpin) bonusPayout += outcome.totalWin;
            else baseGamePayout += outcome.totalWin;

            const resolveTyphon = () => {
                const balanceBefore = slot.getBalance();
                const bonusWinBefore = slot.currentBonusWin;
                const resolved = slot.selectTyphonAction('ABYSSAL_WRATH');
                if (!resolved) throw new Error('Typhon resolution was rejected by the engine');
                const reward = isBonusSpin
                    ? slot.currentBonusWin - bonusWinBefore
                    : slot.getBalance() - balanceBefore;
                sessionWin += reward;
                typhonPayout += reward;
            };

            if (outcome.typhonTriggered) resolveTyphon();

            if (outcome.pendingZeusAction) {
                const actionResult = slot.applyZeusAction('DISCHARGE');
                if (!actionResult) throw new Error('Simulation could not resolve the valid Zeus Discharge choice');
                sessionWin += actionResult.totalWin;
                bonusPayout += actionResult.totalWin;
                if (actionResult.typhonTriggered) resolveTyphon();
            }
        };

        const baseOutcome = slot.generateSpinOutcome();
        resolveOutcome(baseOutcome, false);
        if (baseOutcome.scatterCount >= slot.rules.scatterTriggerCount) scatterQualifiedCount++;

        if (baseOutcome.bonusTriggered) {
            bonusCount++;
            if (!slot.selectBonusPath(path)) {
                throw new Error('Engine rejected a valid natural bonus choice');
            }
            const relicByPath = { OLYMPUS: 'LIGHTNING', UNDERWORLD: 'SOUL', RIFT: 'PETRIFICATION' };
            if (!slot.selectRelic(relicByPath[path])) {
                throw new Error('Engine rejected the simulation relic policy');
            }

            let bonusSessionWin = 0;
            while (slot.inBonus) {
                const bonusOutcome = slot.generateSpinOutcome();
                const before = sessionWin;
                resolveOutcome(bonusOutcome, true);
                bonusSessionWin += sessionWin - before;
                const end = slot.checkBonusEnd();
                if (end.ended) {
                    if (end.soulReward > 0) {
                        sessionWin += end.soulReward;
                        bonusPayout += end.soulReward;
                        bonusSessionWin += end.soulReward;
                    }
                    break;
                }
            }
            bonusAwardTotal += bonusSessionWin;
        }

        if (sessionWin > 0) hitCount++;
        if (sessionWin > maxSessionWin) maxSessionWin = sessionWin;
        const rewardRatio = sessionWin / stake;
        rewardRatioSum += rewardRatio;
        rewardRatioSquareSum += rewardRatio * rewardRatio;
        slot.history.length = 0;
    }

    const rtp = totalWagers ? (baseGamePayout + bonusPayout + typhonPayout) / totalWagers * 100 : 0;
    const meanRatio = rewardRatioSum / sessionCount;
    const variance = Math.max(0, rewardRatioSquareSum / sessionCount - meanRatio ** 2);
    const standardErrorPercentagePoints = Math.sqrt(variance / sessionCount) * 100;

    return {
        sessionCount,
        seed,
        stake,
        path,
        baseGameSpins: sessionCount,
        totalSpins,
        bonusSpins,
        totalWagers,
        baseGamePayout,
        bonusPayout,
        typhonPayout,
        totalPayouts: baseGamePayout + bonusPayout + typhonPayout,
        rtp,
        baseRtp: baseGamePayout / totalWagers * 100,
        freeSpinRtp: bonusPayout / totalWagers * 100,
        typhonContribution: typhonPayout / totalWagers * 100,
        bonusContribution: (bonusPayout + typhonPayout) / totalWagers * 100,
        bonusCount,
        bonusFrequency: bonusCount ? sessionCount / bonusCount : null,
        scatterQualifiedCount,
        scatterQualifiedFrequency: scatterQualifiedCount ? sessionCount / scatterQualifiedCount : null,
        averageBonusPayout: bonusCount ? bonusAwardTotal / bonusCount : 0,
        hitFrequency: hitCount / sessionCount * 100,
        maxSessionWin,
        standardErrorPercentagePoints
    };
}

export function simulatePathScenarios(sessionCount = 100000, seed = 42, stake = 10) {
    return Object.fromEntries(BONUS_PATHS.map((path, index) => [
        path,
        simulateSessions(sessionCount, (seed + index * 0x9e3779b9) >>> 0, stake, path)
    ]));
}

export function simulatePurchasedBonuses(sessionCount = 1000, seed = 42, stake = 10, path = 'OLYMPUS') {
    if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
        throw new RangeError('Purchase count must be a positive integer');
    }
    if (!GAME_RULES.betting.stakeLevels.includes(stake)) {
        throw new RangeError(`Stake must be one of the configured levels: ${GAME_RULES.betting.stakeLevels.join(', ')}`);
    }
    if (!BONUS_PATHS.includes(path)) {
        throw new RangeError('Purchased bonus path must be OLYMPUS, UNDERWORLD, or RIFT');
    }

    const purchaseCost = stake * 100 * sessionCount;
    const slot = new SlotLogic(purchaseCost + 1_000_000, createSeededRandom(seed));
    if (!slot.setStake(stake)) throw new Error('Engine rejected a configured purchase-simulation stake');
    const relicByPath = { OLYMPUS: 'LIGHTNING', UNDERWORLD: 'SOUL', RIFT: 'PETRIFICATION' };
    let totalPayouts = 0;
    let hitCount = 0;
    let maxBonusPayout = 0;
    let payoutSum = 0;
    let payoutSquareSum = 0;

    for (let purchase = 0; purchase < sessionCount; purchase++) {
        if (!slot.buyBonus(path).success) throw new Error('Engine rejected an affordable bonus purchase');
        if (!slot.selectRelic(relicByPath[path])) throw new Error('Engine rejected the configured purchase relic');

        let bonusPayout = 0;
        while (slot.inBonus) {
            const outcome = slot.generateSpinOutcome();
            if (!outcome) throw new Error('Engine rejected a spin during a purchased bonus');
            bonusPayout += outcome.totalWin;

            if (outcome.typhonTriggered) {
                const before = slot.currentBonusWin;
                if (!slot.selectTyphonAction('ABYSSAL_WRATH')) throw new Error('Engine rejected the configured Typhon action');
                bonusPayout += slot.currentBonusWin - before;
            }
            if (outcome.pendingZeusAction) {
                const action = slot.applyZeusAction('DISCHARGE');
                if (!action) throw new Error('Engine rejected Zeus Discharge during a purchased bonus');
                bonusPayout += action.totalWin;
                if (action.typhonTriggered) {
                    const before = slot.currentBonusWin;
                    if (!slot.selectTyphonAction('ABYSSAL_WRATH')) throw new Error('Engine rejected the configured post-Discharge Typhon action');
                    bonusPayout += slot.currentBonusWin - before;
                }
            }

            const end = slot.checkBonusEnd();
            if (end.ended) bonusPayout += end.soulReward ?? 0;
        }

        totalPayouts += bonusPayout;
        if (bonusPayout > 0) hitCount++;
        if (bonusPayout > maxBonusPayout) maxBonusPayout = bonusPayout;
        payoutSum += bonusPayout;
        payoutSquareSum += bonusPayout * bonusPayout;
        slot.history.length = 0;
    }

    const meanPayout = payoutSum / sessionCount;
    const variance = Math.max(0, payoutSquareSum / sessionCount - meanPayout ** 2);
    return {
        sessionCount,
        seed,
        stake,
        path,
        purchaseCost,
        totalPayouts,
        returnPercentage: totalPayouts / purchaseCost * 100,
        averagePayout: meanPayout,
        hitFrequency: hitCount / sessionCount * 100,
        maxBonusPayout,
        standardError: Math.sqrt(variance / sessionCount)
    };
}

export function printReport(result) {
    console.log(`[MATH AUDIT] ${result.baseGameSpins.toLocaleString()} base-game spins, ${result.path} path, seed ${result.seed}`);
    console.log('================================================');
    console.log('GODS OF THE ABYSS - ENGINE-BACKED AUDIT');
    console.log('================================================');
    console.log(`Stake per paid session:          ${result.stake.toLocaleString()} CR`);
    console.log(`Total resolved spins:            ${result.totalSpins.toLocaleString()} (${result.bonusSpins.toLocaleString()} bonus spins)`);
    console.log(`Total qualifying wagers:         ${result.totalWagers.toLocaleString()} CR`);
    console.log(`Base-game line payouts:          ${result.baseGamePayout.toLocaleString()} CR`);
    console.log(`Free-spin line payouts:          ${result.bonusPayout.toLocaleString()} CR`);
    console.log(`Typhon rewards:                  ${result.typhonPayout.toLocaleString()} CR`);
    console.log(`Total payouts:                   ${result.totalPayouts.toLocaleString()} CR`);
    console.log(`Base-game RTP contribution:      ${result.baseRtp.toFixed(2)}%`);
    console.log(`Free-spin RTP contribution:      ${result.freeSpinRtp.toFixed(2)}%`);
    console.log(`Typhon RTP contribution:         ${result.typhonContribution.toFixed(2)}%`);
    console.log(`Total bonus RTP contribution:    ${result.bonusContribution.toFixed(2)}%`);
    console.log(`Observed total RTP:              ${result.rtp.toFixed(2)}%`);
    console.log(`Session hit frequency:           ${result.hitFrequency.toFixed(2)}%`);
    console.log(`Scatter-qualified frequency:     ${result.scatterQualifiedFrequency === null ? 'none' : `1 in ${result.scatterQualifiedFrequency.toFixed(1)} base spins`} (${result.scatterQualifiedCount})`);
    console.log(`Natural ${result.path} frequency:          ${result.bonusFrequency === null ? 'none' : `1 in ${result.bonusFrequency.toFixed(1)} base spins`} (${result.bonusCount})`);
    console.log(`Average bonus payout:            ${result.averageBonusPayout.toFixed(2)} CR`);
    console.log(`Maximum observed win:            ${result.maxSessionWin.toLocaleString()} CR per paid session`);
    console.log(`RTP standard error (approx.):    +/-${(1.96 * result.standardErrorPercentagePoints).toFixed(2)} percentage points (95% interval)`);
    console.log('Theoretical RTP is not reported: the bonus and Typhon state process has no closed-form derivation here.');
    console.log('================================================');
}

export function printPathScenariosReport(scenarios) {
    const results = Object.values(scenarios);
    const baseGameSpins = results.reduce((sum, result) => sum + result.baseGameSpins, 0);
    const totalResolvedSpins = results.reduce((sum, result) => sum + result.totalSpins, 0);
    const bonusSpins = results.reduce((sum, result) => sum + result.bonusSpins, 0);
    const naturalBonusCount = results.reduce((sum, result) => sum + result.bonusCount, 0);
    const weightedBonusPayout = results.reduce(
        (sum, result) => sum + result.averageBonusPayout * result.bonusCount,
        0
    );
    const averageBonusPayout = naturalBonusCount ? weightedBonusPayout / naturalBonusCount : 0;
    const maxObservedWin = Math.max(...results.map(result => result.maxSessionWin));

    console.log('GODS OF THE ABYSS - ENGINE-BACKED NATURAL BONUS AUDIT');
    console.log('======================================================');
    console.log(`Base-game spins per path:        ${results[0].baseGameSpins.toLocaleString()}`);
    console.log(`Total base-game spins:           ${baseGameSpins.toLocaleString()}`);
    console.log(`Total resolved spins:            ${totalResolvedSpins.toLocaleString()} (${bonusSpins.toLocaleString()} bonus spins)`);
    console.log(`Natural gate after 3+ Seals:     ${(GAME_RULES.naturalBonus.scatterTriggerChance * 100).toFixed(2)}%`);
    console.log('');
    console.log(`Natural path frequency (separate ${results[0].baseGameSpins.toLocaleString()}-spin engine runs):`);
    console.log('Path         Triggers    Frequency        Base RTP    Bonus RTP    Total RTP');
    for (const [path, result] of Object.entries(scenarios)) {
        const frequency = result.bonusFrequency === null ? 'none' : `1 in ${result.bonusFrequency.toFixed(1)}`;
        console.log(
            `${path.padEnd(13)}${String(result.bonusCount).padEnd(12)}${frequency.padEnd(17)}`
            + `${result.baseRtp.toFixed(2).padStart(7)}%    `
            + `${result.bonusContribution.toFixed(2).padStart(7)}%    `
            + `${result.rtp.toFixed(2).padStart(7)}%`
        );
    }
    console.log('');
    console.log(`Combined natural triggers:       ${naturalBonusCount} / ${baseGameSpins}`);
    console.log(`Combined natural frequency:      ${naturalBonusCount ? `1 in ${(baseGameSpins / naturalBonusCount).toFixed(1)} base spins` : 'none'}`);
    console.log(`Average natural bonus payout:    ${averageBonusPayout.toFixed(2)} CR`);
    console.log(`Maximum observed win:            ${maxObservedWin.toLocaleString()} CR per paid session`);
    console.log('Base RTP is base-game line payouts / base wagers. Bonus RTP includes free-spin and Typhon awards.');
    console.log('Total RTP is all engine payouts / paid base-game wagers; purchased bonuses are excluded.');
    console.log('======================================================');
    for (const result of results) printReport(result);
}

export function printPurchaseReport(result) {
    console.log(`[MATH AUDIT] ${result.sessionCount.toLocaleString()} purchased ${result.path} bonuses, seed ${result.seed}`);
    console.log('================================================');
    console.log('GODS OF THE ABYSS - PURCHASE RETURN');
    console.log('================================================');
    console.log(`Stake per purchase:              ${result.stake.toLocaleString()} CR`);
    console.log(`Purchase cost per bonus:         ${(result.stake * 100).toLocaleString()} CR`);
    console.log(`Total purchase cost:             ${result.purchaseCost.toLocaleString()} CR`);
    console.log(`Total bonus payouts:             ${result.totalPayouts.toLocaleString()} CR`);
    console.log(`Observed purchased-bonus return: ${result.returnPercentage.toFixed(2)}%`);
    console.log(`Average bonus payout:            ${result.averagePayout.toFixed(2)} CR`);
    console.log(`Bonus hit frequency:             ${result.hitFrequency.toFixed(2)}%`);
    console.log(`Maximum observed bonus payout:   ${result.maxBonusPayout.toLocaleString()} CR`);
    console.log(`Approx. 95% interval:            +/-${(1.96 * result.standardError / (result.stake * 100) * 100).toFixed(2)} percentage points`);
    console.log('Purchase return is separate from natural base-game RTP.');
    console.log('================================================');
}

const directScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directScript) {
    const requestedSessions = Number.parseInt(process.argv[2], 10);
    const requestedSeed = Number.parseInt(process.argv[3], 10);
    const requestedStake = Number.parseInt(process.argv[4], 10);
    const requestedPath = process.argv[5];
    const sessions = Number.isInteger(requestedSessions) && requestedSessions > 0 ? requestedSessions : 100000;
    const seed = Number.isInteger(requestedSeed) ? requestedSeed : 42;
    const stake = Number.isInteger(requestedStake) ? requestedStake : 10;
    if (requestedPath) printPurchaseReport(simulatePurchasedBonuses(sessions, seed, stake, requestedPath));
    else printPathScenariosReport(simulatePathScenarios(sessions, seed, stake));
}