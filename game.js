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
const languageOverlay = document.getElementById('languageOverlay');
const languageStatus = document.getElementById('languageStatus');
const customLanguageForm = document.getElementById('customLanguageForm');
const customLanguageInput = document.getElementById('customLanguageInput');
const languageToggle = document.getElementById('languageToggle');
const languageOptionButtons = document.querySelectorAll('.language-option');
const customLanguageSubmit = customLanguageForm ? customLanguageForm.querySelector('button[type="submit"]') : null;
let mainMenuContainer; // Zdefiniowane globalnie

// --- Konfiguracja tłumaczeń z wykorzystaniem AI ---
const BASE_LANGUAGE = 'pl';
let currentLanguage = BASE_LANGUAGE;

const SUPPORTED_LANGUAGES = {
    pl: { nameKey: 'languagePolish', flag: '🇵🇱' },
    en: { nameKey: 'languageEnglish', flag: '🇬🇧' },
    no: { nameKey: 'languageNorwegian', flag: '🇳🇴' },
};

const I18N_STRINGS = {
    appTitle: 'Wieloosobowy Wąż',
    chooseLanguageTitle: 'Wybierz język',
    chooseLanguageDescription: 'Wybierz flagę, aby zmienić język interfejsu. Możesz też wpisać kod dowolnego języka (ISO 639-1).',
    languagePolish: 'Polski',
    languageEnglish: 'Angielski',
    languageNorwegian: 'Norweski',
    customLanguageLabel: 'Inny język (kod ISO 639-1):',
    customLanguagePlaceholder: 'np. es, de',
    customLanguageApply: 'Zastosuj',
    languageStatusIdle: 'Wybierz język, aby rozpocząć.',
    languageStatusLoading: 'Tłumaczę interfejs na {{languageName}}...',
    languageStatusReady: 'Język ustawiono na {{languageName}}.',
    languageStatusError: 'Nie udało się przetłumaczyć. Spróbuj ponownie.',
    languageStatusInvalid: 'Podaj poprawny kod języka (2 litery).',
    languageToggleAria: 'Zmień język',
    lobbyTitle: 'Lobby',
    createRoomSectionTitle: 'Stwórz nowy pokój',
    passwordPlaceholder: 'Hasło (opcjonalne)',
    createRoomButton: 'Stwórz Pokój',
    availableRooms: 'Dostępne Pokoje',
    waitingForOpponent: 'Oczekiwanie na drugiego gracza...',
    chooseModeTitle: 'Wybierz tryb gry',
    singlePlayerButton: 'Gra Jednoosobowa',
    twoPlayerButton: 'Gra Dwuosobowa',
    onlineLobbyButton: 'Online Lobby',
    promptUsername: 'Podaj swoją nazwę użytkownika (min. 3 znaki):',
    usernameTooShort: 'Nazwa użytkownika jest za krótka.',
    singlePlayerControls: "Gracz: Strzałki | Komputer: AI | 'R' - Restart | 'P' - Pauza",
    localTwoPlayerControls: "Gracz A: Strzałki | Gracz B: WASD | 'R' - Restart | 'P' - Pauza",
    onScreenControlsMessage: 'Steruj za pomocą przycisków na ekranie.',
    onlineWaitingAsA: 'Jesteś Graczem A (zielony). Oczekiwanie na drugiego gracza...',
    onlineWaitingAsB: 'Jesteś Graczem B (niebieski). Gra zaraz się rozpocznie!',
    onlineControlsA: 'Gracz A (zielony) | Sterowanie: Strzałki lub WASD',
    onlineControlsB: 'Gracz B (niebieski) | Sterowanie: Strzałki lub WASD',
    registrationErrorPrefix: 'Błąd rejestracji:',
    noRoomsMessage: 'Brak dostępnych pokoi. Stwórz własny!',
    roomName: 'Pokój #{{id}}',
    playersCount: 'Gracze: {{current}}/{{max}}',
    joinButton: 'Dołącz',
    promptRoomPassword: 'Podaj hasło do pokoju:',
    opponentLeftAlert: 'Przeciwnik opuścił grę. Zostaniesz przeniesiony do lobby.',
    scoreSingle: 'Gracz: {{playerScore}}   AI: {{aiScore}}',
    scoreMulti: 'Gracz A: {{scoreA}}   Gracz B: {{scoreB}}',
    timerLabel: 'Czas: {{time}}',
    gameOverTitle: 'KONIEC GRY',
    pressRToPlayAgain: 'Wciśnij R, aby zagrać ponownie.',
    pauseTitle: 'PAUZA',
    browserInfoTitle: 'ℹ️ Info',
    browserLabel: 'Przeglądarka',
    systemLabel: 'System',
    languageLabel: 'Język',
    screenResolutionLabel: 'Rozdzielczość Ekr.',
    viewportLabel: 'Rozmiar Okna',
    unknown: 'Nieznana'
};

