const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// === SERWER STATIC ===
app.use(express.static("public"));

// === DANE O POKOJACH ===
const rooms = {};

io.on("connection", (socket) => {
    console.log("Użytkownik podłączony:", socket.id);

    // 🔹 Tworzenie nowego pokoju
    socket.on("createRoom", () => {
        const roomId = uuidv4();
        rooms[roomId] = {
            players: {},
            pendingMoves: { a: [], b: [] },
        };
        socket.join(roomId);
        rooms[roomId].players[socket.id] = { role: "a", lastDir: { x: 1, y: 0 } };
        socket.roomId = roomId;

        socket.emit("roomCreated", { roomId });
        console.log(`Pokój ${roomId} utworzony przez ${socket.id}`);
    });

    // 🔹 Dołączanie do pokoju
    socket.on("joinRoom", (roomId) => {
        const room = rooms[roomId];
        if (room && Object.keys(room.players).length < 2) {
            socket.join(roomId);
            rooms[roomId].players[socket.id] = { role: "b", lastDir: { x: -1, y: 0 } };
            socket.roomId = roomId;

            socket.emit("roomJoined", { roomId });
            io.to(roomId).emit("gameStart", { message: "Gra się zaczyna!" });

            console.log(`Gracz ${socket.id} dołączył do pokoju ${roomId}`);
        } else {
            socket.emit("errorMessage", { message: "Pokój jest pełny lub nie istnieje." });
        }
    });

    // 🔹 RUCH GRACZA
    socket.on("playerMove", (move) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const player = room.players[socket.id];
        if (!player) return;

        const role = player.role; // 'a' albo 'b'
        const lastDir = player.lastDir;

        // ⛔ Blokada cofania się o 180°
        if (move.x === -lastDir.x && move.y === -lastDir.y) {
            return;
        }

        // ➕ Kolejkuj ruch
        room.pendingMoves[role].push(move);
        console.log(`Ruch gracza ${role}:`, move);
    });

    // 🔹 Rozłączenie
    socket.on("disconnect", () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            if (Object.keys(rooms[roomId].players).length === 0) {
                delete rooms[roomId];
                console.log(`Pokój ${roomId} został usunięty (wszyscy wyszli)`);
            }
        }
        console.log("Użytkownik rozłączony:", socket.id);
    });
});

// === START SERVERA ===
server.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
