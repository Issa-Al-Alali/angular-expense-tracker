import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for common Angular directives like *ngIf, *ngFor
import { RouterModule } from '@angular/router'; // Needed for router directives like <router-outlet> and routerLink

@Component({
  selector: 'app-root', // The custom HTML tag for this component
  standalone: true, // Indicates this is a standalone component
  // Import necessary modules for this standalone component.
  // RouterModule provides routing capabilities including <router-outlet>.
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html', // Link to the component's HTML template
  styleUrls: ['./app.component.css'] // Link to the component's CSS styles
})
export class AppComponent {
  title = 'expense-tracker'; // A simple property for the component
}
