const socket = io();

// Elementy DOM
const lobbyContainer = document.getElementById('lobbyContainer');
const gameContainer = document.getElementById('gameContainer');
const createRoomBtn = document.getElementById('createRoomBtn');
const passwordInput = document.getElementById('passwordInput');
const roomList = document.getElementById('roomList');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoPanel = document.getElementById('infoPanel');
let mainMenuContainer; // Zdefiniowane globalnie

// --- Zmienne stanu gry ---
let gameMode = 'menu'; // 'menu', 'online', 'local', 'localSingle'
let playerRole = null;
let localGameState = {};
let localGameInterval = null;
let gameTimerInterval = null; // Interwał dla licznika czasu
let elapsedTime = 0; // Czas gry w sekundach
let dir_a, dir_b, next_dir_a, next_dir_b;

// --- Logika Menu Głównego ---
function initializeMainMenu() {
    mainMenuContainer = document.createElement('div');
    mainMenuContainer.id = 'mainMenuContainer';
    mainMenuContainer.style.textAlign = 'center';
    mainMenuContainer.style.paddingTop = '5vh';
    mainMenuContainer.style.fontFamily = "'Consolas', monospace";

    const title = document.createElement('h1');
    title.textContent = 'Wybierz tryb gry';
    title.style.color = 'rgb(230, 230, 230)';
    title.style.fontSize = '3em';
    title.style.marginBottom = '40px';
    mainMenuContainer.appendChild(title);

    const singlePlayerBtn = document.createElement('button');
    singlePlayerBtn.textContent = 'Gra Jednoosobowa';

    const twoPlayerBtn = document.createElement('button');
    twoPlayerBtn.textContent = 'Gra Dwuosobowa';

    const onlineLobbyBtn = document.createElement('button');
    onlineLobbyBtn.textContent = 'Online Lobby';

    const buttons = [singlePlayerBtn, twoPlayerBtn, onlineLobbyBtn];
    buttons.forEach(btn => {
        btn.style.display = 'block';
        btn.style.margin = '20px auto';
        btn.style.width = '250px';
        btn.style.padding = '15px 0';
        btn.style.fontSize = '1.2em';
        btn.style.fontFamily = "'Consolas', monospace";
        btn.style.cursor = 'pointer';
        btn.style.backgroundColor = 'rgb(50, 50, 50)';
        btn.style.color = 'rgb(230, 230, 230)';
        btn.style.border = '2px solid rgb(90, 90, 90)';
        btn.style.borderRadius = '8px';
        btn.style.transition = 'all 0.2s';
        btn.addEventListener('mouseover', () => {
            btn.style.backgroundColor = 'rgb(70, 70, 70)';
            btn.style.borderColor = 'rgb(120, 120, 120)';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.backgroundColor = 'rgb(50, 50, 50)';
            btn.style.borderColor = 'rgb(90, 90, 90)';
        });
        mainMenuContainer.appendChild(btn);
    });

    document.body.insertBefore(mainMenuContainer, lobbyContainer);

    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'none';

    singlePlayerBtn.addEventListener('click', () => {
        startLocalSinglePlayerGame();
    });

    twoPlayerBtn.addEventListener('click', () => {
        startLocalTwoPlayerGame();
    });

    onlineLobbyBtn.addEventListener('click', () => {
        gameMode = 'online';
        mainMenuContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
    });
}

window.addEventListener('DOMContentLoaded', initializeMainMenu);


// Ustawienia wizualne
const TILE = 12;
const GRID_W = 56,
    GRID_H = 48;
const MARGIN = 40;
const WIDTH = GRID_W * TILE;
const HEIGHT = GRID_H * TILE + MARGIN;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const BG = 'rgb(18, 18, 18)';
const GRID = 'rgb(30, 30, 30)';
const TEXT = 'rgb(230, 230, 230)';


// --- Funkcje rysujące ---
function drawGrid() {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE, MARGIN);
        ctx.lineTo(x * TILE, HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE + MARGIN);
        ctx.lineTo(WIDTH, y * TILE + MARGIN);
        ctx.stroke();
    }
}

