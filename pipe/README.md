# Pipe

A pipe-laying game. The ./images folder contains tiles in isometric pixel art. 

At the beginning of the game, a start and and end tile are place in random places on the grid (making sure the "exit" of the pipe is reachable). 

During play, three random tiles are shown. The user places the bottom of the three tiles somewhere on the playing field. The aim of the game is to connect the start tile to the end tile with an uninterrupted pipe. 

The tiles have connections in the following places:

images\cross.png: N, E, S, W
images\elbow-ne.png: N, E
images\elbow-nw.png: N, W
images\elbow-se.png: S, E
images\elbow-sw.png: S, W
images\ew.png: E, W
images\full.png: none
images\ns.png: N, S
images\start-e.png: E 
images\start-n.png: N
images\start-s.png: S
images\start-w.png: W
images\tee-e.png: N, E, S
images\tee-n.png: E, S, W
images\tee-s.png: N, E, W 
images\tee-w.png: N, S, W

Tiles are 38px wide and 29px high. Tiles overlap by 1 pixel, i.e. 
- a tile placed to the "east" is 18px to the right and 9px down
- a tile placed to the "west" is 18px to the left and 9px up
- a tile placed to the "south" is 19px to the left and 9px down
- a tile placed to the "north" is 19px to the right and 9px up

Tile must be drawn back to front. Show a 50% transparent image of the tile, snapped to its place in the frid, before placing the tile. 

# Todo

In a next phase of development, a stream of liquid will start flowing slowly at the start tile. 