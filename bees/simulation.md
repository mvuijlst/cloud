# Hive Simulation Spec (JS, variable timestep, zonal graph, age buckets)

## 1) Timebase and variable `dt`

**Rule:** every process is defined as a *rate per unit time* and scaled by `dt`.

- Use **seconds** internally.
- Derived:

    - `dtHours = dtSeconds / 3600`
    - `dtDays = dtSeconds / 86400`

### Hazard-rate conversion (dt-stable)

Whenever you previously would have used “probability per tick”, use a hazard rate:

- Given mean time `τDays`, event probability in this update:

    - `p = 1 - Math.exp(-dtDays / τDays)`

Use this for:

- role switching
- leaving a zone (dwell)
- mortality / attrition
- outside-flight return timing

### Fractional counts

Keep **floats** for all populations and flows. Only round for UI. If you need integer realism, use **seeded stochastic rounding** at the end of a tick.

* * *

## 2) State model

### 2.1 Zones (graph nodes)

Use these zones:

- `OUTSIDE`
- `ENTRANCE`
- `VESTIBULE`
- `UNLOAD`
- `BROOD_CORE`
- `BROOD_RING`
- `STORES`
- `BUILD_FRONT`
- optional: `WASTE`

Each zone has:

- `cap` (max bees in zone)
- `occ` (current bees, derived)
- (optional) temperature/comfort scalar if you later want brood thermoregulation

### 2.2 Edges (corridors)

Edges are directed pairs with:

- `throughputPerHour` (bees/hour max)
- Per tick: `edgeLimit = throughputPerHour * dtHours`

Recommended topology:

- OUTSIDE ↔ ENTRANCE
- ENTRANCE ↔ VESTIBULE
- VESTIBULE ↔ UNLOAD
- UNLOAD ↔ STORES
- VESTIBULE ↔ BROOD\_RING
- BROOD\_RING ↔ BROOD\_CORE
- BROOD\_RING ↔ STORES
- STORES ↔ BUILD\_FRONT
- (optional) BROOD\_RING ↔ BUILD\_FRONT
- (optional) VESTIBULE ↔ WASTE ↔ OUTSIDE

### 2.3 Worker age buckets (cohorts)

Track workers in coarse age buckets. Recommended buckets (days):

- `B0` = 0–2 (callow)
- `B1` = 3–11 (nursing-prone)
- `B2` = 12–18 (wax/build/processing peak)
- `B3` = 19–40 (forage/guard peak)
- `B4` = 41+ (old; higher attrition)

Bucket widths:

- `w = [2, 9, 7, 22, ∞]` days

### 2.4 Roles (tasks)

At minimum:

- `NURSE`
- `BUILDER`
- `PROCESSOR`
- `GUARD`
- `FORAGER`
- optional: `CLEANER`

### 2.5 Population tensor

Keep counts at `(zone, bucket, role)` granularity:

- `bees[z][b][r] = float`

This is only ~9×5×6 = 270 cells: cheap and explicit.

### 2.6 Comb cells (explicit ~1000)

Each comb cell (not walkable) stores contents and timers:

- `built: bool`
- `type: EMPTY | EGG | LARVA | PUPA | NECTAR | HONEY | POLLEN`
- `ageDays: float` (development/proc time)
- `capped: bool`

You can store these as typed arrays for speed.

### 2.7 Region tagging (bridge between cells and zones)

Each built comb cell gets a `region` label used for placement rules:

- `BROOD_CORE`, `BROOD_RING`, `STORES`, `BUILD_FRONT` (+ optional `WASTE`)

Compute regions from geometry (hex distance from brood center) or from flood-fill around brood. Keep it stable (don’t reassign every tick unless needed).

* * *

## 3) Default parameters (starter set)

These are *simulation-scale* defaults for a tiny 1000-cell world. Expect tuning.

### 3.1 Zone capacities (for ~1500 workers)

