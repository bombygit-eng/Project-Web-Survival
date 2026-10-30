// ===== SETUP: CANVAS & DOM =====
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const healthDisplay = document.getElementById("health");
const scoreDisplay = document.getElementById("score");
context.imageSmoothingEnabled = false;
const menuOverlay = document.getElementById("menuOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreDisplay = document.getElementById("finalScore");
const classOverlay = document.getElementById("classOverlay");
const classList = document.getElementById("classList");
const classBackButton = document.getElementById("classBackButton");
const weaponOverlay = document.getElementById("weaponOverlay");
const weaponList = document.getElementById("weaponList");
const weaponButton = document.getElementById("weaponButton");
const hudDamage = document.getElementById("hudDamage");
const hudSpeed = document.getElementById("hudSpeed");
const hudPellets = document.getElementById("hudPellets");
const hudPelletProgress = document.getElementById("hudPelletProgress");
const hudScoreMultiplier = document.getElementById("hudScoreMultiplier");
const weaponRewardOverlay = document.getElementById("weaponRewardOverlay");
const rewardWeaponName = document.getElementById("rewardWeaponName");
const equipWeaponButton = document.getElementById("equipWeaponButton");
const keepWeaponButton = document.getElementById("keepWeaponButton");
const weaponBonusOverlay = document.getElementById("weaponBonusOverlay");
const bonusDamageButton = document.getElementById("bonusDamageButton");
const bonusSpeedButton = document.getElementById("bonusSpeedButton");
const bonusPelletButton = document.getElementById("bonusPelletButton");
const bonusScoreButton = document.getElementById("bonusScoreButton");

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
const PLAYER_IMMUNITY_TIME = 1.5;

// Animation settings
const ANIMATION_FPS = 8;   // frames per second of the animation

// Player settings
const PLAYER_START_HEALTH = 3;

//Pick-Ups
const PICKUP_DROP_CHANCE = 0.10; // 10% chance when an enemy dies to drop a power-up
const PICKUP_SIZE = 24;


// ===== GAME STATE =====
// Game state
const game = {
    state: "menu",   // "menu" | "weaponSelect" | "playing" | "gameover"
    selectedClass: "guns",
    selectedWeapon: "pistol",
    pendingWeapon: null,
    score: 0,
    health: PLAYER_START_HEALTH
};

//Player appearence
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    width: 32,
    height: 32,
    speed: 220,   // pixels per second
    weapon: null,
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

//Pick-Ups
const pickups = [];
const weaponDrops = [];

let damageMultiplier = 1;
let attackSpeedMultiplier = 1;
let pelletBonus = 0;
let pelletPickupCount = 0;
let scoreMultiplier = 1;

let pickupMessage = "";
let pickupMessageTimer = 0;

const PELLETS_REQUIRED = 4;

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

const flyFrames = loadFrames([
    "assets/Enemies/Enemy1/fly01.png",
    "assets/Enemies/Enemy1/fly02.png",   
    "assets/Enemies/Enemy1/fly03.png",
    "assets/Enemies/Enemy1/fly04.png",
    "assets/Enemies/Enemy1/fly05.png",
    "assets/Enemies/Enemy1/fly06.png",
    "assets/Enemies/Enemy1/fly07.png"

]);

const speedyFrames = loadFrames([
    "assets/Enemies/Enemy2/rat_1.png",
    "assets/Enemies/Enemy2/rat_2.png",
    "assets/Enemies/Enemy2/rat_3.png",
    "assets/Enemies/Enemy2/rat_4.png",
    "assets/Enemies/Enemy2/rat_5.png",
    "assets/Enemies/Enemy2/rat_6.png",
    "assets/Enemies/Enemy2/rat_7.png",
    "assets/Enemies/Enemy2/rat_8.png"
])

const tankFrames = loadFrames([
    "assets/Enemies/Enemy3/slime_1.png",
    "assets/Enemies/Enemy3/slime_2.png",
    "assets/Enemies/Enemy3/slime_3.png",
    "assets/Enemies/Enemy3/slime_4.png",
    "assets/Enemies/Enemy3/slime_5.png",
    "assets/Enemies/Enemy3/slime_6.png"
])

// Pick the frame for a given animation time (in seconds)
function getFrame(frames, time) {
    return frames[Math.floor(time * ANIMATION_FPS) % frames.length];
}

// ===== DATA TABLES =====
const WEAPON_CLASSES = {
    guns: {
        name: "Guns",
        startingWeapon: "pistol",
        weapons: ["pistol", "shotgun", "smg"]
    },
    bows: {
        name: "Bows",
        startingWeapon: "short_bow",
        weapons: ["short_bow", "long_bow", "crossbow"]
    },
    staffs: {
        name: "Staffs",
        startingWeapon: "fire_staff",
        weapons: ["fire_staff", "ice_staff", "lightning_staff"]
    },
    sharp: {
        name: "Sharp",
        startingWeapon: "knife",
        weapons: ["knife", "shuriken", "tomahawk"]
    },
    melee: {
        name: "Melee",
        startingWeapon: "sword",
        weapons: ["sword", "war_axe", "war_hammer"] 
    }
};

const WEAPONS = {
    pistol: {
        name: "Pistol",
        description: "Slow but accurate. Every bullet hits hard, so good aim pays off.",    
        cooldown: 1,       // seconds between shots
        damage: 2,           // health removed from an enemy per bullet
        bulletSpeed: 500,    // px per second
        bulletRadius: 6,
        pellets: 1,          // bullets fired per shot
        spread: 0            // cone width in radians (0 = perfectly accurate)
    },
    shotgun: {
        name: "Shotgun",
        description: "A wide burst of 5 pellets. Best up close, where most of them land.",    
        cooldown: 2,       // seconds between shots
        damage: 1,           // health removed from an enemy per bullet
        bulletSpeed: 500,    // px per second
        bulletRadius: 2,
        pellets: 5,          // bullets fired per shot
        spread: 50 * Math.PI / 180
    },
    smg: {
        name: "SMG",
        description: "A fast, spraying stream. Low damage per bullet, but it never stops.",    
        cooldown: 0.4,       // seconds between shots
        damage: 1,           // health removed from an enemy per bullet
        bulletSpeed: 500,    // px per second
        bulletRadius: 4,
        pellets: 1,          // bullets fired per shot
        spread: 8 * Math.PI / 180
              
    },
};

const ENEMY_TYPES = {
    fly: {
    speed: 90,
    hp: 4,
    size: 28,
    color: "#f04f4f",
    scoreMin: 1,
    scoreMax: 10,
    weaponDropChance: 1.0,
    frames: flyFrames
    },
    tank: {
        speed: 45,           // slower than the player (220) so you can escape
        hp: 10,
        size: 56,
        color: "#f04f4f",    // fallback square while images load
        scoreMin: 5,
        scoreMax: 25,
        weaponDropChance: 0.04,
        frames: tankFrames
    },
    speedy: {
        speed: 200,             // slower than the player (220) so you can escape
        hp: 2,
        size: 14,
        color: "#f04f4f",    // fallback square while images load
        scoreMin: 1,
        scoreMax: 15,
        weaponDropChance: 0.03,
        frames: speedyFrames
    }
};

const PICKUP_TYPES = {
    damage: {
        label: "DMG",
        color: "#ff595e"
    },
    attackSpeed: {
        label: "SPD",
        color: "#4ecdc4"
    },
    pellets: {
        label: "+",
        color: "#ffd166"
    },
    scoreMultiplier: {
        label: "x2",
        color: "#a78bfa"
    }
};

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

function playHitSound() {
    playTone({ type: "square", from: 500, to: 300, duration: 0.05, volume: 0.05 });
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

// ===== PICKUPS =====

function spawnPickup(x, y) {
    const pickupIds = Object.keys(PICKUP_TYPES);
    const randomIndex = Math.floor(Math.random() * pickupIds.length);
    const randomType = pickupIds[randomIndex];

    pickups.push({
        x: x,
        y: y,
        width: PICKUP_SIZE,
        height: PICKUP_SIZE,
        type: randomType
    });
}

function spawnWeaponDrop(x, y) {
    const weaponClass = WEAPON_CLASSES[game.selectedClass];

    // Get weapons from the selected class, excluding the current weapon
    const availableWeapons = weaponClass.weapons.filter(
        id => id !== game.selectedWeapon && WEAPONS[id]
    );

    // No alternative weapons available
    if (availableWeapons.length === 0) return;

    const weaponId = availableWeapons[
        randomInt(0, availableWeapons.length - 1)
    ];

    // Store the dropped weapon and its position
    weaponDrops.push({
        x,
        y,
        weaponId,
        radius: 16,
        width: 32,
        height: 32
    });
}

// ===== ENEMIES =====
function createEnemy(typeId, x, y) {
    const type = ENEMY_TYPES[typeId];

    return {
        type: type,
        x: x,
        y: y,
        width: type.size,
        height: type.size,
        speed: type.speed,
        hp: type.hp,
        color: type.color,
        hitTimer: 0,                    // > 0 briefly after being hit (for the flash)
        animTime: Math.random() * 10,   // random start so enemies don't flap in sync
        facing: 1
    };
}

// Spawn enemies inside or outside arena borders
function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);   // 0=top, 1=right, 2=bottom, 3=left
    // Random offset from -MARGIN (inside) to +MARGIN (outside)
    const offset = (Math.random() * 2 - 1) * SPAWN_MARGIN;
    const enemyTypes = Object.keys(ENEMY_TYPES);
    const randomIndex = Math.floor(Math.random() * enemyTypes.length);
    const randomType = enemyTypes[randomIndex];

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

    enemies.push(createEnemy(randomType, x, y));
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
        enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
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

function updatePickups() {
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];

        if (isColliding(player, pickup)) {
            if (pickup.type === "damage") {
                damageMultiplier += 0.25;
                showPickupMessage("DAMAGE UP!");
            }

            if (pickup.type === "attackSpeed") {
                attackSpeedMultiplier += 0.20;
                showPickupMessage("SPEED UP!");
            }

            if (pickup.type === "pellets") {
                pelletPickupCount++;

                if (pelletPickupCount >= PELLETS_REQUIRED) {
                    pelletBonus++;
                    pelletPickupCount = 0;
                    showPickupMessage("BULLET COUNT UP!");
                } else {
                    showPickupMessage(
                        "PELLETS: " + pelletPickupCount + "/" + PELLETS_REQUIRED
                    );
                }
            }  

            if (pickup.type === "scoreMultiplier") {
                scoreMultiplier *= 2;
                showPickupMessage("SCORE x" + scoreMultiplier + "!");
            }
            pickups.splice(i, 1);
            updateUpgradeHUD();
        } 
    }
}

