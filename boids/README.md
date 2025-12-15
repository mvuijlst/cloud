# 3D Boids

This is an implementation of the classic boids algorithm in 3D, with predictive obstacle avoidance and goal seeking. 

On a large rectangular playing field a number of randomly sized cylinders are placed. A flock of boids flies through the playing field. 

The boids are rendereda simple dart-like 3D objects. 

Parameters, changeable by the use at run time: 
- number of boids
- number of obstacles

The simulation is rendered in 3D, with the camera following the center of mass of the flock at a distance, and smoothed out. The camera should also avoid the obstacles. 