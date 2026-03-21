"""
Hamurabi Game Balance Optimizer
===============================
Ports the core simulation from game.js to Python, then uses Differential
Evolution (scipy) to search for parameter values that produce well-balanced
games across all AI personalities.

Fitness criteria (what "balanced" means):
  - Population should survive — median final pop  ≥ 40% of starting pop
  - Some challenge is needed  — at least 10% of runs should see moderate stress
  - No personality should be an auto-wipe (min median final pop ≥ 20% start)
  - Grain economy should be sustainable — median grain shouldn't collapse to 0
  - Spread across personalities should be moderate (no one strategy dominates)

Usage:
    python optimize.py              # Run optimization (takes a few minutes)
    python optimize.py --eval       # Evaluate current game.js parameters
    python optimize.py --apply      # Apply best params to game.js
"""

import random, math, sys, json, re, copy, argparse
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

import numpy as np
try:
    from scipy.optimize import differential_evolution
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# ═══════════════════════════════════════════════════════════════
#  Simulation port  (mirrors game.js exactly)
# ═══════════════════════════════════════════════════════════════

WEATHERS = ['normal'] * 4 + ['drought'] * 2 + ['flood', 'bountiful', 'bountiful', 'normal']
BUILDING_KEYS = ['granary', 'walls', 'temple', 'irrigation']

@dataclass
class Params:
    """Tunable game parameters — the search space."""
    start_pop: int = 5000
    start_acres: int = 30000
    feed_per_person: float = 11.0
    plant_per_person: int = 10
    seed_rate: int = 2
    harvest_min: int = 6
    harvest_max: int = 9
    plague_chance: float = 0.077
    attack_chance: float = 0.128
    imm_base: float = 0.012
    imm_range: float = 0.022
    rot_threshold: int = 78000
    rot_rate_min: float = 0.03
    rot_rate_range: float = 0.10
    event_chance: float = 0.23
    revolt_loyalty_thresh: int = 20
    revolt_chance: float = 0.20
    flood_damage_chance: float = 0.35
    granary_base: int = 3000
    granary_scale: int = 1500
    walls_base: int = 5000
    walls_scale: int = 2500
    temple_base: int = 4000
    temple_scale: int = 2000
    irrigation_base: int = 6000
    irrigation_scale: int = 3000
    land_price_min: int = 11
    land_price_max: int = 14
    # AI personality feed ratios
    feed_expansionist: float = 1.04
    feed_benevolent: float = 0.99
    feed_balanced: float = 0.99
    feed_agrarian: float = 0.97
    feed_hoarder: float = 0.98
    feed_reckless: float = 1.00
    feed_philosopher: float = 0.94
    # Starting grain
    start_grain_val: int = 270000

@dataclass
class Personality:
    name: str
    feed_ratio: float
    land_bias: float
    plant_ratio: float
    build_priority: list = field(default_factory=list)

def make_personalities(p: 'Params') -> list:
    return [
        Personality("Expansionist", p.feed_expansionist, 0.8,  0.8,  ['walls','irrigation','granary','temple']),
        Personality("Benevolent",   p.feed_benevolent,   0.3,  0.6,  ['temple','granary','irrigation','walls']),
        Personality("Balanced",     p.feed_balanced,     0.5,  0.7,  ['granary','temple','walls','irrigation']),
        Personality("Agrarian",     p.feed_agrarian,     0.2,  0.95, ['irrigation','granary','temple','walls']),
        Personality("Hoarder",      p.feed_hoarder,      0.4,  0.5,  ['granary','walls','temple','irrigation']),
        Personality("Reckless",     p.feed_reckless,     0.7,  0.9,  ['walls','irrigation','temple','granary']),
        Personality("Philosopher",  p.feed_philosopher,  0.35, 0.65, ['temple','irrigation','granary','walls']),
    ]