function updateWeaponDrops() {
    for (let i = weaponDrops.length - 1; i >= 0; i--) {
        const drop = weaponDrops[i];

        if (isColliding(player, drop)) {
            // Remember which weapon was collected
            game.pendingWeapon = drop.weaponId;

            // Remove it from the arena
            weaponDrops.splice(i, 1);

            // Open the weapon choice screen
            setState("weaponReward");

            break;
        }
    }
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
    const weapon = player.weapon;
    const baseAngle = Math.atan2(aim.y, aim.x);

    // Total number of bullets, including upgrades
    const totalPellets = weapon.pellets + pelletBonus;

    // Give extra bullets a little spread if the weapon is normally accurate
    const spread = weapon.spread > 0
        ? weapon.spread
        : (totalPellets > 1 ? 12 * Math.PI / 180 : 0);

    for (let i = 0; i < totalPellets; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * spread;

        bullets.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * weapon.bulletSpeed,
            vy: Math.sin(angle) * weapon.bulletSpeed,
            radius: weapon.bulletRadius,
            damage: weapon.damage * damageMultiplier
        });
    }

    playShootSound();
}

function updateShooting(dt) {
    if (!player.weapon) return;

    fireTimer = Math.max(0, fireTimer - dt);

    if (aim.firing && fireTimer <= 0) {
        shoot();
        fireTimer = player.weapon.cooldown / attackSpeedMultiplier; // We want the cooldown to become shorter;
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

                bullets.splice(i, 1);          // the bullet is used up either way
                enemy.hp -= bullet.damage;

                if (enemy.hp <= 0) {
                    // Save the enemy's position before removing it
                    const enemyX = enemy.x;
                    const enemyY = enemy.y;

                    enemies.splice(j, 1);

                    addScore(randomInt(enemy.type.scoreMin, enemy.type.scoreMax) * scoreMultiplier);
                    playEnemyDeathSound();

                    // Random chance to drop a pickup
                    if (Math.random() < PICKUP_DROP_CHANCE) {
                        spawnPickup(enemyX, enemyY);
                    }
                    // Random chance to drop a weapon
                    if (Math.random() < enemy.type.weaponDropChance) {
                        spawnWeaponDrop(enemyX, enemyY);
                    }
                }
                else {
                    enemy.hitTimer = 0.08;     // brief flash
                    playHitSound();
                }
                break;   // this bullet is gone, stop checking it
            }
        }
    }
}