const translations = {
    [BASE_LANGUAGE]: { ...I18N_STRINGS }
};

const translationCache = new Map();
const translationPromises = {};
let browserInfoPanel = null;
let browserInfoData = null;

function normalizeLanguageCode(code) {
    if (!code) return '';
    return code.toLowerCase().trim().split(/[-_]/)[0];
}

function t(key, replacements = {}, languageOverride) {
    const lang = languageOverride || currentLanguage;
    const dictionary = translations[lang] || translations[BASE_LANGUAGE] || {};
    let text = dictionary[key] || translations[BASE_LANGUAGE][key] || key;
    if (!text) return '';
    Object.entries(replacements || {}).forEach(([placeholder, value]) => {
        const pattern = new RegExp(`\\{\\{\s*${placeholder}\s*\\}\}`, 'g');
        text = text.replace(pattern, String(value));
    });
    return text;
}

function setElementTranslation(element, key, replacements = {}) {
    if (!element) return;
    element.dataset.i18nKey = key;
    if (replacements && Object.keys(replacements).length > 0) {
        element.dataset.i18nArgs = JSON.stringify(replacements);
    } else {
        delete element.dataset.i18nArgs;
    }
    const attr = element.dataset.i18nAttr || 'textContent';
    const value = t(key, replacements);
    if (attr === 'textContent') {
        element.textContent = value;
    } else {
        element.setAttribute(attr, value);
    }
}

function applyTranslationsToDom() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.dataset.i18nKey;
        if (!key) return;
        let replacements = {};
        if (element.dataset.i18nArgs) {
            try {
                replacements = JSON.parse(element.dataset.i18nArgs);
            } catch (error) {
                console.warn('Nie można sparsować argumentów tłumaczenia:', error);
            }
        }
        const attr = element.dataset.i18nAttr || 'textContent';
        const value = t(key, replacements);
        if (attr === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(attr, value);
        }
    });
}