def build_cost(key: str, count: int, p: Params) -> int:
    costs = {
        'granary':    (p.granary_base, p.granary_scale),
        'walls':      (p.walls_base, p.walls_scale),
        'temple':     (p.temple_base, p.temple_scale),
        'irrigation': (p.irrigation_base, p.irrigation_scale),
    }
    base, scale = costs[key]
    return base + count * scale


def simulate_game(params: Params, personality: Personality, years: int = 20,
                  rng: Optional[random.Random] = None) -> dict:
    """Run one full game, return summary statistics."""
    if rng is None:
        rng = random.Random()

    ri = lambda a, b: rng.randint(a, b)
    rf = rng.random

    pop = params.start_pop
    grain = params.start_grain_val
    acres = params.start_acres
    land_price = ri(params.land_price_min, params.land_price_max)
    loyalty = 50
    buildings = {k: 0 for k in BUILDING_KEYS}
    total_starved = 0
    avg_starved_pct = 0.0
    pop_history = [pop]
    grain_history = [grain]
    min_pop = pop
    plagues = 0
    attacks_lost = 0
    starvation_years = 0

    for year in range(1, years + 1):
        weather = rng.choice(WEATHERS)
        p = personality

        # ── AI decisions ──
        jitter = lambda: 0.92 + rf() * 0.16
        gr = grain
        ac = acres

        sold = 0
        if rf() > 0.6 and ac > pop * 5:
            sold = int((ac - pop * 5) * (0.1 + rf() * 0.3))
            sold = min(sold, ac - 1)
            gr += sold * land_price

        feed = int(pop * params.feed_per_person * p.feed_ratio * jitter())
        feed = max(0, min(feed, gr))
        gr -= feed

        bought = 0
        if rf() < p.land_bias and gr > land_price * 50:
            bought = max(0, int((gr / land_price) * (0.1 + rf() * 0.25)))
            gr -= bought * land_price

        cur_ac = ac + bought - sold
        max_seed = int(gr * params.seed_rate)
        max_p = min(max_seed, pop * params.plant_per_person, cur_ac)
        planted = max(0, min(int(max_p * p.plant_ratio * jitter()), max_p))
        gr -= planted // params.seed_rate

        build_choice = None
        for bk in p.build_priority:
            cost = build_cost(bk, buildings[bk], params)
            if gr >= cost and rf() < 0.45:
                build_choice = bk
                break

        # ── Simulate year ──
        acres += bought - sold
        grain -= bought * land_price
        grain += sold * land_price
        grain -= feed
        grain -= planted // params.seed_rate

        built_this = None
        if build_choice:
            cost = build_cost(build_choice, buildings[build_choice], params)
            if grain >= cost:
                grain -= cost
                buildings[build_choice] += 1
                built_this = build_choice

        hy = ri(params.harvest_min, params.harvest_max)
        if weather == 'drought':
            hy = max(1, hy - 2)
        elif weather == 'bountiful':
            hy += 1
        elif weather == 'flood':
            hy += 1
        hy += min(4, buildings['irrigation'] // 2)

        th = planted * hy
        grain = max(0, grain)

        rats = 0
        rat_roll = ri(1, 5)
        if rat_roll % 2 == 0:
            rats = grain // rat_roll
            rat_reduce = min(0.85, buildings['granary'] * 0.10)
            rats = int(rats * (1 - rat_reduce))
        grain = grain - rats + th

        # Immigration
        base_imm = int(pop * (params.imm_base + rf() * params.imm_range))
        if loyalty >= 75:
            base_imm = int(base_imm * 1.5)
        elif loyalty < 25:
            base_imm = max(1, int(base_imm * 0.3))
        imm = max(1, base_imm)

        # Starvation
        fed_count = int(feed / params.feed_per_person)
        died = 0
        impeached = False
        if pop > fed_count:
            died = pop - fed_count
            if died > 0.45 * pop:
                impeached = True
            total_starved += died
            avg_starved_pct = ((year - 1) * avg_starved_pct + died * 100 / max(1, pop)) / year
            pop = fed_count
            starvation_years += 1
        pop += imm

        # Plague
        plague = False
        if rf() < params.plague_chance:
            temple_block = min(0.85, buildings['temple'] * 0.10)
            if rf() >= temple_block:
                pop = pop // 2
                plague = True
                plagues += 1

        land_price = ri(params.land_price_min, params.land_price_max)

        # Grain rot
        if grain > params.rot_threshold:
            rot_rate = params.rot_rate_min + rf() * params.rot_rate_range
            rot_reduce = min(0.80, buildings['granary'] * 0.10)
            rot_rate *= (1 - rot_reduce)
            grain -= int((grain - params.rot_threshold) * rot_rate)

        # Loyalty
        loy_delta = 0
        if died == 0 and pop > 0:
            f_rat = feed / max(1, pop * params.feed_per_person)
            if f_rat >= 1.2:
                loy_delta += 8
            elif f_rat >= 0.9:
                loy_delta += 3
            else:
                loy_delta -= 2
        if died > 0:
            loy_delta -= min(20, int(died / max(1, died + pop) * 30))
        loy_delta += min(8, buildings['temple'] * 2)
        if plague:
            loy_delta -= 10
        if built_this:
            loy_delta += 4
        loyalty = max(0, min(100, loyalty + loy_delta))

        # Military threat
        if not plague and rf() < params.attack_chance:
            t_str = ri(50, 200 + year * 8)
            defense = buildings['walls'] * 30 + pop * 0.01
            if defense >= t_str:
                loyalty = min(100, loyalty + 5)
            else:
                t_pop = max(1, int(pop * (0.03 + rf() * 0.07)))
                t_gr = int(grain * (0.05 + rf() * 0.10))
                t_ac = min(ri(100, 500), max(0, acres - 1))
                pop = max(1, pop - t_pop)
                grain = max(0, grain - t_gr)
                acres = max(1, acres - t_ac)
                loyalty = max(0, loyalty - 8)
                attacks_lost += 1

        # Flood damage
        if weather == 'flood' and rf() < params.flood_damage_chance:
            lost = min(ri(200, 1200), max(0, acres - 1))
            acres -= lost

        # Revolt
        if loyalty < params.revolt_loyalty_thresh and rf() < params.revolt_chance and not plague:
            r_loss = max(1, int(pop * 0.1))
            pop = max(1, pop - r_loss)
            loyalty = min(100, loyalty + 15)

        # Random events (simplified: net effect)
        if not plague and rf() < params.event_chance:
            ev = ri(1, 8)
            if ev == 1:  # bandits
                b_loss = int(grain * (0.03 + rf() * 0.07) * max(0.05, 1 - buildings['walls'] * 0.08))
                grain = max(0, grain - b_loss)
            elif ev == 2:  # caravan
                grain += ri(2000, 8000)
            elif ev == 3:  # flood boundary
                acres -= min(ri(300, 1500), max(0, acres - 1))
            elif ev == 4:  # festival
                pop += ri(50, 300)
            elif ev == 5:  # locusts
                grain = max(0, grain - int(th * (0.1 + rf() * 0.2)))
            elif ev == 6:  # treasure
                grain += ri(5000, 15000)
            elif ev == 7:  # marriage
                pop += ri(100, 500)
            elif ev == 8:  # earthquake
                active = [k for k in BUILDING_KEYS if buildings[k] > 0]
                if active:
                    buildings[rng.choice(active)] -= 1
                else:
                    acres -= min(ri(100, 500), max(0, acres - 1))

        pop = max(1, pop)
        grain = max(0, grain)
        acres = max(1, acres)
        pop_history.append(pop)
        grain_history.append(grain)
        min_pop = min(min_pop, pop)

        if impeached:
            break

    return {
        'final_pop': pop,
        'final_grain': grain,
        'final_acres': acres,
        'min_pop': min_pop,
        'total_starved': total_starved,
        'avg_starved_pct': avg_starved_pct,
        'loyalty': loyalty,
        'plagues': plagues,
        'attacks_lost': attacks_lost,
        'starvation_years': starvation_years,
        'years_played': len(pop_history) - 1,
        'pop_history': pop_history,
        'grain_history': grain_history,
        'buildings': dict(buildings),
        'impeached': len(pop_history) - 1 < years,
    }


# ═══════════════════════════════════════════════════════════════
#  Fitness function
# ═══════════════════════════════════════════════════════════════

def evaluate_params(params: Params, n_runs: int = 80, years: int = 20,
                    seed: int = 42, verbose: bool = False) -> dict:
    """
    Run n_runs simulations per AI personality, gather statistics,
    and compute a single scalar fitness (lower = better).
    """
    rng = random.Random(seed)
    personalities = make_personalities(params)
    per_personality = {}

    for pers in personalities:
        results = []
        for _ in range(n_runs):
            r = simulate_game(params, pers, years=years,
                              rng=random.Random(rng.randint(0, 2**31)))
            results.append(r)
        per_personality[pers.name] = results

    # ── Aggregate metrics ──
    start = params.start_pop
    all_final_pops = []
    all_survival_ratios = []
    personality_medians = {}
    personality_impeach_rates = {}
    personality_starve_years = {}

    for name, runs in per_personality.items():
        finals = [r['final_pop'] for r in runs]
        survival = [r['final_pop'] / start for r in runs]
        impeach_rate = sum(1 for r in runs if r['impeached']) / len(runs)
        starve_yrs = [r['starvation_years'] / max(1, r['years_played']) for r in runs]
        med = float(np.median(finals))

        personality_medians[name] = med
        personality_impeach_rates[name] = impeach_rate
        personality_starve_years[name] = float(np.median(starve_yrs))
        all_final_pops.extend(finals)
        all_survival_ratios.extend(survival)

    global_median_ratio = float(np.median(all_survival_ratios))
    global_p10_ratio = float(np.percentile(all_survival_ratios, 10))
    global_p90_ratio = float(np.percentile(all_survival_ratios, 90))
    worst_personality_ratio = min(personality_medians.values()) / start
    best_personality_ratio = max(personality_medians.values()) / start
    spread = best_personality_ratio - worst_personality_ratio
    max_impeach = max(personality_impeach_rates.values())
    overall_impeach = sum(1 for r in all_final_pops if r <= 1) / len(all_final_pops)
    avg_starve_frac = float(np.mean(list(personality_starve_years.values())))

    # ── Fitness components (penalties — lower is better) ──
    penalty = 0.0

    # 1. Median survival should be 40-80% of starting pop
    if global_median_ratio < 0.40:
        penalty += (0.40 - global_median_ratio) * 200  # heavy penalty for die-off
    elif global_median_ratio > 1.5:
        penalty += (global_median_ratio - 1.5) * 30    # mild: too easy

    # 2. 10th percentile (worst runs) should still have ≥ 15% survival
    if global_p10_ratio < 0.15:
        penalty += (0.15 - global_p10_ratio) * 150

    # 3. No personality should be a death sentence (worst median ≥ 25% of start)
    if worst_personality_ratio < 0.25:
        penalty += (0.25 - worst_personality_ratio) * 180

    # 4. Impeachment rate should be low (< 10%)
    if max_impeach > 0.10:
        penalty += (max_impeach - 0.10) * 100

    # 5. Personality spread: not too wide (all strategies roughly viable)
    if spread > 0.6:
        penalty += (spread - 0.6) * 50

    # 6. Some challenge: at least 15% of runs should have ≥1 starvation year
    if avg_starve_frac < 0.10:
        penalty += (0.10 - avg_starve_frac) * 40  # too easy

    # 7. 90th percentile shouldn't be absurdly high (runaway growth)
    if global_p90_ratio > 3.0:
        penalty += (global_p90_ratio - 3.0) * 20

    stats = {
        'fitness': penalty,
        'global_median_ratio': global_median_ratio,
        'global_p10_ratio': global_p10_ratio,
        'global_p90_ratio': global_p90_ratio,
        'worst_personality_ratio': worst_personality_ratio,
        'best_personality_ratio': best_personality_ratio,
        'spread': spread,
        'max_impeach_rate': max_impeach,
        'overall_impeach_rate': overall_impeach,
        'avg_starve_frac': avg_starve_frac,
        'per_personality': {
            name: {
                'median_pop': personality_medians[name],
                'median_survival': personality_medians[name] / start,
                'impeach_rate': personality_impeach_rates[name],
                'starve_year_frac': personality_starve_years[name],
            }
            for name in personality_medians
        },
    }

    if verbose:
        print_stats(stats, params)

    return stats


def print_stats(stats: dict, params: Params):
    print("\n" + "=" * 68)
    print("  BALANCE REPORT")
    print("=" * 68)
    print(f"  Fitness (lower=better):   {stats['fitness']:.2f}")
    print(f"  Median survival ratio:    {stats['global_median_ratio']:.2%}")
    print(f"  10th pct survival:        {stats['global_p10_ratio']:.2%}")
    print(f"  90th pct survival:        {stats['global_p90_ratio']:.2%}")
    print(f"  Worst personality median:  {stats['worst_personality_ratio']:.2%}")
    print(f"  Best personality median:   {stats['best_personality_ratio']:.2%}")
    print(f"  Personality spread:        {stats['spread']:.2%}")
    print(f"  Max impeach rate:          {stats['max_impeach_rate']:.1%}")
    print(f"  Avg starvation fraction:   {stats['avg_starve_frac']:.1%}")
    print()
    print(f"  {'Personality':<16} {'Med.Pop':>8} {'Surv%':>7} {'Impeach':>8} {'StarveYr':>9}")
    print(f"  {'-'*16} {'-'*8} {'-'*7} {'-'*8} {'-'*9}")
    for name, d in stats['per_personality'].items():
        print(f"  {name:<16} {d['median_pop']:>8.0f} {d['median_survival']:>6.1%} "
              f"{d['impeach_rate']:>7.1%} {d['starve_year_frac']:>8.1%}")
    print()
    print("  Key parameters:")
    print(f"    feed_per_person  = {params.feed_per_person}")
    print(f"    harvest          = {params.harvest_min}-{params.harvest_max}")
    print(f"    plague_chance    = {params.plague_chance:.3f}")
    print(f"    attack_chance    = {params.attack_chance:.3f}")
    print(f"    immigration      = {params.imm_base:.3f} + rand*{params.imm_range:.3f}")
    print(f"    rot_threshold    = {params.rot_threshold}")
    print(f"    event_chance     = {params.event_chance:.2f}")
    print(f"    land_price       = {params.land_price_min}-{params.land_price_max}")
    print(f"    start_grain      = {params.start_grain_val}")
    print(f"    Feed ratios: Exp={params.feed_expansionist:.2f} Ben={params.feed_benevolent:.2f} "
          f"Bal={params.feed_balanced:.2f} Agr={params.feed_agrarian:.2f} "
          f"Hoa={params.feed_hoarder:.2f} Rec={params.feed_reckless:.2f} Phi={params.feed_philosopher:.2f}")
    print("=" * 68)


# ═══════════════════════════════════════════════════════════════
#  Optimization via Differential Evolution
# ═══════════════════════════════════════════════════════════════

# Define search bounds: (name, min, max, is_int)
SEARCH_SPACE = [
    ('feed_per_person',     10,   25,   False),
    ('harvest_min',          2,    6,   True),
    ('harvest_max',          6,   12,   True),
    ('plague_chance',     0.01, 0.12,   False),
    ('attack_chance',     0.03, 0.18,   False),
    ('imm_base',          0.005, 0.05,  False),
    ('imm_range',         0.005, 0.05,  False),
    ('rot_threshold',    50000, 200000, True),
    ('rot_rate_min',      0.01, 0.08,   False),
    ('rot_rate_range',    0.01, 0.12,   False),
    ('event_chance',      0.10, 0.35,   False),
    ('land_price_min',       5,   15,   True),
    ('land_price_max',      12,   25,   True),
    # AI feed ratios
    ('feed_expansionist',  0.80, 1.15,  False),
    ('feed_benevolent',    0.90, 1.20,  False),
    ('feed_balanced',      0.85, 1.10,  False),
    ('feed_agrarian',      0.80, 1.10,  False),
    ('feed_hoarder',       0.70, 1.05,  False),
    ('feed_reckless',      0.65, 1.05,  False),
    ('feed_philosopher',   0.85, 1.10,  False),
    # Starting grain
    ('start_grain_val',  100000, 300000, True),
]

def vec_to_params(vec) -> Params:
    """Convert optimizer vector to Params, keeping other values at defaults."""
    p = Params()
    for i, (name, lo, hi, is_int) in enumerate(SEARCH_SPACE):
        val = vec[i]
        if is_int:
            val = int(round(val))
        setattr(p, name, val)
    # Ensure harvest_min <= harvest_max
    if p.harvest_min > p.harvest_max:
        p.harvest_min, p.harvest_max = p.harvest_max, p.harvest_min
    # Ensure land_price_min <= land_price_max
    if p.land_price_min > p.land_price_max:
        p.land_price_min, p.land_price_max = p.land_price_max, p.land_price_min
    return p

def params_to_vec(p: Params) -> list:
    """Extract search-space values from a Params object."""
    return [getattr(p, name) for name, *_ in SEARCH_SPACE]

def objective(vec):
    """Objective function for the optimizer (minimize)."""
    p = vec_to_params(vec)
    stats = evaluate_params(p, n_runs=50, years=20, seed=42)
    return stats['fitness']

def callback_progress(xk, convergence):
    """Progress callback for differential_evolution."""
    p = vec_to_params(xk)
    stats = evaluate_params(p, n_runs=50, years=20, seed=42)
    print(f"  [DE] fitness={stats['fitness']:.3f}  "
          f"med_surv={stats['global_median_ratio']:.1%}  "
          f"worst={stats['worst_personality_ratio']:.1%}  "
          f"feed={p.feed_per_person:.1f}  "
          f"plague={p.plague_chance:.3f}")


def run_optimization(max_iter: int = 40, pop_size: int = 20):
    if not HAS_SCIPY:
        print("ERROR: scipy is required.  pip install scipy")
        sys.exit(1)

    bounds = [(lo, hi) for _, lo, hi, _ in SEARCH_SPACE]
    print(f"Starting Differential Evolution ({len(SEARCH_SPACE)} params, "
          f"popsize={pop_size}, maxiter={max_iter})")
    print(f"Each iteration evaluates {pop_size * len(SEARCH_SPACE)} candidates × "
          f"50 runs × 7 personalities = "
          f"{pop_size * len(SEARCH_SPACE) * 50 * 7:,} simulations")
    print()

    result = differential_evolution(
        objective,
        bounds,
        maxiter=max_iter,
        popsize=pop_size,
        seed=123,
        tol=0.001,
        mutation=(0.5, 1.5),
        recombination=0.8,
        callback=callback_progress,
        disp=True,
    )

    best_params = vec_to_params(result.x)
    print("\n\nOptimization complete!")
    print(f"Best fitness: {result.fun:.4f}")

    # Re-evaluate with more runs for final report
    evaluate_params(best_params, n_runs=200, years=20, seed=99, verbose=True)
    return best_params


# ═══════════════════════════════════════════════════════════════
#  Apply optimized parameters back to game.js
# ═══════════════════════════════════════════════════════════════

def apply_to_gamejs(params: Params, js_path: Path):
    """Write optimized parameter values into game.js."""
    text = js_path.read_text(encoding='utf-8')

    replacements = {
        r"const FEED_PER_PERSON = [\d.]+;":
            f"const FEED_PER_PERSON = {params.feed_per_person};",
        r"const START_GRAIN = \d+;":
            f"const START_GRAIN = {params.start_grain_val};",
        r"var hy = randInt\(\d+, \d+\);":
            f"var hy = randInt({params.harvest_min}, {params.harvest_max});",
        r"Math\.random\(\) < ([\d.]+)\) \{\s*\n\s*var templeBlock":
            f"Math.random() < {params.plague_chance}) {{\n    var templeBlock",
        r"!plague && Math\.random\(\) < ([\d.]+)\) \{":
            f"!plague && Math.random() < {params.attack_chance}) {{",
        r"st\.population \* \(([\d.]+) \+ Math\.random\(\) \* ([\d.]+)\)":
            f"st.population * ({params.imm_base} + Math.random() * {params.imm_range})",
        r"if \(st\.grain > (\d+)\) \{\s*\n\s*var rotRate = ([\d.]+) \+ Math\.random\(\) \* ([\d.]+);":
            f"if (st.grain > {params.rot_threshold}) {{\n    var rotRate = {params.rot_rate_min} + Math.random() * {params.rot_rate_range};",
        r"\(st\.grain - \d+\) \* rotRate":
            f"(st.grain - {params.rot_threshold}) * rotRate",
        r"!plague && !threat && Math\.random\(\) < ([\d.]+)\) \{":
            f"!plague && !threat && Math.random() < {params.event_chance}) {{",
        r"st\.landPrice = randInt\(\d+, \d+\);":
            f"st.landPrice = randInt({params.land_price_min}, {params.land_price_max});",
    }

    changed = 0
    for pattern, repl in replacements.items():
        new_text, n = re.subn(pattern, repl, text)
        if n > 0:
            text = new_text
            changed += n

    # Patch personality feed ratios
    feed_map = {
        'Expansionist': params.feed_expansionist,
        'Benevolent':   params.feed_benevolent,
        'Balanced':     params.feed_balanced,
        'Agrarian':     params.feed_agrarian,
        'Hoarder':      params.feed_hoarder,
        'Reckless':     params.feed_reckless,
        'Philosopher':  params.feed_philosopher,
    }
    for pname, fval in feed_map.items():
        pattern = rf'(name:"{pname}",\s*feedRatio:)[\d.]+'
        repl = rf'\g<1>{fval:.3f}'
        new_text, n = re.subn(pattern, repl, text)
        if n > 0:
            text = new_text
            changed += n

    if changed > 0:
        js_path.write_text(text, encoding='utf-8')
        print(f"Applied {changed} parameter updates to {js_path}")
    else:
        print("WARNING: No replacements matched — game.js structure may have changed.")
    return changed


# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Hamurabi balance optimizer")
    parser.add_argument('--eval', action='store_true',
                        help='Evaluate current parameters (no optimization)')
    parser.add_argument('--apply', action='store_true',
                        help='Apply last optimization result to game.js')
    parser.add_argument('--maxiter', type=int, default=40,
                        help='Max DE iterations (default: 40)')
    parser.add_argument('--popsize', type=int, default=20,
                        help='DE population size multiplier (default: 20)')
    parser.add_argument('--runs', type=int, default=200,
                        help='Simulations per personality for eval (default: 200)')
    args = parser.parse_args()

    js_path = Path(__file__).parent / 'game.js'
    results_path = Path(__file__).parent / 'optimized_params.json'

    if args.eval:
        print("Evaluating current game parameters...")
        p = Params()
        evaluate_params(p, n_runs=args.runs, years=20, seed=99, verbose=True)
        return

    if args.apply:
        if not results_path.exists():
            print(f"No {results_path.name} found — run optimization first.")
            sys.exit(1)
        data = json.loads(results_path.read_text())
        p = Params(**data)
        apply_to_gamejs(p, js_path)
        return

    # Run optimization
    best = run_optimization(max_iter=args.maxiter, pop_size=args.popsize)
    # Save result
    save_data = {name: getattr(best, name) for name, *_ in SEARCH_SPACE}
    results_path.write_text(json.dumps(save_data, indent=2))
    print(f"\nSaved optimized parameters to {results_path}")
    print(f"Run `python optimize.py --apply` to write them into game.js")


if __name__ == '__main__':
    main()
