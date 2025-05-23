import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Assuming AuthService is available for token

// Interface for a single video object (potentially updated for detail view)
export interface Video {
  id: string;
  title: string;
  url: string; // Assuming this is the video file URL or embed URL
  thumbnail: string | null;
  description: string;
  created_at: string; // ISO 8601 string
  // Added properties for detail view (based on your API response)
  liked?: boolean; // Changed from is_liked to match API
  likes_count?: number; // Total number of likes
  comments?: Comment[]; // Array of comments associated with the video
  reviews?: Review[]; // Array of reviews associated with the video
  user_review?: Review | null; // Current user's review for this video (if exists)
  // API response also has comments_count, but we can derive it from comments array length
}

// Interface for the API response structure (paginated results)
export interface VideoApiResponse {
  count: number;
  next: string | null; // URL for the next page
  previous: string | null; // URL for the previous page
  results: Video[]; // Array of video objects
}

// Interface for a Comment
export interface Comment {
  id: string; // ID of the comment
  user: string; // User ID (as a string, based on your API response)
  video: string; // ID of the video the comment belongs to
  content: string;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  user_username?: string | null; // User's username (directly on the comment object)
  user_profile_picture?: string | null; // User's profile picture URL (directly)
}

// Interface for a Review
export interface Review {
  id: string; // ID of the review
  user: string; // User ID (as a string, based on your API response)
  video: string; // ID of the video the review belongs to
  rating: number; // e.g., 1 to 5
  review_text: string;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  user_username?: string | null; // User's username (directly on the review object)
  // API response didn't show user_profile_picture for reviews, but add it if needed
  // user_profile_picture?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  // Use a base API URL for flexibility
  private baseUrl = 'http://127.0.0.1:8000/api/';
  private videosUrl = `${this.baseUrl}videos/`;
  private commentsUrl = `${this.baseUrl}comments/`;

  constructor(
    private http: HttpClient,
    private authService: AuthService // Inject AuthService to get the token
  ) { }