async function translateTextUsingAI(text, targetLanguage) {
    if (!text || !text.trim() || targetLanguage === BASE_LANGUAGE) return text;
    const cacheKey = `${targetLanguage}::${text}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            q: text,
            source: 'pl',
            target: targetLanguage,
            format: 'text'
        })
    });

    if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }
    const translated = data.translatedText || text;
    translationCache.set(cacheKey, translated);
    return translated;
}

async function ensureLanguage(language) {
    if (!language || language === BASE_LANGUAGE || translations[language]) return;
    if (translationPromises[language]) {
        await translationPromises[language];
        return;
    }

    translationPromises[language] = (async () => {
        const translated = {};
        for (const [key, baseText] of Object.entries(I18N_STRINGS)) {
            translated[key] = await translateTextUsingAI(baseText, language);
        }
        translations[language] = translated;
    })();

    await translationPromises[language];
}

function getLanguageDisplayName(language, dictionaryLanguage = currentLanguage) {
    const normalized = normalizeLanguageCode(language);
    if (!normalized) return '';
    const supported = SUPPORTED_LANGUAGES[normalized];
    if (supported) {
        const dictionary = translations[dictionaryLanguage] || translations[BASE_LANGUAGE];
        if (dictionary && dictionary[supported.nameKey]) {
            return dictionary[supported.nameKey];
        }
    }
    return normalized.toUpperCase();
}

function disableLanguageControls(disabled) {
    languageOptionButtons.forEach(button => {
        button.disabled = disabled;
    });
    if (customLanguageInput) customLanguageInput.disabled = disabled;
    if (customLanguageSubmit) customLanguageSubmit.disabled = disabled;
}

function showLanguageOverlay(resetStatus = false) {
    if (!languageOverlay) return;
    languageOverlay.style.display = 'flex';
    languageOverlay.classList.add('visible');
    languageOverlay.removeAttribute('aria-hidden');
    if (resetStatus) {
        setElementTranslation(languageStatus, 'languageStatusIdle');
        if (customLanguageInput) customLanguageInput.value = '';
    }
}

function hideLanguageOverlay() {
    if (!languageOverlay) return;
    languageOverlay.classList.remove('visible');
    languageOverlay.setAttribute('aria-hidden', 'true');
    languageOverlay.style.display = 'none';
}

async function setLanguage(languageCode) {
    const normalized = normalizeLanguageCode(languageCode);
    if (!normalized) {
        throw new Error('invalid_language');
    }

    await ensureLanguage(normalized);
    currentLanguage = normalized;
    document.documentElement.lang = normalized;
    applyTranslationsToDom();
    if (browserInfoPanel) {
        renderBrowserInfoPanel();
    }
    redrawCurrentGameState();
    const languageName = getLanguageDisplayName(normalized);
    setElementTranslation(languageStatus, 'languageStatusReady', { languageName });
    hideLanguageOverlay();
    if (languageToggle) {
        languageToggle.style.display = 'inline-flex';
    }
    if (customLanguageInput) {
        customLanguageInput.value = '';
    }
    return normalized;
}

async function handleLanguageSelection(languageCode) {
    const normalized = normalizeLanguageCode(languageCode);
    if (!normalized || normalized.length < 2) {
        setElementTranslation(languageStatus, 'languageStatusInvalid');
        return;
    }
    disableLanguageControls(true);
    const languageName = getLanguageDisplayName(normalized);
    setElementTranslation(languageStatus, 'languageStatusLoading', { languageName });
    try {
        await setLanguage(normalized);
    } catch (error) {
        console.error('Language change failed:', error);
        setElementTranslation(languageStatus, 'languageStatusError');
    } finally {
        disableLanguageControls(false);
    }
}

async function translateDynamicMessage(message) {
    if (!message) return '';
    if (currentLanguage === BASE_LANGUAGE) return message;
    try {
        return await translateTextUsingAI(message, currentLanguage);
    } catch (error) {
        console.error('Dynamic translation failed:', error);
        return message;
    }
}

function redrawCurrentGameState() {
    if (gameMode === 'local' || gameMode === 'localSingle') {
        if (localGameState && localGameState.snake_a) {
            draw(localGameState);
        }
    } else if (gameMode === 'online' && lastGameState) {
        draw(lastGameState);
    }
}

function setupLanguageSelector() {
    if (languageOptionButtons && languageOptionButtons.length > 0) {
        languageOptionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lang = button.dataset.lang;
                if (lang) {
                    handleLanguageSelection(lang);
                }
            });
        });
    }
    if (customLanguageForm) {
        customLanguageForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const code = customLanguageInput ? customLanguageInput.value : '';
            handleLanguageSelection(code);
        });
    }
    if (languageToggle) {
        languageToggle.addEventListener('click', () => {
            showLanguageOverlay(true);
        });
    }
    if (languageStatus) {
        setElementTranslation(languageStatus, 'languageStatusIdle');
    }
    if (languageOverlay) {
        showLanguageOverlay(false);
    }
}

function renderBrowserInfoPanel() {
    if (!browserInfoPanel || !browserInfoData) return;
    const infoTitle = t('browserInfoTitle');
    const browserLabel = t('browserLabel');
    const systemLabel = t('systemLabel');
    const languageLabelText = t('languageLabel');
    const screenLabel = t('screenResolutionLabel');
    const viewportLabel = t('viewportLabel');

    browserInfoPanel.innerHTML = `
        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: white;">${infoTitle}</h3>
        <ul style="list-style-type: none; padding: 0; margin: 0; line-height: 1.6;">
            <li><strong>${browserLabel}:</strong> ${browserInfoData.browser}</li>
            <li><strong>${systemLabel}:</strong> ${browserInfoData.os}</li>
            <li><strong>${languageLabelText}:</strong> ${browserInfoData.language}</li>
            <li><strong>${screenLabel}:</strong> ${browserInfoData.screenResolution}</li>
            <li><strong>${viewportLabel}:</strong> ${browserInfoData.viewport}</li>
        </ul>
    `;
}

// --- Zmienne stanu gry ---
let gameMode = 'menu'; // 'menu', 'online', 'local', 'localSingle'
let playerRole = null;
let localGameState = {};
let localGameInterval = null;
let gameTimerInterval = null; // Interwał dla licznika czasu
let elapsedTime = 0; // Czas gry w sekundach
let isPaused = false;
let lastGameState = null;
let dir_a, dir_b, next_dir_a, next_dir_b;

/**
 * Sprawdza, czy strona jest uruchomiona na urządzeniu mobilnym.
 * @returns {boolean}
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}


// --- Logika Menu Głównego ---
function initializeMainMenu() {
    mainMenuContainer = document.createElement('div');
    mainMenuContainer.id = 'mainMenuContainer';
    mainMenuContainer.style.textAlign = 'center';
    mainMenuContainer.style.paddingTop = '5vh';
    mainMenuContainer.style.fontFamily = "'Consolas', monospace";

    const title = document.createElement('h1');
    setElementTranslation(title, 'chooseModeTitle');
    title.style.color = 'rgb(230, 230, 230)';
    title.style.fontSize = '3em';
    title.style.marginBottom = '40px';
    mainMenuContainer.appendChild(title);

    const singlePlayerBtn = document.createElement('button');
    setElementTranslation(singlePlayerBtn, 'singlePlayerButton');

    const twoPlayerBtn = document.createElement('button');
    setElementTranslation(twoPlayerBtn, 'twoPlayerButton');

    const onlineLobbyBtn = document.createElement('button');
    setElementTranslation(onlineLobbyBtn, 'onlineLobbyButton');

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

    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'none';

    singlePlayerBtn.addEventListener('click', () => {
        startLocalSinglePlayerGame();
    });

    twoPlayerBtn.addEventListener('click', () => {
        startLocalTwoPlayerGame();
    });

    onlineLobbyBtn.addEventListener('click', async () => {
        await promptForUsernameAndEnterLobby();
    });

// NOWA FUNKCJA DO LOGOWANIA UŻYTKOWNIKA
async function promptForUsernameAndEnterLobby() {
    const promptMessage = t('promptUsername');
    let username = prompt(promptMessage);
    if (username && username.trim().length >= 3) {
        socket.emit('registerUser', username.trim());
    } else if (username !== null) { // Jeśli użytkownik nie kliknął 'Anuluj'
        alert(t('usernameTooShort'));
    }
}
}

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

function addResponsiveStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        body {
            /* Zapobiega scrollowaniu strony przez dotyk */
            touch-action: none; 
        }

        /* Style dla kontrolek dotykowych */
        #controlsContainer {
            position: fixed;
            bottom: 20px;
            width: 100%;
            display: none; /* Domyślnie ukryte */
            justify-content: center;
            align-items: center;
            z-index: 100;
            user-select: none; /* Zapobiega zaznaczaniu tekstu */
            -webkit-user-select: none; /* Dla Safari */
        }

        .dpad {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            width: 180px;
            height: 180px;
            gap: 5px;
        }

        .control-btn {
            background-color: rgba(80, 80, 80, 0.7);
            border: 2px solid rgba(120, 120, 120, 0.8);
            border-radius: 12px;
            color: white;
            font-size: 2.5em;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            backdrop-filter: blur(3px);
        }

        .control-btn:active {
            background-color: rgba(110, 110, 110, 0.9);
        }

        #upBtn    { grid-column: 2; grid-row: 1; }
        #leftBtn  { grid-column: 1; grid-row: 2; }
        #rightBtn { grid-column: 3; grid-row: 2; }
        #downBtn  { grid-column: 2; grid-row: 3; }

        /* Media query dla urządzeń mobilnych */
        @media (max-width: 768px) {
            #gameCanvas {
                width: 100%;
                height: auto;
            }
            #infoPanel {
                font-size: 0.8em; /* Zmniejsz czcionkę panelu info */
            }
            #browserInfoPanel {
                display: none; /* Opcjonalnie ukryj panel z info o przeglądarce */
            }
            #mainMenuContainer button {
                width: 80%; /* Przyciski menu na całą szerokość */
            }
        }
    `;
    document.head.appendChild(style);
}

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

    // Rysowanie wyników
    const scoreText = (gameMode === 'localSingle')
        ? t('scoreSingle', { playerScore: state.score_a, aiScore: state.score_b })
        : t('scoreMulti', { scoreA: state.score_a, scoreB: state.score_b });
    ctx.textAlign = 'left';
    ctx.fillText(scoreText, 10, 25);

    // Rysowanie licznika czasu
    ctx.textAlign = 'right';
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = (elapsedTime % 60).toString().padStart(2, '0');
    ctx.fillText(t('timerLabel', { time: `${minutes}:${seconds}` }), WIDTH - 5, 25);
    ctx.textAlign = 'left'; // Resetowanie wyrównania

    // Znak wodny
    ctx.save();
    ctx.font = "bold 60px 'Consolas', monospace";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Serious Seris", WIDTH / 2, HEIGHT / 2 + MARGIN / 2);
    ctx.restore();

    drawGrid();
    drawFood(state.food);
    drawSnakeColored(state.snake_a, 'rgb(90, 220, 110)', 'rgb(50, 180, 90)');
    drawSnakeColored(state.snake_b, 'rgb(90, 140, 220)', 'rgb(50, 90, 180)');

    if (state.game_over) {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.font = "bold 36px 'Consolas', monospace";
        ctx.fillText(t('gameOverTitle'), WIDTH / 2, HEIGHT / 2 - 20);
        ctx.font = "16px 'Consolas', monospace";
        ctx.fillText(t('pressRToPlayAgain'), WIDTH / 2, HEIGHT / 2 + 20);
        ctx.textAlign = 'left';
    } else if (isPaused) { // <-- DODANY WARUNEK DLA PAUZY
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.font = "bold 36px 'Consolas', monospace";
        ctx.fillText(t('pauseTitle'), WIDTH / 2, HEIGHT / 2);
        ctx.textAlign = 'left';
    }
}