- ENTRANCE: 20
- VESTIBULE: 120
- UNLOAD: 80
- BROOD\_CORE: 300
- BROOD\_RING: 300
- STORES: 350
- BUILD\_FRONT: 150
- OUTSIDE: ∞ (not capacity constrained)
- WASTE: 30

### 3.2 Edge throughputs (bees/hour)

- OUTSIDE↔ENTRANCE: 10
- ENTRANCE↔VESTIBULE: 15
- VESTIBULE↔UNLOAD: 20
- UNLOAD↔STORES: 20
- VESTIBULE↔BROOD\_RING: 30
- BROOD\_RING↔BROOD\_CORE: 30
- BROOD\_RING↔STORES: 25
- STORES↔BUILD\_FRONT: 20
- (optional) BROOD\_RING↔BUILD\_FRONT: 10

**Anti-bunching requirement:** ENTRANCE small, VESTIBULE larger, and OUTSIDE↔ENTRANCE throughput is the tightest choke.

### 3.3 Dwell times (mean time before attempting to move, in hours)

(Use hazard conversion so this is dt-safe.)

- FORAGER:

    - in ENTRANCE: 0.05h
    - in VESTIBULE: 0.2h
    - in UNLOAD: 0.3h
    - in OUTSIDE (flight): 1.5h
- NURSE in BROOD zones: 2–6h
- PROCESSOR in UNLOAD/STORES: 1–3h
- BUILDER in BUILD\_FRONT: 2–6h
- GUARD in ENTRANCE/VESTIBULE: 6–24h

### 3.4 Role switching time constant

Mean role adjustment time:

- `τSwitch = 0.75 days` (hazard-driven)

### 3.5 Age-bucket mortality (mean lifetime beyond bucket)

Instead of sudden death, apply an age-dependent hazard to B4 and a small background hazard elsewhere.

- Background: `τ = 120 days` (very low)
- Old bucket B4: `τ = 15–25 days` (tune)

### 3.6 Queen laying and brood durations

For a tiny world, cap the queen realistically *for your scale*:

- `queenMaxEggsPerDay = 250` (tune 100–400)

Brood stage nominal ages (worker baseline):

- egg: 3 days
- larva: 6 days
- pupa: 12 days  
Total: 21 days

* * *

## 4) Task demand + allocation (age-aware)

### 4.1 Age eligibility (soft constraints)

Apply “availability weights” by bucket when allocating roles:

Example weights (relative suitability):

- B0: nurse 0.2, builder 0.0, processor 0.1, guard 0.0, forager 0.0
- B1: nurse 1.0, builder 0.2, processor 0.5, guard 0.1, forager 0.0
- B2: nurse 0.4, builder 1.0, processor 0.8, guard 0.2, forager 0.1
- B3: nurse 0.1, builder 0.2, processor 0.3, guard 0.7, forager 1.0
- B4: nurse 0.0, builder 0.1, processor 0.1, guard 0.5, forager 0.8

These don’t forbid roles; they bias allocation.

### 4.2 Demand signals (computed each tick)

Compute continuous demands:

- `D_nurse` = `larvaCount * larvaFeedUnitsPerDay`
- `D_process` = `incomingNectar + nectarCellsNeedingProcessing`
- `D_build` = `frontierSlots + broodSpaceShortage + storageSpaceShortage`
- `D_forage` = `targetStores - currentStores` (clamp ≥ 0)
- `D_guard` = proportional to traffic (returning foragers + threats if you model them)

### 4.3 Response-threshold allocation

For each demand `D`:

- `score = D^k / (D^k + T^k)` where `T` is threshold, `k` steepness.

Then normalize scores into target role shares `S_role` (sum to 1).

Finally, adjust actual role counts toward targets with dt-stable switching:

- `pSwitch = 1 - exp(-dtDays / τSwitch)`
- For each bucket b, move `pSwitch` fraction of bees from current roles toward target roles, weighted by eligibility.

**Implementation detail:** do this per zone or globally. If you want stable zoning, do it **globally** but apply per-zone caps (e.g., don’t assign nurses to STORES beyond a tiny fraction).

