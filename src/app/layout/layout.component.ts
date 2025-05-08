import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; // Import Router
import { AuthService } from '../auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {

  // isAuthenticated$ is now correctly typed as Observable<boolean>
  isAuthenticated$: Observable<boolean>;
  // Placeholder for user data (like profile picture URL)
  // You'll need to fetch this from your backend in a real app
  userProfilePictureUrl: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router // Inject Router for navigation after logout
  ) {
    // Assign the observable directly from the AuthService
    this.isAuthenticated$ = this.authService.isAuthenticated$;
  }

  ngOnInit(): void {
    // In a real app, you'd fetch user profile data here if authenticated
    // You can subscribe to isAuthenticated$ here if you need to react to auth status changes
    // or fetch user data when authenticated.
    // Example:
    // this.isAuthenticated$.subscribe(isAuthenticated => {
    //   if (isAuthenticated) {
    //     // Fetch user profile picture URL
    //     // this.authService.getUserProfile().subscribe(profile => {
    //     //   this.userProfilePictureUrl = profile.profile_picture_url;
    //     // });
    //   } else {
    //     this.userProfilePictureUrl = null; // Clear profile pic on logout
    //   }
    // });
  }

  // Method to handle logout
  logout(): void {
    this.authService.logout();
    // Redirect to the login page after logout
    this.router.navigate(['/login']);
  }

  // Method to toggle the dropdown (if not using Bootstrap JS)
  // You might need to implement custom dropdown logic or use an Angular Bootstrap library
  toggleDropdown(): void {
    // Implement dropdown toggle logic here
    console.log('Dropdown toggled'); // Placeholder
    // If using Bootstrap JS, this method might not be needed if data-bs-toggle handles it.
    // If implementing manually, you'd need a state variable to track dropdown open/closed.
  }
}
