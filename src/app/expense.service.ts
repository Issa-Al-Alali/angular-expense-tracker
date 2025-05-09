import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Import AuthService to get the token and user ID
import { ErrorResponse } from './auth.service'; // Import ErrorResponse from AuthService

// Define interfaces for API data structures

export interface Expense {
  id: string;
  expense_date: string; // Assuming date string format like 'YYYY-MM-DD'
  category: string; // Category ID (UUID string)
  category_name: string; // Category name string
  description: string;
  amount: string; // API returns as string, will need conversion to number in component
  location: string | null;
  receipt: string | null; // URL to the receipt file
}

export interface Category {
  id: string; // Category ID (UUID string)
  name: string; // Category name
  // Add other category fields if your API returns them
}

// Interface matching the summary API response structure
export interface ExpenseSummary {
  labels: string[]; // e.g., Month names or Category names
  data: number[]; // Corresponding expense amounts
}

export interface AddExpenseResponse {
  id: string;
  expense_date: string;
  category: string; // Category ID
  category_name: string;
  description: string;
  amount: string;
  location: string | null;
  receipt: string | null;
}

export interface UpdateExpenseResponse {
  id: string;
  expense_date: string;
  category: string; // Category ID
  category_name: string;
  description: string;
  amount: string;
  location: string | null;
  receipt: string | null;
}

export interface DeleteExpenseResponse {
  success: boolean; // Assuming the delete API returns { "success": true }
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  private apiUrl = 'http://localhost:8000'; // Your Django API base URL

  constructor(
    private http: HttpClient,
    private authService: AuthService // Inject AuthService
  ) { }

