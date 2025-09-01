// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// === SERWER STATIC ===
app.use(express.static("public"));

// === USTAWIENIA GRY ===
const GRID_COLS = 40;
const GRID_ROWS = 30;
const TICK_MS = 120;
const INITIAL_LEN = 4;

// === DANE O POKOJACH ===
const rooms = {}; // roomId -> { players: { socketId: {role, name, lastDir, snake, score, alive } }, spectators: Set, pendingMoves:{a:[],b:[]}, food:[], grid:{cols,rows,tile}, tick, loop }

function randomFoodCoord(room) {
    const cols = room.grid.cols, rows = room.grid.rows;
    const tries = 200;
    for (let i = 0; i < tries; i++) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        let ok = true;
        for (const sid in room.players) {
            const p = room.players[sid];
            if (p.snake) {
                for (const [sx, sy] of p.snake) {
                    if (sx === x && sy === y) { ok = false; break; }
                }
            }
            if (!ok) break;
        }
        if (ok) return [x, y];
    }
    return [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)];
}

function initSnake(role, room) {
    const cols = room.grid.cols, rows = room.grid.rows;
    const mid = Math.floor(rows / 2);
    const body = [];
    if (role === 'a') {
        // od lewej do prawej
        const startX = 2;
        for (let i = 0; i < INITIAL_LEN; i++) body.push([startX + i, mid]);
    } else {
        // od prawej do lewej
        const startX = cols - 1 - 2;
        for (let i = 0; i < INITIAL_LEN; i++) body.push([startX - i, mid - 1]);
    }
    return body;
}

function createRoomSkeleton(roomId) {
    rooms[roomId] = {
        players: {},
        spectators: new Set(),
        pendingMoves: { a: [], b: [] },
        food: [],
        grid: { cols: GRID_COLS, rows: GRID_ROWS, tile: 20 },
        tick: 0,
        loop: null
    };
    // kilka losowych jedzeń
    for (let i = 0; i < 5; i++) rooms[roomId].food.push(randomFoodCoord(rooms[roomId]));
}

