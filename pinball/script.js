
"use strict";

// ========================================
// JURASSIC PINBALL - COMPLETE GAME SCRIPT
// ========================================

const board = document.getElementById("board");
const holder = document.getElementById("boardHolder");
const ballElement = document.getElementById("ball");

const scoreText = document.getElementById("score");
const livesText = document.getElementById("lives");
const timeText = document.getElementById("time");

const leftFlipper = document.getElementById("leftflipper");
const rightFlipper = document.getElementById("rightflipper");

const spring = document.getElementById("launcherSpring");
const plunger = document.getElementById("launcherPlunger");

const BALL_RADIUS = 10;
const GRAVITY = 0.18;
const MAX_SPEED = 17;
const FIXED_STEP = 1;
const WALL_RESTITUTION = 0.78;

// Game state
let score = 0;
let lives = 3;

let launched = false;
let inLauncher = false;
let pulling = false;
let power = 0;

let leftPressed = false;
let rightPressed = false;

let paused = false;
let gameOver = false;
let animationStarted = false;

let startTime = Date.now();
let pauseStartedAt = 0;
let previousFrameTime = 0;

let ball = {
    x: 746,
    y: 752,
    vx: 0,
    vy: 0
};

// ========================================
// BUMPERS
// ========================================

const bumpers = [
    ...document.querySelectorAll(".bumper")
].map(el => ({
    el,
    x: el.offsetLeft + el.offsetWidth / 2,
    y: el.offsetTop + el.offsetHeight / 2,
    r: Math.min(el.offsetWidth, el.offsetHeight) / 2
}));

// ========================================
// WALLS
// ========================================

const walls = [
    [35, 70, 35, 820],
    [70, 70, 695, 70],
    [695, 70, 695, 220],
    [695, 250, 695, 820],
    [70, 820, 228, 820],
    [565, 820, 695, 820]
];

walls.forEach(([x1, y1, x2, y2]) => {
    const wall = document.createElement("div");

    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    wall.className = "rock-barrier";
    wall.style.left = x1 + "px";
    wall.style.top = (y1 - 7) + "px";
    wall.style.width = length + "px";
    wall.style.transformOrigin = "0 50%";
    wall.style.transform = `rotate(${angle}rad)`;

    board.appendChild(wall);
});

// ========================================
// RESPONSIVE BOARD
// ========================================

function resizeBoard() {
    const device = new URLSearchParams(
        window.location.search
    ).get("device") || "computer";

    const availableWidth = window.innerWidth - 24;
    const availableHeight = window.innerHeight - 100;

    let scale = Math.min(
        1,
        availableWidth / 800,
        availableHeight / 900
    );

    if (device === "phone") {
        scale = Math.min(scale, 0.48);
    }

    if (device === "tablet") {
        scale = Math.min(scale, 0.85);
    }

    board.style.transformOrigin = "top left";
    board.style.transform = `scale(${scale})`;

    holder.style.width = 800 * scale + "px";
    holder.style.height = 900 * scale + "px";
}

window.addEventListener("resize", resizeBoard);
resizeBoard();

// ========================================
// BALL DRAWING
// ========================================

function drawBall() {
    ballElement.style.left =
        ball.x - BALL_RADIUS + "px";

    ballElement.style.top =
        ball.y - BALL_RADIUS + "px";
}

// ========================================
// SCORE, LIVES AND TIMER
// ========================================

function updateInfo() {
    scoreText.textContent = score;
    livesText.textContent = lives;

    const now = paused ? pauseStartedAt : Date.now();
    const seconds = Math.floor((now - startTime) / 1000);

    timeText.textContent =
        Math.floor(seconds / 60) + ":" +
        String(seconds % 60).padStart(2, "0");
}

// ========================================
// LAUNCHER
// ========================================

function moveLauncher() {
    const movement = power * 1.05;

    if (spring) {
        spring.style.height = (180 + movement) + "px";
    }

    if (plunger) {
        plunger.style.top = (550 + movement) + "px";
    }

    if (!launched) {
        ball.x = 746;
        ball.y = 752 + movement;
        drawBall();
    }
}

function pullLauncher() {
    if (gameOver || paused || launched) return;
    pulling = true;
}

function launchBall() {
    if (!pulling || launched || gameOver || paused) return;

    pulling = false;
    launched = true;
    inLauncher = true;

    ball.x = 746;
    ball.y = 752 + power * 1.05;
    ball.vx = 0;
    ball.vy = -11.5 - power * 0.05;

    power = 0;
    moveLauncher();
}

// ========================================
// RESET AND GAME OVER
// ========================================

function resetBall() {
    launched = false;
    inLauncher = false;
    pulling = false;
    power = 0;

    ball = {
        x: 746,
        y: 752,
        vx: 0,
        vy: 0
    };

    setLeftFlipper(false);
    setRightFlipper(false);

    moveLauncher();
    drawBall();
}

