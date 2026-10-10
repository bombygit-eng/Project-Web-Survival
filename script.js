
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const healthDisplay = document.getElementById("health");
const scoreDisplay = document.getElementById("score");
context.imageSmoothingEnabled = false;

// Currently pressed keys
const keys = {};

// Canvas dimensions (must come before anything that uses them)
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Arena colors
const ARENA_COLOR = "#5b6b63";
const GRID_COLOR = "#6a7b72";
const SPAWN_MARGIN = 20;
const SPAWN_INTERVAL = 1.5;
const PLAYER_IMMUNITY_TIME = 0.5;

// Pre-render the static background once (needs GAME_WIDTH/HEIGHT)
const backgroundCanvas = document.createElement("canvas");
backgroundCanvas.width = GAME_WIDTH;
backgroundCanvas.height = GAME_HEIGHT;
const backgroundContext = backgroundCanvas.getContext("2d");

const playerImage = new Image();
const enemyImage = new Image();
const mouse = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, down: false };

//Bullets
const bullets = [];
const BULLET_SPEED = 500;      // px per second
const BULLET_RADIUS = 5;
const FIRE_COOLDOWN = 2;    // seconds between shots while holding
let fireTimer = 0;

// Enemies
const enemies = [];

enemyImage.src = "assets/Enemies/Enemy1/fly01.png";
playerImage.src = "assets/Player/slice01_.png";

let spawnTimer = 0;

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

function shoot() {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) return;   // mouse exactly on the player: no direction

    // Normalized direction × speed
    bullets.push({
        x: player.x,
        y: player.y,
        vx: (dx / distance) * BULLET_SPEED,
        vy: (dy / distance) * BULLET_SPEED,
        radius: BULLET_RADIUS
    });
}

function updateShooting(dt) {
    fireTimer = Math.max(0, fireTimer - dt);

    if (mouse.down && fireTimer === 0) {
        shoot();
        fireTimer = FIRE_COOLDOWN;
    }
}

function addScore(points) {
    game.score += points;
    scoreDisplay.textContent = game.score;
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
                break;   // this bullet is gone, stop checking it
            }
        }
    }
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

function isColliding(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
           Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

function updateHealthDisplay() {
    // One heart per remaining health point
    healthDisplay.textContent = game.health > 0
        ? Array(game.health).fill("❤️").join(" ")
        : "💀";
}

function damagePlayer() {
    game.health -= 1;
    player.immunityTimer = PLAYER_IMMUNITY_TIME;
    updateHealthDisplay();
}

// Update game logic (dt = deltaTime)
function update(dt) {
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
    if (distanceX !== 0 || distanceY !== 0) {
        player.animTime += dt;
    } else {
        player.animTime = 0;   // standing still: back to the first frame
    }

    // Face the mouse, since you shoot where you aim
    player.facing = mouse.x < player.x ? -1 : 1;

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

function drawSprite(image, x, y, width, height, facing) {
    if (!(image.complete && image.naturalWidth > 0)) return false;

    context.save();
    context.translate(x, y);
    context.scale(facing, 1);   // facing = -1 mirrors horizontally
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
    return true;
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

const ANIMATION_FPS = 8;   // frames per second of the animation

// Pick the frame for a given animation time (in seconds)
function getFrame(frames, time) {
    return frames[Math.floor(time * ANIMATION_FPS) % frames.length];
}

// Draw everything
function draw() {
    drawBackground();
    drawEnemies();
    drawPlayer();
    drawBullets();

}

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

