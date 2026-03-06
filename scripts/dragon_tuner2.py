"""
Dragon Combat Auto-Tuner v2 -- with Cunning stat
Caraxes is fixed. Sweeps Vhagar's stats to find closest 50/50.
Formulas: HP = (Might + Resilience*2) * 10, Strike = Might + Ferocity, Evasion = Cunning + Agility
"""
import random

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
        if tick > 100: break

        if would_flee(first):
            fs = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            cs = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            if fs > cs: return a['hp'], b['hp'], first['name']

        if would_flee(second):
            fs = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            cs = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            if fs > cs: return a['hp'], b['hp'], second['name']

        attack_silent(first, second)
        if second['hp'] <= 0:
            death_throes_silent(second, first)
            return a['hp'], b['hp'], None

        attack_silent(second, first)
        if first['hp'] <= 0:
            death_throes_silent(first, second)
            return a['hp'], b['hp'], None

    return a['hp'], b['hp'], None

# Caraxes FIXED: M6/A10/F10/R6/C8 = 40 pts
CARAXES = create_dragon('Caraxes', might=6, agility=10, ferocity=10, resilience=6, cunning=8)
NUM_SIMS = 500

print(f"Caraxes: M6/A10/F10/R6/C8 -- Strike 16, Evasion 18, HP 600 (40 pts)")
print(f"Formulas: HP=R*100, Strike=M+F, Evasion=C+A")
print(f"Sweeping Vhagar: Might 8-10, Agility 2-5, Ferocity 6-10, Cunning 1-10, Resilience=remainder")
print(f"Running {NUM_SIMS} sims per config...")
print()
print(f"{'Config':<28} {'Strike':>6} {'Eva':>4} {'HP':>4} {'DT?':>4} {'C_Win':>6} {'V_Win':>6} {'Mutual':>7} {'Delta':>6}")
print("-" * 82)

results = []

for m in range(8, 11):
    for a in range(2, 6):
        for f in range(6, 11):
            for c in range(1, 11):
                r = 40 - m - a - f - c  # Same 40 pt budget
                if r < 1 or r > 10: continue

                vhagar = create_dragon('Vhagar', might=m, agility=a, ferocity=f, resilience=r, cunning=c)
                c_wins = 0; v_wins = 0; mutuals = 0

                for _ in range(NUM_SIMS):
                    c_hp, v_hp, fled = simulate_fast(CARAXES, vhagar)
                    if fled:
                        if fled == 'Caraxes': v_wins += 1
                        else: c_wins += 1
                    elif c_hp <= 0 and v_hp <= 0: mutuals += 1
                    elif c_hp > 0: c_wins += 1
                    else: v_wins += 1

                c_pct = c_wins / NUM_SIMS * 100
                v_pct = v_wins / NUM_SIMS * 100
                m_pct = mutuals / NUM_SIMS * 100
                delta = abs(c_pct - v_pct)
                dt = "Yes" if f >= 8 else "No"

                results.append((delta, m, a, f, r, c, vhagar['strike'], vhagar['evasion'], vhagar['max_hp'], dt, c_pct, v_pct, m_pct))

results.sort(key=lambda x: x[0])

for delta, m, a, f, r, c, strike, eva, hp, dt, c_pct, v_pct, m_pct in results[:25]:
    config = f"M{m}/A{a}/F{f}/R{r}/C{c}"
    print(f"{config:<28} {strike:>6} {eva:>4} {hp:>4} {dt:>4} {c_pct:>5.1f}% {v_pct:>5.1f}% {m_pct:>6.1f}% {delta:>5.1f}%")

print()
print("Top 10 closest to 50/50:")
for i, (delta, m, a, f, r, c, strike, eva, hp, dt, c_pct, v_pct, m_pct) in enumerate(results[:10]):
    config = f"M{m}/A{a}/F{f}/R{r}/C{c}"
    print(f"  {i+1}. {config} -- C:{c_pct:.0f}% V:{v_pct:.0f}% Mutual:{m_pct:.0f}% (delta {delta:.1f}%)")
