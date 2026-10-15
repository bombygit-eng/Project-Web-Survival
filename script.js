// ===== SETUP: CANVAS & DOM =====
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const healthDisplay = document.getElementById("health");
const scoreDisplay = document.getElementById("score");
context.imageSmoothingEnabled = false;


// ===== CONSTANTS =====
// Canvas dimensions (must come before anything that uses them)
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Arena colors
const ARENA_COLOR = "#5b6b63";
const GRID_COLOR = "#6a7b72";

// Gameplay settings
const SPAWN_MARGIN = 20;
const SPAWN_INTERVAL = 1.5;
const PLAYER_IMMUNITY_TIME = 0.5;

// Bullet settings
const BULLET_SPEED = 500;      // px per second
const BULLET_RADIUS = 5;
const FIRE_COOLDOWN = 2;    // seconds between shots while holding

// Animation settings
const ANIMATION_FPS = 8;   // frames per second of the animation


// ===== GAME STATE =====
// Game state
const game = {
    running: true,
    score: 0,
    health: 3
};

//Player appearence
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    width: 32,
    height: 32,
    speed: 220,   // pixels per second
    immunityTimer: 0,    // counts down to 0; the player can't be hurt while > 0
    animTime: 0,
    facing: 1        // 1 = facing right, -1 = facing left
};

// Enemies
const enemies = [];
let spawnTimer = 0;

//Bullets
const bullets = [];
let fireTimer = 0;


// ===== ASSETS & ANIMATION =====
const playerImage = new Image();
const enemyImage = new Image();

enemyImage.src = "assets/Enemies/Enemy1/fly01.png";
playerImage.src = "assets/Player/slice01_.png";

// Load a list of image files and return the Image objects, in order
function loadFrames(paths) {
    return paths.map((path) => {
        const image = new Image();
        image.src = path;
        return image;
    });
}

const playerFrames = loadFrames([
    "assets/Player/slice01_.png",
    "assets/Player/slice02_.png",    
    "assets/Player/slice03_.png",
    "assets/Player/slice04_.png",
    "assets/Player/slice05_.png",
    "assets/Player/slice06_.png",
    "assets/Player/slice07_.png",
    "assets/Player/slice08_.png"
]);

const enemyFrames = loadFrames([
    "assets/Enemies/Enemy1/fly01.png",
    "assets/Enemies/Enemy1/fly02.png",   
    "assets/Enemies/Enemy1/fly03.png",
    "assets/Enemies/Enemy1/fly04.png",
    "assets/Enemies/Enemy1/fly05.png",
    "assets/Enemies/Enemy1/fly06.png",
    "assets/Enemies/Enemy1/fly07.png"

]);

// Pick the frame for a given animation time (in seconds)
function getFrame(frames, time) {
    return frames[Math.floor(time * ANIMATION_FPS) % frames.length];
}


// ===== AUDIO =====
let audioContext = null;
let muted = false;

// Browsers block audio until the user interacts with the page,
// so we create/resume the context on the first input.
function unlockAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("pointerup", unlockAudio);   // some mobile browsers only count the release as a "gesture"
window.addEventListener("keydown", unlockAudio);

// Plays a tone that slides from one pitch to another while fading out
function playTone({ type, from, to, duration, volume }) {
    if (muted || !audioContext || audioContext.state !== "running") return;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
}

function playShootSound() {
    playTone({ type: "square", from: 880, to: 220, duration: 0.08, volume: 0.04 });
}

function playEnemyDeathSound() {
    playTone({ type: "sawtooth", from: 300, to: 60, duration: 0.18, volume: 0.08 });
}

function playHurtSound() {
    playTone({ type: "triangle", from: 220, to: 70, duration: 0.25, volume: 0.15 });
}


