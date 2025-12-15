import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Configuration
const defaultConfig = {
    configVersion: 3, // Increment to force update defaults
    boidCount: 200,
    obstacleCount: 20,
    perceptionRadius: 50,
    separationDistance: 20,
    maxSpeed: 6,
    maxForce: 0.2,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    separationWeight: 2.0,
    obstacleAvoidanceWeight: 5.0,
    goalSeekingWeight: 3.0,
    fieldSize: 800,
    obstacleRadiusMin: 5,
    obstacleRadiusMax: 15,
    obstacleWidth: 20, // Average width of obstacles
    obstacleHeight: 300, // Higher field
    targetCreationInterval: 5,
    noiseScale: 150,
    noiseHeight: 60,
    visionRadius: 200, // Range at which boids can see food
    fixedCamera: false,
    fogNear: 1000,
    fogFar: 2000,
    fogColor: 0x000000
};

// Load from local storage or use default
let config = { ...defaultConfig };
const savedConfig = localStorage.getItem('boidsConfig');
if (savedConfig) {
    try {
        const parsed = JSON.parse(savedConfig);
        // If config version is old or missing, we might want to enforce new defaults for weights
        if (!parsed.configVersion || parsed.configVersion < defaultConfig.configVersion) {
            console.log("Updating config to new version");
            // Merge saved config but override weights with new defaults
            config = { 
                ...parsed, 
                maxSpeed: defaultConfig.maxSpeed,
                maxForce: defaultConfig.maxForce,
                goalSeekingWeight: defaultConfig.goalSeekingWeight,
                separationWeight: defaultConfig.separationWeight,
                configVersion: defaultConfig.configVersion
            };
        } else {
            config = { ...config, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load config", e);
    }
}

function saveConfig() {
    localStorage.setItem('boidsConfig', JSON.stringify(config));
}

let scene, camera, renderer, controls;
let boids = [];
let obstacles = [];
let targets = []; // Array of { mesh, scale }
let lastTargetCreation = 0;
let clock = new THREE.Clock();
let simplex = new SimplexNoise();
let groundMesh;

function getTerrainHeight(x, z) {
    return (simplex.noise(x / config.noiseScale, z / config.noiseScale) * 0.5 + 0.5) * config.noiseHeight;
}

function updateGround() {
    if (groundMesh) {
        scene.remove(groundMesh);
        groundMesh.geometry.dispose();
        groundMesh.material.dispose();
    }

    const segments = 100;
    const geometry = new THREE.PlaneGeometry(config.fieldSize * 2, config.fieldSize * 2, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttribute = geometry.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
        const x = posAttribute.getX(i);
        const z = posAttribute.getZ(i);
        // In PlaneGeometry rotated X -90, y is up, but vertices are created in XY plane then rotated.
        // Actually, after rotation, the original Z becomes Y (up), and Y becomes -Z.
        // Let's just use the world coordinates.
        // PlaneGeometry(width, height) creates on XY plane.
        // Vertices are (x, y, 0).
        // Rotate -90 X -> (x, 0, y) roughly.
        // So we should modify the "height" component which is now Y.
        // But wait, if I modify Y after rotation, it works.
        // Or I can modify Z before rotation.
        // Let's modify Y directly on the rotated geometry? No, easier to modify Z before rotation or Y after.
        // Let's assume we modify the attribute directly.
        // The attribute is just a buffer.
        // If I rotate the mesh, the local Y is the world Y? No.
        // If I rotate geometry, the vertices are transformed.
        // So posAttribute.getY(i) is the world Y.
        
        // Wait, PlaneGeometry is created on XY plane. Z is 0.
        // rotateX(-PI/2) makes it XZ plane. Y is 0.
        // So getX is x, getY is z (in world), getZ is -y (in world)?
        // Let's just use a heightmap function that takes x, z.
        
        // Let's re-read coordinates.
        // geometry.rotateX(-Math.PI / 2);
        // Now the plane is flat on XZ.
        // The 'y' coordinate of the vertex is the height.
        
        const y = getTerrainHeight(x, -z); // z is inverted? doesn't matter for noise
        posAttribute.setY(i, y);
    }
    
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({ 
        color: 0xcccccc, 
        wireframe: true 
    });
    
    groundMesh = new THREE.Mesh(geometry, material);
    scene.add(groundMesh);
}

// Boid Class
class Boid {
    constructor() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * config.fieldSize,
            (Math.random() - 0.5) * config.obstacleHeight, // Start somewhat near the ground/center height
            (Math.random() - 0.5) * config.fieldSize
        );
        this.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(config.maxSpeed);
        this.acceleration = new THREE.Vector3();
        
        // Geometry for the boid (dart-like)
        const geometry = new THREE.ConeGeometry(2, 8, 8);
        geometry.rotateX(Math.PI / 2); // Point along Z axis
        geometry.scale(1.5, 0.25, 1.0); // Flatten longitudinally
        
        // Create a group to hold solid and wireframe meshes
        this.mesh = new THREE.Group();
        
        // Solid black mesh to occlude background lines
        const solidMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        const solidMesh = new THREE.Mesh(geometry, solidMaterial);
        this.mesh.add(solidMesh);

        // Wireframe mesh for outlines
        const wireframeGeometry = new THREE.EdgesGeometry(geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc });
        const wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        this.mesh.add(wireframeMesh);

        this.mesh.position.copy(this.position);
        scene.add(this.mesh);

        // Wander state
        this.wanderTarget = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
    }

    update() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.clampLength(0, config.maxSpeed);
        
        this.mesh.position.copy(this.position);
        
        // Smoothly orient boid to face velocity
        if (this.velocity.lengthSq() > 0.1) {
            const targetPos = this.position.clone().add(this.velocity);
            const dummy = new THREE.Object3D();
            dummy.position.copy(this.position);
            dummy.lookAt(targetPos);
            this.mesh.quaternion.slerp(dummy.quaternion, 0.1);
        }

        this.acceleration.set(0, 0, 0);
    }

    checkBoundaries() {
        const halfSize = config.fieldSize / 2;
        const margin = 50;
        let desired = null;

        if (this.position.x < -halfSize + margin) desired = new THREE.Vector3(config.maxSpeed, this.velocity.y, this.velocity.z);
        else if (this.position.x > halfSize - margin) desired = new THREE.Vector3(-config.maxSpeed, this.velocity.y, this.velocity.z);

        if (this.position.z < -halfSize + margin) desired = new THREE.Vector3(this.velocity.x, this.velocity.y, config.maxSpeed);
        else if (this.position.z > halfSize - margin) desired = new THREE.Vector3(this.velocity.x, this.velocity.y, -config.maxSpeed);

        // Check terrain height
        const terrainH = getTerrainHeight(this.position.x, this.position.z);
        if (this.position.y < terrainH + margin) desired = new THREE.Vector3(this.velocity.x, config.maxSpeed, this.velocity.z);
        else if (this.position.y > config.obstacleHeight * 2 - margin) desired = new THREE.Vector3(this.velocity.x, -config.maxSpeed, this.velocity.z);

        if (desired) {
            desired.normalize().multiplyScalar(config.maxSpeed);
            let steer = new THREE.Vector3().subVectors(desired, this.velocity);
            steer.clampLength(0, config.maxForce);
            return steer;
        }
        return new THREE.Vector3();
    }

    flock(boids, obstacles) {
        let alignment = new THREE.Vector3();
        let cohesion = new THREE.Vector3();
        let separation = new THREE.Vector3();
        let obstacleAvoidance = new THREE.Vector3();
        let boundaryAvoidance = new THREE.Vector3();
        let total = 0;

        for (let other of boids) {
            if (other === this) continue;
            
            let d = this.position.distanceTo(other.position);
            
            if (d < config.perceptionRadius && d > 0) {
                alignment.add(other.velocity);
                cohesion.add(other.position);
                
                if (d < config.separationDistance) {
                    let diff = new THREE.Vector3().subVectors(this.position, other.position);
                    diff.normalize();
                    diff.divideScalar(d); // Weight by distance
                    separation.add(diff);
                }
                total++;
            }
        }

        if (total > 0) {
            alignment.divideScalar(total);
            alignment.setLength(config.maxSpeed);
            alignment.sub(this.velocity);
            alignment.clampLength(0, config.maxForce);

            cohesion.divideScalar(total);
            cohesion.sub(this.position);
            cohesion.setLength(config.maxSpeed);
            cohesion.sub(this.velocity);
            cohesion.clampLength(0, config.maxForce);

            separation.divideScalar(total);
            separation.setLength(config.maxSpeed);
            separation.sub(this.velocity);
            separation.clampLength(0, config.maxForce);
        }

        // Obstacle Avoidance
        obstacleAvoidance = this.avoidObstacles(obstacles);

        // Boundary Avoidance
        boundaryAvoidance = this.checkBoundaries();

        // Goal Seeking
        let goalSeek = new THREE.Vector3();
        
        // Find closest visible target
        let closestTarget = null;
        let closestDist = Infinity;
        
        for (let t of targets) {
            const d = this.position.distanceTo(t.mesh.position);
            if (d < config.visionRadius && d < closestDist) { // Only see if within vision radius
                closestDist = d;
                closestTarget = t;
            }
        }

        if (closestTarget) {
            goalSeek = this.seek(closestTarget.mesh.position, true); // Use arrival behavior
        } else {
            // Wander randomly if no food is visible
             goalSeek = this.wander();
             goalSeek.multiplyScalar(0.5); // Lower weight than food
        }

        alignment.multiplyScalar(config.alignmentWeight);
        cohesion.multiplyScalar(config.cohesionWeight);
        separation.multiplyScalar(config.separationWeight);
        obstacleAvoidance.multiplyScalar(config.obstacleAvoidanceWeight);
        boundaryAvoidance.multiplyScalar(config.obstacleAvoidanceWeight); // Use same weight as obstacles
        goalSeek.multiplyScalar(config.goalSeekingWeight);

        this.acceleration.add(alignment);
        this.acceleration.add(cohesion);
        this.acceleration.add(separation);
        this.acceleration.add(obstacleAvoidance);
        this.acceleration.add(boundaryAvoidance);
        this.acceleration.add(goalSeek);
    }

    wander() {
        const wanderRadius = 20;
        const wanderDistance = 80;
        const wanderJitter = 1.0;

        this.wanderTarget.add(new THREE.Vector3(
            (Math.random() - 0.5) * wanderJitter,
            (Math.random() - 0.5) * wanderJitter,
            (Math.random() - 0.5) * wanderJitter
        ));
        
        this.wanderTarget.normalize().multiplyScalar(wanderRadius);
        
        const forward = this.velocity.clone().normalize().multiplyScalar(wanderDistance);
        const desired = new THREE.Vector3().addVectors(forward, this.wanderTarget);
        
        desired.normalize().multiplyScalar(config.maxSpeed);
        
        const steer = new THREE.Vector3().subVectors(desired, this.velocity);
        steer.clampLength(0, config.maxForce);
        return steer;
    }

    seek(target, arrival = false) {
        let desired = new THREE.Vector3().subVectors(target, this.position);
        let dist = desired.length();
        
        if (arrival && dist < 100) {
            // Maintain minimum speed to push through separation forces
            let speed = THREE.MathUtils.mapLinear(dist, 0, 100, config.maxSpeed * 0.5, config.maxSpeed);
            desired.setLength(speed);
        } else {
            desired.setLength(config.maxSpeed);
        }

        let steer = new THREE.Vector3().subVectors(desired, this.velocity);
        steer.clampLength(0, config.maxForce);
        return steer;
    }

    avoidObstacles(obstacles) {
        let steer = new THREE.Vector3();
        // Predictive avoidance
        // Look ahead vector
        const lookAhead = this.velocity.clone().normalize().multiplyScalar(config.perceptionRadius);
        const rayStart = this.position;
        const rayEnd = new THREE.Vector3().addVectors(this.position, lookAhead);

        // Find closest obstacle that intersects with the "feeler"
        let closestObstacle = null;
        let closestDist = Infinity;

        for (let obs of obstacles) {
            // Simple cylinder check: distance from line segment (ray) to cylinder axis (vertical line at obs.position)
            // We project everything to 2D (XZ plane) for the cylinder check since they are vertical
            
            const obsPos2D = new THREE.Vector2(obs.position.x, obs.position.z);
            const start2D = new THREE.Vector2(rayStart.x, rayStart.z);
            const end2D = new THREE.Vector2(rayEnd.x, rayEnd.z);
            const rayDir2D = new THREE.Vector2().subVectors(end2D, start2D).normalize();
            
            // Vector from start to obstacle center
            const toObs = new THREE.Vector2().subVectors(obsPos2D, start2D);
            
            // Project toObs onto ray direction
            const projection = toObs.dot(rayDir2D);
            
            // Closest point on the infinite line
            let closestPointOnLine;
            if (projection < 0) {
                closestPointOnLine = start2D; // Behind us
            } else if (projection > config.perceptionRadius) {
                closestPointOnLine = end2D; // Too far
            } else {
                closestPointOnLine = new THREE.Vector2().addVectors(start2D, rayDir2D.clone().multiplyScalar(projection));
            }

            const distToAxis = closestPointOnLine.distanceTo(obsPos2D);
            
            // Check if within radius + buffer
            if (distToAxis < obs.radius + 5) {
                // Also check height overlap
                if (this.position.y > obs.yMin - 5 && this.position.y < obs.yMax + 5) {
                    const d = this.position.distanceTo(obs.position);
                    if (d < closestDist) {
                        closestDist = d;
                        closestObstacle = obs;
                    }
                }
            }
        }

        if (closestObstacle) {
            // Steer away from the obstacle center
            // We want a lateral force relative to our velocity
            const away = new THREE.Vector3().subVectors(this.position, closestObstacle.position);
            // Keep y component small to prefer steering around rather than over, unless very low?
            // Actually, steering away in 3D is fine.
            away.normalize();
            away.multiplyScalar(config.maxSpeed);
            steer.subVectors(away, this.velocity);
            steer.clampLength(0, config.maxForce * 2); // Stronger force for avoidance
        }

        return steer;
    }
}

