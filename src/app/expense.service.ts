import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Import AuthService to get the token and user ID

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

export interface ExpenseSummary {
    labels: string[]; // e.g., Month names or Category names
    data: number[]; // Corresponding expense amounts
}

export interface AddExpenseResponse {
  id: string;
  // Include other fields returned on successful creation
}

export interface UpdateExpenseResponse {
  id: string;
  // Include other fields returned on successful update
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
      // Handle missing token - perhaps redirect to login or throw a specific error
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

    return this.http.get<Expense[]>(url, { headers, params }).pipe(
      tap(response => console.log('Fetched expenses:', response)),
      catchError(error => {
        console.error('Error fetching expenses:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches monthly expense summary data for charting.
   * GET: /expenses/{user_id}/monthly-summary/
   * @param year - The year for the summary.
   * @returns An Observable with ExpenseSummary data.
   */
  getMonthlySummary(year: string): Observable<ExpenseSummary> {
     const headers = this.getAuthHeaders();
     const userId = this.authService.getUserId();

     if (!userId) {
       return throwError(() => new Error('User ID not found. Cannot fetch monthly summary.'));
     }

     const params = new HttpParams().set('year', year);
     const url = `${this.apiUrl}/expenses/${userId}/monthly-summary/`;

     return this.http.get<ExpenseSummary>(url, { headers, params }).pipe(
       tap(response => console.log('Fetched monthly summary:', response)),
       catchError(error => {
         console.error('Error fetching monthly summary:', error);
         return throwError(() => error);
       })
     );
  }

   /**
   * Fetches category expense summary data for charting.
   * GET: /expenses/{user_id}/category-summary/
   * @param filters - Optional query parameters (year, category_name).
   * @returns An Observable with ExpenseSummary data.
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

     const url = `${this.apiUrl}/expenses/${userId}/category-summary/`;

     return this.http.get<ExpenseSummary>(url, { headers, params }).pipe(
       tap(response => console.log('Fetched category summary:', response)),
       catchError(error => {
         console.error('Error fetching category summary:', error);
         return throwError(() => error);
       })
     );
  }


  /**
   * Adds a new expense.
   * POST: /expenses/add/{user_id}/{category_name}/
   * Handles both JSON data and FormData for file uploads.
   * @param expenseData - The expense data (amount, description, date, location, category ID).
   * @param receiptFile - Optional receipt file (PDF).
   * @returns An Observable with the AddExpenseResponse.
   */
  addExpense(expenseData: { amount: number, description: string, expense_date: string, location: string, category: string }, receiptFile?: File): Observable<AddExpenseResponse> {
    const token = this.authService.getToken();
    const userId = this.authService.getUserId();

    if (!token || !userId) {
      return throwError(() => new Error('Authentication token or User ID not found. Cannot add expense.'));
    }

    // The API endpoint includes user_id and category_name in the URL
    // We need the category name based on the provided category ID.
    // In a real app, you might fetch categories first or have a mapping.
    // For now, let's assume we can get the category name from the provided category ID.
    // This might require fetching categories first or adjusting the backend API.
    // Assuming the backend handles mapping category ID to name internally based on the ID sent in the body.
    // Let's adjust the URL to just include user_id, and send category ID in the body as per PUT example.
    // If the API truly requires category_name in the URL for POST, we'd need the category name.
    // Based on the POST example: POST /expenses/add/{user_id}/{category_name}/
    // We need the category name. Let's assume we can get it from the category ID provided in expenseData.category

    // **Correction based on POST API example:** The API expects category_name in the URL.
    // This means the component needs to provide the category name, not just the ID.
    // This implies the component will need to fetch categories first to get the name from the ID.
    // Let's adjust the method signature and logic to accept categoryName.

    // **Revised addExpense method signature and logic:**
    // We need the category name to build the URL. Let's assume the component passes both ID and Name.
    // Or, fetch categories here first to get the name from the ID. Fetching categories here might be inefficient.
    // It's better for the component to have the category name available (e.g., from a prior fetch).

    // Let's assume the component provides the category name.
    // **Further Correction:** The POST API example shows category_name in the URL, but the response includes category ID.
    // This is a bit inconsistent. Let's assume the POST body should contain the category ID, and the URL includes the user ID.
    // The API example URL `/expenses/add/{user_id}/{category_name}/` seems to imply category_name in the URL.
    // Let's stick to the provided API example structure for now, assuming the component can provide the category name.

    // **Final approach based on provided API example:** The POST URL is `/expenses/add/{user_id}/{category_name}/`.
    // The body contains amount, description, expense_date, location.
    // The receipt is sent as FormData.

    const categoryName = expenseData.category; // Assuming expenseData.category is the category name string
    const url = `${this.apiUrl}/expenses/add/${userId}/${encodeURIComponent(categoryName)}/`;

    let headers = new HttpHeaders({
        'Authorization': `Token ${token}`,
    });

    let body: FormData | any;

    if (receiptFile) {
        // Use FormData for file upload
        body = new FormData();
        body.append('amount', expenseData.amount.toString()); // Convert number to string for FormData
        body.append('description', expenseData.description);
        body.append('expense_date', expenseData.expense_date);
        body.append('location', expenseData.location);
        // Note: The API example POST body didn't explicitly include category ID,
        // but the URL includes category_name. Let's add category ID to the body
        // as it's in the PUT example and likely needed by the backend.
        body.append('category', expenseData.category); // Assuming expenseData.category is the category ID here

        body.append('receipt', receiptFile, receiptFile.name);

        // When using FormData, HttpClient automatically sets the Content-Type to multipart/form-data
        // and includes the boundary, so we don't set Content-Type header manually.
        headers = new HttpHeaders({
             'Authorization': `Token ${token}`,
             // 'Content-Type': 'multipart/form-data' // Do NOT set this manually with FormData
        });

    } else {
        // Use JSON for data without file
        body = {
            amount: expenseData.amount,
            description: expenseData.description,
            expense_date: expenseData.expense_date,
            location: expenseData.location,
            category: expenseData.category // Assuming expenseData.category is the category ID here
        };
        headers = this.getAuthHeaders(); // Uses 'application/json'
    }


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
   * PUT: /expenses/update/{expense_id}/
   * @param expenseId - The ID of the expense to update.
   * @param updateData - The updated expense data.
   * @returns An Observable with the UpdateExpenseResponse.
   */
  updateExpense(expenseId: string, updateData: { amount: number, description: string, expense_date: string, location: string | null, category: string }): Observable<UpdateExpenseResponse> {
    const headers = this.getAuthHeaders();
    const url = `${this.apiUrl}/expenses/update/${expenseId}/`;
    const body = updateData; // The updateData object should match the expected API format

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
   * DELETE: /expenses/delete/{expense_id}/
   * @param expenseId - The ID of the expense to delete.
   * @returns An Observable with the DeleteExpenseResponse.
   */
  deleteExpense(expenseId: string): Observable<DeleteExpenseResponse> {
    const headers = this.getAuthHeaders();
    const url = `${this.apiUrl}/expenses/delete/${expenseId}/`;

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
   * GET: /categories/ (Assuming a categories endpoint exists)
   * @returns An Observable with an array of Category objects.
   */
  getCategories(): Observable<Category[]> {
      const headers = this.getAuthHeaders();
      // Assuming a categories endpoint exists at /categories/
      const url = `${this.apiUrl}/categories/`;

      return this.http.get<Category[]>(url, { headers }).pipe(
          tap(response => console.log('Fetched categories:', response)),
          catchError(error => {
              console.error('Error fetching categories:', error);
              return throwError(() => error);
          })
      );
  }
}
