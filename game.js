const socket = io();

// Ustawienia wizualne
const TILE = 12;
const GRID_W = 56, GRID_H = 48;
const MARGIN = 40;
const WIDTH = GRID_W * TILE;
const HEIGHT = GRID_H * TILE + MARGIN;

// Kolory
const BG = 'rgb(18, 18, 18)';
const GRID = 'rgb(30, 30, 30)';
const TEXT = 'rgb(230, 230, 230)';
const SUBT = 'rgb(180, 180, 180)';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const infoPanel = document.getElementById('infoPanel');

let playerRole = null;

const gridToPx = (cell) => ({ x: cell.x * TILE, y: cell.y * TILE + MARGIN });

function drawGrid() {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, MARGIN); ctx.lineTo(x * TILE, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= GRID_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE + MARGIN); ctx.lineTo(WIDTH, y * TILE + MARGIN); ctx.stroke(); }
}

function drawFood(pos) {
    if (!pos || typeof pos.x === 'undefined') return;
    const { x, y } = gridToPx(pos);
    const cx = x + TILE / 2; const cy = y + TILE / 2; const radius = TILE / 2 - 1;
    ctx.fillStyle = 'rgb(200, 40, 40)'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgb(255, 100, 100)'; ctx.beginPath(); ctx.arc(cx - radius / 3, cy - radius / 3, radius / 3, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgb(80, 40, 0)'; ctx.fillRect(cx - 1, cy - radius - 4, 2, 4);
}

function drawSnakeColored(snake, headColor, bodyColor) {
    if (!snake) return;
    snake.forEach((cell, index) => {
        const { x, y } = gridToPx(cell);
        ctx.fillStyle = (index === 0) ? headColor : bodyColor;
        ctx.beginPath();
        ctx.roundRect(x, y, TILE, TILE, 3);
        ctx.fill();
    });
}

function draw(state) {
    // Tło
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Tekst
    ctx.fillStyle = TEXT;
    ctx.font = "22px 'Consolas', monospace";
    ctx.fillText(`Gracz A: ${state.score_a}   Gracz B: ${state.score_b}`, 10, 25);

    // Siatka i jedzenie
    drawGrid();
    drawFood(state.food);

    // Węże
    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');

    // Nakładka końca gry
    if (state.game_over) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.font = "bold 36px 'Consolas', monospace";
        ctx.fillText("KONIEC GRY", WIDTH / 2, HEIGHT / 2 - 20);
        if(playerRole !== 'spectator') {
            ctx.font = "16px 'Consolas', monospace";
            ctx.fillText("Wciśnij R, aby zagrać ponownie.", WIDTH / 2, HEIGHT / 2 + 20);
        }
        ctx.textAlign = 'left';
    }
}

// Nasłuchuj na rolę od serwera
socket.on('playerRole', (role) => {
    playerRole = role;
    if (role === 'a') infoPanel.textContent = "Jesteś Graczem A (zielony). Sterowanie: Strzałki.";
    else if (role === 'b') infoPanel.textContent = "Jesteś Graczem B (niebieski). Sterowanie: Strzałki.";
    else infoPanel.textContent = "Jesteś obserwatorem. Miłego oglądania!";
});

// Główna pętla klienta: odbierz stan i narysuj
socket.on('gameState', (state) => {
    draw(state);
});

// Nasłuchuj na klawisze i wysyłaj do serwera
window.addEventListener('keydown', e => {
    if (playerRole === 'spectator') return;

    let move = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup': move = { x: 0, y: -1 }; break;
        case 'arrowdown': move = { x: 0, y: 1 }; break;
        case 'arrowleft': move = { x: -1, y: 0 }; break;
        case 'arrowright': move = { x: 1, y: 0 }; break;
        case 'r':
             socket.emit('restartGame');
             break;
    }

    if (move) {
        socket.emit('playerMove', move);
    }
});