// --- Logika Gry Lokalnej ---
function generateFood() {
    const allSnakeCells = [...localGameState.snake_a, ...localGameState.snake_b];
    let foodPos;
    do {
        foodPos = {
            x: Math.floor(Math.random() * GRID_W),
            y: Math.floor(Math.random() * GRID_H)
        };
    } while (allSnakeCells.some(cell => cell.x === foodPos.x && cell.y === foodPos.y));
    localGameState.food = foodPos;
}

function startTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    elapsedTime = 0;
    gameTimerInterval = setInterval(() => {
        elapsedTime++;
    }, 1000);
}

function resumeTimer() {
    // Ta funkcja wznawia licznik bez resetowania go.
    if (gameTimerInterval) clearInterval(gameTimerInterval); // Zabezpieczenie przed podwójnym licznikiem
    gameTimerInterval = setInterval(() => {
        elapsedTime++;
    }, 1000);
}

// --- Logika Gry Jednoosobowej (z AI) ---
function startLocalSinglePlayerGame() {
    gameMode = 'localSingle';
    playerRole = 'a'; // Player is always 'a'
    mainMenuContainer.style.display = 'none';
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (localGameInterval) clearInterval(localGameInterval);

    localGameState = {
        snake_a: [{ x: 10, y: 10 }], // Player
        snake_b: [{ x: GRID_W - 11, y: 10 }], // AI
        food: {},
        score_a: 0,
        score_b: 0,
        game_over: false,
    };

    dir_a = { x: 1, y: 0 };
    dir_b = { x: -1, y: 0 };
    next_dir_a = { x: 1, y: 0 };
    next_dir_b = { x: -1, y: 0 };

    setElementTranslation(infoPanel, 'singlePlayerControls');
    generateFood();
    startTimer(); // Uruchom licznik czasu
    localGameInterval = setInterval(localSinglePlayerGameLoop, 100);
}

