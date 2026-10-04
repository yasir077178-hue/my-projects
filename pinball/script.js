const ball = document.getElementById("ball");
const board = document.getElementById("gameboard");

const leftFlipper = document.getElementById("leftflipper");
const rightFlipper = document.getElementById("rightflipper");

const scoreText = document.getElementById("score");
const livesText = document.getElementById("lives");
const timeText = document.getElementById("time");

const launcher = document.getElementById("launcher");
const launcherPlunger = document.getElementById("launcherPlunger");

const bumpers = document.querySelectorAll(".bumper");

let ballX = 740;
let ballY = 680;

let velocityX = 0;
let velocityY = 0;

let gravity = 0.20;
let friction = 0.999;
let bounce = 0.88;

let score = 0;
let lives = 3;

let leftPressed = false;
let rightPressed = false;
let launchPressed = false;

let launcherPower = 0;
let ballInLauncher = true;
let gameRunning = true;

let startTime = Date.now();

let bumperHitTime = [];

let history =
    JSON.parse(localStorage.getItem("pinballHistory")) || [];

for (let i = 0; i < bumpers.length; i++) {
    bumperHitTime.push(0);
}

function setBall() {
    ball.style.left = ballX + "px";
    ball.style.top = ballY + "px";
}

function placeBallInLauncher() {
    ballInLauncher = true;

    ballX = 742;
    ballY = 700;

    velocityX = 0;
    velocityY = 0;

    launcherPower = 0;

    setBall();
}

function launchBall() {
    if (!ballInLauncher) {
        return;
    }

    ballInLauncher = false;

    velocityX = -1.5;
    velocityY = -(8 + launcherPower * 0.18);

    launcherPower = 0;
}

function updateLauncher() {
    if (!ballInLauncher) {
        return;
    }

    if (launchPressed) {
        launcherPower += 0.7;

        if (launcherPower > 55) {
            launcherPower = 55;
        }
    }

    let movement = launcherPower * 1.4;

    launcherPlunger.style.bottom =
        10 - movement + "px";

    ballY = 700 + movement;

    setBall();
}

function updateBall() {
    if (!gameRunning) {
        return;
    }

    updateLauncher();

    if (!ballInLauncher) {
        velocityY += gravity;

        velocityX *= friction;
        velocityY *= friction;

        ballX += velocityX;
        ballY += velocityY;

        checkWalls();
        checkBumpers();
        checkFlippers();
        checkPipes();
        checkDrain();

        setBall();
    }

    requestAnimationFrame(updateBall);
}

