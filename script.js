 // --- DOM Element Selection ---
const gameModeSelection = document.getElementById('game-mode-selection');
const playerNameInputScreen = document.getElementById('player-name-input');
const gameContainer = document.getElementById('game-container');
const gameBoard = document.getElementById('game-board');
const statusDisplay = document.getElementById('status');
const restartButton = document.getElementById('restart-button');
const resetScoreButton = document.getElementById('reset-score-button');
const changeModeButton = document.getElementById('change-mode-button');
const gameTipButton = document.getElementById('game-tip-button');
const gameAnalysisButton = document.getElementById('game-analysis-button');
const winningLine = document.querySelector('.winning-line');
const gameButtonsContainer = document.getElementById('game-buttons-container');

// Name and Score display elements
const playerXNameInput = document.getElementById('player-x-name');
const playerONameInput = document.getElementById('player-o-name');
const playerOInputGroup = document.getElementById('player-o-input-group');
const startGameButton = document.getElementById('start-game-button');
const backToModeButton = document.getElementById('back-to-mode-button');
const playerXNameDisplay = document.getElementById('player-x-name-display');
const playerONameDisplay = document.getElementById('player-o-name-display');
const playerXScoreDisplay = document.getElementById('player-x-score-display');
const playerOScoreDisplay = document.getElementById('player-o-score-display');

// Modal elements
const llmModal = document.getElementById('llm-modal');
const closeModalButton = document.getElementById('close-modal-button');
const modalTitle = document.getElementById('modal-title');
const modalContentText = document.getElementById('modal-content-text');
const spinner = document.querySelector('.spinner');

// --- Game State Variables ---
let gameActive = true;
let currentPlayer = 'X';
let gameState = ["", "", "", "", "", "", "", "", ""];
let gameMode = null; // 'pvp' or 'pva'
const playerSymbol = 'X';
const aiSymbol = 'O';

let playerXName = 'Player X';
let playerOName = 'Player O';
let playerXScore = 0;
let playerOScore = 0;

// --- Sound Effects ---
const clickSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"+Array(1e3).join("12121313"));
const winSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"+Array(1e3).join("34565434"));
const drawSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAgAZGF0YU"+Array(1e3).join("65434321"));

// --- Winning Conditions ---
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- Messages ---
const winningMessage = () => `${currentPlayer === 'X' ? playerXName : playerOName} has won!`;
const drawMessage = () => `Game ended in a draw!`;
const currentPlayerTurn = () => `${currentPlayer === 'X' ? playerXName : playerOName}'s turn`;

// --- Gemini API Call Function ---

/**
 * Fetches a response from the Gemini LLM API.
 * @param {string} prompt - The prompt to send to the LLM.
 * @returns {Promise<string>} - The generated text response.
 */
async function getLlmResponse(prompt) {
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiKey = ""
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    let retries = 0;
    const maxRetries = 5;
    let delay = 1000; // 1 second
    
    while (retries < maxRetries) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429) { // Too Many Requests
                    throw new Error('Rate limit exceeded');
                } else {
                    throw new Error(`API call failed with status: ${response.status}`);
                }
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                return result.candidates[0].content.parts[0].text;
            } else {
                throw new Error('Unexpected API response format');
            }
        } catch (error) {
            if (error.message === 'Rate limit exceeded' && retries < maxRetries - 1) {
                retries++;
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
            } else {
                console.error("Error fetching LLM response:", error);
                return "Sorry, I couldn't get a response. Please try again.";
            }
        }
    }
    return "Sorry, I couldn't get a response after multiple attempts. Please try again later.";
}

// --- Game Logic Functions ---

/**
 * Navigates to the player name input screen based on the selected mode.
 * @param {string} mode - The game mode ('pvp' or 'pva').
 */
function showNameInput(mode) {
    gameMode = mode;
    gameModeSelection.classList.add('hidden');
    playerNameInputScreen.classList.remove('hidden');

    playerXNameInput.value = '';
    playerONameInput.value = '';

    if (mode === 'pva') {
        playerOInputGroup.classList.add('hidden');
        playerXNameInput.placeholder = "e.g., Player";
    } else {
        playerOInputGroup.classList.remove('hidden');
        playerXNameInput.placeholder = "e.g., Alice";
        playerONameInput.placeholder = "e.g., Bob";
    }
}

/**
 * Starts the game with the entered player names.
 */
function handleStartGame() {
    playerXName = playerXNameInput.value.trim() || 'Player X';
    if (gameMode === 'pva') {
        playerOName = 'AI';
    } else {
        playerOName = playerONameInput.value.trim() || 'Player O';
    }

    playerXNameDisplay.textContent = playerXName;
    playerONameDisplay.textContent = playerOName;
    updateScoreDisplay();

    playerNameInputScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    handleRestartGame();
}

/**
 * Updates the score display on the UI.
 */
function updateScoreDisplay() {
    playerXScoreDisplay.textContent = playerXScore;
    playerOScoreDisplay.textContent = playerOScore;
}

