#!/usr/bin/env python3
"""
ARIONZ CHESS AI — COMPLETE AI & STOCKFISH BACKEND SERVER
Serves Frontend + Stockfish Engine Evaluation + 3-Mode AI Coach + Hugging Face Bridge
"""

import os
import shutil
import math
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import chess
import chess.pgn
import chess.engine
import io

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ---------------------------------------------------------
# 1. LOCATE STOCKFISH BINARY OR FALLBACK ENGINE
# ---------------------------------------------------------

def find_stockfish_path():
    env_path = os.environ.get("STOCKFISH_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    which_path = shutil.which("stockfish")
    if which_path:
        return which_path

    common_paths = [
        "/usr/games/stockfish",
        "/usr/bin/stockfish",
        "/usr/local/bin/stockfish",
        "/snap/bin/stockfish"
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    return None


STOCKFISH_PATH = find_stockfish_path()
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "")
HF_MODEL_ID = os.environ.get("HF_CHESS_MODEL", "Qwen/Qwen2.5-7B-Instruct")

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000
}

PIECE_NAMES = {
    chess.PAWN: "Pawn",
    chess.KNIGHT: "Knight",
    chess.BISHOP: "Bishop",
    chess.ROOK: "Rook",
    chess.QUEEN: "Queen",
    chess.KING: "King"
}

CENTER_SQUARES = [chess.D4, chess.E4, chess.D5, chess.E5]


# ---------------------------------------------------------
# 2. ENGINE EVALUATION & BEST MOVE (STOCKFISH + FALLBACK)
# ---------------------------------------------------------

def static_evaluate_board(board: chess.Board) -> int:
    """ Returns evaluation in centipawns from White's perspective. """
    if board.is_checkmate():
        return -9999 if board.turn == chess.WHITE else 9999
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_draw():
        return 0

    score = 0
    for sq, piece in board.piece_map().items():
        val = PIECE_VALUES.get(piece.piece_type, 0)
        if sq in CENTER_SQUARES:
            val += 25
        if piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            rank = chess.square_rank(sq)
            if (piece.color == chess.WHITE and rank > 0) or (piece.color == chess.BLACK and rank < 7):
                val += 15
        score += val if piece.color == chess.WHITE else -val
    return score


def analyze_position_with_engine(fen: str, depth: int = 12, skill_level: int = 10):
    """
    Uses Stockfish if available; otherwise uses a fast minimax tactical evaluator.
    Returns dict with best_move_uci, best_move_san, eval_cp (White POV), mate, top_line.
    """
    board = chess.Board(fen)
    if board.is_game_over():
        return {
            "engine": "stockfish" if STOCKFISH_PATH else "arionz-tactical-ai",
            "best_move_uci": None,
            "best_move_san": None,
            "eval_cp": static_evaluate_board(board),
            "eval_pawns": round(static_evaluate_board(board) / 100.0, 2),
            "mate": 0 if board.is_checkmate() else None,
            "top_line": []
        }

    if STOCKFISH_PATH:
        try:
            with chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH) as engine:
                try:
                    engine.configure({"Skill Level": max(0, min(20, skill_level))})
                except Exception:
                    pass

                limit = chess.engine.Limit(depth=depth, time=0.35)
                info = engine.analyse(board, limit)
                score_obj = info["score"].white()

                mate = score_obj.mate()
                if mate is not None:
                    eval_cp = 9000 if mate > 0 else -9000
                else:
                    eval_cp = score_obj.score(mate_score=9000) or 0

                pv = info.get("pv", [])
                best_move = pv[0] if pv else None

                if not best_move:
                    res = engine.play(board, limit)
                    best_move = res.move

                best_san = board.san(best_move) if best_move else None

                top_line_san = []
                temp_board = board.copy()
                for mv in pv[:4]:
                    if mv in temp_board.legal_moves:
                        top_line_san.append(temp_board.san(mv))
                        temp_board.push(mv)

                return {
                    "engine": "Stockfish Engine",
                    "best_move_uci": best_move.uci() if best_move else None,
                    "best_move_san": best_san,
                    "from": chess.square_name(best_move.from_square) if best_move else None,
                    "to": chess.square_name(best_move.to_square) if best_move else None,
                    "eval_cp": eval_cp,
                    "eval_pawns": round(eval_cp / 100.0, 2),
                    "mate": mate,
                    "top_line": top_line_san
                }
        except Exception as e:
            print("Stockfish fallback triggered:", e)

    # Built-in 2-ply Alpha-Beta Tactical AI Fallback
    legal_moves = list(board.legal_moves)
    is_white = board.turn == chess.WHITE
    best_move = legal_moves[0]
    best_score = -999999 if is_white else 999999

    for move in legal_moves:
        board.push(move)
        if board.is_checkmate():
            score = 99999 if is_white else -99999
        else:
            replies = list(board.legal_moves)
            if replies and skill_level >= 5:
                if is_white:
                    score = min(static_evaluate_board_after(board, r) for r in replies[:14])
                else:
                    score = max(static_evaluate_board_after(board, r) for r in replies[:14])
            else:
                score = static_evaluate_board(board)
        board.pop()

        if is_white and score > best_score:
            best_score = score
            best_move = move
        elif not is_white and score < best_score:
            best_score = score
            best_move = move

    best_san = board.san(best_move)
    return {
        "engine": "ArionZ Tactical Engine",
        "best_move_uci": best_move.uci(),
        "best_move_san": best_san,
        "from": chess.square_name(best_move.from_square),
        "to": chess.square_name(best_move.to_square),
        "eval_cp": best_score,
        "eval_pawns": round(best_score / 100.0, 2),
        "mate": None,
        "top_line": [best_san]
    }


