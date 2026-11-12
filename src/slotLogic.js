import { GAME_RULES } from './gameRules.js';
import { evaluateGrid } from './slotMath.js';

export const ALL_SYMBOLS = GAME_RULES.symbols;

export const BONUS_LIFECYCLE_STATES = Object.freeze({
    BASE_GAME: 'BASE_GAME',
    BONUS_STAGE_1: 'BONUS_STAGE_1',
    BONUS_STAGE_2: 'BONUS_STAGE_2',
    BONUS_STAGE_3: 'BONUS_STAGE_3',
    FINAL_TYPHON_BONUS: 'FINAL_TYPHON_BONUS',
    BONUS_COMPLETE: 'BONUS_COMPLETE',
    BONUS_FAILED: 'BONUS_FAILED'
});

const activeBonusStates = new Set([
    BONUS_LIFECYCLE_STATES.BONUS_STAGE_1,
    BONUS_LIFECYCLE_STATES.BONUS_STAGE_2,
    BONUS_LIFECYCLE_STATES.BONUS_STAGE_3,
    BONUS_LIFECYCLE_STATES.FINAL_TYPHON_BONUS
]);

export class SlotLogic {
    constructor(startingBalance = 1000, random = Math.random, rules = GAME_RULES) {
        if (!Number.isFinite(startingBalance) || startingBalance < 0) {
            throw new RangeError('Starting balance must be a non-negative finite number');
        }
        const scatterTriggerChance = rules.naturalBonus?.scatterTriggerChance;
        if (!Number.isFinite(scatterTriggerChance) || scatterTriggerChance < 0 || scatterTriggerChance > 1) {
            throw new RangeError('Natural bonus scatter trigger chance must be between 0 and 1');
        }
        this.balance = startingBalance;
        this.random = random;
        this.rules = rules;
        this.stake = 10;
        this.roundStake = this.stake;
        this.roundMaxWin = this.roundStake * this.rules.maxWinStakeMultiplier;
        this.roundPayout = 0;
        this.maxWinReached = false;
        this.rows = rules.baseRows;
        this.soulBank = 0;

        this.inBonus = false;
        this.bonusState = BONUS_LIFECYCLE_STATES.BASE_GAME;
        this.bonusChoice = null;
        this.bonusSpinsLeft = 0;
        this.bonusTurnsAwarded = 0;
        this.bonusTurn = 0;
        this.baseTurn = 0;
        this.currentBonusWin = 0;
        this.pendingBonusEntry = false;
        this.pendingTyphonBonusSpins = 0;
        this.survivalStage = 0;
        this.survivalProgress = 0;
        this.survivalSpinsLeft = 0;
        this.survivalCompletedStages = [];
        this.survivalFeatureRoster = [];
        this.unlockedCharacterFeatures = [];
        this.survivalFailed = false;
        this.survivalFailureStage = null;
        this.survivalFeatureProgressThisTurn = 0;
        this.survivalFeatureEventsThisTurn = [];
        this.pendingZeusAction = false;
        this.pendingRelicSelection = false;
        this.activeRelic = null;
        this.zeusCharges = [];
        this.zeusLinks = [];
        this.medusaCurseTurns = [];
        this.petrifiedTurns = [];
        this.currentBonusBoard = null;
        this.megaWildSpins = 0;
        this.riftShifts = 0;
        this.history = [];
        this.eventSequence = 0;

        this.typhonMeter = 0;
        this.typhonMeterProgress = 0;
        this.typhonStage = 1;
        this.typhonPowerLevel = 0;
        this.typhonTriggered = false;
        this.aresChallenge = null;
    }

    getBalance() { return this.balance; }
    getStake() { return this.stake; }
    getRoundPayout() { return this.roundPayout; }
    getRoundMaxWin() { return this.roundMaxWin; }
    get isBonusActive() { return this.inBonus && activeBonusStates.has(this.bonusState); }

    setBonusLifecycleState(state, { roundActive = activeBonusStates.has(state) } = {}) {
        if (!Object.values(BONUS_LIFECYCLE_STATES).includes(state)) {
            throw new RangeError(`Unknown bonus lifecycle state "${state}"`);
        }
        this.bonusState = state;
        this.inBonus = roundActive;
    }

    resetBonusLifecycle(finalState) {
        this.setBonusLifecycleState(finalState);
        this.bonusChoice = null;
        this.survivalStage = 0;
        this.survivalProgress = 0;
        this.survivalSpinsLeft = 0;
        this.survivalCompletedStages = [];
        this.survivalFeatureRoster = [];
        this.unlockedCharacterFeatures = [];
        this.survivalFailed = false;
        this.survivalFailureStage = null;
        this.survivalFeatureProgressThisTurn = 0;
        this.survivalFeatureEventsThisTurn = [];
        this.typhonMeter = 0;
        this.typhonMeterProgress = 0;
        this.typhonStage = 1;
        this.typhonPowerLevel = 0;
        this.typhonTriggered = false;
        this.pendingTyphonBonusSpins = 0;
        this.pendingBonusEntry = false;
        this.pendingZeusAction = false;
        this.pendingRelicSelection = false;
        this.bonusSpinsLeft = 0;
        this.bonusTurnsAwarded = 0;
        this.currentBonusWin = 0;
        this.rows = this.rules.baseRows;
        this.bonusSource = null;
        this.soulBank = 0;
        this.zeusCharges = [];
        this.zeusLinks = [];
        this.currentBonusBoard = null;
        this.currentBonusCellStates = null;
        this.activeRelic = null;
        this.megaWildSpins = 0;
        this.medusaCurseTurns = [];
        this.petrifiedTurns = [];
        this.aresChallenge = null;
        this.riftShifts = 0;
    }

    startPayoutRound() {
        this.roundStake = this.stake;
        this.roundMaxWin = this.roundStake * this.rules.maxWinStakeMultiplier;
        this.roundPayout = 0;
        this.maxWinReached = false;
    }

