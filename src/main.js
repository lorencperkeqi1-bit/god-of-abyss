import Phaser from 'phaser';
import { SlotLogic } from './slotLogic.js';
import { formatCredits, VisualFeedback } from './visualFeedback.js';
import { renderGameInfoContent } from './gameInfo.js';
import { AutoPlayController } from './autoPlayController.js';

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.gameLogic = new SlotLogic(1000);
        this.tileGrid = [];
        this.tileBgs = [];
        this.isSpinning = false;
        this.pendingBonusTrigger = false;
        this.autoPlay = new AutoPlayController();
        this.autoSpinTimer = null;
        this.currentSpinWasBonus = false;
        this.currentSpinAutomationCompleted = false;
        this.skipAnimations = false;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    preload() {
        this.load.image('bg_base', 'assets/characters/basic_bg.png');
        this.load.image('reel_frame', 'assets/characters/reel_frame.png');
        this.load.image('bonusreel_frame', 'assets/characters/bonusreel_frame.png');
        this.load.image('bonus_frame', 'assets/characters/bonus_frame.png');
        this.load.video('bg_bonus_video', 'assets/characters/bonus_bg.png.mp4', true);

        // Character Portraits
        this.load.image('ZEUS', 'assets/characters/zeus_portrait.png');
        this.load.image('HADES', 'assets/characters/hades_portrait.png');
        this.load.image('MEDUSA', 'assets/characters/medusa_portrait.png');
        this.load.image('POSEIDON', 'assets/characters/poseidon_portrait.png');
        this.load.image('ARES', 'assets/characters/ares_portrait.png');
        this.load.image('TYPHON', 'assets/characters/typhon_portrait.png.jpeg');

        // Symbols
        this.load.image('SIGIL', 'assets/symbols/symbol_sigil.png');
        this.load.image('SKULL', 'assets/symbols/symbol_skull.png');
        this.load.image('DRACHMA', 'assets/symbols/symbol_drachma.png');
        this.load.image('SEAL', 'assets/symbols/symbol_seal.png');
        this.load.image('CHARGE', 'assets/symbols/symbol_charge.png');
        this.load.image('RIFT', 'assets/symbols/symbol_rift.png');
    }

    create() {
        const width = 1280;
        const height = 720;
        this.visualFeedback = new VisualFeedback(this, () => this.reducedMotion || this.skipAnimations);
        const reducedMotionToggle = document.getElementById('reducedMotionToggle');
        if (reducedMotionToggle) {
            reducedMotionToggle.checked = this.reducedMotion;
            document.documentElement.classList.toggle('reduced-motion', this.reducedMotion || this.skipAnimations);
            reducedMotionToggle.onchange = () => {
                this.reducedMotion = reducedMotionToggle.checked;
                document.documentElement.classList.toggle('reduced-motion', this.reducedMotion || this.skipAnimations);
            };
        }

        // Background Image Sprite
        this.bgImage = this.add.image(width / 2, height / 2, 'bg_base');
        this.bgImage.setDisplaySize(width, height);
        this.bgImage.setDepth(-100);
        this.scale.on('resize', this.fitBonusBackgroundVideo, this);

        this.add.text(width / 2, 26, 'GODS OF THE ABYSS: BATTLEFIELD', {
            fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffd700', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.statusText = this.add.text(width / 2, 53, '3 SEALS MAY AWAKEN DIVINE CONVERGENCE', {
            fontFamily: 'Arial', fontSize: '16px', color: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Ares Contract HUD Tracker
        this.aresHudBg = this.add.graphics();
        this.aresHudText = this.add.text(210, 87, 'ARES CONTRACT: NO ACTIVE CHALLENGE', {
            fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffaa44'
        }).setOrigin(0.5);
        this.updateAresHudDisplay(null);

        this.createBonusMeter();
        this.relicHudText = this.add.text(width - 135, 640, 'NO ACTIVE RELIC', {
            fontSize: '11px', fontStyle: 'bold', color: '#ddd1a0', align: 'center',
            wordWrap: { width: 140 }
        }).setOrigin(0.5);
        this.lastSeenEventSequence = 0;
        this.displayedSoulBank = 0;

        this.buildGrid();

        // Control Panel UI
        const uiY = height - 45;
        const uiBar = this.add.graphics();
        uiBar.fillStyle(0x11111f, 0.95);
        uiBar.lineStyle(2, 0x333355, 1);
        uiBar.fillRoundedRect(180, uiY - 25, width - 360, 50, 10);
        uiBar.strokeRoundedRect(180, uiY - 25, width - 360, 50, 10);

        this.add.text(240, uiY - 12, 'BALANCE', { fontSize: '10px', color: '#8888aa' }).setOrigin(0.5);
        this.balanceText = this.add.text(240, uiY + 8, `${this.gameLogic.getBalance()} CR`, { fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

        this.add.text(380, uiY - 12, 'SOUL BANK', { fontSize: '10px', color: '#ff4444' }).setOrigin(0.5);
        this.soulBankText = this.add.text(380, uiY + 8, '0 CR', { fontSize: '15px', fontStyle: 'bold', color: '#ff6666' }).setOrigin(0.5);

        this.add.text(520, uiY - 12, 'WIN', { fontSize: '10px', color: '#8888aa' }).setOrigin(0.5);
        this.winText = this.add.text(520, uiY + 8, '0 CR', { fontSize: '15px', fontStyle: 'bold', color: '#00ff88' }).setOrigin(0.5);

        const spinBtnBg = this.add.graphics();
        spinBtnBg.fillStyle(0xffd700, 1);
        spinBtnBg.fillRoundedRect(width - 300, uiY - 20, 110, 40, 8);

        this.spinBtnText = this.add.text(width - 245, uiY, 'SPIN', {
            fontSize: '18px', fontStyle: 'bold', color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.spinBtnText.on('pointerdown', () => this.handleSpin());

        this.add.text(width - 115, uiY, 'HISTORY', {
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showHistoryModal());

        this.setupBuyBonusDOM();
        this.setupBetSelectorDOM();
        this.setupAutoplayDOM();
        this.setupGameInfoDOM();
    }

    setupAutoplayDOM() {
        const button = document.getElementById('autoplayButton');
        const overlay = document.getElementById('autoplayOverlay');
        const close = document.getElementById('closeAutoplay');
        const cancel = document.getElementById('cancelAutoplay');
        const start = document.getElementById('startAutoplay');
        const customInput = document.getElementById('autoplayCustomCount');
        const countLabel = document.getElementById('autoplaySelectedCount');
        const betLabel = document.getElementById('autoplayBet');
        const wagerLabel = document.getElementById('autoplayEstimatedWager');
        const balanceLabel = document.getElementById('autoplayBalance');
        const resumeToggle = document.getElementById('resumeAutoplayAfterBonus');
        const message = document.getElementById('autoplayMessage');
        const status = document.getElementById('autoplayStatus');
        const statusDetails = document.getElementById('autoplayStatusDetails');
        const bonusControls = document.getElementById('bonusAutoControls');
        const bonusSpinsLeft = document.getElementById('bonusAutoSpinsLeft');
        const bonusDetails = document.getElementById('bonusAutoDetails');
        const pauseBonus = document.getElementById('pauseBonusAuto');
        const skipAnimations = document.getElementById('skipBonusAnimations');
        const animationSpeed = document.getElementById('bonusAnimationSpeed');
        const countOptions = [...document.querySelectorAll('[data-autoplay-count]')];
        if ([button, overlay, close, cancel, start, customInput, countLabel, betLabel, wagerLabel,
            balanceLabel, resumeToggle, message, status, statusDetails, bonusControls, bonusSpinsLeft,
            bonusDetails, pauseBonus, skipAnimations, animationSpeed].some(element => !element) || !countOptions.length) {
            throw new Error('Autoplay controls markup is missing or incomplete');
        }

        let selectedCount = 10;
        let panelOpen = false;
        const isBetValid = () => this.gameLogic.rules.betting.stakeLevels.includes(this.gameLogic.getStake());
        const canStart = () => !this.isSpinning && !this.gameLogic.inBonus
            && !this.gameLogic.pendingBonusEntry && !this.gameLogic.pendingRelicSelection
            && !this.gameLogic.pendingZeusAction && !this.gameLogic.typhonTriggered
            && isBetValid() && this.gameLogic.getBalance() >= this.gameLogic.getStake();
        const getSelectedCount = () => customInput.value.trim()
            ? Number(customInput.value)
            : selectedCount;
        const closePanel = () => {
            panelOpen = false;
            overlay.classList.remove('is-open');
            window.setTimeout(() => {
                if (!panelOpen) overlay.hidden = true;
            }, 180);
            button.focus();
        };
        const renderSummary = () => {
            const count = getSelectedCount();
            const validCount = Number.isInteger(count) && count >= 1 && count <= 1000;
            const stake = this.gameLogic.getStake();
            countLabel.textContent = validCount ? count.toLocaleString() : '—';
            betLabel.textContent = formatCredits(stake);
            wagerLabel.textContent = validCount ? formatCredits(stake * count) : '—';
            balanceLabel.textContent = formatCredits(this.gameLogic.getBalance());
            start.disabled = !validCount || !canStart();
            message.textContent = canStart()
                ? (validCount ? '' : 'Choose a whole number from 1 to 1,000 spins.')
                : 'Autoplay requires an available base-game spin and a valid bet.';
        };
        const openPanel = () => {
            if (this.autoPlay.active || this.gameLogic.inBonus || !canStart()) {
                renderSummary();
                if (!canStart() && !this.gameLogic.inBonus) message.textContent = 'A spin is not currently available.';
            } else {
                renderSummary();
            }
            panelOpen = true;
            overlay.hidden = false;
            window.requestAnimationFrame(() => overlay.classList.add('is-open'));
        };

        this.positionAutoplayControls = () => {
            const canvas = this.game.canvas;
            if (!canvas) return;
            const bounds = canvas.getBoundingClientRect();
            const compact = bounds.width < 700;
            const buttonX = compact ? 820 : 900;
            const buttonY = compact ? 634 : 675;
            button.style.left = `${bounds.left + bounds.width * (buttonX / 1280)}px`;
            button.style.top = `${bounds.top + bounds.height * (buttonY / 720)}px`;
            button.style.width = `${compact ? 64 : 88}px`;
            button.style.height = `${compact ? 27 : 38}px`;
            button.style.fontSize = `${compact ? 7 : 10}px`;
            status.style.left = `${bounds.left + bounds.width * (buttonX / 1280)}px`;
            status.style.top = `${bounds.top + bounds.height * (compact ? 610 : 632) / 720}px`;
            status.style.fontSize = `${compact ? 7 : 10}px`;
            bonusControls.style.left = `${bounds.left + bounds.width * 640 / 1280}px`;
            bonusControls.style.top = `${bounds.top + bounds.height * 620 / 720}px`;
            bonusControls.style.width = `${Math.min(340, Math.max(220, bounds.width - 16))}px`;
        };
        this.positionAutoplayControls();
        window.addEventListener('resize', this.positionAutoplayControls);

        this.updateAutoplayUI = () => {
            const mode = this.autoPlay.mode;
            const running = this.autoPlay.active;
            button.classList.toggle('is-stop', running);
            button.textContent = running
                ? (mode === 'bonus' ? 'PAUSE AUTO' : 'STOP')
                : mode === 'bonus-paused' ? 'RESUME AUTO' : 'AUTOPLAY';
            button.setAttribute('aria-label', button.textContent);
            button.disabled = mode === 'idle' && (this.gameLogic.inBonus || this.isSpinning);
            status.hidden = mode !== 'base';
            if (mode === 'base') {
                statusDetails.textContent =
                    `${this.autoPlay.remainingSpins} REMAINING · ${formatCredits(this.gameLogic.getStake())} BET · ${formatCredits(this.gameLogic.getBalance())} BALANCE`;
            }
            bonusControls.hidden = !this.gameLogic.inBonus;
            bonusSpinsLeft.textContent =
                `${this.gameLogic.bonusSpinsLeft} SPIN${this.gameLogic.bonusSpinsLeft === 1 ? '' : 'S'} LEFT`;
            bonusDetails.textContent =
                `${formatCredits(this.gameLogic.getStake())} BET · ${formatCredits(this.gameLogic.getBalance())} BALANCE`;
            pauseBonus.textContent = mode === 'bonus-paused' ? 'RESUME AUTO' : 'PAUSE AUTO';
            const betPanel = document.getElementById('betSelectorTrigger');
            if (betPanel) this.updateBetSelectorUI?.();
            if (panelOpen) renderSummary();
        };

        this.clearAutoSpinTimer = () => {
            if (this.autoSpinTimer !== null) {
                window.clearTimeout(this.autoSpinTimer);
                this.autoSpinTimer = null;
            }
        };
        this.scheduleAutomaticSpin = () => {
            this.clearAutoSpinTimer();
            if (!this.autoPlay.active || this.isSpinning) return;
            this.autoSpinTimer = window.setTimeout(() => {
                this.autoSpinTimer = null;
                if (!this.autoPlay.active || this.isSpinning) return;
                if (this.autoPlay.mode === 'base' && (!isBetValid()
                    || this.gameLogic.getBalance() < this.gameLogic.getStake())) {
                    this.autoPlay.stop();
                    this.statusText.setText('AUTOPLAY STOPPED: INSUFFICIENT CREDITS OR INVALID BET');
                    this.updateAutoplayUI();
                    return;
                }
                try {
                    this.handleSpin(true);
                } catch (error) {
                    this.autoPlay.stop();
                    this.statusText.setText('AUTOPLAY STOPPED: SPIN ERROR');
                    this.updateAutoplayUI();
                    console.error('Automatic spin failed:', error);
                }
            }, Math.max(45, this.visualFeedback.duration(360)));
        };
        this.startBonusAutomation = () => {
            if (!this.gameLogic.inBonus) return;
            this.autoPlay.startBonus();
            this.updateAutoplayUI();
            this.scheduleAutomaticSpin();
        };
        this.resumeBonusAutomation = () => {
            if (this.autoPlay.resumeBonus()) {
                this.updateAutoplayUI();
                this.scheduleAutomaticSpin();
            }
        };
        this.resumeAutoplayAfterBonus = () => {
            const spinCount = this.autoPlay.takeResumeSpins();
            if (spinCount <= 0 || !canStart()) {
                this.updateAutoplayUI();
                return;
            }
            this.autoPlay.startBase(spinCount);
            this.updateAutoplayUI();
            this.scheduleAutomaticSpin();
        };

        countOptions.forEach(option => option.addEventListener('click', () => {
            customInput.value = '';
            selectedCount = Number(option.dataset.autoplayCount);
            countOptions.forEach(item => item.classList.toggle('is-selected', item === option));
            renderSummary();
        }));
        customInput.addEventListener('input', () => {
            countOptions.forEach(option => option.classList.remove('is-selected'));
            renderSummary();
        });
        resumeToggle.addEventListener('change', () => {
            this.autoPlay.resumeAfterBonus = resumeToggle.checked;
        });
        start.addEventListener('click', () => {
            const count = getSelectedCount();
            if (!Number.isInteger(count) || count < 1 || count > 1000 || !canStart()) {
                renderSummary();
                return;
            }
            this.autoPlay.resumeAfterBonus = resumeToggle.checked;
            this.autoPlay.startBase(count);
            closePanel();
            this.updateAutoplayUI();
            this.scheduleAutomaticSpin();
        });
        const cancelAutoplay = () => closePanel();
        button.addEventListener('click', () => {
            if (this.autoPlay.mode === 'base') {
                this.clearAutoSpinTimer();
                this.autoPlay.stop();
                this.statusText.setText('AUTOPLAY STOPPED');
                this.updateAutoplayUI();
            } else if (this.autoPlay.mode === 'bonus') {
                this.clearAutoSpinTimer();
                this.autoPlay.pauseBonus();
                this.updateAutoplayUI();
            } else if (this.autoPlay.mode === 'bonus-paused') {
                this.resumeBonusAutomation();
            } else {
                openPanel();
            }
        });
        pauseBonus.addEventListener('click', () => {
            if (this.autoPlay.mode === 'bonus') {
                this.clearAutoSpinTimer();
                this.autoPlay.pauseBonus();
                this.updateAutoplayUI();
            } else if (this.autoPlay.mode === 'bonus-paused') {
                this.resumeBonusAutomation();
            }
        });
        skipAnimations.addEventListener('change', () => {
            this.skipAnimations = skipAnimations.checked;
            document.documentElement.classList.toggle('reduced-motion', this.reducedMotion || this.skipAnimations);
            this.scheduleAutomaticSpinIfIdle();
        });
        animationSpeed.addEventListener('change', () => {
            this.visualFeedback.setSpeedMultiplier(Number(animationSpeed.value));
            this.scheduleAutomaticSpinIfIdle();
        });
        this.scheduleAutomaticSpinIfIdle = () => {
            if (!this.isSpinning && this.autoPlay.active) this.scheduleAutomaticSpin();
        };
        this.setAutoplayBonusControlsAvailable = active => {
            bonusControls.hidden = !active;
            this.updateAutoplayUI();
        };
        close.addEventListener('click', cancelAutoplay);
        cancel.addEventListener('click', cancelAutoplay);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) cancelAutoplay();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && panelOpen) closePanel();
        });
        this.updateAutoplayUI();
    }

    setupGameInfoDOM() {
        const trigger = document.getElementById('gameInfoButton');
        const overlay = document.getElementById('gameInfoOverlay');
        const dialog = document.getElementById('gameInfoDialog');
        const content = document.getElementById('gameInfoContent');
        const close = document.getElementById('closeGameInfo');
        const tabs = [...document.querySelectorAll('[data-info-tab]')];
        if (!trigger || !overlay || !dialog || !content || !close || !tabs.length) {
            throw new Error('Game information panel markup is missing or incomplete');
        }

        let isOpen = false;
        this.activeInfoTab = 'play';
        const canOpen = () => !this.isSpinning && !this.gameLogic.pendingBonusEntry
            && !this.gameLogic.pendingRelicSelection && !this.gameLogic.pendingZeusAction
            && !this.gameLogic.typhonTriggered;
        const setActiveTab = tabName => {
            this.activeInfoTab = tabName;
            tabs.forEach(tab => {
                const active = tab.dataset.infoTab === tabName;
                tab.classList.toggle('is-active', active);
                tab.setAttribute('aria-selected', `${active}`);
            });
            content.querySelectorAll('[data-info-panel]').forEach(panel => {
                const active = panel.dataset.infoPanel === tabName;
                panel.hidden = !active;
                panel.classList.toggle('is-active', active);
            });
        };
        const renderContent = () => {
            content.innerHTML = renderGameInfoContent(this.gameLogic.rules, this.gameLogic.getStake());
            content.querySelectorAll('[data-info-panel]').forEach(panel => {
                panel.setAttribute('role', 'tabpanel');
            });
            setActiveTab(this.activeInfoTab);
        };
        const closePanel = (returnFocus = true) => {
            isOpen = false;
            overlay.classList.remove('is-open');
            window.clearTimeout(this.gameInfoHideTimer);
            this.gameInfoHideTimer = window.setTimeout(() => {
                if (!isOpen) overlay.hidden = true;
            }, 190);
            if (returnFocus && canOpen()) trigger.focus();
        };
        const openPanel = () => {
            if (!canOpen()) return;
            renderContent();
            overlay.hidden = false;
            isOpen = true;
            window.clearTimeout(this.gameInfoHideTimer);
            window.requestAnimationFrame(() => overlay.classList.add('is-open'));
            close.focus();
        };

        tabs.forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.infoTab)));
        trigger.addEventListener('click', openPanel);
        close.addEventListener('click', () => closePanel());
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closePanel();
        });
        dialog.addEventListener('click', event => event.stopPropagation());
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && isOpen) closePanel();
        });

        this.positionGameInfoButton = () => {
            const canvas = this.game.canvas;
            if (!canvas) return;
            const bounds = canvas.getBoundingClientRect();
            trigger.style.left = `${bounds.left + bounds.width - 47}px`;
            trigger.style.top = `${bounds.top + bounds.height * (68 / 720)}px`;
        };
        this.positionGameInfoButton();
        window.addEventListener('resize', this.positionGameInfoButton);

        this.updateGameInfoButton = () => {
            trigger.disabled = !canOpen();
            if (!canOpen() && isOpen) closePanel(false);
        };
        this.updateGameInfoButton();
    }

    setupBetSelectorDOM() {
        const trigger = document.getElementById('betSelectorTrigger');
        const currentAmount = document.getElementById('currentBetAmount');
        const overlay = document.getElementById('betSelectionOverlay');
        const panel = document.getElementById('betSelectionPanel');
        const selectedAmount = document.getElementById('selectedBetAmount');
        const totalAmount = document.getElementById('totalBetAmount');
        const minimumBet = document.getElementById('minimumBet');
        const maximumBet = document.getElementById('maximumBet');
        const presetGrid = document.getElementById('betPresetGrid');
        const decrease = document.getElementById('decreaseBet');
        const increase = document.getElementById('increaseBet');
        const confirm = document.getElementById('confirmBetSelection');
        const cancel = document.getElementById('cancelBetSelection');
        const close = document.getElementById('closeBetSelector');
        const status = document.getElementById('betSelectorStatus');
        if (!trigger || !currentAmount || !overlay || !panel || !selectedAmount || !totalAmount
            || !minimumBet || !maximumBet || !presetGrid || !decrease || !increase
            || !confirm || !cancel || !close || !status) {
            throw new Error('Bet selector markup is missing or incomplete');
        }

        const levels = this.gameLogic.rules.betting.stakeLevels;
        if (!levels.length || !levels.includes(this.gameLogic.getStake())) {
            throw new Error('Configured bet levels must include the starting stake');
        }
        let pendingBet = this.gameLogic.getStake();
        let panelOpen = false;
        let presetButtons = [];
        minimumBet.textContent = formatCredits(levels[0]);
        maximumBet.textContent = formatCredits(levels.at(-1));

        const canChangeBet = () => !this.isSpinning && !this.autoPlay.active && !this.gameLogic.inBonus
            && !this.gameLogic.pendingBonusEntry && !this.gameLogic.pendingRelicSelection
            && !this.gameLogic.pendingZeusAction && !this.gameLogic.typhonTriggered;
        const renderPendingBet = () => {
            const formatted = formatCredits(pendingBet);
            selectedAmount.textContent = formatted;
            totalAmount.textContent = formatted;
            presetButtons.forEach(button => {
                const selected = Number(button.dataset.stake) === pendingBet;
                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', `${selected}`);
            });
            const index = levels.indexOf(pendingBet);
            decrease.disabled = !canChangeBet() || index <= 0;
            increase.disabled = !canChangeBet() || index >= levels.length - 1;
            presetButtons.forEach(button => { button.disabled = !canChangeBet(); });
            confirm.disabled = !canChangeBet();
        };
        const closePanel = (returnFocus = true) => {
            panelOpen = false;
            overlay.classList.remove('is-open');
            window.clearTimeout(this.betSelectorHideTimer);
            this.betSelectorHideTimer = window.setTimeout(() => {
                if (!panelOpen) overlay.hidden = true;
            }, 180);
            if (returnFocus) trigger.focus();
        };
        const openPanel = () => {
            if (!canChangeBet()) return;
            pendingBet = this.gameLogic.getStake();
            status.textContent = 'Choose a bet level, then confirm to apply it.';
            status.classList.remove('is-locked');
            renderPendingBet();
            window.clearTimeout(this.betSelectorHideTimer);
            overlay.hidden = false;
            panelOpen = true;
            window.requestAnimationFrame(() => overlay.classList.add('is-open'));
            close.focus();
        };
        const changeBet = nextBet => {
            if (!canChangeBet() || !levels.includes(nextBet)) return;
            pendingBet = nextBet;
            selectedAmount.classList.remove('is-changing');
            void selectedAmount.offsetWidth;
            selectedAmount.classList.add('is-changing');
            window.setTimeout(() => selectedAmount.classList.remove('is-changing'), 180);
            renderPendingBet();
        };

        presetGrid.replaceChildren();
        presetButtons = levels.map(level => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'bet-preset';
            button.dataset.stake = `${level}`;
            button.textContent = formatCredits(level).replace(' CR', '');
            button.setAttribute('aria-label', `Set bet to ${formatCredits(level)}`);
            button.addEventListener('click', () => changeBet(level));
            presetGrid.append(button);
            return button;
        });

        trigger.addEventListener('click', openPanel);
        decrease.addEventListener('click', () => {
            const index = levels.indexOf(pendingBet);
            if (index > 0) changeBet(levels[index - 1]);
        });
        increase.addEventListener('click', () => {
            const index = levels.indexOf(pendingBet);
            if (index < levels.length - 1) changeBet(levels[index + 1]);
        });
        confirm.addEventListener('click', () => {
            if (!canChangeBet()) return;
            if (!this.gameLogic.setStake(pendingBet)) {
                status.textContent = 'The selected bet could not be applied. Please select a valid level.';
                return;
            }
            this.updateBuyBonusUI?.();
            this.updateBetSelectorUI();
            this.updateAutoplayUI?.();
            closePanel();
        });
        cancel.addEventListener('click', () => closePanel());
        close.addEventListener('click', () => closePanel());
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closePanel();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && panelOpen) closePanel();
        });

        this.positionBetSelector = () => {
            const canvas = this.game.canvas;
            if (!canvas) return;
            const bounds = canvas.getBoundingClientRect();
            trigger.style.left = `${bounds.left + bounds.width * (660 / 1280)}px`;
            trigger.style.top = `${bounds.top + bounds.height * (675 / 720)}px`;
        };
        this.positionBetSelector();
        window.addEventListener('resize', this.positionBetSelector);

        this.updateBetSelectorUI = () => {
            currentAmount.textContent = formatCredits(this.gameLogic.getStake());
            trigger.disabled = !canChangeBet();
            if (!canChangeBet()) {
                status.textContent = this.gameLogic.inBonus || this.gameLogic.pendingBonusEntry
                    ? 'Bet changes are locked during bonus play.'
                    : 'Bet changes are locked while the reels are resolving.';
                status.classList.add('is-locked');
                if (panelOpen) closePanel(false);
            }
            renderPendingBet();
        };
        this.updateBetSelectorUI();
    }

    // --- SAFE BACKGROUND SWITCHER METHOD ---
    setGameBackground() {
        const inBonusGame = this.gameLogic.inBonus && Boolean(this.gameLogic.bonusChoice);
        if (inBonusGame) {
            this.bgImage.setVisible(false);
            if (!this.bonusBackgroundMatte) {
                this.bonusBackgroundMatte = this.add.rectangle(640, 360, 1280, 720, 0x05050b)
                    .setDepth(-101);
            }
            this.bonusBackgroundMatte.setVisible(true);
            if (!this.bonusBackgroundVideo) {
                this.bonusBackgroundVideo = this.add.video(640, 360, 'bg_bonus_video')
                    .setOrigin(0.5)
                    .setDepth(-100)
                    .setMute(true);
                this.bonusBackgroundVideo.video?.addEventListener(
                    'loadedmetadata',
                    () => this.fitBonusBackgroundVideo(),
                    { once: true }
                );
            }
            this.fitBonusBackgroundVideo();
            this.bonusBackgroundVideo.setVisible(true);
            if (!this.bonusBackgroundVideo.isPlaying()) this.bonusBackgroundVideo.play(true);
        } else {
            this.bonusBackgroundMatte?.setVisible(false);
            if (this.bonusBackgroundVideo) {
                this.bonusBackgroundVideo.stop();
                this.bonusBackgroundVideo.setVisible(false);
            }
            this.bgImage.setTexture('bg_base').setDisplaySize(1280, 720).setVisible(true);
        }
        this.updateReelFrame();
    }

    fitBonusBackgroundVideo() {
        const video = this.bonusBackgroundVideo;
        if (!video) return;
        const source = video.video;
        const sourceWidth = source?.videoWidth || video.width;
        const sourceHeight = source?.videoHeight || video.height;
        if (!sourceWidth || !sourceHeight) return;

        const { width, height } = this.scale.gameSize;
        const scale = Math.min(width / sourceWidth, height / sourceHeight);
        video
            .setPosition(width / 2, height / 2)
            .setDisplaySize(sourceWidth * scale, sourceHeight * scale);
        this.bonusBackgroundMatte?.setPosition(width / 2, height / 2).setSize(width, height);
    }

    updateReelFrame() {
        if (!this.reelFrame || !this.gridLayout) return;
        const frameKey = this.gameLogic.inBonus && this.gameLogic.bonusChoice
            ? 'bonusreel_frame'
            : 'reel_frame';
        this.reelFrame.setTexture(frameKey);
        const { gridStartX, gridStartY, gridWidth, gridHeight } = this.gridLayout;
        const frameTexture = this.textures.get(frameKey).getSourceImage();
        const scale = Math.max(
            gridWidth / (frameTexture.width * 0.83),
            gridHeight / (frameTexture.height * 0.75)
        );
        const frameWidth = frameTexture.width * scale;
        const frameHeight = frameTexture.height * scale;
        const openingCenterOffsetY = (0.522 - 0.5) * frameHeight;
        this.reelFrame
            .setPosition(gridStartX + gridWidth / 2, gridStartY + gridHeight / 2 - openingCenterOffsetY)
            .setDisplaySize(frameWidth, frameHeight);
    }

    setupBuyBonusDOM() {
        const buyBonusBtn = document.getElementById('buyBonusBtn');
        const buyBonusModal = document.getElementById('buyBonusModal');
        const confirmBuyBtn = document.getElementById('confirmBuyBtn');
        const cancelBuyBtn = document.getElementById('cancelBuyBtn');
        const buyBonusCostText = document.getElementById('buyBonusCostText');
        const buyBonusPath = document.getElementById('buyBonusPath');

        this.updateBuyBonusUI = () => {
            if (!buyBonusBtn) return;
            const cost = this.gameLogic.getBuyBonusCost();
            const priceLabel = buyBonusBtn.querySelector('.buy-bonus-price');
            if (priceLabel) priceLabel.textContent = `${cost.toLocaleString()} CR`;
            buyBonusBtn.setAttribute('aria-label', `Buy bonus for ${cost.toLocaleString()} credits`);
            if (this.gameLogic.canBuyBonus() && !this.gameLogic.inBonus && !this.isSpinning) {
                buyBonusBtn.removeAttribute('disabled');
                buyBonusBtn.style.opacity = '1';
                buyBonusBtn.style.cursor = 'pointer';
            } else {
                buyBonusBtn.setAttribute('disabled', 'true');
                buyBonusBtn.style.opacity = '0.5';
                buyBonusBtn.style.cursor = 'not-allowed';
            }
        };

        if (buyBonusBtn) {
            buyBonusBtn.onclick = () => {
                if (this.isSpinning || !this.gameLogic.canBuyBonus()) return;
                const cost = this.gameLogic.getBuyBonusCost();
                if (buyBonusCostText) buyBonusCostText.innerText = `Cost: ${cost.toLocaleString()} CR`;
                if (buyBonusModal) buyBonusModal.style.display = 'flex';
            };
        }

        if (cancelBuyBtn) {
            cancelBuyBtn.onclick = () => {
                if (buyBonusModal) buyBonusModal.style.display = 'none';
            };
        }

        if (confirmBuyBtn) {
            confirmBuyBtn.onclick = () => {
                if (buyBonusModal) buyBonusModal.style.display = 'none';
                if (this.isSpinning || !this.gameLogic.canBuyBonus()) {
                    this.updateBuyBonusUI();
                    return;
                }
                const path = buyBonusPath?.value ?? 'OLYMPUS';
                const result = this.gameLogic.buyBonus(path);
                if (result.success) {
                    this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
                    this.updateBonusMeterDisplay();
                    this.updateBetSelectorUI?.();
                    this.updateGameInfoButton?.();
                    this.updateBuyBonusUI();
                    this.buildGrid();
                    this.statusText.setText(`BONUS BOUGHT: ${path} | SPINS: ${this.gameLogic.bonusSpinsLeft}`);
                    this.updateAresHudDisplay(this.gameLogic.aresChallenge);
                    this.updateRelicIndicator();
                    this.setGameBackground();
                    this.showBanner(`${path} PURCHASED`, '#ffd700', () => this.showRelicSelectionModal());
                } else {
                    alert('Purchase failed: Insufficient funds or already in a bonus round.');
                }
            };
        }

        this.updateBuyBonusUI();
    }

    updateAresHudDisplay(challenge) {
        this.aresHudBg.clear();
        this.aresHudBg.fillStyle(0x221111, 0.9);
        this.aresHudBg.lineStyle(2, 0xff5533, 0.9);
        this.aresHudBg.fillRoundedRect(20, 76, 380, 22, 6);
        this.aresHudBg.strokeRoundedRect(20, 76, 380, 22, 6);

        if (!challenge) {
            this.aresHudText.setText('ARES CONTRACT: NO ACTIVE CHALLENGE');
        } else if (challenge.completed) {
            const reward = this.gameLogic.getStake() * this.gameLogic.rules.ares.rewardStakeMultiplier;
            this.aresHudText.setText(`ARES CONTRACT COMPLETE | +${reward} CR`);
        } else {
            this.aresHudText.setText(`ARES CONTRACT ${challenge.progress}/${challenge.target} | ${challenge.turnsLeft} SPINS`);
        }
    }

    createBonusMeter() {
        this.bonusMeterElement = document.getElementById('bonusMeter');
        this.bonusMeterTrack = this.bonusMeterElement?.querySelector('.bonus-meter-track');
        this.bonusMeterSegments = [...(this.bonusMeterElement?.querySelectorAll('.bonus-meter-segment') ?? [])];
        this.bonusMeterStageText = document.getElementById('bonusMeterStage');
        this.bonusMeterProgressText = document.getElementById('bonusMeterProgress');
        this.bonusMeterSpinsText = document.getElementById('bonusMeterSpins');
        this.bonusMeterFeaturesText = document.getElementById('bonusMeterFeatures');
        this.bonusMeterAnnouncement = document.getElementById('bonusMeterAnnouncement');
        if (!this.bonusMeterElement || !this.bonusMeterTrack || this.bonusMeterSegments.length !== 3
            || !this.bonusMeterStageText || !this.bonusMeterProgressText || !this.bonusMeterSpinsText
            || !this.bonusMeterFeaturesText || !this.bonusMeterAnnouncement) {
            throw new Error('Bonus meter markup is missing or incomplete');
        }

        this.bonusMeterStageLabels = [...this.bonusMeterElement.querySelectorAll('.bonus-meter-stage-labels span')];
        this.positionBonusMeter = () => {
            const canvas = this.game.canvas;
            if (!canvas) return;
            const bounds = canvas.getBoundingClientRect();
            this.bonusMeterElement.style.left = `${bounds.left + bounds.width / 2}px`;
            this.bonusMeterElement.style.top = `${bounds.top + bounds.height * (72 / 720)}px`;
            this.bonusMeterElement.style.setProperty(
                '--meter-scale',
                `${Math.min(1, Math.max(0.65, bounds.width / 1280))}`
            );
        };
        this.positionBonusMeter();
        window.addEventListener('resize', this.positionBonusMeter);
        this.bonusMeterResizeObserver = new ResizeObserver(this.positionBonusMeter);
        this.bonusMeterResizeObserver.observe(this.game.canvas);
        this.updateBonusMeterDisplay(undefined, false);
    }

    animateBonusMeter(result) {
        const target = this.gameLogic.isBonusActive
            ? this.gameLogic.survivalProgress
            : 0;
        const from = this.displayedMeterProgress ?? 0;
        this.updateBonusMeterDisplay(target);
        if (target > from && !this.visualFeedback.reducedMotion()) {
            this.bonusMeterElement.classList.remove('is-charging');
            void this.bonusMeterElement.offsetWidth;
            this.bonusMeterElement.classList.add('is-charging');
            window.clearTimeout(this.bonusMeterChargeTimer);
            this.bonusMeterChargeTimer = window.setTimeout(
                () => this.bonusMeterElement.classList.remove('is-charging'),
                500
            );
        }
    }

    updateBonusMeterDisplay(progress, animate = true) {
        const names = ['AWAKENING', 'ASCENSION', 'DIVINE POWER'];
        const inSurvivalBonus = this.gameLogic.isBonusActive;
        let stageIndex;
        let stageFill;

        if (inSurvivalBonus) {
            this.bonusMeterElement.classList.remove('is-inactive');
            const rules = this.gameLogic.rules.bonusSurvival;
            const activeStage = this.gameLogic.survivalStage;
            const isFinale = activeStage === 4;
            const currentStage = Math.min(activeStage, 3);
            stageIndex = Math.max(0, currentStage - 1);
            const threshold = rules.stageThresholds[stageIndex];
            const value = isFinale ? threshold : Phaser.Math.Clamp(
                progress ?? this.gameLogic.survivalProgress,
                0,
                threshold
            );
            stageFill = isFinale ? 1 : threshold > 0 ? value / threshold : 0;
            this.displayedMeterProgress = value;

            this.bonusMeterSegments.forEach((segment, index) => {
                const complete = isFinale || this.gameLogic.survivalCompletedStages.includes(index + 1);
                const fill = complete ? 1 : index === stageIndex ? stageFill : 0;
                segment.querySelector('.bonus-meter-fill').style.width = `${fill * 100}%`;
                segment.classList.toggle('is-complete', complete);
                segment.classList.toggle(
                    'is-approaching',
                    index === stageIndex && stageFill >= 0.8 && stageFill < 1
                );
                this.bonusMeterStageLabels[index]?.classList.toggle('is-current', index === stageIndex);
            });

            const stageName = activeStage === 4 ? 'TYPHON FINALE' : names[stageIndex];
            const stageStatus = isFinale
                ? 'FINALE'
                : `${Math.floor(stageFill * 100)}%`;
            this.bonusMeterStageText.textContent = `${stageName} · ${stageStatus}`;
            if (!isFinale) {
                const remaining = Math.max(0, threshold - value);
                this.bonusMeterProgressText.textContent =
                    `${value.toFixed(1)} / ${threshold} PROGRESS | NEED ${remaining.toFixed(1)}`;
            } else {
                this.bonusMeterProgressText.textContent = 'ALL THREE STAGES COMPLETE';
            }
            this.bonusMeterSpinsText.textContent =
                `${this.gameLogic.survivalSpinsLeft} SPIN${this.gameLogic.survivalSpinsLeft === 1 ? '' : 'S'} LEFT`;
            const featureNames = { ZEUS: 'ZEUS', HADES: 'HADES', TYPHON: 'TYPHON', POSEIDON: 'POSEIDON', MEDUSA: 'MEDUSA' };
            const activeFeatures = this.gameLogic.unlockedCharacterFeatures.map(feature => featureNames[feature] ?? feature);
            this.bonusMeterFeaturesText.textContent = activeFeatures.length
                ? `${activeFeatures.join(' + ')} FEATURE${activeFeatures.length === 1 ? '' : 'S'} ACTIVE`
                : 'NO CHARACTER FEATURES ACTIVE';
            const overallPercent = Math.round(
                (this.gameLogic.survivalCompletedStages.length + stageFill) / 3 * 100
            );
            this.bonusMeterTrack.setAttribute('aria-valuenow', `${overallPercent}`);
            this.bonusMeterTrack.setAttribute(
                'aria-valuetext',
                `${stageName}, ${stageStatus}; ${this.gameLogic.survivalSpinsLeft} spins left`
            );
            this.bonusMeterElement.setAttribute('data-stage', `${activeStage}`);
        } else {
            this.bonusMeterElement.classList.add('is-inactive');
            this.displayedMeterProgress = 0;
            this.bonusMeterSegments.forEach((segment, index) => {
                window.clearTimeout(segment.bonusMeterActivationTimer);
                delete segment.bonusMeterActivationTimer;
                segment.querySelector('.bonus-meter-fill').style.width = '0%';
                segment.classList.remove('is-complete', 'is-approaching', 'is-activating');
                this.bonusMeterStageLabels[index]?.classList.remove('is-current');
            });
            window.clearTimeout(this.bonusMeterDivineTimer);
            this.bonusMeterElement.classList.remove('is-divine-transforming');
            this.bonusMeterStageText.textContent = 'INACTIVE';
            this.bonusMeterProgressText.textContent = 'METER ACTIVATES WHEN BONUS BEGINS';
            this.bonusMeterSpinsText.textContent = 'NO BONUS ACTIVE';
            this.bonusMeterFeaturesText.textContent = 'CHARACTER FEATURES LOCKED';
            this.bonusMeterTrack.setAttribute('aria-valuenow', '0');
            this.bonusMeterTrack.setAttribute('aria-valuetext', 'Bonus meter inactive');
            this.bonusMeterElement.setAttribute('data-stage', '0');
            this.bonusMeterElement.classList.remove('is-charging', 'is-divine-transforming');
            window.clearTimeout(this.bonusMeterChargeTimer);
        }
        if (animate) this.positionBonusMeter();
    }

    activateBonusStage(stage) {
        const segment = this.bonusMeterSegments[stage - 1];
        if (segment) {
            segment.classList.remove('is-activating');
            void segment.offsetWidth;
            segment.classList.add('is-activating');
            window.clearTimeout(segment.bonusMeterActivationTimer);
            segment.bonusMeterActivationTimer = window.setTimeout(() => {
                segment.classList.remove('is-activating');
                delete segment.bonusMeterActivationTimer;
            }, this.visualFeedback.duration(700));
        }

        if (stage === 3) {
            this.bonusMeterElement.classList.remove('is-divine-transforming');
            void this.bonusMeterElement.offsetWidth;
            this.bonusMeterElement.classList.add('is-divine-transforming');
            window.clearTimeout(this.bonusMeterDivineTimer);
            this.bonusMeterDivineTimer = window.setTimeout(
                () => this.bonusMeterElement.classList.remove('is-divine-transforming'),
                this.visualFeedback.duration(900)
            );
        }
    }

    showStageActivations(stageEvents, onComplete) {
        if (!stageEvents.length) {
            onComplete();
            return;
        }

        const names = ['AWAKENING', 'ASCENSION', 'DIVINE POWER'];
        const highestStage = Math.max(...stageEvents.map(event => event.stage));
        stageEvents.forEach(event => {
            this.activateBonusStage(event.stage);
            if (event.characterFeatureUnlocked) {
                const tint = event.stage === 1 ? 0x42a5ff : event.stage === 2 ? 0xffd84a : 0xcf72ff;
                this.pulsePortrait(event.characterFeatureUnlocked, tint);
            }
        });

        if (!this.gameLogic.maxWinReached) {
            this.playCelebrationSound(highestStage === 3
                ? 'divine'
                : highestStage === 2 ? 'ascension' : 'awakening');
        }

        const featureNames = { ZEUS: 'ZEUS', HADES: 'HADES', TYPHON: 'TYPHON', POSEIDON: 'POSEIDON', MEDUSA: 'MEDUSA' };
        const messages = stageEvents.map(event => {
            const stageName = names[event.stage - 1] ?? 'TYPHON';
            if (event.bonusSpinsAdded !== undefined) {
                const unlocked = event.characterFeatureUnlocked
                    ? `${featureNames[event.characterFeatureUnlocked] ?? event.characterFeatureUnlocked} FEATURE UNLOCKED`
                    : 'TYPHON CHOICE UNLOCKED';
                return `${stageName} COMPLETE | +${event.bonusSpinsAdded} SPINS | ${unlocked}`;
            }
            const wrathUpgrade = (event.powerLevel * this.gameLogic.rules.bonusMeter.wrathMultiplierPerStage).toFixed(1);
            const titanTurns = event.powerLevel * this.gameLogic.rules.bonusMeter.titanBonusTurnsPerStage;
            return `${stageName} | WRATH +${wrathUpgrade}× | TITAN +${titanTurns} TURNS`;
        });
        this.bonusMeterAnnouncement.textContent = messages.join(' · ');
        this.bonusMeterAnnouncement.classList.add('is-visible');
        window.clearTimeout(this.bonusMeterAnnouncementTimer);
        this.bonusMeterAnnouncementTimer = window.setTimeout(
            () => this.bonusMeterAnnouncement.classList.remove('is-visible'),
            this.visualFeedback.duration(1600)
        );
        const color = highestStage === 3 ? '#cf72ff' : highestStage === 2 ? '#ffd84a' : '#42a5ff';
        this.showBanner(messages.join('  |  '), color, onComplete);
    }

    playCelebrationSound(kind) {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioContext ??= new AudioContextClass();
        this.audioContext.resume().then(() => {
            const notes = kind === 'divine' ? [523.25, 659.25, 783.99, 1046.5]
                : kind === 'ascension' ? [440, 554.37, 659.25]
                    : kind === 'max-win' ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
                        : [392, 493.88, 587.33];
            const startTime = this.audioContext.currentTime;
            notes.forEach((frequency, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const noteStart = startTime + index * 0.1;
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, noteStart);
                gain.gain.setValueAtTime(0.0001, noteStart);
                gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.24);
                oscillator.connect(gain);
                gain.connect(this.audioContext.destination);
                oscillator.start(noteStart);
                oscillator.stop(noteStart + 0.25);
            });
        }).catch(error => console.warn('Bonus celebration audio could not start:', error));
    }

    buildGrid() {
        if (this.gridContainer) {
            this.gridContainer.destroy(true);
        }
        this.gridContainer = this.add.container(0, 0);

        const width = 1280;
        const tileW = 118;
        const tileH = 74;
        const gridCols = 5;
        const gridRows = this.gameLogic.rows;
        const gridWidth = gridCols * tileW;
        const gridHeight = gridRows * tileH;
        
        const gridStartX = (width - gridWidth) / 2;
        const gridStartY = 245;

        this.gridLayout = { gridStartX, gridStartY, gridWidth, gridHeight };
        const frameKey = this.gameLogic.inBonus && this.gameLogic.bonusChoice
            ? 'bonusreel_frame'
            : 'reel_frame';
        this.reelFrame = this.add.image(width / 2, 0, frameKey);
        this.gridContainer.add(this.reelFrame);
        this.updateReelFrame();

        const baseSymbols = ['SIGIL', 'SKULL', 'DRACHMA', 'SEAL', 'CHARGE', 'RIFT'];
        this.tileGrid = [];
        this.tileBgs = [];
        this.tileStateLabels = [];

        for (let r = 0; r < gridRows; r++) {
            this.tileGrid[r] = [];
            this.tileBgs[r] = [];
            this.tileStateLabels[r] = [];
            for (let c = 0; c < gridCols; c++) {
                const posX = gridStartX + c * tileW + tileW / 2;
                const posY = gridStartY + r * tileH + tileH / 2;

                const bgTile = this.add.graphics();
                bgTile.fillStyle(0x1a1a2e, 0.9);
                bgTile.fillRoundedRect(posX - 52, posY - 36, 104, 72, 8);
                this.gridContainer.add(bgTile);
                this.tileBgs[r][c] = bgTile;

                const initialSymbol = baseSymbols[(r + c) % baseSymbols.length];
                const sprite = this.add.image(posX, posY, initialSymbol);
                sprite.setDisplaySize(80, 64);
                sprite.baseScaleX = sprite.scaleX;
                sprite.baseScaleY = sprite.scaleY;
                sprite.baseY = posY;

                this.gridContainer.add(sprite);
                this.tileGrid[r][c] = sprite;

                const stateLabel = this.add.text(posX, posY + 27, '', {
                    fontSize: '9px', fontStyle: 'bold', color: '#ffffff',
                    backgroundColor: '#111111cc', padding: { x: 3, y: 1 }
                }).setOrigin(0.5).setDepth(5);
                this.gridContainer.add(stateLabel);
                this.tileStateLabels[r][c] = stateLabel;
            }
        }
    }

    handleSpin(automatic = false) {
        if (this.isSpinning || (this.autoPlay.active && !automatic)
            || (this.gameLogic.inBonus && !automatic)) return;

        if (!this.gameLogic.canSpin()) {
            this.statusText.setText('INSUFFICIENT CREDITS!');
            if (automatic) {
                this.clearAutoSpinTimer?.();
                this.autoPlay.stop();
                this.updateAutoplayUI?.();
            }
            return;
        }

        this.currentSpinWasBonus = this.gameLogic.inBonus;
        this.currentSpinAutomationCompleted = false;
        this.isSpinning = true;
        this.updateBuyBonusUI?.();
        this.updateBetSelectorUI?.();
        this.updateGameInfoButton?.();
        this.updateAutoplayUI?.();
        this.statusText.setText('BATTLEFIELD EVOLVING...');

        const prevRows = this.gameLogic.rows;
        let result;
        try {
            result = this.gameLogic.generateSpinOutcome();
        } catch (error) {
            this.isSpinning = false;
            this.autoPlay.stop();
            this.updateAutoplayUI?.();
            this.updateBetSelectorUI?.();
            throw error;
        }

        if (!result) {
            this.isSpinning = false;
            if (automatic) this.autoPlay.stop();
            this.updateBetSelectorUI?.();
            this.updateGameInfoButton?.();
            this.updateAutoplayUI?.();
            return;
        }

        this.updateAutoplayUI?.();
        if (result.rows !== prevRows) {
            this.buildGrid();
        }

        this.updateAresHudDisplay(result.aresChallenge);
        this.visualFeedback.animateReels(result.matrix, this.tileGrid, this.gameLogic.rules.symbols, () => {
            this.renderCellStates(result.cellStates);
            this.showEventFeedback();
            this.balanceText.setText(`${result.remainingBalance} CR`);
            this.animateBonusMeter(result);
            this.updateAresHudDisplay(this.gameLogic.aresChallenge);
            const previousSoulBank = this.displayedSoulBank ?? 0;
            this.displayedSoulBank = result.soulBank;
            this.soulBankText.setText(`${result.soulBank} CR`);
            if (result.soulBank > previousSoulBank) {
                this.pulseHudText(this.soulBankText, 0xff6666, `SOUL +${result.soulBank - previousSoulBank} CR`);
                const milestones = [25, 50, 75, 100].filter(value => previousSoulBank < value && result.soulBank >= value);
                const milestone = milestones.at(-1);
                if (milestone) this.pulseHudText(this.soulBankText, 0xffd700, `SOUL BANK ${milestone} CR`);
            }

            this.visualFeedback.highlightWins(
                result.wins,
                this.gameLogic.rules.paylines[result.rows],
                this.tileGrid,
                () => this.visualFeedback.countUp(this.winText, result.totalWin, 320, () => {
                    this.showStageActivations(result.stageEvents, () => this.resolveSpinPresentation(result));
                })
            );
        });
    }

    renderCellStates(cellStates) {
        cellStates.forEach((row, r) => row.forEach((state, c) => {
            const bg = this.tileBgs[r]?.[c];
            const sprite = this.tileGrid[r]?.[c];
            const label = this.tileStateLabels[r]?.[c];
            if (!bg || !sprite) return;
            bg.clear();
            const color = state.petrified ? 0xb5b7c8
                : state.cursed ? 0x665a78
                    : state.wild ? 0xffaa00
                        : state.chargeLevel > 0 ? 0x00aaff
                            : 0x1a1a2e;
            bg.fillStyle(color, 0.9);
            bg.fillRoundedRect(sprite.x - 48, sprite.y - 36, 96, 72, 8);
            if (label) {
                const indicator = state.petrified ? 'STONE WILD'
                    : state.cursed ? 'CURSED'
                        : state.chargeLevel > 0 ? `CHARGE ${state.chargeLevel}`
                            : state.wild ? 'WILD' : '';
                label.setText(indicator);
                label.setVisible(Boolean(indicator));
            }
        }));
    }

    updateRelicIndicator() {
        const relic = this.gameLogic.activeRelic;
        if (!relic) {
            this.relicHudText.setText('NO ACTIVE RELIC');
            this.relicHudText.setColor('#aaa');
            return;
        }
        const description = {
            LIGHTNING: `LIGHTNING | CAP ${this.gameLogic.getZeusChargeCap()}`,
            SOUL: `SOUL | ${this.gameLogic.soulBank}/${this.gameLogic.rules.hades.soulCap} CR`,
            PETRIFICATION: 'STONE WILDS | PRESERVED CELLS'
        };
        this.relicHudText.setText(description[relic] ?? relic);
        this.relicHudText.setColor('#ffe48c');
    }

    showEventFeedback() {
        const events = this.gameLogic.getEventHistory().filter(event => event.sequence > this.lastSeenEventSequence);
        if (!events.length) return;
        this.lastSeenEventSequence = events[events.length - 1].sequence;
        const poseidonRows = events.filter(event => event.type === 'poseidon-rows-shifted').flatMap(event => event.rows);
        const riftColumns = events.filter(event => event.type === 'rift-columns-shifted').flatMap(event => event.columns);
        if (poseidonRows.length) this.visualFeedback.sweep(poseidonRows.flatMap(row => this.tileGrid[row] ?? []), 'x', 12, 0x55ccff, 140);
        if (riftColumns.length) this.visualFeedback.sweep(riftColumns.flatMap(column => this.tileGrid.map(row => row[column]).filter(Boolean)), 'y', 12, 0xbb55ff, 140);
        const chargedCells = events.filter(event => event.type === 'cell-charged')
            .map(event => this.tileGrid[event.row]?.[event.column]).filter(Boolean);
        if (chargedCells.length) this.visualFeedback.pulseTargets(chargedCells, 0x66ddff, 100);
        for (const event of events) {
            if (event.type === 'souls-collected') {
                const cells = event.cells.map(cell => this.tileGrid[cell.row]?.[cell.column]).filter(Boolean);
                this.visualFeedback.pulseTargets(cells, 0xff6666, 120);
                this.animateSoulsToBank(event.cells);
            } else if (event.type === 'zeus-network-completed') {
                this.traceZeusNetworks(event.networks);
            } else if (event.type === 'cell-petrified') {
                const cell = this.tileGrid[event.row]?.[event.column];
                if (cell) this.visualFeedback.pulseTargets([cell], 0xc4c9e8, 150);
            } else if (event.type === 'ares-contract-progress') {
                this.visualFeedback.pulseTargets([this.aresHudText], 0xffaa44, 110);
            }
        }
        const labels = events.map(event => {
            if (event.type === 'cell-charged') return `ZEUS CHARGE ${event.level}/3`;
            if (event.type === 'zeus-discharge') return 'ZEUS NETWORK DISCHARGED';
            if (event.type === 'souls-collected') return `SOULS +${event.cells.reduce((sum, cell) => sum + cell.value, 0)} CR`;
            if (event.type === 'poseidon-rows-shifted') return `POSEIDON SHIFTED ${event.rows.length} ROW${event.rows.length === 1 ? '' : 'S'}`;
            if (event.type === 'rift-columns-shifted') return `RIFT SHIFTED ${event.columns.length} COLUMN${event.columns.length === 1 ? '' : 'S'}`;
            if (event.type === 'cell-petrified') return 'MEDUSA PETRIFIED A CELL';
            if (event.type === 'ares-contract-failed') return `ARES CONTRACT FAILED ${event.progress}/${event.target ?? 3}`;
            if (event.type === 'ares-contract-progress') return `ARES ${event.progress}/${event.target}`;
            if (event.type === 'ares-contract-completed') return `ARES REWARD +${event.reward} CR`;
            if (event.type === 'bonus-retriggered') return `+${event.turnsAdded} BONUS TURNS`;
            if (event.type === 'typhon-stage-changed') return `TYPHON STAGE ${event.to}`;
            return null;
        }).filter(Boolean).slice(0, 3);
        const showNextLabel = index => {
            if (index >= labels.length) return;
            this.showBanner(labels[index], '#ffe08a', () => showNextLabel(index + 1));
        };
        showNextLabel(0);
        this.updateRelicIndicator();
        if (this.gameLogic.aresChallenge?.completed) {
            this.pulseHudText(this.aresHudText, 0xffd700, `ARES SUCCESS +${this.gameLogic.getStake() * this.gameLogic.rules.ares.rewardStakeMultiplier} CR`);
        }
    }

    animateSoulsToBank(cells) {
        if (this.visualFeedback.reducedMotion() || !this.textures.exists('DRACHMA')) return;
        cells.slice(0, 8).forEach((cell, index) => {
            const source = this.tileGrid[cell.row]?.[cell.column];
            if (!source) return;
            const token = this.add.image(source.x, source.y, 'DRACHMA').setDisplaySize(24, 24).setDepth(30);
            this.visualFeedback.schedule(index * 45, () => {
                this.tweens.add({
                    targets: token,
                    x: this.soulBankText.x,
                    y: this.soulBankText.y,
                    scaleX: 0.35,
                    scaleY: 0.35,
                    alpha: 0.25,
                    duration: this.visualFeedback.duration(300),
                    ease: 'Sine.easeIn',
                    onComplete: () => token.destroy()
                });
            });
        });
    }

    completeAutomatedSpin(result, bonusCheck) {
        if (this.currentSpinAutomationCompleted) return;
        this.currentSpinAutomationCompleted = true;

        const outcome = this.currentSpinWasBonus
            ? this.autoPlay.completeBonusSpin({
                bonusActive: this.gameLogic.inBonus && !bonusCheck.ended,
                requiresChoice: Boolean(result.typhonTriggered)
            })
            : this.autoPlay.completeBaseSpin({
                bonusTriggered: Boolean(result.bonusTriggered),
                requiresChoice: Boolean(result.typhonTriggered || result.maxWinReached),
                canAffordNext: this.gameLogic.getBalance() >= this.gameLogic.getStake()
            });

        if (outcome === 'insufficient-balance') {
            this.statusText.setText('AUTOPLAY STOPPED: INSUFFICIENT CREDITS');
        } else if (outcome === 'choice') {
            this.statusText.setText('AUTOPLAY PAUSED: PLAYER CHOICE REQUIRED');
        }
        this.updateAutoplayUI?.();
        this.updateBetSelectorUI?.();
    }

    resolveSpinPresentation(result) {
        const bonusCheck = this.gameLogic.checkBonusEnd();
        this.completeAutomatedSpin(result, bonusCheck);
        this.updateBonusMeterDisplay(undefined, false);
        this.updateBetSelectorUI?.();
        this.updateGameInfoButton?.();
        this.updateBuyBonusUI?.();

        if (result.maxWinReached || this.gameLogic.maxWinReached) {
            this.setGameBackground('bg_base');
            if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
            this.updateAresHudDisplay(null);
            this.updateRelicIndicator();
            this.showMaxWinCelebration();
            return;
        }

        if (result.pendingZeusAction) {
            this.resolveZeusAutomatically();
            return;
        }

        if (result.typhonTriggered) {
            this.pendingBonusTrigger = result.bonusTriggered && !this.gameLogic.inBonus;
            this.pulsePortrait('TYPHON', 0xff44aa, () => {
                this.showBanner('TYPHON AWAKENS', '#ff66cc', () => {
                    this.setGameBackground();
                    this.showTyphonEvolutionModal();
                });
            });
            return;
        }

        if (result.bonusTriggered && !this.gameLogic.bonusChoice) {
            const seals = this.getCellsForSymbol(result.matrix, 'SEAL');
            this.visualFeedback.pulseTargets(seals, 0xffd700, 160, () => {
                this.showBanner('DIVINE CONVERGENCE', '#ffd700', () => {
                    this.setGameBackground();
                    this.showPantheonDraftModal();
                });
            });
            return;
        }

        if (this.gameLogic.inBonus) {
            this.statusText.setText(`BONUS: ${this.gameLogic.bonusChoice} | TURNS: ${this.gameLogic.bonusSpinsLeft} | WIN: ${this.gameLogic.currentBonusWin.toFixed(2)} CR`);
            if (result.bonusRetriggered) this.showBanner(`+${result.bonusTurnsAdded} BONUS TURNS`, '#ffd700');
            if (result.riftShifts > 0) this.showBanner(`RIFT SHIFT: ${result.riftShifts} COLUMNS`, '#bb55ff');
            this.finishPresentation();
            return;
        }

        if (bonusCheck.ended) {
            this.setGameBackground('bg_base');
            if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
            this.updateRelicIndicator();
            this.updateAresHudDisplay(null);
            if (bonusCheck.failed) {
                this.bonusMeterElement.classList.remove('is-failed');
                void this.bonusMeterElement.offsetWidth;
                this.bonusMeterElement.classList.add('is-failed');
                window.setTimeout(() => this.bonusMeterElement.classList.remove('is-failed'), 650);
                this.showBanner(`STAGE ${bonusCheck.failureStage} FAILED — BONUS ENDED`, '#8a9aaa', () => {
                    this.showBonusSummaryModal(bonusCheck.totalBonusWin, bonusCheck.featurePayout, bonusCheck.soulReward);
                });
            } else {
                this.showBonusSummaryModal(bonusCheck.totalBonusWin, bonusCheck.featurePayout, bonusCheck.soulReward);
            }
            return;
        }

        this.statusText.setText(result.totalWin > 0 ? `VICTORY! ${result.totalWin.toFixed(2)} CR` : 'BATTLEFIELD STABLE. SPIN AGAIN.');
        this.finishPresentation();
    }

    resolveZeusAutomatically() {
        const result = this.gameLogic.applyZeusAction('DISCHARGE');
        if (!result) {
            this.finishPresentation();
            return;
        }
        this.renderEngineBoard(result.matrix, result.cellStates);
        this.renderCellStates(result.cellStates);
        const transformed = [];
        result.cellStates.forEach((row, r) => row.forEach((state, c) => {
            if (state.wild && this.tileGrid[r]?.[c]) transformed.push(this.tileGrid[r][c]);
        }));
                this.visualFeedback.pulseTargets(transformed, 0xffd700, 170, () => this.visualFeedback.countUp(this.winText, result.totalWin, 320, () => {
                    this.animateBonusMeter(result);
                    this.showStageActivations(result.stageEvents, () => {
                        if (result.maxWinReached || this.gameLogic.maxWinReached) {
                            this.gameLogic.checkBonusEnd();
                            this.updateBonusMeterDisplay(undefined, false);
                            this.setGameBackground('bg_base');
                            if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                            this.updateAresHudDisplay(null);
                            this.updateRelicIndicator();
                            this.showMaxWinCelebration();
                            return;
                        }
                        if (this.gameLogic.pendingZeusAction) {
                            this.showZeusActionModal(this.gameLogic.getZeusChoices());
                            return;
                        }
                        if (result.typhonTriggered) {
                            this.pulsePortrait('TYPHON', 0xff44aa, () => {
                                this.showBanner('DIVINE POWER AWAKENS', '#cf72ff', () => {
                                    this.setGameBackground();
                                    this.showTyphonEvolutionModal();
                                });
                            });
                            return;
                        }
                    const end = this.gameLogic.checkBonusEnd();
                    this.updateBonusMeterDisplay(undefined, false);
                    if (this.gameLogic.maxWinReached) {
                        this.setGameBackground('bg_base');
                        if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                        this.updateAresHudDisplay(null);
                        this.updateRelicIndicator();
                        this.showMaxWinCelebration();
                    } else if (end.ended) {
                        this.setGameBackground();
                        if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                        this.updateAresHudDisplay(null);
                        this.soulBankText.setText('0 CR');
                        this.updateRelicIndicator();
                        this.showBonusSummaryModal(end.totalBonusWin, end.featurePayout, end.soulReward);
                    } else {
                        this.statusText.setText(`ZEUS DISCHARGE | BONUS TOTAL ${result.currentBonusWin.toFixed(2)} CR`);
                        this.finishPresentation();
                    }
                    });
                }));
    }

    getCellsForSymbol(matrix, symbol) {
        const cells = [];
        matrix.forEach((row, r) => row.forEach((value, c) => {
            if (value === symbol && this.tileGrid[r]?.[c]) cells.push(this.tileGrid[r][c]);
        }));
        return cells;
    }

    pulsePortrait(key, tint, onComplete = () => {}) {
        if (!this.textures.exists(key)) {
            onComplete();
            return;
        }

        const portrait = this.add.image(640, 176, key)
            .setDisplaySize(88, 88)
            .setDepth(30)
            .setTint(tint)
            .setScale(0.72)
            .setAlpha(0);
        if (this.visualFeedback.reducedMotion()) {
            portrait.destroy();
            onComplete();
            return;
        }

        this.tweens.add({
            targets: portrait,
            alpha: 1,
            scale: 1,
            duration: this.visualFeedback.duration(180),
            ease: 'Sine.easeOut',
            onComplete: () => this.tweens.add({
                targets: portrait,
                alpha: 0,
                scale: 1.12,
                duration: this.visualFeedback.duration(220),
                ease: 'Sine.easeIn',
                onComplete: () => {
                    portrait.destroy();
                    onComplete();
                }
            })
        });
    }

    pulseHudText(text, color, message) {
        const previousText = text.text;
        const previousColor = text.style.color;
        text.setText(message);
        text.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
        this.visualFeedback.schedule(650, () => {
            if (!text.active) return;
            text.setText(previousText);
            text.setColor(previousColor);
        });
    }

    showBanner(message, color, onComplete = () => {}) {
        const banner = this.add.text(640, 115, message, {
            fontSize: '24px', fontStyle: 'bold', color, stroke: '#08080c', strokeThickness: 5
        }).setOrigin(0.5).setDepth(200).setAlpha(this.visualFeedback.reducedMotion() ? 1 : 0);
        if (this.visualFeedback.reducedMotion()) {
            banner.destroy();
            onComplete();
            return;
        }
        this.tweens.add({
            targets: banner,
            alpha: 1,
            y: 95,
            duration: this.visualFeedback.duration(140),
            yoyo: true,
            hold: this.visualFeedback.duration(420),
            onComplete: () => {
                banner.destroy();
                onComplete();
            }
        });
    }

    finishPresentation() {
        this.isSpinning = false;
        this.updateBetSelectorUI?.();
        this.updateGameInfoButton?.();
        this.updateBuyBonusUI?.();
        this.updateAutoplayUI?.();
        this.scheduleAutomaticSpin?.();
    }

    showBonusSummaryModal(totalWin, featurePayout = totalWin, soulReward = 0) {
        const { width, height } = this.scale;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);

        const modalBox = this.add.graphics();
        modalBox.lineStyle(4, 0x00ffcc, 1);
        modalBox.fillStyle(0x0a1a22, 0.98);
        modalBox.fillRoundedRect(width / 2 - 250, height / 2 - 170, 500, 340, 16);
        modalBox.strokeRoundedRect(width / 2 - 250, height / 2 - 170, 500, 340, 16);

        const titleText = this.add.text(width / 2, height / 2 - 110, 'BONUS ROUND COMPLETE', {
            fontSize: '24px', fontStyle: 'bold', color: '#00ffcc'
        }).setOrigin(0.5);

        const msgText = this.add.text(width / 2, height / 2 - 35,
            `Line & feature wins: ${featurePayout.toFixed(2)} CR\nSoul Bank release: ${soulReward.toFixed(2)} CR\nTOTAL: ${totalWin.toFixed(2)} CR`, {
            fontSize: '17px', fontStyle: 'bold', color: '#ffd700', align: 'center', lineSpacing: 8
        }).setOrigin(0.5);

        const collectBtnBg = this.add.graphics();
        collectBtnBg.fillStyle(0x00ffcc, 1);
        collectBtnBg.fillRoundedRect(width / 2 - 90, height / 2 + 40, 180, 50, 10);

        const collectBtnText = this.add.text(width / 2, height / 2 + 65, 'COLLECT', {
            fontSize: '18px', fontStyle: 'bold', color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const modalElements = [overlay, modalBox, titleText, msgText, collectBtnBg, collectBtnText];

        collectBtnText.on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
            this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
            this.winText.setText(`${totalWin} CR`);
            this.soulBankText.setText('0 CR');
            this.statusText.setText(`BONUS COLLECTED: +${totalWin} CR ADDED TO BALANCE!`);
            this.isSpinning = false;
            this.updateBetSelectorUI?.();
            this.updateGameInfoButton?.();
            this.updateBuyBonusUI?.();
            this.updateAutoplayUI?.();
            this.resumeAutoplayAfterBonus?.();
        });
    }

    showMaxWinCelebration() {
        this.playCelebrationSound('max-win');
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x080514, 0.9).setDepth(300);
        const frame = this.add.rectangle(width / 2, height / 2, 620, 280, 0x171126, 1)
            .setStrokeStyle(4, 0xffd84a).setDepth(301);
        const title = this.add.text(width / 2, height / 2 - 75, 'PAYOUT LIMIT REACHED', {
            fontSize: '32px', fontStyle: 'bold', color: '#ffd84a',
            stroke: '#321b59', strokeThickness: 8
        }).setOrigin(0.5).setDepth(302);
        const details = this.add.text(
            width / 2,
            height / 2 + 47,
            'ROUND PAYOUT LIMIT REACHED',
            {
                fontSize: '16px', fontStyle: 'bold', color: '#d8c8ff'
            }
        ).setOrigin(0.5).setDepth(302);
        const close = this.add.text(width / 2, height / 2 + 100, 'CONTINUE', {
            fontSize: '18px', fontStyle: 'bold', color: '#090612',
            backgroundColor: '#ffd84a', padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setDepth(302).setInteractive({ useHandCursor: true });
        const elements = [overlay, frame, title, details, close];
        close.on('pointerdown', () => {
            elements.forEach(element => element.destroy());
            this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
            this.updateBonusMeterDisplay();
            this.isSpinning = false;
            this.updateBetSelectorUI?.();
            this.updateGameInfoButton?.();
            this.updateBuyBonusUI?.();
            this.updateAutoplayUI?.();
            this.resumeAutoplayAfterBonus?.();
        });

        if (!this.visualFeedback.reducedMotion()) {
            title.setScale(0.6);
            this.tweens.add({ targets: title, scale: 1, duration: 360, ease: 'Back.easeOut' });
            this.tweens.add({ targets: frame, alpha: { from: 0.4, to: 1 }, duration: 450 });
        }
    }

    showTyphonEvolutionModal() {
        const { width, height } = this.scale;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);

        const modalBox = this.add.graphics();
        modalBox.lineStyle(3, 0xff44aa, 1);
        modalBox.fillStyle(0x1a0a20, 0.98);
        modalBox.fillRoundedRect(width / 2 - 280, height / 2 - 200, 560, 400, 16);
        modalBox.strokeRoundedRect(width / 2 - 280, height / 2 - 200, 560, 400, 16);

        const titleText = this.add.text(width / 2, height / 2 - 150, 'DIVINE POWER: CHOOSE YOUR TYPHON REWARD', {
            fontSize: '22px', fontStyle: 'bold', color: '#cf72ff'
        }).setOrigin(0.5);

        const descText = this.add.text(width / 2, height / 2 - 100,
            `STAGE POWER ${this.gameLogic.typhonPowerLevel} | FINAL TYPHON CHOICE`, {
            fontSize: '14px', color: '#ffffff'
        }).setOrigin(0.5);

        const availableChoices = this.gameLogic.getTyphonChoices();
        const choices = availableChoices.map((key, index) => ({
            key,
            label: key === 'ABYSSAL_WRATH'
                ? `ABYSSAL WRATH\n${(1 + this.gameLogic.typhonPowerLevel * this.gameLogic.rules.bonusMeter.wrathMultiplierPerStage).toFixed(1)}× (2× Soul Bank + 500 CR)`
                : `TITAN ASCENDANCE\n+${5 + this.gameLogic.typhonPowerLevel * this.gameLogic.rules.bonusMeter.titanBonusTurnsPerStage} Bonus & Mega Wild turns`,
            color: key === 'ABYSSAL_WRATH' ? '#ff4444' : '#ffaa00',
            x: availableChoices.length === 1 ? width / 2 : width / 2 + (index === 0 ? -140 : 140)
        }));

        const modalElements = [overlay, modalBox, titleText, descText];

        choices.forEach(ch => {
            const btnBg = this.add.graphics();
            btnBg.fillStyle(0x2a1530, 1);
            btnBg.lineStyle(2, 0xff44aa, 1);
            btnBg.fillRoundedRect(ch.x - 120, height / 2 - 30, 240, 140, 10);
            btnBg.strokeRoundedRect(ch.x - 120, height / 2 - 30, 240, 140, 10);

            const btnText = this.add.text(ch.x, height / 2 + 40, ch.label, {
                fontSize: '14px', fontStyle: 'bold', color: ch.color, align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btnText.on('pointerdown', () => {
                if (!this.gameLogic.selectTyphonAction(ch.key)) return;
                modalElements.forEach(el => el.destroy());
                this.updateBonusMeterDisplay();
                if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                this.setGameBackground('bg_base');
                this.statusText.setText(`TYPHON RESOLVED: ${ch.key}! RESUMING BATTLE...`);
                this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
                this.soulBankText.setText(`${this.gameLogic.soulBank} CR`);
                if (this.updateBuyBonusUI) this.updateBuyBonusUI();
                if (this.gameLogic.maxWinReached) {
                    this.gameLogic.checkBonusEnd();
                    this.updateBonusMeterDisplay(undefined, false);
                    this.showMaxWinCelebration();
                    return;
                }
                if (this.pendingBonusTrigger) {
                    this.pendingBonusTrigger = false;
                    this.showPantheonDraftModal();
                    return;
                }
                if (this.gameLogic.pendingZeusAction) {
                    this.resumeBonusAutomation?.();
                    this.resolveZeusAutomatically();
                    return;
                }
                if (this.gameLogic.pendingRelicSelection) {
                    this.showRelicSelectionModal();
                    return;
                }
                this.updateBonusMeterDisplay(undefined, false);
                const bonusCheck = this.gameLogic.checkBonusEnd();
                if (bonusCheck.ended) {
                    this.setGameBackground('bg_base');
                    if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                    this.showBonusSummaryModal(bonusCheck.totalBonusWin, bonusCheck.featurePayout, bonusCheck.soulReward);
                    this.updateAresHudDisplay(null);
                    return;
                }
                this.isSpinning = false;
                this.updateBetSelectorUI?.();
                this.updateGameInfoButton?.();
                this.updateAutoplayUI?.();
                this.resumeBonusAutomation?.();
            });

            modalElements.push(btnBg, btnText);
        });
    }

    showPantheonDraftModal() {
        const { width, height } = this.scale;

        this.setGameBackground();
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);

        const titleText = this.add.text(width / 2, height / 2 - 140, 'DIVINE CONVERGENCE: CHOOSE PATH', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffd700'
        }).setOrigin(0.5);

        const paths = [
            { key: 'OLYMPUS', label: 'OLYMPUS\nLightning Network', color: '#00ffff', x: width / 2 - 200 },
            { key: 'UNDERWORLD', label: 'UNDERWORLD\nDrachma Soul Bank', color: '#ff4444', x: width / 2 },
            { key: 'RIFT', label: 'RIFT\nRift Column Shifts', color: '#bb55ff', x: width / 2 + 200 }
        ];

        const modalElements = [overlay, titleText];

        paths.forEach(p => {
            const cardFrame = this.add.image(p.x, height / 2 + 10, 'bonus_frame')
                .setDisplaySize(160, 245)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(p.x, height / 2 + 10, p.label, {
                fontSize: '13px', fontStyle: 'bold', color: p.color, align: 'center'
            }).setOrigin(0.5);

            cardFrame.on('pointerdown', () => {
                if (!this.gameLogic.selectBonusPath(p.key)) return;
                modalElements.forEach(el => el.destroy());
                this.updateBetSelectorUI?.();
                this.updateGameInfoButton?.();
                this.updateBonusMeterDisplay();
                this.buildGrid();
                this.setGameBackground();

                this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
                if (this.updateBuyBonusUI) this.updateBuyBonusUI();
                this.statusText.setText(`PATH SELECTED: ${p.key} | SPINS: ${this.gameLogic.bonusSpinsLeft}`);
                this.updateAresHudDisplay(this.gameLogic.aresChallenge);
                const portraitByPath = { OLYMPUS: 'ZEUS', UNDERWORLD: 'HADES', RIFT: 'TYPHON' };
                this.pulsePortrait(portraitByPath[p.key], p.color, () => {
                    this.showBanner(`${p.key}: ${p.label.split('\n')[1]}`, p.color, () => this.showRelicSelectionModal());
                });
            });

            modalElements.push(cardFrame, btnText);
        });
    }

    showZeusActionModal(choices) {
        if (this.autoPlay.mode === 'bonus') {
            this.clearAutoSpinTimer?.();
            this.autoPlay.pauseBonus();
            this.updateAutoplayUI?.();
        }
        const { width, height } = this.scale;
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);

        const modalBox = this.add.graphics();
        modalBox.lineStyle(3, 0x00ffff, 1);
        modalBox.fillStyle(0x101a28, 0.98);
        modalBox.fillRoundedRect(width / 2 - 300, height / 2 - 170, 600, 340, 14);
        modalBox.strokeRoundedRect(width / 2 - 300, height / 2 - 170, 600, 340, 14);
        const title = this.add.text(width / 2, height / 2 - 125, 'ZEUS NETWORK: CHOOSE AN ACTION', {
            fontSize: '21px', fontStyle: 'bold', color: '#00ffff'
        }).setOrigin(0.5);
        const descriptions = {
            OVERCHARGE: 'Increase charge on every eligible cell.',
            CHAIN_LIGHTNING: 'Connect nearby charged networks.',
            DISCHARGE: 'Convert this network to Wilds and reevaluate.'
        };
        const elements = [overlay, modalBox, title];
        const buttonWidth = 540 / choices.length;

        choices.forEach((action, index) => {
            const x = width / 2 - 270 + buttonWidth * (index + 0.5);
            const background = this.add.graphics();
            background.fillStyle(0x123142, 1);
            background.lineStyle(2, 0x00ffff, 1);
            background.fillRoundedRect(x - buttonWidth / 2 + 5, height / 2 - 45, buttonWidth - 10, 125, 8);
            background.strokeRoundedRect(x - buttonWidth / 2 + 5, height / 2 - 45, buttonWidth - 10, 125, 8);
            const label = this.add.text(x, height / 2 - 5, `${action}\n${descriptions[action]}`, {
                fontSize: '14px', fontStyle: 'bold', color: '#ffffff', align: 'center',
                wordWrap: { width: buttonWidth - 24 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            label.on('pointerdown', () => {
                const result = this.gameLogic.applyZeusAction(action);
                if (!result) return;
                elements.forEach(element => element.destroy());
                this.renderEngineBoard(result.matrix, result.cellStates);
                this.renderCellStates(result.cellStates);
                this.winText.setText(`${result.totalWin} CR`);
                this.statusText.setText(`ZEUS ${action}: BONUS TOTAL ${result.currentBonusWin} CR`);
                this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
                this.animateBonusMeter(result);
                this.showStageActivations(result.stageEvents, () => {
                    if (result.maxWinReached || this.gameLogic.maxWinReached) {
                        this.gameLogic.checkBonusEnd();
                        this.updateBonusMeterDisplay(undefined, false);
                        this.setGameBackground('bg_base');
                        if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                        this.updateAresHudDisplay(null);
                        this.updateRelicIndicator();
                        this.showMaxWinCelebration();
                        return;
                    }
                    if (result.typhonTriggered) {
                        this.pulsePortrait('TYPHON', 0xff44aa, () => {
                            this.showBanner('DIVINE POWER AWAKENS', '#cf72ff', () => {
                                this.setGameBackground();
                                this.showTyphonEvolutionModal();
                            });
                        });
                        return;
                    }
                    const bonusCheck = this.gameLogic.checkBonusEnd();
                    this.updateBonusMeterDisplay(undefined, false);
                    this.updateBuyBonusUI?.();
                    if (bonusCheck.ended) {
                        this.setGameBackground('bg_base');
                        if (this.tileGrid.length !== this.gameLogic.rows) this.buildGrid();
                        this.updateAresHudDisplay(null);
                        this.soulBankText.setText('0 CR');
                        this.updateRelicIndicator();
                        this.balanceText.setText(`${this.gameLogic.getBalance()} CR`);
                        this.showBonusSummaryModal(bonusCheck.totalBonusWin, bonusCheck.featurePayout, bonusCheck.soulReward);
                        return;
                    }
                    this.isSpinning = false;
                    this.updateBetSelectorUI?.();
                    this.updateAutoplayUI?.();
                    this.resumeBonusAutomation?.();
                });
            });
            elements.push(background, label);
        });
    }

    showRelicSelectionModal() {
        const { width, height } = this.scale;
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);

        const modalBox = this.add.graphics();
        modalBox.lineStyle(3, 0xffd700, 1);
        modalBox.fillStyle(0x171526, 0.98);
        modalBox.fillRoundedRect(width / 2 - 300, height / 2 - 170, 600, 340, 14);
        modalBox.strokeRoundedRect(width / 2 - 300, height / 2 - 170, 600, 340, 14);
        const title = this.add.text(width / 2, height / 2 - 125, 'CHOOSE ONE RELIC', {
            fontSize: '22px', fontStyle: 'bold', color: '#ffd700'
        }).setOrigin(0.5);
        const relics = [
            { key: 'LIGHTNING', text: 'LIGHTNING RELIC\n+1 charge cap (max 4)', color: '#63d9ff' },
            { key: 'SOUL', text: 'SOUL RELIC\n+2 Drachma value (max 7)', color: '#ff7575' },
            { key: 'PETRIFICATION', text: 'PETRIFICATION RELIC\nPreserves transformed Wilds', color: '#c4c9e8' }
        ];
        const elements = [overlay, modalBox, title];

        relics.forEach((relic, index) => {
            const x = width / 2 - 200 + index * 200;
            const background = this.add.graphics();
            const colorNumber = Phaser.Display.Color.HexStringToColor(relic.color).color;
            background.fillStyle(colorNumber, 0.18);
            background.lineStyle(2, colorNumber, 1);
            background.fillRoundedRect(x - 90, height / 2 - 55, 180, 130, 8);
            background.strokeRoundedRect(x - 90, height / 2 - 55, 180, 130, 8);
            const button = this.add.text(x, height / 2 + 5, relic.text, {
                fontSize: '13px', fontStyle: 'bold', color: relic.color, align: 'center',
                wordWrap: { width: 160 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            button.on('pointerover', () => button.setScale(1.05));
            button.on('pointerout', () => button.setScale(1));

            button.on('pointerdown', () => {
                if (!this.gameLogic.selectRelic(relic.key)) return;
                elements.forEach(element => element.destroy());
                this.updateBonusMeterDisplay();
                this.statusText.setText(`${relic.key} RELIC SELECTED | ${this.gameLogic.bonusSpinsLeft} TURNS`);
                this.updateAresHudDisplay(this.gameLogic.aresChallenge);
                this.updateRelicIndicator();
                this.isSpinning = false;
                this.updateBetSelectorUI?.();
                this.updateGameInfoButton?.();
                this.updateBuyBonusUI?.();
                this.displayedSoulBank = this.gameLogic.soulBank;
                this.soulBankText.setText(`${this.gameLogic.soulBank} CR`);
                this.showBanner(`${relic.key} RELIC ACTIVE`, relic.color, () => {
                    const startBonus = () => this.startBonusAutomation?.();
                    if (this.gameLogic.aresChallenge) {
                        this.showBanner(`ARES CONTRACT: ${this.gameLogic.aresChallenge.title}`, '#ffaa44', startBonus);
                    } else {
                        startBonus();
                    }
                });
            });
            elements.push(background, button);
        });
    }

    showHistoryModal() {
        const { width, height } = this.scale;
        const history = this.gameLogic.getEventHistory().slice(-14);
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        const panel = this.add.graphics();
        panel.lineStyle(3, 0x00d7c0, 1);
        panel.fillStyle(0x111a22, 0.98);
        panel.fillRoundedRect(width / 2 - 330, height / 2 - 280, 660, 560, 12);
        panel.strokeRoundedRect(width / 2 - 330, height / 2 - 280, 660, 560, 12);
        const title = this.add.text(width / 2, height / 2 - 240, 'BONUS EVENT HISTORY', {
            fontSize: '21px', fontStyle: 'bold', color: '#00d7c0'
        }).setOrigin(0.5);
        const eventText = history.length
            ? history.map(event => `${event.sequence}. T${event.turn}${event.sourceTurn !== undefined ? ` (from ${event.sourceMode} T${event.sourceTurn})` : ''} ${event.type}${event.path ? ` | ${event.path}` : ''}${event.action ? ` | ${event.action}` : ''}${event.totalWin !== undefined ? ` | ${event.totalWin} CR` : ''}${event.payout !== undefined ? ` | ${event.payout} CR` : ''}`).join('\n')
            : 'No game events recorded.';
        const body = this.add.text(width / 2 - 285, height / 2 - 205, eventText, {
            fontSize: '12px', color: '#ffffff', lineSpacing: 7,
            wordWrap: { width: 570 }
        }).setOrigin(0, 0);
        const close = this.add.text(width / 2, height / 2 + 245, 'CLOSE', {
            fontSize: '16px', fontStyle: 'bold', color: '#ffd700'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const elements = [overlay, panel, title, body, close];
        close.on('pointerdown', () => elements.forEach(element => element.destroy()));
    }

    traceZeusNetworks(networks) {
        const graphics = this.add.graphics().setDepth(20);
        graphics.lineStyle(4, 0x73e8ff, 0.9);
        for (const network of networks) {
            for (let leftIndex = 0; leftIndex < network.length; leftIndex++) {
                for (let rightIndex = leftIndex + 1; rightIndex < network.length; rightIndex++) {
                    const left = network[leftIndex];
                    const right = network[rightIndex];
                    if (Math.abs(left.row - right.row) + Math.abs(left.column - right.column) !== 1) continue;
                    const from = this.tileGrid[left.row]?.[left.column];
                    const to = this.tileGrid[right.row]?.[right.column];
                    if (!from || !to) continue;
                    graphics.beginPath();
                    graphics.moveTo(from.x, from.y);
                    graphics.lineTo(to.x, to.y);
                    graphics.strokePath();
                }
            }
        }
        if (this.visualFeedback.reducedMotion()) {
            graphics.destroy();
            return;
        }
        this.tweens.add({ targets: graphics, alpha: 0, duration: 260, onComplete: () => graphics.destroy() });
    }

    renderEngineBoard(matrix, cellStates) {
        for (let row = 0; row < matrix.length; row++) {
            for (let column = 0; column < matrix[row].length; column++) {
                const sprite = this.tileGrid[row]?.[column];
                const background = this.tileBgs[row]?.[column];
                if (!sprite || !background) continue;
                const symbol = matrix[row][column];
                if (this.textures.exists(symbol)) {
                    sprite.setTexture(symbol);
                    sprite.setDisplaySize(80, 64);
                    sprite.baseScaleX = sprite.scaleX;
                    sprite.baseScaleY = sprite.scaleY;
                }
                const state = cellStates[row][column];
                background.clear();
                background.fillStyle(state.wild ? 0xffaa00 : state.chargeLevel > 0 ? 0x00aaff : 0x1a1a2e, 0.9);
                background.fillRoundedRect(sprite.x - 48, sprite.y - 36, 96, 72, 8);
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 1280,
    height: 720,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#05050b',
    scene: MainScene
};

new Phaser.Game(config);