  /**
   * Gets the standard HTTP headers with Authorization token (Bearer format).
   * @returns HttpHeaders object.
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      // Handle cases where token is missing (e.g., redirect to login)
      console.error('Authentication token not found. Cannot make authenticated request.');
      // Depending on your AuthGuard setup, you might want to throw an error
      // or return empty headers, but for authenticated calls, this is an issue.
      // For now, we'll just log and return empty headers.
      // You might want a more robust solution like redirecting.
      return new HttpHeaders();
    }
    
    return new HttpHeaders({
      'Authorization': `Token ${token}`
    });
  }

  /**
   * Fetches a list of videos with optional pagination and search.
   * GET: http://127.0.0.1:8000/api/videos/
   * This endpoint is public according to the API description,
   * so authentication headers might not be strictly necessary here,
   * but we'll include them in case the API provides user-specific info
   * (like 'is_liked') even in the list view when authenticated.
   * If the API is truly public and doesn't care about auth for the list,
   * you can remove `headers` from the `http.get` call below.
   * @param page - The page number to fetch.
   * @param search - The search query string.
   * @returns An Observable with the paginated video data.
   */
  getVideos(page: number = 1, search: string = ''): Observable<VideoApiResponse> {
    const headers = this.getAuthHeaders(); // Include headers just in case
    let params = new HttpParams();
    params = params.set('page', page.toString());
    if (search) {
      params = params.set('search', search);
    }

    console.log('Fetching videos list with URL:', this.videosUrl, 'and params:', params.toString());
    // Note: If the list endpoint is truly public and doesn't use auth, remove `{ headers }`
    return this.http.get<VideoApiResponse>(this.videosUrl, { headers, params }).pipe(
      tap(response => console.log('Fetched videos list successfully', response)),
      catchError(error => {
        console.error('Error fetching videos list:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches details for a specific video.
   * GET: http://127.0.0.1:8000/api/videos/{video_id}/
   * This endpoint is public but includes user-specific data if authenticated.
   * We MUST include authentication headers here to get comments, reviews, and like status.
   * @param videoId - The ID of the video to fetch.
   * @returns An Observable with the video details.
   */
  getVideoDetails(videoId: string): Observable<Video> {
    const url = `${this.videosUrl}${videoId}/`;
    const headers = this.getAuthHeaders(); // Auth headers are needed for user-specific data

    console.log('Fetching video details with URL:', url);
    // Using <Video> as the expected response type, assuming it includes comments/reviews/like status
    return this.http.get<Video>(url, { headers }).pipe(
      tap(response => console.log('Fetched video details successfully', response)),
      catchError(error => {
        console.error(`Error fetching video details for ${videoId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds a comment to a video.
   * POST: http://127.0.0.1:8000/api/videos/{video_id}/comments/
   * Requires authentication.
   * @param videoId - The ID of the video.
   * @param content - The comment text.
   * @returns An Observable with the created Comment object.
   */
  addComment(videoId: string, content: string): Observable<Comment> {
    const url = `${this.videosUrl}${videoId}/comments/`;
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json'); // Need Content-Type for POST body
    const body = { content: content };

    console.log('Adding comment to video:', videoId, 'with content:', content);
    return this.http.post<Comment>(url, body, { headers }).pipe(
      tap(response => console.log('Comment added successfully', response)),
      catchError(error => {
        console.error(`Error adding comment to video ${videoId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates a comment.
   * PUT: http://127.0.0.1:8000/api/comments/{comment_id}/
   * Requires authentication and must be the comment owner.
   * @param commentId - The ID of the comment to update.
   * @param content - The updated comment text.
   * @returns An Observable with the updated Comment object.
   */
  updateComment(commentId: string, content: string): Observable<Comment> {
    const url = `${this.commentsUrl}${commentId}/`;
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    const body = { content: content };

    console.log('Updating comment:', commentId, 'with content:', content);
    return this.http.put<Comment>(url, body, { headers }).pipe(
      tap(response => console.log('Comment updated successfully', response)),
      catchError(error => {
        console.error(`Error updating comment ${commentId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes a comment.
   * DELETE: http://127.0.0.1:8000/api/comments/{comment_id}/
   * Requires authentication and must be the comment owner.
   * @param commentId - The ID of the comment to delete.
   * @returns An Observable (HTTP 204 No Content expected, so type is `any` or `void`).
   */
  deleteComment(commentId: string): Observable<any> {
    const url = `${this.commentsUrl}${commentId}/`;
    const headers = this.getAuthHeaders();

    console.log('Deleting comment:', commentId);
    return this.http.delete(url, { headers }).pipe(
      tap(() => console.log(`Comment ${commentId} deleted successfully`)),
      catchError(error => {
        console.error(`Error deleting comment ${commentId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Toggles the like status for a video for the authenticated user.
   * POST: http://127.0.0.1:8000/api/videos/{video_id}/like/
   * Requires authentication.
   * @param videoId - The ID of the video.
   * @returns An Observable with the updated like status/count (assuming API returns this).
   * Expected response structure might be `{ is_liked: boolean, likes_count: number }`
   */
  toggleLike(videoId: string): Observable<{ liked: boolean, likes_count: number }> {
    const url = `${this.videosUrl}${videoId}/like/`;
    const headers = this.getAuthHeaders();
    // POST request to toggle like usually doesn't need a body, or maybe an empty body {}
    const body = {}; // Send empty body as per curl example

    console.log('Toggling like for video:', videoId);
    return this.http.post<{ liked: boolean, likes_count: number }>(url, body, { headers }).pipe(
      tap(response => console.log('Like toggled successfully', response)),
      catchError(error => {
        console.error(`Error toggling like for video ${videoId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds a new review or updates an existing one for a video.
   * POST: http://127.0.0.1:8000/api/videos/{video_id}/review/
   * Requires authentication.
   * @param videoId - The ID of the video.
   * @param rating - The rating (e.g., 1-5).
   * @param reviewText - The review text.
   * @returns An Observable with the created/updated Review object.
   */
  addOrUpdateReview(videoId: string, rating: number, reviewText: string): Observable<Review> {
    const url = `${this.videosUrl}${videoId}/review/`;
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    const body = { rating: rating, review_text: reviewText };

    console.log('Adding/Updating review for video:', videoId, 'with rating:', rating);
    return this.http.post<Review>(url, body, { headers }).pipe(
      tap(response => console.log('Review added/updated successfully', response)),
      catchError(error => {
        console.error(`Error adding/updating review for video ${videoId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // Helper to get current user ID (assuming AuthService provides this)
  getCurrentUserId(): string | null { // <-- Updated to expect string ID
    // Replace with actual method from your AuthService
    // Example: return this.authService.getUserId();
    console.warn("VideoService: getCurrentUserId() needs proper implementation from AuthService");
    // **IMPORTANT:** You need to replace this placeholder with the actual logic
    // to get the authenticated user's ID (as a string matching the API's 'user' field format)
    // from your AuthService.
    return this.authService.getUserId(); // <-- Replace or implement this in AuthService
  }
}

// Note: Make sure your AuthService has a `getToken()` method that returns the
// Bearer token string, and a `getUserId()` method that returns the current user's ID.
// Also, ensure HttpClientModule is imported in your app's root module (e.g., AppModule)
// or imported by standalone components that use the service if not using a root module.