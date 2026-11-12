export function getWinningCellKeys(wins, paylines) {
    const cells = new Set();
    for (const win of wins ?? []) {
        const line = paylines[win.paylineIndex];
        if (!line) continue;
        const matchCount = Math.min(win.matchCount ?? line.length, line.length);
        for (let column = 0; column < matchCount; column++) {
            cells.add(`${line[column]},${column}`);
        }
    }
    return cells;
}

export function formatCredits(amount) {
    return `${Number(amount).toFixed(2).replace(/\.00$/, '')} CR`;
}

export class VisualFeedback {
    constructor(scene, reducedMotion = () => false) {
        this.scene = scene;
        this.reducedMotion = reducedMotion;
        this.speedMultiplier = 1;
        this.timers = new Set();
        this.tweens = new Set();
        this.destroyed = false;
        scene.events.once('shutdown', this.destroy, this);
        scene.events.once('destroy', this.destroy, this);
    }

    duration(milliseconds) {
        return this.reducedMotion() ? 0 : milliseconds / this.speedMultiplier;
    }

    setSpeedMultiplier(multiplier) {
        if (!Number.isFinite(multiplier) || multiplier < 0.25 || multiplier > 4) {
            throw new RangeError('Animation speed multiplier must be between 0.25 and 4');
        }
        this.speedMultiplier = multiplier;
    }

    animateReels(matrix, sprites, symbols, onComplete) {
        if (this.reducedMotion()) {
            this.setFinalSymbols(matrix, sprites);
            onComplete();
            return;
        }

        let completedColumns = 0;
        const totalColumns = sprites[0]?.length ?? 0;
        if (totalColumns === 0) {
            onComplete();
            return;
        }

        for (let column = 0; column < totalColumns; column++) {
            this.schedule(this.duration(column * 55), () => {
                const reelSprites = sprites.map(row => row[column]).filter(Boolean);
                let lastPhase = -1;
                const spin = this.scene.tweens.addCounter({
                    from: 0,
                    to: 5,
                    duration: this.duration(300 + column * 55),
                    ease: 'Cubic.easeIn',
                    onUpdate: tween => {
                        const phase = Math.floor(tween.getValue());
                        if (phase === lastPhase) return;
                        lastPhase = phase;
                        reelSprites.forEach((sprite, row) => {
                            const symbol = symbols[(phase + row + column) % symbols.length];
                            if (this.scene.textures.exists(symbol)) {
                                sprite.setTexture(symbol);
                                sprite.setDisplaySize(80, 64);
                                sprite.baseScaleX = sprite.scaleX;
                                sprite.baseScaleY = sprite.scaleY;
                            }
                            const baseX = sprite.baseScaleX ?? 1;
                            const baseY = sprite.baseScaleY ?? 1;
                            sprite.setScale(baseX, baseY * (phase % 2 === 0 ? 0.9 : 0.76));
                        });
                    },
                    onComplete: () => {
                        reelSprites.forEach((sprite, row) => {
                            const symbol = matrix[row][column];
                            if (this.scene.textures.exists(symbol)) sprite.setTexture(symbol);
                            sprite.setDisplaySize(80, 64);
                            sprite.baseScaleX = sprite.scaleX;
                            sprite.baseScaleY = sprite.scaleY;
                        });
                        completedColumns++;
                        if (completedColumns === totalColumns) onComplete();
                    }
                });
                this.tweens.add(spin);
            });
        }
    }

    setFinalSymbols(matrix, sprites) {
        matrix.forEach((row, rowIndex) => row.forEach((symbol, column) => {
            const sprite = sprites[rowIndex]?.[column];
            if (sprite && this.scene.textures.exists(symbol)) sprite.setTexture(symbol);
            if (sprite) {
                sprite.setDisplaySize(80, 64);
                sprite.baseScaleX = sprite.scaleX;
                sprite.baseScaleY = sprite.scaleY;
            }
        }));
    }

