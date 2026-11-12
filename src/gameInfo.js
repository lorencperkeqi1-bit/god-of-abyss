const CHARACTER_ASSETS = Object.freeze({
    ZEUS: '/assets/characters/zeus_portrait.png',
    HADES: '/assets/characters/hades_portrait.png',
    MEDUSA: '/assets/characters/medusa_portrait.png',
    POSEIDON: '/assets/characters/poseidon_portrait.png',
    ARES: '/assets/characters/ares_portrait.png',
    TYPHON: '/assets/characters/typhon_portrait.png.jpeg'
});

const SYMBOL_ASSETS = Object.freeze({
    SIGIL: '/assets/symbols/symbol_sigil.png',
    SKULL: '/assets/symbols/symbol_skull.png',
    DRACHMA: '/assets/symbols/symbol_drachma.png',
    SEAL: '/assets/symbols/symbol_seal.png',
    CHARGE: '/assets/symbols/symbol_charge.png',
    RIFT: '/assets/symbols/symbol_rift.png'
});

const SYMBOL_DETAILS = Object.freeze({
    ZEUS: { category: 'Wild / premium', effect: 'Substitutes for line symbols except itself; active Zeus features can charge cells and convert qualifying networks to Wilds.' },
    HADES: { category: 'Premium / special', effect: 'Activates the Soul Bank feature when unlocked for Underworld or with the Soul Relic.' },
    MEDUSA: { category: 'Premium / special', effect: 'In an active Medusa feature, curses its cell; on the next bonus turn that cell becomes a Zeus Wild.' },
    POSEIDON: { category: 'Premium / special', effect: 'In an active Poseidon feature, shifts each row containing Poseidon one cell right with wraparound.' },
    ARES: { category: 'Premium / special', effect: 'During a bonus, one or more visible Ares symbols on a turn add one turn of progress to the Battle Contract.' },
    TYPHON: { category: 'Premium / special', effect: 'Typhon is a paytable symbol. The Typhon finale is reached by completing the third survival stage; landing this symbol does not trigger it.' },
    SIGIL: { category: 'Regular', effect: 'Regular line-pay symbol.' },
    SKULL: { category: 'Regular', effect: 'Regular line-pay symbol.' },
    DRACHMA: { category: 'Regular / special', effect: 'Line-pay symbol; visible Drachma can add credits to an active Hades Soul Bank.' },
    SEAL: { category: 'Scatter / bonus trigger', effect: 'Three or more visible Seals qualify for a separate configured 1% natural-entry roll. Seals have no line or scatter payout.' },
    CHARGE: { category: 'Special / feature', effect: 'Line-pay symbol; in an active Zeus feature, visible Charges add charge to their cells and can form networks.' },
    RIFT: { category: 'Regular / special', effect: 'Line-pay symbol; in an active Rift/Typhon feature, every column containing Rift shifts down with wraparound.' }
});

