"""
Dragon Round-Robin Tournament v2 -- with Unique Perks
Original combat system (stats capped at 10) + unique dragon perks
HP = R * 100, Strike = M + F, Evasion = C + A, 5 dmg/hit base

PERKS:
  Vhagar      - Titan's Might:  +2 damage per net hit (7/hit instead of 5)
  Caraxes     - Blood Wyrm:     Wound penalties -3, +5 strike below 75% HP, bleeds
  Vermithor   - Bronze Fury:    Wound penalties -1 per tier, +2 strike first 5 ticks
  Cannibal    - Feral:          +2 Strike, -2 Evasion, heals 50 HP per kill
  Meleys      - Red Queen:      +3 effective agility for initiative
  Dreamfyre   - Ancient Grace:  Immune to first wound tier, +1 all wound thresholds
  Sheepstealer- Survivor:       +3 flee dice, +2 evasion when below 50% HP
  Grey Ghost  - Phantom:        +4 evasion for first 5 ticks (hard to find/engage)
  Sunfyre     - Golden Fury:    6s on strike count as 2 hits
  Syrax       - Well-Fed:       +300 HP, wound thresholds shift down 10%
  Silverwing  - Stalwart:       Cannot flee, +2 evasion always (disciplined)
  Arrax       - Nimble:         +3 evasion always (tiny target)
  Seasmoke    - Bonded:         +2 strike when acting second (responsive to rider)
  Vermax      - Young Fire:     +1 damage per hit (6/hit), eager and hot-blooded
  Tessarion   - Blue Queen:     +2 evasion always (graceful flyer)
"""
import random
from itertools import combinations

def create_dragon(name, might, agility, ferocity, resilience, cunning, perk=None):
    hp = resilience * 100
    strike = might + ferocity
    evasion = cunning + agility

    # Feral perk modifies base stats
    if perk == 'feral':
        strike += 2
        evasion = max(0, evasion - 2)

    # Well-Fed perk adds bonus HP
    if perk == 'well_fed':
        hp += 300

    # Stalwart perk: +2 evasion (disciplined, experienced)
    if perk == 'stalwart':
        evasion += 2

    # Nimble perk: +3 evasion (tiny target)
    if perk == 'nimble':
        evasion += 3

    # Blue Queen perk: +2 evasion (graceful)
    if perk == 'blue_queen':
        evasion += 2

    return {
        'name': name, 'might': might, 'agility': agility,
        'ferocity': ferocity, 'resilience': resilience, 'cunning': cunning,
        'hp': hp, 'max_hp': hp,
        'strike': strike, 'evasion': evasion,
        'perk': perk,
        'phantom_used': False,
        'bleeds': [],
        'tick': 0,  # track combat tick for time-limited perks
    }

def get_wound_penalty(dragon):
    pct = dragon['hp'] / dragon['max_hp']

    # Well-Fed: wound thresholds shift down 10% (triggers later)
    if dragon['perk'] == 'well_fed':
        if pct > 0.65: return 0
        elif pct > 0.40: return 2
        elif pct > 0.15: return 4
        else: return 6

    # Ancient Grace: immune to first wound tier entirely
    if dragon['perk'] == 'ancient_grace':
        if pct > 0.50: return 0
        elif pct > 0.25: return 2  # only -2 instead of -4
        else: return 4             # only -4 instead of -6

    base = 0
    if pct > 0.75: base = 0
    elif pct > 0.50: base = 2
    elif pct > 0.25: base = 4
    else: base = 6

    if dragon['perk'] == 'blood_wyrm':
        base = max(0, base - 3)  # Blood Wyrm: wound penalties reduced by 3

    if dragon['perk'] == 'bronze_fury':
        base = max(0, base - 1)  # reduced by 1 at each tier

    return base

def would_flee(dragon):
    if dragon['perk'] == 'stalwart':
        return False  # Silverwing never flees

    pct = dragon['hp'] / dragon['max_hp']
    if pct > 0.50: return False
    if pct > 0.25: return dragon['ferocity'] < 5
    else: return dragon['ferocity'] < 8

def roll_dice(num_dice):
    if num_dice <= 0: return 0
    return sum(1 for _ in range(num_dice) if random.randint(1, 6) >= 4)

def roll_dice_golden(num_dice):
    """Golden Fury: 6s count as 2 hits, 4-5 count as 1 hit."""
    if num_dice <= 0: return 0
    hits = 0
    for _ in range(num_dice):
        roll = random.randint(1, 6)
        if roll == 6:
            hits += 2
        elif roll >= 4:
            hits += 1
    return hits