    highlightWins(wins, paylines, sprites, onComplete = () => {}) {
        const keys = getWinningCellKeys(wins, paylines);
        const targets = [...keys].map(key => {
            const [row, column] = key.split(',').map(Number);
            return sprites[row]?.[column];
        }).filter(Boolean);
        if (targets.length === 0) {
            onComplete();
            return;
        }
        this.pulseTargets(targets, 0xffe26b, 115, onComplete);
    }

    pulseTargets(targets, tint = 0xffffff, milliseconds = 180, onComplete = () => {}) {
        if (targets.length === 0 || this.reducedMotion()) {
            onComplete();
            return;
        }
        let completed = 0;
        targets.forEach(target => {
            const baseX = target.scaleX ?? 1;
            const baseY = target.scaleY ?? 1;
            target.setTint?.(tint);
            const tween = this.scene.tweens.add({
                targets: target,
                scaleX: baseX * 1.13,
                scaleY: baseY * 1.13,
                duration: this.duration(milliseconds),
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    target.setScale?.(baseX, baseY);
                    target.clearTint?.();
                    this.tweens.delete(tween);
                    completed++;
                    if (completed === targets.length) onComplete();
                }
            });
            this.tweens.add(tween);
        });
    }

    sweep(targets, axis, distance, tint, milliseconds = 170) {
        if (targets.length === 0 || this.reducedMotion()) return;
        let completed = 0;
        targets.forEach(target => {
            const property = axis === 'x' ? 'x' : 'y';
            const start = target[property];
            target.setTint?.(tint);
            const tween = this.scene.tweens.add({
                targets: target,
                [property]: start + distance,
                duration: this.duration(milliseconds),
                yoyo: true,
                onComplete: () => {
                    target[property] = start;
                    target.clearTint?.();
                    this.tweens.delete(tween);
                    completed++;
                }
            });
            this.tweens.add(tween);
        });
    }

    countUp(text, amount, milliseconds = 320, onComplete = () => {}) {
        const initial = Number.parseFloat(String(text.text).replace(/[^0-9.-]/g, '')) || 0;
        if (this.reducedMotion() || milliseconds <= 0 || initial === amount) {
            text.setText(formatCredits(amount));
            onComplete();
            return;
        }
        const counter = { value: initial };
        const tween = this.scene.tweens.add({
            targets: counter,
            value: amount,
            duration: this.duration(milliseconds),
            ease: 'Sine.easeOut',
            onUpdate: () => text.setText(formatCredits(counter.value)),
            onComplete: () => {
                text.setText(formatCredits(amount));
                this.tweens.delete(tween);
                onComplete();
            }
        });
        this.tweens.add(tween);
    }

    crossFadeBackground(image, textureKey, onComplete = () => {}) {
        if (this.reducedMotion() || !this.scene.textures.exists(textureKey)) {
            image.setTexture(textureKey);
            image.setAlpha(1);
            onComplete();
            return;
        }
        const fadeOut = this.scene.tweens.add({
            targets: image,
            alpha: 0,
            duration: this.duration(140),
            onComplete: () => {
                image.setTexture(textureKey);
                const fadeIn = this.scene.tweens.add({
                    targets: image,
                    alpha: 1,
                    duration: this.duration(220),
                    onComplete: () => {
                        this.tweens.delete(fadeIn);
                        onComplete();
                    }
                });
                this.tweens.add(fadeIn);
                this.tweens.delete(fadeOut);
            }
        });
        this.tweens.add(fadeOut);
    }

    schedule(milliseconds, callback) {
        if (this.destroyed) return;
        const delay = this.duration(milliseconds);
        if (delay <= 0) {
            callback();
            return;
        }
        const timer = this.scene.time.delayedCall(delay, () => {
            this.timers.delete(timer);
            if (!this.destroyed) callback();
        });
        this.timers.add(timer);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.timers.forEach(timer => timer.remove());
        this.tweens.forEach(tween => tween.stop());
        this.timers.clear();
        this.tweens.clear();
    }
}
