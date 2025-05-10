// src/app/games/tic-tac-toe/tic-tac-toe.logic.ts

export const PLAYER_X = 'X'; // AI is X (Maximizing player)
export const PLAYER_O = 'O'; // Human is O (Minimizing player)
export const EMPTY = ''; // Use empty string for Angular template binding

export type Player = typeof PLAYER_X | typeof PLAYER_O | typeof EMPTY;
export type Board = Player[][];

export interface Move {
  row: number;
  col: number;
}

// Function to check if there are any moves left on the board
export function isMovesLeft(board: Board): boolean {
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      if (board[i][j] === EMPTY) {
        return true;
      }
    }
  }
  return false;
}

// Function to evaluate the board state
// Returns +10 if PLAYER_X wins, -10 if PLAYER_O wins, 0 otherwise
export function evaluate(board: Board): number {
  // Check rows for win
  for (let row = 0; row < 3; ++row) {
    if (board[row][0] === board[row][1] && board[row][1] === board[row][2]) {
      if (board[row][0] === PLAYER_X) return +10;
      else if (board[row][0] === PLAYER_O) return -10;
    }
  }

  // Check columns for win
  for (let col = 0; col < 3; ++col) {
    if (board[0][col] === board[1][col] && board[1][col] === board[2][col]) {
      if (board[0][col] === PLAYER_X) return +10;
      else if (board[0][col] === PLAYER_O) return -10;
    }
  }

  // Check diagonals for win
  if (board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    if (board[0][0] === PLAYER_X) return +10;
    else if (board[0][0] === PLAYER_O) return -10;
  }
  if (board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    if (board[0][2] === PLAYER_X) return +10;
    else if (board[0][2] === PLAYER_O) return -10;
  }

  // If no winner, return 0
  return 0;
}

// The Alpha-Beta pruning algorithm function
// alpha: Best value Maximizer can guarantee so far
// beta: Best value Minimizer can guarantee so far
export function minimax(board: Board, depth: number, isMaximizingPlayer: boolean, alpha: number, beta: number): number {
  const score = evaluate(board);

  // If Maximizer has won the game return his evaluated score
  if (score === 10) return score - depth; // Subtract depth to prefer faster wins

  // If Minimizer has won the game return his evaluated score
  if (score === -10) return score + depth; // Add depth to prefer faster losses (or force AI to win faster)

  // If there are no more moves and no winner then it's a tie
  if (!isMovesLeft(board)) return 0;

  // If this maximizer's move
  if (isMaximizingPlayer) {
    let best = Number.MIN_SAFE_INTEGER;

    // Traverse all cells
    for (let i = 0; i < 3; ++i) {
      for (let j = 0; j < 3; ++j) {
        // Check if cell is empty
        if (board[i][j] === EMPTY) {
          // Make the move
          board[i][j] = PLAYER_X;

          // Call minimax recursively and choose the maximum value
          best = Math.max(best, minimax(board, depth + 1, !isMaximizingPlayer, alpha, beta));

          // Undo the move
          board[i][j] = EMPTY;

          // Alpha Beta Pruning
          alpha = Math.max(alpha, best);
          if (beta <= alpha) {
            break; // Prune the remaining branches
          }
        }
      }
      if (beta <= alpha) {
        break; // Prune from outer loop
      }
    }
    return best;
  }
  // If this minimizer's move
  else {
    let best = Number.MAX_SAFE_INTEGER;

    // Traverse all cells
    for (let i = 0; i < 3; ++i) {
      for (let j = 0; j < 3; ++j) {
        // Check if cell is empty
        if (board[i][j] === EMPTY) {
          // Make the move
          board[i][j] = PLAYER_O;

          // Call minimax recursively and choose the minimum value
          best = Math.min(best, minimax(board, depth + 1, !isMaximizingPlayer, alpha, beta));

          // Undo the move
          board[i][j] = EMPTY;

          // Alpha Beta Pruning
          beta = Math.min(beta, best);
          if (beta <= alpha) {
            break; // Prune the remaining branches
          }
        }
      }
      if (beta <= alpha) {
        break; // Prune from outer loop
      }
    }
    return best;
  }
}

// This will return the best possible move for the AI player
export function findBestMove(board: Board): Move | null {
  let bestVal = Number.MIN_SAFE_INTEGER;
  let bestMove: Move = { row: -1, col: -1 };

  // Initialize alpha and beta for the first call
  let alpha = Number.MIN_SAFE_INTEGER;
  let beta = Number.MAX_SAFE_INTEGER;

  // Traverse all cells, evaluate minimax function for all empty cells.
  // And return the cell with optimal value.
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      // Check if cell is empty
      if (board[i][j] === EMPTY) {
        // Make the move
        board[i][j] = PLAYER_X;

        // compute evaluation function for this move with Alpha-Beta
        // Note: We call minimax assuming the *next* turn is the minimizing player (O)
        let moveVal = minimax(board, 0, false, alpha, beta);

        // Undo the move
        board[i][j] = EMPTY;

        // If the value of the current move is more than the best value, then update best
        if (moveVal > bestVal) {
          bestMove.row = i;
          bestMove.col = j;
          bestVal = moveVal;
        }
        // Update alpha for the top-level call (maximizing player's turn)
        alpha = Math.max(alpha, moveVal);
      }
    }
  }

  if (bestMove.row === -1) {
    // Should not happen in a non-full board, but good practice
    return null;
  }

  return bestMove;
}