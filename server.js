const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Ustawienia gry - teraz na serwerze
const TILE = 12;
const GRID_W = 56, GRID_H = 48;
const FPS = 14;

// Zmienne stanu gry na serwerze
let players = {};
let playerSlots = { a: null, b: null }; // Gracz 'a' i 'b'
let gameState = {
    snake_a: [],
    snake_b: [],
    food: {},
    score_a: 0,
    score_b: 0,
    game_over: false,
};

let pendingMoves = { a: [], b: [] };

function randomFreeCell(occupied) {
    const occupiedSet = new Set(occupied.map(c => `${c.x},${c.y}`));
    while (true) {
        const c = {
            x: Math.floor(Math.random() * GRID_W),
            y: Math.floor(Math.random() * GRID_H)
        };
        if (!occupiedSet.has(`${c.x},${c.y}`)) {
            return c;
        }
    }
}

function resetGame() {
    console.log("Resetting game...");
    const start_a = { x: Math.floor(GRID_W / 4), y: Math.floor(GRID_H / 2) };
    const start_b = { x: Math.floor(3 * GRID_W / 4), y: Math.floor(GRID_H / 2) };

    gameState.snake_a = [start_a, { x: start_a.x - 1, y: start_a.y }];
    gameState.snake_b = [start_b, { x: start_b.x + 1, y: start_b.y }];

    // Zaktualizuj także lastDir dla graczy, jeśli istnieją
    if (playerSlots.a && players[playerSlots.a]) players[playerSlots.a].lastDir = { x: 1, y: 0 };
    if (playerSlots.b && players[playerSlots.b]) players[playerSlots.b].lastDir = { x: -1, y: 0 };

    // Wyczyść i ustaw początkowe ruchy w kolejkach
    pendingMoves.a = [{ x: 1, y: 0 }];
    pendingMoves.b = [{ x: -1, y: 0 }];

    gameState.score_a = 0;
    gameState.score_b = 0;

    const occupied = [...gameState.snake_a, ...gameState.snake_b];
    gameState.food = randomFreeCell(occupied);
    gameState.game_over = false;
}

function isCoordInSnake(coord, snake) {
    return snake.some(segment => segment.x === coord.x && segment.y === coord.y);
}

function gameTick() {
    if (gameState.game_over) return;
    if (!playerSlots.a || !playerSlots.b) return; // Czekaj na dwóch graczy

    // --- Pobierz ruch dla gracza A ---
    let move_a = players[playerSlots.a].lastDir; // Domyślnie kontynuuj w tym samym kierunku
    if (pendingMoves.a.length > 0) {
        move_a = pendingMoves.a.shift(); // Weź pierwszy ruch z kolejki
        players[playerSlots.a].lastDir = move_a; // Zaktualizuj ostatni wykonany kierunek
    }

    // --- Pobierz ruch dla gracza B ---
    let move_b = players[playerSlots.b].lastDir;
    if (pendingMoves.b.length > 0) {
        move_b = pendingMoves.b.shift();
        players[playerSlots.b].lastDir = move_b;
    }

    // --- Aktualizacja Węża A ---
    let head_a = { x: gameState.snake_a[0].x + move_a.x, y: gameState.snake_a[0].y + move_a.y };
    if (head_a.x < 0 || head_a.x >= GRID_W || head_a.y < 0 || head_a.y >= GRID_H || isCoordInSnake(head_a, gameState.snake_a) || isCoordInSnake(head_a, gameState.snake_b)) {
        gameState.game_over = true;
    } else {
        gameState.snake_a.unshift(head_a);
        if (head_a.x === gameState.food.x && head_a.y === gameState.food.y) {
            gameState.score_a++;
            gameState.food = randomFreeCell([...gameState.snake_a, ...gameState.snake_b]);
        } else {
            gameState.snake_a.pop();
        }
    }

    // Sprawdź, czy gra się już nie skończyła po ruchu gracza A
    if(gameState.game_over) {
        io.emit('gameState', gameState);
        return;
    }

    // --- Aktualizacja Węża B ---
    let head_b = { x: gameState.snake_b[0].x + move_b.x, y: gameState.snake_b[0].y + move_b.y };
    if (head_b.x < 0 || head_b.x >= GRID_W || head_b.y < 0 || head_b.y >= GRID_H || isCoordInSnake(head_b, gameState.snake_b) || isCoordInSnake(head_b, gameState.snake_a)) {
        gameState.game_over = true;
    } else if(head_a.x === head_b.x && head_a.y === head_a.y) { // Kolizja czołowa
        gameState.game_over = true;
    } else {
        gameState.snake_b.unshift(head_b);
        if (head_b.x === gameState.food.x && head_b.y === gameState.food.y) {
            gameState.score_b++;
            gameState.food = randomFreeCell([...gameState.snake_a, ...gameState.snake_b]);
        } else {
            gameState.snake_b.pop();
        }
    }

    // Rozsyłanie stanu do wszystkich
    io.emit('gameState', gameState);
}

io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // Przypisz rolę graczowi
    let playerRole = null;
    if (!playerSlots.a) {
        playerRole = 'a';
        playerSlots.a = socket.id;
        players[socket.id] = { role: 'a', lastDir: { x: 1, y: 0 }};
        console.log(`Assigned Player A to ${socket.id}`);
    } else if (!playerSlots.b) {
        playerRole = 'b';
        playerSlots.b = socket.id;
        players[socket.id] = { role: 'b', lastDir: { x: -1, y: 0 }};
        console.log(`Assigned Player B to ${socket.id}`);
        resetGame(); // Drugi gracz dołączył, zacznij grę
    } else {
        playerRole = 'spectator';
        players[socket.id] = { role: 'spectator' };
        console.log(`Assigned Spectator to ${socket.id}`);
    }
    socket.emit('playerRole', playerRole);
    socket.emit('gameState', gameState); // Wyślij aktualny stan do nowego gracza

socket.on('playerMove', (move) => {
    const player = players[socket.id];
    if (player && player.role !== 'spectator') {
        // Pobierz ostatni kierunek z kolejki lub ostatni wykonany kierunek
        const playerQueue = pendingMoves[player.role];
        const lastMove = playerQueue.length > 0 ? playerQueue[playerQueue.length - 1] : player.lastDir;

        // Walidacja ruchu (nie można zawrócić)
        // Sprawdza, czy nowy ruch nie jest przeciwny do ostatniego
        if (move.x !== -lastMove.x || move.y !== -lastMove.y) {
            playerQueue.push(move);
        }
    }
});

    socket.on('restartGame', () => {
        if(gameState.game_over) {
            resetGame();
        }
    });

    socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player) {
        if (player.role === 'a') {
            playerSlots.a = null;
            pendingMoves.a = []; // Wyczyść kolejkę
        }
        if (player.role === 'b') {
            playerSlots.b = null;
            pendingMoves.b = []; // Wyczyść kolejkę
        }
        delete players[socket.id];
    }
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.get('/game.js', (req, res) => {
    res.sendFile(__dirname + '/game.js');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    setInterval(gameTick, 1000 / FPS);
});