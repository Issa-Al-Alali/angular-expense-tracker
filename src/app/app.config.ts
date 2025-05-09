import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'; // Import provideHttpClient
import { routes } from './app.routes';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';
import { VideoService } from './video.service'; // Import the new service

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()), // Provide HttpClient
    AuthService,
    ExpenseService,
    VideoService // Add VideoService to providers
  ]
};