* * *

## 5) Zonal movement (flow-based, congestion-aware, dt-safe)

### 5.1 Movement intent

For each `(z,b,r)` compute the fraction that wants to move this tick:

- `pLeave = 1 - exp(-dtHours / dwellHours[r][z])`
- `want = bees[z][b][r] * pLeave`

### 5.2 Role-driven destinations (don’t wander)

Each role has a “work zone preference” and a “workflow path”:

- NURSE: `BROOD_RING ↔ BROOD_CORE` (rarely elsewhere)
- BUILDER: `STORES ↔ BUILD_FRONT` (occasionally BROOD\_RING)
- PROCESSOR: `VESTIBULE/UNLOAD ↔ STORES`
- GUARD: `ENTRANCE/VESTIBULE`
- FORAGER: cycle

    - outgoing: VESTIBULE → ENTRANCE → OUTSIDE
    - incoming: OUTSIDE → ENTRANCE → VESTIBULE → UNLOAD

**Hard rule:** anything entering from OUTSIDE must pass VESTIBULE → UNLOAD before routing deeper. No direct OUTSIDE→BROOD.

### 5.3 Routing: one hop at a time with congestion penalty

Precompute shortest-path distances `dist[a][b]` on the static graph.

For a cohort with destination `dest`, from zone `z`, choose next neighbor `n` minimizing:

- `cost(n) = dist[n][dest] + kCrowd * (occ[n]/cap[n])`

This is enough to “flow around” congestion.

### 5.4 Flow resolution with constraints

You’ll have proposed flows `F[z->n][b][r]`.

Resolve in priorities to avoid deadlocks:

Priority order:

1. returning FORAGERs (OUTSIDE→…→UNLOAD pipeline)
2. NURSE
3. PROCESSOR
4. BUILDER
5. GUARD
6. others

For each directed edge:

- capacity this tick: `edgeLimit`
- allocate flows in priority order, limited by:

    - remaining `edgeLimit`
    - destination free capacity `cap[n] - occ[n]`

Update counts accordingly.

**Note:** keep `occ` updated as you allocate to prevent overfilling.

* * *

## 6) Foraging + resource pipeline (coupled to movement)

### 6.1 Forager outside cycle (dt-safe)

FORAGERs in `OUTSIDE` represent bees currently out foraging.

Per tick:

- fraction returning: `pReturn = 1 - exp(-dtHours / flightMeanHours)`
- `returning = bees[OUTSIDE][B3/B4][FORAGER] * pReturn`

Those returning must physically traverse:

- OUTSIDE → ENTRANCE → VESTIBULE → UNLOAD  
They carry nectar/pollen payload.

### 6.2 Yield model (keep it continuous)

When a returning forager reaches UNLOAD (not merely when it decides to return), add to “incoming” pools:

- `incomingNectar += deliveredForagers * nectarPerForagerPerHour * dtHours`
- `incomingPollen += deliveredForagers * pollenPerForagerPerHour * dtHours`

(You can precompute per-forager yields per hour and tune environment seasonality later.)

* * *

## 7) Processing, storage, and nursing (the constraints that make it non-toy)

### 7.1 Storage capacity is *cell-limited*

Compute:

- `emptyStorageCells` in STORES region
- `emptyBroodCells` in BROOD\_CORE/RING regions

Depositing nectar/pollen/honey requires available storage cells with free volume.

### 7.2 Processing (nectar → honey)

In UNLOAD/STORES, PROCESSOR effort converts incoming nectar into honey at a rate:

- `procCapacity = processorsEffective * procUnitsPerDay * dtDays`
- `processed = min(incomingNectar, procCapacity, storageRoomForHoney)`

Then store into cells (prefer STORES region). Keep the remainder as `incomingNectar` backlog.

### 7.3 Nursing and larval support factor (development slowdown)

Compute total larval demand per tick:

- `larvaDemand = larvaCount * larvaFeedUnitsPerDay * dtDays`

Compute effective nursing supply:

