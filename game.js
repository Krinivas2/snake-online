const socket = io();

// Ustawienia wizualne (bez zmian)
const TILE = 12; const GRID_W = 56, GRID_H = 48; const MARGIN = 40; const WIDTH = GRID_W * TILE; const HEIGHT = GRID_H * TILE + MARGIN;
const BG = 'rgb(18, 18, 18)'; const GRID = 'rgb(30, 30, 30)'; const TEXT = 'rgb(230, 230, 230)';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const infoPanel = document.getElementById('infoPanel');

let playerRole = null;
let systemInfo = {}; // Przechowuje info o kolejce i roli

const gridToPx = (cell) => ({ x: cell.x * TILE, y: cell.y * TILE + MARGIN });

function updateInfoPanel() {
    const { role, queuePosition, queueLength, activePlayerCount } = systemInfo;
    if (role === 'a') {
        infoPanel.textContent = "Jesteś Graczem A (zielony). Sterowanie: Strzałki.";
    } else if (role === 'b') {
        infoPanel.textContent = "Jesteś Graczem B (niebieski). Sterowanie: Strzałki.";
    } else if (role === 'queue') {
        infoPanel.textContent = `Jesteś w kolejce. Pozycja: ${queuePosition} z ${queueLength}.`;
    } else if (activePlayerCount < 2) {
        infoPanel.textContent = "Oczekiwanie na drugiego gracza...";
    } else {
        infoPanel.textContent = "Łączenie...";
    }
}

function draw(state) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = TEXT;
    ctx.font = "22px 'Consolas', monospace";
    ctx.fillText(`Gracz A: ${state.score_a}   Gracz B: ${state.score_b}`, 10, 25);

    drawGrid();
    drawFood(state.food);

    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');

    if (state.game_over) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.font = "bold 36px 'Consolas', monospace";
        let winnerText = "Remis!";
        if(state.winner === 'a') winnerText = "Wygrał Gracz A (zielony)!";
        if(state.winner === 'b') winnerText = "Wygrał Gracz B (niebieski)!";
        ctx.fillText(winnerText, WIDTH / 2, HEIGHT / 2 - 20);

        ctx.font = "16px 'Consolas', monospace";
        ctx.fillText("Przygotowywanie następnej rundy...", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.textAlign = 'left';
    }
}


// --- KOMUNIKACJA Z SERWEREM ---

// Odbiera informacje o roli i statusie kolejki
socket.on('systemUpdate', (data) => {
    systemInfo = data;
    playerRole = data.role;
    updateInfoPanel();
});

// Odbiera stan gry i rysuje go na ekranie
socket.on('gameState', (state) => {
    draw(state);
});

// Nasłuchuje na klawisze i wysyła ruch do serwera
window.addEventListener('keydown', e => {
    if (playerRole !== 'a' && playerRole !== 'b') return;

    let move = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup': move = { x: 0, y: -1 }; break;
        case 'arrowdown': move = { x: 0, y: 1 }; break;
        case 'arrowleft': move = { x: -1, y: 0 }; break;
        case 'arrowright': move = { x: 1, y: 0 }; break;
    }
    if (move) {
        socket.emit('playerMove', move);
    }
});

// --- Funkcje rysujące (bez większych zmian) ---
function drawGrid() { ctx.strokeStyle = GRID; ctx.lineWidth = 1; for (let x = 0; x <= GRID_W; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, MARGIN); ctx.lineTo(x * TILE, HEIGHT); ctx.stroke(); } for (let y = 0; y <= GRID_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE + MARGIN); ctx.lineTo(WIDTH, y * TILE + MARGIN); ctx.stroke(); } }
function drawFood(pos) { if (!pos || typeof pos.x === 'undefined') return; const { x, y } = gridToPx(pos); const cx = x + TILE / 2; const cy = y + TILE / 2; const radius = TILE / 2 - 1; ctx.fillStyle = 'rgb(200, 40, 40)'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = 'rgb(255, 100, 100)'; ctx.beginPath(); ctx.arc(cx - radius / 3, cy - radius / 3, radius / 3, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = 'rgb(80, 40, 0)'; ctx.fillRect(cx - 1, cy - radius - 4, 2, 4); }
function drawSnakeColored(snake, headColor, bodyColor) { if (!snake) return; snake.forEach((cell, index) => { const { x, y } = gridToPx(cell); ctx.fillStyle = (index === 0) ? headColor : bodyColor; ctx.beginPath(); ctx.roundRect(x, y, TILE, TILE, 3); ctx.fill(); }); }