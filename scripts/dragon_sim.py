"""
Dragon Aerial Combat Simulator
Caraxes vs Vhagar -- testing the combat system
Now with Death Throes mechanic
"""
import random

def create_dragon(name, might, agility, ferocity, resilience, cunning):
    hp = resilience * 100
    return {
        'name': name,
        'might': might,
        'agility': agility,
        'ferocity': ferocity,
        'resilience': resilience,
        'cunning': cunning,
        'hp': hp,
        'max_hp': hp,
        'strike': might + ferocity,
        'evasion': cunning + agility,
    }

def get_wound_penalty(dragon):
    pct = dragon['hp'] / dragon['max_hp']
    if pct > 0.75:
        return 0
    elif pct > 0.50:
        return 2
    elif pct > 0.25:
        return 4
    else:
        return 6

def would_flee(dragon):
    """Check if dragon tries to flee based on ferocity and wound state"""
    pct = dragon['hp'] / dragon['max_hp']
    if pct > 0.50:
        return False
    if pct > 0.25:
        return dragon['ferocity'] < 5
    else:
        return dragon['ferocity'] < 8

def roll_dice(num_dice):
    """Roll num_dice d6s, return number of successes (4+)"""
    if num_dice <= 0:
        return 0
    hits = 0
    for _ in range(num_dice):
        if random.randint(1, 6) >= 4:
            hits += 1
    return hits