// ===== INPUT: KEYBOARD, MOUSE & TOUCH =====
// Currently pressed keys
const keys = {};
const mouse = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, down: false };
const aim = { x: 1, y: 0, firing: false };
const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function createJoystick(base) {
    const knob = base.querySelector(".joystick-knob");
    const stick = { x: 0, y: 0, active: false };
    let activePointer = null;   // which finger owns this stick

    function updateFromPointer(event) {
        const rect = base.getBoundingClientRect(); 
        const radius = rect.width / 2;
        const maxDistance = radius - knob.offsetWidth / 2;   // how far the knob can travel

        let dx = event.clientX - (rect.left + radius);
        let dy = event.clientY - (rect.top + radius);

        // Clamp the knob to the edge of the base
        const distance = Math.hypot(dx, dy);
        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // Small dead zone so a resting thumb doesn't count as input
        if (Math.hypot(dx, dy) < maxDistance * 0.15) {
            stick.x = 0;
            stick.y = 0;
        } else {
            stick.x = dx / maxDistance;
            stick.y = dy / maxDistance;
        }
    }

    function release() {
        activePointer = null;
        stick.active = false;
        stick.x = 0;
        stick.y = 0;
        knob.style.transform = "translate(-50%, -50%)";
    }

    base.addEventListener("pointerdown", (event) => {
        if (activePointer !== null) return;   // already held by another finger
        event.preventDefault();
        activePointer = event.pointerId;
        base.setPointerCapture(event.pointerId);   // keep getting events even if the finger leaves the circle
        stick.active = true;
        updateFromPointer(event);
    });

    base.addEventListener("pointermove", (event) => {
        if (event.pointerId === activePointer) updateFromPointer(event);
    });

    base.addEventListener("pointerup", (event) => {
        if (event.pointerId === activePointer) release();
    });

    base.addEventListener("pointercancel", (event) => {
        if (event.pointerId === activePointer) release();
    });

    return stick;
}

const moveStick = createJoystick(document.getElementById("moveStick"));
const aimStick = createJoystick(document.getElementById("aimStick"));

window.addEventListener("keydown", (event) => {
    keys[event.code] = true;

    // Stop arrow keys / space from scrolling the page
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
});

// If the window loses focus, release everything so the player doesn't keep drifting
window.addEventListener("blur", () => {
    for (const code in keys) keys[code] = false;
    mouse.down = false;
});

window.addEventListener("mousemove", (event) => {
    mouse.seen = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) mouse.down = true;   // left button
});

window.addEventListener("mouseup", (event) => {
    if (event.button === 0) mouse.down = false;
});

function updateAim() {
    const stickTilted = aimStick.x !== 0 || aimStick.y !== 0;

    if (stickTilted) {
        // Right joystick: aim where it points, and fire automatically
        const length = Math.hypot(aimStick.x, aimStick.y);
        aim.x = aimStick.x / length;
        aim.y = aimStick.y / length;
        aim.firing = true;
    } else if (mouse.seen) {
        // Mouse: aim at the cursor, fire while the button is held
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0) {
            aim.x = dx / distance;
            aim.y = dy / distance;
        }
        aim.firing = mouse.down;
    } else {
        aim.firing = false;
    }
}


// ===== ENEMIES =====
function createEnemy(x, y) {
    return {
        x: x,
        y: y,
        width: 28,
        height: 28,
        speed: 90,        // slower than the player (220) so you can escape
        color: "#f04f4f",
        animTime: Math.random() * 10,   // random start so enemies don't flap in sync
        facing: 1
    };
}

// Spawn enemies inside or outside arena borders
function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);   // 0=top, 1=right, 2=bottom, 3=left
    // Random offset from -MARGIN (inside) to +MARGIN (outside)
    const offset = (Math.random() * 2 - 1) * SPAWN_MARGIN;

    let x, y;

    if (side === 0) {            // top
        x = Math.random() * GAME_WIDTH;
        y = -offset;
    } else if (side === 1) {     // right
        x = GAME_WIDTH + offset;
        y = Math.random() * GAME_HEIGHT;
    } else if (side === 2) {     // bottom
        x = Math.random() * GAME_WIDTH;
        y = GAME_HEIGHT + offset;
    } else {                     // left
        x = -offset;
        y = Math.random() * GAME_HEIGHT;
    }

    enemies.push(createEnemy(x, y));
}

function updateSpawning(dt) {
    spawnTimer += dt;

    while (spawnTimer >= SPAWN_INTERVAL) {
        spawnTimer -= SPAWN_INTERVAL;
        spawnEnemy();
    }
}