function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.fogColor);
    scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 200, 400);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 50;
    controls.maxDistance = 1000;

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.6);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Ground
    updateGround();

    // Init Simulation
    initBoids();
    initObstacles();
    initTargets();
    initGUI();

    // Events
    window.addEventListener('resize', onWindowResize);
}

function initTargets() {
    // Clear existing
    for (let t of targets) {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
    }
    targets = [];
    createTarget(); // Start with one
}

function createTarget() {
    const geometry = new THREE.SphereGeometry(3, 8, 8); // Smaller, lower poly
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    
    let position = new THREE.Vector3();
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 20) {
        const margin = 60; // Keep targets well away from boundaries
        const maxY = (config.obstacleHeight * 2) - margin;
        
        position.set(
            (Math.random() - 0.5) * (config.fieldSize - margin * 2),
            margin + Math.random() * (maxY - margin),
            (Math.random() - 0.5) * (config.fieldSize - margin * 2)
        );

        valid = true;
        // Check against obstacles
        for (let obs of obstacles) {
            const distXZ = new THREE.Vector2(position.x, position.z).distanceTo(new THREE.Vector2(obs.position.x, obs.position.z));
            if (distXZ < obs.radius + 10) { // Buffer
                if (position.y > obs.yMin - 5 && position.y < obs.yMax + 5) {
                    valid = false;
                    break;
                }
            }
        }
        attempts++;
    }

    mesh.position.copy(position);
    scene.add(mesh);
    
    targets.push({
        mesh: mesh,
        scale: 1.0
    });
}