def attack(attacker, defender, log, tick, is_death_throes=False):
    penalty_a = get_wound_penalty(attacker)
    penalty_d = get_wound_penalty(defender)

    strike_dice = max(0, attacker['strike'] - penalty_a)
    # Death throes: defender's evasion is halved (can't dodge a dying dragon on top of you)
    if is_death_throes:
        evasion_dice = max(0, (defender['evasion'] - penalty_d) // 2)
    else:
        evasion_dice = max(0, defender['evasion'] - penalty_d)

    hits = roll_dice(strike_dice)
    blocks = roll_dice(evasion_dice)

    net_hits = max(0, hits - blocks)
    # Death throes: damage per hit is doubled (full commitment, biting, clawing, body weight)
    dmg_per_hit = 10 if is_death_throes else 5
    damage = net_hits * dmg_per_hit

    defender['hp'] = max(0, defender['hp'] - damage)
    pct = defender['hp'] / defender['max_hp'] * 100

    prefix = "  ** DEATH THROES ** " if is_death_throes else "  "
    log.append(f"{prefix}{attacker['name']} attacks ({strike_dice}d6->{hits} hits) vs {defender['name']} ({evasion_dice}d6->{blocks} blocks) -> {net_hits} net x {dmg_per_hit} = {damage} dmg -> {defender['name']} HP: {defender['hp']}/{defender['max_hp']} ({pct:.0f}%)")

    # Rider risk
    if damage > 0:
        rider_roll = random.randint(1, 20)
        if rider_roll == 1:
            log.append(f"  !! RIDER WOUNDED! {defender['name']}'s rider takes a wound!")
        if rider_roll == 20 and pct <= 50:
            log.append(f"  XX RIDER KILLED! {defender['name']}'s rider is slain!")
        # Death throes always wound the rider (you're locked together crashing)
        if is_death_throes and damage > 0:
            log.append(f"  !! RIDER IN PERIL! {defender['name']}'s rider braces for the crash!")

def death_throes(dying, target, log):
    """A dragon with Ferocity 8+ gets one final attack when killed.
    It latches on, bites down, and rides its enemy into the ground."""
    if dying['ferocity'] < 8:
        return
    log.append(f"\n  ** {dying['name']} REFUSES TO DIE! **")
    log.append(f"  With its last breath, {dying['name']} lunges — jaws closing on {target['name']}'s throat.")
    log.append(f"  (Ferocity {dying['ferocity']} >= 8: Death Throes triggered)")
    log.append(f"  (Strike at -6 wound penalty, damage x2, defender evasion halved)")

    # The dying dragon is at 0 HP but gets one last strike
    # We temporarily set hp to 1 so wound penalty calc gives -6 (below 25%)
    dying['hp'] = 1
    attack(dying, target, log, 0, is_death_throes=True)
    dying['hp'] = 0

def simulate_combat(dragon_a, dragon_b, sim_num):
    a = dict(dragon_a)
    a['hp'] = a['max_hp']
    b = dict(dragon_b)
    b['hp'] = b['max_hp']

    log = []
    log.append(f"=== SIMULATION {sim_num} ===")
    log.append(f"{a['name']} (Strike {a['strike']}, Evasion {a['evasion']}, HP {a['max_hp']}, Ferocity {a['ferocity']})")
    log.append(f"{b['name']} (Strike {b['strike']}, Evasion {b['evasion']}, HP {b['max_hp']}, Ferocity {b['ferocity']})")
    log.append(f"Initiative: {a['name'] if a['agility'] > b['agility'] else b['name']} (Agility {max(a['agility'], b['agility'])} vs {min(a['agility'], b['agility'])})")
    log.append("")

    if a['agility'] > b['agility']:
        first, second = a, b
    elif b['agility'] > a['agility']:
        first, second = b, a
    elif a['ferocity'] >= b['ferocity']:
        first, second = a, b
    else:
        first, second = b, a

    tick = 0
    fled = None

    while a['hp'] > 0 and b['hp'] > 0:
        tick += 1
        log.append(f"--- Tick {tick} ---")

        # Check flee attempts
        if would_flee(first):
            flee_successes = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            chase_successes = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            log.append(f"  {first['name']} attempts to FLEE! ({flee_successes} vs {chase_successes})")
            if flee_successes > chase_successes:
                log.append(f"  {first['name']} ESCAPES!")
                fled = first['name']
                break
            else:
                log.append(f"  {second['name']} catches them! Combat continues.")

        if would_flee(second):
            flee_successes = roll_dice(max(0, second['agility'] - get_wound_penalty(second)))
            chase_successes = roll_dice(max(0, first['agility'] - get_wound_penalty(first)))
            log.append(f"  {second['name']} attempts to FLEE! ({flee_successes} vs {chase_successes})")
            if flee_successes > chase_successes:
                log.append(f"  {second['name']} ESCAPES!")
                fled = second['name']
                break
            else:
                log.append(f"  {first['name']} catches them! Combat continues.")

        # First striker attacks
        attack(first, second, log, tick)
        if second['hp'] <= 0:
            log.append(f"\n  XX {second['name']} is SLAIN!")
            # Death throes check for the slain dragon
            death_throes(second, first, log)
            break

        # Second striker attacks
        attack(second, first, log, tick)
        if first['hp'] <= 0:
            log.append(f"\n  XX {first['name']} is SLAIN!")
            # Death throes check for the slain dragon
            death_throes(first, second, log)
            break

        log.append("")

    # Summary
    log.append("")
    log.append(f"--- RESULT after {tick} ticks ---")
    if fled:
        winner = first['name'] if fled == second['name'] else second['name']
        winner_hp = second['hp'] if fled == first['name'] else first['hp']
        winner_max = second['max_hp'] if fled == first['name'] else first['max_hp']
        log.append(f"  {fled} FLED the battle")
        log.append(f"  {winner} wins -- HP: {winner_hp}/{winner_max} ({winner_hp/winner_max*100:.0f}%)")
    elif a['hp'] <= 0 and b['hp'] <= 0:
        log.append(f"  MUTUAL KILL -- both dragons fall from the sky!")
        log.append(f"  {a['name']}: {a['hp']}/{a['max_hp']}")
        log.append(f"  {b['name']}: {b['hp']}/{b['max_hp']}")
    elif a['hp'] <= 0:
        log.append(f"  {b['name']} WINS -- HP: {b['hp']}/{b['max_hp']} ({b['hp']/b['max_hp']*100:.0f}%)")
    elif b['hp'] <= 0:
        log.append(f"  {a['name']} WINS -- HP: {a['hp']}/{a['max_hp']} ({a['hp']/a['max_hp']*100:.0f}%)")

    log.append("")
    return '\n'.join(log), tick, a['hp'], b['hp'], fled

# Define dragons
caraxes = create_dragon('Caraxes', might=11, agility=10, ferocity=10, resilience=4, cunning=10)
vhagar = create_dragon('Vhagar', might=10, agility=3, ferocity=10, resilience=24, cunning=3)

# Run simulations
random.seed(None)
NUM_SIMS = 100

caraxes_wins = 0
vhagar_wins = 0
mutual_kills = 0
flights = 0

all_output = []

for i in range(1, NUM_SIMS + 1):
    output, ticks, c_hp, v_hp, fled = simulate_combat(caraxes, vhagar, i)
    all_output.append(output)

    if fled:
        flights += 1
        if fled == 'Caraxes':
            vhagar_wins += 1
        else:
            caraxes_wins += 1
    elif c_hp <= 0 and v_hp <= 0:
        mutual_kills += 1
    elif c_hp > 0:
        caraxes_wins += 1
    else:
        vhagar_wins += 1

for output in all_output:
    print(output)

print("=" * 60)
print(f"SUMMARY -- {NUM_SIMS} Simulations: Caraxes vs Vhagar")
print(f"  (with Death Throes: Ferocity 8+ gets final attack)")
print("=" * 60)
print(f"  Caraxes wins:  {caraxes_wins} ({caraxes_wins/NUM_SIMS*100:.0f}%)")
print(f"  Vhagar wins:   {vhagar_wins} ({vhagar_wins/NUM_SIMS*100:.0f}%)")
print(f"  Mutual kills:  {mutual_kills} ({mutual_kills/NUM_SIMS*100:.0f}%)")
print(f"  Flights:       {flights} ({flights/NUM_SIMS*100:.0f}%)")
print()
print("Death Throes mechanic:")
print("  - Triggers when a dragon with Ferocity 8+ is killed")
print("  - One final attack at -6 wound penalty")
print("  - Defender's evasion halved (can't dodge a dying dragon latched onto you)")
print("  - Damage per hit doubled (10 instead of 5)")
print("  - Both Caraxes (F10) and Vhagar (F8) qualify")
