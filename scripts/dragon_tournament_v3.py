"""
Dragon Round-Robin Tournament v3 -- Caraxes Bleed
No wound penalties, no guaranteed minimum damage.
Blood Wyrm (Caraxes): each hit adds 1 bleed stack (max 3), 10 dmg/stack/tick.
Missed attacks decay bleeds by 1.

HP = 300 + R*50, Strike = M+F, Evasion = C+A
Damage = 8 per net hit
No wound penalties (no death spiral)
Death Throes: Ferocity 8+ gets final attack (evasion halved, 16 dmg/hit)
All fights to the death -- no flee mechanic
"""
import random
from itertools import combinations

def create_dragon(name, might, agility, ferocity, resilience, cunning, perk=None):
    hp = 300 + resilience * 50
    strike = might + ferocity
    evasion = cunning + agility

    if perk == 'feral':
        strike += 2
        evasion = max(0, evasion - 1)
    if perk == 'stalwart':
        hp += 100
        evasion += 1  # steady, hard to rattle
    if perk == 'nimble':
        evasion += 3
    if perk == 'blue_queen':
        evasion += 2
    if perk == 'well_fed':
        hp += 150
        strike += 1  # well-nourished, fights harder
    if perk == 'blood_wyrm':
        pass  # bleed applied in combat, not stat mods

    return {
        'name': name, 'might': might, 'agility': agility,
        'ferocity': ferocity, 'resilience': resilience, 'cunning': cunning,
        'hp': hp, 'max_hp': hp,
        'strike': strike, 'evasion': evasion,
        'perk': perk, 'tick': 0,
    }

def roll_dice(num_dice):
    if num_dice <= 0: return 0
    return sum(1 for _ in range(num_dice) if random.randint(1, 6) >= 4)

def roll_dice_golden(num_dice):
    if num_dice <= 0: return 0
    hits = 0
    for _ in range(num_dice):
        roll = random.randint(1, 6)
        if roll == 6: hits += 2
        elif roll >= 4: hits += 1
    return hits

