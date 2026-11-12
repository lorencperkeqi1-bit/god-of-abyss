import { AutoPlayController } from './autoPlayController.js';
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

for (const count of [10, 25, 50, 100, 37]) {
    const autoplay = new AutoPlayController();
    autoplay.startBase(count);
    assert(autoplay.remainingSpins === count, `Base autoplay accepts ${count} spins`);
    for (let spin = 0; spin < count; spin++) {
        const outcome = autoplay.completeBaseSpin();
        assert(outcome === (spin === count - 1 ? 'complete' : 'continue'),
            `${count}-spin autoplay resolves spin ${spin + 1} once`);
    }
    assert(autoplay.remainingSpins === 0 && !autoplay.active, `${count}-spin autoplay stops at zero`);
}

const invalidCount = new AutoPlayController();
let rejectedInvalidCount = false;
try {
    invalidCount.startBase(0);
} catch (error) {
    rejectedInvalidCount = error instanceof RangeError;
}
assert(rejectedInvalidCount, 'Zero-spin autoplay is rejected');

const insufficient = new AutoPlayController();
insufficient.startBase(10);
assert(insufficient.completeBaseSpin({ canAffordNext: false }) === 'insufficient-balance',
    'Autoplay stops when the next wager is unaffordable');
assert(!insufficient.active, 'Insufficient balance leaves autoplay inactive');

const stopped = new AutoPlayController();
stopped.startBase(10);
stopped.stop();
assert(stopped.completeBaseSpin() === 'ignored', 'Manual stop prevents a queued base spin from progressing');

const naturalBonus = new AutoPlayController();
naturalBonus.startBase(10);
assert(naturalBonus.completeBaseSpin({ bonusTriggered: true }) === 'bonus',
    'Natural bonus stops base autoplay after the triggering spin');
naturalBonus.startBonus();
assert(naturalBonus.completeBonusSpin({ bonusActive: true }) === 'continue',
    'Bonus automation continues while bonus turns remain');
assert(naturalBonus.completeBonusSpin({ bonusActive: true, requiresChoice: true }) === 'choice',
    'Bonus automation pauses at a required choice');
assert(naturalBonus.completeBonusSpin({ bonusActive: true }) === 'ignored',
    'Paused bonus automation cannot start another spin');
assert(naturalBonus.resumeBonus(), 'Bonus automation resumes after a choice');
assert(naturalBonus.completeBonusSpin({ bonusActive: false }) === 'complete',
    'Bonus automation stops when the bonus ends');

const noResume = new AutoPlayController();
noResume.startBase(10);
noResume.completeBaseSpin({ bonusTriggered: true });
assert(noResume.takeResumeSpins() === 0, 'Base autoplay does not resume after bonus by default');

const resume = new AutoPlayController();
resume.resumeAfterBonus = true;
resume.startBase(10);
resume.completeBaseSpin({ bonusTriggered: true });
assert(resume.takeResumeSpins() === 9, 'Opt-in resume preserves only unplayed base autoplay spins');
assert(resume.takeResumeSpins() === 0, 'Preserved autoplay spins can only be resumed once');

const naturalRules = structuredClone(GAME_RULES);
naturalRules.reelStrips = [['SEAL'], ['SEAL'], ['SEAL'], ['SIGIL'], ['SIGIL']];
naturalRules.naturalBonus.scatterTriggerChance = 1;
const naturalGame = new SlotLogic(1000, () => 0, naturalRules);
const naturalOutcome = naturalGame.generateSpinOutcome();
assert(naturalOutcome.bonusTriggered, 'Engine natural bonus requires qualifying scatters and its configured chance');
assert(naturalGame.getBalance() === 990, 'Natural bonus-triggering base spin deducts the base wager once');
const engineNaturalAutoplay = new AutoPlayController();
engineNaturalAutoplay.startBase(10);
assert(engineNaturalAutoplay.completeBaseSpin({
    bonusTriggered: naturalOutcome.bonusTriggered,
    canAffordNext: naturalGame.getBalance() >= naturalGame.getStake()
}) === 'bonus' && !engineNaturalAutoplay.active,
'Engine natural bonus stops base autoplay after the triggering spin');

const purchasedRules = structuredClone(GAME_RULES);
purchasedRules.reelStrips = Array.from({ length: purchasedRules.columns }, () => ['SIGIL']);
const purchasedGame = new SlotLogic(5000, () => 0, purchasedRules);
const purchase = purchasedGame.buyBonus('UNDERWORLD');
assert(purchase.success && purchasedGame.selectRelic('SOUL'),
    'Purchased bonus enters its normal relic-selection flow');
const balanceAfterPurchase = purchasedGame.getBalance();
const purchasedBonusOutcome = purchasedGame.generateSpinOutcome();
assert(purchasedBonusOutcome && purchasedGame.inBonus && purchasedGame.bonusSpinsLeft === 9,
    'Purchased bonus spin advances the engine bonus round');
assert(purchasedGame.getBalance() === balanceAfterPurchase,
    'Purchased bonus spins do not deduct another base-game wager');

console.log(`\nResults -> Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