    creditPayout(amount, {
        progressMeter = false,
        bonusWin = this.inBonus,
        stageEvents = [],
        survivalFeatureProgress = 0,
        survivalFeatureEvents = []
    } = {}) {
        if (!Number.isFinite(amount) || amount < 0) {
            throw new RangeError('Payout must be a non-negative finite number');
        }

        const payout = Math.min(amount, Math.max(0, this.roundMaxWin - this.roundPayout));
        if (payout > 0) {
            this.roundPayout += payout;
            if (bonusWin) this.currentBonusWin += payout;
            else this.balance += payout;
        }
        if (this.isBonusActive && this.survivalStage >= 1 && this.survivalStage <= 3
            && !this.survivalFailed && !this.typhonTriggered) {
            this.advanceBonusSurvival(
                payout / this.roundStake * this.rules.bonusSurvival.payoutProgressPerStake
                    + survivalFeatureProgress,
                survivalFeatureEvents,
                stageEvents
            );
        }
        if (this.roundPayout >= this.roundMaxWin && !this.maxWinReached) {
            this.maxWinReached = true;
            this.pendingBonusEntry = false;
            this.pendingTyphonBonusSpins = 0;
            this.pendingZeusAction = false;
            if (this.typhonTriggered && !this.inBonus) {
                this.typhonMeter = 0;
                this.typhonMeterProgress = 0;
                this.typhonStage = 1;
                this.typhonPowerLevel = 0;
                stageEvents.length = 0;
                this.recordEvent('typhon-meter-reset', { reason: 'max-win' });
            }
            this.typhonTriggered = false;
            this.bonusSpinsLeft = 0;
            this.recordEvent('max-win-reached', { amount: this.roundMaxWin, stake: this.roundStake });
        }
        return payout;
    }

    getSurvivalFeatureRoster(path = this.bonusChoice, relic = this.activeRelic) {
        const config = this.rules.bonusSurvival;
        const primary = config.pathFeatures[path];
        if (!primary) throw new RangeError(`No survival character feature configured for bonus path "${path}"`);
        const relicFeature = config.relicFeatures[relic];
        const roster = [primary];
        if (relicFeature && relicFeature !== primary) roster.push(relicFeature);
        for (const feature of config.secondaryFeatureOrder) {
            if (roster.length === 3) break;
            if (!roster.includes(feature)) roster.push(feature);
        }
        return roster;
    }

    getActiveCharacterFeaturesForStage(stage = this.survivalStage) {
        return this.survivalFeatureRoster.slice(0, Math.min(stage, this.survivalFeatureRoster.length));
    }

    isCharacterFeatureActive(feature) {
        return this.isBonusActive && this.unlockedCharacterFeatures.includes(feature);
    }

    recordSurvivalFeatureProgress(feature, eventKey, count = 1) {
        if (!this.isCharacterFeatureActive(feature) || this.survivalStage < 1 || this.survivalStage > 3) return;
        const pointsPerEvent = this.rules.bonusSurvival.featureProgress[eventKey];
        if (!Number.isFinite(pointsPerEvent) || count <= 0) return;
        const points = pointsPerEvent * count;
        this.survivalFeatureProgressThisTurn += points;
        this.survivalFeatureEventsThisTurn.push({ feature, event: eventKey, count, points });
    }

    advanceBonusSurvival(progress, featureEvents, stageEvents) {
        if (!this.isBonusActive || this.survivalFailed || this.typhonTriggered
            || progress <= 0 || this.survivalStage < 1 || this.survivalStage > 3) return;
        const stage = this.survivalStage;
        const threshold = this.rules.bonusSurvival.stageThresholds[stage - 1];
        this.survivalProgress = Math.min(threshold, this.survivalProgress + progress);
        this.recordEvent('survival-progress', {
            stage,
            progress: this.survivalProgress,
            threshold,
            added: progress,
            featureEvents
        });
        if (this.survivalProgress < threshold) return;

        const completedFeature = this.survivalFeatureRoster[stage - 1];
        const event = {
                stage,
                powerLevel: stage,
                meter: 100,
                threshold,
                turnsAdded: this.rules.bonusSurvival.spinsPerStage,
                bonusSpinsAdded: this.rules.bonusSurvival.spinsPerStage,
                characterFeatureUnlocked: this.survivalFeatureRoster[stage] ?? null,
                completedCharacterFeature: completedFeature,
                featureEvents
            };
        this.survivalCompletedStages.push(stage);
        this.bonusSpinsLeft += event.bonusSpinsAdded;
        this.bonusTurnsAwarded += event.bonusSpinsAdded;
        this.survivalSpinsLeft = event.bonusSpinsAdded;
        this.typhonPowerLevel = stage;
        stageEvents.push(event);
        this.recordEvent('survival-stage-completed', event);

        if (stage < 3) {
            this.survivalStage = stage + 1;
            this.setBonusLifecycleState(BONUS_LIFECYCLE_STATES[`BONUS_STAGE_${this.survivalStage}`]);
            this.survivalProgress = 0;
            this.unlockedCharacterFeatures = this.survivalFeatureRoster.slice(0, this.survivalStage);
            this.recordEvent('survival-stage-started', {
                stage: this.survivalStage,
                spins: this.survivalSpinsLeft,
                unlockedCharacterFeatures: [...this.unlockedCharacterFeatures]
            });
        } else {
            this.survivalStage = 4;
            this.setBonusLifecycleState(BONUS_LIFECYCLE_STATES.FINAL_TYPHON_BONUS);
            this.survivalProgress = 0;
            this.unlockedCharacterFeatures = [...this.survivalFeatureRoster];
            this.typhonTriggered = true;
            this.recordEvent('typhon-triggered', {
                source: 'survival-stage',
                stage,
                unlockedCharacterFeatures: [...this.unlockedCharacterFeatures]
            });
        }
    }

