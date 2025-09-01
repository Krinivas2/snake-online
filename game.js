const socket = io();

// Elementy DOM
const splashScreen = document.getElementById('splashScreen');
const introVideo = document.getElementById('introVideo');
const nicknameWrapper = document.getElementById('nicknameWrapper');
const nicknameInput = document.getElementById('nicknameInput');
const nicknameBtn = document.getElementById('nicknameBtn');
const lobbyContainer = document.getElementById('lobbyContainer');
const gameWrapper = document.getElementById('gameWrapper');
const createRoomBtn = document.getElementById('createRoomBtn');
const passwordInput = document.getElementById('passwordInput');
const roomList = document.getElementById('roomList');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoPanel = document.getElementById('infoPanel');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

// Ustawienia wizualne
const TILE = 12; const GRID_W = 56; const GRID_H = 48; const MARGIN = 40;
const WIDTH = GRID_W * TILE; const HEIGHT = GRID_H * TILE + MARGIN;
canvas.width = WIDTH; canvas.height = HEIGHT;
const BG = 'rgb(18, 18, 18)'; const GRID = 'rgb(30, 30, 30)'; const TEXT = 'rgb(230, 230, 230)';

// Zmienne stanu
let userNickname = '';
let playerRole = null;
let currentRoomId = null;
let currentLang = 'pl';
let lastRoomsData = [];
let lastGameState = null;
let chatHistory = [];

// Logika wielojęzyczności
const translations = {
    pl: {
        enterNicknameTitle: "Podaj swój nick", continueBtn: "Kontynuuj",
        mainTitle: "Wieloosobowy Wąż", lobbyTitle: "Lobby", createRoomTitle: "Stwórz nowy pokój",
        passwordPlaceholder: "Hasło (opcjonalne)", createRoomBtn: "Stwórz Pokój",
        availableRoomsTitle: "Dostępne Pokoje", noRooms: "Brak dostępnych pokoi. Stwórz własny!",
        room: "Pokój", players: "Gracze", joinBtn: "Dołącz", enterPassword: "Podaj hasło do pokoju:",
        waitingForPlayer: "Oczekiwanie na drugiego gracza w pokoju #{roomId}...",
        playerAInfo: "Sterowanie: Strzałki", playerBInfo: "Sterowanie: Strzałki",
        gameOver: "KONIEC GRY", restartInfo: "{nickname} wciska R, aby zagrać ponownie.",
        opponentLeft: "Przeciwnik opuścił grę. Zostaniesz przeniesiony do lobby.",
        chatPlaceholder: "Napisz wiadomość...", chatSendBtn: "Wyślij",
        system: "System"
    },
    en: {
        enterNicknameTitle: "Enter your nickname", continueBtn: "Continue",
        mainTitle: "Multiplayer Snake", lobbyTitle: "Lobby", createRoomTitle: "Create a new room",
        passwordPlaceholder: "Password (optional)", createRoomBtn: "Create Room",
        availableRoomsTitle: "Available Rooms", noRooms: "No available rooms. Create your own!",
        room: "Room", players: "Players", joinBtn: "Join", enterPassword: "Enter room password:",
        waitingForPlayer: "Waiting for another player in room #{roomId}...",
        playerAInfo: "Controls: Arrow keys", playerBInfo: "Controls: Arrow keys",
        gameOver: "GAME OVER", restartInfo: "{nickname} presses R to play again.",
        opponentLeft: "The opponent has left the game. You will be returned to the lobby.",
        chatPlaceholder: "Type a message...", chatSendBtn: "Send",
        system: "System"
    },
    no: {
        enterNicknameTitle: "Skriv inn kallenavnet ditt", continueBtn: "Fortsett",
        mainTitle: "Flerspiller Slangespill", lobbyTitle: "Lobby", createRoomTitle: "Opprett et nytt rom",
        passwordPlaceholder: "Passord (valgfritt)", createRoomBtn: "Opprett Rom",
        availableRoomsTitle: "Tilgjengelige Rom", noRooms: "Ingen tilgjengelige rom. Lag ditt eget!",
        room: "Rom", players: "Spillere", joinBtn: "Bli med", enterPassword: "Skriv inn rompassord:",
        waitingForPlayer: "Venter på en annen spiller i rom #{roomId}...",
        playerAInfo: "Kontroller: Piltaster", playerBInfo: "Kontroller: Piltaster",
        gameOver: "SPILLET ER OVER", restartInfo: "{nickname} trykker R for å spille igjen.",
        opponentLeft: "Motstanderen har forlatt spillet. Du blir sendt tilbake til lobbyen.",
        chatPlaceholder: "Skriv en melding...", chatSendBtn: "Send",
        system: "System"
    }
};

