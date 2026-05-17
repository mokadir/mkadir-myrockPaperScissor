/* ==========================================================================
   Rock-Paper-Scissors Game - Game Logic
   Handles game mechanics, score tracking, localStorage, animations, and UI
   ========================================================================== */

'use strict';

// ---------------------------------------------------------------------------
// Configuration & Constants
// ---------------------------------------------------------------------------

/**
 * The number of wins required to trigger the game over screen.
 * When either the player or computer reaches this score, the game ends.
 */
const GAME_OVER_THRESHOLD = 5;

/** Local storage key for persisting high score */
const STORAGE_KEY = 'rps_high_score';

/** Delay (ms) before computer "chooses" (for dramatic effect) */
const COMPUTER_DELAY = 600;

/** Mapping of moves to their emoji icons */
const MOVE_ICONS = {
  rock: '\u270A',
  paper: '\u270B',
  scissors: '\u270C\uFE0F',
};

/**
 * Determines the winner of a rock-paper-scissors round.
 * @param {string} playerMove - The player's move ('rock', 'paper', or 'scissors')
 * @param {string} computerMove - The computer's move ('rock', 'paper', or 'scissors')
 * @returns {string} - 'win', 'lose', or 'tie'
 */
function getRoundResult(playerMove, computerMove) {
  if (playerMove === computerMove) return 'tie';

  // The player wins with these combinations
  const winningCombos = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return winningCombos[playerMove] === computerMove ? 'win' : 'lose';
}

/**
 * Generates a human-readable feedback string for a round.
 * @param {string} playerMove - The player's move
 * @param {string} computerMove - The computer's move
 * @param {string} result - 'win', 'lose', or 'tie'
 * @returns {string} - Feedback message
 */
function getFeedbackMessage(playerMove, computerMove, result) {
  if (result === 'tie') {
    return `Both chose ${playerMove}! It's a tie! \uD83E\uDD1D`;
  }

  // Describe what beats what
  const beats = result === 'win'
    ? `${capitalize(playerMove)} beats ${computerMove}!`
    : `${capitalize(computerMove)} beats ${playerMove}!`;

  const outcome = result === 'win' ? 'You win!' : 'You lose!';
  const emoji = result === 'win' ? '\uD83C\uDF89' : '\uD83D\uDE1E';

  return `${beats} ${outcome} ${emoji}`;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/**
 * The central game state object.
 * All mutable game data lives here for clean state management.
 */
const gameState = {
  playerScore: 0,
  computerScore: 0,
  round: 0,
  highScore: 0,
  isAnimating: false,
  isGameOver: false,
};

// ---------------------------------------------------------------------------
// DOM References (cached for performance)
// ---------------------------------------------------------------------------

const dom = {
  playerScore: document.getElementById('player-score'),
  computerScore: document.getElementById('computer-score'),
  roundCount: document.getElementById('round-count'),
  highScore: document.getElementById('high-score'),
  resultText: document.getElementById('result-message').querySelector('.result-text'),
  gameFeedback: document.getElementById('game-feedback'),
  playerIcon: document.getElementById('player-choice-display').querySelector('.choice-icon'),
  computerIcon: document.getElementById('computer-choice-display').querySelector('.choice-icon'),
  moveButtons: document.querySelectorAll('.move-btn'),
  restartBtn: document.getElementById('restart-btn'),
  resetHighScoreBtn: document.getElementById('reset-highscore-btn'),
  gameOverOverlay: document.getElementById('game-over-overlay'),
  playAgainBtn: document.getElementById('play-again-btn'),
  finalPlayerScore: document.getElementById('final-player-score'),
  finalComputerScore: document.getElementById('final-computer-score'),
  finalRounds: document.getElementById('final-rounds'),
  gameOverMessage: document.getElementById('game-over-message'),
  playerScoreCard: document.querySelector('.player-score'),
};

// ---------------------------------------------------------------------------
// High Score (localStorage)
// ---------------------------------------------------------------------------

/**
 * Loads the high score from localStorage.
 * If the stored value is invalid, it resets to 0.
 * @returns {number} - The stored high score
 */
function loadHighScore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // localStorage might be unavailable (e.g., private browsing in some browsers)
    return 0;
  }
}

/**
 * Saves a new high score to localStorage.
 * Only updates if the new score is higher than the current stored value.
 * @param {number} score - The score to save
 */
