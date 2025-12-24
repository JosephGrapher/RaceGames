// CANVAS SETUP
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const coinGifElement = document.getElementById('coin-gif'); // Riferimento all'elemento <img> animato

// ---- IMAGE LOADING ----
const images = {};
const imageSources = {
    car: 'images/kart.png',
    background: 'images/background.png',
    fence: 'images/fence.png',
    cones: 'images/cones.png',
    grass: 'images/grass.png',
    water: 'images/water.png',
    rock: 'images/rock.png'
};

let imagesLoaded = 0;
Object.keys(imageSources).forEach(key => {
    images[key] = new Image();
    images[key].src = imageSources[key];
    images[key].onload = () => { imagesLoaded++; };
});

const INITIAL_CAR_STATE = { x: 175, y: 500, w: 65, h: 65 };

let car = { ...INITIAL_CAR_STATE }; // Usa una copia dello stato iniziale
let carVisualY = car.y; // Posizione Y visiva per l'effetto di accelerazione
let obstacles = [];
let coins = [];
let score = 0;
let gauge = 1; // Livello di velocità attuale (da 1 a 4)

let speed = 2;         // Velocità di base
let minSpeed = 1;      // Velocità minima
let maxSpeed = 4;      // Velocità massima
let backgroundY = 0;   // Posizione Y per lo sfondo scorrevole
let running = true;

let lastObstacleSpawn = 0;
let lastCoinSpawn = 0;

// ---- POINTS INTERVAL ----
// Mappa che associa il livello di velocità (gauge) all'intervallo in millisecondi per i punti
const pointIntervals = {
    1: 1250, // gauge-1
    2: 1000, // gauge-2
    3: 750,  // gauge-3
    4: 500   // gauge-4 (il livello di velocità più alto)
};
let pointsIntervalId = null; // ID del timer per i punti


// ---- SPEED GAUGE ----
// Riferimento all'elemento immagine del tachimetro dall'HTML
const speedGaugeElement = document.getElementById('speedGauge');
// Array con i percorsi delle immagini del tachimetro
const gaugeImagePaths = [
    'images/gauge-1.png', // 0-25% della velocità massima
    'images/gauge-2.png', // 26-50% della velocità massima
    'images/gauge-3.png', // 51-75% della velocità massima
    'images/gauge-4.png'  // 76-100% della velocità massima
];

// ---- CONTROLS ----
let keyLeft = false;
let keyRight = false;
let keyUp = false;
let keyDown = false;

document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "a") keyLeft = true;
    if (e.key === "ArrowRight" || e.key === "d") keyRight = true;
    if (e.key === "ArrowUp" || e.key === "w") keyUp = true;
    if (e.key === "ArrowDown" || e.key === "s") keyDown = true;
});
document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "a") keyLeft = false;
    if (e.key === "ArrowRight" || e.key === "d") keyRight = false;
    if (e.key === "ArrowUp" || e.key === "w") keyUp = false;
    if (e.key === "ArrowDown" || e.key === "s") keyDown = false;
});

// ---- GAME LOOP ----
function gameLoop(timestamp) {
    if (!running) return;
    // Attendi che tutte le immagini siano caricate prima di iniziare
    if (imagesLoaded < Object.keys(imageSources).length) {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!running) return; // Pausa il gioco quando non è in esecuzione

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    update(timestamp);
    draw();

    requestAnimationFrame(gameLoop);
}

// ---- UPDATE ----
function update(ts) {

    // Controllo velocità con i tasti (accelerazione/decelerazione)
    if (keyUp && speed < maxSpeed) {
        speed += 0.05;
    } else if (keyDown && speed > minSpeed) {
        speed -= 0.05;
    }

    // ---- NUOVO: Calcolo della posizione Y visiva in base alla velocità ----
    const speedRatio = (speed - minSpeed) / (maxSpeed - minSpeed); // Percentuale di velocità (da 0.0 a 1.0)
    const forwardDisplacement = speedRatio * 180; // Spostamento massimo di 180px
    carVisualY = car.y - forwardDisplacement;

    // Move car
    if (keyLeft && car.x > 0) car.x -= 4;
    if (keyRight && car.x + car.w < canvas.width) car.x += 4;

    // Scroll background
    backgroundY = (backgroundY + speed) % canvas.height;

    // Spawn obstacles
    if (ts - lastObstacleSpawn > rand(800, 1400)) {
        spawnObstacle();
        lastObstacleSpawn = ts;
    }

    // Spawn coins every 2 seconds
    if (ts - lastCoinSpawn > 2000) {
        spawnCoin();
        lastCoinSpawn = ts;
    }

    // Move obstacles
    obstacles.forEach(o => o.y += speed);
    coins.forEach(c => c.y += speed);

    // Remove off-screen
    obstacles = obstacles.filter(o => o.y < canvas.height + 50);
    coins = coins.filter(c => c.y < canvas.height + 50);

    // Aggiorna l'immagine del tachimetro
    updateSpeedGaugeDisplay();

    // Check collisions
    checkCollisions();
}

