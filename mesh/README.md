# mesh · mass-spring ribbon / lamella

This folder contains a deterministic 3D mass–spring simulation that records a full time×particle trajectory grid and turns it into a triangle mesh (OBJ) suitable for Blender.

## Run

From the repo root (or from `mesh/`), start a local server:

- Python: `python -m http.server`
- Node: `npx serve` (or any static server)

Then open:

- `http://localhost:8000/mesh/`

## What you get

- A high-contrast monochrome three.js preview (solid + optional rib lines).
- `Download OBJ` exports the current mesh as a single OBJ.
- A Blender script is provided at `mesh/blender_render.py`.

## Tweak parameters

Edit the constants at the top of `mesh/simulation.js`:

- `N` (ribbon width resolution)
- `T` (length resolution)
- `kStructural`, `kRandom`, `damping`, `gravity`
- `windStrength`, `windScale`, `seed`

