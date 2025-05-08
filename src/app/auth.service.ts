import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, BehaviorSubject, throwError } from 'rxjs'; // Import throwError
import { catchError } from 'rxjs/operators'; // Import catchError

// Define the structure of the user data for registration
interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

// Define the structure of the successful registration response
interface RegistrationResponse {
  user_id: string;
  token: string;
}

// Define the structure of the user data for login
interface LoginData {
  email: string;
  password: string;
}

// Define the structure of the successful login response
export interface LoginResponse {
  user_id: string;
  token: string;
}

// Define the structure for potential error responses
export interface ErrorResponse {
  non_field_errors?: string[]; // General errors (optional)
  [key: string]: string[] | undefined; // Allow for other string keys mapping to string arrays or undefined
}

// Define the structure for Income data from the API
export interface IncomeData {
  id: string; // Income object ID
  budget_amount: string; // API returns as string, will need conversion to number in component
  created_at: string;
  user: string; // User ID associated with this income
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _isAuthenticated = new BehaviorSubject<boolean>(this.checkAuthenticationStatus());
  isAuthenticated$ = this._isAuthenticated.asObservable();

  private apiUrl = 'http://localhost:8000'; // Example API URL - MAKE SURE THIS IS CORRECT

  constructor(private http: HttpClient) { }

  /**
   * Gets the standard HTTP headers with Authorization token.
   * @returns HttpHeaders object.
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (!token) {
      // In a real app, you might want to handle this more gracefully,
      // perhaps redirecting to login or throwing a specific error.
      console.error('Authentication token not found.');
      // For now, return headers without token, which will likely result in 401 from backend.
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}` // Assuming Token-based authentication
    });
  }

  private checkAuthenticationStatus(): boolean {
    return this.getToken() !== null;
  }

  register(userData: RegistrationData): Observable<RegistrationResponse | ErrorResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.post<RegistrationResponse | ErrorResponse>(`${this.apiUrl}/users/`, userData, { headers });
  }

  login(credentials: LoginData): Observable<LoginResponse | ErrorResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.post<LoginResponse | ErrorResponse>(`${this.apiUrl}/users/login/`, credentials, { headers }).pipe(
      tap((response) => {
        if ('token' in response && 'user_id' in response) {
          if (typeof response.token === 'string') {
            localStorage.setItem('authToken', response.token);
          } else {
            console.error('Invalid token format:', response.token);
          }
          if (typeof response.user_id === 'string') {
            localStorage.setItem('authUserId', response.user_id);
          } else {
            console.error('Invalid user_id format:', response.user_id);
          }
          this._isAuthenticated.next(true);
          console.log('Login successful, token and user_id stored. Auth status updated.');
        }
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  getUserId(): string | null {
    return localStorage.getItem('authUserId');
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUserId');
    this._isAuthenticated.next(false);
    console.log('User logged out, token and user_id removed. Auth status updated.');
  }

  // --- Income API Methods ---

  /**
   * Fetches the current income data for the authenticated user.
   * @returns An Observable with IncomeData or an error.
   */
  getIncome(): Observable<IncomeData> {
    const headers = this.getAuthHeaders();
    // Assuming the GET endpoint is /incomes/ and returns the user's income object
    return this.http.get<IncomeData>(`${this.apiUrl}/incomes/`, { headers }).pipe(
      catchError(error => {
        console.error('Error fetching income:', error);
        // Propagate the error or return a default value/observable
        return throwError(() => new Error('Could not fetch income data.'));
      })
    );
  }

  /**
   * Updates the income data for the authenticated user.
   * Note: The API example shows PUT to /incomes/{user_id}/, which is unusual.
   * We will follow this structure, using the stored user_id.
   * @param budgetAmount - The new budget amount.
   * @returns An Observable with the updated IncomeData or an error.
   */
  updateIncome(budgetAmount: number): Observable<IncomeData> {
    const headers = this.getAuthHeaders();
    const userId = this.getUserId(); // Get the user ID from local storage

    if (!userId) {
        console.error('User ID not found for updating income.');
        return throwError(() => new Error('User not logged in.'));
    }

    // Construct the PUT URL using the user ID as per the API example
    const updateUrl = `${this.apiUrl}/incomes/${userId}/`;
    const body = { budget_amount: budgetAmount }; // API expects budget_amount in the body

    return this.http.put<IncomeData>(updateUrl, body, { headers }).pipe(
      tap(response => console.log('Income updated successfully', response)),
      catchError(error => {
        console.error('Error updating income:', error);
        // Propagate the error
        return throwError(() => error); // Return the original error object
      })
    );
  }
}