function updateEnemies(dt) {
    for (const enemy of enemies) {
        const distanceX = player.x - enemy.x;
        const distanceY = player.y - enemy.y;
        const distance = Math.hypot(distanceX, distanceY);
        enemy.animTime += dt;
        enemy.facing = player.x < enemy.x ? -1 : 1;

        // Avoid dividing by zero if the enemy is exactly on the player
        if (distance > 0) {
            enemy.x += (distanceX / distance) * enemy.speed * dt;
            enemy.y += (distanceY / distance) * enemy.speed * dt;
        }
    }
}


// ===== COLLISIONS & PLAYER DAMAGE =====
function isColliding(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
           Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

function updatePlayerCollisions(dt) {
    // Tick the immunity timer down
    if (player.immunityTimer > 0) {
        player.immunityTimer = Math.max(0, player.immunityTimer - dt);
        return;   // immune: skip the hit check
    }

    for (const enemy of enemies) {
        if (isColliding(player, enemy)) {
            damagePlayer();
            break;   // one hit per check, even if several enemies overlap
        }
    }
}

function damagePlayer() {
    game.health -= 1;
    player.immunityTimer = PLAYER_IMMUNITY_TIME;
    playHurtSound();
    updateHealthDisplay();
}

function updateHealthDisplay() {
    // One heart per remaining health point
    healthDisplay.textContent = game.health > 0
        ? Array(game.health).fill("❤️").join(" ")
        : "💀";
}


// ===== SHOOTING & SCORE =====
function shoot() {
    bullets.push({
        x: player.x,
        y: player.y,
        vx: aim.x * BULLET_SPEED,
        vy: aim.y * BULLET_SPEED,
        radius: BULLET_RADIUS
    });
    playShootSound();
}

function updateShooting(dt) {
    fireTimer = Math.max(0, fireTimer - dt);

    if (aim.firing && fireTimer === 0) {
        shoot();
        fireTimer = FIRE_COOLDOWN;
    }
}

function updateBullets(dt) {
    // Loop backwards so removing items doesn't skip any
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        // Remove bullets that left the arena
        if (bullet.x < 0 || bullet.x > GAME_WIDTH ||
            bullet.y < 0 || bullet.y > GAME_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }

        // Check against every enemy
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            if (Math.abs(bullet.x - enemy.x) < enemy.width / 2 + bullet.radius &&
                Math.abs(bullet.y - enemy.y) < enemy.height / 2 + bullet.radius) {

                enemies.splice(j, 1);
                bullets.splice(i, 1);
                addScore(Math.floor(Math.random() * 10) + 1);   // 1 to 10
                playEnemyDeathSound();
                break;   // this bullet is gone, stop checking it
            }
        }
    }
}

function addScore(points) {
    game.score += points;
    scoreDisplay.textContent = game.score;
}


// ===== MAIN UPDATE =====
// Update game logic (dt = deltaTime)
function update(dt) {

    updateAim();

    // Player movement, enemies, and collisions
    // Player
    let distanceX = 0;
    let distanceY = 0;

    if (keys["KeyW"] || keys["ArrowUp"])    distanceY -= 1;
    if (keys["KeyS"] || keys["ArrowDown"])  distanceY += 1;
    if (keys["KeyA"] || keys["ArrowLeft"])  distanceX -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) distanceX += 1;

    // Normalize so diagonal movement isn't faster
    if (distanceX !== 0 && distanceY !== 0) {
        const length = Math.hypot(distanceX, distanceY);
        distanceX /= length;
        distanceY /= length;
    }

    // Left joystick overrides the keyboard and keeps its analog strength
    if (moveStick.x !== 0 || moveStick.y !== 0) {
        distanceX = moveStick.x;
        distanceY = moveStick.y;
    }

    if (distanceX !== 0 || distanceY !== 0) {
        player.animTime += dt;
    } else {
        player.animTime = 0;   // standing still: back to the first frame
    }

    // Face the mouse, since you shoot where you aim
    player.facing = aim.x < 0 ? -1 : 1; 
    
    player.x += distanceX * player.speed * dt;
    player.y += distanceY * player.speed * dt;

    // Keep the player inside the arena
    const halfW = player.width / 2;
    const halfH = player.height / 2;
    player.x = Math.max(halfW, Math.min(GAME_WIDTH - halfW, player.x));
    player.y = Math.max(halfH, Math.min(GAME_HEIGHT - halfH, player.y));

    //Enemies
    updateSpawning(dt);
    updateEnemies(dt);

    //Collisions and game mechanics
    updatePlayerCollisions(dt);
    updateShooting(dt);
    updateBullets(dt);

}