function drawFood(pos) {
    if (!pos || typeof pos.x === 'undefined') return;
    const {
        x,
        y
    } = gridToPx(pos);
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const radius = TILE / 2 - 1;
    ctx.fillStyle = 'rgb(200, 40, 40)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgb(255, 100, 100)';
    ctx.beginPath();
    ctx.arc(cx - radius / 3, cy - radius / 3, radius / 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgb(80, 40, 0)';
    ctx.fillRect(cx - 1, cy - radius - 4, 2, 4);
}

function drawSnakeColored(snake, headColor, bodyColor) {
    if (!snake) return;
    snake.forEach((cell, index) => {
        const {
            x,
            y
        } = gridToPx(cell);
        ctx.fillStyle = (index === 0) ? headColor : bodyColor;
        ctx.beginPath();
        ctx.roundRect(x, y, TILE, TILE, 3);
        ctx.fill();
    });
}
const gridToPx = (cell) => ({
    x: cell.x * TILE,
    y: cell.y * TILE + MARGIN
});


function draw(state) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = TEXT;
    ctx.font = "22px 'Consolas', monospace";

    // Rysowanie wyników
    const scoreText = (gameMode === 'localSingle') ? `Gracz: ${state.score_a}   AI: ${state.score_b}` : `Gracz A: ${state.score_a}   Gracz B: ${state.score_b}`;
    ctx.textAlign = 'left';
    ctx.fillText(scoreText, 10, 25);

    // Rysowanie licznika czasu
    ctx.textAlign = 'right';
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = (elapsedTime % 60).toString().padStart(2, '0');
    ctx.fillText(`Czas: ${minutes}:${seconds}`, WIDTH - 5, 25);
    ctx.textAlign = 'left'; // Resetowanie wyrównania

    // Znak wodny
    ctx.save();
    ctx.font = "bold 60px 'Consolas', monospace";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Serious Seris", WIDTH / 2, HEIGHT / 2 + MARGIN / 2);
    ctx.restore();

    drawGrid();
    drawFood(state.food);
    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');

    if (state.game_over) {
        if (gameTimerInterval) clearInterval(gameTimerInterval); // Zatrzymaj licznik
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.font = "bold 36px 'Consolas', monospace";
        ctx.fillText("KONIEC GRY", WIDTH / 2, HEIGHT / 2 - 20);
        ctx.font = "16px 'Consolas', monospace";
        ctx.fillText("Wciśnij R, aby zagrać ponownie.", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.textAlign = 'left';
    }
}

// --- Logika Gry Lokalnej ---
function generateFood() {
    const allSnakeCells = [...localGameState.snake_a, ...localGameState.snake_b];
    let foodPos;
    do {
        foodPos = {
            x: Math.floor(Math.random() * GRID_W),
            y: Math.floor(Math.random() * GRID_H)
        };
    } while (allSnakeCells.some(cell => cell.x === foodPos.x && cell.y === foodPos.y));
    localGameState.food = foodPos;
}

function startTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    elapsedTime = 0;
    gameTimerInterval = setInterval(() => {
        elapsedTime++;
    }, 1000);
}

// --- Logika Gry Jednoosobowej (z AI) ---
function startLocalSinglePlayerGame() {
    gameMode = 'localSingle';
    playerRole = 'a'; // Player is always 'a'
    mainMenuContainer.style.display = 'none';
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (localGameInterval) clearInterval(localGameInterval);

    localGameState = {
        snake_a: [{ x: 10, y: 10 }], // Player
        snake_b: [{ x: GRID_W - 11, y: 10 }], // AI
        food: {},
        score_a: 0,
        score_b: 0,
        game_over: false,
    };

    dir_a = { x: 1, y: 0 };
    dir_b = { x: -1, y: 0 };
    next_dir_a = { x: 1, y: 0 };
    next_dir_b = { x: -1, y: 0 };

    infoPanel.textContent = "Gracz: Strzałki | Komputer: AI | 'R' - Restart";
    generateFood();
    startTimer(); // Uruchom licznik czasu
    localGameInterval = setInterval(localSinglePlayerGameLoop, 100);
}

function getAiNextMove() {
    const head = localGameState.snake_b[0];
    const food = localGameState.food;
    const allObstacles = [...localGameState.snake_a, ...localGameState.snake_b];

    const isCellUnsafe = (cell) => {
        if (cell.x < 0 || cell.x >= GRID_W || cell.y < 0 || cell.y >= GRID_H) return true;
        for (const segment of allObstacles) {
            if (cell.x === segment.x && cell.y === segment.y) return true;
        }
        return false;
    };

    const moves = [
        { dir: { x: 0, y: -1 }, name: 'up' },
        { dir: { x: 0, y: 1 }, name: 'down' },
        { dir: { x: -1, y: 0 }, name: 'left' },
        { dir: { x: 1, y: 0 }, name: 'right' }
    ];

    const possibleMoves = moves.filter(move => !(move.dir.x === -dir_b.x && move.dir.y === -dir_b.y));

    let bestMove = null;
    let minDistance = Infinity;

    for (const move of possibleMoves) {
        const nextCell = { x: head.x + move.dir.x, y: head.y + move.dir.y };
        if (!isCellUnsafe(nextCell)) {
            const distance = Math.abs(nextCell.x - food.x) + Math.abs(nextCell.y - food.y);
            if (distance < minDistance) {
                minDistance = distance;
                bestMove = move.dir;
            }
        }
    }

    if (!bestMove) {
        for (const move of possibleMoves) {
            const nextCell = { x: head.x + move.dir.x, y: head.y + move.dir.y };
            if (!isCellUnsafe(nextCell)) {
                bestMove = move.dir;
                break;
            }
        }
    }

    if (!bestMove) bestMove = dir_b;

    next_dir_b = bestMove;
}


