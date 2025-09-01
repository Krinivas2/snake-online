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

// --- Logika Menu Głównego ---
function initializeMainMenu() {
    const mainMenuContainer = document.createElement('div');
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

    // Domyślnie ukryj inne kontenery
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'none';

    // Event Listeners dla przycisków menu
    singlePlayerBtn.addEventListener('click', () => {
        alert('Tryb jednoosobowy jest w trakcie tworzenia!');
    });

    twoPlayerBtn.addEventListener('click', () => {
        alert('Tryb dwuosobowy jest w trakcie tworzenia!');
    });

    onlineLobbyBtn.addEventListener('click', () => {
        mainMenuContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
    });
}

// Uruchom menu po załadowaniu strony
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

let playerRole = null;

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
        ctx.fillText("KONIEC GRY", WIDTH / 2, HEIGHT / 2 - 20);
        if (playerRole !== 'spectator') {
            ctx.font = "16px 'Consolas', monospace";
            ctx.fillText("Gracz A wciska R, aby zagrać ponownie.", WIDTH / 2, HEIGHT / 2 + 20);
        }
        ctx.textAlign = 'left';
    }
}


// --- Logika Lobby ---
function updateRoomList(rooms) {
    roomList.innerHTML = ''; // Wyczyść listę
    if (rooms.length === 0) {
        roomList.innerHTML = '<p>Brak dostępnych pokoi. Stwórz własny!</p>';
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.classList.add('room-item');

        let lockIcon = room.hasPassword ? '&#128274;' : ''; // ikona kłódki
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
                    if (password === null) return; // Anulowano
                }
                socket.emit('joinRoom', {
                    roomId: room.id,
                    password: password
                });
            };
            roomElement.appendChild(joinBtn);
        }

        roomList.appendChild(roomElement);
    });
}

createRoomBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    socket.emit('createRoom', {
        password: password
    });
});


// --- Nasłuchiwanie na Zdarzenia Socket.IO ---

socket.on('updateRoomList', (rooms) => {
    updateRoomList(rooms);
});

socket.on('joinedRoom', (data) => {
    playerRole = data.role;
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (data.role === 'a') infoPanel.textContent = "Jesteś Graczem A (zielony). Oczekiwanie na drugiego gracza...";
    else if (data.role === 'b') infoPanel.textContent = "Jesteś Graczem B (niebieski). Gra zaraz się rozpocznie!";
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameState', (state) => {
    if (state.score_a === 0 && state.score_b === 0 && !state.game_over) {
        if (playerRole === 'a') infoPanel.textContent = "Gracz A (zielony) | Sterowanie: Strzałki lub WASD";
        if (playerRole === 'b') infoPanel.textContent = "Gracz B (niebieski) | Sterowanie: Strzałki lub WASD";
    }
    draw(state);
});

socket.on('opponentLeft', () => {
    alert('Przeciwnik opuścił grę. Zostaniesz przeniesiony do lobby.');
    window.location.reload(); // Najprostszy sposób na powrót do lobby
});

// Nasłuchiwanie na klawisze
window.addEventListener('keydown', e => {
    if (!playerRole) return;
    let move = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            move = { x: 0, y: -1 };
            break;
        case 'arrowdown':
        case 's':
            move = { x: 0, y: 1 };
            break;
        case 'arrowleft':
        case 'a':
            move = { x: -1, y: 0 };
            break;
        case 'arrowright':
        case 'd':
            move = { x: 1, y: 0 };
            break;
        case 'r':
            socket.emit('restartGame');
            break;
    }
    if (move) socket.emit('playerMove', move);
});

