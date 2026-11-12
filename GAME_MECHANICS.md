# Gods of the Abyss Mechanics Prototype

These are configurable prototype rules added because the project had no reel strips, paytable, or defined character/bonus resolution rules. They are implementation defaults, not a mathematically tuned or production-approved game design.

## Core Resolution

1. Reject invalid state, stake, or RNG results before consuming a wager or bonus turn.
2. Generate one 5-column grid from the configured reel strips. The current strips contain one equally likely entry for each existing symbol.
3. In a bonus, shift rows containing POSEIDON to the right with wraparound, then apply Rift's marked-column downward wrap shift.
4. Apply existing Medusa curses/petrification, Hades collection, Zeus charge events, and Titan Mega Wild transformation.
5. Evaluate the final grid once using the configured paylines and paytable. A paid-spin stake is split evenly over active paylines. Zeus substitutes for line symbols; it does not substitute for Seals.
6. Apply the configured bonus path multiplier once, then contract rewards and bonus retriggers.
7. Pause for choices. Resolve Typhon and Zeus choices before the next turn or bonus settlement.
8. Settle bonus winnings and eligible Soul Bank value once; reset temporary state and record completion.

The game scene renders returned engine outcomes. Animation randomness is separate from outcome generation.
Each engine history event also records a monotonic sequence, current base/bonus turn, mode, and active path. Typhon choice events additionally retain the turn and mode that triggered the choice, even when Ascendance starts a new bonus.

## Configured Prototype Defaults

- Base board: 5 columns by 4 rows; bonus board: 5 by 5.
- Base paytable and paylines: `src/gameRules.js`. The 4-row grid has 10 lines; the bonus grid has 14 unique lines.
- Uniform per-cell symbol selection is retained because no reel strips were supplied. This is not a reel-strip slot model.
- Zeus is a line wild; 3 visible Seals qualify for Divine Convergence, then a separate 1% random gate determines natural entry. Seals pay no scatter award. The gate is configured in `src/gameRules.js` and does not change symbol probabilities.
- Each survival stage has exactly 10 spins. Completing Awakening or Ascension grants the next 10-spin stage; completing Divine Power grants a 10-spin Typhon finale. Bonus scatter retriggers do not add turns during survival.
- Path multipliers: Olympus 2x, Underworld 1x, Rift 1x. The values reproduce the existing Olympus label and make previously unspecified paths explicit.
- Olympus: CHARGE cells gain one level, capped at 3 (4 with Lightning Relic). At least 3 orthogonally connected charged cells open the three-action checkpoint. Overcharge gains one level without an unlisted award; Chain Lightning connects qualifying components within Manhattan distance 2; Discharge turns the qualifying network into Wilds and evaluates the resulting board once.
- Underworld: each visible Drachma adds 5 CR to a 100-CR bank (7 CR with Soul Relic). The bank releases once at bonus end; Soul Relic also releases its bank on another path.
- Rift: each column containing RIFT rotates downward once with wraparound. All attached cell state moves with it.
- Poseidon: each row containing POSEIDON rotates right once with wraparound. All attached cell state moves with it.
- Medusa: an eligible bonus cell is cursed for one turn, then becomes a Wild. Petrification Relic preserves the converted Wild for two additional turns.
- Survival progression: each eligible, accepted bonus payout adds payout divided by the original round stake to the active stage meter. The configurable thresholds are 8, 24, and 45 stake units. Actual unlocked feature events also add their configured progress. Progress is limited to the active stage; excess does not spill into later stages. A stage succeeds once, awards exactly 10 spins, and unlocks the next character feature. Failing to reach its threshold in 10 spins ends the bonus and preserves earned winnings.
- Character unlocks: the chosen bonus path's character is active in Awakening. The selected relic's distinct character unlocks in Ascension (otherwise Poseidon is next); Divine Power unlocks the remaining Poseidon/Medusa feature. Previously unlocked features remain active. Their existing Zeus charge/network, Hades Soul Bank, Rift shift, Poseidon row shift, and Medusa petrification mechanics remain the gameplay effects.
- Divine Power opens the existing choice between Abyssal Wrath and Titan Ascendance. The 10-spin finale carries all three unlocked features. Titan adds its existing powered turns and Mega Wilds; the configured 56-turn ceiling accommodates the 40 survival/finale spins and both possible powered Titan rewards in a simultaneous base-meter/natural-bonus entry. Extra turns never extend a stage's 10-spin limit and are forfeited if a survival stage fails. Abyssal Wrath and all other payouts share the original-round MAX WIN cap.
- The Bonus Stage Meter is inactive in the base game: base-game payouts cannot add progress or activate a stage. It becomes active at bonus entry and uses only the survival thresholds above.
- The bonus lifecycle tracks `BASE_GAME`, `BONUS_STAGE_1`, `BONUS_STAGE_2`, `BONUS_STAGE_3`, `FINAL_TYPHON_BONUS`, `BONUS_COMPLETE`, and `BONUS_FAILED`. After final bonus winnings and eligible Soul Bank value settle, lifecycle cleanup clears stage progress, stage/spin counters, feature unlocks, Typhon meter state, and pending actions. Every subsequent bonus begins at Stage 1 with 10 spins and no inherited progression.
- Ares: collect ARES on 3 bonus turns within the configured 30-turn contract; reward is 3x stake, paid once. Contract failure does not erase prior rewards.
- The meter is rendered as three independent, responsive CSS progress segments rather than cropping the supplied PNG, whose background is baked into the image. During survival, it displays the active stage's progress, remaining spins, and unlocked features.
- MAX WIN: the entire paid-spin/feature round is capped at 5,000 times the stake at its start. Normal spins start a new payout round; purchased bonuses start one at purchase. Free spins, Zeus payouts, Ares rewards, Typhon rewards, and the Soul Bank release share the same cap.
- Buy Bonus costs 100x stake and starts the same bonus engine as a natural entry; it bypasses the natural scatter gate and does not alter symbol probabilities or payout rules.
- Total bet per spin is selected from the configured 5–500 CR levels in `src/gameRules.js`; paylines divide that total evenly, while line and feature payouts scale from the selected stake.
- Relic effects are finite and may be selected with any path. Their detailed limits are in `src/gameRules.js`.

## Audit Limitations

The paytable and prototype mechanics have not been tuned to an RTP target. The progressive Typhon rewards add bonus turns, Mega Wild turns, and a stronger final Typhon choice; they therefore affect expected returns without changing symbol probabilities, the paytable, or the existing line-payout calculation. The natural bonus gate lowers entry frequency and therefore changes expected RTP; use the seeded engine simulation and its confidence interval rather than claiming a theoretical target. The engine enforces the configured 5,000x original-stake round payout cap.

Poseidon, Medusa, Ares, and relic defaults above are explicit prototype choices where the supplied specification left values undefined. Change them only with a game-design decision and rerun the deterministic suite and simulation.