def static_evaluate_board_after(board: chess.Board, move: chess.Move) -> int:
    board.push(move)
    val = static_evaluate_board(board)
    board.pop()
    return val


# ---------------------------------------------------------
# 3. TACTICAL & POSITIONAL FEATURE EXTRACTOR FOR AI COACH
# ---------------------------------------------------------

def detect_board_insights(board: chess.Board):
    """ Finds hanging pieces, checks, center control, and development state. """
    turn_color = board.turn
    opponent_color = not turn_color

    hanging_own = []
    hanging_enemy = []

    for sq, piece in board.piece_map().items():
        if piece.piece_type == chess.KING:
            continue
        attackers = board.attackers( not piece.color, sq)
        defenders = board.attackers(piece.color, sq)
        if attackers and not defenders:
            label = f"{PIECE_NAMES[piece.piece_type]} on {chess.square_name(sq)}"
            if piece.color == turn_color:
                hanging_own.append(label)
            else:
                hanging_enemy.append(label)

    center_white = sum(1 for sq in CENTER_SQUARES if board.piece_at(sq) and board.piece_at(sq).color == chess.WHITE)
    center_black = sum(1 for sq in CENTER_SQUARES if board.piece_at(sq) and board.piece_at(sq).color == chess.BLACK)

    return {
        "in_check": board.is_check(),
        "hanging_own": hanging_own,
        "hanging_enemy": hanging_enemy,
        "center_white": center_white,
        "center_black": center_black,
        "fullmove_number": board.fullmove_number
    }


def query_huggingface_coach(prompt: str):
    """ Optional Hugging Face Inference API call if HF_API_TOKEN is set. """
    if not HF_API_TOKEN:
        return None
    try:
        headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
        payload = {
            "inputs": f"<|system|>You are ArionZ Chess AI Coach. Give concise, practical chess advice in 2-3 sentences.<|user|>{prompt}<|assistant|>",
            "parameters": {"max_new_tokens": 140, "temperature": 0.4, "return_full_text": False}
        }
        resp = requests.post(
            f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}",
            headers=headers,
            json=payload,
            timeout=4
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data and "generated_text" in data[0]:
                return data[0]["generated_text"].strip()
    except Exception:
        pass
    return None


# ---------------------------------------------------------
# 4. REST API ENDPOINTS
# ---------------------------------------------------------

@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")


@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "status": "online",
        "stockfish_available": bool(STOCKFISH_PATH),
        "stockfish_path": STOCKFISH_PATH or "Built-in ArionZ Tactical Engine",
        "huggingface_connected": bool(HF_API_TOKEN)
    })