  /**
   * Gets the standard HTTP headers with Authorization token.
   * @returns HttpHeaders object.
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      console.error('Authentication token not found. Cannot make authenticated request.');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}` // Assuming Token-based authentication
    });
  }

  /**
   * Fetches a list of expenses for the authenticated user, with optional filters and sorting.
   * GET: /expenses/{user_id}/
   * @param filters - Optional query parameters (year, month, category_name, sort).
   * @returns An Observable with an array of Expense objects.
   */
  getExpenses(filters?: { year?: string, month?: string, category_name?: string, sort?: string }): Observable<Expense[]> {
    const headers = this.getAuthHeaders();
    const userId = this.authService.getUserId(); // Get user ID from AuthService

    if (!userId) {
      return throwError(() => new Error('User ID not found. Cannot fetch expenses.'));
    }

    let params = new HttpParams();
    if (filters) {
      if (filters.year) params = params.set('year', filters.year);
      if (filters.month) params = params.set('month', filters.month);
      if (filters.category_name) params = params.set('category_name', filters.category_name);
      if (filters.sort) params = params.set('sort', filters.sort);
    }

    // Construct the GET URL using the user ID
    const url = `${this.apiUrl}/expenses/${userId}/`;

    console.log('Fetching expenses with URL:', url, 'and params:', params.toString());

    return this.http.get<Expense[]>(url, { headers, params }).pipe(
      tap(response => console.log('Fetched expenses successfully')),
      catchError(error => {
        console.error('Error fetching expenses:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches monthly expense summary data for charting and PDF generation.
   * GET: http://localhost:8000/expenses/{user_id}/monthly-summary?year={year}
   * @param year - The year for the summary.
   * @returns An Observable with ExpenseSummary data ({ labels: string[], data: number[] }).
   */
  getMonthlySummary(year: string): Observable<ExpenseSummary> {
      const headers = this.getAuthHeaders();
      const userId = this.authService.getUserId();

      if (!userId) {
        return throwError(() => new Error('User ID not found. Cannot fetch monthly summary.'));
      }

      const params = new HttpParams().set('year', year);
      // Using the provided API endpoint structure
      const url = `${this.apiUrl}/expenses/${userId}/monthly-summary/`;

      console.log('Fetching monthly summary with URL:', url, 'and params:', params.toString());

      return this.http.get<ExpenseSummary>(url, { headers, params }).pipe(
        tap(response => console.log('Fetched monthly summary successfully')),
        catchError(error => {
          console.error('Error fetching monthly summary:', error);
          return throwError(() => error);
        })
      );
  }

    /**
     * Fetches category expense summary data for charting.
     * GET: http://localhost:8000/expenses/{user_id}/category-summary
     * (Optional query params year, category_name based on previous implementation)
     * @param filters - Optional query parameters (year, category_name).
     * @returns An Observable with ExpenseSummary data ({ labels: string[], data: number[] }).
     */
  getCategorySummary(filters?: { year?: string, category_name?: string }): Observable<ExpenseSummary> {
      const headers = this.getAuthHeaders();
      const userId = this.authService.getUserId();

      if (!userId) {
        return throwError(() => new Error('User ID not found. Cannot fetch category summary.'));
      }

      let params = new HttpParams();
      if (filters) {
         if (filters.year) params = params.set('year', filters.year);
         if (filters.category_name) params = params.set('category_name', filters.category_name);
      }

      // Using the provided API endpoint structure
      const url = `${this.apiUrl}/expenses/${userId}/category-summary/`;

      console.log('Fetching category summary with URL:', url, 'and params:', params.toString());

      return this.http.get<ExpenseSummary>(url, { headers, params }).pipe(
        tap(response => console.log('Fetched category summary successfully')),
        catchError(error => {
          console.error('Error fetching category summary:', error);
          return throwError(() => error);
        })
      );
  }


  /**
   * Adds a new expense.
   * POST: http://localhost:8000/expenses/add/{user_id}/{category_name}/
   * Handles both JSON data and FormData for file uploads.
   * @param expenseData - The expense data (amount, description, date, location).
   * @param categoryName - The name of the category (required for the URL).
   * @param categoryId - The ID of the category (required in the body based on PUT example).
   * @param receiptFile - Optional receipt file (PDF).
   * @returns An Observable with the AddExpenseResponse.
   */
  addExpense(expenseData: { amount: number, description: string, expense_date: string, location: string }, categoryName: string, categoryId: string, receiptFile?: File | null): Observable<AddExpenseResponse> {
    const token = this.authService.getToken();
    const userId = this.authService.getUserId();

    if (!token || !userId) {
      return throwError(() => new Error('Authentication token or User ID not found. Cannot add expense.'));
    }

    // Construct the POST URL using user_id and category_name as per your API example
    const url = `${this.apiUrl}/expenses/add/${userId}/${encodeURIComponent(categoryName)}/`;

    let headers = new HttpHeaders({
        'Authorization': `Token ${token}`,
    });

    let body: FormData | any;

    if (receiptFile) { // Check if receiptFile is not null or undefined
        // Use FormData for file upload (handles multipart/form-data)
        body = new FormData();
        body.append('amount', expenseData.amount.toString()); // Convert number to string for FormData
        body.append('description', expenseData.description);
        body.append('expense_date', expenseData.expense_date);
        body.append('location', expenseData.location);
        body.append('category', categoryId); // Include category ID in FormData body
        body.append('receipt', receiptFile, receiptFile.name);

        // No need to set Content-Type: 'multipart/form-data' manually with FormData
        headers = new HttpHeaders({
             'Authorization': `Token ${token}`,
        });

    } else {
        // Use JSON for data without file
        body = {
            amount: expenseData.amount,
            description: expenseData.description,
            expense_date: expenseData.expense_date,
            location: expenseData.location,
            category: categoryId // Include category ID in JSON body
        };
        headers = this.getAuthHeaders(); // Uses 'application/json'
    }

    console.log('Add Expense Request URL:', url);
    console.log('Add Expense Request Body:', body);

    return this.http.post<AddExpenseResponse>(url, body, { headers }).pipe(
      tap(response => console.log('Expense added successfully', response)),
      catchError(error => {
        console.error('Error adding expense:', error);
        return throwError(() => error);
      })
    );
  }


  /**
   * Updates an existing expense.
   * PUT: http://localhost:8000/expenses/update/{expense_id}/
   * @param expenseId - The ID of the expense to update.
   * @param updateData - The updated expense data.
   * @returns An Observable with the UpdateExpenseResponse.
   */
  updateExpense(expenseId: string, updateData: { amount: number, description: string, expense_date: string, location: string | null, category: string }): Observable<UpdateExpenseResponse> {
    const headers = this.getAuthHeaders();
    const url = `${this.apiUrl}/expenses/update/${expenseId}/`;
    const body = updateData; // The updateData object should match the expected API format

    console.log('Update Expense Request URL:', url);
    console.log('Update Expense Request Body:', body);

    return this.http.put<UpdateExpenseResponse>(url, body, { headers }).pipe(
      tap(response => console.log('Expense updated successfully', response)),
      catchError(error => {
        console.error('Error updating expense:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes an expense.
   * DELETE: http://localhost:8000/expenses/delete/{expense_id}/
   * @param expenseId - The ID of the expense to delete.
   * @returns An Observable with the DeleteExpenseResponse.
   */
  deleteExpense(expenseId: string): Observable<DeleteExpenseResponse> {
    const headers = this.getAuthHeaders();
    const url = `${this.apiUrl}/expenses/delete/${expenseId}/`;

    console.log('Delete Expense Request URL:', url);

    return this.http.delete<DeleteExpenseResponse>(url, { headers }).pipe(
      tap(response => console.log('Expense deleted successfully', response)),
      catchError(error => {
        console.error('Error deleting expense:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches the list of expense categories.
   * GET: http://localhost:8000/categories/ (Assuming a categories endpoint exists)
   * @returns An Observable with an array of Category objects.
   */
  getCategories(): Observable<Category[]> {
      const headers = this.getAuthHeaders();
      // Assuming a categories endpoint exists at /categories/
      const url = `${this.apiUrl}/categories/`;

      console.log('Fetching Categories Request URL:', url);

      return this.http.get<Category[]>(url, { headers }).pipe(
          tap(response => console.log('Fetched categories successfully')),
          catchError(error => {
              console.error('Error fetching categories:', error);
              return throwError(() => error);
          })
      );
  }
}