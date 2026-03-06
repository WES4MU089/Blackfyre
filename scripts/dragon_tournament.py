"""
Dragon Round-Robin Tournament
Every dragon vs every dragon -- 100 sims per matchup
Determines the overall power ranking
"""
import random
from itertools import combinations

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
    strike_dice = max(0, (attacker['strike'] - penalty_a + 1) // 2)  # halved dice pools
    if is_death_throes:
        evasion_dice = max(0, (defender['evasion'] - penalty_d) // 4)
    else:
        evasion_dice = max(0, (defender['evasion'] - penalty_d + 1) // 2)
    hits = roll_dice(strike_dice)
    blocks = roll_dice(evasion_dice)
    net_hits = max(0, hits - blocks)
    dmg_per_hit = 20 if is_death_throes else 10  # doubled damage to compensate
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
            if fs > cs: return a['name'], b['name'], first['name'], tick  # winner, loser, fled

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

# === ALL DRAGONS ===
ALL_DRAGONS = [
    #                          M   A   F   R   C   Pts   Strike  Eva  HP
    create_dragon('Vhagar',   12,  3, 10, 18,  7), # 50   22      10  1800
    create_dragon('Cannibal',  9,  5, 10, 17,  7), # 48   19      12  1700
    create_dragon('Vermithor',11,  5,  8, 14,  8), # 46   19      13  1400
    create_dragon('Caraxes',  10,  9, 10,  6, 10), # 45   20      19   600
    create_dragon('Dreamfyre', 8,  5,  6, 16,  8), # 43   14      13  1600
    create_dragon('Silverwing',7,  5,  5, 17,  9), # 43   12      14  1700
    create_dragon('Meleys',    8,  8,  9,  8,  9), # 42   17      17   800
    create_dragon('Sheepstealer',5,8,  6,  8, 11), # 38   11      19   800
    create_dragon('Grey Ghost', 4,9,   3,  7, 12), # 35    7      21   700
    create_dragon('Seasmoke',  6,  7,  6,  7,  7), # 33   12      14   700
    create_dragon('Sunfyre',   7,  5,  8,  5,  5), # 30   15      10   500
    create_dragon('Syrax',     6,  4,  4, 12,  4), # 30   10       8  1200
    create_dragon('Vermax',    5,  6,  6,  4,  4), # 25   11      10   400
    create_dragon('Tessarion', 4,  6,  5,  5,  4), # 24    9      10   500
    create_dragon('Arrax',     3,  7,  4,  2,  4), # 20    7      11   200
]

NUM_SIMS = 200
random.seed(None)

# Track wins/losses/mutuals for each dragon
records = {d['name']: {'wins': 0, 'losses': 0, 'mutuals': 0, 'flights_caused': 0, 'fled': 0} for d in ALL_DRAGONS}

# Head-to-head results
h2h = {}

print(f"DRAGON ROUND-ROBIN TOURNAMENT -- {NUM_SIMS} sims per matchup")
print(f"Formulas: HP=R*100, Strike=M+F, Evasion=C+A")
print(f"{len(ALL_DRAGONS)} dragons, {len(ALL_DRAGONS) * (len(ALL_DRAGONS)-1) // 2} matchups")
print()

for da, db in combinations(ALL_DRAGONS, 2):
    a_wins = 0; b_wins = 0; mutuals = 0; flights = 0

    for _ in range(NUM_SIMS):
        winner, loser, fled, ticks = simulate_fast(da, db)
        if winner == 'MUTUAL':
            mutuals += 1
        elif winner == 'DRAW':
            pass
        elif winner == da['name']:
            a_wins += 1
            if fled:
                records[da['name']]['flights_caused'] += 1
                records[db['name']]['fled'] += 1
        else:
            b_wins += 1
            if fled:
                records[db['name']]['flights_caused'] += 1
                records[da['name']]['fled'] += 1

    records[da['name']]['wins'] += a_wins
    records[da['name']]['losses'] += b_wins
    records[da['name']]['mutuals'] += mutuals
    records[db['name']]['wins'] += b_wins
    records[db['name']]['losses'] += a_wins
    records[db['name']]['mutuals'] += mutuals

    key = (da['name'], db['name'])
    h2h[key] = (a_wins, b_wins, mutuals)

# === POWER RANKINGS ===
rankings = []
for d in ALL_DRAGONS:
    name = d['name']
    r = records[name]
    total = r['wins'] + r['losses'] + r['mutuals']
    win_pct = r['wins'] / total * 100 if total > 0 else 0
    pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
    rankings.append((win_pct, name, r['wins'], r['losses'], r['mutuals'], r['fled'], pts, d))

rankings.sort(key=lambda x: -x[0])

print("=" * 90)
print("POWER RANKINGS")
print("=" * 90)
print(f"{'Rank':<5} {'Dragon':<14} {'Pts':>4} {'W':>5} {'L':>5} {'M':>4} {'Fled':>5} {'Win%':>6}  {'Strike':>6} {'Eva':>4} {'HP':>5}")
print("-" * 90)
for i, (wpct, name, w, l, m, fled, pts, d) in enumerate(rankings):
    print(f"{i+1:<5} {name:<14} {pts:>4} {w:>5} {l:>5} {m:>4} {fled:>5} {wpct:>5.1f}%  {d['strike']:>6} {d['evasion']:>4} {d['max_hp']:>5}")

# === KEY MATCHUPS ===
print()
print("=" * 90)
print("KEY MATCHUPS (notable 1v1s)")
print("=" * 90)

key_matchups = [
    ('Caraxes', 'Vhagar'),
    ('Caraxes', 'Cannibal'),
    ('Cannibal', 'Vhagar'),
    ('Meleys', 'Vhagar'),
    ('Vermithor', 'Vhagar'),
    ('Caraxes', 'Meleys'),
    ('Sunfyre', 'Meleys'),
    ('Arrax', 'Vhagar'),
    ('Caraxes', 'Vermithor'),
    ('Cannibal', 'Vermithor'),
]

for a_name, b_name in key_matchups:
    key = (a_name, b_name)
    rev = (b_name, a_name)
    if key in h2h:
        aw, bw, m = h2h[key]
    elif rev in h2h:
        bw, aw, m = h2h[rev]
    else:
        continue
    print(f"  {a_name:<14} vs {b_name:<14} -> {a_name} {aw}%  {b_name} {bw}%  Mutual {m}%")

# === TIER LIST ===
print()
print("=" * 90)
print("TIER LIST")
print("=" * 90)
for i, (wpct, name, w, l, m, fled, pts, d) in enumerate(rankings):
    if wpct >= 70:
        tier = "S"
    elif wpct >= 55:
        tier = "A"
    elif wpct >= 40:
        tier = "B"
    elif wpct >= 25:
        tier = "C"
    else:
        tier = "D"
    print(f"  [{tier}] {name:<14} {wpct:.1f}% win rate ({pts} pts)")