function addScore(points) {
    game.score += points;
    scoreDisplay.textContent = game.score;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== HUD ELEMENTS =====
function updateUpgradeHUD() {
    hudDamage.textContent = "x" + damageMultiplier.toFixed(2);
    hudSpeed.textContent = "x" + attackSpeedMultiplier.toFixed(2);
    hudPellets.textContent = "+" + pelletBonus;

    hudPelletProgress.textContent =
        pelletPickupCount + "/" + PELLETS_REQUIRED;

    hudScoreMultiplier.textContent = "x" + scoreMultiplier;
}

function drawPickupMessage() {
    if (pickupMessageTimer <= 0) return;

    context.save();

    context.globalAlpha = Math.min(1, pickupMessageTimer);
    context.font = "bold 20px Arial";
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.shadowColor = "#000000";
    context.shadowBlur = 5;

    context.fillText(
        pickupMessage,
        player.x,
        player.y - 45
    );

    context.restore();
}

function showPickupMessage(message) {
    pickupMessage = message;
    pickupMessageTimer = 1.5;
}

// ===== GAME STATES & MENUS =====
function resetGame() {
    // Stats and HUD
    game.score = 0;
    damageMultiplier = 1;
    attackSpeedMultiplier = 1;
    pelletBonus = 0;
    pelletPickupCount = 0;
    scoreMultiplier = 1;
    game.health = PLAYER_START_HEALTH;
    scoreDisplay.textContent = game.score;
    pickupMessage = "";
    pickupMessageTimer = 0;
    updateHealthDisplay();

    // Player
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT / 2;
    player.immunityTimer = 0;
    player.weapon = { ...WEAPONS[game.selectedWeapon] }; // Makes a copy, for upgrade purposes
    player.animTime = 0;
    player.facing = 1;

    // World (arrays are const, so empty them in place)
    enemies.length = 0;
    bullets.length = 0;
    pickups.length = 0;
    weaponDrops.length = 0;
    spawnTimer = 0;
    fireTimer = 0;

    updateUpgradeHUD();
}

// Shows the chosen weapon on the main menu button
function updateWeaponButton() {
    weaponButton.textContent = "WEAPON: " + WEAPONS[game.selectedWeapon].name.toUpperCase();
}

function selectWeapon(classId, weaponId) {
    game.selectedClass = classId;
    game.selectedWeapon = weaponId;
    setState("menu");
}

// Builds one card per entry in WEAPON_CLASSES, so new classes appear automatically
function buildClassCards() {
    classList.replaceChildren();

    for (const [id, weaponClass] of Object.entries(WEAPON_CLASSES)) {
        const card = document.createElement("div");
        card.className = "weapon-card";

        const title = document.createElement("h3");
        title.textContent = weaponClass.name;

        const description = document.createElement("p");
        description.textContent =
            weaponClass.weapons.length + " available weapons";

        const button = document.createElement("button");
        button.className = "menu-button";
        button.textContent = "SELECT";

        button.addEventListener("click", () => {
            game.selectedClass = id;
            game.selectedWeapon = weaponClass.startingWeapon;
            setState("weaponSelect");
        });

        card.append(title, description, button);
        classList.append(card);
    }
}

// Builds one card per entry in WEAPONS, so new weapons appear automatically
    function buildWeaponCards() {
        weaponList.replaceChildren();

        const selectedClass = WEAPON_CLASSES[game.selectedClass];

        for (const id of selectedClass.weapons) {
            const weapon = WEAPONS[id];
            const isSelected = id === game.selectedWeapon;

            const card = document.createElement("div");
            card.className = "weapon-card" + (isSelected ? " selected" : "");

            const title = document.createElement("h3");
            title.textContent = weapon.name;

            const description = document.createElement("p");
            description.textContent = weapon.description;

            // Stats come from the table, so they always match the real values
            const stats = document.createElement("div");
            stats.className = "weapon-stats";
            const pelletText = weapon.pellets > 1 ? " × " + weapon.pellets : "";
            stats.textContent = weapon.damage + " dmg" + pelletText +
                                " · " + (1 / weapon.cooldown).toFixed(1) + " shots/second";

            const button = document.createElement("button");
            button.className = "menu-button";
            button.textContent = isSelected ? "SELECTED" : "SELECT";
            button.addEventListener("click", () => selectWeapon(game.selectedClass, id));
            
            card.append(title, description, stats, button);
            weaponList.append(card);
        }
    }

// Every state change goes through here, so the side effects live in one place
function setState(newState) {
    game.state = newState;

    menuOverlay.hidden = newState !== "menu";
    classOverlay.hidden = newState !== "classSelect";
    weaponOverlay.hidden = newState !== "weaponSelect";
    gameOverOverlay.hidden = newState !== "gameover";
    weaponRewardOverlay.hidden = newState !== "weaponReward";
    weaponBonusOverlay.hidden = newState !== "weaponBonus";

    if (newState === "menu") {
        updateWeaponButton();
    } else if (newState === "classSelect") {
        buildClassCards();
    } else if (newState === "weaponSelect") {
        buildWeaponCards();
    } else if (newState === "weaponReward") {
        const weapon = WEAPONS[game.pendingWeapon];
        rewardWeaponName.textContent = weapon.name.toUpperCase();
    } else if (newState === "playing") {
    // Resume gameplay without resetting
    } else if (newState === "gameover") {
        finalScoreDisplay.textContent = game.score;
    }
}   

document.getElementById("startButton").addEventListener("click", () =>
    {
        resetGame();
        setState("playing")
    });
document.getElementById("restartButton").addEventListener("click", () => setState("playing"));
document.getElementById("menuButton").addEventListener("click", () => setState("menu"));
document.getElementById("weaponBackButton").addEventListener("click", () => setState("menu"));
weaponButton.addEventListener("click", () => setState("classSelect"));
classBackButton.addEventListener("click", () => setState("menu"));
equipWeaponButton.addEventListener("click", () => {
    const weaponId = game.pendingWeapon;

    // Equip the new weapon
    player.weapon = { ...WEAPONS[weaponId] };

    // Update the currently selected weapon
    game.selectedWeapon = weaponId;

    // Clear the temporary reward
    game.pendingWeapon = null;

    // Resume the game
    setState("playing");
});

keepWeaponButton.addEventListener("click", () => {
    // Open the bonus selection screen
    setState("weaponBonus");
});

bonusDamageButton.addEventListener("click", () => {
    damageMultiplier += 0.5;
    finishWeaponBonus();
});

bonusSpeedButton.addEventListener("click", () => {
    attackSpeedMultiplier += 0.5;
    finishWeaponBonus();
});

bonusPelletButton.addEventListener("click", () => {
    pelletBonus++;
    finishWeaponBonus();
});

bonusScoreButton.addEventListener("click", () => {
    addScore(500);
    finishWeaponBonus();
});

function finishWeaponBonus() {
    game.pendingWeapon = null;
    updateUpgradeHUD();
    setState("playing");
}

// ===== MAIN UPDATE =====
// Update game logic (dt = deltaTime)
function update(dt) {

    if (game.state !== "playing") return;

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

    if (pickupMessageTimer > 0) {
        pickupMessageTimer -= dt;
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
    updatePickups();
    updateWeaponDrops();
    updateShooting(dt);
    updateBullets(dt);

    if (game.health <= 0) setState("gameover");
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
        const frame = getFrame(enemy.type.frames, enemy.animTime);

        // Semi-transparent for a moment after being hit
        context.globalAlpha = enemy.hitTimer > 0 ? 0.5 : 1;

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

        context.globalAlpha = 1;
    }
}

function drawPickups() {
    for (const pickup of pickups) {
        const type = PICKUP_TYPES[pickup.type];

        // Pickup body
        context.fillStyle = type.color;
        context.beginPath();
        context.arc(
            pickup.x,
            pickup.y,
            pickup.width / 2,
            0,
            Math.PI * 2
        );
        context.fill();

        // Dark outline
        context.strokeStyle = "#202020";
        context.lineWidth = 2;
        context.stroke();

        // Pickup label
        context.fillStyle = "#202020";
        context.font = "bold 10px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(type.label, pickup.x, pickup.y);
    }
}

function drawWeaponDrops() {
    for (const drop of weaponDrops) {
        const weapon = WEAPONS[drop.weaponId];

        // Weapon name above the square
        context.fillStyle = "#FFFFFF";
        context.font = "bold 11px Arial";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(
            weapon.name.toUpperCase(),
            drop.x,
            drop.y - drop.radius - 5
        );

        // Grey square
        context.fillStyle = "#888888";
        context.fillRect(
            drop.x - drop.radius,
            drop.y - drop.radius,
            drop.radius * 2,
            drop.radius * 2
        );

        // Dark outline
        context.strokeStyle = "#202020";
        context.lineWidth = 2;
        context.strokeRect(
            drop.x - drop.radius,
            drop.y - drop.radius,
            drop.radius * 2,
            drop.radius * 2
        );
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

function drawPickupMessage() {
    if (pickupMessageTimer <= 0) return;

    context.save();

    context.globalAlpha = Math.min(1, pickupMessageTimer);
    context.font = "bold 20px Arial";
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.shadowColor = "#000000";
    context.shadowBlur = 5;

    context.fillText(
        pickupMessage,
        player.x,
        player.y - 45
    );

    context.restore();
}

function showPickupMessage(message) {
    pickupMessage = message;
    pickupMessageTimer = 1.5;
}

// Draw everything
function draw() {
    drawBackground();
    drawPickups();
    drawWeaponDrops();
    drawEnemies();
    drawPlayer();
    drawAimArrow();
    drawBullets();
    drawPickupMessage()
}


// ===== GAME LOOP =====
let lastTime = performance.now();

// Main game loop
function gameLoop(currentTime) {
    // Seconds since last frame, capped so a tab switch doesn't cause a huge jump
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start the game//
setState("menu");
requestAnimationFrame(gameLoop);