const CHARACTER_TEXT = Object.freeze({
    ZEUS: {
        title: 'Zeus — Lightning Dominion',
        subtitle: 'Lightning network and Wild conversion',
        description: rules => `When Zeus is unlocked in Olympus or by the Lightning Relic, each visible CHARGE cell gains one level per bonus turn (cap ${rules.zeus.chargeCap}, or ${Math.min(rules.zeus.relicChargeCap, rules.zeus.chargeCap + rules.zeus.relicChargeBonus)} with Lightning Relic). At least ${rules.zeus.networkSize} orthogonally connected charged cells qualify a network. The engine defines Overcharge, Chain Lightning and Discharge, but the current game scene automatically chooses Discharge: qualifying charged cells become Zeus Wilds and that board is evaluated once. Overcharge and Chain Lightning are not selectable in the current scene.`
    },
    HADES: {
        title: 'Hades — Soul Bank',
        subtitle: 'Collect Drachma during bonus turns',
        description: rules => `When Hades is unlocked for Underworld or by the Soul Relic, each visible DRACHMA adds ${rules.hades.soulValue} CR to the bank (${Math.min(rules.hades.relicSoulValueCap, rules.hades.soulValue + rules.hades.relicSoulBonus)} CR with Soul Relic), up to ${rules.hades.soulCap} CR. The bank is released once at bonus end on Underworld or whenever the Soul Relic is active.`
    },
    POSEIDON: {
        title: 'Poseidon — Shifting Battlefield',
        subtitle: 'Rows containing Poseidon rotate',
        description: rules => `When unlocked, every bonus row containing POSEIDON shifts ${rules.poseidon.direction === 'right-wrap' ? 'one cell right' : rules.poseidon.direction} with wraparound before wins are evaluated. If two or more rows shift, the event also adds ${rules.bonusSurvival.featureProgress.POSEIDON_MULTIROW} stage-progress points.`
    },
    MEDUSA: {
        title: 'Medusa — Curse and Petrification',
        subtitle: 'Cursed cells become Wilds',
        description: rules => `When unlocked, each visible MEDUSA cell is cursed for one turn. On the next bonus turn, that cell becomes a ZEUS Wild. With Petrification Relic, the converted Wild is preserved for ${rules.medusa.petrifyAfterTurns + 1} bonus turns after conversion; otherwise it is not preserved beyond the conversion turn.`
    },
    ARES: {
        title: 'Ares — Battle Contract',
        subtitle: 'A bonus-round collection objective',
        description: rules => `Each bonus starts a contract to land ARES on ${rules.ares.target} different bonus turns within ${rules.ares.turns} turns. Completing it awards ${rules.ares.rewardStakeMultiplier}× the selected stake once. Missing the target fails the contract; it does not remove other earned wins.`
    },
    TYPHON: {
        title: 'Typhon — Three-stage progression and finale',
        subtitle: 'Survival progression; not a separate boss-health battle',
        description: rules => `The bonus has three survival stages with progress thresholds ${rules.bonusSurvival.stageThresholds.join(', ')} stake units. Each stage begins with ${rules.bonusSurvival.spinsPerStage} spins. Completing stages one or two awards the next ${rules.bonusSurvival.spinsPerStage}-spin stage; completing stage three enters the Typhon finale. Abyssal Wrath pays (2 × Soul Bank + 500 CR) × (1 + stage power × ${rules.bonusMeter.wrathMultiplierPerStage}); Titan Ascendance instead grants 5 + stage power × ${rules.bonusMeter.titanBonusTurnsPerStage} turns, also as Mega Wild turns, subject to the ${rules.bonusMaxAwardedTurns}-turn award cap. If a stage runs out of spins before reaching its threshold, the bonus ends with its earned winnings. No boss health bar or separate boss-combat system is implemented.`
    }
});

const PATH_TEXT = Object.freeze({
    OLYMPUS: 'Zeus is the primary character feature. Charged networks can be Overcharged, linked with Chain Lightning, or Discharged into Wilds.',
    UNDERWORLD: 'Hades is the primary character feature. Drachma fill the Soul Bank, which is released at the end of the bonus.',
    RIFT: 'Typhon is the primary character feature. Rift columns shift down, and multiple shifted columns add Typhon stage progress.'
});

const RELIC_TEXT = Object.freeze({
    LIGHTNING: {
        name: 'Lightning Relic',
        character: 'ZEUS',
        effect: rules => `Adds Zeus as the relic feature. Raises the Charge cap from ${rules.zeus.chargeCap} to ${Math.min(rules.zeus.relicChargeCap, rules.zeus.chargeCap + rules.zeus.relicChargeBonus)}.`
    },
    SOUL: {
        name: 'Soul Relic',
        character: 'HADES',
        effect: rules => `Adds Hades as the relic feature, increases each collected Drachma from ${rules.hades.soulValue} CR to ${Math.min(rules.hades.relicSoulValueCap, rules.hades.soulValue + rules.hades.relicSoulBonus)} CR, and releases the Soul Bank at bonus end on any path.`
    },
    PETRIFICATION: {
        name: 'Petrification Relic',
        character: 'MEDUSA',
        effect: rules => `Adds Medusa as the relic feature and preserves each petrified Wild for ${rules.medusa.petrifyAfterTurns + 1} bonus turns after conversion.`
    }
});

