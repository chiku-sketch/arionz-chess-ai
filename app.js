/* ============================================================
   ARIONZ CHESS AI
   COMPLETE ADVANCED FRONTEND APPLICATION
   ============================================================ */

(() => {
  "use strict";

  /* ----------------------------------------------------------
     1. HELPERS AND APPLICATION STATE
     ---------------------------------------------------------- */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const APP = {
    game: null,
    selectedSquare: null,
    legalTargets: [],
    lastMove: null,
    orientation: "white",
    redoStack: [],
    mode: "play", // "play" | "live" | "learn"
    opponentType: "bot-beginner", // "local" | "bot-beginner" | "bot-intermediate" | "bot-advanced"
    botThinking: false,
    currentPage: "dashboard",
    history: [],
    completedGameRecorded: false,
    moveEvaluations: []
  };

  const STORAGE_KEYS = {
    games: "arionz_chess_games_v1",
    profile: "arionz_chess_profile_v1",
    settings: "arionz_chess_settings_v1",
    goals: "arionz_chess_goals_v1",
    puzzleStats: "arionz_chess_puzzles_v1",
    activity: "arionz_chess_activity_v1",
    lessons: "arionz_chess_completed_lessons_v1",
    repertoire: "arionz_chess_repertoire_v1",
    quizBest: "arionz_chess_quiz_best_v1"
  };

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Storage read failed:", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("Storage write failed:", error);
      return false;
    }
  }

  function setText(selector, value) {
    const element = typeof selector === "string" ? $(selector) : selector;
    if (element) element.textContent = value;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showToast(message, type = "success") {
    const region = $("#toastRegion") || $(".toast-region");
    if (!region) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    region.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(7px)";
      window.setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  /* ----------------------------------------------------------
     2. PAGE NAVIGATION
     ---------------------------------------------------------- */

  const PAGE_META = {
    dashboard: { title: "Dashboard", subtitle: "Your personal chess command center." },
    play: { title: "Chess Arena", subtitle: "Play, think, learn and improve every move." },
    learn: { title: "Learn Chess", subtitle: "Start from the basics and build chess intelligence." },
    rules: { title: "Chess Rules", subtitle: "Official rules, special moves and interactive quiz." },
    openings: { title: "Opening Explorer", subtitle: "Master opening principles, live boards and repertoire." },
    mistakes: { title: "Mistakes & Solutions", subtitle: "Understand why errors happen and how to avoid them." },
    smartmoves: { title: "Smart Moves", subtitle: "Tactical patterns, combinations and mating nets." },
    puzzles: { title: "Puzzle Training", subtitle: "Sharpen your tactical vision on the interactive puzzle board." },
    analysis: { title: "Game Analysis", subtitle: "Import PGN games and review critical positions." },
    history: { title: "Game History", subtitle: "Your recorded matches and performance archive." },
    progress: { title: "My Progress", subtitle: "Track your growth, consistency and personal goals." },
    achievements: { title: "Achievements", subtitle: "Milestones unlocked across your chess journey." },
    leaderboard: { title: "Leaderboard", subtitle: "Global and category rankings overview." },
    friends: { title: "Friends", subtitle: "Connect with players and send match challenges." },
    tournaments: { title: "Tournaments", subtitle: "Explore chess events and competition formats." },
    profile: { title: "Profile & Settings", subtitle: "Manage your identity, board and coach preferences." }
  };

  function closeMobileSidebar() {
    const sidebar = $("#sidebar") || $(".sidebar");
    if (sidebar) sidebar.classList.remove("open", "mobile-open");
  }

  function navigateTo(pageName) {
    if (!PAGE_META[pageName]) return;

    const target = $(`#page-${pageName}`);
    if (!target) return;

    APP.currentPage = pageName;

    $$(".page").forEach(page => {
      const isActive = page === target;
      page.classList.toggle("active", isActive);
      page.classList.toggle("active-page", isActive);
      page.setAttribute("aria-hidden", String(!isActive));
    });

    $$("[data-page]").forEach(button => {
      const isActive = button.dataset.page === pageName;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-current", isActive ? "page" : "false");
    });

    setText("#pageTitle", PAGE_META[pageName].title);
    setText("#pageSubtitle", PAGE_META[pageName].subtitle);

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageName === "dashboard") updateDashboardStats();
    if (pageName === "learn") updateLearningStats();
    if (pageName === "history") renderGameHistory();
    if (pageName === "progress") updateProgressOverview();
    if (pageName === "achievements") updateAchievements();
    if (pageName === "profile") loadProfile();
  }

  function initNavigation() {
    $$("[data-page]").forEach(button => {
      button.addEventListener("click", () => navigateTo(button.dataset.page));
    });

    $$("[data-goto]").forEach(button => {
      button.addEventListener("click", () => navigateTo(button.dataset.goto));
    });

    $(".topbar-profile")?.addEventListener("click", () => navigateTo("profile"));

    const menuToggle = $("#menuToggle") || $("#mobileMenu");
    if (menuToggle) {
      menuToggle.addEventListener("click", event => {
        event.stopPropagation();
        const sidebar = $("#sidebar") || $(".sidebar");
        if (sidebar) sidebar.classList.toggle("open");
      });
    }

    document.addEventListener("click", event => {
      const sidebar = $("#sidebar") || $(".sidebar");
      const menu = $("#menuToggle") || $("#mobileMenu");
      if (
        window.innerWidth <= 860 &&
        sidebar &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !menu?.contains(event.target)
      ) {
        closeMobileSidebar();
      }
    });

    const firstActive = $(".nav-item.active[data-page]");
    navigateTo(firstActive?.dataset.page || "dashboard");
  }

  /* ----------------------------------------------------------
     3. THEME AND SETTINGS DIALOG
     ---------------------------------------------------------- */

  function initThemeControls() {
    const themeToggle = $("#themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("soft-theme");
        const enabled = document.body.classList.contains("soft-theme");
        writeStorage("arionz_chess_soft_theme", enabled);
        showToast(enabled ? "Soft graphite theme enabled." : "Deep dark theme enabled.");
      });
    }

    const savedTheme = readStorage("arionz_chess_soft_theme", false);
    document.body.classList.toggle("soft-theme", Boolean(savedTheme));

    $("#notificationButton")?.addEventListener("click", () => {
      showToast("ArionZ AI Coach & Local Engine Active.");
    });
  }

  function initSettingsDialog() {
    const dialog = $("#settingsDialog");
    const openButton = $("#settingsButton");
    const closeButton = $("#closeSettings");

    if (!dialog) return;

    openButton?.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });

    closeButton?.addEventListener("click", () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    });
  }

  /* ----------------------------------------------------------
     4. CHESS ENGINE, PIECES & EVALUATION HELPERS
     ---------------------------------------------------------- */

  const PIECES = {
    wk: "♚\uFE0E",
    wq: "♛\uFE0E",
    wr: "♜\uFE0E",
    wb: "♝\uFE0E",
    wn: "♞\uFE0E",
    wp: "♟\uFE0E",

    bk: "♚\uFE0E",
    bq: "♛\uFE0E",
    br: "♜\uFE0E",
    bb: "♝\uFE0E",
    bn: "♞\uFE0E",
    bp: "♟\uFE0E"
  };

  const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const CENTER_SQUARES = new Set(["d4", "e4", "d5", "e5"]);

  function evaluateBoard(chessInstance) {
    if (chessInstance.in_checkmate()) {
      return chessInstance.turn() === "w" ? -99999 : 99999;
    }
    if (chessInstance.in_draw() || chessInstance.in_stalemate()) return 0;

    const board = chessInstance.board();
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        let val = PIECE_VALUES[piece.type] || 0;
        const sq = `${FILES[c]}${8 - r}`;
        if (CENTER_SQUARES.has(sq)) val += 25;
        if (piece.type === "n" || piece.type === "b") {
          if ((piece.color === "w" && r < 7) || (piece.color === "b" && r > 0)) {
            val += 15;
          }
        }
        score += piece.color === "w" ? val : -val;
      }
    }
    return score;
  }

  function chooseBotMove(chessInstance, level = "bot-beginner") {
    const legalMoves = chessInstance.moves({ verbose: true });
    if (!legalMoves.length) return null;

    if (level === "bot-beginner") {
      const captures = legalMoves.filter(m => m.captured);
      if (captures.length && Math.random() < 0.55) {
        return captures[Math.floor(Math.random() * captures.length)];
      }
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    const isBlack = chessInstance.turn() === "b";
    let bestMove = legalMoves[0];
    let bestScore = isBlack ? Infinity : -Infinity;

    for (const move of legalMoves) {
      chessInstance.move(move);
      let score = evaluateBoard(chessInstance);

      if (level === "bot-advanced") {
        const replies = chessInstance.moves({ verbose: true });
        if (replies.length) {
          let worstReplyScore = isBlack ? -Infinity : Infinity;
          for (const reply of replies.slice(0, 12)) {
            chessInstance.move(reply);
            const rScore = evaluateBoard(chessInstance);
            chessInstance.undo();
            if (isBlack) worstReplyScore = Math.max(worstReplyScore, rScore);
            else worstReplyScore = Math.min(worstReplyScore, rScore);
          }
          score = worstReplyScore;
        }
      } else {
        score += (Math.random() - 0.5) * 35;
      }

      chessInstance.undo();

      if (isBlack && score < bestScore) {
        bestScore = score;
        bestMove = move;
      } else if (!isBlack && score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  function getSquareName(row, col) {
    const file = APP.orientation === "white" ? FILES[col] : FILES[7 - col];
    const rank = APP.orientation === "white" ? 8 - row : row + 1;
    return `${file}${rank}`;
  }

  function updateOuterCoordinates() {
    const filesOrder = APP.orientation === "white" ? FILES : [...FILES].reverse();
    const ranksOrder = APP.orientation === "white"
      ? ["8", "7", "6", "5", "4", "3", "2", "1"]
      : ["1", "2", "3", "4", "5", "6", "7", "8"];

    $$(".board-coordinates.files-top, .board-coordinates.files-bottom").forEach(row => {
      $$("span", row).forEach((span, idx) => {
        if (filesOrder[idx]) span.textContent = filesOrder[idx];
      });
    });

    const ranksLeft = $(".board-coordinates.ranks-left");
    if (ranksLeft) {
      $$("span", ranksLeft).forEach((span, idx) => {
        if (ranksOrder[idx]) span.textContent = ranksOrder[idx];
      });
    }
  }

  /* ----------------------------------------------------------
     5. CHESS ARENA SETUP & 3 AI MODES
     ---------------------------------------------------------- */

  function mountArenaEnhancements() {
    const boardCard = $("#page-play .board-card");
    if (!boardCard || $("#arenaOpponentBar")) return;

    const opponentBar = createElement("div", "arena-opponent-bar");
    opponentBar.id = "arenaOpponentBar";
    opponentBar.innerHTML = `
      <label for="arenaOpponentSelect">⚔ Match Opponent:</label>
      <div class="arena-opponent-controls">
        <select id="arenaOpponentSelect">
          <option value="bot-beginner">ArionZ AI Bot (Beginner)</option>
          <option value="bot-intermediate">ArionZ AI Bot (Intermediate)</option>
          <option value="bot-advanced">ArionZ AI Bot (Advanced)</option>
          <option value="local">Local 2-Player (Pass & Play)</option>
        </select>
        <button type="button" class="secondary-button" id="runPostGameReviewBtn">AI Game Review</button>
      </div>
    `;

    const learnBanner = createElement("div", "learn-first-banner hidden");
    learnBanner.id = "learnFirstBanner";
    learnBanner.innerHTML = `
      <span class="eyebrow">MODE 3 — LEARN FIRST & SHORT-TERM WINNING GUIDE</span>
      <h3>How to Start Strong & Spot Fast Winning Traps</h3>
      <p>Before making your first move: 1) Control e4/d4, 2) Develop Knights before Bishops, 3) Watch the f7/f2 weak square. Click any tactical setup below to load it onto the board and practice winning quickly:</p>
      <div class="scenario-btn-grid">
        <button type="button" class="scenario-btn" data-scenario="italian_f7">
          <strong>01. Target f7 (Fried Liver Setup)</strong>
          <span>1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 — Attack f7 immediately!</span>
        </button>
        <button type="button" class="scenario-btn" data-scenario="scholars_defense">
          <strong>02. Punish Scholar's Mate</strong>
          <span>1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6 — Defend & gain tempo!</span>
        </button>
        <button type="button" class="scenario-btn" data-scenario="legals_trap">
          <strong>03. Legal's Checkmate Trap</strong>
          <span>1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 — Famous tactical sacrifice!</span>
        </button>
        <button type="button" class="scenario-btn" data-scenario="golden_setup">
          <strong>04. Perfect 6-Move Golden Setup</strong>
          <span>1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O Nf6 — Ideal castled position.</span>
        </button>
      </div>
    `;

    boardCard.insertBefore(learnBanner, boardCard.firstChild);
    boardCard.insertBefore(opponentBar, boardCard.firstChild);

    $("#arenaOpponentSelect")?.addEventListener("change", event => {
      APP.opponentType = event.target.value;
      const names = {
        "bot-beginner": "ArionZ AI (Beginner)",
        "bot-intermediate": "ArionZ AI (Intermediate)",
        "bot-advanced": "ArionZ AI (Advanced)",
        "local": "Local Player 2"
      };
      setText("#opponentLabel", names[APP.opponentType] || "Opponent");
      showToast(`Opponent set to ${names[APP.opponentType]}.`);
      if (APP.game && APP.game.turn() === "b" && APP.opponentType.startsWith("bot-")) {
        triggerBotMove();
      }
    });

    $("#runPostGameReviewBtn")?.addEventListener("click", () => {
      generatePostGameCoachSummary();
    });

    $$("[data-scenario]", learnBanner).forEach(btn => {
      btn.addEventListener("click", () => {
        loadTrainingScenario(btn.dataset.scenario);
      });
    });
  }

  function loadTrainingScenario(key) {
    if (!APP.game) return;

    const scenarios = {
      italian_f7: {
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5",
        tip: "Scenario Loaded: Target f7! White's Knight on g5 and Bishop on c4 both attack f7. Try playing Nxf7 or Qf3 to pressure Black's King!"
      },
      scholars_defense: {
        pgn: "1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 4. Qf3 Nf6",
        tip: "Scenario Loaded: Punishing Scholar's Mate! Black defended f7 with ...g6 and ...Nf6 while developing pieces. Now play d3 or Ne2 to keep White safe."
      },
      legals_trap: {
        pgn: "1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6",
        tip: "Scenario Loaded: Legal's Mate Opportunity! Try playing 5. Nxe5! If Black captures your Queen (5...Bxd1), 6. Bxf7+ Ke7 7. Nd5# is checkmate!"
      },
      golden_setup: {
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3",
        tip: "Scenario Loaded: Classical Central Control! White has a strong pawn center on d4 and e4 with active pieces. Continue with O-O!"
      }
    };

    const selected = scenarios[key];
    if (!selected) return;

    APP.game.reset();
    APP.game.load_pgn(selected.pgn);
    APP.selectedSquare = null;
    APP.legalTargets = [];
    APP.redoStack = [];
    APP.moveEvaluations = [];

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();

    addCoachMessage(selected.tip, "coach");
    showToast("Training scenario loaded on the chessboard!");
  }

  function initChessEngine() {
    if (typeof window.Chess !== "function") {
      showToast("Chess library could not load. Check your internet connection.", "error");
      return false;
    }

    mountArenaEnhancements();

    APP.game = new window.Chess();
    APP.selectedSquare = null;
    APP.legalTargets = [];
    APP.lastMove = null;
    APP.redoStack = [];
    APP.history = [];
    APP.moveEvaluations = [];
    APP.completedGameRecorded = false;

    setText("#opponentLabel", "ArionZ AI (Beginner)");

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();

    return true;
  }

  function renderBoard() {
    const boardElement = $("#chessboard");
    if (!boardElement || !APP.game) return;

    boardElement.innerHTML = "";
    updateOuterCoordinates();

    const boardData = APP.game.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const squareName = getSquareName(row, col);
        const gameRow = APP.orientation === "white" ? row : 7 - row;
        const gameCol = APP.orientation === "white" ? col : 7 - col;
        const piece = boardData[gameRow][gameCol];

        const square = createElement(
          "button",
          `square ${(gameRow + gameCol) % 2 === 0 ? "light" : "dark"}`
        );

        square.type = "button";
        square.dataset.square = squareName;
        square.setAttribute("aria-label", `Square ${squareName}`);

        if (APP.selectedSquare === squareName) {
          square.classList.add("selected");
        }

        if (
          APP.lastMove &&
          (APP.lastMove.from === squareName || APP.lastMove.to === squareName)
        ) {
          square.classList.add("last-move");
        }

        if (APP.legalTargets.includes(squareName)) {
          const targetPiece = APP.game.get(squareName);
          square.classList.add(targetPiece ? "possible-capture" : "possible-move");
        }

        if (piece) {
          const symbol = PIECES[piece.color + piece.type];
          const colorClass = piece.color === "w" ? "white-piece" : "black-piece";
          const pieceElement = createElement("span", `piece ${colorClass}`, symbol);
          pieceElement.setAttribute("aria-hidden", "true");
          square.appendChild(pieceElement);
        }

        boardElement.appendChild(square);
      }
    }

    highlightCheckSquare();
  }

  function highlightCheckSquare() {
    if (!APP.game || !APP.game.in_check()) return;

    const boardElement = $("#chessboard");
    if (!boardElement) return;

    const currentTurn = APP.game.turn();
    const boardData = APP.game.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = boardData[row][col];
        if (piece && piece.type === "k" && piece.color === currentTurn) {
          const kingSquare = `${FILES[col]}${8 - row}`;
          $(`[data-square="${kingSquare}"]`, boardElement)?.classList.add("in-check");
          return;
        }
      }
    }
  }

  function getLegalTargets(squareName) {
    if (!APP.game) return [];
    return APP.game.moves({ square: squareName, verbose: true }).map(move => move.to);
  }

  function handleSquareClick(squareName) {
    if (!APP.game || APP.game.game_over() || APP.botThinking) return;

    const piece = APP.game.get(squareName);
    const currentTurn = APP.game.turn();

    if (APP.selectedSquare && APP.legalTargets.includes(squareName)) {
      makeMove(APP.selectedSquare, squareName);
      return;
    }

    if (piece && piece.color === currentTurn) {
      APP.selectedSquare = squareName;
      APP.legalTargets = getLegalTargets(squareName);
    } else {
      APP.selectedSquare = null;
      APP.legalTargets = [];
    }

    renderBoard();
  }

  function initBoardEvents() {
    const board = $("#chessboard");
    if (!board) return;

    board.addEventListener("click", event => {
      const square = event.target.closest("[data-square]");
      if (!square || !board.contains(square)) return;
      handleSquareClick(square.dataset.square);
    });
  }

  function makeMove(from, to, isBot = false) {
    if (!APP.game) return;

    const scoreBefore = evaluateBoard(APP.game);
    let move = null;

    try {
      move = APP.game.move({ from, to, promotion: "q" });
    } catch (error) {
      console.warn("Invalid chess move:", error);
    }

    if (!move) {
      APP.selectedSquare = null;
      APP.legalTargets = [];
      renderBoard();
      return;
    }

    const scoreAfter = evaluateBoard(APP.game);
    const delta = move.color === "w" ? scoreAfter - scoreBefore : scoreBefore - scoreAfter;

    APP.moveEvaluations.push({
      moveNumber: Math.ceil(APP.game.history().length / 2),
      color: move.color === "w" ? "White" : "Black",
      san: move.san,
      from: move.from,
      to: move.to,
      captured: move.captured || null,
      delta
    });

    APP.lastMove = { from: move.from, to: move.to };
    APP.redoStack = [];
    APP.selectedSquare = null;
    APP.legalTargets = [];

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();
    updateCoachAfterMove(move, delta, isBot);
    recordActivity();

    if (APP.game.game_over()) {
      finishGame();
      return;
    }

    if (!isBot && APP.opponentType.startsWith("bot-") && APP.game.turn() === "b") {
      triggerBotMove();
    }
  }

  function triggerBotMove() {
    if (!APP.game || APP.game.game_over()) return;
    APP.botThinking = true;

    window.setTimeout(() => {
      if (!APP.game || APP.game.game_over() || APP.game.turn() !== "b") {
        APP.botThinking = false;
        return;
      }
      const chosen = chooseBotMove(APP.game, APP.opponentType);
      APP.botThinking = false;
      if (chosen) {
        makeMove(chosen.from, chosen.to, true);
      }
    }, 320);
  }

  /* ----------------------------------------------------------
     6. AI COACH — 3 MODES LOGIC (PLAY, LIVE COACH, LEARN FIRST)
     ---------------------------------------------------------- */

  function updateCoachAfterMove(move, delta, isBot) {
    setText(
      "#coachContextText",
      `${move.color === "w" ? "White" : "Black"} played ${move.san}`
    );

    // Mode 2: Live Coach gives real-time move feedback
    if (APP.mode === "live" && !isBot) {
      const tips = [];

      if (move.san.includes("+")) {
        tips.push(`Good forcing check (${move.san})! Checks force the opponent to respond immediately.`);
      } else if (move.captured) {
        tips.push(`You captured a piece with ${move.san}. Always verify if the square ${move.to} is safe from recapture.`);
      } else if (CENTER_SQUARES.has(move.to)) {
        tips.push(`Strong central move (${move.san})! Controlling ${move.to} increases your piece mobility.`);
      } else if (move.san === "O-O" || move.san === "O-O-O") {
        tips.push(`Excellent castling (${move.san})! Your King is safer and your Rook is now activated.`);
      }

      // Check if player's moved piece is now undefended / attacked
      const opponentReplies = APP.game.moves({ verbose: true });
      const recaptureOnTo = opponentReplies.find(r => r.to === move.to);
      if (recaptureOnTo && PIECE_VALUES[move.piece] > 100) {
        tips.push(`⚠ Watch out: Your piece on ${move.to} can be attacked by ${recaptureOnTo.san}! Make sure it is defended.`);
      } else if (delta < -180) {
        tips.push(`⚠ Careful: ${move.san} weakens your material balance. Check all opponent captures before moving.`);
      }

      if (!tips.length) {
        tips.push(`Solid move (${move.san}). Watch your opponent's reply and look for active squares for your minor pieces.`);
      }

      addCoachMessage(tips.join(" "), "coach");
    }
  }

  function generatePostGameCoachSummary() {
    if (!APP.game || APP.moveEvaluations.length === 0) {
      showToast("Play a few moves first so the AI Coach can analyze your game!", "warning");
      return;
    }

    const whiteMoves = APP.moveEvaluations.filter(m => m.color === "White");
    const mistakes = whiteMoves.filter(m => m.delta <= -150);
    const strongMoves = whiteMoves.filter(m => m.delta >= 120 || CENTER_SQUARES.has(m.to) || m.san.includes("+"));

    const lines = [
      `📊 POST-GAME AI COACH REPORT (${APP.moveEvaluations.length} half-moves):`,
      `• Strong/Active Moves by White: ${strongMoves.length}`,
      `• Critical Mistakes Detected: ${mistakes.length}`
    ];

    if (mistakes.length > 0) {
      const worst = mistakes[0];
      lines.push(`• Key Mistake: On Move ${worst.moveNumber} (${worst.san}), material or safety dropped. Always check opponent captures on ${worst.to}!`);
    } else {
      lines.push(`• Clean Play! You avoided major material blunders in this game.`);
    }

    lines.push(`• Coach Tip: Control the center early, castle within the first 8 moves, and double-check undefended pieces.`);

    addCoachMessage(lines.join("\n"), "coach");
  }

  function renderMoveHistory() {
    if (!APP.game) return;
    const tbody = $("#moveTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const moves = APP.game.history({ verbose: true });

    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement("tr");
      row.append(
        createElement("td", "", String(Math.floor(i / 2) + 1)),
        createElement("td", "", moves[i].san),
        createElement("td", "", moves[i + 1]?.san || "")
      );
      tbody.appendChild(row);
    }

    if (moves.length === 0) {
      const row = document.createElement("tr");
      const cell = createElement("td", "", "Moves will appear here.");
      cell.colSpan = 3;
      row.appendChild(cell);
      tbody.appendChild(row);
    }

    tbody.parentElement?.scrollTo?.({
      top: tbody.parentElement.scrollHeight,
      behavior: "smooth"
    });
  }

  function updateGameStatus() {
    if (!APP.game) return;

    const turnIndicator = $("#turnIndicator");
    const turnName = APP.game.turn() === "w" ? "White" : "Black";
    let statusLabel = "In Progress";
    let bannerText = `${turnName} to move`;

    if (APP.game.in_checkmate()) {
      const winner = APP.game.turn() === "w" ? "Black" : "White";
      bannerText = `Checkmate — ${winner} wins!`;
      statusLabel = "Checkmate";
    } else if (APP.game.in_stalemate()) {
      bannerText = "Stalemate — Draw";
      statusLabel = "Stalemate";
    } else if (APP.game.in_draw()) {
      bannerText = "Draw";
      statusLabel = "Draw";
    } else if (APP.game.in_check()) {
      bannerText = `${turnName} is in check`;
      statusLabel = "Check";
    }

    if (turnIndicator) {
      turnIndicator.innerHTML = `<span class="turn-dot"></span> ${escapeHTML(bannerText)}`;
    }

    setText("#gameTurn", turnName);
    setText("#gameStatus", statusLabel);
  }

  function updateCapturedPieces() {
    if (!APP.game) return;
    const moves = APP.game.history({ verbose: true });

    const whiteCaptured = moves
      .filter(move => move.captured && move.color === "w")
      .map(move => PIECES["b" + move.captured]);

    const blackCaptured = moves
      .filter(move => move.captured && move.color === "b")
      .map(move => PIECES["w" + move.captured]);

    setText("#whiteCaptured", whiteCaptured.length ? whiteCaptured.join(" ") : "—");
    setText("#blackCaptured", blackCaptured.length ? blackCaptured.join(" ") : "—");
  }

  function updateArenaStatistics() {
    if (!APP.game) return;
    const moves = APP.game.history().length;
    setText("#moveCount", `${Math.ceil(moves / 2)} Moves`);
    setText("#moveStat", String(moves));
  }

  function startNewGame() {
    if (!APP.game) return;

    APP.game.reset();
    APP.selectedSquare = null;
    APP.legalTargets = [];
    APP.lastMove = null;
    APP.redoStack = [];
    APP.history = [];
    APP.moveEvaluations = [];
    APP.completedGameRecorded = false;
    APP.botThinking = false;

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();

    showToast("New chess game started!");
  }

  function undoMove() {
    if (!APP.game || APP.botThinking) return;

    const move1 = APP.game.undo();
    if (!move1) {
      showToast("There are no moves to undo.", "warning");
      return;
    }
    APP.redoStack.push(move1);
    APP.moveEvaluations.pop();

    if (APP.opponentType.startsWith("bot-") && APP.game.turn() === "b") {
      const move2 = APP.game.undo();
      if (move2) {
        APP.redoStack.push(move2);
        APP.moveEvaluations.pop();
      }
    }

    APP.selectedSquare = null;
    APP.legalTargets = [];
    APP.lastMove = null;
    APP.completedGameRecorded = false;

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();
    showToast("Move undone.");
  }

  function redoMove() {
    if (!APP.game || APP.redoStack.length === 0) {
      showToast("There are no moves to replay.", "warning");
      return;
    }

    const move = APP.redoStack.pop();
    try {
      APP.game.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    } catch (error) {
      APP.redoStack = [];
    }

    renderBoard();
    renderMoveHistory();
    updateGameStatus();
    updateArenaStatistics();
    updateCapturedPieces();
  }

  function flipBoard() {
    APP.orientation = APP.orientation === "white" ? "black" : "white";
    renderBoard();
    showToast(`Board flipped (${APP.orientation} at bottom).`);
  }

  function exportPGN() {
    if (!APP.game) return;
    const pgn = APP.game.pgn();
    if (!pgn.trim()) {
      showToast("Play some moves before exporting PGN.", "warning");
      return;
    }
    downloadText(pgn, `arionz-chess-${Date.now()}.pgn`, "application/x-chess-pgn;charset=utf-8");
    showToast("PGN exported successfully.");
  }

  function resignGame() {
    if (!APP.game || APP.game.history().length === 0) {
      showToast("There is no active game to resign.", "warning");
      return;
    }

    if (!window.confirm("Are you sure you want to resign this game?")) return;

    const winner = APP.game.turn() === "w" ? "Black" : "White";
    setText("#gameStatus", `Resigned (${winner} wins)`);
    saveCompletedGame("Resignation", winner);
    generatePostGameCoachSummary();
    showToast(`${winner} wins by resignation.`);
  }

  function finishGame() {
    if (!APP.game || APP.completedGameRecorded) return;

    let result = "Draw";
    let winner = "Draw";

    if (APP.game.in_checkmate()) {
      winner = APP.game.turn() === "w" ? "Black" : "White";
      result = `${winner} wins by checkmate`;
    } else if (APP.game.in_stalemate()) {
      result = "Stalemate";
    }

    saveCompletedGame(result, winner);
    generatePostGameCoachSummary();
    showToast(result);
  }

  function saveCompletedGame(result, winner) {
    if (APP.completedGameRecorded || !APP.game) return;

    APP.completedGameRecorded = true;
    const records = readStorage(STORAGE_KEYS.games, []);
    const moves = APP.game.history();

    const record = {
      id: `game-${Date.now()}`,
      date: new Date().toISOString(),
      result,
      winner,
      moves: moves.length,
      pgn: APP.game.pgn(),
      playerColor: "white",
      timeControl: "unlimited"
    };

    records.unshift(record);
    writeStorage(STORAGE_KEYS.games, records.slice(0, 500));
    APP.history = records;

    updateDashboardStats();
    updateGameHistoryStats();
    updateProgressOverview();
    updateAchievements();
  }

  function addCoachMessage(message, sender = "coach") {
    const container = $("#chatMessages");
    if (!container) return;

    const row = createElement("div", `chat-message ${sender === "user" ? "user" : "ai-message"}`);

    if (sender !== "user") {
      const avatar = createElement("div", "message-avatar", "AI");
      row.appendChild(avatar);
    }

    const bubble = createElement("div", "message-content");
    const label = createElement("span", "", sender === "user" ? "YOU" : "ARIONZ AI");
    const text = createElement("p", "", message);

    bubble.append(label, text);
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  function getCoachResponse(question) {
    const text = question.toLowerCase();
    if (!APP.game) return "The chessboard is not ready yet.";

    if (text.includes("position") || text.includes("explain")) {
      const turn = APP.game.turn() === "w" ? "White" : "Black";
      const halfMoves = APP.game.history().length;
      const evalScore = (evaluateBoard(APP.game) / 100).toFixed(1);
      return `Move ${Math.ceil((halfMoves + 1) / 2)} (${turn} to move). Material/Position balance: ${evalScore > 0 ? "+" + evalScore : evalScore}. Focus on central squares (e4, d4, e5, d5) and piece safety.`;
    }

    if (text.includes("next move") || text.includes("consider") || text.includes("hint")) {
      const suggested = chooseBotMove(APP.game, "bot-advanced");
      if (suggested) {
        return `Candidate Move Idea: Consider ${suggested.san} (${suggested.from} → ${suggested.to}). Always verify your opponent's checks and captures before playing it!`;
      }
      return "Check all forcing moves (checks, captures, and threats) before deciding.";
    }

    if (text.includes("teach") || text.includes("concept")) {
      return "Golden Opening Rule: Develop Knights before Bishops, control the center with pawns, castle before move 8, and never move the same piece twice in the opening without a tactical reason.";
    }

    const suggested = chooseBotMove(APP.game, "bot-intermediate");
    return `Current turn: ${APP.game.turn() === "w" ? "White" : "Black"}. ${suggested ? `A solid candidate move here is ${suggested.san}.` : ""} Ask me to "Explain position" or click "AI Game Review" anytime!`;
  }

  function submitCoachMessage(message) {
    const clean = message.trim();
    if (!clean) return;

    addCoachMessage(clean, "user");
    const response = getCoachResponse(clean);
    window.setTimeout(() => addCoachMessage(response, "coach"), 180);
  }

  function initCoach() {
    const form = $("#chatForm");
    const input = $("#chatInput");

    form?.addEventListener("submit", event => {
      event.preventDefault();
      if (!input) return;
      submitCoachMessage(input.value);
      input.value = "";
    });

    $$("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        submitCoachMessage(button.dataset.prompt || button.textContent);
      });
    });
  }

  function initGameModes() {
    $$("[data-mode]").forEach(button => {
      button.addEventListener("click", () => {
        APP.mode = button.dataset.mode;

        $$("[data-mode]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        const learnBanner = $("#learnFirstBanner");
        if (learnBanner) {
          learnBanner.classList.toggle("hidden", APP.mode !== "learn");
        }

        if (APP.mode === "play") {
          setText("#coachContextText", "Mode 1: Play & Analyze — Play your match; AI will review your mistakes at the end.");
          addCoachMessage("Switched to Play & Analyze Mode. Focus on your game! When the match ends (or when you click 'AI Game Review'), I will summarize your mistakes and strong moves.", "coach");
        } else if (APP.mode === "live") {
          setText("#coachContextText", "Mode 2: Live Coach — Real-time move-by-move guidance active.");
          addCoachMessage("Switched to Live Coach Mode! Make a move on the board and I will give you instant coaching feedback after every turn.", "coach");
        } else if (APP.mode === "learn") {
          setText("#coachContextText", "Mode 3: Learn First — Study the pre-game guide & load fast-win scenarios.");
          addCoachMessage("Switched to Learn First Mode! Check the Short-Term Winning Guide above the chessboard to load famous tactical traps and opening setups.", "coach");
        }

        showToast(`${button.querySelector("h3")?.textContent || "Game"} mode active.`);
      });
    });
  }

  function initChessButtons() {
    $("#newGameButton")?.addEventListener("click", startNewGame);
    $("#restartGame")?.addEventListener("click", startNewGame);
    $("#undoMove")?.addEventListener("click", undoMove);
    $("#previousMove")?.addEventListener("click", undoMove);
    $("#nextMove")?.addEventListener("click", redoMove);
    $("#flipBoard")?.addEventListener("click", flipBoard);
    $("#exportPGN")?.addEventListener("click", exportPGN);
    $("#resignButton")?.addEventListener("click", resignGame);

    $("#clearHistory")?.addEventListener("click", () => {
      if (window.confirm("Clear the current move list and start a new game?")) {
        startNewGame();
      }
    });

    $("#boardOrientation")?.addEventListener("change", event => {
      APP.orientation = event.target.value === "black" ? "black" : "white";
      renderBoard();
    });
  }

  /* ----------------------------------------------------------
     7. DASHBOARD & LEARN CHESS TRACKING
     ---------------------------------------------------------- */

  function calculatePlayerRating() {
    const games = getGames();
    const wins = games.filter(g => g.winner === "White").length;
    const draws = games.filter(g => g.winner === "Draw").length;
    const losses = games.filter(g => g.winner === "Black").length;
    const puzzleStats = readStorage(STORAGE_KEYS.puzzleStats, { solved: 0 });
    const lessons = readStorage(STORAGE_KEYS.lessons, []);

    const rating = 1000 + (wins * 18) + (draws * 4) - (losses * 10) + ((puzzleStats.solved || 0) * 8) + (lessons.length * 10);
    return Math.max(600, rating);
  }

  function updateDashboardStats() {
    const games = getGames();
    const puzzleStats = readStorage(STORAGE_KEYS.puzzleStats, { solved: 0 });
    const activity = readStorage(STORAGE_KEYS.activity, []);
    const lessons = readStorage(STORAGE_KEYS.lessons, []);
    const rating = calculatePlayerRating();

    setText("#dashboardRating", String(rating));
    const ratingCardP = $("#dashboardRating")?.nextElementSibling;
    if (ratingCardP) ratingCardP.textContent = "Live ArionZ Performance Rating";

    setText("#dashboardGames", String(games.length));
    setText("#dashboardPuzzles", String(puzzleStats.solved || 0));
    setText("#dashboardStreak", `${activity.length || 1} Days`);

    // Update Daily Goals automatically based on real progress
    const goalItems = $$("#page-dashboard .daily-goals .goal-item");
    const checks = [
      lessons.length >= 1,
      (puzzleStats.solved || 0) >= 5,
      games.length >= 1
    ];

    goalItems.forEach((item, index) => {
      const badge = $(".goal-status", item);
      if (!badge) return;
      if (checks[index]) {
        badge.textContent = "COMPLETED ✓";
        badge.classList.add("completed");
      } else {
        badge.textContent = "IN PROGRESS";
        badge.classList.remove("completed");
      }
    });
  }

  function updateLearningStats() {
    const completed = readStorage(STORAGE_KEYS.lessons, []);
    const count = completed.length;
    const pct = Math.min(100, Math.round((count / 12) * 100));

    setText("#lessonsCompleted", String(count));
    setText("#learningProgress", `${pct}%`);
  }

  function initLearnChessPage() {
    const markLessonDone = (lessonId, title) => {
      const completed = readStorage(STORAGE_KEYS.lessons, []);
      if (!completed.includes(lessonId)) {
        completed.push(lessonId);
        writeStorage(STORAGE_KEYS.lessons, completed);
        recordActivity();
      }
      updateLearningStats();
      updateDashboardStats();
      updateAchievements();
      showToast(`Lesson studied: ${title} (+10 Rating XP)`);
    };

    $$("#page-learn .piece-card").forEach((card, idx) => {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        const pieceName = $("h3", card)?.textContent || `Piece ${idx + 1}`;
        markLessonDone(`piece-${pieceName.toLowerCase()}`, `${pieceName} Mastery`);
      });
    });

    $$("#page-learn .learning-stage button").forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        markLessonDone(`stage-${idx + 1}`, `Learning Stage 0${idx + 1}`);
      });
    });
  }

  /* ----------------------------------------------------------
     8. PAGE 4: CHESS RULES — REAL 10-QUESTION INTERACTIVE QUIZ
     ---------------------------------------------------------- */

  const RULES_QUIZ_QUESTIONS = [
    {
      q: "Which piece is the ONLY piece allowed to jump over other pieces?",
      options: ["Rook", "Knight", "Bishop", "Queen"],
      correct: 1,
      explanation: "The Knight moves in an L-shape (2 squares in one direction and 1 perpendicular) and can jump over any piece in its way."
    },
    {
      q: "What is the result of a game when a player has NO legal moves, but their King is NOT in check?",
      options: ["Checkmate", "Stalemate (Draw)", "Automatic Loss", "Extra Turn for Opponent"],
      correct: 1,
      explanation: "Stalemate ends the game immediately as a Draw! Checkmate requires the King to be under attack (in check)."
    },
    {
      q: "When Castling kingside or queenside, how many squares does the King move?",
      options: ["1 square", "2 squares toward the Rook", "3 squares toward the Rook", "All the way to the corner"],
      correct: 1,
      explanation: "In both kingside (O-O) and queenside (O-O-O) castling, the King always moves exactly 2 squares toward the Rook, and the Rook jumps to the other side of the King."
    },
    {
      q: "Under which condition is Castling ILLEGAL?",
      options: ["The Rook is under attack", "The King is currently in check", "The Queen has already moved", "A Knight is on the back rank"],
      correct: 1,
      explanation: "You cannot castle out of check, through check, or into check, nor if the King or the castling Rook has previously moved."
    },
    {
      q: "When must an 'En Passant' pawn capture be played?",
      options: ["Within 3 moves", "Immediately on the very next turn", "Anytime during the endgame", "Only when the King is in check"],
      correct: 1,
      explanation: "En Passant must be played immediately on the move right after the opponent's pawn advances two squares past your pawn, or the right is lost."
    },
    {
      q: "When a Pawn reaches the 8th (last) rank, which piece can it NOT promote into?",
      options: ["Queen", "Knight", "Second King", "Rook"],
      correct: 2,
      explanation: "A pawn must promote to a Queen, Rook, Bishop, or Knight of the same color. It can never become a King or remain a pawn."
    },
    {
      q: "How should a chessboard always be oriented at the start of a game?",
      options: ["Dark square on each player's bottom-right", "Light square on each player's bottom-right ('White on right')", "It does not matter", "Queens always start on dark squares"],
      correct: 1,
      explanation: "Rule 02: 'White on the right' (h1 and a8 must be light squares), and the White Queen starts on d1 (light) while the Black Queen starts on d8 (dark)."
    },
    {
      q: "What is the 'Threefold Repetition' draw rule?",
      options: ["Making 3 checks in a row", "Moving the same piece 3 times", "The exact same board position with the same player to move occurs 3 times", "Playing 3 games in a row"],
      correct: 2,
      explanation: "If the exact same position with the same side to move and same castling/en-passant rights occurs 3 times (not necessarily consecutive), a draw can be claimed."
    },
    {
      q: "Under the 'Fifty-Move Rule', a draw can be claimed if 50 consecutive moves by each player occur without:",
      options: ["Castling or Check", "Any Pawn move or any Piece capture", "Moving the Queen", "Promoting a pawn"],
      correct: 1,
      explanation: "If 50 full moves pass with zero pawn advances and zero captures, either player may claim a draw."
    },
    {
      q: "Which of the following endings is an automatic Draw by 'Insufficient Material'?",
      options: ["King + Rook vs King", "King + Queen vs King", "King + single Bishop vs King", "King + 2 Pawns vs King"],
      correct: 2,
      explanation: "A lone King and a single Bishop (or single Knight) cannot force checkmate against a lone King under any legal sequence of moves."
    }
  ];

  function initRuleSearchAndQuiz() {
    const searchInput = $("#rulesSearch");
    if (searchInput) {
      const cards = $$("#page-rules .rule-card");
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        cards.forEach(card => {
          card.style.display = card.textContent.toLowerCase().includes(query) ? "" : "none";
        });
      });
    }

    const quizContainer = $("#page-rules .quiz-question");
    if (!quizContainer) return;

    let currentIdx = 0;
    let score = 0;
    let answered = false;

    function renderQuizQuestion() {
      if (currentIdx >= RULES_QUIZ_QUESTIONS.length) {
        const pct = Math.round((score / RULES_QUIZ_QUESTIONS.length) * 100);
        writeStorage(STORAGE_KEYS.quizBest, Math.max(score, readStorage(STORAGE_KEYS.quizBest, 0)));

        const completedLessons = readStorage(STORAGE_KEYS.lessons, []);
        if (!completedLessons.includes("rules-quiz")) {
          completedLessons.push("rules-quiz");
          writeStorage(STORAGE_KEYS.lessons, completedLessons);
        }
        updateAchievements();
        updateDashboardStats();

        quizContainer.innerHTML = `
          <div class="quiz-header-bar">
            <span class="quiz-counter">QUIZ COMPLETED</span>
            <span class="quiz-score-badge">FINAL SCORE: ${score} / ${RULES_QUIZ_QUESTIONS.length} (${pct}%)</span>
          </div>
          <h3>${score >= 8 ? "🏆 Outstanding! You are a Chess Rules Master!" : "👏 Good Effort! Review the rules and try for 10/10!"}</h3>
          <p class="quiz-feedback">You answered ${score} out of ${RULES_QUIZ_QUESTIONS.length} official chess rule questions correctly.</p>
          <div class="quiz-actions-bar">
            <button type="button" class="primary-button" id="restartRulesQuizBtn">↻ Restart 10-Question Quiz</button>
          </div>
        `;

        $("#restartRulesQuizBtn", quizContainer)?.addEventListener("click", () => {
          currentIdx = 0;
          score = 0;
          answered = false;
          renderQuizQuestion();
        });
        return;
      }

      const item = RULES_QUIZ_QUESTIONS[currentIdx];
      answered = false;

      quizContainer.innerHTML = `
        <div class="quiz-header-bar">
          <span class="quiz-counter">QUESTION ${String(currentIdx + 1).padStart(2, "0")} OF ${RULES_QUIZ_QUESTIONS.length}</span>
          <span class="quiz-score-badge">SCORE: ${score} / ${RULES_QUIZ_QUESTIONS.length}</span>
        </div>
        <div class="performance-progress" style="margin-bottom:14px;">
          <div class="performance-progress-fill" style="width:${((currentIdx) / RULES_QUIZ_QUESTIONS.length) * 100}%;"></div>
        </div>
        <h3>${escapeHTML(item.q)}</h3>
        <div class="quiz-options">
          ${item.options.map((opt, idx) => `
            <button type="button" class="quiz-option" data-opt-idx="${idx}">${escapeHTML(opt)}</button>
          `).join("")}
        </div>
        <p class="quiz-feedback" id="rulesQuizFeedback">Select an answer above to verify your chess rules knowledge.</p>
        <div class="quiz-actions-bar">
          <button type="button" class="secondary-button" id="resetQuizNowBtn">↻ Restart</button>
          <button type="button" class="primary-button" id="nextQuizQuestionBtn" disabled>Next Question →</button>
        </div>
      `;

      const optionButtons = $$(".quiz-option", quizContainer);
      const feedbackEl = $("#rulesQuizFeedback", quizContainer);
      const nextBtn = $("#nextQuizQuestionBtn", quizContainer);

      optionButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;

          const picked = Number(btn.dataset.optIdx);
          const isCorrect = picked === item.correct;
          if (isCorrect) score++;

          optionButtons.forEach((b, idx) => {
            b.disabled = true;
            if (idx === item.correct) b.classList.add("correct");
            else if (idx === picked && !isCorrect) b.classList.add("incorrect");
          });

          if (feedbackEl) {
            feedbackEl.textContent = (isCorrect ? "✓ Correct! " : "✕ Incorrect. ") + item.explanation;
          }

          if (nextBtn) nextBtn.disabled = false;
        });
      });

      nextBtn?.addEventListener("click", () => {
        currentIdx++;
        renderQuizQuestion();
      });

      $("#resetQuizNowBtn", quizContainer)?.addEventListener("click", () => {
        currentIdx = 0;
        score = 0;
        renderQuizQuestion();
      });
    }

    renderQuizQuestion();
  }

  /* ----------------------------------------------------------
     9. PAGE 5: OPENING EXPLORER — 16 OPENINGS + LIVE BOARD + REPERTOIRE
     ---------------------------------------------------------- */

  const OPENING_DATA = {
    italian: {
      title: "Italian Game",
      color: "white",
      level: "beginner",
      style: "Open Game",
      symbol: "♙",
      subtitle: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3"],
      description: "Develops pieces actively and targets the sensitive f7 square. Ideal for learning rapid development and central control.",
      ideas: [
        "Develop Knights and Bishop rapidly toward the center.",
        "Eye the weak f7 pawn and castle kingside early.",
        "Prepare c3 and d4 to claim the full center."
      ],
      mistakes: [
        "sacrificing on f7 prematurely without enough attackers.",
        "Neglecting queenside development in the middlegame."
      ]
    },
    ruy: {
      title: "Ruy Lopez (Spanish)",
      color: "white",
      level: "intermediate",
      style: "Open Game",
      symbol: "♘",
      subtitle: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"],
      description: "A classical Championship favourite that pressures Black's e5 defender and builds long-term strategic pressure.",
      ideas: [
        "Pressure the c6 Knight defending Black's e5 pawn.",
        "Castle quickly and bring the Rook to e1.",
        "Prepare c3 and d4 for a powerful pawn center."
      ],
      mistakes: [
        "Trading the b5 Bishop for the c6 Knight too early without a reason.",
        "Falling into the Noah's Ark trap on the queenside."
      ]
    },
    queens: {
      title: "Queen's Gambit",
      color: "white",
      level: "beginner",
      style: "Closed Game",
      symbol: "♗",
      subtitle: "1. d4 d5 2. c4",
      moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3"],
      description: "White offers a flank pawn to pull Black's central d5 pawn away and dominate the central squares.",
      ideas: [
        "Challenge Black's d5 anchor immediately.",
        "Develop Nc3 and Bg5 to pressure Black's center.",
        "Use the c-file for Rook pressure."
      ],
      mistakes: [
        "Trying to cling to the c4 pawn at the cost of development.",
        "Locking the dark-squared Bishop inside the e3 pawn chain."
      ]
    },
    sicilian: {
      title: "Sicilian Defence",
      color: "black",
      level: "advanced",
      style: "Semi-Open",
      symbol: "♟",
      subtitle: "1. e4 c5",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
      description: "Black's most dynamic counterattacking weapon against 1.e4, creating asymmetrical positions and fighting for the win.",
      ideas: [
        "Trade the flank c-pawn for White's central d4 pawn.",
        "Use the half-open c-file for Queen and Rook counterplay.",
        "Fight for central squares d5 and e5."
      ],
      mistakes: [
        "Falling behind in kingside development and leaving the King in the center.",
        "Creating unguarded holes on d5 or d6."
      ]
    },
    french: {
      title: "French Defence",
      color: "black",
      level: "intermediate",
      style: "Semi-Open",
      symbol: "♞",
      subtitle: "1. e4 e6 2. d4 d5",
      moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "e5", "Nfd7", "f4", "c5"],
      description: "A resilient strategic defense where Black builds a solid pawn chain and counterattacks White's center with ...c5 and ...f6.",
      ideas: [
        "Strike the base of White's pawn chain with ...c5.",
        "Add pressure on d4 with ...Nc6 and ...Qb6.",
        "Break White's spearhead on e5 with a timely ...f6."
      ],
      mistakes: [
        "Never activating the light-squared c8 Bishop.",
        "Playing passively while White attacks on the kingside."
      ]
    },
    carokann: {
      title: "Caro-Kann Defence",
      color: "black",
      level: "beginner",
      style: "Semi-Open",
      symbol: "♜",
      subtitle: "1. e4 c6 2. d4 d5",
      moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3", "Bg6"],
      description: "Extremely solid defense that challenges e4 with ...d5 while keeping the light-squared Bishop free to develop to f5.",
      ideas: [
        "Support ...d5 with ...c6.",
        "Develop the light-squared Bishop to f5 or g4 outside the pawn chain.",
        "Play ...e6 and ...c5 for a rock-solid structure."
      ],
      mistakes: [
        "Allowing the f5 Bishop to get trapped without an escape square on g6/h7.",
        "Delaying ...c5 counterplay."
      ]
    },
    kingsindian: {
      title: "King's Indian Defence",
      color: "black",
      level: "advanced",
      style: "Indian Defence",
      symbol: "♛",
      subtitle: "1. d4 Nf6 2. c4 g6",
      moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O"],
      description: "A fierce counterattacking defense where Black fianchettoes the dark-squared Bishop and strikes the center with ...e5 or ...c5.",
      ideas: [
        "Fianchetto the dark-squared Bishop on the long g7 diagonal.",
        "Castle early and strike the center with ...e5.",
        "Launch a kingside pawn storm (...f5, ...g5) when the center locks."
      ],
      mistakes: [
        "Trading off the powerful g7 Bishop lightly.",
        "Playing passively without challenging White's space advantage."
      ]
    },
    london: {
      title: "London System",
      color: "white",
      level: "beginner",
      style: "System Opening",
      symbol: "♖",
      subtitle: "1. d4 d5 2. Bf4",
      moves: ["d4", "d5", "Bf4", "Nf6", "e3", "c5", "c3", "Nc6", "Nd2", "Bf5"],
      description: "A universal, beginner-friendly system for White with a rock-solid pyramid pawn structure on d4, c3, and e3.",
      ideas: [
        "Develop the dark-squared Bishop to f4 before playing e3.",
        "Build an unbreakable d4-c3-e3 pawn triangle.",
        "Plant a Knight on the central e5 outpost."
      ],
      mistakes: [
        "Ignoring Black's early ...Qb6 attack on the b2 pawn.",
        "Playing mechanically without reacting to central breaks."
      ]
    },
    scotch: {
      title: "Scotch Game",
      color: "white",
      level: "beginner",
      style: "Open Game",
      symbol: "♙",
      subtitle: "1. e4 e5 2. Nf3 Nc6 3. d4",
      moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nc3", "Bb4"],
      description: "White immediately opens the center on move 3, gaining open lines and active piece play without long theoretical memorization.",
      ideas: [
        "Open the center immediately with 3.d4.",
        "Centralize the Knight on d4 and develop rapidly.",
        "Create immediate tactical pressure in the center."
      ],
      mistakes: [
        "Allowing Black's Queen or Bishop to win the e4 pawn.",
        "Trading Knights on c6 unnecessarily and helping Black's development."
      ]
    },
    kingsgambit: {
      title: "King's Gambit",
      color: "white",
      level: "intermediate",
      style: "Gambit Opening",
      symbol: "✦",
      subtitle: "1. e4 e5 2. f4",
      moves: ["e4", "e5", "f4", "exf4", "Nf3", "g5", "Bc4", "Bg7", "O-O"],
      description: "A romantic, aggressive gambit where White sacrifices the f-pawn to deflect Black's e5 pawn and open the f-file for attack.",
      ideas: [
        "Deflect Black's e5 pawn and seize the center with d4.",
        "Open the f-file to target Black's f7 square after castling.",
        "Develop with maximum initiative."
      ],
      mistakes: [
        "Forgetting to play 3.Nf3 and allowing ...Qh4+!",
        "Exposing the White King without developing pieces."
      ]
    },
    english: {
      title: "English Opening",
      color: "white",
      level: "intermediate",
      style: "Flank Opening",
      symbol: "♕",
      subtitle: "1. c4",
      moves: ["c4", "e5", "Nc3", "Nf6", "g3", "d5", "cxd5", "Nxd5", "Bg2"],
      description: "A flexible flank opening where White fights for the central d5 square with the c-pawn and often fianchettoes on g2.",
      ideas: [
        "Control the d5 square from the flank.",
        "Fianchetto the light-squared Bishop on g2 to dominate the long diagonal.",
        "Transpose favorably into d4 or Sicilian-reversed structures."
      ],
      mistakes: [
        "Allowing Black to occupy d4 and e5 unchallenged.",
        "Weakening the light squares around the King."
      ]
    },
    vienna: {
      title: "Vienna Game",
      color: "white",
      level: "beginner",
      style: "Open Game",
      symbol: "♘",
      subtitle: "1. e4 e5 2. Nc3",
      moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3"],
      description: "White develops the queenside Knight first to protect e4 and prepare a well-supported f4 advance.",
      ideas: [
        "Support the e4 pawn before launching the f4 break.",
        "Develop Bc4 and Nf3 for rapid kingside pressure.",
        "Punish passive copycat moves by Black."
      ],
      mistakes: [
        "Allowing Black's ...d5 counterstrike without knowing 4.fxe5!",
        "Blocking the f-pawn if intending a gambit style."
      ]
    },
    slav: {
      title: "Slav Defence",
      color: "black",
      level: "beginner",
      style: "Closed Game",
      symbol: "♜",
      subtitle: "1. d4 d5 2. c4 c6",
      moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4", "Bf5"],
      description: "One of the most reliable defenses to 1.d4—Black supports d5 with ...c6 while keeping the light-squared Bishop unobstructed.",
      ideas: [
        "Reinforce the d5 pawn with ...c6.",
        "Develop the light-squared Bishop to f5 or g4.",
        "Follow up with ...e6 and ...Nbd7 for a harmonious setup."
      ],
      mistakes: [
        "Dropping the b7 pawn after developing the c8 Bishop too early.",
        "Missing White's e4 break."
      ]
    },
    nimzo: {
      title: "Nimzo-Indian Defence",
      color: "black",
      level: "advanced",
      style: "Indian Defence",
      symbol: "♝",
      subtitle: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
      moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O", "Bd3", "d5"],
      description: "A hypermodern masterpiece: Black pins the c3 Knight to prevent White from playing e4 and fights for central light squares.",
      ideas: [
        "Pin the c3 Knight with ...Bb4 to control e4.",
        "Double White's c-pawns when strategically favorable.",
        "Castle kingside rapidly and strike with ...c5 or ...d5."
      ],
      mistakes: [
        "Giving up the Bishop pair on c3 without doubling pawns or gaining tempo.",
        "Allowing White to build an unchallenged e4 pawn center."
      ]
    },
    scandinavian: {
      title: "Scandinavian Defence",
      color: "black",
      level: "beginner",
      style: "Semi-Open",
      symbol: "♟",
      subtitle: "1. e4 d5",
      moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3", "Bf5"],
      description: "Black immediately challenges White's e4 pawn on move 1, leading to clear-cut development and easy-to-understand plans.",
      ideas: [
        "Eliminate White's e4 pawn immediately.",
        "Place the Queen safely on a5 or d6 and develop ...Bf5 and ...c6.",
        "Build a solid Caro-Kann-style pawn structure."
      ],
      mistakes: [
        "Moving the Queen repeatedly to unsafe squares in the middle of the board.",
        "Forgetting to play ...c6 to give the Queen a retreat square on c7."
      ]
    },
    pirc: {
      title: "Pirc Defence",
      color: "black",
      level: "intermediate",
      style: "Indian Defence",
      symbol: "♞",
      subtitle: "1. e4 d6 2. d4 Nf6 3. Nc3 g6",
      moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "Nf3", "Bg7", "Be2", "O-O"],
      description: "A flexible hypermodern defense against 1.e4 where Black invites White to occupy the center and counterattacks it from the flank.",
      ideas: [
        "Fianchetto the dark-squared Bishop on g7.",
        "Attack White's e4/d4 center with ...c5 or ...e5.",
        "Create counterplay on the queenside."
      ],
      mistakes: [
        "Allowing White to play e5 with tempo before Black has castled.",
        "Playing too passively without striking the center."
      ]
    }
  };

  function initOpeningExplorer() {
    const grid = $("#page-openings .opening-grid");
    if (!grid) return;

    // Render all 16 openings cleanly into .opening-grid
    grid.innerHTML = Object.entries(OPENING_DATA).map(([key, info]) => `
      <article class="opening-card" data-opening-color="${info.color}" data-opening-level="${info.level}">
        <div class="opening-card-top">
          <span class="opening-type">${info.color === "white" ? "WHITE OPENING" : "BLACK DEFENCE"}</span>
          <span class="opening-level">${info.level.toUpperCase()}</span>
        </div>
        <div class="opening-symbol">${info.symbol}</div>
        <h3>${escapeHTML(info.title)}</h3>
        <p class="opening-notation">${escapeHTML(info.subtitle)}</p>
        <p>${escapeHTML(info.description)}</p>
        <div class="opening-meta">
          <span>Style: ${escapeHTML(info.style)}</span>
          <span>Level: ${escapeHTML(info.level)}</span>
        </div>
        <button type="button" class="secondary-button opening-detail-button" data-opening="${key}">Explore on Board →</button>
      </article>
    `).join("");

    // Mount Interactive Opening Board inside #openingDetailPanel
    const detailBoardContainer = $("#openingDetailPanel .opening-detail-board");
    let currentOpeningKey = "italian";
    let currentOpeningStep = 5;
    let autoPlayTimer = null;

    if (detailBoardContainer) {
      detailBoardContainer.innerHTML = `
        <div class="opening-interactive-wrap">
          <div class="chessboard mini-board" id="openingInteractiveBoard"></div>
          <div class="opening-board-controls">
            <button type="button" class="secondary-button" id="openStartBtn">⏮</button>
            <button type="button" class="secondary-button" id="openPrevBtn">◀ Prev</button>
            <button type="button" class="secondary-button" id="openAutoBtn">▶ Play</button>
            <button type="button" class="secondary-button" id="openNextBtn">Next ▶</button>
          </div>
          <button type="button" class="primary-button" id="practiceOpeningInArenaBtn" style="width:100%;margin-top:8px;">
            Practice This Opening in Chess Arena →
          </button>
        </div>
        <div class="opening-notation-box">
          <span>MAIN LINE PROGRESS</span>
          <p id="openingMainLine">1. e4 e5 2. Nf3 Nc6 3. Bc4</p>
        </div>
      `;
    }

    function renderOpeningPreviewBoard() {
      const info = OPENING_DATA[currentOpeningKey];
      const boardEl = $("#openingInteractiveBoard");
      if (!info || !boardEl || typeof window.Chess !== "function") return;

      const tempGame = new window.Chess();
      const maxStep = Math.min(currentOpeningStep, info.moves.length);
      let lastFrom = null;
      let lastTo = null;

      for (let i = 0; i < maxStep; i++) {
        const mv = tempGame.move(info.moves[i]);
        if (mv) {
          lastFrom = mv.from;
          lastTo = mv.to;
        }
      }

      const boardData = tempGame.board();
      boardEl.innerHTML = "";

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sqName = `${FILES[c]}${8 - r}`;
          const sq = createElement("div", `square ${(r + c) % 2 === 0 ? "light" : "dark"}`);
          if (sqName === lastFrom || sqName === lastTo) {
            sq.classList.add("last-move");
          }
          const piece = boardData[r][c];
          if (piece) {
            const colorClass = piece.color === "w" ? "white-piece" : "black-piece";
            sq.appendChild(createElement("span", `piece ${colorClass}`, PIECES[piece.color + piece.type]));
          }
          boardEl.appendChild(sq);
        }
      }

      setText("#openingDetailTitle", info.title);
      setText("#openingDetailSubtitle", info.subtitle);
      setText("#openingDetailDescription", info.description);
      setText("#openingMainLine", `${tempGame.pgn() || "Starting Position"} (${maxStep}/${info.moves.length} moves)`);

      const ideasList = $("#openingKeyIdeas");
      if (ideasList) {
        ideasList.innerHTML = info.ideas.map(i => `<li>${escapeHTML(i)}</li>`).join("");
      }

      const mistakesList = $("#openingCommonMistakes");
      if (mistakesList) {
        mistakesList.innerHTML = info.mistakes.map(m => `<li>${escapeHTML(m)}</li>`).join("");
      }
    }

    function selectOpening(key, scroll = true) {
      if (!OPENING_DATA[key]) return;
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
      currentOpeningKey = key;
      currentOpeningStep = OPENING_DATA[key].moves.length;
      renderOpeningPreviewBoard();
      if (scroll) {
        $("#openingDetailPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    $("#openStartBtn")?.addEventListener("click", () => {
      currentOpeningStep = 0;
      renderOpeningPreviewBoard();
    });

    $("#openPrevBtn")?.addEventListener("click", () => {
      currentOpeningStep = Math.max(0, currentOpeningStep - 1);
      renderOpeningPreviewBoard();
    });

    $("#openNextBtn")?.addEventListener("click", () => {
      const total = OPENING_DATA[currentOpeningKey].moves.length;
      currentOpeningStep = Math.min(total, currentOpeningStep + 1);
      renderOpeningPreviewBoard();
    });

    $("#openAutoBtn")?.addEventListener("click", () => {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        return;
      }
      currentOpeningStep = 0;
      renderOpeningPreviewBoard();
      autoPlayTimer = window.setInterval(() => {
        const total = OPENING_DATA[currentOpeningKey].moves.length;
        if (currentOpeningStep >= total) {
          clearInterval(autoPlayTimer);
          autoPlayTimer = null;
          return;
        }
        currentOpeningStep++;
        renderOpeningPreviewBoard();
      }, 650);
    });

    $("#practiceOpeningInArenaBtn")?.addEventListener("click", () => {
      const info = OPENING_DATA[currentOpeningKey];
      if (!info || !APP.game) return;
      APP.game.reset();
      for (const san of info.moves.slice(0, currentOpeningStep || info.moves.length)) {
        APP.game.move(san);
      }
      APP.orientation = info.color === "black" ? "black" : "white";
      renderBoard();
      renderMoveHistory();
      updateGameStatus();
      updateArenaStatistics();
      updateCapturedPieces();
      navigateTo("play");
      addCoachMessage(`Loaded ${info.title} (${info.subtitle}) onto the board! Continue playing from this position.`, "coach");
      showToast(`${info.title} loaded in Chess Arena!`);
    });

    // Filter Buttons
    const filterButtons = $$("[data-opening-filter]");
    const cards = $$("#page-openings .opening-card");

    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        const selectedFilter = button.dataset.openingFilter;
        filterButtons.forEach(item => item.classList.toggle("active", item === button));
        cards.forEach(card => {
          const color = card.dataset.openingColor;
          const level = card.dataset.openingLevel;
          const match = selectedFilter === "all" || color === selectedFilter || level === selectedFilter;
          card.style.display = match ? "" : "none";
        });
      });
    });

    $$("[data-opening]", grid).forEach(button => {
      button.addEventListener("click", () => selectOpening(button.dataset.opening, true));
    });

    // Replace "COMING SOON" in 04. Personal Opening Preparation with Real Repertoire Builder
    const prepContainer = $("#page-openings .opening-preparation");
    if (prepContainer) {
      const savedRep = readStorage(STORAGE_KEYS.repertoire, {
        white: "italian",
        blackE4: "sicilian",
        blackD4: "slav"
      });

      prepContainer.innerHTML = `
        <div class="preparation-item">
          <span class="preparation-icon">♔</span>
          <div>
            <h3>White Repertoire</h3>
            <p>Your primary weapon when playing with the White pieces.</p>
          </div>
          <div class="repertoire-controls">
            <select id="repWhiteSelect">
              <option value="italian">Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4)</option>
              <option value="ruy">Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5)</option>
              <option value="scotch">Scotch Game (1.e4 e5 2.Nf3 Nc6 3.d4)</option>
              <option value="queens">Queen's Gambit (1.d4 d5 2.c4)</option>
              <option value="london">London System (1.d4 d5 2.Bf4)</option>
              <option value="english">English Opening (1.c4)</option>
            </select>
            <button type="button" class="secondary-button" data-train-rep="white">Train →</button>
          </div>
        </div>

        <div class="preparation-item">
          <span class="preparation-icon">♚</span>
          <div>
            <h3>Black vs 1.e4</h3>
            <p>Your prepared counterattack against White's King Pawn opening.</p>
          </div>
          <div class="repertoire-controls">
            <select id="repBlackE4Select">
              <option value="sicilian">Sicilian Defence (1.e4 c5)</option>
              <option value="carokann">Caro-Kann Defence (1.e4 c6)</option>
              <option value="french">French Defence (1.e4 e6)</option>
              <option value="scandinavian">Scandinavian Defence (1.e4 d5)</option>
              <option value="pirc">Pirc Defence (1.e4 d6)</option>
            </select>
            <button type="button" class="secondary-button" data-train-rep="blackE4">Train →</button>
          </div>
        </div>

        <div class="preparation-item">
          <span class="preparation-icon">♜</span>
          <div>
            <h3>Black vs 1.d4</h3>
            <p>Your solid defensive system against White's Queen Pawn opening.</p>
          </div>
          <div class="repertoire-controls">
            <select id="repBlackD4Select">
              <option value="slav">Slav Defence (1.d4 d5 2.c4 c6)</option>
              <option value="kingsindian">King's Indian Defence (1.d4 Nf6 2.c4 g6)</option>
              <option value="nimzo">Nimzo-Indian Defence (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)</option>
            </select>
            <button type="button" class="secondary-button" data-train-rep="blackD4">Train →</button>
          </div>
        </div>
      `;

      const wSel = $("#repWhiteSelect", prepContainer);
      const bE4Sel = $("#repBlackE4Select", prepContainer);
      const bD4Sel = $("#repBlackD4Select", prepContainer);

      if (wSel) wSel.value = savedRep.white || "italian";
      if (bE4Sel) bE4Sel.value = savedRep.blackE4 || "sicilian";
      if (bD4Sel) bD4Sel.value = savedRep.blackD4 || "slav";

      const saveRep = () => {
        writeStorage(STORAGE_KEYS.repertoire, {
          white: wSel?.value || "italian",
          blackE4: bE4Sel?.value || "sicilian",
          blackD4: bD4Sel?.value || "slav"
        });
        showToast("Personal Opening Repertoire saved!");
      };

      wSel?.addEventListener("change", saveRep);
      bE4Sel?.addEventListener("change", saveRep);
      bD4Sel?.addEventListener("change", saveRep);

      $$("[data-train-rep]", prepContainer).forEach(btn => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.trainRep;
          const key =
            type === "white" ? wSel?.value :
            type === "blackE4" ? bE4Sel?.value :
            bD4Sel?.value;
          selectOpening(key || "italian", true);
          showToast(`Loaded ${OPENING_DATA[key]?.title || "Opening"} on the preview board!`);
        });
      });
    }

    selectOpening("italian", false);
  }

  /* ----------------------------------------------------------
     10. PAGE 8: PUZZLE TRAINING — REAL INTERACTIVE PUZZLE BOARD
     ---------------------------------------------------------- */

  const PUZZLE_LIBRARY = [
    {
      id: "puz-1",
      title: "Back-Rank Checkmate in 1",
      category: "mate",
      difficulty: "beginner",
      fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
      solutionFrom: "e1",
      solutionTo: "e8",
      prompt: "White to move — Black's King is trapped behind its own pawns on the 8th rank. Find Checkmate in 1!",
      hint: "Move your Rook on e1 all the way to the 8th rank (e8#)."
    },
    {
      id: "puz-2",
      title: "Royal Knight Fork",
      category: "tactics",
      difficulty: "beginner",
      fen: "r1bqk2r/pppp1ppp/2n2n2/4N3/1b2P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
      solutionFrom: "e5",
      solutionTo: "c6",
      prompt: "White to move — Capture a defender and create an immediate double attack!",
      hint: "Use your Knight on e5 to capture the Knight on c6, attacking the Queen on d8 and Bishop on b4!"
    },
    {
      id: "puz-3",
      title: "Queen & Bishop Battery Mate",
      category: "mate",
      difficulty: "beginner",
      fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      solutionFrom: "f3",
      solutionTo: "f7",
      prompt: "White to move — The f7 pawn is only defended by Black's King. Deliver Checkmate in 1!",
      hint: "Play Qxf7# supported by your Bishop on c4."
    },
    {
      id: "puz-4",
      title: "Knight Fork on King & Queen",
      category: "tactics",
      difficulty: "intermediate",
      fen: "4k3/8/8/3N4/8/8/2q5/4K3 w - - 0 1",
      solutionFrom: "d5",
      solutionTo: "c7",
      prompt: "White to move — Find the square where your Knight forks Black's King and Queen simultaneously!",
      hint: "Jump your Knight from d5 to c7+!"
    },
    {
      id: "puz-5",
      title: "Smothered Mate Pattern",
      category: "mate",
      difficulty: "intermediate",
      fen: "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1",
      solutionFrom: "h6",
      solutionTo: "f7",
      prompt: "White to move — Black's King on h8 is completely boxed in by its own Rook and Pawns. Deliver Smothered Mate!",
      hint: "Jump your Knight from h6 to f7#!"
    },
    {
      id: "puz-6",
      title: "Central Outpost Strategy",
      category: "strategy",
      difficulty: "intermediate",
      fen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",
      solutionFrom: "c3",
      solutionTo: "d5",
      prompt: "White to move — Plant your Knight on the powerful central d5 outpost to dominate the position!",
      hint: "Move your Knight from c3 to d5."
    },
    {
      id: "puz-7",
      title: "Speed Tactic: Winning the Queen",
      category: "speed",
      difficulty: "advanced",
      fen: "3q2k1/5ppp/8/8/3B4/8/5PPP/3R2K1 w - - 0 1",
      solutionFrom: "d4",
      solutionTo: "g7",
      prompt: "White to move — Unleash a discovered attack on Black's undefended Queen on d8!",
      hint: "Move your Bishop from d4 to g7, uncovering your Rook on d1!"
    },
    {
      id: "puz-8",
      title: "Arabian Corner Mate",
      category: "mate",
      difficulty: "advanced",
      fen: "7k/R7/5N2/8/8/8/8/6K1 w - - 0 1",
      solutionFrom: "a7",
      solutionTo: "h7",
      prompt: "White to move — Coordinate your Rook and Knight to deliver the classic Arabian Checkmate!",
      hint: "Slide your Rook from a7 to h7# (protected by your Knight on f6)!"
    }
  ];

  function initPuzzleTraining() {
    const workspace = $("#puzzleWorkspace");
    if (!workspace) return;

    let currentPuzzleIdx = 0;
    let puzzleGame = null;
    let selectedSq = null;
    let solvedCurrent = false;

    function updatePuzzleStatCards() {
      const stats = readStorage(STORAGE_KEYS.puzzleStats, {
        solved: 0,
        attempts: 0,
        streak: 0,
        bestStreak: 0
      });

      setText("#puzzlesSolved", stats.solved || 0);
      setText(
        "#puzzleAccuracy",
        stats.attempts ? `${Math.round((stats.solved / stats.attempts) * 100)}%` : "0%"
      );
      setText("#puzzleStreak", stats.streak || 0);
      setText("#bestPuzzleStreak", stats.bestStreak || 0);
      updateDashboardStats();
      updateAchievements();
    }

    workspace.innerHTML = `
      <div class="section-heading">
        <div>
          <h2 id="puzzleActiveTitle">Interactive Puzzle Workspace</h2>
          <p id="puzzleActiveCategory">Click a piece on the board and move it to the winning square.</p>
        </div>
        <span class="status-label" id="puzzleCounterBadge">PUZZLE 01 / ${PUZZLE_LIBRARY.length}</span>
      </div>
      <div class="puzzle-interactive-layout">
        <div class="puzzle-board-box">
          <div class="chessboard" id="puzzleInteractiveBoard"></div>
        </div>
        <div class="puzzle-info-box">
          <span class="eyebrow" id="puzzleDifficultyTag">BEGINNER · MATE</span>
          <h3 id="puzzlePromptTitle">Find the Best Move for White</h3>
          <div class="puzzle-feedback-banner" id="puzzleFeedbackBox">
            Select a White piece on the board and click its target square.
          </div>
          <div class="board-controls">
            <button type="button" class="secondary-button" id="puzzleHintBtn">💡 Hint</button>
            <button type="button" class="secondary-button" id="puzzleSolutionBtn">👁 Show Solution</button>
            <button type="button" class="primary-button" id="puzzleNextBtn">Next Puzzle →</button>
          </div>
        </div>
      </div>
    `;

    function loadPuzzle(index) {
      currentPuzzleIdx = ((index % PUZZLE_LIBRARY.length) + PUZZLE_LIBRARY.length) % PUZZLE_LIBRARY.length;
      const puz = PUZZLE_LIBRARY[currentPuzzleIdx];
      if (typeof window.Chess !== "function") return;

      puzzleGame = new window.Chess(puz.fen);
      selectedSq = null;
      solvedCurrent = false;

      setText("#puzzleActiveTitle", puz.title);
      setText("#puzzleCounterBadge", `PUZZLE ${String(currentPuzzleIdx + 1).padStart(2, "0")} / ${PUZZLE_LIBRARY.length}`);
      setText("#puzzleDifficultyTag", `${puz.difficulty.toUpperCase()} · ${puz.category.toUpperCase()}`);
      setText("#puzzlePromptTitle", puz.title);
      setText("#puzzleFeedbackBox", puz.prompt);

      renderPuzzleBoard();
    }

    function renderPuzzleBoard() {
      const boardEl = $("#puzzleInteractiveBoard");
      if (!boardEl || !puzzleGame) return;

      boardEl.innerHTML = "";
      const boardData = puzzleGame.board();
      const legalTargets = selectedSq
        ? puzzleGame.moves({ square: selectedSq, verbose: true }).map(m => m.to)
        : [];

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sqName = `${FILES[c]}${8 - r}`;
          const sqBtn = createElement("button", `square ${(r + c) % 2 === 0 ? "light" : "dark"}`);
          sqBtn.type = "button";
          sqBtn.dataset.puzSquare = sqName;

          if (selectedSq === sqName) sqBtn.classList.add("selected");
          if (legalTargets.includes(sqName)) {
            sqBtn.classList.add(puzzleGame.get(sqName) ? "possible-capture" : "possible-move");
          }

          const piece = boardData[r][c];
          if (piece) {
            const colorClass = piece.color === "w" ? "white-piece" : "black-piece";
            sqBtn.appendChild(createElement("span", `piece ${colorClass}`, PIECES[piece.color + piece.type]));
          }

          sqBtn.addEventListener("click", () => handlePuzzleSquareClick(sqName));
          boardEl.appendChild(sqBtn);
        }
      }
    }

    function handlePuzzleSquareClick(sqName) {
      if (!puzzleGame || solvedCurrent) return;
      const puz = PUZZLE_LIBRARY[currentPuzzleIdx];
      const piece = puzzleGame.get(sqName);

      if (selectedSq && sqName !== selectedSq) {
        const legal = puzzleGame.moves({ square: selectedSq, verbose: true }).find(m => m.to === sqName);
        if (legal) {
          const stats = readStorage(STORAGE_KEYS.puzzleStats, {
            solved: 0,
            attempts: 0,
            streak: 0,
            bestStreak: 0
          });
          stats.attempts = (stats.attempts || 0) + 1;

          if (selectedSq === puz.solutionFrom && sqName === puz.solutionTo) {
            puzzleGame.move({ from: selectedSq, to: sqName, promotion: "q" });
            selectedSq = null;
            solvedCurrent = true;

            stats.solved = (stats.solved || 0) + 1;
            stats.streak = (stats.streak || 0) + 1;
            stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
            writeStorage(STORAGE_KEYS.puzzleStats, stats);

            renderPuzzleBoard();
            updatePuzzleStatCards();
            setText("#puzzleFeedbackBox", `✓ Brilliant! ${legal.san} is the winning solution! Click 'Next Puzzle →' to continue.`);
            showToast("Puzzle Solved! +8 Rating XP");
          } else {
            stats.streak = 0;
            writeStorage(STORAGE_KEYS.puzzleStats, stats);
            selectedSq = null;
            renderPuzzleBoard();
            updatePuzzleStatCards();
            setText("#puzzleFeedbackBox", `✕ Not quite (${legal.san}). Look closely for a stronger forcing move or click 'Hint'!`);
            showToast("Not the best move — try again!", "warning");
          }
          return;
        }
      }

      if (piece && piece.color === puzzleGame.turn()) {
        selectedSq = sqName;
      } else {
        selectedSq = null;
      }
      renderPuzzleBoard();
    }

    $("#puzzleHintBtn", workspace)?.addEventListener("click", () => {
      const puz = PUZZLE_LIBRARY[currentPuzzleIdx];
      setText("#puzzleFeedbackBox", `💡 HINT: ${puz.hint}`);
    });

    $("#puzzleSolutionBtn", workspace)?.addEventListener("click", () => {
      const puz = PUZZLE_LIBRARY[currentPuzzleIdx];
      if (!solvedCurrent && puzzleGame) {
        puzzleGame.move({ from: puz.solutionFrom, to: puz.solutionTo, promotion: "q" });
        solvedCurrent = true;
        selectedSq = null;
        renderPuzzleBoard();
      }
      setText("#puzzleFeedbackBox", `Solution: Move ${puz.solutionFrom} → ${puz.solutionTo}. ${puz.hint}`);
    });

    $("#puzzleNextBtn", workspace)?.addEventListener("click", () => {
      loadPuzzle(currentPuzzleIdx + 1);
    });

    $("#startDailyPuzzle")?.addEventListener("click", () => {
      loadPuzzle(0);
      workspace.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    $$("[data-puzzle-category]").forEach(button => {
      button.addEventListener("click", () => {
        const cat = button.dataset.puzzleCategory;
        const foundIdx = PUZZLE_LIBRARY.findIndex(p => p.category === cat);
        loadPuzzle(foundIdx >= 0 ? foundIdx : 0);
        workspace.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    $$("[data-difficulty]").forEach(button => {
      button.addEventListener("click", () => {
        $$("[data-difficulty]").forEach(item => item.classList.toggle("active", item === button));
        const diff = button.dataset.difficulty;
        const foundIdx = PUZZLE_LIBRARY.findIndex(p => p.difficulty === diff);
        loadPuzzle(foundIdx >= 0 ? foundIdx : 0);
        workspace.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    updatePuzzleStatCards();
    loadPuzzle(0);
  }

  /* ----------------------------------------------------------
     11. PAGE 9: GAME ANALYSIS
     ---------------------------------------------------------- */

  let analysisGame = null;
  let analysisMoves = [];
  let analysisPosition = 0;

  function loadAnalysisPGN(pgn) {
    if (!pgn || !pgn.trim()) {
      showToast("Paste a valid PGN before loading.", "warning");
      return;
    }

    if (typeof window.Chess !== "function") return;
    const newGame = new window.Chess();
    let loaded = false;

    try {
      loaded = newGame.load_pgn(pgn.trim());
    } catch (error) {
      console.warn("PGN import error:", error);
    }

    if (!loaded) {
      showToast("Unable to read this PGN. Check its notation.", "error");
      return;
    }

    analysisGame = newGame;
    analysisMoves = analysisGame.history({ verbose: true });
    analysisPosition = analysisMoves.length;

    renderAnalysisData();
    showToast("PGN loaded and evaluated!");
  }

  function renderAnalysisData() {
    if (!analysisGame) return;

    const moveCount = analysisMoves.length;
    const headers = analysisGame.pgn();

    const replay = new window.Chess();
    let great = 0, good = 0, inaccur = 0, mistake = 0, blunder = 0;

    analysisMoves.forEach(mv => {
      const before = evaluateBoard(replay);
      replay.move(mv);
      const after = evaluateBoard(replay);
      const diff = mv.color === "w" ? after - before : before - after;

      if (diff >= 120) great++;
      else if (diff >= -40) good++;
      else if (diff >= -110) inaccur++;
      else if (diff >= -240) mistake++;
      else blunder++;
    });

    const acc = moveCount
      ? Math.max(45, Math.min(98, Math.round(((great + good * 0.9) / moveCount) * 100)))
      : 0;

    setText("#analysisAccuracy", `${acc}%`);
    setText("#analysisTotalMoves", moveCount);
    setText("#analysisBestMoves", String(great + good));

    const resultMatch = headers.match(/\[Result\s+"([^"]+)"\]/);
    setText("#analysisResult", resultMatch?.[1] || "Completed");

    setText("#brilliantMoves", "0");
    setText("#greatMoves", String(great));
    setText("#goodMoves", String(good));
    setText("#inaccuracyMoves", String(inaccur));
    setText("#mistakeMoves", String(mistake));
    setText("#blunderMoves", String(blunder));

    renderAnalysisMoveTable();
    renderAnalysisPosition();

    const insights = $("#analysisInsights");
    if (insights) {
      insights.innerHTML = `
        <div class="analysis-insight">
          <h4>Game Review Complete (${moveCount} half-moves)</h4>
          <p>Estimated Accuracy: <strong>${acc}%</strong>. Solid Moves: ${great + good}, Mistakes/Blunders: ${mistake + blunder}.</p>
        </div>
        <div class="analysis-insight">
          <h4>Key Coaching Takeaway</h4>
          <p>${blunder > 0 ? `Watch out for undefended pieces—${blunder} major material drop(s) detected.` : "Clean tactical discipline! You kept your pieces well-protected."}</p>
        </div>
      `;
    }
  }

  function renderAnalysisMoveTable() {
    const tbody = $("#analysisMoveTable");
    if (!tbody) return;

    tbody.innerHTML = "";
    const replay = new window.Chess();

    for (let i = 0; i < analysisMoves.length; i += 2) {
      replay.move(analysisMoves[i]);
      if (analysisMoves[i + 1]) replay.move(analysisMoves[i + 1]);
      const ev = (evaluateBoard(replay) / 100).toFixed(1);

      const row = document.createElement("tr");
      row.append(
        createElement("td", "", String(Math.floor(i / 2) + 1)),
        createElement("td", "", analysisMoves[i].san),
        createElement("td", "", analysisMoves[i + 1]?.san || ""),
        createElement("td", "", Math.abs(Number(ev)) < 1.5 ? "Solid" : "Tactical Shift"),
        createElement("td", "", Number(ev) > 0 ? `+${ev}` : String(ev))
      );
      tbody.appendChild(row);
    }
  }

  function renderAnalysisPosition() {
    if (!analysisGame) return;
    const container = $("#analysisBoard");
    if (!container) return;

    const replay = new window.Chess();
    const total = Math.max(0, Math.min(analysisPosition, analysisMoves.length));

    for (let i = 0; i < total; i++) {
      const move = analysisMoves[i];
      replay.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    }

    const boardData = replay.board();
    container.innerHTML = "";

    const grid = createElement("div", "chessboard");
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = createElement("div", `square ${(row + col) % 2 === 0 ? "light" : "dark"}`);
        const piece = boardData[row][col];

        if (piece) {
          const colorClass = piece.color === "w" ? "white-piece" : "black-piece";
          square.appendChild(createElement("span", `piece ${colorClass}`, PIECES[piece.color + piece.type]));
        }

        grid.appendChild(square);
      }
    }

    container.appendChild(grid);
  }

  function initGameAnalysis() {
    const fileInput = $("#pgnFileInput");
    const pgnInput = $("#pgnInput");

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      setText("#pgnFileName", file.name);
      const content = await file.text();
      if (pgnInput) pgnInput.value = content;
      loadAnalysisPGN(content);
    });

    $("#loadPgnButton")?.addEventListener("click", () => {
      loadAnalysisPGN(pgnInput?.value || "");
    });

    $("#startAnalysisButton")?.addEventListener("click", () => {
      if (APP.game && APP.game.history().length > 0 && pgnInput) {
        pgnInput.value = APP.game.pgn();
        loadAnalysisPGN(APP.game.pgn());
        return;
      }
      pgnInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      pgnInput?.focus();
    });

    $("#analysisPreviousMove")?.addEventListener("click", () => {
      if (!analysisGame) return showToast("Import a PGN game first.", "warning");
      analysisPosition = Math.max(0, analysisPosition - 1);
      renderAnalysisPosition();
    });

    $("#analysisNextMove")?.addEventListener("click", () => {
      if (!analysisGame) return showToast("Import a PGN game first.", "warning");
      analysisPosition = Math.min(analysisMoves.length, analysisPosition + 1);
      renderAnalysisPosition();
    });

    $("#exportAnalysisButton")?.addEventListener("click", () => {
      if (!analysisGame) return showToast("Import a PGN before exporting.", "warning");
      const report = [
        "ARIONZ CHESS AI — GAME REPORT",
        `Generated: ${new Date().toISOString()}`,
        `Half-moves: ${analysisMoves.length}`,
        "",
        analysisGame.pgn()
      ].join("\n");
      downloadText(report, `arionz-analysis-${Date.now()}.txt`, "text/plain");
    });
  }

  function downloadText(content, filename, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /* ----------------------------------------------------------
     12. GAME HISTORY, PROGRESS, ACHIEVEMENTS & PROFILE
     ---------------------------------------------------------- */

  function getGames() {
    const games = readStorage(STORAGE_KEYS.games, []);
    return Array.isArray(games) ? games : [];
  }

  function updateGameHistoryStats() {
    const games = getGames();
    const wins = games.filter(game => game.winner === "White").length;
    const losses = games.filter(game => game.winner === "Black").length;
    const draws = games.filter(game => game.winner === "Draw").length;
    const total = games.length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;

    setText("#historyTotalGames", total);
    setText("#historyWins", wins);
    setText("#historyLosses", losses);
    setText("#historyDraws", draws);
    setText("#historyWinRate", `${winRate}%`);

    const bar = $("#historyWinRateBar");
    if (bar) bar.style.width = `${winRate}%`;

    const average = total
      ? Math.round(games.reduce((sum, game) => sum + (game.moves || 0), 0) / total)
      : 0;
    setText("#historyAverageMoves", total ? average : "--");
  }

  function renderGameHistory() {
    const games = getGames();
    const tbody = $("#gameHistoryTable");
    updateGameHistoryStats();

    if (!tbody) return;
    tbody.innerHTML = "";

    const query = ($("#historySearch")?.value || "").toLowerCase();
    const resultFilter = $("#historyResultFilter")?.value || "all";

    const filtered = games.filter(game => {
      const textMatch = `${game.id} ${game.result} ${game.winner}`.toLowerCase().includes(query);
      const resultMatch =
        resultFilter === "all" ||
        (resultFilter === "win" && game.winner === "White") ||
        (resultFilter === "loss" && game.winner === "Black") ||
        (resultFilter === "draw" && game.winner === "Draw");
      return textMatch && resultMatch;
    });

    if (!filtered.length) {
      const row = createElement("tr");
      const cell = createElement("td", "empty-table-message", "No recorded games match your filter.");
      cell.colSpan = 7;
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    filtered.forEach(game => {
      const row = document.createElement("tr");
      [
        formatDate(game.date),
        "ArionZ Match",
        game.playerColor || "White",
        game.timeControl || "Unlimited",
        game.moves || 0,
        game.result || "Completed"
      ].forEach(val => row.appendChild(createElement("td", "", String(val))));

      const actionCell = createElement("td");
      const viewButton = createElement("button", "secondary-button", "Analyze");
      viewButton.type = "button";
      viewButton.addEventListener("click", () => {
        if (game.pgn) {
          if ($("#pgnInput")) $("#pgnInput").value = game.pgn;
          loadAnalysisPGN(game.pgn);
          navigateTo("analysis");
        }
      });
      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });
  }

  function initHistoryControls() {
    ["#historySearch", "#historyResultFilter", "#historyColorFilter", "#historyTimeFilter"].forEach(sel => {
      $(sel)?.addEventListener("input", renderGameHistory);
      $(sel)?.addEventListener("change", renderGameHistory);
    });

    $("#exportGameHistory")?.addEventListener("click", () => {
      const games = getGames();
      if (!games.length) return showToast("No saved games to export.", "warning");
      downloadText(JSON.stringify(games, null, 2), `arionz-history-${Date.now()}.json`, "application/json");
    });

    $("#clearGameHistory")?.addEventListener("click", () => {
      if (!window.confirm("Clear all locally saved game history?")) return;
      writeStorage(STORAGE_KEYS.games, []);
      renderGameHistory();
      updateDashboardStats();
      showToast("Game history cleared.");
    });
  }

  function updateProgressOverview() {
    const games = getGames();
    const wins = games.filter(game => game.winner === "White").length;
    const winRate = games.length ? Math.round((wins / games.length) * 100) : 0;
    const rating = calculatePlayerRating();

    setText("#progressTotalGames", games.length);
    setText("#progressTotalWins", wins);
    setText("#progressWinRate", `${winRate}%`);
    setText("#currentChessRating", String(rating));
    setText("#peakChessRating", String(Math.max(1000, rating)));

    renderGoals(readStorage(STORAGE_KEYS.goals, []));
  }

  function renderGoals(goals) {
    const container = $("#chessGoalsList");
    if (!container) return;

    container.innerHTML = "";
    if (!goals.length) {
      container.innerHTML = `
        <div class="goals-empty-state">
          <div class="placeholder-icon">🎯</div>
          <h3>No Goals Added Yet</h3>
          <p>Add your first chess goal and start tracking your progress.</p>
        </div>
      `;
      return;
    }

    goals.forEach((goal, index) => {
      const row = createElement("div", "goal-item");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(goal.completed);

      const title = createElement("strong", "", goal.title);
      if (goal.completed) title.style.textDecoration = "line-through";

      const remove = createElement("button", "secondary-button", "Remove");
      remove.type = "button";

      checkbox.addEventListener("change", () => {
        goals[index].completed = checkbox.checked;
        writeStorage(STORAGE_KEYS.goals, goals);
        renderGoals(goals);
      });

      remove.addEventListener("click", () => {
        goals.splice(index, 1);
        writeStorage(STORAGE_KEYS.goals, goals);
        renderGoals(goals);
      });

      row.append(checkbox, title, remove);
      container.appendChild(row);
    });
  }

  function initProgressControls() {
    $("#addChessGoal")?.addEventListener("click", () => {
      const title = window.prompt("Enter your new chess goal:");
      if (!title || !title.trim()) return;
      const goals = readStorage(STORAGE_KEYS.goals, []);
      goals.push({ id: `goal-${Date.now()}`, title: title.trim().slice(0, 100), completed: false });
      writeStorage(STORAGE_KEYS.goals, goals);
      renderGoals(goals);
      showToast("Goal added.");
    });
  }

  function updateAchievements() {
    const games = getGames();
    const wins = games.filter(game => game.winner === "White").length;
    const puzzleStats = readStorage(STORAGE_KEYS.puzzleStats, { solved: 0 });
    const lessons = readStorage(STORAGE_KEYS.lessons, []);
    const quizBest = readStorage(STORAGE_KEYS.quizBest, 0);

    const unlocked = {
      "first-game": games.length >= 1,
      "first-win": wins >= 1,
      "ten-games": games.length >= 10,
      "fifty-games": games.length >= 50,
      "first-puzzle": (puzzleStats.solved || 0) >= 1,
      "ten-puzzles": (puzzleStats.solved || 0) >= 10,
      "fifty-puzzles": (puzzleStats.solved || 0) >= 50,
      "first-lesson": lessons.length >= 1,
      "rules-master": quizBest >= 8
    };

    const cards = $$(".achievement-card");
    let unlockedCount = 0;
    let points = 0;

    cards.forEach(card => {
      const id = card.dataset.achievementId;
      const isUnlocked = Boolean(unlocked[id]);
      card.classList.toggle("unlocked", isUnlocked);
      card.classList.toggle("locked", !isUnlocked);

      const status = $(".achievement-status", card);
      if (status) status.textContent = isUnlocked ? "Unlocked" : "Locked";

      if (isUnlocked) {
        unlockedCount++;
        const pointText = $(".achievement-card-footer span", card)?.textContent || "";
        points += Number(pointText.match(/\d+/)?.[0] || 0);
      }
    });

    const total = cards.length || 20;
    const percent = Math.round((unlockedCount / total) * 100);

    setText("#unlockedAchievements", unlockedCount);
    setText("#totalAchievements", total);
    setText("#achievementPoints", points);
    setText("#achievementCompletion", `${percent}%`);
    setText("#achievementProgressText", `${unlockedCount} / ${total}`);

    const progressBar = $("#achievementProgressBar");
    if (progressBar) progressBar.style.width = `${percent}%`;
  }

  function initAchievementFilters() {
    $$("[data-achievement-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const filter = button.dataset.achievementFilter;
        $$(".achievement-filter").forEach(item => item.classList.toggle("active", item === button));
        $$(".achievement-card").forEach(card => {
          card.style.display = filter === "all" || card.dataset.category === filter ? "" : "none";
        });
      });
    });
  }

  function initCommunityPlaceholders() {
    $("#friendSearchForm")?.addEventListener("submit", event => {
      event.preventDefault();
      showToast("Player search will connect with the Flask backend in Stage 3.", "warning");
    });

    $("#friendChallengeForm")?.addEventListener("submit", event => {
      event.preventDefault();
      showToast("Online match challenges require multiplayer backend services.", "warning");
    });

    $$("[data-leaderboard-filter], [data-tournament-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const group = button.hasAttribute("data-leaderboard-filter")
          ? ".leaderboard-filter"
          : ".tournament-filter";
        $$(group).forEach(item => item.classList.toggle("active", item === button));
      });
    });
  }

  function loadProfile() {
    const profile = readStorage(STORAGE_KEYS.profile, {});
    const games = getGames();
    const rating = calculatePlayerRating();

    setText("#profileDisplayName", profile.name || "Chess Player");
    setText("#profileUsername", profile.username ? `@${profile.username}` : "@username");
    setText("#profileGamesPlayed", games.length);
    setText("#profileRating", String(rating));
    setText("#profileMemberSince", profile.memberSince ? formatDate(profile.memberSince) : formatDate(new Date()));

    if ($("#profileNameInput")) $("#profileNameInput").value = profile.name || "";
    if ($("#profileUsernameInput")) $("#profileUsernameInput").value = profile.username || "";
    if ($("#profileBioInput")) $("#profileBioInput").value = profile.bio || "";
    if ($("#profileCountryInput")) $("#profileCountryInput").value = profile.country || "";

    const settings = readStorage(STORAGE_KEYS.settings, {});
    $$(".profile-settings-card input, .profile-settings-card select").forEach(element => {
      if (!element.id || !(element.id in settings)) return;
      if (element.type === "checkbox") {
        element.checked = Boolean(settings[element.id]);
      } else {
        element.value = settings[element.id];
      }
    });

    const boardWrapper = $(".board-wrapper");
    if (boardWrapper && "boardCoordinatesSetting" in settings) {
      boardWrapper.classList.toggle("hide-coordinates", !settings.boardCoordinatesSetting);
    }
  }

  function initProfileControls() {
    $("#editProfileForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const previous = readStorage(STORAGE_KEYS.profile, {});
      const profile = {
        name: $("#profileNameInput")?.value.trim() || "Chess Player",
        username: $("#profileUsernameInput")?.value.trim() || "player",
        bio: $("#profileBioInput")?.value.trim() || "",
        country: $("#profileCountryInput")?.value || "",
        memberSince: previous.memberSince || new Date().toISOString()
      };
      writeStorage(STORAGE_KEYS.profile, profile);
      loadProfile();
      showToast("Profile saved locally.");
    });

    $("#saveAllSettingsButton")?.addEventListener("click", () => {
      const settings = {};
      $$(".profile-settings-card input, .profile-settings-card select").forEach(el => {
        if (!el.id) return;
        settings[el.id] = el.type === "checkbox" ? el.checked : el.value;
      });
      writeStorage(STORAGE_KEYS.settings, settings);
      loadProfile();
      showToast("Settings saved locally.");
    });

    $("#resetPreferencesButton")?.addEventListener("click", () => {
      if (!window.confirm("Restore default settings?")) return;
      localStorage.removeItem(STORAGE_KEYS.settings);
      loadProfile();
      showToast("Settings reset to defaults.");
    });

    $("#exportMyDataButton")?.addEventListener("click", () => {
      const data = {
        exportedAt: new Date().toISOString(),
        profile: readStorage(STORAGE_KEYS.profile, {}),
        settings: readStorage(STORAGE_KEYS.settings, {}),
        games: getGames(),
        goals: readStorage(STORAGE_KEYS.goals, []),
        repertoire: readStorage(STORAGE_KEYS.repertoire, {})
      };
      downloadText(JSON.stringify(data, null, 2), `arionz-data-${Date.now()}.json`, "application/json");
    });
  }

  function recordActivity() {
    const activity = readStorage(STORAGE_KEYS.activity, []);
    const today = new Date().toISOString().slice(0, 10);
    if (!activity.includes(today)) {
      activity.push(today);
      writeStorage(STORAGE_KEYS.activity, activity.slice(-365));
    }
  }

  /* ----------------------------------------------------------
     13. INITIALIZE APPLICATION
     ---------------------------------------------------------- */

  function initApplication() {
    if (window.__ARIONZ_CHESS_INITIALIZED__) return;
    window.__ARIONZ_CHESS_INITIALIZED__ = true;

    initNavigation();
    initThemeControls();
    initSettingsDialog();

    initChessEngine();
    initBoardEvents();
    initChessButtons();
    initCoach();
    initGameModes();

    initLearnChessPage();
    initRuleSearchAndQuiz();
    initOpeningExplorer();
    initPuzzleTraining();
    initGameAnalysis();
    initHistoryControls();
    initProgressControls();
    initAchievementFilters();
    initCommunityPlaceholders();
    initProfileControls();

    updateDashboardStats();
    updateLearningStats();
    updateGameHistoryStats();
    updateProgressOverview();
    updateAchievements();
    loadProfile();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApplication, { once: true });
  } else {
    initApplication();
  }
})();
