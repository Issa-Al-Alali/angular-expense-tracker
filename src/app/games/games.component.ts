// src/app/games/games.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for basic directives if used in this template

// Import the standalone TicTacToeComponent
import { TicTacToeComponent } from './tic-tac-toe/tic-tac-toe.component';

@Component({
  selector: 'app-games',
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.css'], // Or .scss
  standalone: true, // <--- GamesComponent should also likely be standalone
  imports: [
    CommonModule, // Add CommonModule if needed for this component's template
    TicTacToeComponent // <--- IMPORT THE STANDALONE COMPONENT HERE
  ]
})
export class GamesComponent {
  // ... your GamesComponent logic (if any)
}