const config = {
    zombieCount: 50,
    zombieSpeed: 2.5, // meters per second
    playerSpeed: 10.0, // meters per second
    zombieSightRadius: 50, // meters
    spawnRadius: 500, // meters
    fetchThreshold: 300 // meters
};

let map;
let playerMarker;
let zombieMarkers = [];
let buildings = []; // Array of L.Polygon
let water = []; // Array of L.Polygon
let roads = []; // Array of coordinates for spawning
let processedIds = new Set(); // Track OSM IDs to avoid duplicates
let lastFetchPos = { lat: 0, lng: 0 };
let gameActive = false;
let lastTime = 0;

// Game State
const state = {
    player: { lat: 0, lng: 0, target: null },
    zombies: [], // { lat, lng, target: {lat, lng}, state: 'wander'|'chase' }
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
    hasReachedStreet: false
};

function init() {
    // Initialize map
    // Disable all default interactions so the player can't drag the map manually
    map = L.map('map', {
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false
    }).setView([51.505, -0.09], 16); // Default to London

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Try to get user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
            startGame(latitude, longitude);
        }, () => {
            console.log("Geolocation failed, using default.");
            startGame(51.505, -0.09);
        });
    } else {
        startGame(51.505, -0.09);
    }

    // Input listeners
    window.addEventListener('keydown', e => {
        if (state.keys.hasOwnProperty(e.code)) state.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
        if (state.keys.hasOwnProperty(e.code)) state.keys[e.code] = false;
    });

    map.on('click', e => {
        state.player.target = e.latlng;
    });
}

function startGame(lat, lng) {
    state.player.lat = lat;
    state.player.lng = lng;

    // Player is now a fixed HTML element, no Leaflet marker needed.
    // We just ensure the map is centered.
    map.setView([lat, lng], 18, { animate: false });

    document.getElementById('status').innerText = "Fetching map data...";
    fetchMapData(lat, lng);
}