function endGame() {
    if (gameOver) return;

    gameOver = true;
    paused = false;

    const panel = document.getElementById("gameOverPanel");
    if (panel) panel.hidden = false;

    try {
        const history = JSON.parse(
            localStorage.getItem("jurassicPinballHistory") || "[]"
        );

        history.push({
            score,
            time: Math.floor((Date.now() - startTime) / 1000)
        });

        localStorage.setItem(
            "jurassicPinballHistory",
            JSON.stringify(history)
        );
    } catch (error) {
        console.warn("Could not save game history.", error);
    }
}

function loseBall() {
    if (gameOver) return;

    lives--;

    if (lives <= 0) {
        lives = 0;
        updateInfo();
        endGame();
    } else {
        resetBall();
        updateInfo();
    }
}

// ========================================
// COLLISION HELPER
// ========================================

function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    const lengthSquared = dx * dx + dy * dy;

    let t = 0;

    if (lengthSquared > 0) {
        t = (
            (px - x1) * dx +
            (py - y1) * dy
        ) / lengthSquared;

        t = Math.max(0, Math.min(1, t));
    }

    return {
        x: x1 + t * dx,
        y: y1 + t * dy
    };
}

// ========================================
// WALL COLLISIONS
// ========================================

function hitWalls() {
    const radius = BALL_RADIUS + 3;

    for (const [x1, y1, x2, y2] of walls) {
        const point = closestPointOnSegment(
            ball.x, ball.y, x1, y1, x2, y2
        );

        let dx = ball.x - point.x;
        let dy = ball.y - point.y;
        let distance = Math.hypot(dx, dy);

        if (distance >= radius) continue;

        if (distance < 0.001) {
            const length = Math.hypot(
                x2 - x1, y2 - y1
            ) || 1;

            dx = -(y2 - y1) / length;
            dy = (x2 - x1) / length;
            distance = 1;
        } else {
            dx /= distance;
            dy /= distance;
        }

        // Push ball outside the wall.
        const overlap = radius - distance;

        ball.x += dx * overlap;
        ball.y += dy * overlap;

        // Bounce only when moving into the wall.
        const dot = ball.vx * dx + ball.vy * dy;

        if (dot < 0) {
            ball.vx -= (1 + WALL_RESTITUTION) * dot * dx;
            ball.vy -= (1 + WALL_RESTITUTION) * dot * dy;
        }
    }
}

// ========================================
// BUMPER COLLISIONS
// ========================================

function hitBumpers() {
    for (const bumper of bumpers) {
        const dx = ball.x - bumper.x;
        const dy = ball.y - bumper.y;

        const distance = Math.hypot(dx, dy);
        const radius = bumper.r + BALL_RADIUS;

        if (distance >= radius) continue;

        let nx;
        let ny;

        if (distance < 0.001) {
            nx = 0;
            ny = -1;
        } else {
            nx = dx / distance;
            ny = dy / distance;
        }

        // Remove overlap.
        ball.x = bumper.x + nx * radius;
        ball.y = bumper.y + ny * radius;

        const dot = ball.vx * nx + ball.vy * ny;

        if (dot < 0) {
            ball.vx -= 1.9 * dot * nx;
            ball.vy -= 1.9 * dot * ny;

            // Extra bumper power.
            ball.vx += nx * 1.4;
            ball.vy += ny * 1.4;

            score += 10;

            bumper.el.classList.add("bumper-hit");

            setTimeout(() => {
                bumper.el.classList.remove("bumper-hit");
            }, 150);
        }
    }
}

// ========================================
// FLIPPERS
// ========================================

// These endpoints must match your actual CSS positions.

function getFlipperSegments() {
    function makeSegment(element, side, pressed) {
        const left = element.offsetLeft;
        const top = element.offsetTop;
        const width = element.offsetWidth;

        const pivotX = side === "left"
            ? left + width
            : left;

        const pivotY = top + element.offsetHeight / 2;

        const angle = side === "left"
            ? (pressed ? 30 : 18)
            : (pressed ? -30 : -18);

        const radians = angle * Math.PI / 180;

        const tipX = pivotX + (
            side === "left" ? -1 : 1
        ) * width * Math.cos(radians);

        const tipY = pivotY + (
            side === "left" ? -1 : 1
        ) * width * Math.sin(radians);

        return {
            x1: pivotX,
            y1: pivotY,
            x2: tipX,
            y2: tipY
        };
    }

    return [
        {
            element: leftFlipper,
            isPressed: () => leftPressed,
            direction: 1,
            ...makeSegment(leftFlipper, "left", leftPressed)
        },
        {
            element: rightFlipper,
            isPressed: () => rightPressed,
            direction: -1,
            ...makeSegment(rightFlipper, "right", rightPressed)
        }
    ];
}
function setLeftFlipper(pressed) {
    leftPressed = pressed;

    if (leftFlipper) {
        leftFlipper.classList.toggle("active", pressed);
    }
}

