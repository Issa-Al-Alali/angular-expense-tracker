import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http'; // Import the function to provide HttpClient
import { provideRouter } from '@angular/router'; // Import the function to provide Router
import { routes } from './app.routes'; // Import your defined routes

// This is the main configuration object for your standalone Angular application.
// It specifies the providers available application-wide.
export const appConfig: ApplicationConfig = {
  providers: [
    // provideRouter sets up the Angular router and makes it available.
    // It uses the 'routes' array defined in app.routes.ts to configure navigation.
    provideRouter(routes),

    // provideHttpClient sets up the HttpClient service, allowing you to make HTTP requests.
    // This is needed by your AuthService to communicate with the Django backend.
    provideHttpClient(),

    // provideAnimations is often needed for Angular Material or other animation libraries.
    // Even if you don't use them yet, it's good practice to include it if you anticipate using UI libraries.
    // import { provideAnimations } from '@angular/platform-browser/animations'; // Make sure this import is present if you uncomment provideAnimations
    // provideAnimations(), // Uncomment if you need browser animations
  ]
};