- `nurseSupply = nursesEffective * nurseFeedUnitsPerDay * dtDays`

Compute food supply limits:

- pollen available, honey/nectar available

Define a single scalar support factor for the tick:

- `support = min( nurseSupply/larvaDemand, pollenAvail/pollenNeed, energyAvail/energyNeed )`
- Clamp: `support = clamp(support, 0, 1)`

**Consume resources proportional to actual support:**

- `consumed = demanded * support`

### 7.4 Brood development slowdown (not mortality spike)

When updating brood cell ages:

- eggs advance normally (mostly time-driven)
- pupae advance normally (mostly time-driven)
- larvae advance scaled by support:

For each LARVA cell:

- `ageDays += dtDays * lerp(minLarvaRate, 1.0, support)`

    - e.g. `minLarvaRate = 0.25` (even under stress, they creep forward slowly)

If you want stronger coupling:

- if `support < 0.2`, set `minLarvaRate = 0.05`

This creates smooth “stalling” under shortages instead of sudden die-offs.

* * *

## 8) Queen laying (explicit constraints)

Per tick:

- `eggBudget = queenMaxEggsPerDay * dtDays`

Compute constraints:

- `space = countEmptyBroodCells(BROOD_CORE first, then BROOD_RING)`
- `nurseHeadroom` (optional): if `support` is already low, reduce eggBudget:

    - `eggBudget *= clamp(support + 0.2, 0, 1)` (prevents runaway starvation loops)

Actual eggs:

- `eggsLaid = min(eggBudget, space)`

Placement:

1. choose empties in BROOD\_CORE (contiguous cluster)
2. then BROOD\_RING

* * *

## 9) Comb growth (builders + frontier)

### 9.1 Frontier slots

If you have geometry:

- frontier = built cells that neighbor any unbuilt cell
- frontierSlots = number of unbuilt neighbor cells available for building

### 9.2 Build capacity

Builders in BUILD\_FRONT produce new built cells:

- `buildCapacity = buildersEffective * cellsPerBuilderPerDay * dtDays`
- `newCells = min(frontierSlots, buildCapacity, waxEnergyLimit)`

Wax/energy limit can be tied to honey/nectar intake. If you want simple:

- `waxEnergyLimit = (availableEnergy * waxConversionFactor)` or just “builders require X honey units per cell built”.

### 9.3 Region update trigger

Only recompute regions when:

- built cell count changes materially, or
- brood radius grows/shrinks

Do *not* let regions flicker every tick.

* * *

## 10) Tick order (important)

Run in this order every update:

1. **Convert dt** (`dtDays`, `dtHours`)
2. **Age-bucket shifting** (workers get older)
3. **Mortality/attrition** (age-based hazard, small background)
4. **Compute demands** (larvae, processing backlog, storage space, frontier, stores target)
5. **Role allocation** (response thresholds + eligibility + dt-stable switching)
6. **Movement proposals** (dwell hazards + role workflows + congestion-aware routing)
7. **Movement resolution** (edge throughput + zone capacity + priority order)
8. **Foraging deliveries** (count who actually reached UNLOAD; add incoming pools)
9. **Processing & storage** (processors convert/store)
10. **Nursing consumption + compute support** (resource consumption)
11. **Brood development** (larvae slowed by support)
12. **Emergence** (pupa→adult adds new workers into BROOD\_CORE as B0)
13. **Queen laying** (space + support-limited)
14. **Comb building** (builders + frontier)
15. **Sanity checks / invariants**

* * *

## 11) Age bucket shifting implementation (dt-safe and mass-conserving)

Each tick, move a fraction from bucket `i` to `i+1`:

- `f = clamp(dtDays / widthDays[i], 0, 1)` for finite-width buckets

For each zone and role:

- `move = bees[z][i][r] * f`
- `bees[z][i][r] -= move`
- `bees[z][i+1][r] += move`

For last bucket B4:

- no aging out; apply higher mortality hazard instead.

* * *

## 12) Anti-entrance bunching (explicit rules that must hold)