function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('snakeLang', lang);

    document.querySelectorAll('[data-translate-key]').forEach(el => {
        const key = el.getAttribute('data-translate-key');
        const translation = translations[lang][key];
        if (translation) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translation;
            } else {
                el.textContent = translation;
            }
        }
    });

    updateRoomListUI(lastRoomsData);
    renderChat();
    if (lastGameState) {
        draw(lastGameState);
    }

    if (gameWrapper.style.display === 'flex') {
        if (lastGameState && !lastGameState.game_over) {
            infoPanel.textContent = playerRole === 'a' ? translations[lang].playerAInfo : translations[lang].playerBInfo;
        } else if (!lastGameState) {
             infoPanel.textContent = translations[lang].waitingForPlayer.replace('{roomId}', currentRoomId.substring(5, 10));
        }
    }

    document.querySelectorAll('#langSelector span').forEach(span => span.classList.remove('active'));
    document.getElementById(`lang-${lang}`).classList.add('active');
}

document.getElementById('lang-pl').addEventListener('click', () => setLanguage('pl'));
document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
document.getElementById('lang-no').addEventListener('click', () => setLanguage('no'));

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('snakeLang') || 'pl';
    setLanguage(savedLang);
});

// Logika ekranu powitalnego (intro video)
function startApp() {
    splashScreen.style.display = 'none';
    nicknameWrapper.style.display = 'block';
    nicknameInput.focus(); // Ustawia kursor w polu nicku
}

if (introVideo) {
    introVideo.addEventListener('ended', startApp);
    introVideo.addEventListener('error', startApp);
} else {
    startApp();
}

// Logika ekranu wyboru nicku
nicknameBtn.addEventListener('click', () => {
    const nick = nicknameInput.value.trim();
    if (nick.length >= 2 && nick.length <= 12) {
        userNickname = nick;
        nicknameWrapper.style.display = 'none';
        lobbyContainer.style.display = 'block';
    } else {
        alert('Nick musi mieć od 2 do 12 znaków.');
    }
});
nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        nicknameBtn.click();
    }
});


// Funkcje rysujące
function drawGrid() {
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, MARGIN); ctx.lineTo(x * TILE, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= GRID_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE + MARGIN); ctx.lineTo(WIDTH, y * TILE + MARGIN); ctx.stroke(); }
}

function drawFood(pos) {
    if (!pos || typeof pos.x === 'undefined') return;
    const { x, y } = gridToPx(pos); const cx = x + TILE / 2; const cy = y + TILE / 2; const radius = TILE / 2 - 1;
    ctx.fillStyle = 'rgb(200, 40, 40)'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgb(255, 100, 100)'; ctx.beginPath(); ctx.arc(cx - radius / 3, cy - radius / 3, radius / 3, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgb(80, 40, 0)'; ctx.fillRect(cx - 1, cy - radius - 4, 2, 4);
}

function drawSnakeColored(snake, headColor, bodyColor) {
    if (!snake) return;
    snake.forEach((cell, index) => {
        const { x, y } = gridToPx(cell);
        ctx.fillStyle = (index === 0) ? headColor : bodyColor;
        ctx.beginPath(); ctx.roundRect(x, y, TILE, TILE, 3); ctx.fill();
    });
}
const gridToPx = (cell) => ({ x: cell.x * TILE, y: cell.y * TILE + MARGIN });


function draw(state) {
    lastGameState = state;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.font = "20px 'Consolas', monospace";

    const nickA = state.nick_a || 'Gracz A';
    const nickB = state.nick_b || 'Gracz B';

    ctx.fillStyle = 'rgb(90, 220, 110)';
    ctx.fillText(`${nickA}: ${state.score_a}`, 10, 25);

    ctx.fillStyle = 'rgb(90, 140, 220)';
    ctx.textAlign = 'right';
    ctx.fillText(`${nickB}: ${state.score_b}`, WIDTH - 10, 25);
    ctx.textAlign = 'left';

    drawGrid();
    drawFood(state.food);
    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');

    if (state.game_over) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.font = "bold 36px 'Consolas', monospace";
        ctx.fillText(translations[currentLang].gameOver, WIDTH / 2, HEIGHT / 2 - 20);
        if(playerRole !== 'spectator') {
            ctx.font = "16px 'Consolas', monospace";
            const restartText = translations[currentLang].restartInfo.replace('{nickname}', nickA);
            ctx.fillText(restartText, WIDTH / 2, HEIGHT / 2 + 20);
        }
        ctx.textAlign = 'left';
    }
}