async function fetchMapData(lat, lng) {
    lastFetchPos = { lat, lng };
    
    // Calculate bounds for a ~1km box around the point
    const R = 6378137;
    const d = 500; // 500m radius
    const dLat = (d / R) * (180 / Math.PI);
    const dLng = (d / (R * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

    const s = lat - dLat;
    const n = lat + dLat;
    const w = lng - dLng;
    const e = lng + dLng;

    // Increased timeout to 60s to handle busy servers
    const query = `
        [out:json][timeout:60];
        (
          way["building"](${s},${w},${n},${e});
          relation["building"](${s},${w},${n},${e});
          way["natural"="water"](${s},${w},${n},${e});
          way["highway"](${s},${w},${n},${e});
        );
        out geom;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        
        // Check for HTML error pages (like 504 Gateway Timeout rendered as HTML)
        if (text.trim().startsWith('<')) {
            throw new Error("Received HTML instead of JSON (likely server error)");
        }

        const data = JSON.parse(text);
        processMapData(data);
    } catch (err) {
        console.error("Error fetching map data:", err);
        document.getElementById('status').innerText = "Map load failed. Retrying in 3s...";
        // Retry automatically
        setTimeout(() => fetchMapData(lat, lng), 3000);
    }
}

function processMapData(data) {
    let newRoads = false;

    data.elements.forEach(el => {
        if (processedIds.has(el.id)) return;
        processedIds.add(el.id);

        if (el.type === 'way' && el.geometry) {
            const latlngs = el.geometry.map(p => [p.lat, p.lon]);
            if (el.tags.building) {
                const poly = L.polygon(latlngs, { color: '#333', fillColor: '#111', fillOpacity: 0.8, weight: 1 }).addTo(map);
                buildings.push(poly);
            } else if (el.tags.natural === 'water') {
                const poly = L.polygon(latlngs, { color: '#00f', fillColor: '#00f', fillOpacity: 0.3, weight: 0 }).addTo(map);
                water.push(poly);
            } else if (el.tags.highway) {
                roads.push(latlngs);
                newRoads = true;
            }
        } else if (el.type === 'relation' && el.members) {
            // Handle relations (multipolygons for buildings/water)
            if (el.tags.building) {
                el.members.forEach(m => {
                    if (m.type === 'way' && m.role === 'outer' && m.geometry) {
                        const latlngs = m.geometry.map(p => [p.lat, p.lon]);
                        const poly = L.polygon(latlngs, { color: '#333', fillColor: '#111', fillOpacity: 0.8, weight: 1 }).addTo(map);
                        buildings.push(poly);
                    }
                });
            } else if (el.tags.natural === 'water') {
                 el.members.forEach(m => {
                    if (m.type === 'way' && m.role === 'outer' && m.geometry) {
                        const latlngs = m.geometry.map(p => [p.lat, p.lon]);
                        const poly = L.polygon(latlngs, { color: '#00f', fillColor: '#00f', fillOpacity: 0.3, weight: 0 }).addTo(map);
                        water.push(poly);
                    }
                });
            }
        }
    });

    maintainZombies();
    if (!gameActive) {
        gameActive = true;
        document.getElementById('status').innerText = "Survive!";
        requestAnimationFrame(gameLoop);
    }
}

function maintainZombies() {
    // Remove far away zombies
    const metersPerDegLat = 111320;
    const metersPerDegLng = 40075000 * Math.cos(state.player.lat * Math.PI / 180) / 360;

    for (let i = state.zombies.length - 1; i >= 0; i--) {
        const z = state.zombies[i];
        const dLat = (z.lat - state.player.lat) * metersPerDegLat;
        const dLng = (z.lng - state.player.lng) * metersPerDegLng;
        const dist = Math.sqrt(dLat*dLat + dLng*dLng);

        if (dist > config.spawnRadius * 1.5) {
            map.removeLayer(zombieMarkers[i]);
            state.zombies.splice(i, 1);
            zombieMarkers.splice(i, 1);
        }
    }

    // Spawn new ones if needed
    while (state.zombies.length < config.zombieCount) {
        let pos;
        // Try to spawn on a road near the edge of view
        if (roads.length > 0) {
            // Pick a random road
            const road = roads[Math.floor(Math.random() * roads.length)];
            const point = road[Math.floor(Math.random() * road.length)];
            
            // Check distance to player
            const dLat = (point[0] - state.player.lat) * metersPerDegLat;
            const dLng = (point[1] - state.player.lng) * metersPerDegLng;
            const dist = Math.sqrt(dLat*dLat + dLng*dLng);

            // Only spawn if somewhat far away (don't spawn on top of player)
            if (dist > 100 && dist < config.spawnRadius) {
                pos = { lat: point[0], lng: point[1] };
            }
        }
        
        if (!pos) {
             // Fallback: random circle
             const angle = Math.random() * Math.PI * 2;
             const r = 200 + Math.random() * 200; // 200-400m away
             const dLat = r / metersPerDegLat;
             const dLng = r / metersPerDegLng;
             pos = {
                 lat: state.player.lat + Math.cos(angle) * dLat,
                 lng: state.player.lng + Math.sin(angle) * dLng
             };
        }

        state.zombies.push({
            lat: pos.lat,
            lng: pos.lng,
            target: null,
            state: 'wander',
            lastSeen: null,
            stuckTime: 0
        });

        const marker = L.circleMarker([pos.lat, pos.lng], {
            radius: 4,
            fillColor: "#ccc",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        zombieMarkers.push(marker);
    }
}

function gameLoop(timestamp) {
    if (!gameActive) return;
    try {
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (dt > 0.1) { // Cap large dt (e.g. tab switch)
            requestAnimationFrame(gameLoop);
            return;
        }

        updatePlayer(dt);
        updateZombies(dt);
    } catch (e) {
        console.error(e);
        document.getElementById('status').innerText = "Error: " + e.message;
    }

    requestAnimationFrame(gameLoop);
}

function updatePlayer(dt) {
    let moveLat = 0;
    let moveLng = 0;

    // Keyboard input
    if (state.keys.ArrowUp) moveLat += 1;
    if (state.keys.ArrowDown) moveLat -= 1;
    if (state.keys.ArrowRight) moveLng += 1;
    if (state.keys.ArrowLeft) moveLng -= 1;

    // Normalize keyboard vector
    if (moveLat !== 0 || moveLng !== 0) {
        state.player.target = null; // Cancel click target
        const len = Math.sqrt(moveLat*moveLat + moveLng*moveLng);
        moveLat /= len;
        moveLng /= len;
    } else if (state.player.target) {
        // Move towards target
        const dLat = state.player.target.lat - state.player.lat;
        const dLng = state.player.target.lng - state.player.lng;
        const dist = Math.sqrt(dLat*dLat + dLng*dLng);
        
        // Very rough approximation: 1 deg lat ~ 111000m
        // We need to convert speed (m/s) to deg/s
        // This is tricky because longitude varies. 
        // Let's use a simplified conversion factor for the current latitude.
        
        if (dist < 0.00005) {
            state.player.target = null;
        } else {
            moveLat = dLat / dist;
            moveLng = dLng / dist;
        }
    }

    if (moveLat !== 0 || moveLng !== 0) {
        const metersPerDegLat = 111320;
        const metersPerDegLng = 40075000 * Math.cos(state.player.lat * Math.PI / 180) / 360;
        
        const dLat = (moveLat * config.playerSpeed * dt) / metersPerDegLat;
        const dLng = (moveLng * config.playerSpeed * dt) / metersPerDegLng;

        const newLat = state.player.lat + dLat;
        const newLng = state.player.lng + dLng;

        // Check collision:
        // 1. Must be on street (or moving towards it if not yet there)
        // 2. Must not be in building (unless already stuck in one)
        
        const distToRoad = getDistanceToNearestRoadMeters(newLat, newLng);
        const ROAD_THRESHOLD = 15; // meters (increased slightly)

        let allowed = false;
        
        // Debug info
        const currentlyInBuilding = checkCollision(state.player.lat, state.player.lng);
        const willBeInBuilding = checkCollision(newLat, newLng);
        
        // If roads are not loaded yet, allow movement but don't lock to street
        if (roads.length === 0) {
             // Allow movement if not entering a building, OR if we are already in one (escape)
             if (currentlyInBuilding || !willBeInBuilding) {
                 allowed = true;
             }
        } else if (state.hasReachedStreet) {
            // Strict mode: must stay on street
            if (distToRoad < ROAD_THRESHOLD) {
                // If we are very close to road center, ignore building collision (bad data overlap)
                if (distToRoad < 5) {
                    allowed = true;
                } else if (!willBeInBuilding) {
                    // Otherwise, must not be in building
                    allowed = true;
                }
            }
        } else {
            // "Escape" mode:
            // If we hit a street, lock it in.
            if (distToRoad < ROAD_THRESHOLD && !willBeInBuilding) {
                state.hasReachedStreet = true;
                allowed = true;
            } else {
                // Not on street yet.
                // Allow movement, but try to prevent entering NEW buildings.
                // If we are currently in a building, we can move anywhere (to get out).
                // If we are NOT in a building, we cannot enter one.
                if (currentlyInBuilding || !willBeInBuilding) {
                    allowed = true;
                }
            }
        }

        const debugText = `Street: ${state.hasReachedStreet ? 'Yes' : 'No'} | Dist: ${Math.round(distToRoad)}m | Coll: ${willBeInBuilding ? 'Yes' : 'No'} | Move: ${allowed ? 'OK' : 'NO'}`;
        document.getElementById('status').innerText = debugText;

        if (allowed) {
            state.player.lat = newLat;
            state.player.lng = newLng;
            
            // Move map to keep player centered
            map.panTo([newLat, newLng], { animate: false });

            // Check if we need to fetch new map data
            const metersPerDegLat = 111320;
            const metersPerDegLng = 40075000 * Math.cos(state.player.lat * Math.PI / 180) / 360;
            const dLat = (state.player.lat - lastFetchPos.lat) * metersPerDegLat;
            const dLng = (state.player.lng - lastFetchPos.lng) * metersPerDegLng;
            const distFromCenter = Math.sqrt(dLat*dLat + dLng*dLng);

            if (distFromCenter > config.fetchThreshold) {
                console.log("Fetching new map data...");
                fetchMapData(state.player.lat, state.player.lng);
            }
        }
    }
}

function getDistanceToNearestRoadMeters(lat, lng) {
    if (roads.length === 0) return Infinity; // No roads loaded yet, assume far away.

    const p = { x: lat, y: lng };
    const latScale = 1;
    // Use player latitude for longitude scaling approximation
    const lngScale = Math.cos(lat * Math.PI / 180);
    let minDst2 = Infinity;

    for (const road of roads) {
        for (let i = 0; i < road.length - 1; i++) {
            const v = { x: road[i][0], y: road[i][1] };
            const w = { x: road[i+1][0], y: road[i+1][1] };
            
            const l2 = Math.pow((v.x - w.x) * latScale, 2) + Math.pow((v.y - w.y) * lngScale, 2);
            if (l2 === 0) {
                 const d2 = Math.pow((p.x - v.x) * latScale, 2) + Math.pow((p.y - v.y) * lngScale, 2);
                 if (d2 < minDst2) minDst2 = d2;
                 continue;
            }
            
            let t = ((p.x - v.x) * (w.x - v.x) * latScale*latScale + (p.y - v.y) * (w.y - v.y) * lngScale*lngScale) / l2;
            t = Math.max(0, Math.min(1, t));
            
            const projX = v.x + t * (w.x - v.x);
            const projY = v.y + t * (w.y - v.y);
            
            const d2 = Math.pow((p.x - projX) * latScale, 2) + Math.pow((p.y - projY) * lngScale, 2);
            if (d2 < minDst2) minDst2 = d2;
        }
    }
    // Convert degrees distance to meters
    // 1 degree lat is approx 111320 meters
    return Math.sqrt(minDst2) * 111320;
}

function updateZombies(dt) {
    const metersPerDegLat = 111320;
    const metersPerDegLng = 40075000 * Math.cos(state.player.lat * Math.PI / 180) / 360;

    state.zombies.forEach((zombie, index) => {
        // Distance to player
        const dLat = state.player.lat - zombie.lat;
        const dLng = state.player.lng - zombie.lng;
        const distMeters = Math.sqrt(
            Math.pow(dLat * metersPerDegLat, 2) + 
            Math.pow(dLng * metersPerDegLng, 2)
        );

        // Line of sight check (simplified: just distance for now, raycast is hard)
        // TODO: Implement raycast against buildings for "sight"
        const canSeePlayer = distMeters < config.zombieSightRadius && hasLineOfSight(zombie, state.player);

        let targetLat, targetLng;

        if (canSeePlayer) {
            zombie.state = 'chase';
            zombie.lastSeen = { lat: state.player.lat, lng: state.player.lng };
            zombie.stuckTime = 0;
            targetLat = state.player.lat;
            targetLng = state.player.lng;
        } else if (zombie.lastSeen) {
            // Go to last seen position
            zombie.state = 'investigate';
            targetLat = zombie.lastSeen.lat;
            targetLng = zombie.lastSeen.lng;
            
            // If reached last seen, forget it
            const dLastLat = zombie.lat - zombie.lastSeen.lat;
            const dLastLng = zombie.lng - zombie.lastSeen.lng;
            const distLast = Math.sqrt(dLastLat*dLastLat + dLastLng*dLastLng);
            if (distLast < 0.00005) {
                zombie.lastSeen = null;
                zombie.state = 'wander';
            }
        } else {
            zombie.state = 'wander';
            if (!zombie.target || Math.random() < 0.01) {
                // Pick new random target nearby
                zombie.target = {
                    lat: zombie.lat + (Math.random() - 0.5) * 0.002,
                    lng: zombie.lng + (Math.random() - 0.5) * 0.002
                };
            }
            targetLat = zombie.target.lat;
            targetLng = zombie.target.lng;
        }

        // Move towards target
        const dzLat = targetLat - zombie.lat;
        const dzLng = targetLng - zombie.lng;
        const distToTarget = Math.sqrt(dzLat*dzLat + dzLng*dzLng);

        if (distToTarget > 0.00001) {
            const moveLat = dzLat / distToTarget;
            const moveLng = dzLng / distToTarget;

            // Flocking: Separation
            let sepLat = 0, sepLng = 0;
            state.zombies.forEach((other, otherIdx) => {
                if (index !== otherIdx) {
                    const odLat = zombie.lat - other.lat;
                    const odLng = zombie.lng - other.lng;
                    const odDist = Math.sqrt(odLat*odLat + odLng*odLng);
                    if (odDist < 0.0001 && odDist > 0.0000001) { // Too close, but avoid div by zero
                        sepLat += odLat / odDist;
                        sepLng += odLng / odDist;
                    } else if (odDist <= 0.0000001) {
                        // Exact overlap, push in random direction
                        sepLat += (Math.random() - 0.5);
                        sepLng += (Math.random() - 0.5);
                    }
                }
            });

            const finalMoveLat = moveLat + sepLat * 1.5;
            const finalMoveLng = moveLng + sepLng * 1.5;
            
            // Normalize again
            const len = Math.sqrt(finalMoveLat*finalMoveLat + finalMoveLng*finalMoveLng);
            
            if (len > 0.000001) {
                const stepLat = (finalMoveLat / len) * config.zombieSpeed * dt / metersPerDegLat;
                const stepLng = (finalMoveLng / len) * config.zombieSpeed * dt / metersPerDegLng;

                const nextLat = zombie.lat + stepLat;
                const nextLng = zombie.lng + stepLng;

                if (!isNaN(nextLat) && !isNaN(nextLng) && !checkCollision(nextLat, nextLng)) {
                    zombie.lat = nextLat;
                    zombie.lng = nextLng;
                    zombieMarkers[index].setLatLng([nextLat, nextLng]);
                } else {
                    // Hit wall
                    if (zombie.state === 'wander') {
                        zombie.target = null;
                    } else if (zombie.state === 'chase' || zombie.state === 'investigate') {
                        // Stuck logic: if we hit a wall while chasing, maybe try to slide or pick random point
                        zombie.stuckTime += dt;
                        if (zombie.stuckTime > 1.0) {
                            // Been stuck for 1 second, force wander for a bit
                            zombie.state = 'wander';
                            zombie.target = null;
                            zombie.lastSeen = null; // Give up chase
                            zombie.stuckTime = 0;
                        }
                    }
                }
            }
        }
    });
}

function checkCollision(lat, lng) {
    const point = L.latLng(lat, lng);
    // Check buildings
    for (let b of buildings) {
        if (b.getBounds().contains(point)) {
            // Precise check
            // Ray casting algorithm for point in polygon
            // Leaflet doesn't expose a simple "contains" for polygon geometry easily without plugins
            // But we can use a simple helper
            if (isPointInPoly(point, b)) return true;
        }
    }
    // Check water
    for (let w of water) {
        if (w.getBounds().contains(point)) {
            if (isPointInPoly(point, w)) return true;
        }
    }
    return false;
}

// Ray-casting algorithm based on https://github.com/substack/point-in-polygon
function isPointInPoly(pt, poly) {
    const vs = poly.getLatLngs()[0]; // Outer ring
    const x = pt.lat, y = pt.lng;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].lat, yi = vs[i].lng;
        const xj = vs[j].lat, yj = vs[j].lng;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function hasLineOfSight(from, to) {
    // Simple raycast check: sample points along the line
    const steps = 5;
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        if (checkCollision(lat, lng)) return false;
    }
    return true;
}

init();
