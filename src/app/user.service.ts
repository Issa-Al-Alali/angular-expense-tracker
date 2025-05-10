import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Assuming AuthService is available for token

// Interface for the user data structure
export interface User {
  id: string; // Assuming user ID is part of the profile data
  username: string;
  email: string;
  profile_picture: string | null; // URL to the profile picture
  // Add other user fields if your API returns them
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  // Assuming API endpoints for user profile
  private userProfileUrl = 'http://localhost:8000/users/profile/'; // Endpoint to get/update user profile
  private updateProfilePictureUrl = 'http://localhost:8000/users/profile/'; // Endpoint to update profile picture

  constructor(
    private http: HttpClient,
    private authService: AuthService // Inject AuthService to get the token
  ) { }

  /**
   * Gets the standard HTTP headers with Authorization token.
   * @returns HttpHeaders object.
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      console.error('Authentication token not found. Cannot make authenticated request.');
      return new HttpHeaders(); // Return empty headers if no token
    }
    return new HttpHeaders({
      'Authorization': `Token ${token}` // Assuming Token-based authentication
    });
  }

  /**
   * Fetches the authenticated user's profile data.
   * GET: http://localhost:8000/api/users/me/
   * @returns An Observable with the User object.
   */
  getUserProfile(): Observable<User> {
    const headers = this.getAuthHeaders();
    console.log('Fetching user profile from URL:', this.userProfileUrl);
    return this.http.get<User>(this.userProfileUrl, { headers }).pipe(
      tap(response => console.log('User profile fetched successfully', response)),
      catchError(error => {
        console.error('Error fetching user profile:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates the user's profile picture.
   * POST: http://localhost:8000/api/users/me/update_picture/
   * @param file - The new profile picture file (File object).
   * @returns An Observable with the updated User object or a success response.
   */
  updateProfilePicture(file: File): Observable<User> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('Authentication token not found. Cannot update profile picture.'));
    }

    // Use FormData for file upload
    const formData = new FormData();
    formData.append('profile_picture', file, file.name);

    // Set Authorization header, but HttpClient will automatically set Content-Type for FormData
    const headers = new HttpHeaders({
      'Authorization': `Token ${token}`
    });

    console.log('Updating profile picture to URL:', this.updateProfilePictureUrl);

    // Assuming the API returns the updated user object upon successful picture update
    return this.http.put<User>(this.updateProfilePictureUrl, formData, { headers }).pipe(
      tap(response => console.log('Profile picture updated successfully', response)),
      catchError(error => {
        console.error('Error updating profile picture:', error);
        return throwError(() => error);
      })
    );
  }

  // You might add methods here for updating other profile details (username, email, etc.)
}
