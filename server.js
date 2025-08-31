const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Ustawienia gry
const TILE = 12;
const GRID_W = 56, GRID_H = 48;
const FPS = 14;

// --- NOWE STRUKTURY DANYCH ---
let players = {}; // Przechowuje dane o wszystkich graczach { socket.id: { role, lastDir } }
let activePlayers = [null, null]; // [socket.id dla gracza A, socket.id dla gracza B]
let waitingQueue = []; // Kolejka socket.id graczy czekających

let gameState = {
    snake_a: [],
    snake_b: [],
    food: {},
    score_a: 0,
    score_b: 0,
    game_over: false,
    winner: null,
};

let pendingMoves = { a: { x: 1, y: 0 }, b: { x: -1, y: 0 } };

// --- GŁÓWNE FUNKCJE SERWERA ---

// Ta funkcja rozsyła aktualny status (kto gra, kto czeka) do wszystkich
function broadcastSystemUpdate() {
    const queueData = waitingQueue.map((id, index) => ({ id, position: index + 1 }));
    for (const socketId in players) {
        let role = 'queue';
        let position = queueData.find(p => p.id === socketId)?.position;
        if (activePlayers[0] === socketId) role = 'a';
        if (activePlayers[1] === socketId) role = 'b';

        io.to(socketId).emit('systemUpdate', {
            role,
            queuePosition: position,
            queueLength: waitingQueue.length,
            activePlayerCount: activePlayers.filter(p => p !== null).length
        });
    }
}

function resetGame() {
    console.log("Resetting game for new round...");
    const start_a = { x: Math.floor(GRID_W / 4), y: Math.floor(GRID_H / 2) };
    const start_b = { x: Math.floor(3 * GRID_W / 4), y: Math.floor(GRID_H / 2) };

    gameState.snake_a = [start_a, { x: start_a.x - 1, y: start_a.y }];
    gameState.snake_b = [start_b, { x: start_b.x + 1, y: start_b.y }];

    // Ustawienie kierunków startowych dla graczy na podstawie ich ról
    players[activePlayers[0]].lastDir = { x: 1, y: 0 };
    players[activePlayers[1]].lastDir = { x: -1, y: 0 };
    pendingMoves.a = { x: 1, y: 0 };
    pendingMoves.b = { x: -1, y: 0 };

    gameState.score_a = 0;
    gameState.score_b = 0;
    gameState.food = randomFreeCell([...gameState.snake_a, ...gameState.snake_b]);
    gameState.game_over = false;
    gameState.winner = null;

    broadcastSystemUpdate();
}

function endGame(loserRole) {
    if (gameState.game_over) return; // Zapobiegaj wielokrotnemu wywołaniu

    console.log(`Game over. Loser: ${loserRole}`);
    gameState.game_over = true;

    let winnerSocket, loserSocket;

    if (loserRole === 'a') {
        gameState.winner = 'b';
        winnerSocket = activePlayers[1];
        loserSocket = activePlayers[0];
        activePlayers[0] = null;
    } else if (loserRole === 'b') {
        gameState.winner = 'a';
        winnerSocket = activePlayers[0];
        loserSocket = activePlayers[1];
        activePlayers[1] = null;
    } else { // Remis
        gameState.winner = 'draw';
        // Obaj przegrywają i idą na koniec kolejki
        if(activePlayers[0]) waitingQueue.push(activePlayers[0]);
        if(activePlayers[1]) waitingQueue.push(activePlayers[1]);
        activePlayers = [null, null];
    }

    if(loserSocket) {
        waitingQueue.push(loserSocket); // Przegrany na koniec kolejki
    }

    // Przesuń graczy, jeśli to konieczne (np. gracz B staje się A)
    if(activePlayers[1] && !activePlayers[0]){
        activePlayers[0] = activePlayers[1];
        players[activePlayers[0]].role = 'a';
        activePlayers[1] = null;
    }

    // Uzupełnij wolne miejsca z kolejki
    for (let i = 0; i < activePlayers.length; i++) {
        if (activePlayers[i] === null && waitingQueue.length > 0) {
            const newPlayerSocket = waitingQueue.shift();
            activePlayers[i] = newPlayerSocket;
            players[newPlayerSocket].role = i === 0 ? 'a' : 'b';
        }
    }

    broadcastSystemUpdate();

    // Po 3 sekundach zresetuj grę, jeśli jest 2 graczy
    setTimeout(() => {
        if (activePlayers[0] && activePlayers[1]) {
            resetGame();
        }
    }, 3000);
}

function gameTick() {
    if (gameState.game_over || !activePlayers[0] || !activePlayers[1]) {
        return;
    }

    // --- Aktualizacja Węża A ---
    const snake_a = gameState.snake_a;
    let head_a = { x: snake_a[0].x + pendingMoves.a.x, y: snake_a[0].y + pendingMoves.a.y };

    // --- Aktualizacja Węża B ---
    const snake_b = gameState.snake_b;
    let head_b = { x: snake_b[0].x + pendingMoves.b.x, y: snake_b[0].y + pendingMoves.b.y };

    // --- Sprawdzanie kolizji ---
    const a_crashed = head_a.x < 0 || head_a.x >= GRID_W || head_a.y < 0 || head_a.y >= GRID_H || isCoordInSnake(head_a, snake_a) || isCoordInSnake(head_a, snake_b);
    const b_crashed = head_b.x < 0 || head_b.x >= GRID_W || head_b.y < 0 || head_b.y >= GRID_H || isCoordInSnake(head_b, snake_b) || isCoordInSnake(head_b, snake_a);

    if(head_a.x === head_b.x && head_a.y === head_b.y){
        return endGame('draw');
    }
    if (a_crashed && b_crashed) {
        return endGame('draw');
    }
    if (a_crashed) {
        return endGame('a');
    }
    if (b_crashed) {
        return endGame('b');
    }

    // --- Przesuwanie węży ---
    snake_a.unshift(head_a);
    if (head_a.x === gameState.food.x && head_a.y === gameState.food.y) {
        gameState.score_a++;
        gameState.food = randomFreeCell([...snake_a, ...snake_b]);
    } else {
        snake_a.pop();
    }

    snake_b.unshift(head_b);
    if (head_b.x === gameState.food.x && head_b.y === gameState.food.y) {
        gameState.score_b++;
        gameState.food = randomFreeCell([...snake_a, ...snake_b]);
    } else {
        snake_b.pop();
    }

    io.emit('gameState', gameState);
}

io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    players[socket.id] = {};

    // Znajdź miejsce dla nowego gracza
    if (!activePlayers[0]) {
        activePlayers[0] = socket.id;
        players[socket.id] = { role: 'a', lastDir: { x: 1, y: 0 } };
    } else if (!activePlayers[1]) {
        activePlayers[1] = socket.id;
        players[socket.id] = { role: 'b', lastDir: { x: -1, y: 0 } };
        resetGame(); // Drugi gracz dołączył, zacznij grę
    } else {
        waitingQueue.push(socket.id);
        players[socket.id] = { role: 'queue' };
    }

    broadcastSystemUpdate();
    socket.emit