function getAiNextMove() {
    const head = localGameState.snake_b[0];
    const food = localGameState.food;
    const allObstacles = [...localGameState.snake_a, ...localGameState.snake_b];

    const isCellUnsafe = (cell) => {
        if (cell.x < 0 || cell.x >= GRID_W || cell.y < 0 || cell.y >= GRID_H) return true;
        for (const segment of allObstacles) {
            if (cell.x === segment.x && cell.y === segment.y) return true;
        }
        return false;
    };

    const moves = [
        { dir: { x: 0, y: -1 }, name: 'up' },
        { dir: { x: 0, y: 1 }, name: 'down' },
        { dir: { x: -1, y: 0 }, name: 'left' },
        { dir: { x: 1, y: 0 }, name: 'right' }
    ];

    const possibleMoves = moves.filter(move => !(move.dir.x === -dir_b.x && move.dir.y === -dir_b.y));

    let bestMove = null;
    let minDistance = Infinity;

    for (const move of possibleMoves) {
        const nextCell = { x: head.x + move.dir.x, y: head.y + move.dir.y };
        if (!isCellUnsafe(nextCell)) {
            const distance = Math.abs(nextCell.x - food.x) + Math.abs(nextCell.y - food.y);
            if (distance < minDistance) {
                minDistance = distance;
                bestMove = move.dir;
            }
        }
    }

    if (!bestMove) {
        for (const move of possibleMoves) {
            const nextCell = { x: head.x + move.dir.x, y: head.y + move.dir.y };
            if (!isCellUnsafe(nextCell)) {
                bestMove = move.dir;
                break;
            }
        }
    }

    if (!bestMove) bestMove = dir_b;

    next_dir_b = bestMove;
}


function localSinglePlayerGameLoop() {
    if (localGameState.game_over) return;

    getAiNextMove();

    dir_a = next_dir_a;
    dir_b = next_dir_b;

    const head_a = { x: localGameState.snake_a[0].x + dir_a.x, y: localGameState.snake_a[0].y + dir_a.y };
    localGameState.snake_a.unshift(head_a);

    const head_b = { x: localGameState.snake_b[0].x + dir_b.x, y: localGameState.snake_b[0].y + dir_b.y };
    localGameState.snake_b.unshift(head_b);

    const isCollision = (snake) => {
        const head = snake[0];
        if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) return true;
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) return true;
        }
        return false;
    };

    for (let i = 0; i < localGameState.snake_b.length; i++) {
        if (head_a.x === localGameState.snake_b[i].x && head_a.y === localGameState.snake_b[i].y) {
            localGameState.game_over = true;
        }
    }
    for (let i = 0; i < localGameState.snake_a.length; i++) {
        if (head_b.x === localGameState.snake_a[i].x && head_b.y === localGameState.snake_a[i].y) {
            localGameState.game_over = true;
        }
    }

    if (isCollision(localGameState.snake_a) || isCollision(localGameState.snake_b) || localGameState.game_over) {
        localGameState.game_over = true;
        clearInterval(localGameInterval);
        draw(localGameState);
        return;
    }

    let ateFoodA = head_a.x === localGameState.food.x && head_a.y === localGameState.food.y;
    if (ateFoodA) {
        localGameState.score_a++;
        generateFood();
    } else {
        localGameState.snake_a.pop();
    }

    let ateFoodB = head_b.x === localGameState.food.x && head_b.y === localGameState.food.y;
    if (ateFoodB) {
        localGameState.score_b++;
        if (!ateFoodA) generateFood();
    } else {
        localGameState.snake_b.pop();
    }

    draw(localGameState);
}