// Logika Lobby
function updateRoomListUI(rooms) {
    roomList.innerHTML = '';
    if (rooms.length === 0) {
        roomList.innerHTML = `<p>${translations[currentLang].noRooms}</p>`;
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.classList.add('room-item');

        let lockIcon = room.hasPassword ? '&#128274;' : '';
        roomElement.innerHTML = `
            <span>${translations[currentLang].room} #${room.id.substring(5, 10)} ${lockIcon}</span>
            <span>${translations[currentLang].players}: ${room.playerCount}/2</span>
        `;

        if (room.playerCount < 2) {
            const joinBtn = document.createElement('button');
            joinBtn.textContent = translations[currentLang].joinBtn;
            joinBtn.onclick = () => {
                let password = '';
                if (room.hasPassword) {
                    password = prompt(translations[currentLang].enterPassword);
                    if (password === null) return;
                }
                socket.emit('joinRoom', { roomId: room.id, password: password, nickname: userNickname });
            };
            roomElement.appendChild(joinBtn);
        }
        roomList.appendChild(roomElement);
    });
}

createRoomBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    socket.emit('createRoom', { password: password, nickname: userNickname });
});

// Logika Czat
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value;
    if (message.trim()) {
        socket.emit('chatMessage', message);
        chatInput.value = '';
    }
});

function renderChat() {
    chatMessages.innerHTML = '';
    chatHistory.forEach(data => {
        const p = document.createElement('p');
        let senderName = data.nickname;
        let senderClass = '';

        if (data.role === 'system') {
            senderName = translations[currentLang].system;
            senderClass = 'system';
        } else {
             senderClass = data.role === 'a' ? 'playerA' : 'playerB';
        }

        const strong = document.createElement('strong');
        strong.className = senderClass;
        strong.textContent = `${senderName}: `;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(data.message));

        chatMessages.appendChild(p);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Nasłuchiwanie na Zdarzenia Socket.IO
socket.on('updateRoomList', (rooms) => {
    lastRoomsData = rooms;
    updateRoomListUI(rooms);
});

socket.on('joinedRoom', (data) => {
    playerRole = data.role;
    currentRoomId = data.roomId;
    lobbyContainer.style.display = 'none';
    gameWrapper.style.display = 'flex';
    lastGameState = null;
    chatHistory = [];
    renderChat();
    if (playerRole === 'a') {
        infoPanel.textContent = translations[currentLang].waitingForPlayer.replace('{roomId}', currentRoomId.substring(5, 10));
    }
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameState', (state) => {
    if (infoPanel.textContent.includes('#') || infoPanel.textContent.startsWith("Oczekiwanie")) {
         if (playerRole === 'a') infoPanel.textContent = translations[currentLang].playerAInfo;
         if (playerRole === 'b') infoPanel.textContent = translations[currentLang].playerBInfo;
    }
    draw(state);
});

socket.on('chatMessage', (data) => {
    chatHistory.push(data);
    renderChat();
});

socket.on('opponentLeft', () => {
    alert(translations[currentLang].opponentLeft);
    window.location.reload();
});

// Nasłuchiwanie na klawisze
window.addEventListener('keydown', (e) => {
    if (!playerRole) return;
    if (document.activeElement === chatInput) {
        if (e.key.toLowerCase() === 'r') {
            socket.emit('restartGame');
        }
        return;
    }
    let move = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup': move = { x: 0, y: -1 }; break;
        case 'arrowdown': move = { x: 0, y: 1 }; break;
        case 'arrowleft': move = { x: -1, y: 0 }; break;
        case 'arrowright': move = { x: 1, y: 0 }; break;
        case 'r': socket.emit('restartGame'); break;
    }
    if (move) {
        socket.emit('playerMove', move);
    }
});