/**
 * Handles a clicked cell.
 * @param {Event} clickedCellEvent - The click event from the cell.
 */
function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

    if (gameState[clickedCellIndex] !== "" || !gameActive) return;
    if (gameMode === 'pva' && currentPlayer === aiSymbol) return;

    clickSound.play();
    handleCellPlayed(clickedCell, clickedCellIndex);
    
    if (handleResultValidation()) return;

    if (gameMode === 'pva' && gameActive) {
        statusDisplay.innerHTML = `${playerOName} is thinking...`;
        setTimeout(aiMove, 600);
    }
}

/**
 * Updates the game state and UI for a played cell.
 * @param {HTMLElement} clickedCell - The cell element that was clicked.
 * @param {number} clickedCellIndex - The index of the clicked cell.
 */
function handleCellPlayed(clickedCell, clickedCellIndex) {
    gameState[clickedCellIndex] = currentPlayer;
    clickedCell.innerHTML = currentPlayer;
    clickedCell.classList.add(currentPlayer.toLowerCase());
}

/**
 * Checks if the game has been won, is a draw, or continues.
 * @returns {boolean} - True if the game has ended (win or draw).
 */
function handleResultValidation() {
    let roundWon = false;
    let winningCombo = [];

    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        let a = gameState[winCondition[0]];
        let b = gameState[winCondition[1]];
        let c = gameState[winCondition[2]];

        if (a === '' || b === '' || c === '') continue;
        if (a === b && b === c) {
            roundWon = true;
            winningCombo = winCondition;
            break;
        }
    }

    if (roundWon) {
        statusDisplay.innerHTML = winningMessage();
        gameActive = false;
        winSound.play();
        drawWinningLine(winningCombo);

        if (currentPlayer === 'X') {
            playerXScore++;
        } else {
            playerOScore++;
        }
        updateScoreDisplay();
        gameAnalysisButton.classList.remove('hidden');
        gameTipButton.classList.add('hidden');
        return true;
    }

    let roundDraw = !gameState.includes("");
    if (roundDraw) {
        statusDisplay.innerHTML = drawMessage();
        gameActive = false;
        drawSound.play();
        gameAnalysisButton.classList.remove('hidden');
        gameTipButton.classList.add('hidden');
        return true;
    }

    handlePlayerChange();
    return false;
}

/**
 * Switches the current player and updates the status display.
 */
function handlePlayerChange() {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    if (gameActive) {
        statusDisplay.innerHTML = currentPlayerTurn();
    }
}

/**
 * Resets the game to its initial state for the current mode.
 */
function handleRestartGame() {
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    statusDisplay.innerHTML = currentPlayerTurn();
    document.querySelectorAll('.cell').forEach(cell => {
        cell.innerHTML = "";
        cell.classList.remove('x', 'o', 'win');
        cell.style.setProperty('--glow-color', 'transparent');
    });
    winningLine.style.display = 'none';
    gameAnalysisButton.classList.add('hidden');
    gameTipButton.classList.remove('hidden');

    if (gameMode === 'pva' && currentPlayer === aiSymbol) {
         statusDisplay.innerHTML = `${playerOName} is thinking...`;
         setTimeout(aiMove, 600);
    }
}

/**
 * Resets the player scores to zero.
 */
function handleResetScore() {
    playerXScore = 0;
    playerOScore = 0;
    updateScoreDisplay();
}

/**
 * Draws the line through the winning cells and adds glow effect.
 * @param {number[]} combo - The array of winning cell indices.
 */
function drawWinningLine(combo) {
    const startCell = document.querySelector(`[data-cell-index='${combo[0]}']`);
    const endCell = document.querySelector(`[data-cell-index='${combo[2]}']`);

    const startRect = startCell.getBoundingClientRect();
    const boardRect = gameBoard.getBoundingClientRect();
    
    const startX = startRect.left + startRect.width / 2 - boardRect.left;
    const startY = startRect.top + startRect.height / 2 - boardRect.top;
    const endX = endCell.getBoundingClientRect().left + endCell.getBoundingClientRect().width / 2 - boardRect.left;
    const endY = endCell.getBoundingClientRect().top + endCell.getBoundingClientRect().height / 2 - boardRect.top;

    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

    winningLine.style.width = `${length}px`;
    winningLine.style.top = `${startY}px`;
    winningLine.style.left = `${startX}px`;
    winningLine.style.transform = `rotate(${angle}deg)`;
    winningLine.style.display = 'block';

    const glowColor = currentPlayer === 'X' ? '#f472b6' : '#60a5fa';
    combo.forEach(index => {
        const cell = document.querySelector(`[data-cell-index='${index}']`);
        cell.classList.add('win');
        cell.style.setProperty('--glow-color', glowColor);
    });
}

/**
 * Creates the game board cells dynamically.
 */