function setRightFlipper(pressed) {
    rightPressed = pressed;

    if (rightFlipper) {
        rightFlipper.classList.toggle("active", pressed);
    }
}

function hitFlippers() {
    for (const flipper of getFlipperSegments()) {
        const point = closestPointOnSegment(
            ball.x,
            ball.y,
            flipper.x1,
            flipper.y1,
            flipper.x2,
            flipper.y2
        );

        const dx = ball.x - point.x;
        const dy = ball.y - point.y;
        const distance = Math.hypot(dx, dy);

        const radius = BALL_RADIUS + 11;

        if (distance >= radius) continue;

        // Prevent repeated hits while the ball moves upwards.


        let nx;
        let ny;

        if (distance < 0.001) {
            nx = 0;
            ny = -1;
        } else {
            nx = dx / distance;
            ny = dy / distance;
        }

        if (ny > 0) {
            nx = -nx;
            ny = -ny;
        }

        // Separate ball from the flipper.
        ball.x = point.x + nx * radius;
        ball.y = point.y + ny * radius;

        if (flipper.isPressed()) {
            const offset = Math.max(
                -1,
                Math.min(1, (ball.x - point.x) / 75)
            );

            // Powerful upward launch.
            ball.vy = -17;

            // Sideways launch direction.
            ball.vx = offset * 6 + flipper.direction * 2;
        } else {
            // Softer bounce from a resting flipper.
            const dot = ball.vx * nx + ball.vy * ny;

            if (dot < 0) {
                ball.vx -= 1.5 * dot * nx;
                ball.vy -= 1.5 * dot * ny;
            }
        }
    }
}

// ========================================
// LAUNCHER ROD COLLISION
// ========================================

function hitLauncherRod() {
    if (inLauncher || !plunger || !launched) return;

    const left = plunger.offsetLeft;
    const top = plunger.offsetTop;
    const right = left + plunger.offsetWidth;
    const bottom = top + plunger.offsetHeight;

    const closestX = Math.max(left, Math.min(ball.x, right));
    const closestY = Math.max(top, Math.min(ball.y, bottom));

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distance = Math.hypot(dx, dy);

    if (distance >= BALL_RADIUS) return;

    let nx;
    let ny;

    if (distance < 0.001) {
        nx = -1;
        ny = 0;
    } else {
        nx = dx / distance;
        ny = dy / distance;
    }

    ball.x = closestX + nx * (BALL_RADIUS + 1);
    ball.y = closestY + ny * (BALL_RADIUS + 1);

    const dot = ball.vx * nx + ball.vy * ny;

    if (dot < 0) {
        ball.vx -= 1.8 * dot * nx;
        ball.vy -= 1.8 * dot * ny;
    }
}

// ========================================
// DRAIN
// ========================================

function checkDrain() {
    if (
        (ball.y > 835 &&
         ball.x > 228 &&
         ball.x < 565) ||
        ball.y > 890 ||
        ball.x < -20 ||
        ball.x > 820
    ) {
        loseBall();
    }
}

// ========================================
// PHYSICS
// ========================================

function updatePhysics(dt) {
    if (!launched) return;

    if (inLauncher) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        ball.vy += 0.12 * dt;

        if (ball.y <= 235) {
            ball.y = 235;
            ball.x = 680;
            ball.vx = -4.5;
            ball.vy = -7;
            inLauncher = false;
        }

        return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    ball.vy += GRAVITY * dt;

    ball.vx *= Math.pow(0.999, dt);
    ball.vy *= Math.pow(0.9995, dt);

    ball.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, ball.vx));
    ball.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, ball.vy));

    hitWalls();
    hitBumpers();
    hitFlippers();
    hitLauncherRod();

    checkDrain();
}

// ========================================
// PAUSE / RESUME / RESTART
// ========================================

function pauseGame() {
    if (gameOver || paused) return;

    paused = true;
    pauseStartedAt = Date.now();
}

function resumeGame() {
    if (!paused || gameOver) return;

    startTime += Date.now() - pauseStartedAt;

    paused = false;
    previousFrameTime = 0;
}

function restartGame() {
    score = 0;
    lives = 3;

    gameOver = false;
    paused = false;

    startTime = Date.now();
    previousFrameTime = 0;

    setLeftFlipper(false);
    setRightFlipper(false);

    const panel = document.getElementById("gameOverPanel");

    if (panel) panel.hidden = true;

    resetBall();
    updateInfo();
    startAnimation();
}