function formatCredits(value) {
    return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} CR`;
}

function formatMultiplier(value) {
    return `${Number(value).toFixed(2).replace(/\.?0+$/, '')}×`;
}

function getSymbolImage(symbol) {
    return CHARACTER_ASSETS[symbol] ?? SYMBOL_ASSETS[symbol] ?? '';
}

function paytableRows(rules) {
    return rules.symbols.map(symbol => {
        const payouts = rules.paytable[symbol] ?? {};
        const image = getSymbolImage(symbol);
        const detail = SYMBOL_DETAILS[symbol] ?? { category: 'Symbol', effect: 'No special effect is configured.' };
        const payoutCell = count => Object.hasOwn(payouts, count) ? formatMultiplier(payouts[count]) : '—';
        return `<tr>
            <th scope="row"><span class="info-symbol-name"><img src="${image}" alt="" loading="lazy">${symbol}</span></th>
            <td><span class="info-tag">${detail.category}</span></td>
            <td>${payoutCell(3)}</td><td>${payoutCell(4)}</td><td>${payoutCell(5)}</td>
            <td>${detail.effect}</td>
        </tr>`;
    }).join('');
}

function symbolCards(rules) {
    return rules.symbols.map(symbol => {
        const detail = SYMBOL_DETAILS[symbol] ?? { category: 'Symbol', effect: 'No special effect is configured.' };
        const image = getSymbolImage(symbol);
        const payouts = rules.paytable[symbol];
        const payoutText = payouts
            ? Object.entries(payouts).sort(([left], [right]) => Number(left) - Number(right))
                .map(([count, multiplier]) => `${count} × ${formatMultiplier(multiplier)}`)
                .join(' · ')
            : 'No line payout';
        return `<article class="info-symbol-card">
            <img class="info-symbol-image" src="${image}" alt="${symbol}" loading="lazy">
            <div class="info-card-content">
                <div class="info-card-heading"><h4>${symbol}</h4><span class="info-tag">${detail.category}</span></div>
                <p class="info-payout-values">${payoutText}</p>
                <p>${detail.effect}</p>
            </div>
        </article>`;
    }).join('');
}

function characterCard(character, rules) {
    const info = CHARACTER_TEXT[character];
    return `<article class="info-character-card">
        <img src="${CHARACTER_ASSETS[character]}" alt="${character} portrait" loading="lazy">
        <div><h4>${info.title}</h4><p class="info-card-subtitle">${info.subtitle}</p><p>${info.description(rules)}</p></div>
    </article>`;
}

function relicCard(key, rules) {
    const relic = RELIC_TEXT[key];
    return `<article class="info-relic-card">
        <img src="${CHARACTER_ASSETS[relic.character]}" alt="${relic.character} portrait; no separate relic artwork is available" loading="lazy">
        <div><h4>${relic.name}</h4><p>${relic.effect(rules)}</p><span class="info-card-subtitle">Character portrait shown; dedicated relic artwork is not available.</span></div>
    </article>`;
}

function maxWinValue(rules, stake) {
    return formatCredits(stake * rules.maxWinStakeMultiplier);
}

export function renderGameInfoContent(rules, stake) {
    const basePaylines = rules.paylines[rules.baseRows]?.length ?? 0;
    const bonusPaylines = rules.paylines[rules.bonusRows]?.length ?? 0;
    const stakeLevels = rules.betting.stakeLevels;
    const symbols = rules.symbols.map(symbol => `<span class="info-chip">${symbol}</span>`).join('');
    const featureCards = ['ZEUS', 'HADES', 'POSEIDON', 'MEDUSA', 'ARES', 'TYPHON']
        .map(character => characterCard(character, rules)).join('');
    const paths = ['OLYMPUS', 'UNDERWORLD', 'RIFT'].map(path => {
        const feature = rules.bonusSurvival.pathFeatures[path];
        return `<article class="info-path-card">
            <img src="${CHARACTER_ASSETS[feature]}" alt="${feature} portrait" loading="lazy">
            <div><h4>${path}</h4><p class="info-path-multiplier">${formatMultiplier(rules.bonusMultipliers[path])} bonus line multiplier</p>
            <p>${PATH_TEXT[path]}</p></div>
        </article>`;
    }).join('');
    const relics = Object.keys(rules.relics).map(key => relicCard(key, rules)).join('');
    const chargeChoices = ['OVERCHARGE', 'CHAIN_LIGHTNING', 'DISCHARGE'].join(', ');

    return `<div class="info-tab-panel is-active" data-info-panel="play">
        <section class="info-section" id="info-overview">
            <p class="info-kicker">01 · THE GAME</p><h3>Game Overview</h3>
            <p>Build wins across the Gods of the Abyss battlefield. Spin the reels, match symbols from the left on an active payline, and enter Divine Convergence when a qualifying Seal board passes its natural trigger roll.</p>
            <div class="info-stat-grid">
                <div><strong>${rules.columns} × ${rules.baseRows}</strong><span>base grid</span></div>
                <div><strong>${basePaylines}</strong><span>base paylines</span></div>
                <div><strong>${rules.columns} × ${rules.bonusRows}</strong><span>bonus grid</span></div>
                <div><strong>${bonusPaylines}</strong><span>bonus paylines</span></div>
            </div>
            <p>Press <b>SPIN</b> to play one base-game round; spins are unavailable when your balance is below the selected stake. Use <b>TOTAL BET / SPIN</b> to open the bet selector, choose a preset or step to an adjacent level, then confirm. The stake is divided evenly over the active paylines.</p>
            <div class="info-note">The prototype samples every cell uniformly from the configured symbol list. It does not use weighted reel strips.</div>
        </section>
        <section class="info-section" id="info-betting">
            <p class="info-kicker">02 · WAGER</p><h3>Betting Information</h3>
            <p>Minimum bet: <b>${formatCredits(stakeLevels[0])}</b>. Maximum bet: <b>${formatCredits(stakeLevels.at(-1))}</b>.</p>
            <p class="info-chip-row">${stakeLevels.map(level => `<span class="info-chip">${formatCredits(level)}</span>`).join('')}</p>
            <p>Open the bet selector from the total bet display, choose a preset or use − / +, then confirm. Bet changes are locked during a spin and while a bonus or bonus choice is active.</p>
            <p>All line awards and stake-based rewards use the selected stake. Buy Bonus costs <b>${rules.buyBonusStakeMultiplier}× stake</b>; at the current ${formatCredits(stake)} bet, its cost is <b>${formatCredits(stake * rules.buyBonusStakeMultiplier)}</b>.</p>
        </section>
        <section class="info-section" id="info-wins">
            <p class="info-kicker">03 · PAYOUTS</p><h3>Win Calculations</h3>
            <p>For each configured payline, the engine counts consecutive matches from reel one. It awards the highest paying matching symbol for that line; Zeus can substitute for a line symbol except itself. The line stake is total stake ÷ active payline count, and the configured paytable multiplier is applied to that line stake.</p>
            <p>Winning lines are added together. The selected bonus path multiplier is then applied once to bonus line wins. Ares Contract rewards and an eligible Soul Bank release are separate rewards; all are limited by the round payout cap. The WIN display shows the actual current spin/event award; bonus line wins accumulate and are settled to balance when the bonus ends.</p>
        </section>
        <section class="info-section" id="info-max-win">
            <p class="info-kicker">04 · PAYOUT LIMIT</p><h3>Maximum Win</h3>
            <div class="info-max-win-value">${maxWinValue(rules, stake)}</div>
            <p>The configured limit is <b>${rules.maxWinStakeMultiplier.toLocaleString()}× the original stake</b> for the paid-spin/feature round. At the current ${formatCredits(stake)} stake: ${formatCredits(stake)} × ${rules.maxWinStakeMultiplier.toLocaleString()} = <b>${maxWinValue(rules, stake)}</b>.</p>
            <p>A normal paid spin starts a payout round. A purchased bonus starts one at purchase. Free spins, line wins, feature awards, Typhon rewards and eligible Soul Bank release count toward the same round limit.</p>
        </section>
        <section class="info-section" id="info-rtp">
            <p class="info-kicker">05 · MATHS</p><h3>RTP and Game Information</h3>
            <p><b>No certified or configured target RTP is available.</b> The paytable and feature rules are prototype defaults, and observed return depends heavily on the selected bonus path. A seeded simulation is a sample, not a guaranteed player return.</p>
            <p>Natural bonus entry requires at least ${rules.scatterTriggerCount} visible ${rules.scatterSymbol} symbols and then passes a separate ${(rules.naturalBonus.scatterTriggerChance * 100).toFixed(2)}% random gate. This is not a guaranteed interval. No verified volatility classification is configured.</p>
        </section>
    </div>
    <div class="info-tab-panel" data-info-panel="paytable" hidden>
        <section class="info-section">
            <p class="info-kicker">06 · SYMBOL GUIDE</p><h3>Symbols and Paytable</h3>
            <p>Payout values below are the configured paytable multipliers applied to one line's stake. Matching counts are consecutive from the first reel. A dash means the engine has no payout configured for that count.</p>
            <div class="info-table-wrap"><table class="info-paytable">
                <thead><tr><th>Symbol</th><th>Class</th><th>3 match</th><th>4 match</th><th>5 match</th><th>Special effect</th></tr></thead>
                <tbody>${paytableRows(rules)}</tbody>
            </table></div>
            <div class="info-symbol-grid">${symbolCards(rules)}</div>
            <div class="info-note">This list is generated from the engine's symbol list and paytable. SEAL is a scatter only and has no configured paytable award.</div>
        </section>
        <section class="info-section">
            <p class="info-kicker">07 · SPECIAL SYMBOLS</p><h3>Special Symbols</h3>
            <ul class="info-list">
                <li><b>ZEUS / Wild:</b> substitutes for any paytable symbol other than Zeus itself on a line; it never substitutes for Seals.</li>
                <li><b>SEAL / Scatter:</b> three or more visible Seals qualify for a natural bonus gate on base-game spins. The scatter payout is ${formatCredits(rules.scatterPayout)}.</li>
                <li><b>Natural bonus gate:</b> after the Seal threshold, an independent random roll must be below ${(rules.naturalBonus.scatterTriggerChance * 100).toFixed(2)}%. Buy Bonus bypasses this gate; bonus spins do not retrigger it.</li>
                <li><b>CHARGE, DRACHMA, POSEIDON, MEDUSA, ARES and RIFT:</b> their special effects apply only when the corresponding bonus feature is active; their line payouts remain those in the paytable.</li>
            </ul>
        </section>
    </div>
    <div class="info-tab-panel" data-info-panel="bonus" hidden>
        <section class="info-section">
            <p class="info-kicker">08 · DIVINE CONVERGENCE</p><h3>Bonus Features</h3>
            <p>Natural entry comes from qualifying Seals plus the configured random gate. Buy Bonus is a separate paid entry. After entry, select one path and one relic. The bonus begins with ${rules.bonusSurvival.spinsPerStage} turns on a ${rules.columns} × ${rules.bonusRows} grid.</p>
            <div class="info-character-grid">${featureCards}</div>
            <p>Progress in each survival stage comes from eligible bonus payouts divided by the original round stake, plus configured feature events. Thresholds are ${rules.bonusSurvival.stageThresholds.join(', ')} stake units. Reaching a threshold adds ${rules.bonusSurvival.spinsPerStage} turns and advances the stage. Failing to reach the active threshold before its spins run out ends the feature. Completing stage three enters the Typhon finale and its available choice.</p>
            <p>At bonus end, feature wins are added to balance once. An eligible Soul Bank is released once. The bonus then resets its temporary features and progression.</p>
        </section>
        <section class="info-section"><p class="info-kicker">09 · PATHS</p><h3>Divine Convergence Paths</h3>
            <div class="info-path-grid">${paths}</div>
            <p>Path multipliers affect bonus line wins only. Path choice does not change symbol probabilities or the natural trigger gate.</p>
        </section>
        <section class="info-section"><p class="info-kicker">10 · RELICS</p><h3>Relics</h3>
            <p>Choose one relic after entering any bonus path. Its effect lasts for that bonus only. Character features unlock through survival-stage progression; the selected relic's distinct character feature is added to the roster.</p>
            <div class="info-relic-grid">${relics}</div>
        </section>
        <section class="info-section"><p class="info-kicker">11 · OPTIONAL ENTRY</p><h3>Bonus Buy</h3>
            <p>Buy Bonus charges <b>current stake × ${rules.buyBonusStakeMultiplier}</b>, asks you to choose Olympus, Underworld or Rift, and starts the same bonus engine with relic selection and survival progression. It does not guarantee a profit and does not use the natural Seal gate.</p>
            <p>Confirm the purchase in the path-selection dialog. If your balance is below the current price, the engine rejects the purchase and no bonus starts. Bet changes are unavailable during an active bonus.</p>
        </section>
    </div>
    <div class="info-tab-panel" data-info-panel="rules" hidden>
        <section class="info-section"><p class="info-kicker">12 · PLAY</p><h3>Game Rules</h3>
            <ol class="info-list info-ordered">
                <li>One spin samples a symbol for each cell on the ${rules.columns} × ${rules.baseRows} base grid and evaluates the configured ${basePaylines} paylines.</li>
                <li>The selected stake is deducted once when a paid spin resolves. Any base-game payout is credited to the balance.</li>
                <li>Each payline pays its best configured left-to-right match. A winning event may combine multiple line awards.</li>
                <li>At ${rules.scatterTriggerCount}+ Seals, the engine rolls the configured natural bonus gate. A successful trigger pauses for path and relic selections; it does not deduct another stake.</li>
                <li>Buy Bonus deducts ${rules.buyBonusStakeMultiplier}× stake before starting the feature, if the balance can cover it.</li>
                <li>Bonus spin line/feature wins accrue for that feature and are credited at settlement. Eligible Soul Bank release is added once at the end.</li>
                <li>All round payouts are capped at the original stake × ${rules.maxWinStakeMultiplier.toLocaleString()}. The info panel shows the current-stake cap.</li>
            </ol>
        </section>
    </div>`;
}
