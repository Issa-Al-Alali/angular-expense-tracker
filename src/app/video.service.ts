import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Assuming AuthService is available for token

// Interface for a single video object
export interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  description: string;
  created_at: string; // ISO 8601 string
}

// Interface for the API response structure (paginated results)
export interface VideoApiResponse {
  count: number;
  next: string | null; // URL for the next page
  previous: string | null; // URL for the previous page
  results: Video[]; // Array of video objects
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {

  private apiUrl = 'http://127.0.0.1:8000/api/videos/'; // Your video API endpoint

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
   * Fetches a list of videos with optional pagination and search.
   * GET: http://127.0.0.1:8000/api/videos/
   * @param page - The page number to fetch.
   * @param search - The search query string.
   * @returns An Observable with the paginated video data.
   */
  getVideos(page: number = 1, search: string = ''): Observable<VideoApiResponse> {
    const headers = this.getAuthHeaders();

    let params = new HttpParams();
    params = params.set('page', page.toString());
    if (search) {
      params = params.set('search', search);
    }

    console.log('Fetching videos with URL:', this.apiUrl, 'and params:', params.toString());

    return this.http.get<VideoApiResponse>(this.apiUrl, { headers, params }).pipe(
      tap(response => console.log('Fetched videos successfully', response)),
      catchError(error => {
        console.error('Error fetching videos:', error);
        return throwError(() => error);
      })
    );
  }
}