// ===== RENDERING =====
// Pre-render the static background once (needs GAME_WIDTH/HEIGHT)
const backgroundCanvas = document.createElement("canvas");
backgroundCanvas.width = GAME_WIDTH;
backgroundCanvas.height = GAME_HEIGHT;
const backgroundContext = backgroundCanvas.getContext("2d");

// Draw the arena background
function renderBackground() {
    backgroundContext.fillStyle = ARENA_COLOR;
    backgroundContext.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    backgroundContext.strokeStyle = GRID_COLOR;
    backgroundContext.lineWidth = 1;

    const gridSize = 40;

    // One path for the whole grid, one stroke call
    backgroundContext.beginPath();
    for (let x = 0; x <= GAME_WIDTH; x += gridSize) {
        backgroundContext.moveTo(x, 0);
        backgroundContext.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y <= GAME_HEIGHT; y += gridSize) {
        backgroundContext.moveTo(0, y);
        backgroundContext.lineTo(GAME_WIDTH, y);
    }
    backgroundContext.stroke();
}

renderBackground();

// Per frame: just copy the finished image
function drawBackground() {
    context.drawImage(backgroundCanvas, 0, 0);
}

function drawSprite(image, x, y, width, height, facing) {
    if (!(image.complete && image.naturalWidth > 0)) return false;

    context.save();
    context.translate(x, y);
    context.scale(facing, 1);   // facing = -1 mirrors horizontally
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
    return true;
}

function drawEnemies() {
    for (const enemy of enemies) {
        const frame = getFrame(enemyFrames, enemy.animTime);
        const drawn = drawSprite(frame, enemy.x, enemy.y, enemy.width, enemy.height, enemy.facing);

        if (!drawn) {
            // Fallback square while images load (or if a path is wrong)
            context.fillStyle = enemy.color;
            context.fillRect(
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        }
    }
}

function drawPlayer() {
    // Blink while immune
    if (player.immunityTimer > 0 && Math.floor(player.immunityTimer * 20) % 2 === 0) {
        return;
    }

    const frame = getFrame(playerFrames, player.animTime);
    drawSprite(frame, player.x, player.y, player.width, player.height, player.facing);
}

function drawBullets() {
    context.fillStyle = "#ffd93b";
    for (const bullet of bullets) {
        context.beginPath();
        context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        context.fill();
    }
}

function drawAimArrow() {
    if (!isTouchDevice) return;

    const orbitDistance = 34;                    // distance from the player's center
    const angle = Math.atan2(aim.y, aim.x);      // converts the aim direction into an angle

    context.save();
    context.translate(player.x, player.y);
    context.rotate(angle);                      //turns the whole coordinate system by it

    context.globalAlpha = aim.firing ? 1 : 0.5;  // brighter while shooting
    context.fillStyle = "#ffd93b";

    context.beginPath();
    context.moveTo(orbitDistance + 10, 0);       // tip, pointing along the aim direction
    context.lineTo(orbitDistance - 4, -7);
    context.lineTo(orbitDistance - 4, 7);
    context.closePath();
    context.fill();

    context.restore();                           // resets position, rotation and alpha
}

function drawGameOver() {
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    context.textAlign = "center";

    context.fillStyle = "#f04f4f";
    context.font = "bold 48px Arial";
    context.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);

    context.fillStyle = "#f1f1f1";
    context.font = "24px Arial";
    context.fillText("Score: " + game.score, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 35);
}

// Draw everything
function draw() {
    drawBackground();
    drawEnemies();
    drawPlayer();
    drawAimArrow();
    drawBullets();
    
}


// ===== GAME LOOP =====
let lastTime = performance.now();

// Main game loop
function gameLoop(currentTime) {
    if (!game.running) return;

    // Seconds since last frame, capped so a tab switch doesn't cause a huge jump
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05); //dt = deltaTime (time before each game frame)
    lastTime = currentTime;

    update(dt);
    draw();

    if (game.health <= 0) {
        game.running = false;
        drawGameOver();
        return;
    }

    requestAnimationFrame(gameLoop); // Start the loop
}

// Start the game
requestAnimationFrame(gameLoop);