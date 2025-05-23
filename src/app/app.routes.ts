// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { RegistrationComponent } from './registration/registration.component';
import { LoginComponent } from './login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthGuard } from './auth.guard'; // Import the AuthGuard
import { IncomeComponent } from './income/income.component'; // Import the IncomeComponent
import { ExpensesComponent } from './expenses/expenses.component'; // Import the ExpensesComponent
import { VideosComponent } from './videos/videos.component';
import { VideoDetailComponent } from './video-detail/video-detail.component'; // Import the VideoDetailComponent
import { ProfileComponent } from './profile/profile.component'; // Import the ProfileComponent
import { GamesComponent } from './games/games.component';

export const routes: Routes = [
  // 1. Default redirect for the initial load: Redirect the root path ('') to the register page.
  // This route is checked first. If the user is not authenticated, the '' path will match
  // and redirect to '/register'. If the user *is* authenticated, this redirect still happens,
  // but the AuthGuard on the protected route will then allow access to the intended protected page.
  { path: '', redirectTo: '/register', pathMatch: 'full' },

  // 2. Public Routes (accessible without authentication)
  { path: 'register', component: RegistrationComponent },
  { path: 'login', component: LoginComponent },

  // 3. Protected Routes (require authentication)
  // These routes use the LayoutComponent as a parent
  {
    path: '', // This path serves as the entry point for authenticated users *after* the initial redirect
    component: LayoutComponent,
    canActivate: [AuthGuard], // Apply the AuthGuard to this route and its children
    children: [
      // Child routes that will be rendered inside the LayoutComponent's <router-outlet>
      { path: 'dashboard', component: DashboardComponent },
      { path: 'incomes', component: IncomeComponent },
      { path: 'expenses', component: ExpensesComponent },

      // Video Routes
      { path: 'videos', component: VideosComponent }, // Video List route
    

      // Games Routes
      {path: 'games', component: GamesComponent},

      // Profile Route
      { path: 'profile', component: ProfileComponent },

      { path: 'videos', component: VideosComponent }, // Route for the video list
      { path: 'videos/:id', component: VideoDetailComponent }, // Route for video details

      // Optional: Redirect from the root of the authenticated section ('/') to the dashboard
      // This path is matched *after* the public routes and the initial redirect.
      // It ensures that if an authenticated user navigates to '/', they land on the dashboard.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // Ensure this is below other child routes
    ]
  },

  // Optional: Wildcard route for handling unknown paths (redirect to login or a 404 page)
  // This should be the LAST route in your array
  // { path: '**', redirectTo: '/login' }
];