import json
import math
import random
from pathlib import Path

WIDTH = 64
HEIGHT = 64
CANDIDATES_PER_STEP = 24
RANDOM_SEED = 1337


def torus_distance_squared(a, b):
    dx = abs(a[0] - b[0])
    dy = abs(a[1] - b[1])
    dx = min(dx, WIDTH - dx)
    dy = min(dy, HEIGHT - dy)
    return dx * dx + dy * dy


def generate_blue_noise_mask():
    random.seed(RANDOM_SEED)
    remaining = [(x, y) for y in range(HEIGHT) for x in range(WIDTH)]
    order_grid = [[-1 for _ in range(WIDTH)] for _ in range(HEIGHT)]
    selected = []

    for rank in range(WIDTH * HEIGHT):
        if not selected:
            pick_index = random.randrange(len(remaining))
            cell = remaining[pick_index]
        else:
            best_score = -1.0
            best_choice_index = None
            for _ in range(CANDIDATES_PER_STEP):
                candidate_index = random.randrange(len(remaining))
                candidate = remaining[candidate_index]
                score = min(
                    torus_distance_squared(candidate, prev)
                    for prev in selected
                )
                if score > best_score:
                    best_score = score
                    best_choice_index = candidate_index
            cell = remaining[best_choice_index]
            pick_index = best_choice_index

        remaining[pick_index] = remaining[-1]
        remaining.pop()
        selected.append(cell)
        cx, cy = cell
        order_grid[cy][cx] = rank

    max_rank = WIDTH * HEIGHT - 1
    scale = 255 / max_rank
    flat_values = []
    for row in order_grid:
        for value in row:
            flat_values.append(round(value * scale))

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "data": flat_values,
        "seed": RANDOM_SEED,
        "candidates": CANDIDATES_PER_STEP,
    }


def main():
    mask = generate_blue_noise_mask()
    output_path = Path(__file__).with_name("blue_noise_mask_64.json")
    output_path.write_text(json.dumps(mask, indent=2))
    print(f"Wrote mask to {output_path}")


if __name__ == "__main__":
    main()