function checkWalls() {
    if (ballX < 58) {
        ballX = 58;
        velocityX = Math.abs(velocityX) * bounce;
    }

    if (ballX > 720) {
        ballX = 720;
        velocityX = -Math.abs(velocityX) * bounce;
    }

    if (ballY < 5) {
        ballY = 5;
        velocityY = Math.abs(velocityY) * bounce;
    }

    let walls = [
        {
            left: 48,
            top: 80,
            right: 70,
            bottom: 400
        },
        {
            left: 734,
            top: 80,
            right: 756,
            bottom: 400
        },
        {
            left: 80,
            top: 450,
            right: 270,
            bottom: 472
        },
        {
            left: 530,
            top: 450,
            right: 720,
            bottom: 472
        }
    ];

    for (let i = 0; i < walls.length; i++) {
        let wall = walls[i];

        let ballCenterX = ballX + 10;
        let ballCenterY = ballY + 10;

        if (
            ballCenterX > wall.left - 10 &&
            ballCenterX < wall.right + 10 &&
            ballCenterY > wall.top - 10 &&
            ballCenterY < wall.bottom + 10
        ) {
            let centerX =
                (wall.left + wall.right) / 2;

            let centerY =
                (wall.top + wall.bottom) / 2;

            let dx = ballCenterX - centerX;
            let dy = ballCenterY - centerY;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    ballX = wall.right;
                    velocityX = Math.abs(velocityX) * bounce;
                } else {
                    ballX = wall.left - 20;
                    velocityX = -Math.abs(velocityX) * bounce;
                }
            } else {
                if (dy > 0) {
                    ballY = wall.bottom;
                    velocityY = Math.abs(velocityY) * bounce;
                } else {
                    ballY = wall.top - 20;
                    velocityY = -Math.abs(velocityY) * bounce;
                }
            }
        }
    }
}
function checkBumpers() {
    let now = Date.now();

    for (let i = 0; i < bumpers.length; i++) {
        if (now < bumperHitTime[i]) {
            continue;
        }

        let bumper = bumpers[i];

        let centerX =
            bumper.offsetLeft + 31;

        let centerY =
            bumper.offsetTop + 31;

        let dx =
            ballX + 10 - centerX;

        let dy =
            ballY + 10 - centerY;

        let distance =
            Math.sqrt(dx * dx + dy * dy);

        if (distance < 43) {
            if (distance === 0) {
                distance = 1;
                dx = 1;
                dy = 0;
            }

            let nx = dx / distance;
            let ny = dy / distance;

            ballX =
                centerX + nx * 44 - 10;

            ballY =
                centerY + ny * 44 - 10;

            let speed =
                Math.sqrt(
                    velocityX * velocityX +
                    velocityY * velocityY
                );

            speed = Math.max(speed, 7);
            speed += 2.5;

            velocityX = nx * speed;
            velocityY = ny * speed;

            score += 10;

            scoreText.textContent = score;

            bumperHitTime[i] =
                now + 180;
        }
    }
}

function getClosestPoint(
    px,
    py,
    ax,
    ay,
    bx,
    by
) {
    let dx = bx - ax;
    let dy = by - ay;

    let lengthSquared =
        dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return {
            x: ax,
            y: ay
        };
    }

    let t =
        ((px - ax) * dx +
            (py - ay) * dy) /
        lengthSquared;

    t = Math.max(0, Math.min(1, t));

    return {
        x: ax + t * dx,
        y: ay + t * dy
    };
}

function checkFlipper(
    isLeft,
    pressed
) {
    let pivotX;
    let pivotY;
    let length = 220;

    let angle;

    if (isLeft) {
        pivotX = 325;
        pivotY = 733;
        angle = pressed
            ? -0.55
            : 0.14;
    } else {
        pivotX = 475;
        pivotY = 733;
        angle = pressed
            ? 0.55
            : -0.14;
    }

    let endX =
        pivotX +
        Math.cos(angle) * length;

    let endY =
        pivotY +
        Math.sin(angle) * length;

    let closest =
        getClosestPoint(
            ballX + 10,
            ballY + 10,
            pivotX,
            pivotY,
            endX,
            endY
        );

    let dx =
        ballX + 10 - closest.x;

    let dy =
        ballY + 10 - closest.y;

    let distance =
        Math.sqrt(dx * dx + dy * dy);

    if (
        distance < 17 &&
        velocityY > 0
    ) {
        if (distance === 0) {
            distance = 1;
            dy = -1;
        }

        let nx = dx / distance;
        let ny = dy / distance;

        ballX =
            closest.x +
            nx * 18 -
            10;

        ballY =
            closest.y +
            ny * 18 -
            10;

        let speed =
            Math.sqrt(
                velocityX * velocityX +
                velocityY * velocityY
            );

        speed = Math.max(speed, 8);

        velocityX =
            nx * speed;

        velocityY =
            ny * speed;

        if (pressed) {
            if (isLeft) {
                velocityX += 4;
            } else {
                velocityX -= 4;
            }

            velocityY -= 5;
        }
    }
}

function checkFlippers() {
    checkFlipper(
        true,
        leftPressed
    );

    checkFlipper(
        false,
        rightPressed
    );

    leftFlipper.style.transform =
        leftPressed
            ? "rotate(-32deg)"
            : "rotate(8deg)";

    rightFlipper.style.transform =
        rightPressed
            ? "rotate(32deg)"
            : "rotate(-8deg)";
}