function startLocalTwoPlayerGame() {
    gameMode = 'local';
    playerRole = null;
    mainMenuContainer.style.display = 'none';
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (localGameInterval) clearInterval(localGameInterval);

    localGameState = {
        snake_a: [{ x: 10, y: 10 }],
        snake_b: [{ x: GRID_W - 11, y: 10 }],
        food: {},
        score_a: 0,
        score_b: 0,
        game_over: false,
    };

    dir_a = { x: 1, y: 0 };
    dir_b = { x: -1, y: 0 };
    next_dir_a = { x: 1, y: 0 };
    next_dir_b = { x: -1, y: 0 };

    setElementTranslation(infoPanel, 'localTwoPlayerControls');
    generateFood();
    startTimer(); // Uruchom licznik czasu
    localGameInterval = setInterval(localGameLoop, 100);
}

function localGameLoop() {
    if (localGameState.game_over) return;

    dir_a = next_dir_a;
    dir_b = next_dir_b;

    // --- Ruch Węży ---
    const head_a = { x: localGameState.snake_a[0].x + dir_a.x, y: localGameState.snake_a[0].y + dir_a.y };
    localGameState.snake_a.unshift(head_a);

    const head_b = { x: localGameState.snake_b[0].x + dir_b.x, y: localGameState.snake_b[0].y + dir_b.y };
    localGameState.snake_b.unshift(head_b);

    // --- Kolizje ---
    const isCollision = (snake) => {
        const head = snake[0];
        if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) return true;
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) return true;
        }
        return false;
    };

    for (let i = 0; i < localGameState.snake_b.length; i++) {
        if (head_a.x === localGameState.snake_b[i].x && head_a.y === localGameState.snake_b[i].y) {
            localGameState.game_over = true;
        }
    }
    for (let i = 0; i < localGameState.snake_a.length; i++) {
        if (head_b.x === localGameState.snake_a[i].x && head_b.y === localGameState.snake_a[i].y) {
            localGameState.game_over = true;
        }
    }


    if (isCollision(localGameState.snake_a) || isCollision(localGameState.snake_b) || localGameState.game_over) {
        localGameState.game_over = true;
        clearInterval(localGameInterval);
        draw(localGameState);
        return;
    }

    // --- Jedzenie ---
    let ateFoodA = head_a.x === localGameState.food.x && head_a.y === localGameState.food.y;
    if (ateFoodA) {
        localGameState.score_a++;
        generateFood();
    } else {
        localGameState.snake_a.pop();
    }

    let ateFoodB = head_b.x === localGameState.food.x && head_b.y === localGameState.food.y;
    if (ateFoodB) {
        localGameState.score_b++;
        if (!ateFoodA) generateFood();
    } else {
        localGameState.snake_b.pop();
    }

    draw(localGameState);
}

// =====================================================================
// === NOWA SEKCJA - OBSŁUGA STEROWANIA NA URZĄDZENIACH MOBILNYCH ===
// =====================================================================

function initializeMobileControls() {
    // 1. Stworzenie kontenera na przyciski
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controlsContainer';

    // 2. Struktura D-Pada
    controlsContainer.innerHTML = `
        <div class="dpad">
            <div id="upBtn" class="control-btn">↑</div>
            <div id="leftBtn" class="control-btn">←</div>
            <div id="rightBtn" class="control-btn">→</div>
            <div id="downBtn" class="control-btn">↓</div>
        </div>
    `;
    document.body.appendChild(controlsContainer);

    // 3. Funkcja do obsługi ruchu
    const handleMove = (move) => {
        // Logika dla gry online
        if (gameMode === 'online' && playerRole) {
            socket.emit('playerMove', move);
        }
        // Logika dla gry lokalnej (gracz A jest sterowany dotykiem)
        else if (gameMode === 'local' || gameMode === 'localSingle') {
            const currentDir = dir_a;
            // Zapobiegaj ruchowi w przeciwnym kierunku
            if (move.x !== 0 && currentDir.x === 0) next_dir_a = move;
            if (move.y !== 0 && currentDir.y === 0) next_dir_a = move;
        }
    };

    // 4. Mapowanie przycisków do kierunków i dodawanie event listenerów
    const controlMapping = {
        'upBtn': { x: 0, y: -1 },
        'downBtn': { x: 0, y: 1 },
        'leftBtn': { x: -1, y: 0 },
        'rightBtn': { x: 1, y: 0 }
    };

    for (const [btnId, move] of Object.entries(controlMapping)) {
        const button = document.getElementById(btnId);
        // 'touchstart' dla urządzeń mobilnych
        button.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Zapobiega "ghost click" i scrollowaniu
            handleMove(move);
        }, { passive: false });
        // 'mousedown' do testowania na komputerze
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleMove(move);
        });
    }

    // Pokaż kontrolki, gdy gra się rozpocznie
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const gameContainerVisible = gameContainer.style.display === 'block';
                controlsContainer.style.display = gameContainerVisible ? 'flex' : 'none';
            }
        });
    });

    observer.observe(gameContainer, { attributes: true });
}