def attack_silent(attacker, defender, is_death_throes=False):
    strike_dice = max(0, attacker['strike'])

    # Bronze Fury: +2 strike for first 5 ticks (opening assault)
    if attacker['perk'] == 'bronze_fury' and attacker.get('tick', 0) <= 5:
        strike_dice += 2

    # Bonded: +2 strike when acting second (rider synergy)
    if attacker['perk'] == 'bonded' and attacker.get('is_second', False):
        strike_dice += 2

    # (Blood Wyrm has no strike bonus -- bleeds are the perk)

    if is_death_throes:
        evasion_dice = max(0, defender['evasion'] // 2)
    else:
        evasion_dice = max(0, defender['evasion'])

    # Survivor: +3 evasion below 50% HP (desperate evasion)
    if defender['perk'] == 'survivor' and defender['hp'] / defender['max_hp'] <= 0.50:
        evasion_dice += 3

    # Phantom: +3 evasion for first 6 ticks (ghostly elusiveness)
    if defender['perk'] == 'phantom' and defender.get('tick', 0) <= 6:
        evasion_dice += 3

    # Ancient Grace: +2 evasion always (serene composure)
    if defender['perk'] == 'ancient_grace':
        evasion_dice += 2

    # Golden Fury: reroll misses once (second chance)
    if attacker['perk'] == 'golden_fury':
        hits = 0
        misses = 0
        for _ in range(strike_dice):
            if random.randint(1, 6) >= 4:
                hits += 1
            else:
                misses += 1
        # Reroll up to half the misses
        rerolls = misses // 2
        for _ in range(rerolls):
            if random.randint(1, 6) >= 4:
                hits += 1
    else:
        hits = roll_dice(strike_dice)

    blocks = roll_dice(evasion_dice)
    net_hits = max(0, hits - blocks)  # NO minimum -- evasion can fully block

    if net_hits > 0:
        # Base damage
        dmg_per_hit = 20 if is_death_throes else 10

        # Titan's Might: +3 damage per hit (overwhelming mass)
        if attacker['perk'] == 'titans_might':
            dmg_per_hit += 3

        # Young Fire: +2 damage per hit
        if attacker['perk'] == 'young_fire':
            dmg_per_hit += 2

        damage = net_hits * dmg_per_hit
        defender['hp'] = max(0, defender['hp'] - damage)

        # Blood Wyrm: apply bleed stack on any hit (max 3)
        if attacker['perk'] == 'blood_wyrm':
            defender['bleed_stacks'] = min(3, defender.get('bleed_stacks', 0) + 1)

def death_throes_silent(dying, target):
    if dying['ferocity'] < 8: return
    dying['hp'] = 1
    attack_silent(dying, target, is_death_throes=True)
    dying['hp'] = 0

def get_initiative(a, b):
    a_agi = a['agility'] + (3 if a['perk'] == 'red_queen' else 0)
    b_agi = b['agility'] + (3 if b['perk'] == 'red_queen' else 0)
    if a_agi > b_agi: return a, b
    elif b_agi > a_agi: return b, a
    elif a['ferocity'] >= b['ferocity']: return a, b
    else: return b, a

def simulate_fast(dragon_a, dragon_b):
    a = dict(dragon_a); a['hp'] = a['max_hp']; a['tick'] = 0; a['bleed_stacks'] = 0
    b = dict(dragon_b); b['hp'] = b['max_hp']; b['tick'] = 0; b['bleed_stacks'] = 0

    first, second = get_initiative(a, b)
    second['is_second'] = True
    first['is_second'] = False

    tick = 0
    while a['hp'] > 0 and b['hp'] > 0:
        tick += 1
        a['tick'] = tick; b['tick'] = tick
        if tick > 200: break

        # Process bleed damage at start of tick, then decay 1 stack
        for dragon in [a, b]:
            stacks = dragon.get('bleed_stacks', 0)
            if stacks > 0:
                bleed_dmg = stacks * 8
                dragon['hp'] = max(0, dragon['hp'] - bleed_dmg)
                dragon['bleed_stacks'] = max(0, stacks - 1)  # bleeds decay naturally

        if a['hp'] <= 0 or b['hp'] <= 0:
            if a['hp'] <= 0 and b['hp'] <= 0:
                return 'MUTUAL', 'MUTUAL', None, tick
            elif a['hp'] <= 0:
                return b['name'], a['name'], None, tick
            else:
                return a['name'], b['name'], None, tick

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

# === ALL DRAGONS -- tighter budgets (28-37) ===
ALL_DRAGONS = [
    #                             M   A   F   R   C  Pts  Perk
    create_dragon('Vhagar',       8,  3, 10, 10,  6, perk='titans_might'),   # 37
    create_dragon('Cannibal',     8,  4, 10,  8,  5, perk='feral'),          # 35
    create_dragon('Vermithor',    9,  5,  8,  8,  6, perk='bronze_fury'),    # 36
    create_dragon('Caraxes',      6,  9, 10,  5,  5, perk='blood_wyrm'),     # 35
    create_dragon('Meleys',       7,  8,  8,  5,  7, perk='red_queen'),      # 35
    create_dragon('Dreamfyre',    7,  5,  5, 10,  7, perk='ancient_grace'),  # 34
    create_dragon('Silverwing',   6,  5,  5, 10,  8, perk='stalwart'),       # 34
    create_dragon('Sheepstealer', 5,  8,  6,  6, 10, perk='survivor'),       # 35
    create_dragon('Seasmoke',     6,  7,  7,  6,  7, perk='bonded'),         # 33
    create_dragon('Grey Ghost',   5,  9,  5,  5, 10, perk='phantom'),        # 34
    create_dragon('Sunfyre',      7,  5,  8,  6,  5, perk='golden_fury'),    # 31
    create_dragon('Syrax',        6,  4,  5, 10,  6, perk='well_fed'),       # 31 + well_fed HP
    create_dragon('Vermax',       6,  7,  7,  6,  6, perk='young_fire'),     # 32
    create_dragon('Tessarion',    5,  7,  6,  6,  7, perk='blue_queen'),     # 31
    create_dragon('Arrax',        4,  9,  6,  5,  7, perk='nimble'),         # 31
]

NUM_SIMS = 1000
random.seed(None)

records = {d['name']: {'wins': 0, 'losses': 0, 'mutuals': 0} for d in ALL_DRAGONS}
h2h = {}

print(f"DRAGON ROUND-ROBIN TOURNAMENT v3 -- {NUM_SIMS} sims per matchup")
print(f"HP = 300+R*50 | Strike = M+F | Evasion = C+A | 8 dmg/hit | Bleed: +1 stack on hit (max 3), 10 dmg/stack/tick")
print(f"{len(ALL_DRAGONS)} dragons, {len(ALL_DRAGONS) * (len(ALL_DRAGONS)-1) // 2} matchups")
print()

print("=" * 105)
print("DRAGON ROSTER")
print("=" * 105)
print(f"{'Name':<14} {'M':>2} {'A':>2} {'F':>2} {'R':>2} {'C':>2} {'Pts':>4}  {'Str':>3} {'Eva':>3} {'HP':>5}  Perk")
print("-" * 105)
for d in ALL_DRAGONS:
    pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
    print(f"{d['name']:<14} {d['might']:>2} {d['agility']:>2} {d['ferocity']:>2} {d['resilience']:>2} {d['cunning']:>2} {pts:>4}  {d['strike']:>3} {d['evasion']:>3} {d['max_hp']:>5}  {d['perk'] or '-'}")
print()

for da, db in combinations(ALL_DRAGONS, 2):
    a_wins = 0; b_wins = 0; mutuals = 0
    for _ in range(NUM_SIMS):
        winner, loser, fled, ticks = simulate_fast(da, db)
        if winner == 'MUTUAL': mutuals += 1
        elif winner == 'DRAW': pass
        elif winner == da['name']:
            a_wins += 1
        else:
            b_wins += 1

    records[da['name']]['wins'] += a_wins
    records[da['name']]['losses'] += b_wins
    records[da['name']]['mutuals'] += mutuals
    records[db['name']]['wins'] += b_wins
    records[db['name']]['losses'] += a_wins
    records[db['name']]['mutuals'] += mutuals
    h2h[(da['name'], db['name'])] = (a_wins, b_wins, mutuals)

rankings = []
for d in ALL_DRAGONS:
    name = d['name']
    r = records[name]
    total = r['wins'] + r['losses'] + r['mutuals']
    win_pct = r['wins'] / total * 100 if total > 0 else 0
    pts = d['might'] + d['agility'] + d['ferocity'] + d['resilience'] + d['cunning']
    rankings.append((win_pct, name, r['wins'], r['losses'], r['mutuals'], pts, d))

rankings.sort(key=lambda x: -x[0])

print("=" * 105)
print("POWER RANKINGS")
print("=" * 105)
print(f"{'Rank':<5} {'Dragon':<14} {'Pts':>4} {'W':>6} {'L':>6} {'M':>5} {'Win%':>6}  {'Perk':<16}")
print("-" * 105)
for i, (wpct, name, w, l, m, pts, d) in enumerate(rankings):
    print(f"{i+1:<5} {name:<14} {pts:>4} {w:>6} {l:>6} {m:>5} {wpct:>5.1f}%  {d['perk'] or '-':<16}")

print()
print("=" * 105)
print(f"KEY MATCHUPS ({NUM_SIMS} sims each)")
print("=" * 105)
key_matchups = [
    ('Caraxes', 'Vhagar'), ('Cannibal', 'Vhagar'), ('Vermithor', 'Vhagar'),
    ('Meleys', 'Vhagar'), ('Caraxes', 'Meleys'), ('Caraxes', 'Vermithor'),
    ('Cannibal', 'Vermithor'), ('Sunfyre', 'Meleys'), ('Arrax', 'Vhagar'),
    ('Dreamfyre', 'Caraxes'), ('Seasmoke', 'Sunfyre'), ('Sheepstealer', 'Grey Ghost'),
]
for a_name, b_name in key_matchups:
    key = (a_name, b_name)
    rev = (b_name, a_name)
    if key in h2h: aw, bw, m = h2h[key]
    elif rev in h2h: bw, aw, m = h2h[rev]
    else: continue
    total = aw + bw + m
    if total == 0: continue
    print(f"  {a_name:<14} vs {b_name:<14} -> {a_name} {aw/total*100:.0f}%  {b_name} {bw/total*100:.0f}%  Mutual {m/total*100:.0f}%")

print()
print("=" * 105)
print("TIER LIST")
print("=" * 105)
for i, (wpct, name, w, l, m, pts, d) in enumerate(rankings):
    if wpct >= 70: tier = "S"
    elif wpct >= 55: tier = "A"
    elif wpct >= 40: tier = "B"
    elif wpct >= 25: tier = "C"
    else: tier = "D"
    print(f"  [{tier}] {name:<14} {wpct:.1f}%  ({d['perk'] or '-'})")