// ========================================
// KEYBOARD CONTROLS
// ========================================


/* ========================================
   FULL KEYBOARD CONTROLS
======================================== */

const keysPressed = {};

document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();

    // Prevent page scrolling during gameplay
    if (
        ["arrowleft", "arrowright", "arrowdown", " "]
            .includes(key)
    ) {
        event.preventDefault();
    }

    // Prevent repeated key presses
    if (keysPressed[key]) return;
    keysPressed[key] = true;

    switch (key) {
        case "arrowleft":
            setLeftFlipper(true);
            break;

        case "arrowright":
            setRightFlipper(true);
            break;

        case "arrowdown":
        case " ":
            pullLauncher();
            break;

        case "r":
            restartGame();
            break;

        case "h": {
            const panel = document.getElementById("historyPanel");

            if (panel && !panel.hidden) {
                panel.hidden = true;
            } else {
                document.getElementById("historyButton")?.click();
            }
            break;
        }

        case "escape": {
            const historyPanel =
                document.getElementById("historyPanel");

            if (historyPanel) {
                historyPanel.hidden = true;
            }
            break;
        }
    }
});

document.addEventListener("keyup", function (event) {
    const key = event.key.toLowerCase();

    keysPressed[key] = false;

    switch (key) {
        case "arrowleft":
            setLeftFlipper(false);
            break;

        case "arrowright":
            setRightFlipper(false);
            break;

        case "arrowdown":
        case " ":
            launchBall();
            break;
    }
});

// Release controls safely if the browser loses focus
window.addEventListener("blur", function () {
    Object.keys(keysPressed).forEach(key => {
        keysPressed[key] = false;
    });

    setLeftFlipper(false);
    setRightFlipper(false);

    // Avoid a stuck launcher when focus changes
    if (pulling) {
        launchBall();
    }
});

// ========================================
// MOBILE BUTTONS
// ========================================

function holdButton(id, press, release) {
    const button = document.getElementById(id);

    if (!button) return;

    button.addEventListener("pointerdown", event => {
        event.preventDefault();

        if (paused || gameOver) return;

        if (button.setPointerCapture) {
            button.setPointerCapture(event.pointerId);
        }

        press();
    });

    button.addEventListener("pointerup", event => {
        event.preventDefault();
        release();
    });

    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
}

holdButton(
    "leftButton",
    () => setLeftFlipper(true),
    () => setLeftFlipper(false)
);

holdButton(
    "rightButton",
    () => setRightFlipper(true),
    () => setRightFlipper(false)
);

holdButton(
    "launchButton",
    pullLauncher,
    launchBall
);

// ========================================
// GAME HISTORY
// ========================================

document.getElementById("historyButton")?.addEventListener("click", () => {
    const panel = document.getElementById("historyPanel");
    const list = document.getElementById("historyList");

    if (!panel || !list) return;

    list.textContent = "";

    try {
        const history = JSON.parse(
            localStorage.getItem("jurassicPinballHistory") || "[]"
        );

        if (!history.length) {
            list.textContent = "No games played yet.";
        }

        history.slice().reverse().forEach(game => {
            const item = document.createElement("div");

            item.className = "historyGame";
            item.textContent =
                `Score: ${game.score}\nTime: ${game.time} sec`;

            list.appendChild(item);
        });
    } catch (error) {
        list.textContent = "Game history could not be loaded.";
    }

    panel.hidden = false;
});

document.getElementById("closeHistoryButton")?.addEventListener("click", () => {
    const panel = document.getElementById("historyPanel");

    if (panel) panel.hidden = true;
});

// ========================================
// RESTART BUTTONS
// ========================================

document.querySelectorAll(
    "#restartButton, #playAgainButton, #restartFromGameOverButton"
).forEach(button => {
    button.addEventListener("click", restartGame);
});

// ========================================
// MAIN ANIMATION LOOP
// ========================================

function frame(timestamp) {
    if (!animationStarted) return;

    let dt = FIXED_STEP;

    if (previousFrameTime > 0) {
        dt = Math.min(
            1.8,
            Math.max(0.5, (timestamp - previousFrameTime) / 16.667)
        );
    }

    previousFrameTime = timestamp;

    if (paused) {
        updateInfo();
        requestAnimationFrame(frame);
        return;
    }

    if (!gameOver) {
        if (pulling && !launched) {
            power = Math.min(55, power + 0.6 * dt);
            moveLauncher();
        }

        updatePhysics(dt);
        drawBall();
        updateInfo();
    }

    requestAnimationFrame(frame);
}

function startAnimation() {
    if (animationStarted) return;

    animationStarted = true;
    requestAnimationFrame(frame);
}

// ========================================
// START GAME
// ========================================

resetBall();
updateInfo();
startAnimation();
