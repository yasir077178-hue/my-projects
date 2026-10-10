const wheel = document.getElementById("wheel");
const labelsContainer = document.getElementById("prizeLabels");
const spinButton = document.getElementById("spinButton");
const updateButton = document.getElementById("updateButton");
const prizesInput = document.getElementById("prizesInput");
const result = document.getElementById("result");

const spinSpeed = document.getElementById("spinSpeed");
const speedValue = document.getElementById("speedValue");
const prizePictures = document.getElementById("prizePictures");
const pictureGallery = document.getElementById("pictureGallery");

const winnerpopup = document.getElementById("winnerpopup");
const winnerName = document.getElementById("winnerName");
const winnerPicture = document.getElementById("winnerPicture");
const winnerQuestion = document.getElementById("winnerQuestion");

const removeWinnerButton =
    document.getElementById("removeWinnerButton");

const keepWinnerButton =
    document.getElementById("keepWinnerButton");

const colors = [
    "#8c2430", "#b98738", "#194d43", "#34345f",
    "#6e365f", "#53652c", "#9a5736", "#285b73"
];

let pictureItems = [];
let wheelItems = [];
let nextPictureId = 1;
let rotation = 0;
let spinning = false;
let lastWinner = null;


function changeSpinSpeed() {
    const seconds = Number(spinSpeed.value);

    wheel.style.transitionDuration = seconds + "s";
    speedValue.textContent = seconds + " seconds";
}

spinSpeed.addEventListener("input", changeSpinSpeed);


function getTextPrizes() {
    return prizesInput.value
        .split("\n")
        .map(prize => prize.trim())
        .filter(prize => prize !== "");
}


function readPicture(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();

        reader.onload = function() {
            resolve(reader.result);
        };

        reader.onerror = function() {
            reject(new Error("Could not read picture"));
        };

        reader.readAsDataURL(file);
    });
}


function renderPictureGallery() {
    pictureGallery.innerHTML = "";

    pictureItems.forEach(function(item) {
        const card = document.createElement("div");
        card.className = "picture-card";

        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.name;

        const name = document.createElement("p");
        name.textContent = item.name;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove Picture";

        removeButton.onclick = function() {
            if (spinning) return;

            pictureItems = pictureItems.filter(function(picture) {
                return picture.id !== item.id;
            });

            renderPictureGallery();
            updatePrizes();
        };

        card.appendChild(image);
        card.appendChild(name);
        card.appendChild(removeButton);

        pictureGallery.appendChild(card);
    });
}


prizePictures.addEventListener("change", async function() {
    const files = Array.from(prizePictures.files || [])
        .filter(file => file.type.startsWith("image/"));

    if (files.length === 0) return;

    if (spinning) {
        result.textContent = "WAIT UNTIL THE SPIN FINISHES.";
        prizePictures.value = "";
        return;
    }

    try {
        const newPictures = await Promise.all(
            files.map(async function(file) {
                const dataUrl = await readPicture(file);

                return {
                    id: nextPictureId++,
                    name: file.name,
                    src: dataUrl
                };
            })
        );

        pictureItems.push(...newPictures);

        renderPictureGallery();
        updatePrizes();

    } catch (error) {
        result.textContent = "COULD NOT LOAD A PICTURE.";
    }

    prizePictures.value = "";
});


function updatePrizes() {
    const textItems = getTextPrizes().map(function(name, index) {
        return {
            type: "text",
            name: name,
            id: "text-" + index
        };
    });

    const imageItems = pictureItems.map(function(picture) {
        return {
            type: "picture",
            name: picture.name,
            pictureId: picture.id,
            src: picture.src
        };
    });

    wheelItems = textItems.concat(imageItems);
    labelsContainer.innerHTML = "";

    if (wheelItems.length === 0) {
        wheel.style.background = "#17171c";
        result.textContent = "ADD SOME PRIZES OR PICTURES.";
        return false;
    }

    const sectionAngle = 360 / wheelItems.length;
    const gradientParts = [];
    const wheelRadius = wheel.clientWidth / 2;

    wheelItems.forEach(function(item, index) {
        const startAngle = index * sectionAngle;
        const endAngle = (index + 1) * sectionAngle;
        const color = colors[index % colors.length];

        gradientParts.push(
            color + " " + startAngle + "deg " + endAngle + "deg"
        );

        const label = document.createElement("div");
        label.className = "prize-label";

        const angle = startAngle + sectionAngle / 2;
        const radians = angle * Math.PI / 180;
        const radius = wheelRadius * 0.52;

        const x = Math.sin(radians) * radius;
        const y = -Math.cos(radians) * radius;

        label.style.left = "50%";
        label.style.top = "50%";
        label.style.margin = "0px";

        label.style.width = Math.max(
            32,
            Math.min(90, wheelRadius * 0.55)
        ) + "px";

        if (item.type === "picture") {
            const image = document.createElement("img");
            image.className = "prize-picture";
            image.src = item.src;
            image.alt = item.name;

            const name = document.createElement("span");
            name.className = "prize-name";
            name.textContent = item.name.replace(/\.[^/.]+$/, "");

            label.appendChild(image);
            label.appendChild(name);
        } else {
            const name = document.createElement("span");
            name.className = "prize-name";
            name.textContent = item.name;

            label.appendChild(name);
        }

        label.style.transform =
            "translate(-50%, -50%) translate(" +
            x + "px, " + y + "px)";

        labelsContainer.appendChild(label);
    });

    wheel.style.background =
        "conic-gradient(from 0deg, " +
        gradientParts.join(", ") + ")";

    if (wheelItems.length < 2) {
        result.textContent =
            "ADD AT LEAST ONE MORE PRIZE OR PICTURE.";
        return false;
    }

    result.textContent =
        wheelItems.length + " PRIZES READY TO SPIN!";

    return true;
}