function checkPipes() {
    let pipes = [
        {
            left: 115,
            top: 75,
            right: 264,
            bottom: 269
        },
        {
            left: 555,
            top: 75,
            right: 704,
            bottom: 269
        }
    ];

    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];

        if (
            ballX + 20 > pipe.left &&
            ballX < pipe.right &&
            ballY + 20 > pipe.top &&
            ballY < pipe.bottom
        ) {
            if (
                ballX < pipe.left + 15
            ) {
                ballX =
                    pipe.left - 20;

                velocityX =
                    -Math.abs(velocityX);
            }

            if (
                ballX + 20 >
                pipe.right - 15
            ) {
                ballX =
                    pipe.right;

                velocityX =
                    Math.abs(velocityX);
            }

            if (
                ballY < pipe.top + 15
            ) {
                ballY =
                    pipe.top - 20;

                velocityY =
                    -Math.abs(velocityY);
            }
        }
    }
}

function checkDrain() {
    if (ballY > 810) {
        loseLife();
    }
}

function loseLife() {
    lives--;

    livesText.textContent = lives;

    if (lives <= 0) {
        endGame();
        return;
    }

    placeBallInLauncher();
}

function endGame() {
    gameRunning = false;

    let elapsed =
        Math.floor(
            (Date.now() - startTime) / 1000
        );

    history.push({
        score: score,
        time: elapsed
    });

    localStorage.setItem(
        "pinballHistory",
        JSON.stringify(history)
    );

    window.location.href =
        "gameover.html";
}

function formatTime(seconds) {
    let minutes =
        Math.floor(seconds / 60);

    let remaining =
        seconds % 60;

    if (minutes > 0) {
        return (
            minutes +
            " min " +
            remaining +
            " sec"
        );
    }

    return seconds + " sec";
}

function updateTime() {
    if (!gameRunning) {
        return;
    }

    let elapsed =
        Math.floor(
            (Date.now() - startTime) / 1000
        );

    timeText.textContent =
        formatTime(elapsed);
}

function showHistory() {
    let panel =
        document.getElementById(
            "historyPanel"
        );

    let list =
        document.getElementById(
            "historylist"
        );

    list.innerHTML = "";

    if (history.length === 0) {
        list.innerHTML =
            "<p>No games played yet.</p>";
    }

    for (
        let i = 0;
        i < history.length;
        i++
    ) {
        let game = history[i];

        list.innerHTML +=
            "<div class='historyGame'>" +
            "GAME " +
            (i + 1) +
            "<br><br>" +
            "SCORE: " +
            game.score +
            "<br>" +
            "TIME: " +
            formatTime(game.time) +
            "</div>";
    }

    panel.style.display =
        "block";
}

function hideHistory() {
    document.getElementById(
        "historyPanel"
    ).style.display =
        "none";
}

document.addEventListener(
    "keydown",
    function(event) {
        if (
            event.key === "ArrowDown"
        ) {
            event.preventDefault();

            if (!launchPressed) {
                launchPressed = true;
            }
        }

        if (
            event.key === "ArrowLeft"
        ) {
            event.preventDefault();
            leftPressed = true;
        }

        if (
            event.key === "ArrowRight"
        ) {
            event.preventDefault();
            rightPressed = true;
        }
    }
);

document.addEventListener(
    "keyup",
    function(event) {
        if (
            event.key === "ArrowDown"
        ) {
            event.preventDefault();

            if (launchPressed) {
                launchPressed = false;
                launchBall();
            }
        }

        if (
            event.key === "ArrowLeft"
        ) {
            leftPressed = false;
        }

        if (
            event.key === "ArrowRight"
        ) {
            rightPressed = false;
        }
    }
);

document.getElementById(
    "restartButton"
).onclick = function() {
    window.location.reload();
};

document.getElementById(
    "historyButton"
).onclick =
    showHistory;

document.getElementById(
    "closeHistory"
).onclick =
    hideHistory;

scoreText.textContent = score;
livesText.textContent = lives;

placeBallInLauncher();

setInterval(updateTime, 1000);

updateBall();