    failSurvivalStageIfExhausted() {
        if (!this.inBonus || this.survivalStage < 1 || this.survivalStage > 3
            || this.survivalSpinsLeft > 0 || this.survivalProgress >= this.rules.bonusSurvival.stageThresholds[this.survivalStage - 1]
            || this.pendingZeusAction || this.typhonTriggered || this.maxWinReached) return false;
        this.survivalFailed = true;
        this.survivalFailureStage = this.survivalStage;
        this.setBonusLifecycleState(BONUS_LIFECYCLE_STATES.BONUS_FAILED, { roundActive: true });
        this.bonusSpinsLeft = 0;
        this.recordEvent('survival-stage-failed', {
            stage: this.survivalFailureStage,
            progress: this.survivalProgress,
            threshold: this.rules.bonusSurvival.stageThresholds[this.survivalFailureStage - 1]
        });
        return true;
    }

    setStake(newStake) {
        if (this.inBonus || this.pendingBonusEntry || this.pendingRelicSelection || this.pendingZeusAction || this.typhonTriggered || !Number.isFinite(newStake)) return false;
        if (this.rules.betting.stakeLevels.includes(newStake)) {
            this.stake = newStake;
            this.roundStake = newStake;
            this.roundMaxWin = newStake * this.rules.maxWinStakeMultiplier;
            this.roundPayout = 0;
            this.maxWinReached = false;
            return true;
        }
        return false;
    }

    canSpin() {
        if (this.pendingBonusEntry || this.pendingRelicSelection || this.pendingZeusAction || this.typhonTriggered) return false;
        return this.inBonus ? this.bonusSpinsLeft > 0 : this.balance >= this.stake;
    }

    getBuyBonusCost() {
        return this.stake * this.rules.buyBonusStakeMultiplier;
    }

    canBuyBonus() {
        return this.balance >= this.getBuyBonusCost() && !this.inBonus && !this.pendingBonusEntry && !this.pendingRelicSelection && !this.pendingZeusAction && !this.typhonTriggered;
    }

    buyBonus(path = 'OLYMPUS') {
        const cost = this.getBuyBonusCost();
        if (!this.canBuyBonus() || !this.isValidBonusPath(path)) return { success: false };

        this.startPayoutRound();
        this.balance -= cost;
        this.startBonus(path, 'purchase');
        this.recordEvent('bonus-entry', { path, source: 'purchase', cost });

        return { success: true, cost, remainingBalance: this.balance };
    }

    selectBonusPath(path) {
        if (!this.pendingBonusEntry || !this.isValidBonusPath(path) || this.inBonus) return false;
        this.pendingBonusEntry = false;
        this.startBonus(path, 'natural');
        if (this.pendingTyphonBonusSpins > 0) {
            const addedTurns = Math.min(
                this.pendingTyphonBonusSpins,
                this.rules.bonusMaxAwardedTurns - this.bonusTurnsAwarded
            );
            this.bonusSpinsLeft += addedTurns;
            this.bonusTurnsAwarded += addedTurns;
            this.megaWildSpins += addedTurns;
            this.pendingTyphonBonusSpins = 0;
        }
        this.recordEvent('bonus-entry', { path, source: 'natural' });
        return true;
    }

    isValidBonusPath(path) {
        return ['OLYMPUS', 'UNDERWORLD', 'RIFT'].includes(path);
    }

    startBonus(path, source) {
        this.bonusChoice = path;
        this.setBonusLifecycleState(BONUS_LIFECYCLE_STATES.BONUS_STAGE_1);
        this.survivalStage = 1;
        this.survivalProgress = 0;
        this.survivalSpinsLeft = this.rules.bonusSurvival.spinsPerStage;
        this.survivalCompletedStages = [];
        this.survivalFeatureRoster = this.getSurvivalFeatureRoster(path, null);
        this.unlockedCharacterFeatures = this.survivalFeatureRoster.slice(0, 1);
        this.survivalFailed = false;
        this.survivalFailureStage = null;
        this.survivalFeatureProgressThisTurn = 0;
        this.survivalFeatureEventsThisTurn = [];
        this.bonusSpinsLeft = this.rules.bonusSurvival.spinsPerStage;
        this.bonusTurnsAwarded = this.rules.bonusSurvival.spinsPerStage;
        this.bonusTurn = 0;
        this.currentBonusWin = 0;
        this.rows = this.rules.bonusRows;
        this.bonusSource = source;
        this.pendingZeusAction = false;
        this.zeusCharges = Array.from({ length: this.rows }, () => Array(this.rules.columns).fill(0));
        this.zeusLinks = [];
        this.medusaCurseTurns = Array.from({ length: this.rows }, () => Array(this.rules.columns).fill(0));
        this.petrifiedTurns = Array.from({ length: this.rows }, () => Array(this.rules.columns).fill(0));
        this.currentBonusBoard = null;
        this.megaWildSpins = 0;
        this.riftShifts = 0;
        this.soulBank = 0;
        this.pendingRelicSelection = true;
        this.activeRelic = null;
        this.aresChallenge = {
            title: `Land ${this.rules.ares.target} Ares symbols on separate bonus turns`,
            objective: `Land ${this.rules.ares.target} Ares symbols on separate bonus turns`,
            target: this.rules.ares.target,
            progress: 0,
            turnsLeft: this.rules.ares.turns,
            completed: false,
            failed: false,
            paid: false
        };
        this.recordEvent('bonus-start', {
            path,
            source,
            turns: this.bonusSpinsLeft,
            survivalStage: this.survivalStage,
            survivalThreshold: this.rules.bonusSurvival.stageThresholds[0],
            unlockedCharacterFeatures: [...this.unlockedCharacterFeatures]
        });
    }

    selectRelic(relic) {
        if (!this.pendingRelicSelection || !['LIGHTNING', 'SOUL', 'PETRIFICATION'].includes(relic)) return false;
        this.activeRelic = relic;
        this.survivalFeatureRoster = this.getSurvivalFeatureRoster(this.bonusChoice, relic);
        this.unlockedCharacterFeatures = this.survivalFeatureRoster.slice(0, this.survivalStage);
        this.pendingRelicSelection = false;
        this.recordEvent('relic-selected', {
            relic,
            characterFeatures: [...this.survivalFeatureRoster]
        });
        return true;
    }

