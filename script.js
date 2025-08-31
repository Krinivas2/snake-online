// script.js (nowa wersja)

// Połącz się z serwerem
const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// ... (wszystkie stałe i ustawienia canvas bez zmian) ...

let playerRole = null; // Czy jestem graczem 'A' czy 'B'?

// Serwer informuje nas, którym graczem jesteśmy
socket.on('playerAssignment', (role) => {
    playerRole = role;
    console.log(`Jesteś graczem ${playerRole}`);
});

// Serwer wysyła nam pełny stan gry do narysowania
socket.on('gameState', (state) => {
    // Funkcja draw() teraz rysuje dane otrzymane z serwera
    draw(state);
});

socket.on('serverFull', (message) => {
    alert(message);
});


// Funkcja rysująca (prawie bez zmian, ale używa danych z serwera)
function draw(state) {
    // Czyści ekran
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Rysuje wyniki, siatkę itp. na podstawie `state`
    // ...

    // Rysuje węże i jedzenie z `state`
    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');
    drawFood(state.food);

    // ... rysowanie ekranu pauzy/końca gry ...
}

// Wysyłaj informacje o wciśniętych klawiszach do serwera
window.addEventListener('keydown', e => {
    // Wysyłamy tylko klawisze sterujące
    const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd'];
    if (validKeys.includes(e.key)) {
        socket.emit('keydown', e.key);
    }
});

// Reszta kodu (np. funkcje rysujące jak drawGrid, drawFood) pozostaje taka sama.
// Funkcje takie jak gameTick(), resetGame() są usuwane z klienta i przenoszone na serwer.