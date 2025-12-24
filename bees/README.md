# Hive simulation

Draw a hexagonal grid, which represents a beehive. The hive can be irregular, and has one entrance/exit. 

There are different types of bees: 
- The queen bee looks for empty cells and lay eggs in them. She needs feeding to do so. 
- Attendant bees get food from storage and feed the queen. 
- Eggs hatch into larvae after a certain time. 
- Nurse bees feed the larvae, which take a certain amount of days and feedings to hatch. 
- Forager bees leave the hive to gather food and place it in storage cells. 

As bees age, they progress through different roles before they become foragers until the end of their days.  

Use an elegant and dark colour scheme, with tints of dark yellow and brown. 
Bees are represented as small circles of different colours. Different types of cells are represented using appropriate colours. 

## Core Features

### Biological Fidelity
- Track detailed cell states: empty/egg/larva/pupa/capped brood/honey/pollen/royal jelly/vented
- Implement realistic timings and capping events for each brood stage
- Age-based worker role progression with overlap and mortality curves
- Queen egg-laying rate tied to pheromone levels, food availability, and comb space
- Temperature and humidity regulation through heater bees, fanners, and water cooling

### Foraging Mechanics
- Daily and seasonal nectar flow patterns affected by weather conditions
- Waggle-dance recruitment system that influences forager destination choices
- Variable trip times and load sizes based on source quality and distance
- Robbing pressure mechanics when colony stores are low

### Spatial Dynamics
- Thermal coupling between neighboring cells to visualize brood heat distribution
- Entrance congestion with guard bee inspection protocols
- Support for irregular comb structures and burr comb affecting bee movement paths

### Resource Management
- Separate honey and pollen storage tracking
- Nurse bee diet dependency on pollen availability
- Brood rearing throttling when pollen stores are insufficient
- Wax production costs for new cell construction
- Water budget management for cooling and feeding operations

### Colony Dynamics
- Swarming triggers based on population density and queen pheromone levels
- Inter-hive drifting for genetic diversity (multi-hive scenarios)
- Disease and Varroa mite pressure affecting brood survival rates

### Visualization Features
- Color-coded cell mapping by content and capping status
- Animated bee role representations with distinct visual markers
- Overlay systems for pheromone and temperature heatmaps
- Day/night cycle with reduced bee activity during darkness

### Interactive Controls
- Environmental sliders: weather conditions, nectar flow rates, queen quality
- Event triggers: cold snaps, nectar dearths, honey flows
- Research vs. demonstration modes with adjustable stochasticity
- Treatment application controls for colony management

## Running the p5.js prototype
- Open index.html in a modern browser; everything runs client-side with p5.js.
- Click the canvas to toggle between normal and fast time. Resizing the window recenters the hive.