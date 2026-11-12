import { GAME_RULES } from './gameRules.js';

export function evaluateLine(symbols, lineStake, rules = GAME_RULES) {
    if (!Array.isArray(symbols) || symbols.length !== rules.columns) {
        throw new TypeError(`A line must contain ${rules.columns} symbols`);
    }
    if (!Number.isFinite(lineStake) || lineStake < 0) {
        throw new RangeError('Line stake must be a non-negative finite number');
    }

    let bestWin = null;

    for (const [targetSymbol, payouts] of Object.entries(rules.paytable)) {
        let matchCount = 0;
        for (const symbol of symbols) {
            if (symbol === targetSymbol || (targetSymbol !== rules.wildSymbol && symbol === rules.wildSymbol)) {
                matchCount++;
            } else {
                break;
            }
        }

        const payoutMultiplier = payouts[matchCount] ?? 0;
        const payout = payoutMultiplier * lineStake;
        if (payout > 0 && (!bestWin || payout > bestWin.payout)) {
            bestWin = { targetSymbol, matchCount, payoutMultiplier, payout };
        }
    }

    return bestWin;
}

export function evaluateGrid(matrix, stake, rules = GAME_RULES) {
    if (!Number.isFinite(stake) || stake <= 0) {
        throw new RangeError('Stake must be a positive finite number');
    }
    if (!Array.isArray(matrix) || !rules.paylines[matrix.length]) {
        throw new TypeError('Grid row count is not configured');
    }
    if (matrix.some(row => !Array.isArray(row) || row.length !== rules.columns || row.some(symbol => !rules.symbols.includes(symbol)))) {
        throw new TypeError('Grid contains an invalid row or symbol');
    }

    const paylines = rules.paylines[matrix.length];
    const lineStake = stake / paylines.length;
    const wins = [];
    let totalWin = 0;

    paylines.forEach((payline, paylineIndex) => {
        const lineSymbols = payline.map((row, column) => matrix[row][column]);
        const win = evaluateLine(lineSymbols, lineStake, rules);
        if (win) {
            wins.push({ ...win, paylineIndex, lineSymbols });
            totalWin += win.payout;
        }
    });

    const scatterCount = matrix.flat().filter(symbol => symbol === rules.scatterSymbol).length;

    return {
        wins,
        totalWin,
        scatterCount,
        bonusTriggered: scatterCount >= rules.scatterTriggerCount
    };
}