If these are implemented correctly, you’ll see **queueing in VESTIBULE**, not a permanent door pile.


## 13) Minimal pseudocode skeleton (no UI, just core loop)

```javascript
    resolveMoves(state, proposals, dtHours);        // throughput + zone cap + priority

    applyForagingDeliveries(state, dtHours);        // based on who reached UNLOAD
    processNectar(state, dtDays);
    const support = nurseAndComputeSupport(state, dtDays);

    developBrood(state, dtDays, support);           // larva slowed by support
    emergeAdults(state);

    queenLay(state, dtDays, support);
    buildComb(state, dtDays);

    assertInvariants(state);
}
```

## JSON config schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "HiveSimConfig.schema.json",
  "title": "HiveSimConfig",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "simulation",
    "graph",
    "ageBuckets",
    "roles",
    "eligibility",
    "dwellHours",
    "switching",
    "mortality",
    "brood",
    "queen",
    "rates",
    "foraging",
    "demandModel",
    "initial"
  ],
  "properties": {
    "version": { "type": "integer", "minimum": 1 },

    "simulation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dtMinSeconds", "dtMaxSeconds", "rngSeed"],
      "properties": {
        "dtMinSeconds": { "type": "number", "exclusiveMinimum": 0 },
        "dtMaxSeconds": { "type": "number", "exclusiveMinimum": 0 },
        "rngSeed": { "type": "integer" }
      }
    },

    "graph": {
      "type": "object",
      "additionalProperties": false,
      "required": ["zones", "edges"],
      "properties": {
        "zones": {
          "type": "array",
          "minItems": 3,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "cap"],
            "properties": {
              "id": { "type": "string" },
              "cap": { "type": "number", "minimum": 0 }
            }
          }
        },
        "edges": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["from", "to", "throughputPerHour"],
            "properties": {
              "from": { "type": "string" },
              "to": { "type": "string" },
              "throughputPerHour": { "type": "number", "minimum": 0 }
            }
          }
        }
      }
    },

    "ageBuckets": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "minDays", "maxDays"],
        "properties": {
          "id": { "type": "string" },
          "minDays": { "type": "number", "minimum": 0 },
          "maxDays": { "type": ["number", "null"], "minimum": 0 }
        }
      }
    },

    "roles": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string" }
    },

    "eligibility": {
      "description": "eligibility[bucketId][role] => weight >= 0",
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": { "type": "number", "minimum": 0 }
      }
    },

    "dwellHours": {
      "description": "dwellHours[role][zoneId] => mean dwell time in hours",
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": { "type": "number", "exclusiveMinimum": 0 }
      }
    },

    "switching": {
      "type": "object",
      "additionalProperties": false,
      "required": ["tauSwitchDays"],
      "properties": {
        "tauSwitchDays": { "type": "number", "exclusiveMinimum": 0 }
      }
    },

    "mortality": {
      "type": "object",
      "additionalProperties": false,
      "required": ["backgroundTauDays", "bucketTauDays"],
      "properties": {
        "backgroundTauDays": { "type": "number", "exclusiveMinimum": 0 },
        "bucketTauDays": {
          "description": "bucketTauDays[bucketId] => mean time to death (days) applied as hazard",
          "type": "object",
          "additionalProperties": { "type": "number", "exclusiveMinimum": 0 }
        }
      }
    },

    "brood": {
      "type": "object",
      "additionalProperties": false,
      "required": ["stageDays", "larvaMinRate"],
      "properties": {
        "stageDays": {
          "type": "object",
          "additionalProperties": false,
          "required": ["EGG", "LARVA", "PUPA"],
          "properties": {
            "EGG": { "type": "number", "exclusiveMinimum": 0 },
            "LARVA": { "type": "number", "exclusiveMinimum": 0 },
            "PUPA": { "type": "number", "exclusiveMinimum": 0 }
          }
        },
        "larvaMinRate": {
          "description": "Minimum fraction of normal larva development rate when support=0",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    },

    "queen": {
      "type": "object",
      "additionalProperties": false,
      "required": ["maxEggsPerDay", "eggBudgetSupportFloor"],
      "properties": {
        "maxEggsPerDay": { "type": "number", "minimum": 0 },
        "eggBudgetSupportFloor": {
          "description": "Egg budget multiplier floor (e.g., 0.2) when support is very low",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    },

    "rates": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "nurseFeedUnitsPerNursePerDay",
        "larvaFeedUnitsPerLarvaPerDay",
        "larvaPollenUnitsPerLarvaPerDay",
        "larvaEnergyUnitsPerLarvaPerDay",
        "procUnitsPerProcessorPerDay",
        "cellsPerBuilderPerDay"
      ],
      "properties": {
        "nurseFeedUnitsPerNursePerDay": { "type": "number", "minimum": 0 },
        "larvaFeedUnitsPerLarvaPerDay": { "type": "number", "minimum": 0 },
        "larvaPollenUnitsPerLarvaPerDay": { "type": "number", "minimum": 0 },
        "larvaEnergyUnitsPerLarvaPerDay": { "type": "number", "minimum": 0 },
        "procUnitsPerProcessorPerDay": { "type": "number", "minimum": 0 },
        "cellsPerBuilderPerDay": { "type": "number", "minimum": 0 }
      }
    },

    "foraging": {
      "type": "object",
      "additionalProperties": false,
      "required": ["flightMeanHours", "nectarUnitsPerForagerPerHour", "pollenUnitsPerForagerPerHour"],
      "properties": {
        "flightMeanHours": { "type": "number", "exclusiveMinimum": 0 },
        "nectarUnitsPerForagerPerHour": { "type": "number", "minimum": 0 },
        "pollenUnitsPerForagerPerHour": { "type": "number", "minimum": 0 }
      }
    },

    "demandModel": {
      "type": "object",
      "additionalProperties": false,
      "required": ["k", "thresholds", "targets"],
      "properties": {
        "k": { "type": "number", "exclusiveMinimum": 0 },
        "thresholds": {
          "description": "thresholds[DEMAND_NAME] => threshold value",
          "type": "object",
          "additionalProperties": { "type": "number", "minimum": 0 }
        },
        "targets": {
          "description": "Store targets (units) used in forage demand; tune to your 'unit' system",
          "type": "object",
          "additionalProperties": false,
          "required": ["honeyUnits", "pollenUnits"],
          "properties": {
            "honeyUnits": { "type": "number", "minimum": 0 },
            "pollenUnits": { "type": "number", "minimum": 0 }
          }
        }
      }
    },

    "initial": {
      "type": "object",
      "additionalProperties": false,
      "required": ["workersTotal", "builtCells", "storesUnits", "populationSeed"],
      "properties": {
        "workersTotal": { "type": "number", "minimum": 0 },
        "builtCells": { "type": "integer", "minimum": 0 },
        "storesUnits": {
          "type": "object",
          "additionalProperties": false,
          "required": ["honey", "pollen", "nectar"],
          "properties": {
            "honey": { "type": "number", "minimum": 0 },
            "pollen": { "type": "number", "minimum": 0 },
            "nectar": { "type": "number", "minimum": 0 }
          }
        },
        "populationSeed": {
          "description": "Declarative seeding rules (fractions) so you don't have to specify every zone/bucket/role cell",
          "type": "object",
          "additionalProperties": false,
          "required": ["bucketFractions", "roleFractions", "zoneFractionsByRole"],
          "properties": {
            "bucketFractions": {
              "description": "bucketFractions[bucketId] => fraction of workersTotal",
              "type": "object",
              "additionalProperties": { "type": "number", "minimum": 0 }
            },
            "roleFractions": {
              "description": "roleFractions[role] => fraction of workersTotal at start",
              "type": "object",
              "additionalProperties": { "type": "number", "minimum": 0 }
            },
            "zoneFractionsByRole": {
              "description": "zoneFractionsByRole[role][zoneId] => fraction of that role placed in that zone (should sum to 1 per role)",
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "additionalProperties": { "type": "number", "minimum": 0 }
              }
            }
          }
        }
      }
    }
  }
}
```

## Example config

```json
{
  "version": 1,

  "simulation": {
    "dtMinSeconds": 1,
    "dtMaxSeconds": 7200,
    "rngSeed": 123456
  },

  "graph": {
    "zones": [
      { "id": "OUTSIDE", "cap": 1e12 },
      { "id": "ENTRANCE", "cap": 20 },
      { "id": "VESTIBULE", "cap": 120 },
      { "id": "UNLOAD", "cap": 80 },
      { "id": "BROOD_CORE", "cap": 300 },
      { "id": "BROOD_RING", "cap": 300 },
      { "id": "STORES", "cap": 350 },
      { "id": "BUILD_FRONT", "cap": 150 }
    ],
    "edges": [
      { "from": "OUTSIDE", "to": "ENTRANCE", "throughputPerHour": 10 },
      { "from": "ENTRANCE", "to": "OUTSIDE", "throughputPerHour": 10 },

      { "from": "ENTRANCE", "to": "VESTIBULE", "throughputPerHour": 15 },
      { "from": "VESTIBULE", "to": "ENTRANCE", "throughputPerHour": 15 },

      { "from": "VESTIBULE", "to": "UNLOAD", "throughputPerHour": 20 },
      { "from": "UNLOAD", "to": "VESTIBULE", "throughputPerHour": 20 },

      { "from": "UNLOAD", "to": "STORES", "throughputPerHour": 20 },
      { "from": "STORES", "to": "UNLOAD", "throughputPerHour": 20 },

      { "from": "VESTIBULE", "to": "BROOD_RING", "throughputPerHour": 30 },
      { "from": "BROOD_RING", "to": "VESTIBULE", "throughputPerHour": 30 },

      { "from": "BROOD_RING", "to": "BROOD_CORE", "throughputPerHour": 30 },
      { "from": "BROOD_CORE", "to": "BROOD_RING", "throughputPerHour": 30 },

      { "from": "BROOD_RING", "to": "STORES", "throughputPerHour": 25 },
      { "from": "STORES", "to": "BROOD_RING", "throughputPerHour": 25 },

      { "from": "STORES", "to": "BUILD_FRONT", "throughputPerHour": 20 },
      { "from": "BUILD_FRONT", "to": "STORES", "throughputPerHour": 20 }
    ]
  },

  "ageBuckets": [
    { "id": "B0", "minDays": 0, "maxDays": 2 },
    { "id": "B1", "minDays": 2, "maxDays": 11 },
    { "id": "B2", "minDays": 11, "maxDays": 18 },
    { "id": "B3", "minDays": 18, "maxDays": 40 },
    { "id": "B4", "minDays": 40, "maxDays": null }
  ],

  "roles": ["NURSE", "BUILDER", "PROCESSOR", "GUARD", "FORAGER"],

  "eligibility": {
    "B0": { "NURSE": 0.2, "BUILDER": 0.0, "PROCESSOR": 0.1, "GUARD": 0.0, "FORAGER": 0.0 },
    "B1": { "NURSE": 1.0, "BUILDER": 0.2, "PROCESSOR": 0.5, "GUARD": 0.1, "FORAGER": 0.0 },
    "B2": { "NURSE": 0.4, "BUILDER": 1.0, "PROCESSOR": 0.8, "GUARD": 0.2, "FORAGER": 0.1 },
    "B3": { "NURSE": 0.1, "BUILDER": 0.2, "PROCESSOR": 0.3, "GUARD": 0.7, "FORAGER": 1.0 },
    "B4": { "NURSE": 0.0, "BUILDER": 0.1, "PROCESSOR": 0.1, "GUARD": 0.5, "FORAGER": 0.8 }
  },

  "dwellHours": {
    "FORAGER": {
      "OUTSIDE": 1.5,
      "ENTRANCE": 0.05,
      "VESTIBULE": 0.2,
      "UNLOAD": 0.3,
      "STORES": 0.3,
      "BROOD_RING": 0.5,
      "BROOD_CORE": 1.0,
      "BUILD_FRONT": 0.5
    },
    "NURSE": {
      "BROOD_CORE": 4,
      "BROOD_RING": 4,
      "VESTIBULE": 1,
      "UNLOAD": 1,
      "STORES": 2,
      "BUILD_FRONT": 2,
      "ENTRANCE": 0.5,
      "OUTSIDE": 10
    },
    "PROCESSOR": {
      "UNLOAD": 2,
      "STORES": 2,
      "VESTIBULE": 1,
      "BROOD_RING": 3,
      "BROOD_CORE": 6,
      "BUILD_FRONT": 3,
      "ENTRANCE": 1,
      "OUTSIDE": 10
    },
    "BUILDER": {
      "BUILD_FRONT": 4,
      "STORES": 2,
      "BROOD_RING": 3,
      "BROOD_CORE": 6,
      "UNLOAD": 2,
      "VESTIBULE": 2,
      "ENTRANCE": 1,
      "OUTSIDE": 10
    },
    "GUARD": {
      "ENTRANCE": 12,
      "VESTIBULE": 12,
      "BROOD_RING": 6,
      "BROOD_CORE": 12,
      "UNLOAD": 4,
      "STORES": 6,
      "BUILD_FRONT": 6,
      "OUTSIDE": 10
    }
  },

  "switching": { "tauSwitchDays": 0.75 },

  "mortality": {
    "backgroundTauDays": 120,
    "bucketTauDays": {
      "B4": 20
    }
  },

  "brood": {
    "stageDays": { "EGG": 3, "LARVA": 6, "PUPA": 12 },
    "larvaMinRate": 0.25
  },

  "queen": {
    "maxEggsPerDay": 250,
    "eggBudgetSupportFloor": 0.2
  },

  "rates": {
    "nurseFeedUnitsPerNursePerDay": 25,
    "larvaFeedUnitsPerLarvaPerDay": 1,
    "larvaPollenUnitsPerLarvaPerDay": 0.3,
    "larvaEnergyUnitsPerLarvaPerDay": 0.7,
    "procUnitsPerProcessorPerDay": 12,
    "cellsPerBuilderPerDay": 0.4
  },

  "foraging": {
    "flightMeanHours": 1.5,
    "nectarUnitsPerForagerPerHour": 0.6,
    "pollenUnitsPerForagerPerHour": 0.12
  },

  "demandModel": {
    "k": 2.5,
    "thresholds": {
      "NURSE": 200,
      "PROCESS": 150,
      "BUILD": 120,
      "FORAGE": 200,
      "GUARD": 50
    },
    "targets": {
      "honeyUnits": 500,
      "pollenUnits": 200
    }
  },

  "initial": {
    "workersTotal": 1200,
    "builtCells": 180,
    "storesUnits": { "honey": 180, "pollen": 60, "nectar": 40 },
    "populationSeed": {
      "bucketFractions": { "B0": 0.05, "B1": 0.30, "B2": 0.25, "B3": 0.30, "B4": 0.10 },
      "roleFractions": { "NURSE": 0.28, "PROCESSOR": 0.18, "BUILDER": 0.18, "FORAGER": 0.28, "GUARD": 0.08 },
      "zoneFractionsByRole": {
        "NURSE": { "BROOD_CORE": 0.6, "BROOD_RING": 0.4 },
        "PROCESSOR": { "UNLOAD": 0.55, "STORES": 0.35, "VESTIBULE": 0.10 },
        "BUILDER": { "BUILD_FRONT": 0.6, "STORES": 0.4 },
        "FORAGER": { "OUTSIDE": 0.7, "VESTIBULE": 0.2, "ENTRANCE": 0.1 },
        "GUARD": { "ENTRANCE": 0.6, "VESTIBULE": 0.4 }
      }
    }
  }
}
```