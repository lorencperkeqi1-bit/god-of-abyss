export const SYMBOLS = [
    'ZEUS', 'HADES', 'MEDUSA', 'POSEIDON', 'ARES', 'TYPHON',
    'SIGIL', 'SKULL', 'DRACHMA', 'SEAL', 'CHARGE', 'RIFT'
];

const basePaylines = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [3, 3, 3, 3, 3],
    [0, 1, 2, 1, 0],
    [3, 2, 1, 2, 3],
    [1, 0, 0, 0, 1],
    [2, 3, 3, 3, 2],
    [0, 1, 0, 1, 0],
    [3, 2, 3, 2, 3]
];

const bonusPaylines = [
    ...basePaylines,
    [4, 4, 4, 4, 4],
    [0, 1, 2, 3, 4],
    [4, 3, 2, 1, 0],
    [1, 2, 3, 2, 1]
];

export const GAME_RULES = Object.freeze({
    columns: 5,
    baseRows: 4,
    bonusRows: 5,
    symbols: SYMBOLS,
    reelStrips: Array.from({ length: 5 }, () => SYMBOLS),
    betting: Object.freeze({
        stakeLevels: Object.freeze([5, 10, 15, 25, 40, 50, 75, 100, 150, 200, 300, 500])
    }),
    naturalBonus: Object.freeze({
        scatterTriggerChance: 0.01
    }),
    paylines: Object.freeze({
        4: Object.freeze(basePaylines.map(line => Object.freeze(line))),
        5: Object.freeze(bonusPaylines.map(line => Object.freeze(line)))
    }),
    wildSymbol: 'ZEUS',
    scatterSymbol: 'SEAL',
    scatterTriggerCount: 3,
    scatterPayout: 0,
    bonusTurns: 10,
    bonusRetriggerTurns: 4,
    bonusMaxAwardedTurns: 56,
    maxWinStakeMultiplier: 5000,
    bonusMeter: Object.freeze({
        thresholds: Object.freeze([10, 40, 70]),
        stageRewards: Object.freeze([
            Object.freeze({ bonusTurns: 1, megaWildTurns: 1 }),
            Object.freeze({ bonusTurns: 2, megaWildTurns: 2 })
        ]),
        wrathMultiplierPerStage: 0.5,
        titanBonusTurnsPerStage: 1
    }),
    bonusSurvival: Object.freeze({
        spinsPerStage: 10,
        stageThresholds: Object.freeze([8, 24, 45]),
        payoutProgressPerStake: 1,
        pathFeatures: Object.freeze({ OLYMPUS: 'ZEUS', UNDERWORLD: 'HADES', RIFT: 'TYPHON' }),
        relicFeatures: Object.freeze({ LIGHTNING: 'ZEUS', SOUL: 'HADES', PETRIFICATION: 'MEDUSA' }),
        secondaryFeatureOrder: Object.freeze(['POSEIDON', 'MEDUSA']),
        featureProgress: Object.freeze({
            ZEUS_CHARGE: 0.35,
            ZEUS_NETWORK: 2,
            HADES_SOUL: 0.35,
            TYPHON_MULTI_COLUMN: 0.6,
            POSEIDON_MULTIROW: 1.5,
            MEDUSA_MULTI_PETRIFY: 4
        }),
        typhonFinalSpins: 10
    }),
    bonusMultipliers: Object.freeze({ OLYMPUS: 2, UNDERWORLD: 1, RIFT: 1, TYPHON: 2 }),
    buyBonusStakeMultiplier: 100,
    resolutionOrder: Object.freeze(['poseidon-shift', 'rift-shift', 'medusa', 'souls', 'zeus-charge', 'wins', 'ares-contract']),
    zeus: Object.freeze({ chargeCap: 3, networkSize: 3, relicChargeBonus: 1, relicChargeCap: 4 }),
    hades: Object.freeze({ soulSymbol: 'DRACHMA', soulValue: 5, soulCap: 100, relicSoulBonus: 2, relicSoulValueCap: 7 }),
    poseidon: Object.freeze({ shiftSymbol: 'POSEIDON', direction: 'right-wrap' }),
    medusa: Object.freeze({ curseSymbol: 'MEDUSA', petrifyAfterTurns: 1, petrifiedSymbol: 'ZEUS' }),
    ares: Object.freeze({ objectiveSymbol: 'ARES', target: 3, turns: 30, rewardStakeMultiplier: 3 }),
    relics: Object.freeze({
        LIGHTNING: Object.freeze({ path: 'OLYMPUS' }),
        SOUL: Object.freeze({ path: 'UNDERWORLD' }),
        PETRIFICATION: Object.freeze({ path: 'RIFT' })
    }),
    typhon: Object.freeze({ megaWildTurns: 5 }),
    paytable: Object.freeze({
        ZEUS: Object.freeze({ 3: 2, 4: 5, 5: 20 }),
        HADES: Object.freeze({ 3: 1, 4: 3, 5: 12 }),
        MEDUSA: Object.freeze({ 3: 1, 4: 3, 5: 12 }),
        POSEIDON: Object.freeze({ 3: 1, 4: 3, 5: 12 }),
        ARES: Object.freeze({ 3: 1, 4: 3, 5: 12 }),
        TYPHON: Object.freeze({ 3: 1, 4: 3, 5: 12 }),
        SIGIL: Object.freeze({ 3: 0.5, 4: 2, 5: 8 }),
        SKULL: Object.freeze({ 3: 0.5, 4: 2, 5: 8 }),
        DRACHMA: Object.freeze({ 3: 0.4, 4: 1.5, 5: 6 }),
        CHARGE: Object.freeze({ 3: 0.4, 4: 1.5, 5: 6 }),
        RIFT: Object.freeze({ 3: 0.4, 4: 1.5, 5: 6 })
    })
});