def attack_silent(attacker, defender, is_death_throes=False):
    penalty_a = get_wound_penalty(attacker)
    penalty_d = get_wound_penalty(defender)
    strike_dice = max(0, attacker['strike'] - penalty_a)

    # Blood Wyrm: below 75% HP, +5 strike dice (desperate fury)
    if attacker['perk'] == 'blood_wyrm' and attacker['hp'] / attacker['max_hp'] <= 0.75:
        strike_dice += 5

    # Bronze Fury: +2 strike for first 5 ticks (charges in hard)
    if attacker['perk'] == 'bronze_fury' and attacker.get('tick', 0) <= 5:
        strike_dice += 2

    # Bonded: +2 strike when acting second (responsive to rider commands)
    if attacker['perk'] == 'bonded' and attacker.get('is_second', False):
        strike_dice += 2

    if is_death_throes:
        evasion_dice = max(0, (defender['evasion'] - penalty_d) // 2)
    else:
        evasion_dice = max(0, defender['evasion'] - penalty_d)

    # Survivor: +2 evasion below 50% HP (fight-or-flight sharpens reflexes)
    if defender['perk'] == 'survivor' and defender['hp'] / defender['max_hp'] <= 0.50:
        evasion_dice += 2

    # Phantom: +4 evasion for first 5 ticks (hard to find/engage)
    if defender['perk'] == 'phantom' and defender.get('tick', 0) <= 5:
        evasion_dice += 4

    # Golden Fury perk: 6s count as double hits
    if attacker['perk'] == 'golden_fury':
        hits = roll_dice_golden(strike_dice)
    else:
        hits = roll_dice(strike_dice)

    blocks = roll_dice(evasion_dice)
    net_hits = max(0, hits - blocks)

    # Base damage
    if is_death_throes:
        dmg_per_hit = 10
    else:
        dmg_per_hit = 5

    # Titan's Might perk: +2 damage per hit
    if attacker['perk'] == 'titans_might':
        dmg_per_hit += 2

    # Young Fire perk: +1 damage per hit
    if attacker['perk'] == 'young_fire':
        dmg_per_hit += 1

    damage = net_hits * dmg_per_hit
    defender['hp'] = max(0, defender['hp'] - damage)


def death_throes_silent(dying, target):
    if dying['ferocity'] < 8: return
    dying['hp'] = 1
    attack_silent(dying, target, is_death_throes=True)
    dying['hp'] = 0

def get_initiative(a, b):
    """Determine who goes first. Red Queen adds +3 effective agility for initiative."""
    a_agi = a['agility'] + (3 if a['perk'] == 'red_queen' else 0)
    b_agi = b['agility'] + (3 if b['perk'] == 'red_queen' else 0)

    if a_agi > b_agi: return a, b
    elif b_agi > a_agi: return b, a
    elif a['ferocity'] >= b['ferocity']: return a, b
    else: return b, a

def simulate_fast(dragon_a, dragon_b):
    a = dict(dragon_a); a['hp'] = a['max_hp']; a['bleeds'] = []; a['tick'] = 0
    b = dict(dragon_b); b['hp'] = b['max_hp']; b['bleeds'] = []; b['tick'] = 0

    first, second = get_initiative(a, b)
    second['is_second'] = True  # for Bonded perk
    first['is_second'] = False

    tick = 0
    while a['hp'] > 0 and b['hp'] > 0:
        tick += 1
        a['tick'] = tick
        b['tick'] = tick
        if tick > 200: break

        # Process bleeds
        for dragon in [a, b]:
            if dragon['bleeds']:
                bleed_dmg = len(dragon['bleeds']) * 5
                dragon['hp'] = max(0, dragon['hp'] - bleed_dmg)
                dragon['bleeds'] = [t - 1 for t in dragon['bleeds'] if t > 1]
        if a['hp'] <= 0 or b['hp'] <= 0:
            if a['hp'] <= 0 and b['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            elif a['hp'] <= 0:
                return b['name'], a['name'], None, tick
            else:
                return a['name'], b['name'], None, tick

        # Flee checks
        if would_flee(first):
            bonus = 3 if first['perk'] == 'survivor' else 0
            fs = roll_dice(max(0, first['agility'] - get_wound_penalty(first) + bonus))
            cs = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            if fs > cs: return a['name'], b['name'], first['name'], tick

        if would_flee(second):
            bonus = 3 if second['perk'] == 'survivor' else 0
            fs = roll_dice(max(0, second['agility'] - get_wound_penalty(second) + bonus))
            cs = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            if fs > cs: return a['name'], b['name'], second['name'], tick

        # First striker attacks
        attack_silent(first, second)
        if second['hp'] <= 0:
            death_throes_silent(second, first)
            if first['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            return first['name'], second['name'], None, tick

        # Second striker attacks
        attack_silent(second, first)
        if first['hp'] <= 0:
            death_throes_silent(first, second)
            if second['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            return second['name'], first['name'], None, tick

    return 'DRAW', 'DRAW', None, tick

# === ALL DRAGONS (stats capped at 10, original system + perks) ===
ALL_DRAGONS = [
    #                             M   A   F   R   C  Pts  Perk
    create_dragon('Vhagar',       8,  3, 10, 10,  6, perk='titans_might'),   # 37
    create_dragon('Cannibal',     8,  5, 10, 10,  3, perk='feral'),          # 36
    create_dragon('Vermithor',   10,  5,  8,  8,  5, perk='bronze_fury'),    # 36
    create_dragon('Caraxes',      7,  9, 10,  4,  5, perk='blood_wyrm'),     # 35
    create_dragon('Dreamfyre',    7,  4,  5, 10,  7, perk='ancient_grace'),  # 33
    create_dragon('Silverwing',   6,  5,  4, 10,  8, perk='stalwart'),       # 33
    create_dragon('Meleys',       7,  8,  9,  5,  8, perk='red_queen'),      # 37
    create_dragon('Sheepstealer', 4,  8,  5,  6, 10, perk='survivor'),       # 33
    create_dragon('Grey Ghost',   3,  9,  3,  5, 10, perk='phantom'),        # 30
    create_dragon('Seasmoke',     6,  7,  6,  6,  7, perk='bonded'),         # 32
    create_dragon('Sunfyre',      6,  5,  8,  6,  5, perk='golden_fury'),    # 30
    create_dragon('Syrax',        5,  3,  4,  9,  3, perk='well_fed'),       # 24
    create_dragon('Vermax',       5,  6,  7,  4,  4, perk='young_fire'),     # 26
    create_dragon('Tessarion',    4,  7,  5,  5,  5, perk='blue_queen'),     # 26
    create_dragon('Arrax',        3,  8,  4,  3,  4, perk='nimble'),         # 22
]

NUM_SIMS = 1000
random.seed(None)

# Track records
records = {d['name']: {'wins': 0, 'losses': 0, 'mutuals': 0, 'flights_caused': 0, 'fled': 0} for d in ALL_DRAGONS}
h2h = {}

print(f"DRAGON ROUND-ROBIN TOURNAMENT v2 -- {NUM_SIMS} sims per matchup")
print(f"Formulas: HP=R*100, Strike=M+F, Evasion=C+A, 5dmg/hit base")
print(f"Each dragon has a unique perk!")
print(f"{len(ALL_DRAGONS)} dragons, {len(ALL_DRAGONS) * (len(ALL_DRAGONS)-1) // 2} matchups")
print()

# Print dragon sheet
print("=" * 100)
print("DRAGON ROSTER")
print("=" * 100)
print(f"{'Name':<14} {'M':>2} {'A':>2} {'F':>2} {'R':>2} {'C':>2} {'Pts':>4}  {'Str':>3} {'Eva':>3} {'HP':>5}  Perk")
print("-" * 100)
for d in ALL_DRAGONS:
    pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
    perk_name = d['perk'] or '-'
    print(f"{d['name']:<14} {d['might']:>2} {d['agility']:>2} {d['ferocity']:>2} {d['resilience']:>2} {d['cunning']:>2} {pts:>4}  {d['strike']:>3} {d['evasion']:>3} {d['max_hp']:>5}  {perk_name}")
print()

for da, db in combinations(ALL_DRAGONS, 2):
    a_wins = 0; b_wins = 0; mutuals = 0

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

print("=" * 100)
print("POWER RANKINGS")
print("=" * 100)
print(f"{'Rank':<5} {'Dragon':<14} {'Pts':>4} {'W':>6} {'L':>6} {'M':>5} {'Fled':>5} {'Win%':>6}  {'Perk':<16}")
print("-" * 100)
for i, (wpct, name, w, l, m, fled, pts, d) in enumerate(rankings):
    perk_name = d['perk'] or '-'
    print(f"{i+1:<5} {name:<14} {pts:>4} {w:>6} {l:>6} {m:>5} {fled:>5} {wpct:>5.1f}%  {perk_name:<16}")

# === KEY MATCHUPS ===
print()
print("=" * 100)
print(f"KEY MATCHUPS ({NUM_SIMS} sims each)")
print("=" * 100)

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
    ('Vermithor', 'Cannibal'),
    ('Meleys', 'Caraxes'),
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
    total = aw + bw + m
    if total == 0: continue
    print(f"  {a_name:<14} vs {b_name:<14} -> {a_name} {aw/total*100:.0f}%  {b_name} {bw/total*100:.0f}%  Mutual {m/total*100:.0f}%")

# === TIER LIST ===
print()
print("=" * 100)
print("TIER LIST")
print("=" * 100)
for i, (wpct, name, w, l, m, fled, pts, d) in enumerate(rankings):
    if wpct >= 70: tier = "S"
    elif wpct >= 55: tier = "A"
    elif wpct >= 40: tier = "B"
    elif wpct >= 25: tier = "C"
    else: tier = "D"
    perk_name = d['perk'] or '-'
    print(f"  [{tier}] {name:<14} {wpct:.1f}% win rate  ({perk_name})")