function createBoard() {
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.setAttribute('data-cell-index', i);
        cell.addEventListener('click', handleCellClick);
        gameBoard.appendChild(cell);
    }
    gameBoard.appendChild(winningLine);
}

// --- AI Logic ---

/**
 * The AI makes its move. It uses a simple but effective algorithm.
 */
function aiMove() {
    if (!gameActive) return;

    let bestMove = findBestMoveFor(aiSymbol);
    if (bestMove !== null) {
        makeMove(bestMove);
        return;
    }

    bestMove = findBestMoveFor(playerSymbol);
    if (bestMove !== null) {
        makeMove(bestMove);
        return;
    }

    if (gameState[4] === "") {
        makeMove(4);
        return;
    }

    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(index => gameState[index] === "");
    if (availableCorners.length > 0) {
        makeMove(availableCorners[Math.floor(Math.random() * availableCorners.length)]);
        return;
    }

    const sides = [1, 3, 5, 7];
    const availableSides = sides.filter(index => gameState[index] === "");
    if (availableSides.length > 0) {
        makeMove(availableSides[Math.floor(Math.random() * availableSides.length)]);
        return;
    }
}

/**
 * Finds if a winning move exists for a given player.
 * @param {string} symbol - The player's symbol ('X' or 'O').
 * @returns {number|null} - The index of the winning move, or null.
 */
function findBestMoveFor(symbol) {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameState[a] === symbol && gameState[b] === symbol && gameState[c] === "") return c;
        if (gameState[a] === symbol && gameState[c] === symbol && gameState[b] === "") return b;
        if (gameState[b] === symbol && gameState[c] === symbol && gameState[a] === "") return a;
    }
    return null;
}

/**
 * Programmatically makes a move on the board.
 * @param {number} index - The cell index to play.
 */
function makeMove(index) {
    const cell = document.querySelector(`[data-cell-index='${index}']`);
    clickSound.play();
    handleCellPlayed(cell, index);
    handleResultValidation();
}

// --- LLM Powered Functions ---
async function getGameAnalysis() {
    modalTitle.textContent = "Game Analysis ✨";
    modalContentText.innerHTML = '<div class="flex justify-center items-center h-20"><div class="spinner"></div></div>';
    llmModal.classList.remove('hidden');

    const board = `| ${gameState[0] || ' '} | ${gameState[1] || ' '} | ${gameState[2] || ' '} |\n| ${gameState[3] || ' '} | ${gameState[4] || ' '} | ${gameState[5] || ' '} |\n| ${gameState[6] || ' '} | ${gameState[7] || ' '} | ${gameState[8] || ' '} |`;
    const outcome = statusDisplay.textContent;
    
    const prompt = `You are a professional Tic-Tac-Toe game analyst. Analyze the following game. The board is represented by indices 0-8. 'X' is ${playerXName}, 'O' is ${playerOName}. The final board state is:\n\n${board}\n\nOutcome: ${outcome}\n\nProvide a summary of the game, highlight a key move or a missed opportunity for either player, and offer a single piece of strategic advice. Format the response using markdown.`;

    const analysis = await getLlmResponse(prompt);
    modalContentText.innerHTML = `<p class="whitespace-pre-line">${analysis}</p>`;
}

async function getGameTip() {
    modalTitle.textContent = "Game Tip ✨";
    modalContentText.innerHTML = '<div class="flex justify-center items-center h-20"><div class="spinner"></div></div>';
    llmModal.classList.remove('hidden');

    const board = `| ${gameState[0] || ' '} | ${gameState[1] || ' '} | ${gameState[2] || ' '} |\n| ${gameState[3] || ' '} | ${gameState[4] || ' '} | ${gameState[5] || ' '} |\n| ${gameState[6] || ' '} | ${gameState[7] || ' '} | ${gameState[8] || ' '} |`;
    const prompt = `You are a professional Tic-Tac-Toe coach. The current player is '${currentPlayer}'. The current board state is:\n\n${board}\n\nGive a single, concise strategic tip for the current player without giving away the exact winning move or the best move.`;

    const tip = await getLlmResponse(prompt);
    modalContentText.innerHTML = `<p>${tip}</p>`;
}

// --- Initial Setup ---
createBoard();

// --- Event Listeners ---
document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', (e) => showNameInput(e.target.dataset.mode));
});

startGameButton.addEventListener('click', handleStartGame);
backToModeButton.addEventListener('click', () => {
    playerNameInputScreen.classList.add('hidden');
    gameModeSelection.classList.remove('hidden');
});

restartButton.addEventListener('click', handleRestartGame);
resetScoreButton.addEventListener('click', handleResetScore);
changeModeButton.addEventListener('click', () => {
    gameContainer.classList.add('hidden');
    gameModeSelection.classList.remove('hidden');
    handleResetScore();
});

gameTipButton.addEventListener('click', getGameTip);
gameAnalysisButton.addEventListener('click', getGameAnalysis);
closeModalButton.addEventListener('click', () => {
    llmModal.classList.add('hidden');
});
