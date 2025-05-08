import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs'; // Import Observable
import { AuthService } from './auth.service'; // Import your AuthService

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  /**
   * Determines if a route can be activated.
   * Checks the user's authentication status using the AuthService.isAuthenticated() method.
   * If authenticated, allows navigation (returns true).
   * If not authenticated, redirects to the login page (returns a UrlTree).
   * @param route - The activated route snapshot.
   * @param state - The router state snapshot.
   * @returns A boolean or UrlTree.
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    // Use the synchronous isAuthenticated() method from AuthService
    if (this.authService.isAuthenticated()) {
      // User is authenticated, allow access to the route
      return true;
    } else {
      // User is NOT authenticated, redirect to the login page
      console.log('AuthGuard: User not authenticated, redirecting to login.');
      // Create a UrlTree to navigate to the login page
      return this.router.createUrlTree(['/login']);
    }
  }
}
