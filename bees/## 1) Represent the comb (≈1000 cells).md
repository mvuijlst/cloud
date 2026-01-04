## 1) Represent the comb (≈1000 cells)

Treat comb as a **hex grid (6 neighbors)**. Each cell has:

- `built: bool` (comb exists or not)
- `kind: enum` = `EMPTY | EGG | LARVA | PUPA | HONEY | POLLEN | NECTAR`
- `age: float` (days since egg laid / since nectar stored, etc.)
- `caste: enum` for brood cells = `WORKER | DRONE | QUEEN` (optional)
- `cap: bool` (capped brood / capped honey)

This lets “growth” literally mean **more cells get built at the boundary**.

## 2) Represent bees (don’t simulate every bee unless you want to)

Use **age cohorts** (much faster, still realistic):

- Workers: `count[age_in_days]` or buckets (e.g., 0–2, 3–11, 12–18, 19+)
- Queen: single agent
- Drones: optional cohort

Why this matters: wax builders are mostly **young workers ~12–18 days**. 

## 3) Core biological clocks (use these as rules)

Brood development (baseline):

- Worker: **3d egg + 6d larva + 12d pupa = ~21d** 
- Queen: **~16d** 
- Drone: **~24d** 

Queen egg-laying capacity: set a parameter like `queen_max_eggs_per_day ≈ 50` under strong conditions. 
But **actual laying each day = min(max, empty brood-suitable cells, nursing capacity, food, temperature)**.

## 4) Realistic spatial pattern (so it doesn’t feel “toy”)

Use simple placement heuristics that reproduce typical comb structure:

- Define a “brood center” coordinate.
- **Brood cluster** grows contiguously around center.
- **Pollen ring** around brood.
- **Honey outside** (and often “above” brood in framed hives), but you can approximate with “distance from brood center”.

This “brood in middle → pollen outside → honey further out” pattern is widely described. 

## 5) Task allocation (the engine of realism)

Each timestep (hourly works well), allocate worker labor across tasks based on demand:

**Demands you can compute from state**

- `nursing_demand` = number of larva cells × feed rate
- `foraging_demand` = desired stores target − current stores
- `comb_build_demand` = (empty-cell shortage for brood + storage shortage)
- `processing_demand` = nectar needing conversion/evaporation
- `thermo_demand` = if brood exists, keep temperature stable (optional but powerful)

**Supply**

- worker cohorts contribute different efficiencies:
    - nurses (younger)
    - wax/builders (strongly 12–18d) 
    - foragers (older)

A good mechanism is “**response thresholds**”:

> fraction\_of\_workers\_assigned\_to\_task ∝ (demand^k / (demand^k + threshold^k))

That’s realistic colony behavior without micromanaging individuals.

## 6) Comb growth and “first eggs”

Comb growth rule:

- Builders consume from a `wax_pool` (or directly from honey intake).
- Wax production is driven by **young workers** and **honey/nectar availability**. 
- New cells appear on the **frontier** (built cell adjacent to unbuilt).

“First eggs” rule:

- Queen can only lay once there are **built empty worker cells**, typically in the **earliest built comb near the center** (in your sim: the cells closest to brood center that are empty).

## 7) Update loop (what happens each tick)

Per hour (or per day, but hourly feels more alive):

1. **Environment**: nectar/pollen availability → forager returns.
2. **Allocate labor** (nurse/build/forage/process/guard/heat).
3. **Process resources**: nectar → honey (evap), store pollen.
4. **Build comb**: convert wax/labor → new `built` cells on frontier.
5. **Queen lays**: place eggs into best empty brood cells, up to constraints.
6. **Brood care**: consume pollen+honey to keep larvae alive/growing.
7. **Advance brood timers**: egg→larva→pupa→emerge using the day counts above. 
8. **Age workers / mortality**: shift cohorts, apply losses.
9. **Optional realism knobs**: disease, swarming triggers, seasonal forage, drone eviction, etc.