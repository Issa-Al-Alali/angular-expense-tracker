// src/app/games/tic-tac-toe/tic-tac-toe.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for ngFor, ngIf etc.
// Import your logic functions
import {
  Board,
  Move,
  Player,
  PLAYER_X,
  PLAYER_O,
  EMPTY,
  isMovesLeft,
  evaluate,
  findBestMove
} from './tic-tac-toe.logic';

@Component({
  selector: 'app-tic-tac-toe',
  templateUrl: './tic-tac-toe.component.html',
  styleUrls: ['./tic-tac-toe.component.css'], // Or .scss
  standalone: true, // <--- MAKE SURE THIS IS TRUE
  imports: [
    CommonModule // <--- Import CommonModule here for directives like *ngFor, *ngIf
  ]
})
export class TicTacToeComponent implements OnInit {
    // ... rest of your component code
    board: Board = [];
    currentPlayer: Player = PLAYER_O;
    gameStatus: string = '';
    gameOver: boolean = false;

    readonly PLAYER_X = PLAYER_X;
    readonly PLAYER_O = PLAYER_O;
    readonly EMPTY = EMPTY;

    constructor() { }

    ngOnInit(): void {
      this.initializeBoard();
      this.updateStatus();
    }
    // ... other methods (initializeBoard, handleSquareClick, etc.)


  initializeBoard(): void {
    this.board = [
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY]
    ];
    this.currentPlayer = PLAYER_O;
    this.gameOver = false;
    this.updateStatus();
  }

  handleSquareClick(row: number, col: number): void {
    // Only allow clicks on empty squares when it's the human's turn and the game is not over
    if (this.board[row][col] === EMPTY && this.currentPlayer === PLAYER_O && !this.gameOver) {
      this.makeMove(row, col, PLAYER_O);

      if (!this.gameOver) {
        this.currentPlayer = PLAYER_X;
        this.updateStatus();
        // Add a small delay before AI move for better UX
        setTimeout(() => {
          this.makeAIMove();
        }, 500); // 500ms delay
      }
    }
  }

  makeMove(row: number, col: number, player: Player): void {
    this.board[row][col] = player;
    // No need to manually update UI, Angular's binding handles this
    this.checkGameEnd();
  }

  makeAIMove(): void {
    // It's AI's turn (PLAYER_X)
    if (!this.gameOver && this.currentPlayer === PLAYER_X) {
      const aiMove = findBestMove(this.board);

      if (aiMove) {
         this.makeMove(aiMove.row, aiMove.col, PLAYER_X);
      }

      if (!this.gameOver) {
        this.currentPlayer = PLAYER_O;
        this.updateStatus();
      }
    }
  }

  checkGameEnd(): void {
    const score = evaluate(this.board);

    if (score === 10) {
      this.gameStatus = 'AI Wins!';
      this.gameOver = true;
    } else if (score === -10) {
      this.gameStatus = 'You Win!';
      this.gameOver = true;
    } else if (!isMovesLeft(this.board)) {
      this.gameStatus = "It's a Tie!";
      this.gameOver = true;
    } else {
      this.updateStatus(); // Update status only if game is ongoing
    }
  }

  updateStatus(): void {
      if (!this.gameOver) {
          this.gameStatus = `${this.currentPlayer === PLAYER_O ? 'Your' : 'AI\'s'} turn (${this.currentPlayer})`;
      }
      // If gameOver is true, status was set in checkGameEnd
  }

  resetGame(): void {
    this.initializeBoard();
  }

  // Helper function to determine if a cell should be disabled (already played or game over)
  isCellDisabled(row: number, col: number): boolean {
    return this.board[row][col] !== EMPTY || this.gameOver;
  }

  // Helper function to get player class for styling
  getPlayerClass(value: Player): string {
      if (value === PLAYER_X) return 'player-x';
      if (value === PLAYER_O) return 'player-o';
      return ''; // For empty cells
  }
}