// ---- DRAW ----
function draw() {
    // Sfondo scorrevole
    ctx.drawImage(images.background, 0, backgroundY, canvas.width, canvas.height);
    ctx.drawImage(images.background, 0, backgroundY - canvas.height, canvas.width, canvas.height);

    // ---- DISEGNO KART CON ROTAZIONE ----
    ctx.save(); // 1. Salva lo stato corrente del canvas (trasformazioni, etc.)

    // Calcola il centro del kart per la rotazione
    const carCenterX = car.x + car.w / 2;
    const carCenterY = carVisualY + car.h / 2;

    // 2. Sposta l'origine del canvas al centro del kart
    ctx.translate(carCenterX, carCenterY);

    // 3. Applica la rotazione
    const rotationDegrees = 15;
    if (keyLeft && !keyRight) {
        ctx.rotate(-rotationDegrees * Math.PI / 180); // Angolo negativo per sinistra
    } else if (keyRight && !keyLeft) {
        ctx.rotate(rotationDegrees * Math.PI / 180);  // Angolo positivo per destra
    }

    // 4. Disegna il kart centrato sulla nuova origine
    ctx.drawImage(images.car, -car.w / 2, -car.h / 2, car.w, car.h);
    ctx.restore(); // 5. Ripristina lo stato del canvas per non influenzare altri disegni

    // obstacles (usa le immagini)
    obstacles.forEach(o => {
        ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    });

    // coins (usa l'immagine)
    coins.forEach(c => {
        // Per disegnare l'immagine del coin centrata, calcoliamo la posizione x,y dall'angolo in alto a sinistra
        ctx.drawImage(coinGifElement, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    });
}

// ---- SPAWN OBSTACLE ----
function spawnObstacle() {
    const types = [
        { name: "grass", img: images.grass },
        { name: "fence", img: images.fence },
        { name: "rock", img: images.rock },
        { name: "water", img: images.water },
        { name: "cones", img: images.cones }
    ];

    let type = types[Math.floor(Math.random() * types.length)];

    // Usiamo le dimensioni reali dell'immagine per mantenere le proporzioni
    // e applichiamo un fattore di scala per renderle della giusta grandezza.
    const scale = 0.2; // Puoi aggiustare questo valore per rendere gli ostacoli più grandi o più piccoli
    const obstacleW = type.img.naturalWidth * scale;
    const obstacleH = type.img.naturalHeight * scale;

    obstacles.push({
        x: Math.random() * (canvas.width - obstacleW), // Assicura che l'ostacolo non esca dallo schermo
        y: -obstacleH, // Fa apparire l'ostacolo da sopra lo schermo
        w: obstacleW,
        h: obstacleH,
        img: type.img
    });
}

// ---- SPAWN COIN ----
function spawnCoin() {
    let x, y;

    // ensure no overlap with obstacles
    do {
        x = rand(20, canvas.width - 20);
        y = -20;
    } while (obstacles.some(o => rectCircleColl(x, y, 10, o)));

    coins.push({ x, y, r: 25 }); // Uso un raggio di 15 per le monete
}

// ---- COLLISION CHECK ----
function checkCollisions() {

    // obstacle collision
    for (let o of obstacles) {
        // Creiamo un rettangolo di collisione temporaneo per l'auto che usa la posizione Y visiva
        const carCollisionRect = {
            x: car.x,
            y: carVisualY, // Usiamo la posizione Y visiva per la collisione
            w: car.w,
            h: car.h
        };
        if (rectRectColl(carCollisionRect, o)) {
            gameOver();
            return;
        }
    }

    // coin pickup
    for (let i = coins.length - 1; i >= 0; i--) {
        // Per coerenza, usiamo anche la posizione Y visiva per la collisione con le monete
        const carCollisionRect = {
            x: car.x,
            y: carVisualY, // Usiamo la posizione Y visiva per la collisione
            w: car.w,
            h: car.h
        };
        if (rectCircleCollCenter(carCollisionRect, coins[i])) {
            const scoreCounterEl = document.getElementById("score-counter");

            score += 30;
            coins.splice(i, 1);
            scoreCounterEl.innerText = score;

            // Aggiungi la classe per l'animazione e rimuovila dopo 1 secondo
            scoreCounterEl.classList.add("bonus");
            setTimeout(() => {
                scoreCounterEl.classList.remove("bonus");
            }, 1000); // Corrisponde alla durata dell'animazione CSS
        }
    }
}

// ---- COLLISION HELPERS ----
function rectRectColl(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

function rectCircleColl(cx, cy, r, rect) {
    let testX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    let testY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    let dist = Math.hypot(cx - testX, cy - testY);
    return dist < r;
}

function rectCircleCollCenter(rect, c) {
    return rectCircleColl(c.x, c.y, c.r, rect);
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

// ---- GAME OVER ----
function gameOver() {
    // Ferma il timer dei punti
    if (pointsIntervalId) {
        clearInterval(pointsIntervalId);
    }

    running = false;
    speedGaugeElement.classList.add("hidden");
    document.getElementById("mainScorePanel").classList.add("hidden");
    document.getElementById("finalScore").innerText = score;
    document.getElementById("gameOverScreen").classList.remove("hidden");
    document.querySelector("#gameOverScreen button").focus();
}

// ---- RESTART ----
function restartGame() {
    car = { ...INITIAL_CAR_STATE }; // Usa una copia dello stato iniziale
    carVisualY = car.y;
    obstacles = [];
    coins = [];
    score = 0;
    gauge = 1;
    speed = 2;
    running = true;
    speedGaugeElement.classList.remove("hidden");
    document.getElementById("mainScorePanel").classList.remove("hidden");
    document.getElementById("score-counter").innerText = "0";
    document.getElementById("gameOverScreen").classList.add("hidden");

    // Avvia il timer dei punti con l'intervallo iniziale
    updatePointsInterval(gauge);

    requestAnimationFrame(gameLoop);
}

// ---- FUNZIONE PER GESTIRE L'INTERVALLO DEI PUNTI ----
/**
 * Aggiorna l'intervallo per l'assegnazione dei punti in base al livello di velocità.
 * @param {number} currentGauge - Il livello di velocità attuale (da 1 a 4).
 */
function updatePointsInterval(currentGauge) {
    // Ferma il timer precedente
    if (pointsIntervalId) {
        clearInterval(pointsIntervalId);
    }
    // Avvia un nuovo timer con l'intervallo corretto
    const newInterval = pointIntervals[currentGauge];
    pointsIntervalId = setInterval(() => {
        score++;
        document.getElementById("score-counter").innerText = score;
    }, newInterval);
}

// ---- FUNZIONE PER AGGIORNARE IL TACHIMETRO ----
function updateSpeedGaugeDisplay() {
    if (!speedGaugeElement) {
        console.warn("Elemento 'speedGauge' non trovato. Assicurati che l'ID sia corretto nell'HTML.");
        return;
    }

    // Calcola la percentuale di velocità (da 0.0 a 1.0)
    // Math.max(0, Math.min(1, ...)) assicura che il valore sia sempre tra 0 e 1
    const speedPercentage = Math.max(0, Math.min(1, speed / maxSpeed));

    let imageIndex = 0;
    if (speedPercentage > 0.75) {
        imageIndex = 3;
    } else if (speedPercentage > 0.50) {
        imageIndex = 2;
    } else if (speedPercentage > 0.25) {
        imageIndex = 1;
    }

    const newGauge = imageIndex + 1;

    // Aggiorna l'attributo 'src' dell'immagine solo se è cambiato, per ottimizzare
    const newImageSrc = gaugeImagePaths[imageIndex];
    if (!speedGaugeElement.src.endsWith(newImageSrc)) { // Confronta solo la fine del percorso per robustezza
        speedGaugeElement.src = newImageSrc;
    }

    // Se il livello di velocità è cambiato, aggiorna l'intervallo dei punti
    if (newGauge !== gauge) {
        gauge = newGauge;
        updatePointsInterval(gauge);
    }
}

// ---- GYROSCOPE CONTROLS ----

function startGyroGame() {
    // Richiesta permessi per iOS 13+ (necessaria per iPhone)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('startScreen').classList.add('hidden');
                    restartGame();
                } else {
                    alert("Permesso negato. Impossibile usare il giroscopio.");
                }
            })
            .catch(console.error);
    } else {
        // Android e dispositivi che non richiedono permessi espliciti
        window.addEventListener('deviceorientation', handleOrientation);
        document.getElementById('startScreen').classList.add('hidden');
        restartGame();
    }
}

function handleOrientation(event) {
    const tilt = event.gamma; // Inclinazione sinistra/destra (-90 a 90 gradi)
    const threshold = 5; // Zona morta per evitare movimenti involontari

    if (tilt < -threshold) {
        keyLeft = true;
        keyRight = false;
    } else if (tilt > threshold) {
        keyRight = true;
        keyLeft = false;
    } else {
        keyLeft = false;
        keyRight = false;
    }
}

// NOTA: Ho rimosso 'requestAnimationFrame(gameLoop)' qui sotto
// perché ora il gioco parte solo quando premi il pulsante.