// --- Logika Lobby Online ---
function updateRoomList(rooms) {
    roomList.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        const emptyMessage = document.createElement('p');
        setElementTranslation(emptyMessage, 'noRoomsMessage');
        roomList.appendChild(emptyMessage);
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.classList.add('room-item');

        const nameContainer = document.createElement('span');
        const roomNameText = document.createElement('span');
        setElementTranslation(roomNameText, 'roomName', { id: room.id.substring(5, 10) });
        nameContainer.appendChild(roomNameText);
        if (room.hasPassword) {
            const lockSpan = document.createElement('span');
            lockSpan.textContent = ' 🔒';
            lockSpan.setAttribute('aria-hidden', 'true');
            nameContainer.appendChild(lockSpan);
        }

        const playersSpan = document.createElement('span');
        setElementTranslation(playersSpan, 'playersCount', { current: room.playerCount, max: 2 });

        roomElement.appendChild(nameContainer);
        roomElement.appendChild(playersSpan);

        if (room.playerCount < 2) {
            const joinBtn = document.createElement('button');
            setElementTranslation(joinBtn, 'joinButton');
            joinBtn.addEventListener('click', () => {
                let password = '';
                if (room.hasPassword) {
                    const promptText = t('promptRoomPassword');
                    const input = prompt(promptText);
                    if (input === null) return;
                    password = input;
                }
                socket.emit('joinRoom', { roomId: room.id, password });
            });
            roomElement.appendChild(joinBtn);
        }

        roomList.appendChild(roomElement);
    });
}

createRoomBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    socket.emit('createRoom', { password: password });
});

// --- Nasłuchiwanie na Zdarzenia Socket.IO ---
socket.on('registerError', async (message) => {
    const prefix = t('registrationErrorPrefix');
    const translatedMessage = await translateDynamicMessage(message);
    alert(`${prefix} ${translatedMessage}`);
    // Opcjonalnie: zapytaj ponownie o nazwę użytkownika
    // promptForUsernameAndEnterLobby();
});

socket.on('registeredSuccessfully', () => {
    console.log('Rejestracja pomyślna! Wchodzę do lobby.');
    gameMode = 'online';
    mainMenuContainer.style.display = 'none';
    lobbyContainer.style.display = 'block';
});

socket.on('updateRoomList', (rooms) => updateRoomList(rooms));
socket.on('joinedRoom', (data) => {
    playerRole = data.role;
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    startTimer(); // Uruchom licznik czasu
    if (data.role === 'a') {
        setElementTranslation(infoPanel, 'onlineWaitingAsA');
    } else if (data.role === 'b') {
        setElementTranslation(infoPanel, 'onlineWaitingAsB');
    }
});
socket.on('joinError', async (message) => {
    const translatedMessage = await translateDynamicMessage(message);
    alert(translatedMessage);
});
socket.on('gameState', (state) => {
    lastGameState = state;
    if (playerRole && state.score_a === 0 && state.score_b === 0 && !state.game_over) {
        if (playerRole === 'a') setElementTranslation(infoPanel, 'onlineControlsA');
        if (playerRole === 'b') setElementTranslation(infoPanel, 'onlineControlsB');
    }
    if (!isPaused) { // Rysuj tylko, jeśli gra nie jest spauzowana po stronie klienta
      draw(state);
    }
});
socket.on('opponentLeft', () => {
    if (gameTimerInterval) clearInterval(gameTimerInterval); // Zatrzymaj licznik
    alert(t('opponentLeftAlert'));
    window.location.reload();
});

socket.on('pauseStateChanged', (paused) => {
    isPaused = paused;
    if (isPaused) {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
    } else {
        resumeTimer(); // Używamy nowej funkcji, aby nie resetować czasu
    }
    // Wymuszamy przerysowanie, aby natychmiast pokazać/ukryć ekran pauzy
    // To wymaga przechowywania ostatniego stanu gry.
    // Jeśli lastGameState nie jest jeszcze zaimplementowane, dodajmy to:
});