function saveHighScore(score) {
  const currentHigh = loadHighScore();
  if (score > currentHigh) {
    try {
      localStorage.setItem(STORAGE_KEY, score.toString());
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}

/**
 * Updates the high score display in the UI.
 */
function updateHighScoreDisplay() {
  gameState.highScore = loadHighScore();
  dom.highScore.textContent = gameState.highScore;
}

/**
 * Resets the high score (prompts user for confirmation).
 */
function resetHighScore() {
  if (confirm('Are you sure you want to reset your high score?')) {
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch {
      // Silently fail
    }
    updateHighScoreDisplay();
  }
}

// ---------------------------------------------------------------------------
// UI Update Functions
// ---------------------------------------------------------------------------

/**
 * Updates all score-related UI elements.
 */
function updateScoreUI() {
  dom.playerScore.textContent = gameState.playerScore;
  dom.computerScore.textContent = gameState.computerScore;
  dom.roundCount.textContent = `Round ${gameState.round}`;
}

/**
 * Updates the choice icons and applies a bounce animation.
 * @param {string|null} playerMove - The player's move (or null to reset)
 * @param {string|null} computerMove - The computer's move (or null to reset)
 */
function updateChoicesUI(playerMove, computerMove) {
  // Update player choice
  dom.playerIcon.textContent = playerMove ? MOVE_ICONS[playerMove] : '\u2754';
  dom.playerIcon.classList.remove('bounce-in');
  void dom.playerIcon.offsetWidth; // Force reflow to restart animation
  dom.playerIcon.classList.add('bounce-in');

  // Update computer choice
  dom.computerIcon.textContent = computerMove ? MOVE_ICONS[computerMove] : '\u2754';
  dom.computerIcon.classList.remove('bounce-in');
  void dom.computerIcon.offsetWidth;
  dom.computerIcon.classList.add('bounce-in');
}

/**
 * Updates the result text and applies styling based on outcome.
 * @param {string} message - The result message
 * @param {string} result - 'win', 'lose', or 'tie'
 */
function updateResultUI(message, result) {
  dom.resultText.textContent = message;
  // Remove existing result classes
  dom.resultText.classList.remove('win', 'lose', 'tie');
  // Add class for current result
  if (result !== 'tie') {
    dom.resultText.classList.add(result);
  } else {
    dom.resultText.classList.add('tie');
  }
}

/**
 * Updates the game feedback area.
 * @param {string} message - The feedback message
 */
function updateFeedbackUI(message) {
  dom.gameFeedback.textContent = message;
}

/**
 * Animates the player score card to indicate the result.
 * @param {string} result - 'win', 'lose', or 'tie'
 */
function animateScoreCard(result) {
  const card = dom.playerScoreCard;
  // Remove previous flash classes
  card.classList.remove('win-flash', 'lose-flash', 'tie-flash');
  // Force reflow
  void card.offsetWidth;
  // Add new flash class
  card.classList.add(`${result}-flash`);
  // Also animate the score number
  const scoreEl = card.querySelector('.score-value');
  scoreEl.classList.remove('animate-score-pop');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('animate-score-pop');
}

/**
 * Enables or disables the move buttons.
 * @param {boolean} disabled - Whether buttons should be disabled
 */
function setMoveButtonsDisabled(disabled) {
  dom.moveButtons.forEach(btn => {
    btn.disabled = disabled;
  });
}

/**
 * Resets UI elements to their initial state.
 */
function resetUI() {
  updateChoicesUI(null, null);
  dom.resultText.textContent = 'Pick a move to start!';
  dom.resultText.classList.remove('win', 'lose', 'tie');
  dom.gameFeedback.textContent = '';
  dom.playerScoreCard.classList.remove('win-flash', 'lose-flash', 'tie-flash');
  updateScoreUI();
  updateHighScoreDisplay();
  setMoveButtonsDisabled(false);
}

// ---------------------------------------------------------------------------
// Game Over Logic
// ---------------------------------------------------------------------------

/**
 * Checks if the game should end and shows the game over screen if so.
 */
function checkGameOver() {
  // If GAME_OVER_THRESHOLD is set, check if either player reached it
  if (GAME_OVER_THRESHOLD !== null) {
    if (
      gameState.playerScore >= GAME_OVER_THRESHOLD ||
      gameState.computerScore >= GAME_OVER_THRESHOLD
    ) {
      showGameOver();
      return;
    }
  }
}

/**
 * Displays the game over overlay with final stats.
 */
function showGameOver() {
  gameState.isGameOver = true;
  setMoveButtonsDisabled(true);

  // Determine win/loss/tie message
  let message;
  if (gameState.playerScore > gameState.computerScore) {
    message = '\uD83C\uDF89 Congratulations! You won the game!';
  } else if (gameState.playerScore < gameState.computerScore) {
    message = '\uD83D\uDE1E The computer won this time. Try again!';
  } else {
    message = '\uD83E\uDD1D It\'s a draw! Great match!';
  }

  dom.gameOverMessage.textContent = message;
  dom.finalPlayerScore.textContent = gameState.playerScore;
  dom.finalComputerScore.textContent = gameState.computerScore;
  dom.finalRounds.textContent = gameState.round;

  dom.gameOverOverlay.classList.remove('hidden');

  // Save high score (highest player score)
  saveHighScore(gameState.playerScore);
  updateHighScoreDisplay();
}

/**
 * Hides the game over overlay.
 */
function hideGameOver() {
  dom.gameOverOverlay.classList.add('hidden');
  gameState.isGameOver = false;
}

// ---------------------------------------------------------------------------
// Core Game Logic
// ---------------------------------------------------------------------------

/**
 * Generates a random choice for the computer.
 * @returns {string} - 'rock', 'paper', or 'scissors'
 */
function getComputerMove() {
  const moves = ['rock', 'paper', 'scissors'];
  const index = Math.floor(Math.random() * moves.length);
  return moves[index];
}

/**
 * Handles the full game round when a player chooses a move.
 * @param {string} playerMove - The player's chosen move
 */
function playRound(playerMove) {
  // Guard: prevent play if already animating or game is over
  if (gameState.isAnimating || gameState.isGameOver) return;

  // Start animation state
  gameState.isAnimating = true;
  setMoveButtonsDisabled(true);

  // Disable the result text animation re-trigger
  dom.resultText.textContent = '\uD83E\uDD14 Thinking...';
  dom.resultText.classList.remove('win', 'lose', 'tie');

  // Add a slight delay to simulate computer "thinking"
  const computerMove = getComputerMove();

  setTimeout(() => {
    // Increment round and compute result
    gameState.round++;
    const result = getRoundResult(playerMove, computerMove);
    const feedback = getFeedbackMessage(playerMove, computerMove, result);

    // Update scores
    if (result === 'win') {
      gameState.playerScore++;
    } else if (result === 'lose') {
      gameState.computerScore++;
    }
    // Ties: no score change

    // Update UI
    updateChoicesUI(playerMove, computerMove);

    // Capitalize result message (e.g., "win" -> "You win!")
    const resultMessage = result === 'win'
      ? 'You Win! \uD83C\uDF89'
      : result === 'lose'
        ? 'You Lose! \uD83D\uDE1E'
        : 'It\'s a Tie! \uD83E\uDD1D';

    updateResultUI(resultMessage, result);
    updateFeedbackUI(feedback);
    updateScoreUI();
    animateScoreCard(result);

    // Save high score check
    saveHighScore(gameState.playerScore);
    updateHighScoreDisplay();

    // End animation state
    gameState.isAnimating = false;
    setMoveButtonsDisabled(false);

    // Check if game should end
    checkGameOver();
  }, COMPUTER_DELAY);
}

// ---------------------------------------------------------------------------
// Game Reset
// ---------------------------------------------------------------------------

/**
 * Resets the entire game back to its initial state.
 */
function resetGame() {
  // Reset state
  gameState.playerScore = 0;
  gameState.computerScore = 0;
  gameState.round = 0;
  gameState.isAnimating = false;
  gameState.isGameOver = false;

  // Reset UI
  hideGameOver();
  resetUI();

  // Update high score from storage
  updateHighScoreDisplay();
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

/**
 * Initializes all event listeners for the game.
 */
function initEventListeners() {
  // Move buttons (event delegation for cleaner code)
  dom.moveButtons.forEach(btn => {
    btn.addEventListener('click', (event) => {
      const move = event.currentTarget.getAttribute('data-move');
      if (move) {
        playRound(move);
      }
    });
  });

  // Restart button
  dom.restartBtn.addEventListener('click', resetGame);

  // Play Again button (in game over overlay)
  dom.playAgainBtn.addEventListener('click', resetGame);

  // Reset high score button
  dom.resetHighScoreBtn.addEventListener('click', resetHighScore);

  // Keyboard shortcut: press 'r' to restart
  document.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        resetGame();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes the game: loads state, sets up UI, and binds events.
 */
function initGame() {
  // Load high score from localStorage
  updateHighScoreDisplay();

  // Set initial UI
  resetUI();

  // Bind all event listeners
  initEventListeners();

  // Log game start
  console.log('\uD83C\uDFAE Rock Paper Scissors game initialized!');
  console.log(`\uD83C\uDFC6 High Score: ${gameState.highScore}`);
}

// Start the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initGame);