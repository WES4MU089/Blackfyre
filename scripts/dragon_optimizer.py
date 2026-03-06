"""
Dragon Build Optimizer
Goes back to basics: all stats capped at 10, original combat formulas.
Sweeps all valid builds for the top 4 dragons and finds configurations
where the power ranking matches lore: Vhagar > Caraxes > Vermithor > Cannibal.

HP = R * 100, Strike = M + F, Evasion = C + A, 5 dmg/hit, 10 dmg/hit death throes
"""
import random
from itertools import combinations
import time

# === COMBAT ENGINE (original, unchanged) ===

def create_dragon(name, might, agility, ferocity, resilience, cunning):
    hp = resilience * 100
    return {
        'name': name, 'might': might, 'agility': agility,
        'ferocity': ferocity, 'resilience': resilience, 'cunning': cunning,
        'hp': hp, 'max_hp': hp,
        'strike': might + ferocity, 'evasion': cunning + agility,
    }

def get_wound_penalty(dragon):
    pct = dragon['hp'] / dragon['max_hp']
    if pct > 0.75: return 0
    elif pct > 0.50: return 2
    elif pct > 0.25: return 4
    else: return 6

def would_flee(dragon):
    pct = dragon['hp'] / dragon['max_hp']
    if pct > 0.50: return False
    if pct > 0.25: return dragon['ferocity'] < 5
    else: return dragon['ferocity'] < 8

def roll_dice(num_dice):
    if num_dice <= 0: return 0
    return sum(1 for _ in range(num_dice) if random.randint(1, 6) >= 4)