function updateLeaderboard(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const rows = Object.values(room.players)
        .map(p => ({ id: p.role, name: p.name || `P${p.role}`, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
    io.to(roomId).emit('leaderboard', { rows });
}

function updatePopulation(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const playersCount = Object.keys(room.players).length;
    const spectatorsCount = room.spectators.size;
    io.to(roomId).emit('population', { players: playersCount, spectators: spectatorsCount });
}

function ensureRoomLoop(roomId) {
    const room = rooms[roomId];
    if (!room || room.loop) return;
    room.loop = setInterval(() => tickRoom(roomId), TICK_MS);
}

function stopRoomLoop(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loop) {
        clearInterval(room.loop);
        room.loop = null;
    }
}

function tickRoom(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    room.tick = (room.tick || 0) + 1;

    const cols = room.grid.cols, rows = room.grid.rows;

    // Process each player
    for (const sid of Object.keys(room.players)) {
        const p = room.players[sid];
        if (!p) continue;
        if (!p.alive) continue;

        // ensure snake exists
        if (!p.snake || p.snake.length === 0) {
            p.snake = initSnake(p.role, room);
            p.score = p.score || 0;
        }

        // consume next pending move for this role
        const q = room.pendingMoves[p.role] || [];
        if (q.length > 0) {
            const mv = q.shift();
            if (!(mv.x === -p.lastDir.x && mv.y === -p.lastDir.y)) {
                p.lastDir = mv;
            }
        }

        // compute new head
        const head = p.snake[p.snake.length - 1];
        const nx = (head[0] + p.lastDir.x + cols) % cols;
        const ny = (head[1] + p.lastDir.y + rows) % rows;

        // collision with any body
        let collision = false;
        for (const sid2 in room.players) {
            const p2 = room.players[sid2];
            if (!p2 || !p2.snake) continue;
            for (const [bx, by] of p2.snake) {
                if (bx === nx && by === ny) { collision = true; break; }
            }
            if (collision) break;
        }
        if (collision) {
            p.alive = false;
            // keep body as-is (died)
            continue;
        }

        // food?
        const foodIdx = room.food.findIndex(f => f[0] === nx && f[1] === ny);
        if (foodIdx >= 0) {
            // eat: grow (push head), increase score, respawn food
            p.snake.push([nx, ny]);
            p.score = (p.score || 0) + 1;
            // remove eaten food and spawn new
            room.food.splice(foodIdx, 1);
            room.food.push(randomFoodCoord(room));
        } else {
            // normal move: push head, keep length = INITIAL_LEN + score
            p.snake.push([nx, ny]);
            const expectedLen = INITIAL_LEN + (p.score || 0);
            while (p.snake.length > expectedLen) p.snake.shift();
        }
    }

    // prepare snakes array for broadcast
    const snakes = Object.values(room.players).map(p => ({
        id: p.role,
        name: p.name || `P${p.role}`,
        color: p.role === 'a' ? '#1fb6ff' : '#f97316',
        body: p.snake || [],
        alive: !!p.alive
    }));

    // broadcast state + leaderboard + population
    io.to(roomId).emit('state', { state: { grid: room.grid, snakes, food: room.food, round: room.tick } });
    updateLeaderboard(roomId);
    updatePopulation(roomId);
}

// === SOCKET.IO ===
io.on("connection", (socket) => {
    console.log("Użytkownik podłączony:", socket.id);

    socket.on("createRoom", (payload = {}) => {
        const roomId = uuidv4();
        createRoomSkeleton(roomId);

        socket.join(roomId);
        // creator becomes role 'a'
        rooms[roomId].players[socket.id] = {
            role: 'a',
            name: (payload.name && payload.name.slice(0, 20)) || 'Player A',
            lastDir: { x: 1, y: 0 },
            snake: initSnake('a', rooms[roomId]),
            score: 0,
            alive: true
        };
        socket.roomId = roomId;

        socket.emit("roomCreated", { roomId });
        socket.emit("joined", { roomId, id: socket.id, role: 'a', name: rooms[roomId].players[socket.id].name });

        ensureRoomLoop(roomId);
        updateLeaderboard(roomId);
        updatePopulation(roomId);

        console.log(`Pokój ${roomId} utworzony przez ${socket.id}`);
    });

    socket.on("joinRoom", (roomId, payload = {}) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit("errorMessage", { message: "Pokój nie istnieje." });
            return;
        }
        const playersCount = Object.keys(room.players).length;
        if (playersCount >= 2) {
            socket.emit("errorMessage", { message: "Pokój jest pełny." });
            return;
        }
        // choose available role a/b
        const takenRoles = new Set(Object.values(room.players).map(p => p.role));
        const role = takenRoles.has('a') ? 'b' : 'a';

        socket.join(roomId);
        rooms[roomId].players[socket.id] = {
            role,
            name: (payload.name && payload.name.slice(0, 20)) || (role === 'a' ? 'Player A' : 'Player B'),
            lastDir: role === 'a' ? { x: 1, y: 0 } : { x: -1, y: 0 },
            snake: initSnake(role, room),
            score: 0,
            alive: true
        };
        socket.roomId = roomId;

        socket.emit("roomJoined", { roomId });
        io.to(roomId).emit("joined", { roomId, id: socket.id, role: role, name: rooms[roomId].players[socket.id].name });
        ensureRoomLoop(roomId);
        updateLeaderboard(roomId);
        updatePopulation(roomId);

        console.log(`Gracz ${socket.id} dołączył jako ${role} do pokoju ${roomId}`);
    });

    // widz
    socket.on("spectateRoom", (roomId) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit("errorMessage", { message: "Pokój nie istnieje." });
            return;
        }
        socket.join(roomId);
        room.spectators.add(socket.id);
        socket.roomId = roomId;
        socket.emit("spectatorJoined", { roomId });
        updatePopulation(roomId);
        console.log(`Widz ${socket.id} dołączył do pokoju ${roomId}`);
    });

    // ruch gracza: move = { x: -1|0|1, y: -1|0|1 }
    socket.on("playerMove", (move) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;
        const room = rooms[roomId];
        const player = room.players[socket.id];
        if (!player) return; // widz nie może wysyłać ruchów
        // blokada cofania 180° (po stronie serwera)
        if (move && typeof move.x === "number" && typeof move.y === "number") {
            if (!(move.x === -player.lastDir.x && move.y === -player.lastDir.y)) {
                room.pendingMoves[player.role].push(move);
            }
        }
    });

    // client ping -> server replies pong with same ts
    socket.on("ping", (payload) => {
        socket.emit("pong", payload || {});
    });

    // klient może zgłosić score_update (opcjonalnie)
    socket.on("score_update", (payload) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;
        const player = rooms[roomId].players[socket.id];
        if (!player) return;
        if (payload && typeof payload.score === 'number') {
            player.score = Math.max(0, Math.floor(payload.score));
            updateLeaderboard(roomId);
        }
    });

    socket.on("leaveRoom", () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;
        const room = rooms[roomId];
        // remove from players or spectators
        if (room.players[socket.id]) delete room.players[socket.id];
        if (room.spectators.has(socket.id)) room.spectators.delete(socket.id);
        socket.leave(roomId);
        delete socket.roomId;
        updateLeaderboard(roomId);
        updatePopulation(roomId);

        // if no one left -> destroy room
        if (Object.keys(room.players).length === 0 && room.spectators.size === 0) {
            stopRoomLoop(roomId);
            delete rooms[roomId];
            console.log(`Pokój ${roomId} został usunięty (pusty).`);
        }
    });

    socket.on("disconnect", () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            if (room.players[socket.id]) delete room.players[socket.id];
            if (room.spectators.has(socket.id)) room.spectators.delete(socket.id);
            updateLeaderboard(roomId);
            updatePopulation(roomId);
            if (Object.keys(room.players).length === 0 && room.spectators.size === 0) {
                stopRoomLoop(roomId);
                delete rooms[roomId];
                console.log(`Pokój ${roomId} został usunięty (wszyscy wyszli)`);
            }
        }
        console.log("Użytkownik rozłączony:", socket.id);
    });
});

// === START SERVERA ===
server.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT} (port: ${PORT})`);
});
