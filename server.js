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

// Zamiast globalnych zmiennych, mamy obiekt przechowujący wszystkie pokoje
let rooms = {};

// --- Funkcje pomocnicze dla gry (pozostają prawie bez zmian) ---
function randomFreeCell(occupied) {
    const occupiedSet = new Set(occupied.map(c => `${c.x},${c.y}`));
    while (true) {
        const c = { x: Math.floor(Math.random() * GRID_W), y: Math.floor(Math.random() * GRID_H) };
        if (!occupiedSet.has(`${c.x},${c.y}`)) return c;
    }
}

function isCoordInSnake(coord, snake) {
    return snake.some(segment => segment.x === coord.x && segment.y === coord.y);
}


// --- Logika Gry dla Konkretnego Pokoju ---
function createNewRoomState() {
    return {
        players: {},
        playerSlots: { a: null, b: null },
        gameState: {
            snake_a: [], snake_b: [], food: {},
            score_a: 0, score_b: 0, game_over: false,
        },
        pendingMoves: { a: [], b: [] },
        interval: null
    };
}

function resetGame(room) {
    const start_a = { x: Math.floor(GRID_W / 4), y: Math.floor(GRID_H / 2) };
    const start_b = { x: Math.floor(3 * GRID_W / 4), y: Math.floor(GRID_H / 2) };

    room.gameState.snake_a = [start_a, { x: start_a.x - 1, y: start_a.y }];
    room.gameState.snake_b = [start_b, { x: start_b.x + 1, y: start_b.y }];

    room.pendingMoves = { a: [{ x: 1, y: 0 }], b: [{ x: -1, y: 0 }] };

    if (room.playerSlots.a) room.players[room.playerSlots.a].lastDir = { x: 1, y: 0 };
    if (room.playerSlots.b) room.players[room.playerSlots.b].lastDir = { x: -1, y: 0 };

    room.gameState.score_a = 0; room.gameState.score_b = 0;
    const occupied = [...room.gameState.snake_a, ...room.gameState.snake_b];
    room.gameState.food = randomFreeCell(occupied);
    room.gameState.game_over = false;

    io.to(room.id).emit('gameState', room.gameState);
}

function gameTick(roomId) {
    const room = rooms[roomId];
    if (!room || room.gameState.game_over) return;

    // Ta funkcja jest bardzo podobna do poprzedniej, ale operuje na obiekcie 'room'
    // Używa też kolejki ruchów, co jest ulepszeniem z poprzedniego zadania
    let move_a = room.players[room.playerSlots.a].lastDir;
    if (room.pendingMoves.a.length > 0) {
        move_a = room.pendingMoves.a.shift();
        room.players[room.playerSlots.a].lastDir = move_a;
    }

    let move_b = room.players[room.playerSlots.b].lastDir;
    if (room.pendingMoves.b.length > 0) {
        move_b = room.pendingMoves.b.shift();
        room.players[room.playerSlots.b].lastDir = move_b;
    }

    let head_a = { x: room.gameState.snake_a[0].x + move_a.x, y: room.gameState.snake_a[0].y + move_a.y };
    if (head_a.x<0||head_a.x>=GRID_W||head_a.y<0||head_a.y>=GRID_H||isCoordInSnake(head_a,room.gameState.snake_a)||isCoordInSnake(head_a,room.gameState.snake_b)) {
        room.gameState.game_over = true;
    } else {
        room.gameState.snake_a.unshift(head_a);
        if (head_a.x===room.gameState.food.x && head_a.y===room.gameState.food.y) {
            room.gameState.score_a++;
            room.gameState.food = randomFreeCell([...room.gameState.snake_a, ...room.gameState.snake_b]);
        } else {
            room.gameState.snake_a.pop();
        }
    }

    if(room.gameState.game_over) {
        io.to(roomId).emit('gameState', room.gameState); return;
    }

    let head_b = { x: room.gameState.snake_b[0].x + move_b.x, y: room.gameState.snake_b[0].y + move_b.y };
    if (head_b.x<0||head_b.x>=GRID_W||head_b.y<0||head_b.y>=GRID_H||isCoordInSnake(head_b,room.gameState.snake_b)||isCoordInSnake(head_b,room.gameState.snake_a)||(head_a.x===head_b.x&&head_a.y===head_b.y)) {
        room.gameState.game_over = true;
    } else {
        room.gameState.snake_b.unshift(head_b);
        if (head_b.x===room.gameState.food.x && head_b.y===room.gameState.food.y) {
            room.gameState.score_b++;
            room.gameState.food = randomFreeCell([...room.gameState.snake_a, ...room.gameState.snake_b]);
        } else {
            room.gameState.snake_b.pop();
        }
    }

    io.to(roomId).emit('gameState', room.gameState);
}

function startGame(roomId) {
    const room = rooms[roomId];
    if (room.interval) clearInterval(room.interval);
    resetGame(room);
    room.interval = setInterval(() => gameTick(roomId), 1000 / FPS);
}

function getLobbyInfo() {
    return Object.values(rooms).map(room => ({
        id: room.id,
        playerCount: Object.keys(room.players).length,
        hasPassword: !!room.password
    }));
}


// --- GŁÓWNA LOGIKA SOCKET.IO ---
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    socket.emit('updateRoomList', getLobbyInfo());

    socket.on('createRoom', ({ password }) => {
        const roomId = `room-${socket.id}`;
        const room = createNewRoomState();
        room.id = roomId;
        room.password = password || null;

        // Dodaj gracza tworzącego pokój
        room.playerSlots.a = socket.id;
        room.players[socket.id] = { role: 'a', lastDir: { x: 1, y: 0 } };
        rooms[roomId] = room;

        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit('joinedRoom', { role: 'a' });
        io.emit('updateRoomList', getLobbyInfo());
        console.log(`User ${socket.id} created room ${roomId}`);
    });

    socket.on('joinRoom', ({ roomId, password }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('joinError', 'Pokój nie istnieje.');
        if (Object.keys(room.players).length >= 2) return socket.emit('joinError', 'Pokój jest pełny.');
        if (room.password && room.password !== password) return socket.emit('joinError', 'Nieprawidłowe hasło.');

        // Dodaj gracza do pokoju
        room.playerSlots.b = socket.id;
        room.players[socket.id] = { role: 'b', lastDir: { x: -1, y: 0 } };

        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit('joinedRoom', { role: 'b' });
        io.emit('updateRoomList', getLobbyInfo());
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Drugi gracz dołączył, zacznij grę!
        startGame(roomId);
    });

    socket.on('playerMove', (move) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const player = room.players[socket.id];
        if (player) {
            const playerQueue = room.pendingMoves[player.role];
            const lastMove = playerQueue.length > 0 ? playerQueue[playerQueue.length - 1] : player.lastDir;
            if (move.x !== -lastMove.x || move.y !== -lastMove.y) {
                playerQueue.push(move);
            }
        }
    });

    socket.on('restartGame', () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;
        const room = rooms[roomId];
        if (room.gameState.game_over) {
            // Restart może zainicjować tylko pierwszy gracz, aby uniknąć konfliktów
            if (socket.id === room.playerSlots.a) {
                console.log(`Game restarting in room ${roomId}`);
                resetGame(room);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            clearInterval(room.interval);
            delete rooms[roomId];
            io.to(roomId).emit('opponentLeft'); // Poinformuj drugiego gracza
            io.emit('updateRoomList', getLobbyInfo());
            console.log(`Room ${roomId} closed.`);
        }
    });
});

// Serwowanie plików statycznych
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/game.js', (req, res) => res.sendFile(__dirname + '/game.js'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));