@app.route("/api/ai/move", methods=["POST"])
def api_ai_move():
    """ Calculates the AI Bot's next move + evaluates the user's last move for Mode 2 Live Coach. """
    data = request.get_json(force=True) or {}
    fen = data.get("fen", chess.STARTING_FEN)
    fen_before_user = data.get("fenBeforeUser")
    user_move_san = data.get("userMoveSan")
    level = data.get("level", "bot-beginner")
    mode = data.get("mode", "play")

    skill_map = {
        "bot-beginner": (4, 2),
        "bot-intermediate": (8, 8),
        "bot-advanced": (13, 18)
    }
    depth, skill = skill_map.get(level, (8, 8))

    # 1. Evaluate User's Move Quality if fen_before_user is provided
    user_feedback = None
    move_classification = "Good"
    cp_loss = 0

    if fen_before_user and user_move_san:
        before_analysis = analyze_position_with_engine(fen_before_user, depth=8, skill_level=15)
        after_analysis = analyze_position_with_engine(fen, depth=8, skill_level=15)

        board_before = chess.Board(fen_before_user)
        user_was_white = board_before.turn == chess.WHITE

        cp_before = before_analysis["eval_cp"]
        cp_after = after_analysis["eval_cp"]

        cp_loss = (cp_before - cp_after) if user_was_white else (cp_after - cp_before)
        best_alt = before_analysis.get("best_move_san")

        if cp_loss >= 220:
            move_classification = "Blunder ??"
        elif cp_loss >= 110:
            move_classification = "Mistake ?"
        elif cp_loss >= 55:
            move_classification = "Inaccuracy ?!"
        elif cp_loss <= -40:
            move_classification = "Great Move !"
        else:
            move_classification = "Solid Move ✓"

        if mode == "live":
            board_now = chess.Board(fen)
            insights = detect_board_insights(board_now)
            parts = [f"[{move_classification}] You played {user_move_san} (Eval: {after_analysis['eval_pawns']:+.2f})."]

            if cp_loss >= 110 and best_alt and best_alt != user_move_san:
                parts.append(f"⚠ Stronger was {best_alt}. {user_move_san} lost ~{round(cp_loss/100, 1)} pawns of value.")
            elif best_alt == user_move_san:
                parts.append(f"★ Spot on! {user_move_san} was the top engine choice!")

            if insights["hanging_enemy"]:
                parts.append(f"Alert: Your {insights['hanging_enemy'][0]} is currently undefended!")

            user_feedback = " ".join(parts)

    # 2. Calculate AI Bot Move (if game not over and opponent is bot)
    board = chess.Board(fen)
    bot_result = None
    if not board.is_game_over() and level.startswith("bot-"):
        bot_result = analyze_position_with_engine(fen, depth=depth, skill_level=skill)

    return jsonify({
        "botMove": bot_result,
        "userMoveClass": move_classification,
        "cpLoss": cp_loss,
        "liveCoachFeedback": user_feedback
    })


@app.route("/api/ai/coach", methods=["POST"])
def api_ai_coach():
    """ Answers user questions in the AI Coach chat using real board analysis + optional HF LLM. """
    data = request.get_json(force=True) or {}
    fen = data.get("fen", chess.STARTING_FEN)
    question = data.get("question", "Explain the position")
    mode = data.get("mode", "play")

    board = chess.Board(fen)
    analysis = analyze_position_with_engine(fen, depth=10, skill_level=16)
    insights = detect_board_insights(board)

    turn_str = "White" if board.turn == chess.WHITE else "Black"
    eval_str = f"{analysis['eval_pawns']:+.2f}"
    best_san = analysis.get("best_move_san") or "None"
    line_str = " → ".join(analysis.get("top_line", []))

    # Try Hugging Face LLM first if token is configured
    hf_prompt = (
        f"Chess FEN: {fen}. Turn: {turn_str}. Engine Eval: {eval_str}. "
        f"Best Move: {best_san} (Line: {line_str}). "
        f"Undefended own pieces: {insights['hanging_own']}. "
        f"Undefended enemy targets: {insights['hanging_enemy']}. "
        f"User Question: {question}"
    )
    hf_reply = query_huggingface_coach(hf_prompt)
    if hf_reply:
        return jsonify({"reply": hf_reply, "analysis": analysis})

    q_lower = question.lower()
    reply_lines = []

    if "next move" in q_lower or "hint" in q_lower or "best" in q_lower:
        reply_lines.append(f"🎯 Best Engine Recommendation for {turn_str}: Play **{best_san}** (Eval: {eval_str}).")
        if line_str:
            reply_lines.append(f"Expected continuation: {line_str}.")
        if insights["hanging_own"]:
            reply_lines.append(f"⚠ Protect your {insights['hanging_own'][0]} first!")
        elif insights["hanging_enemy"]:
            reply_lines.append(f"💡 Tactical target: Opponent's {insights['hanging_enemy'][0]} is undefended!")
    elif "position" in q_lower or "explain" in q_lower:
        advantage = (
            "White has a clear advantage" if analysis["eval_cp"] > 80 else
            "Black has a clear advantage" if analysis["eval_cp"] < -80 else
            "The position is balanced"
        )
        reply_lines.append(f"📌 Position Evaluation ({eval_str}): {advantage} on Move {board.fullmove_number} ({turn_str} to move).")
        if insights["in_check"]:
            reply_lines.append(f"❗ {turn_str}'s King is currently in CHECK—you must respond immediately.")
        if insights["hanging_own"]:
            reply_lines.append(f"⚠ Danger: Your {', '.join(insights['hanging_own'])} is undefended.")
        if best_san != "None":
            reply_lines.append(f"Top candidate move: {best_san} ({line_str}).")
    else:
        reply_lines.append(f"🤖 ArionZ Engine ({analysis['engine']}): Eval is {eval_str} with {turn_str} to move.")
        reply_lines.append(f"Strongest move right now is {best_san} (Line: {line_str}).")
        if insights["hanging_enemy"]:
            reply_lines.append(f"Look at attacking the undefended {insights['hanging_enemy'][0]}!")

    return jsonify({
        "reply": "\n".join(reply_lines),
        "analysis": analysis
    })