    selectTyphonAction(actionKey) {
        if (!this.typhonTriggered || this.maxWinReached) return false;
        const sourceTurn = this.inBonus ? this.bonusTurn : this.baseTurn;
        const sourceMode = this.inBonus ? 'bonus' : 'base';
        let reward = 0;
        let requestedReward = 0;
        let bonusSpinsAdded = 0;
        if (actionKey === 'ABYSSAL_WRATH') {
            requestedReward = (this.soulBank * 2 + 500)
                * (1 + this.typhonPowerLevel * this.rules.bonusMeter.wrathMultiplierPerStage);
            reward = this.creditPayout(requestedReward, { progressMeter: false });
            this.soulBank = 0;
        } else if (actionKey === 'TITAN_ASCENDANCE') {
            const requestedTurns = 5 + this.typhonPowerLevel * this.rules.bonusMeter.titanBonusTurnsPerStage;
            if (this.inBonus) {
                const addedTurns = Math.min(requestedTurns, this.rules.bonusMaxAwardedTurns - this.bonusTurnsAwarded);
                if (addedTurns <= 0) return false;
                this.bonusSpinsLeft += addedTurns;
                this.survivalSpinsLeft += addedTurns;
                this.bonusTurnsAwarded += addedTurns;
                this.megaWildSpins += addedTurns;
                bonusSpinsAdded = addedTurns;
            } else if (this.pendingBonusEntry) {
                this.pendingTyphonBonusSpins += requestedTurns;
                bonusSpinsAdded = requestedTurns;
            } else {
                this.startBonus('OLYMPUS', 'typhon');
                bonusSpinsAdded = Math.min(
                    requestedTurns,
                    this.rules.bonusMaxAwardedTurns - this.bonusTurnsAwarded
                );
                this.survivalStage = 4;
                this.setBonusLifecycleState(BONUS_LIFECYCLE_STATES.FINAL_TYPHON_BONUS);
                this.survivalFeatureRoster = this.getSurvivalFeatureRoster('OLYMPUS', null);
                this.unlockedCharacterFeatures = [...this.survivalFeatureRoster];
                this.bonusSpinsLeft += bonusSpinsAdded;
                this.survivalSpinsLeft += bonusSpinsAdded;
                this.bonusTurnsAwarded += bonusSpinsAdded;
                this.megaWildSpins += bonusSpinsAdded;
            }
        } else {
            return false;
        }
        this.recordEvent('typhon-choice', {
            action: actionKey,
            sourceTurn,
            sourceMode,
            reward,
            requestedReward,
            bonusSpinsAdded,
            megaWildSpinsAdded: bonusSpinsAdded
        });
        if (!this.inBonus) {
            this.typhonMeter = 0;
            this.typhonMeterProgress = 0;
            this.typhonStage = 1;
            this.typhonPowerLevel = 0;
        }
        this.typhonTriggered = false;
        this.survivalFeatureProgressThisTurn = 0;
        this.survivalFeatureEventsThisTurn = [];
        return true;
    }

    checkBonusEnd() {
        if (this.inBonus && this.bonusSpinsLeft <= 0 && !this.typhonTriggered && !this.pendingZeusAction && !this.pendingRelicSelection) {
            const failed = this.survivalFailed;
            const failureStage = this.survivalFailureStage;
            const completedStages = [...this.survivalCompletedStages];
            const endingPath = this.bonusChoice;
            const requestedSoulReward = this.bonusChoice === 'UNDERWORLD' || this.activeRelic === 'SOUL' ? this.soulBank : 0;
            const featurePayout = this.currentBonusWin;
            const soulReward = this.creditPayout(requestedSoulReward, { progressMeter: false, bonusWin: false });
            const totalBonusWin = featurePayout + soulReward;
            this.balance += featurePayout;
            if (this.aresChallenge && !this.aresChallenge.completed && !this.aresChallenge.failed) {
                this.aresChallenge.failed = true;
                this.recordEvent('ares-contract-failed', { progress: this.aresChallenge.progress });
            }
            this.recordEvent('bonus-end', {
                path: endingPath,
                totalBonusWin,
                soulReward,
                failed,
                failureStage,
                completedStages
            });
            const finalState = failed
                ? BONUS_LIFECYCLE_STATES.BONUS_FAILED
                : BONUS_LIFECYCLE_STATES.BONUS_COMPLETE;
            this.recordEvent('bonus-lifecycle-reset', { state: finalState });
            this.resetBonusLifecycle(finalState);
            return { ended: true, totalBonusWin, featurePayout, soulReward, failed, failureStage, completedStages };
        }
        return { ended: false, totalBonusWin: 0 };
    }

    applyRiftShifts(matrix, cellStates) {
        const shiftedColumns = new Set();
        matrix.forEach(row => row.forEach((symbol, column) => {
            if (symbol === 'RIFT') shiftedColumns.add(column);
        }));

        for (const column of shiftedColumns) {
            const lastSymbol = matrix[this.rows - 1][column];
            const lastState = cellStates[this.rows - 1][column];
            const lastCharge = this.zeusCharges[this.rows - 1][column];
            const lastCurse = this.medusaCurseTurns[this.rows - 1][column];
            const lastPetrification = this.petrifiedTurns[this.rows - 1][column];
            for (let row = this.rows - 1; row > 0; row--) {
                matrix[row][column] = matrix[row - 1][column];
                cellStates[row][column] = cellStates[row - 1][column];
                this.zeusCharges[row][column] = this.zeusCharges[row - 1][column];
                this.medusaCurseTurns[row][column] = this.medusaCurseTurns[row - 1][column];
                this.petrifiedTurns[row][column] = this.petrifiedTurns[row - 1][column];
            }
            matrix[0][column] = lastSymbol;
            cellStates[0][column] = lastState;
            this.zeusCharges[0][column] = lastCharge;
            this.medusaCurseTurns[0][column] = lastCurse;
            this.petrifiedTurns[0][column] = lastPetrification;
        }

        this.riftShifts = shiftedColumns.size;
        if (this.riftShifts) {
            this.recordEvent('rift-columns-shifted', { columns: [...shiftedColumns], direction: 'down-wrap' });
            if (this.riftShifts >= 2) {
                this.recordSurvivalFeatureProgress('TYPHON', 'TYPHON_MULTI_COLUMN');
            }
        }
    }