function initBoids() {
    // Clear existing
    for (let b of boids) {
        scene.remove(b.mesh);
        // Dispose of geometries and materials in the group
        b.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    boids = [];

    for (let i = 0; i < config.boidCount; i++) {
        boids.push(new Boid());
    }
}

function initObstacles() {
    // Clear existing
    for (let o of obstacles) {
        scene.remove(o.mesh);
        o.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    obstacles = [];

    for (let i = 0; i < config.obstacleCount; i++) {
        // Use obstacleWidth with some variation (+/- 25%)
        const size = config.obstacleWidth * (0.75 + Math.random() * 0.5);
        
        // Random position first to get terrain height
        const x = (Math.random() - 0.5) * config.fieldSize;
        const z = (Math.random() - 0.5) * config.fieldSize;
        const terrainH = getTerrainHeight(x, z);
        
        // Floor only - simple stretched cubes
        const height = config.obstacleHeight * (0.5 + Math.random() * 1.0);
        const posY = terrainH + height / 2;
        const yMin = terrainH;
        const yMax = terrainH + height;
        
        const geometry = new THREE.BoxGeometry(size, height, size);
        
        // Group for hidden line effect
        const group = new THREE.Group();
        
        // Solid black mesh
        const solidMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        const solidMesh = new THREE.Mesh(geometry, solidMaterial);
        group.add(solidMesh);

        // Wireframe mesh
        const wireframeGeometry = new THREE.EdgesGeometry(geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc });
        const wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        group.add(wireframeMesh);
        
        group.position.set(x, posY, z);
        
        // Shadow casting/receiving might be weird with black objects, but let's keep it enabled on the solid mesh
        solidMesh.castShadow = true;
        solidMesh.receiveShadow = true;
        
        scene.add(group);

        obstacles.push({
            mesh: group,
            position: group.position,
            radius: size * 0.7, // Approximate radius for collision (diagonal is size * sqrt(2) / 2 ~= size * 0.7)
            height: height,
            yMin: yMin,
            yMax: yMax
        });
    }
}

function initGUI() {
    const gui = new GUI();
    gui.onChange(saveConfig); // Save on any change
    
    const simFolder = gui.addFolder('Simulation');
    simFolder.add(config, 'boidCount', 10, 500, 1).onFinishChange(initBoids);
    simFolder.add(config, 'obstacleCount', 0, 50, 1).onFinishChange(() => {
        initObstacles();
        initBoids(); // Reset boids to avoid trapping
    });
    simFolder.add(config, 'obstacleWidth', 5, 100).name('Obstacle Width').onFinishChange(() => {
        initObstacles();
    });
    simFolder.add(config, 'fixedCamera').name('Fixed Camera');
    
    const boidFolder = gui.addFolder('Boid Behavior');
    boidFolder.add(config, 'maxSpeed', 1, 10);
    boidFolder.add(config, 'maxForce', 0.01, 0.5);
    boidFolder.add(config, 'perceptionRadius', 10, 100);
    boidFolder.add(config, 'visionRadius', 50, 500).name('Vision Radius');
    boidFolder.add(config, 'separationDistance', 10, 50);
    
    const weightsFolder = gui.addFolder('Weights');
    weightsFolder.add(config, 'alignmentWeight', 0, 5);
    weightsFolder.add(config, 'cohesionWeight', 0, 5);
    weightsFolder.add(config, 'separationWeight', 0, 5);
    weightsFolder.add(config, 'obstacleAvoidanceWeight', 0, 10);
    weightsFolder.add(config, 'goalSeekingWeight', 0, 5);
    
    const targetFolder = gui.addFolder('Target');
    targetFolder.add(config, 'targetCreationInterval', 1, 20).name('Creation Interval (s)');

    const terrainFolder = gui.addFolder('Terrain');
    terrainFolder.add(config, 'noiseScale', 50, 500).onChange(() => {
        updateGround();
        initObstacles(); // Regenerate obstacles to match new terrain
    });
    terrainFolder.add(config, 'noiseHeight', 0, 200).onChange(() => {
        updateGround();
        initObstacles();
    });

    const fogFolder = gui.addFolder('Fog');
    fogFolder.add(config, 'fogNear', 0, 1000).onChange(() => {
        scene.fog.near = config.fogNear;
    });
    fogFolder.add(config, 'fogFar', 100, 2000).onChange(() => {
        scene.fog.far = config.fogFar;
    });
    fogFolder.addColor(config, 'fogColor').onChange(() => {
        scene.fog.color.setHex(config.fogColor);
        scene.background.setHex(config.fogColor);
    });

    gui.add({ reset: () => {
        localStorage.removeItem('boidsConfig');
        location.reload();
    }}, 'reset').name('Reset to Defaults');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCamera() {
    if (boids.length === 0) return;

    if (config.fixedCamera) {
        controls.update();
        return;
    }

    // Calculate bounding box of the flock
    const box = new THREE.Box3();
    for (let b of boids) {
        box.expandByPoint(b.position);
    }
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = box.getSize(new THREE.Vector3()).length();

    // Smoothly follow the flock center
    const oldTarget = controls.target.clone();
    controls.target.lerp(center, 0.1);
    
    // Calculate desired distance to fit the flock
    // Fit the bounding sphere (radius ~ size/2) within the FOV
    const fov = camera.fov * (Math.PI / 180);
    let desiredDistance = (size * 0.5) / Math.tan(fov / 2);
    desiredDistance *= 1.5; // Padding factor
    
    // Clamp distance
    desiredDistance = Math.max(desiredDistance, 100);
    desiredDistance = Math.min(desiredDistance, 1500);

    // Current offset from target
    const offset = new THREE.Vector3().subVectors(camera.position, oldTarget);
    const currentDistance = offset.length();
    
    // Smoothly interpolate distance
    const newDistance = THREE.MathUtils.lerp(currentDistance, desiredDistance, 0.05);
    
    // Apply new distance while preserving direction
    offset.normalize().multiplyScalar(newDistance);
    camera.position.copy(controls.target).add(offset);
    
    // Ensure camera doesn't clip into obstacles (simple check)
    for (let obs of obstacles) {
        const dist = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(obs.position.x, obs.position.z));
        if (dist < obs.radius + 5 && camera.position.y < obs.height) {
            // Push camera up or away
            camera.position.y = Math.max(camera.position.y, obs.height + 10);
        }
    }

    controls.update();
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const now = clock.getElapsedTime();

    // Create new targets
    if (now - lastTargetCreation > config.targetCreationInterval) {
        createTarget();
        lastTargetCreation = now;
    }

    // Update targets (eating and shrinking)
    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        let eaten = false;
        
        // Check if any boid is close enough to eat
        for (let b of boids) {
            if (b.position.distanceTo(t.mesh.position) < 25) { // Increased eating radius to prevent bunching
                t.scale -= delta * 2;
                if (t.scale <= 0) {
                    eaten = true;
                    break;
                }
            }
        }
        
        if (t.scale < 1.0) {
            t.mesh.scale.setScalar(Math.max(0, t.scale));
        }
        
        if (eaten) {
            scene.remove(t.mesh);
            t.mesh.geometry.dispose();
            t.mesh.material.dispose();
            targets.splice(i, 1);
        }
    }

    // Update Boids
    for (let b of boids) {
        b.flock(boids, obstacles);
        b.update();
    }

    updateCamera();
    renderer.render(scene, camera);
}

init();
animate();