function localSinglePlayerGameLoop() {
    if (localGameState.game_over) return;

    getAiNextMove();

    dir_a = next_dir_a;
    dir_b = next_dir_b;

    const head_a = { x: localGameState.snake_a[0].x + dir_a.x, y: localGameState.snake_a[0].y + dir_a.y };
    localGameState.snake_a.unshift(head_a);

    const head_b = { x: localGameState.snake_b[0].x + dir_b.x, y: localGameState.snake_b[0].y + dir_b.y };
    localGameState.snake_b.unshift(head_b);

    const isCollision = (snake) => {
        const head = snake[0];
        if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) return true;
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) return true;
        }
        return false;
    };

    for(let i = 0; i < localGameState.snake_b.length; i++){
        if(head_a.x === localGameState.snake_b[i].x && head_a.y === localGameState.snake_b[i].y) {
            localGameState.game_over = true;
        }
    }
    for(let i = 0; i < localGameState.snake_a.length; i++){
        if(head_b.x === localGameState.snake_a[i].x && head_b.y === localGameState.snake_a[i].y) {
            localGameState.game_over = true;
        }
    }

    if (isCollision(localGameState.snake_a) || isCollision(localGameState.snake_b) || localGameState.game_over) {
        localGameState.game_over = true;
        clearInterval(localGameInterval);
        draw(localGameState);
        return;
    }

    let ateFoodA = head_a.x === localGameState.food.x && head_a.y === localGameState.food.y;
    if (ateFoodA) {
        localGameState.score_a++;
        generateFood();
    } else {
        localGameState.snake_a.pop();
    }

    let ateFoodB = head_b.x === localGameState.food.x && head_b.y === localGameState.food.y;
    if (ateFoodB) {
        localGameState.score_b++;
        if(!ateFoodA) generateFood();
    } else {
        localGameState.snake_b.pop();
    }

    draw(localGameState);
}


function startLocalTwoPlayerGame() {
    gameMode = 'local';
    playerRole = null;
    mainMenuContainer.style.display = 'none';
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (localGameInterval) clearInterval(localGameInterval);

    localGameState = {
        snake_a: [{ x: 10, y: 10 }],
        snake_b: [{ x: GRID_W - 11, y: 10 }],
        food: {},
        score_a: 0,
        score_b: 0,
        game_over: false,
    };

    dir_a = { x: 1, y: 0 };
    dir_b = { x: -1, y: 0 };
    next_dir_a = { x: 1, y: 0 };
    next_dir_b = { x: -1, y: 0 };

    infoPanel.textContent = "Gracz A: Strzałki | Gracz B: WASD | 'R' - Restart";
    generateFood();
    startTimer(); // Uruchom licznik czasu
    localGameInterval = setInterval(localGameLoop, 100);
}

function localGameLoop() {
    if (localGameState.game_over) return;

    dir_a = next_dir_a;
    dir_b = next_dir_b;

    // --- Ruch Węży ---
    const head_a = { x: localGameState.snake_a[0].x + dir_a.x, y: localGameState.snake_a[0].y + dir_a.y };
    localGameState.snake_a.unshift(head_a);

    const head_b = { x: localGameState.snake_b[0].x + dir_b.x, y: localGameState.snake_b[0].y + dir_b.y };
    localGameState.snake_b.unshift(head_b);

    // --- Kolizje ---
    const isCollision = (snake) => {
        const head = snake[0];
        if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) return true;
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) return true;
        }
        return false;
    };

    for(let i = 0; i < localGameState.snake_b.length; i++){
        if(head_a.x === localGameState.snake_b[i].x && head_a.y === localGameState.snake_b[i].y) {
            localGameState.game_over = true;
        }
    }
    for(let i = 0; i < localGameState.snake_a.length; i++){
        if(head_b.x === localGameState.snake_a[i].x && head_b.y === localGameState.snake_a[i].y) {
            localGameState.game_over = true;
        }
    }


    if (isCollision(localGameState.snake_a) || isCollision(localGameState.snake_b) || localGameState.game_over) {
        localGameState.game_over = true;
        clearInterval(localGameInterval);
        draw(localGameState);
        return;
    }

    // --- Jedzenie ---
    let ateFoodA = head_a.x === localGameState.food.x && head_a.y === localGameState.food.y;
    if (ateFoodA) {
        localGameState.score_a++;
        generateFood();
    } else {
        localGameState.snake_a.pop();
    }

    let ateFoodB = head_b.x === localGameState.food.x && head_b.y === localGameState.food.y;
    if (ateFoodB) {
        localGameState.score_b++;
        if(!ateFoodA) generateFood();
    } else {
        localGameState.snake_b.pop();
    }

    draw(localGameState);
}