// --- Sterowanie Klawiaturą ---
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();

    // KROK 1: Obsługa klawisza pauzy ('P') ma absolutny priorytet.
    // To pozwala zarówno włączyć, jak i wyłączyć pauzę.
    if (key === 'p') {
        if (gameMode === 'online') {
            socket.emit('togglePause');
        } else if (gameMode === 'local' || gameMode === 'localSingle') {
            isPaused = !isPaused;
            if (isPaused) {
                clearInterval(localGameInterval);
                clearInterval(gameTimerInterval);
                draw(localGameState); // Narysuj ekran pauzy od razu
            } else {
                resumeTimer(); // Wznów licznik bez resetowania
                const loopFunction = gameMode === 'local' ? localGameLoop : localSinglePlayerGameLoop;
                localGameInterval = setInterval(loopFunction, 100);
                draw(localGameState); // Przerysuj od razu, by schować ekran pauzy
            }
        }
        return; // Zakończ po obsłużeniu pauzy
    }

    // KROK 2: Jeśli gra jest spauzowana, ignoruj wszystkie inne klawisze.
    if (isPaused) return;

    // KROK 3: Standardowa obsługa sterowania i restartu ('R').
    if (gameMode === 'online' && playerRole) {
        let move = null;
        switch (key) {
            case 'arrowup': case 'w': move = { x: 0, y: -1 }; break;
            case 'arrowdown': case 's': move = { x: 0, y: 1 }; break;
            case 'arrowleft': case 'a': move = { x: -1, y: 0 }; break;
            case 'arrowright': case 'd': move = { x: 1, y: 0 }; break;
            case 'r': socket.emit('restartGame'); break;
        }
        if (move) socket.emit('playerMove', move);
    } else if (gameMode === 'local') {
        if (key === 'arrowup' && dir_a.y === 0) next_dir_a = { x: 0, y: -1 };
        else if (key === 'arrowdown' && dir_a.y === 0) next_dir_a = { x: 0, y: 1 };
        else if (key === 'arrowleft' && dir_a.x === 0) next_dir_a = { x: -1, y: 0 };
        else if (key === 'arrowright' && dir_a.x === 0) next_dir_a = { x: 1, y: 0 };
        else if (key === 'w' && dir_b.y === 0) next_dir_b = { x: 0, y: -1 };
        else if (key === 's' && dir_b.y === 0) next_dir_b = { x: 0, y: 1 };
        else if (key === 'a' && dir_b.x === 0) next_dir_b = { x: -1, y: 0 };
        else if (key === 'd' && dir_b.x === 0) next_dir_b = { x: 1, y: 0 };
        else if (key === 'r') startLocalTwoPlayerGame();
    } else if (gameMode === 'localSingle') {
        if (key === 'arrowup' && dir_a.y === 0) next_dir_a = { x: 0, y: -1 };
        else if (key === 'arrowdown' && dir_a.y === 0) next_dir_a = { x: 0, y: 1 };
        else if (key === 'arrowleft' && dir_a.x === 0) next_dir_a = { x: -1, y: 0 };
        else if (key === 'arrowright' && dir_a.x === 0) next_dir_a = { x: 1, y: 0 };
        else if (key === 'r') startLocalSinglePlayerGame();
    }
});


// =========================================================================
// === POBIERANIE I WYŚWIETLANIE INFORMACJI O PRZEGLĄDARCE ===
// =========================================================================

/**
 * Tworzy i wyświetla panel z informacjami o przeglądarce i systemie użytkownika.
 */
function initializeBrowserInfoPanel() {
    browserInfoPanel = document.createElement('div');
    browserInfoPanel.id = 'browserInfoPanel';

    Object.assign(browserInfoPanel.style, {
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        padding: '10px 15px',
        backgroundColor: 'rgba(20, 20, 20, 0.85)',
        border: '1px solid rgb(90, 90, 90)',
        borderRadius: '8px',
        color: 'rgb(200, 200, 200)',
        fontFamily: "'Consolas', monospace",
        fontSize: '12px',
        zIndex: '100',
        backdropFilter: 'blur(3px)'
    });

    const ua = navigator.userAgent;
    let browserName = t('unknown');
    if (ua.includes('Firefox')) {
        browserName = 'Mozilla Firefox';
    } else if (ua.includes('Edg')) {
        browserName = 'Microsoft Edge';
    } else if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browserName = 'Google Chrome';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browserName = 'Apple Safari';
    }

    browserInfoData = {
        browser: browserName,
        os: navigator.platform,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`
    };

    socket.emit('clientBrowserInfo', { ...browserInfoData });

    renderBrowserInfoPanel();
    document.body.appendChild(browserInfoPanel);

    window.addEventListener('resize', () => {
        if (!browserInfoData) return;
        browserInfoData.viewport = `${window.innerWidth}x${window.innerHeight}`;
        renderBrowserInfoPanel();
    });
}


// --- Główne wywołanie po załadowaniu DOM ---
window.addEventListener('DOMContentLoaded', () => {
    addResponsiveStyles(); // <- DODANE WYWOŁANIE STYLÓW
    setupLanguageSelector();
    initializeMainMenu();
    initializeBrowserInfoPanel();
    applyTranslationsToDom();

    // Sprawdź, czy to urządzenie mobilne i dodaj kontrolki
    if (isMobileDevice()) {
        initializeMobileControls(); // <- DODANE WYWOŁANIE KONTROLEK

        // Na urządzeniach mobilnych, informacja o sterowaniu klawiaturą jest bezużyteczna
        setElementTranslation(infoPanel, 'onScreenControlsMessage');
    }
});