    applyPoseidonShifts(matrix, cellStates) {
        const shiftedRows = [];
        for (let row = 0; row < this.rows; row++) {
            if (!matrix[row].includes(this.rules.poseidon.shiftSymbol)) continue;
            shiftedRows.push(row);
            const lastSymbol = matrix[row][this.rules.columns - 1];
            const lastState = cellStates[row][this.rules.columns - 1];
            const lastCharge = this.zeusCharges[row][this.rules.columns - 1];
            const lastCurse = this.medusaCurseTurns[row][this.rules.columns - 1];
            const lastPetrification = this.petrifiedTurns[row][this.rules.columns - 1];
            for (let column = this.rules.columns - 1; column > 0; column--) {
                matrix[row][column] = matrix[row][column - 1];
                cellStates[row][column] = cellStates[row][column - 1];
                this.zeusCharges[row][column] = this.zeusCharges[row][column - 1];
                this.medusaCurseTurns[row][column] = this.medusaCurseTurns[row][column - 1];
                this.petrifiedTurns[row][column] = this.petrifiedTurns[row][column - 1];
            }
            matrix[row][0] = lastSymbol;
            cellStates[row][0] = lastState;
            this.zeusCharges[row][0] = lastCharge;
            this.medusaCurseTurns[row][0] = lastCurse;
            this.petrifiedTurns[row][0] = lastPetrification;
        }
        if (shiftedRows.length) {
            this.recordEvent('poseidon-rows-shifted', { rows: shiftedRows, direction: this.rules.poseidon.direction });
            if (shiftedRows.length >= 2) {
                this.recordSurvivalFeatureProgress('POSEIDON', 'POSEIDON_MULTIROW');
            }
        }
    }