// --- Logika Lobby Online ---
function updateRoomList(rooms) {
    roomList.innerHTML = '';
    if (rooms.length === 0) {
        roomList.innerHTML = '<p>Brak dostępnych pokoi. Stwórz własny!</p>';
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.classList.add('room-item');
        let lockIcon = room.hasPassword ? '&#128274;' : '';
        roomElement.innerHTML = `
            <span>Pokój #${room.id.substring(5, 10)} ${lockIcon}</span>
            <span>Gracze: ${room.playerCount}/2</span>
        `;
        if (room.playerCount < 2) {
            const joinBtn = document.createElement('button');
            joinBtn.textContent = 'Dołącz';
            joinBtn.onclick = () => {
                let password = '';
                if (room.hasPassword) {
                    password = prompt('Podaj hasło do pokoju:');
                    if (password === null) return;
                }
                socket.emit('joinRoom', { roomId: room.id, password: password });
            };
            roomElement.appendChild(joinBtn);
        }
        roomList.appendChild(roomElement);
    });
}

createRoomBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    socket.emit('createRoom', { password: password });
});

// --- Nasłuchiwanie na Zdarzenia Socket.IO ---
socket.on('updateRoomList', (rooms) => updateRoomList(rooms));
socket.on('joinedRoom', (data) => {
    playerRole = data.role;
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    startTimer(); // Uruchom licznik czasu
    if (data.role === 'a') infoPanel.textContent = "Jesteś Graczem A (zielony). Oczekiwanie na drugiego gracza...";
    else if (data.role === 'b') infoPanel.textContent = "Jesteś Graczem B (niebieski). Gra zaraz się rozpocznie!";
});
socket.on('joinError', (message) => alert(message));
socket.on('gameState', (state) => {
    if (playerRole && state.score_a === 0 && state.score_b === 0 && !state.game_over) {
        if (playerRole === 'a') infoPanel.textContent = "Gracz A (zielony) | Sterowanie: Strzałki lub WASD";
        if (playerRole === 'b') infoPanel.textContent = "Gracz B (niebieski) | Sterowanie: Strzałki lub WASD";
    }
    draw(state);
});
socket.on('opponentLeft', () => {
    if (gameTimerInterval) clearInterval(gameTimerInterval); // Zatrzymaj licznik
    alert('Przeciwnik opuścił grę. Zostaniesz przeniesiony do lobby.');
    window.location.reload();
});

// --- Sterowanie ---
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();

    if (gameMode === 'online' && playerRole) {
        let move = null;
        switch (key) {
            case 'arrowup': case 'w': move = { x: 0, y: -1 }; break;
            case 'arrowdown': case 's': move = { x: 0, y: 1 }; break;
            case 'arrowleft': case 'a': move = { x: -1, y: 0 }; break;
            case 'arrowright': case 'd': move = { x: 1, y: 0 }; break;
            case 'r': socket.emit('restartGame'); break;
        }
        if (move) socket.emit('playerMove', move);
    } else if (gameMode === 'local') {
        if (key === 'arrowup' && dir_a.y === 0) next_dir_a = { x: 0, y: -1 };
        else if (key === 'arrowdown' && dir_a.y === 0) next_dir_a = { x: 0, y: 1 };
        else if (key === 'arrowleft' && dir_a.x === 0) next_dir_a = { x: -1, y: 0 };
        else if (key === 'arrowright' && dir_a.x === 0) next_dir_a = { x: 1, y: 0 };
        else if (key === 'w' && dir_b.y === 0) next_dir_b = { x: 0, y: -1 };
        else if (key === 's' && dir_b.y === 0) next_dir_b = { x: 0, y: 1 };
        else if (key === 'a' && dir_b.x === 0) next_dir_b = { x: -1, y: 0 };
        else if (key === 'd' && dir_b.x === 0) next_dir_b = { x: 1, y: 0 };
        else if (key === 'r') startLocalTwoPlayerGame();
    } else if (gameMode === 'localSingle') {
        if (key === 'arrowup' && dir_a.y === 0) next_dir_a = { x: 0, y: -1 };
        else if (key === 'arrowdown' && dir_a.y === 0) next_dir_a = { x: 0, y: 1 };
        else if (key === 'arrowleft' && dir_a.x === 0) next_dir_a = { x: -1, y: 0 };
        else if (key === 'arrowright' && dir_a.x === 0) next_dir_a = { x: 1, y: 0 };
        else if (key === 'r') startLocalSinglePlayerGame();
    }
});

