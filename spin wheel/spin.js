const wheel = document.getElementById("wheel");
const spinButton = document.getElementById("spinButton");
const resultText = document.getElementById("result");
 let rotation = 0;
 let spinning = false;

 let prizes = [
    "PRIZE 1",
    "PRIZE 2",
    "PRIZE 3",
    "PRIZE 4",
    "PRIZE 5",
    "PRIZE 6",
    "PRIZE 7",
    "PRIZE 8"
 ];

 spinButton.onclick