def attack_silent(attacker, defender, is_death_throes=False):
    penalty_a = get_wound_penalty(attacker)
    penalty_d = get_wound_penalty(defender)
    strike_dice = max(0, attacker['strike'] - penalty_a)
    if is_death_throes:
        evasion_dice = max(0, (defender['evasion'] - penalty_d) // 2)
    else:
        evasion_dice = max(0, defender['evasion'] - penalty_d)
    hits = roll_dice(strike_dice)
    blocks = roll_dice(evasion_dice)
    net_hits = max(0, hits - blocks)
    dmg_per_hit = 10 if is_death_throes else 5
    damage = net_hits * dmg_per_hit
    defender['hp'] = max(0, defender['hp'] - damage)

def death_throes_silent(dying, target):
    if dying['ferocity'] < 8: return
    dying['hp'] = 1
    attack_silent(dying, target, is_death_throes=True)
    dying['hp'] = 0

def simulate_fast(dragon_a, dragon_b):
    a = dict(dragon_a); a['hp'] = a['max_hp']
    b = dict(dragon_b); b['hp'] = b['max_hp']

    if a['agility'] > b['agility']: first, second = a, b
    elif b['agility'] > a['agility']: first, second = b, a
    elif a['ferocity'] >= b['ferocity']: first, second = a, b
    else: first, second = b, a

    tick = 0
    while a['hp'] > 0 and b['hp'] > 0:
        tick += 1
        if tick > 200: break

        if would_flee(first):
            fs = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            cs = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            if fs > cs: return a['name'], b['name'], first['name'], tick

        if would_flee(second):
            fs = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            cs = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            if fs > cs: return a['name'], b['name'], second['name'], tick

        attack_silent(first, second)
        if second['hp'] <= 0:
            death_throes_silent(second, first)
            if first['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            return first['name'], second['name'], None, tick

        attack_silent(second, first)
        if first['hp'] <= 0:
            death_throes_silent(first, second)
            if second['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            return second['name'], first['name'], None, tick

    return 'DRAW', 'DRAW', None, tick

# === BUILD GENERATION ===

def generate_builds(budget, min_stats=None, max_stats=None):
    """Generate all valid 5-stat builds (M,A,F,R,C) that sum to budget.
    Each stat is 1-10. min_stats/max_stats are dicts to constrain ranges."""
    mins = {'m': 1, 'a': 1, 'f': 1, 'r': 1, 'c': 1}
    maxs = {'m': 10, 'a': 10, 'f': 10, 'r': 10, 'c': 10}
    if min_stats:
        mins.update(min_stats)
    if max_stats:
        maxs.update(max_stats)

    builds = []
    for m in range(mins['m'], maxs['m'] + 1):
        for a in range(mins['a'], maxs['a'] + 1):
            for f in range(mins['f'], maxs['f'] + 1):
                for c in range(mins['c'], maxs['c'] + 1):
                    r = budget - m - a - f - c
                    if r < mins['r'] or r > maxs['r']:
                        continue
                    builds.append((m, a, f, r, c))
    return builds

def run_matchup(da, db, num_sims):
    """Run num_sims simulations between two dragons. Returns (a_wins, b_wins, mutuals)."""
    a_wins = 0; b_wins = 0; mutuals = 0
    for _ in range(num_sims):
        winner, loser, fled, ticks = simulate_fast(da, db)
        if winner == 'MUTUAL':
            mutuals += 1
        elif winner == 'DRAW':
            pass
        elif winner == da['name']:
            a_wins += 1
        else:
            b_wins += 1
    return a_wins, b_wins, mutuals

# === DRAGON DEFINITIONS ===
# Each dragon has a name, point budget, and stat constraints based on lore
# Constraints narrow the search space enormously

DRAGON_CONFIGS = {
    'Vhagar': {
        'budget': 37,
        'min': {'m': 6, 'f': 6, 'r': 6},       # massive, powerful, tough
        'max': {'a': 5, 'c': 5},                 # slow, not cunning
    },
    'Caraxes': {
        'budget': 34,
        'min': {'a': 6, 'f': 7, 'c': 5},       # fast, fierce, cunning
        'max': {'r': 5},                          # glass cannon
    },
    'Vermithor': {
        'budget': 35,
        'min': {'m': 5, 'f': 5, 'r': 5},       # well-rounded powerhouse
        'max': {'a': 7},                          # not super agile
    },
    'Cannibal': {
        'budget': 36,
        'min': {'m': 5, 'f': 7},                # savage, ferocious
        'max': {'c': 5, 'a': 6},                 # wild, not tactical
    },
}

# Target ranking: Vhagar > Caraxes > Vermithor > Cannibal
TARGET_ORDER = ['Vhagar', 'Caraxes', 'Vermithor', 'Cannibal']

PHASE1_SIMS = 100   # quick screening
PHASE2_SIMS = 1000  # full tournament

def main():
    start = time.time()

    # Generate all valid builds per dragon
    all_builds = {}
    for name, cfg in DRAGON_CONFIGS.items():
        builds = generate_builds(cfg['budget'], cfg.get('min'), cfg.get('max'))
        all_builds[name] = builds
        print(f"{name}: {len(builds)} valid builds (budget {cfg['budget']})")

    total_combos = 1
    for name, builds in all_builds.items():
        total_combos *= len(builds)
    print(f"\nTotal combinations: {total_combos:,}")

    # === PHASE 1: Sample random build combos and find promising ones ===
    NUM_SAMPLES = 1000
    print("=" * 80)
    print(f"PHASE 1: Sampling {NUM_SAMPLES} random build combinations, {PHASE1_SIMS} sims each")
    print("=" * 80)
    best_results = []

    for sample_i in range(NUM_SAMPLES):
        if sample_i % 200 == 0:
            elapsed = time.time() - start
            print(f"  Sample {sample_i}/{NUM_SAMPLES} ({elapsed:.0f}s elapsed)...")

        # Pick random builds for each dragon
        dragons = {}
        for name, builds in all_builds.items():
            m, a, f, r, c = random.choice(builds)
            dragons[name] = create_dragon(name, m, a, f, r, c)

        # Run round-robin among the 4 dragons
        records = {name: 0 for name in TARGET_ORDER}
        for n1, n2 in combinations(TARGET_ORDER, 2):
            aw, bw, mu = run_matchup(dragons[n1], dragons[n2], PHASE1_SIMS)
            records[n1] += aw
            records[n2] += bw

        # Check ranking
        ranking = sorted(TARGET_ORDER, key=lambda n: -records[n])

        # Score: how close to target order (0 = perfect)
        score = sum(abs(ranking.index(name) - TARGET_ORDER.index(name)) for name in TARGET_ORDER)

        # Also track win rate spread (we want it tight)
        total_fights = PHASE1_SIMS * 3  # each dragon fights 3 others
        win_rates = {name: records[name] / total_fights * 100 for name in TARGET_ORDER}
        spread = max(win_rates.values()) - min(win_rates.values())

        if score == 0:  # perfect ranking match
            best_results.append((spread, win_rates, dragons, ranking))

    # Sort by tightest spread
    best_results.sort(key=lambda x: x[0])

    elapsed = time.time() - start
    print(f"\nPhase 1 complete in {elapsed:.0f}s")
    print(f"Found {len(best_results)} combinations with correct ranking order\n")

    if not best_results:
        print("No perfect ranking matches found! Showing closest results...")
        return

    # Show top 20
    print("=" * 80)
    print("TOP 20 BUILDS (correct ranking, tightest win rate spread)")
    print("=" * 80)

    for i, (spread, win_rates, dragons, ranking) in enumerate(best_results[:20]):
        print(f"\n--- #{i+1} (spread: {spread:.1f}%) ---")
        for name in TARGET_ORDER:
            d = dragons[name]
            wr = win_rates[name]
            pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
            print(f"  {name:<12} M{d['might']:>2}/A{d['agility']:>2}/F{d['ferocity']:>2}/R{d['resilience']:>2}/C{d['cunning']:>2}  "
                  f"({pts}pts)  Strike:{d['strike']:>2}  Eva:{d['evasion']:>2}  HP:{d['max_hp']:>4}  WinRate:{wr:.1f}%")

    # === PHASE 2: Take best result and run full tournament with all 15 dragons ===
    if best_results:
        print("\n" + "=" * 80)
        print("PHASE 2: Full 15-dragon tournament using best build")
        print("=" * 80)

        _, _, best_dragons, _ = best_results[0]

        # Build the full roster -- use best top 4, keep reasonable defaults for rest
        all_dragons = [
            best_dragons['Vhagar'],
            best_dragons['Cannibal'],
            best_dragons['Vermithor'],
            best_dragons['Caraxes'],
            create_dragon('Dreamfyre', 7, 5, 5, 10, 6),   # 33
            create_dragon('Silverwing',6, 5, 4, 10, 8),    # 33
            create_dragon('Meleys',    7, 8, 8, 5, 8),     # 36
            create_dragon('Sheepstealer',4,8, 5, 5, 10),   # 32
            create_dragon('Grey Ghost',3, 9, 2, 4, 10),    # 28
            create_dragon('Seasmoke', 5, 7, 5, 6, 7),      # 30
            create_dragon('Sunfyre',  6, 5, 7, 5, 5),      # 28
            create_dragon('Syrax',    5, 3, 3, 10, 3),     # 24
            create_dragon('Vermax',   4, 6, 6, 3, 4),      # 23
            create_dragon('Tessarion',3, 6, 5, 4, 4),      # 22
            create_dragon('Arrax',    2, 7, 4, 2, 4),      # 19
        ]

        records = {d['name']: {'wins': 0, 'losses': 0, 'mutuals': 0} for d in all_dragons}
        h2h = {}

        for da, db in combinations(all_dragons, 2):
            aw, bw, mu = run_matchup(da, db, PHASE2_SIMS)
            records[da['name']]['wins'] += aw
            records[da['name']]['losses'] += bw
            records[da['name']]['mutuals'] += mu
            records[db['name']]['wins'] += bw
            records[db['name']]['losses'] += aw
            records[db['name']]['mutuals'] += mu
            h2h[(da['name'], db['name'])] = (aw, bw, mu)

        rankings = []
        for d in all_dragons:
            name = d['name']
            r = records[name]
            total = r['wins'] + r['losses'] + r['mutuals']
            win_pct = r['wins'] / total * 100 if total > 0 else 0
            pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
            rankings.append((win_pct, name, r['wins'], r['losses'], r['mutuals'], pts, d))

        rankings.sort(key=lambda x: -x[0])

        print(f"\n{'Rank':<5} {'Dragon':<14} {'Pts':>4} {'W':>5} {'L':>5} {'M':>4} {'Win%':>6}  {'S':>3} {'E':>3} {'HP':>5}  Build")
        print("-" * 95)
        for i, (wpct, name, w, l, m, pts, d) in enumerate(rankings):
            build = f"M{d['might']}/A{d['agility']}/F{d['ferocity']}/R{d['resilience']}/C{d['cunning']}"
            print(f"{i+1:<5} {name:<14} {pts:>4} {w:>5} {l:>5} {m:>4} {wpct:>5.1f}%  {d['strike']:>3} {d['evasion']:>3} {d['max_hp']:>5}  {build}")

        # Key matchups
        print(f"\nKEY MATCHUPS ({PHASE2_SIMS} sims each):")
        key_pairs = [
            ('Caraxes', 'Vhagar'), ('Caraxes', 'Cannibal'), ('Cannibal', 'Vhagar'),
            ('Meleys', 'Vhagar'), ('Vermithor', 'Vhagar'), ('Caraxes', 'Meleys'),
            ('Caraxes', 'Vermithor'), ('Cannibal', 'Vermithor'),
        ]
        for a_name, b_name in key_pairs:
            key = (a_name, b_name)
            rev = (b_name, a_name)
            if key in h2h:
                aw, bw, m = h2h[key]
            elif rev in h2h:
                bw, aw, m = h2h[rev]
            else:
                continue
            total = aw + bw + m
            print(f"  {a_name:<12} vs {b_name:<12} -> {a_name} {aw/total*100:.0f}%  {b_name} {bw/total*100:.0f}%  Mutual {m/total*100:.0f}%")

    total_time = time.time() - start
    print(f"\nTotal time: {total_time:.0f}s")

if __name__ == '__main__':
    main()
