import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config'; // Ensure this import path is correct relative to main.ts
import { AppComponent } from './app/app.component'; // Ensure this import path is correct relative to main.ts

// This function bootstraps the root component (AppComponent) of your application
// and provides the application-level configuration defined in appConfig.
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err)); // Catch and log any errors during bootstrapping