updateButton.onclick = function() {
    if (!spinning) updatePrizes();
};


spinButton.onclick = function() {
    if (spinning || !updatePrizes()) return;

    spinning = true;
    spinButton.disabled = true;
    updateButton.disabled = true;
    result.textContent = "THE WHEEL IS SPINNING...";

    const winningIndex = Math.floor(
        Math.random() * wheelItems.length
    );

    const winner = wheelItems[winningIndex];
    const sectionAngle = 360 / wheelItems.length;
    const winningCenter = (winningIndex + 0.5) * sectionAngle;

    const currentAngle = ((rotation % 360) + 360) % 360;
    const targetAngle = (360 - winningCenter + 360) % 360;
    const adjustment = (targetAngle - currentAngle + 360) % 360;

    rotation += 1800 + adjustment;
    wheel.style.transform = "rotate(" + rotation + "deg)";

    function finishSpin(event) {
        if (event.propertyName !== "transform") return;

        wheel.removeEventListener("transitionend", finishSpin);

        lastWinner = winner;
        winnerName.textContent =
            winner.name.replace(/\.[^/.]+$/, "");

       if (winner.type === "picture") {
    winnerPicture.src = winner.src;
    winnerPicture.style.display = "block";

    winnerQuestion.textContent =
        "Do you want to remove this picture?";

    removeWinnerButton.style.display = "";
    removeWinnerButton.textContent = "Yes, Remove";

    keepWinnerButton.textContent = "No, Keep It";

    result.textContent = "PICTURE WINNER: " + winner.name;

} else {
    winnerPicture.style.display = "none";
    winnerPicture.removeAttribute("src");

    winnerQuestion.textContent =
        "Do you want to remove this winner?";

    removeWinnerButton.style.display = "";
    removeWinnerButton.textContent = "Yes, Remove";

    keepWinnerButton.textContent = "No, Keep It";

    result.textContent = "WINNER: " + winner.name;
}
        winnerpopup.style.display = "flex";

        spinning = false;
        spinButton.disabled = false;
        updateButton.disabled = false;
    }

    wheel.addEventListener("transitionend", finishSpin);
};


function closeWinnerPopup() {
    winnerpopup.style.display = "none";
    winnerPicture.style.display = "none";
    winnerPicture.removeAttribute("src");

    removeWinnerButton.style.display = "";
    keepWinnerButton.textContent = "No, Keep It";
}


removeWinnerButton.onclick = function() {
    if (!lastWinner) {
        closeWinnerPopup();
        return;
    }

    const winner = lastWinner;

    if (winner.type === "picture") {
        pictureItems = pictureItems.filter(function(picture) {
            return picture.id !== winner.pictureId;
        });

        renderPictureGallery();

    } else {
        const textPrizes = getTextPrizes();
        const winnerIndex = textPrizes.indexOf(winner.name);

        if (winnerIndex !== -1) {
            textPrizes.splice(winnerIndex, 1);
        }

        prizesInput.value = textPrizes.join("\n");
    }

    closeWinnerPopup();
    lastWinner = null;

    updatePrizes();

    result.textContent =
        (winner.type === "picture"
            ? "PICTURE REMOVED: "
            : "WINNER REMOVED: ") + winner.name;
};


keepWinnerButton.onclick = function() {
    const winner = lastWinner;

    closeWinnerPopup();
    lastWinner = null;

    if (winner) {
        result.textContent =
            (winner.type === "picture"
                ? "PICTURE KEPT: "
                : "WINNER: ") + winner.name;
    }
};


changeSpinSpeed();
renderPictureGallery();
updatePrizes();