# Zombies

This is a a zombie simulation on a real-world map, built in javascript without server-side scripting. 

When the page loads, the user is shown their location on a map (OpenStreetMap). The player is rendered as a small red dot; they can move use the arrow keys or by clicking a location on a street (pathfinding if possible, only move in a straight line otherwise). The user can not move through buildings or water. 

A number of randomly generated 'zombies' (small grey/white dots) roams the streets, also avoiding buildings. When the player is in sight of the zombies, they flock towards the player. If the player leaves their sight, the zombies continue on a random path along the same direction. 

## How to Play

1. Open `index.html` in your web browser.
2. Allow location access if prompted (or it will default to London).
3. Wait for the map data (buildings, roads) to load.
4. **Controls**:
   - Use **Arrow Keys** to move the red dot (Player).
   - **Click** on the map to move to that location.
5. **Objective**:
   - Avoid the grey zombies.
   - They will chase you if they see you!
   - They cannot move through buildings or water.
