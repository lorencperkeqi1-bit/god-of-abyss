export class AutoPlayController {
    constructor() {
        this.mode = 'idle';
        this.remainingSpins = 0;
        this.resumeRemainingSpins = 0;
        this.resumeAfterBonus = false;
    }

    startBase(spinCount) {
        if (!Number.isInteger(spinCount) || spinCount <= 0) {
            throw new RangeError('Autoplay spin count must be a positive integer');
        }
        this.mode = 'base';
        this.remainingSpins = spinCount;
        this.resumeRemainingSpins = 0;
    }

    startBonus() {
        this.mode = 'bonus';
    }

    pauseBonus() {
        if (this.mode !== 'bonus') return false;
        this.mode = 'bonus-paused';
        return true;
    }

    resumeBonus() {
        if (this.mode !== 'bonus-paused') return false;
        this.mode = 'bonus';
        return true;
    }

    stop() {
        const stoppedMode = this.mode;
        this.mode = 'idle';
        this.remainingSpins = 0;
        this.resumeRemainingSpins = 0;
        return stoppedMode;
    }

    completeBaseSpin({ bonusTriggered = false, requiresChoice = false, canAffordNext = true } = {}) {
        if (this.mode !== 'base') return 'ignored';
        this.remainingSpins = Math.max(0, this.remainingSpins - 1);
        if (bonusTriggered) {
            this.resumeRemainingSpins = this.remainingSpins;
            this.mode = 'idle';
            return 'bonus';
        }
        if (requiresChoice) {
            this.stop();
            return 'choice';
        }
        if (this.remainingSpins === 0) {
            this.mode = 'idle';
            return 'complete';
        }
        if (!canAffordNext) {
            this.mode = 'idle';
            this.remainingSpins = 0;
            return 'insufficient-balance';
        }
        return 'continue';
    }

    completeBonusSpin({ bonusActive, requiresChoice = false } = {}) {
        if (this.mode !== 'bonus') return 'ignored';
        if (requiresChoice) {
            this.mode = 'bonus-paused';
            return 'choice';
        }
        if (!bonusActive) {
            this.mode = 'idle';
            return 'complete';
        }
        return 'continue';
    }

    takeResumeSpins() {
        if (!this.resumeAfterBonus || this.resumeRemainingSpins <= 0) {
            this.resumeRemainingSpins = 0;
            return 0;
        }
        const spinCount = this.resumeRemainingSpins;
        this.resumeRemainingSpins = 0;
        return spinCount;
    }

    get active() {
        return this.mode === 'base' || this.mode === 'bonus';
    }
}