@app.route("/api/ai/analyze-game", methods=["POST"])
def api_analyze_game():
    """
    Full Game Analysis for Page 9 (Game Analysis) AND Mode 1 Post-Game Mistake Summary.
    Evaluates every move in the PGN and returns accuracy, blunders, mistakes, and best alternatives.
    """
    data = request.get_json(force=True) or {}
    pgn_text = data.get("pgn", "").strip()

    if not pgn_text:
        return jsonify({"error": "Empty PGN provided."}), 400

    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if not game:
        return jsonify({"error": "Invalid PGN format."}), 400

    board = game.board()
    move_reviews = []
    counts = {
        "brilliant": 0,
        "great": 0,
        "good": 0,
        "inaccuracy": 0,
        "mistake": 0,
        "blunder": 0
    }

    prev_cp = static_evaluate_board(board)
    total_loss_white = 0
    white_moves_count = 0
    critical_mistakes = []

    for ply_idx, move in enumerate(game.mainline_moves()):
        is_white = board.turn == chess.WHITE
        move_num = board.fullmove_number
        san = board.san(move)

        # Find best move before pushing
        best_info = analyze_position_with_engine(board.fen(), depth=6, skill_level=15)
        best_san = best_info.get("best_move_san") or san
        cp_before = best_info.get("eval_cp", prev_cp)

        board.push(move)

        after_info = analyze_position_with_engine(board.fen(), depth=6, skill_level=15)
        cp_after = after_info.get("eval_cp", 0)

        cp_loss = (cp_before - cp_after) if is_white else (cp_after - cp_before)
        cp_loss = max(0, cp_loss)

        if is_white:
            total_loss_white += cp_loss
            white_moves_count += 1

        if san == best_san and cp_loss <= 15:
            quality = "Great"
            counts["great"] += 1
        elif cp_loss <= 45:
            quality = "Good"
            counts["good"] += 1
        elif cp_loss <= 105:
            quality = "Inaccuracy"
            counts["inaccuracy"] += 1
        elif cp_loss <= 220:
            quality = "Mistake"
            counts["mistake"] += 1
            critical_mistakes.append({
                "moveNumber": move_num,
                "color": "White" if is_white else "Black",
                "played": san,
                "best": best_san,
                "type": "Mistake",
                "loss": round(cp_loss / 100.0, 1)
            })
        else:
            quality = "Blunder"
            counts["blunder"] += 1
            critical_mistakes.append({
                "moveNumber": move_num,
                "color": "White" if is_white else "Black",
                "played": san,
                "best": best_san,
                "type": "Blunder",
                "loss": round(cp_loss / 100.0, 1)
            })

        move_reviews.append({
            "ply": ply_idx + 1,
            "moveNumber": move_num,
            "color": "White" if is_white else "Black",
            "san": san,
            "bestSan": best_san,
            "quality": quality,
            "evalPawns": round(cp_after / 100.0, 2)
        })
        prev_cp = cp_after

    avg_cpl = (total_loss_white / white_moves_count) if white_moves_count else 0
    accuracy = max(35, min(99, round(103.16 * math.exp(-0.004 * avg_cpl))))

    return jsonify({
        "engine": "Stockfish Engine" if STOCKFISH_PATH else "ArionZ Tactical Engine",
        "accuracy": accuracy,
        "totalHalfMoves": len(move_reviews),
        "counts": counts,
        "moves": move_reviews,
        "criticalMistakes": critical_mistakes[:6]
    })


if __name__ == "__main__":
    print("====================================================")
    print(" ARIONZ CHESS AI — BACKEND SERVER RUNNING")
    print(f" Engine: {STOCKFISH_PATH or 'Built-in ArionZ Tactical Engine'}")
    print(" Open in Browser: http://127.0.0.1:5000")
    print("====================================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