    applyMedusaEffects(matrix, cellStates) {
        let petrifiedCount = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let column = 0; column < this.rules.columns; column++) {
                const state = cellStates[row][column];
                if (this.medusaCurseTurns[row][column] > 0) {
                    matrix[row][column] = this.rules.medusa.petrifiedSymbol;
                    this.medusaCurseTurns[row][column] = 0;
                    state.cursed = false;
                    state.petrified = true;
                    state.wild = true;
                    this.petrifiedTurns[row][column] = this.activeRelic === 'PETRIFICATION' ? 2 : 0;
                    petrifiedCount++;
                    this.recordEvent('cell-petrified', { row, column, wild: true, remainingTurns: this.petrifiedTurns[row][column] });
                } else if (matrix[row][column] === this.rules.medusa.curseSymbol) {
                    this.medusaCurseTurns[row][column] = 1;
                    state.cursed = true;
                    state.petrified = false;
                    this.recordEvent('cell-cursed', { row, column, duration: 1 });
                } else if (this.petrifiedTurns[row][column] > 0) {
                    matrix[row][column] = this.rules.medusa.petrifiedSymbol;
                    this.petrifiedTurns[row][column]--;
                    state.petrified = true;
                    state.wild = true;
                    this.recordEvent('petrified-cell-preserved', { row, column, remainingTurns: this.petrifiedTurns[row][column] });
                }
            }
            if (petrifiedCount >= 3) {
                this.recordSurvivalFeatureProgress('MEDUSA', 'MEDUSA_MULTI_PETRIFY');
            }
        }
    }

    advanceAresContract(matrix) {
        const challenge = this.aresChallenge;
        if (!this.inBonus || !challenge || challenge.completed || challenge.failed) return 0;

        let reward = 0;
        if (matrix.some(row => row.includes(this.rules.ares.objectiveSymbol))) {
            challenge.progress = Math.min(challenge.target, challenge.progress + 1);
            this.recordEvent('ares-contract-progress', { progress: challenge.progress, target: challenge.target });
        }
        challenge.turnsLeft = Math.max(0, challenge.turnsLeft - 1);

        if (challenge.progress >= challenge.target) {
            challenge.completed = true;
            if (!challenge.paid) {
                challenge.paid = true;
                reward = this.stake * this.rules.ares.rewardStakeMultiplier;
                this.recordEvent('ares-contract-completed', { reward });
            }
        } else if (challenge.turnsLeft === 0) {
            challenge.failed = true;
            this.recordEvent('ares-contract-failed', { progress: challenge.progress });
        }
        return reward;
    }

    getQualifyingZeusNetworks() {
        const visited = new Set();
        const networks = [];
        const linkKeys = new Set(this.zeusLinks);
        const keyFor = cell => `${cell.row},${cell.column}`;
        const hasLinkedEdge = (left, right) => {
            const keys = [keyFor(left), keyFor(right)].sort();
            return linkKeys.has(`${keys[0]}|${keys[1]}`);
        };

        for (let row = 0; row < this.zeusCharges.length; row++) {
            for (let column = 0; column < this.rules.columns; column++) {
                if (this.zeusCharges[row][column] <= 0) continue;
                const start = { row, column };
                if (visited.has(keyFor(start))) continue;
                const network = [];
                const pending = [start];
                visited.add(keyFor(start));

                while (pending.length) {
                    const cell = pending.pop();
                    network.push(cell);
                    for (let otherRow = 0; otherRow < this.zeusCharges.length; otherRow++) {
                        for (let otherColumn = 0; otherColumn < this.rules.columns; otherColumn++) {
                            if (this.zeusCharges[otherRow][otherColumn] <= 0) continue;
                            const neighbor = { row: otherRow, column: otherColumn };
                            const key = keyFor(neighbor);
                            const orthogonallyAdjacent = Math.abs(cell.row - otherRow) + Math.abs(cell.column - otherColumn) === 1;
                            if (!visited.has(key) && (orthogonallyAdjacent || hasLinkedEdge(cell, neighbor))) {
                                visited.add(key);
                                pending.push(neighbor);
                            }
                        }
                    }
                }

                if (network.length >= this.rules.zeus.networkSize) networks.push(network);
            }
        }

        return networks;
    }

    getZeusChoices() {
        const networkActive = this.bonusChoice === 'OLYMPUS' || this.activeRelic === 'LIGHTNING';
        if (!this.pendingZeusAction || !this.inBonus || !networkActive) return [];
        const networks = this.getQualifyingZeusNetworks();
        if (!networks.length) return [];
        const choices = [];
        const chargeCap = this.getZeusChargeCap();

        if (networks.some(network => network.some(cell => this.zeusCharges[cell.row][cell.column] < chargeCap))) {
            choices.push('OVERCHARGE');
        }

        const allCharged = this.zeusCharges.flatMap((row, r) => row.map((level, c) => level > 0 ? ({ row: r, column: c }) : null).filter(Boolean));
        const components = this.getAllZeusComponents();
        const canChain = components.some((left, leftIndex) => components.slice(leftIndex + 1).some(right =>
            left.some(a => right.some(b => Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 2))
        ));
        if (allCharged.length >= this.rules.zeus.networkSize && canChain) choices.push('CHAIN_LIGHTNING');
        choices.push('DISCHARGE');
        return choices;
    }

    getZeusChargeCap() {
        return this.activeRelic === 'LIGHTNING'
            ? Math.min(this.rules.zeus.relicChargeCap, this.rules.zeus.chargeCap + this.rules.zeus.relicChargeBonus)
            : this.rules.zeus.chargeCap;
    }

    getAllZeusComponents() {
        const qualifying = this.getQualifyingZeusNetworks();
        const included = new Set(qualifying.flatMap(network => network.map(cell => `${cell.row},${cell.column}`)));
        const components = [];
        const seen = new Set();
        const links = new Set(this.zeusLinks);
        const edgeExists = (a, b) => {
            const keys = [`${a.row},${a.column}`, `${b.row},${b.column}`].sort();
            return links.has(`${keys[0]}|${keys[1]}`);
        };

        for (const key of included) {
            if (seen.has(key)) continue;
            const pending = [key];
            const component = [];
            seen.add(key);
            while (pending.length) {
                const [row, column] = pending.pop().split(',').map(Number);
                const cell = { row, column };
                component.push(cell);
                for (const candidateKey of included) {
                    if (seen.has(candidateKey)) continue;
                    const [otherRow, otherColumn] = candidateKey.split(',').map(Number);
                    const candidate = { row: otherRow, column: otherColumn };
                    const adjacent = Math.abs(row - otherRow) + Math.abs(column - otherColumn) === 1;
                    if (adjacent || edgeExists(cell, candidate)) {
                        seen.add(candidateKey);
                        pending.push(candidateKey);
                    }
                }
            }
            components.push(component);
        }
        return components;
    }

    applyZeusAction(action) {
        const validChoices = this.getZeusChoices();
        if (!validChoices.includes(action) || !this.currentBonusBoard) return null;

        let totalWin = 0;
        const stageEvents = [];
        if (action === 'OVERCHARGE') {
            const chargeCap = this.getZeusChargeCap();
            for (const network of this.getQualifyingZeusNetworks()) {
                for (const cell of network) {
                    this.zeusCharges[cell.row][cell.column] = Math.min(chargeCap, this.zeusCharges[cell.row][cell.column] + 1);
                }
            }
            this.recordEvent('zeus-overcharge', { networks: this.getQualifyingZeusNetworks(), chargeCap });
        } else if (action === 'CHAIN_LIGHTNING') {
            const components = this.getAllZeusComponents();
            for (let leftIndex = 0; leftIndex < components.length; leftIndex++) {
                for (let rightIndex = leftIndex + 1; rightIndex < components.length; rightIndex++) {
                    for (const left of components[leftIndex]) {
                        for (const right of components[rightIndex]) {
                            if (Math.abs(left.row - right.row) + Math.abs(left.column - right.column) !== 2) continue;
                            const keys = [`${left.row},${left.column}`, `${right.row},${right.column}`].sort();
                            const edge = `${keys[0]}|${keys[1]}`;
                            if (!this.zeusLinks.includes(edge)) this.zeusLinks.push(edge);
                        }
                    }
                }
            }
            this.recordEvent('zeus-chain-lightning', { links: [...this.zeusLinks] });
        } else {
            const converted = this.getQualifyingZeusNetworks().flat();
            for (const cell of converted) {
                this.currentBonusBoard[cell.row][cell.column] = this.rules.wildSymbol;
                this.currentBonusCellStates[cell.row][cell.column].wild = true;
                this.zeusCharges[cell.row][cell.column] = 0;
            }
            this.zeusLinks = [];
            this.recordEvent('zeus-discharge', { converted });
        }

        this.pendingZeusAction = action === 'CHAIN_LIGHTNING' && this.getQualifyingZeusNetworks().length > 0;
        if (!this.pendingZeusAction) {
            const evaluation = evaluateGrid(this.currentBonusBoard, this.stake, this.rules);
            totalWin = this.creditPayout(
                evaluation.totalWin * (this.rules.bonusMultipliers[this.bonusChoice] ?? 1),
                { progressMeter: true, stageEvents }
            );
            this.recordEvent('zeus-board-evaluated', { action, wins: evaluation.wins, payout: totalWin });
            this.failSurvivalStageIfExhausted();
        }
        for (let row = 0; row < this.zeusCharges.length; row++) {
            for (let column = 0; column < this.rules.columns; column++) {
                this.currentBonusCellStates[row][column].chargeLevel = this.zeusCharges[row][column];
            this.currentBonusCellStates[row][column].charged = this.zeusCharges[row][column] > 0;
            }
        }
        return {
            action,
            matrix: this.currentBonusBoard.map(row => [...row]),
            cellStates: this.currentBonusCellStates.map(row => row.map(state => ({ ...state }))),
            totalWin,
            currentBonusWin: this.currentBonusWin,
            stageEvents,
            roundPayout: this.roundPayout,
            maxWin: this.roundMaxWin,
            maxWinReached: this.maxWinReached,
            typhonMeter: this.typhonMeter,
            typhonMeterProgress: this.typhonMeterProgress,
            typhonStage: this.typhonStage,
            typhonTriggered: this.typhonTriggered
        };
    }

    generateSpinOutcome() {
        if (!this.canSpin()) return null;

        const wasInBonus = this.inBonus;
        if (!wasInBonus) this.startPayoutRound();
        this.survivalFeatureProgressThisTurn = 0;
        this.survivalFeatureEventsThisTurn = [];

        const matrix = [];
        const cellStates = [];

        for (let r = 0; r < this.rows; r++) {
            matrix[r] = [];
            cellStates[r] = [];
            for (let c = 0; c < this.rules.columns; c++) {
                const reelStrip = this.rules.reelStrips[c];
                const roll = this.random();
                if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
                    throw new RangeError('Random source must return a value in [0, 1)');
                }
                const sym = reelStrip[Math.floor(roll * reelStrip.length)];
                matrix[r][c] = sym;
                cellStates[r][c] = { wild: sym === this.rules.wildSymbol, chargeLevel: 0, cursed: false };
            }
        }

        if (wasInBonus) this.bonusTurn++;
        else this.baseTurn++;

        if (wasInBonus && this.isCharacterFeatureActive('POSEIDON')
            && matrix.some(row => row.includes(this.rules.poseidon.shiftSymbol))) {
            this.applyPoseidonShifts(matrix, cellStates);
        }
        if (wasInBonus && this.bonusChoice === 'RIFT' && this.isCharacterFeatureActive('TYPHON')) {
            this.applyRiftShifts(matrix, cellStates);
        }
        if (wasInBonus && this.isCharacterFeatureActive('MEDUSA')) this.applyMedusaEffects(matrix, cellStates);

        if (wasInBonus && this.isCharacterFeatureActive('HADES')
            && (this.bonusChoice === 'UNDERWORLD' || this.activeRelic === 'SOUL')) {
            const soulCells = [];
            matrix.forEach((row, r) => row.forEach((symbol, c) => {
                if (symbol === this.rules.hades.soulSymbol && this.soulBank < this.rules.hades.soulCap) {
                    const relicBonus = this.activeRelic === 'SOUL' ? this.rules.hades.relicSoulBonus : 0;
                    const soulValue = Math.min(this.rules.hades.relicSoulValueCap, this.rules.hades.soulValue + relicBonus);
                    const value = Math.min(soulValue, this.rules.hades.soulCap - this.soulBank);
                    this.soulBank += value;
                    soulCells.push({ row: r, column: c, value });
                }
            }));
            if (soulCells.length) {
                this.recordEvent('souls-collected', { cells: soulCells, bank: this.soulBank });
                this.recordSurvivalFeatureProgress('HADES', 'HADES_SOUL', soulCells.length);
            }
        }

        if (wasInBonus && this.isCharacterFeatureActive('ZEUS')
            && (this.bonusChoice === 'OLYMPUS' || this.activeRelic === 'LIGHTNING')) {
            const networkWasPending = this.pendingZeusAction;
            matrix.forEach((row, r) => row.forEach((symbol, c) => {
                if (symbol === 'CHARGE') {
                    const previousCharge = this.zeusCharges[r][c];
                    const relicCap = this.activeRelic === 'LIGHTNING'
                        ? Math.min(this.rules.zeus.relicChargeCap, this.rules.zeus.chargeCap + this.rules.zeus.relicChargeBonus)
                        : this.rules.zeus.chargeCap;
                    this.zeusCharges[r][c] = Math.min(relicCap, this.zeusCharges[r][c] + 1);
                    this.recordEvent('cell-charged', { row: r, column: c, level: this.zeusCharges[r][c] });
                    if (this.zeusCharges[r][c] > previousCharge) {
                        this.recordSurvivalFeatureProgress('ZEUS', 'ZEUS_CHARGE');
                    }
                }
            }));
            this.pendingZeusAction = this.getQualifyingZeusNetworks().length > 0;
            if (this.pendingZeusAction && !networkWasPending) {
                const networks = this.getQualifyingZeusNetworks();
                this.recordEvent('zeus-network-completed', { networks });
                this.recordSurvivalFeatureProgress('ZEUS', 'ZEUS_NETWORK', networks.length);
            }
        }

        if (wasInBonus && this.megaWildSpins > 0) {
            for (let r = 0; r < matrix.length; r++) {
                for (let c = 0; c < matrix[r].length; c++) {
                    matrix[r][c] = this.rules.wildSymbol;
                    cellStates[r][c].wild = true;
                }
            }
            this.megaWildSpins--;
            this.recordEvent('mega-wild-spin', { remaining: this.megaWildSpins });
        }

        const zeusFeatureActive = wasInBonus && this.isCharacterFeatureActive('ZEUS')
            && (this.bonusChoice === 'OLYMPUS' || this.activeRelic === 'LIGHTNING');
        if (zeusFeatureActive) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.rules.columns; c++) {
                    cellStates[r][c].chargeLevel = this.zeusCharges[r][c];
                    cellStates[r][c].charged = this.zeusCharges[r][c] > 0;
                }
            }
        }

        if (wasInBonus && this.isCharacterFeatureActive('MEDUSA') && this.activeRelic === 'PETRIFICATION') {
            for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.rules.columns; column++) {
                    if (this.petrifiedTurns[row][column] > 0) {
                        matrix[row][column] = this.rules.medusa.petrifiedSymbol;
                        cellStates[row][column].petrified = true;
                        cellStates[row][column].wild = true;
                    }
                }
            }
        }

        const evaluation = evaluateGrid(matrix, this.stake, this.rules);
        let naturalBonusTriggered = false;
        if (evaluation.bonusTriggered && !wasInBonus) {
            const triggerRoll = this.random();
            if (!Number.isFinite(triggerRoll) || triggerRoll < 0 || triggerRoll >= 1) {
                throw new RangeError('Random source must return a value in [0, 1)');
            }
            naturalBonusTriggered = triggerRoll < this.rules.naturalBonus.scatterTriggerChance;
        }
        const multiplier = wasInBonus ? (this.rules.bonusMultipliers[this.bonusChoice] ?? 1) : 1;
        const payoutDeferred = zeusFeatureActive && this.pendingZeusAction;
        let totalWin = payoutDeferred ? 0 : evaluation.totalWin * multiplier;
        if (zeusFeatureActive) {
            this.currentBonusBoard = matrix.map(row => [...row]);
            this.currentBonusCellStates = cellStates.map(row => row.map(state => ({ ...state })));
        }
        if (!wasInBonus) this.balance -= this.stake;
        else {
            this.bonusSpinsLeft--;
            this.survivalSpinsLeft = Math.max(0, this.survivalSpinsLeft - 1);
        }
        if (wasInBonus) totalWin += this.advanceAresContract(matrix);
        const stageEvents = [];
        totalWin = this.creditPayout(totalWin, {
            progressMeter: totalWin > 0,
            stageEvents,
            survivalFeatureProgress: this.survivalFeatureProgressThisTurn,
            survivalFeatureEvents: [...this.survivalFeatureEventsThisTurn]
        });

        const bonusTriggered = naturalBonusTriggered && !this.maxWinReached;
        let bonusRetriggered = false;
        let bonusTurnsAdded = 0;
        if (bonusTriggered) this.pendingBonusEntry = true;
        this.failSurvivalStageIfExhausted();

        this.recordEvent('spin-resolved', {
            bonus: wasInBonus,
            stake: wasInBonus ? 0 : this.stake,
            wins: payoutDeferred ? [] : evaluation.wins,
            totalWin,
            multiplier,
            bonusTriggered,
            bonusRetriggered,
            payoutDeferred,
            roundPayout: this.roundPayout,
            maxWin: this.roundMaxWin,
            maxWinReached: this.maxWinReached,
            typhonMeter: this.typhonMeter,
            typhonStage: this.typhonStage,
            survivalStage: this.survivalStage,
            bonusState: this.bonusState,
            survivalProgress: this.survivalProgress,
            survivalSpinsLeft: this.survivalSpinsLeft,
            survivalThreshold: this.survivalStage >= 1 && this.survivalStage <= 3
                ? this.rules.bonusSurvival.stageThresholds[this.survivalStage - 1]
                : 0,
            unlockedCharacterFeatures: [...this.unlockedCharacterFeatures],
            survivalFailed: this.survivalFailed
        });

        return {
            matrix,
            cellStates,
            rows: this.rows,
            wins: payoutDeferred ? [] : evaluation.wins,
            pendingWins: payoutDeferred ? evaluation.wins : [],
            totalWin,
            remainingBalance: this.balance,
            soulBank: this.soulBank,
            bonusTriggered,
            bonusRetriggered,
            bonusTurnsAdded,
            typhonChoices: this.getTyphonChoices(),
            scatterCount: evaluation.scatterCount,
            pendingZeusAction: this.pendingZeusAction,
            zeusChoices: this.pendingZeusAction ? this.getZeusChoices() : [],
            soulBank: this.soulBank,
            megaWildSpins: this.megaWildSpins,
            riftShifts: this.riftShifts,
            typhonTriggered: this.typhonTriggered,
            typhonMeter: this.typhonMeter,
            typhonStage: this.typhonStage,
            typhonMeterProgress: this.typhonMeterProgress,
            typhonPowerLevel: this.typhonPowerLevel,
            stageEvents,
            survivalStage: this.survivalStage,
            bonusState: this.bonusState,
            survivalProgress: this.survivalProgress,
            survivalSpinsLeft: this.survivalSpinsLeft,
            survivalThreshold: this.survivalStage >= 1 && this.survivalStage <= 3
                ? this.rules.bonusSurvival.stageThresholds[this.survivalStage - 1]
                : 0,
            unlockedCharacterFeatures: [...this.unlockedCharacterFeatures],
            survivalFailed: this.survivalFailed,
            roundPayout: this.roundPayout,
            maxWin: this.roundMaxWin,
            maxWinReached: this.maxWinReached,
            aresChallenge: this.aresChallenge,
            multiplier
        };
    }

    recordEvent(type, details = {}) {
        const bonusEvent = this.inBonus || type === 'bonus-start' || type === 'bonus-entry';
        this.history.push({
            sequence: ++this.eventSequence,
            turn: bonusEvent ? this.bonusTurn : this.baseTurn,
            bonusTurn: bonusEvent ? this.bonusTurn : null,
            mode: bonusEvent ? 'bonus' : 'base',
            path: bonusEvent ? this.bonusChoice : null,
            type,
            ...details
        });
    }

    getEventHistory() {
        return structuredClone(this.history);
    }

    getTyphonChoices() {
        if (!this.typhonTriggered || this.maxWinReached) return [];
        const choices = ['ABYSSAL_WRATH'];
        const canAddTurns = !this.inBonus || this.bonusTurnsAwarded < this.rules.bonusMaxAwardedTurns;
        if (canAddTurns) choices.push('TITAN_ASCENDANCE');
        return choices;
    }
}