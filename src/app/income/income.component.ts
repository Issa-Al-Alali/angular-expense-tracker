import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, IncomeData, ErrorResponse } from '../auth.service'; // Import AuthService, IncomeData, ErrorResponse
import { catchError } from 'rxjs/operators'; // Import catchError
import { of } from 'rxjs'; // Import 'of' to return an observable in case of error

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // Import necessary modules
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.css'] // Link to the CSS file
})
export class IncomeComponent implements OnInit {

  incomeForm!: FormGroup; // Declare the form group
  currentIncome: IncomeData | null = null; // To store fetched income data
  isLoading = false; // To manage loading state
  apiErrors: ErrorResponse | null = null; // To store errors from API (for update)
  fetchError: string | null = null; // To store errors during data fetching
  updateSuccessMessage: string | null = null; // To show success message after update

  constructor(
    private fb: FormBuilder, // Inject FormBuilder
    private authService: AuthService // Inject AuthService
  ) { }

  ngOnInit(): void {
    // Initialize the update form
    this.incomeForm = this.fb.group({
      budget_amount: ['', [Validators.required, Validators.min(0)]] // Budget amount is required and must be non-negative
    });

    // Fetch current income data when the component initializes
    this.fetchIncome();
  }

  /**
   * Fetches the current income data from the backend.
   */
  fetchIncome(): void {
    this.isLoading = true;
    this.fetchError = null; // Clear previous fetch errors
    this.apiErrors = null; // Clear update errors
    this.updateSuccessMessage = null; // Clear success message

    this.authService.getIncome().pipe(
      catchError(error => {
        // Handle error during fetching
        this.fetchError = error.message || 'Failed to fetch income data.';
        this.isLoading = false;
        this.currentIncome = null; // Clear income data on error
        console.error('Fetch income error:', error);
        return of(null); // Return an observable of null to continue the stream
      })
    )
    .subscribe(data => {
      if (data) {
        this.currentIncome = data;
        // Populate the form with the fetched budget amount
        // Convert string budget_amount from API to number for the form
        this.incomeForm.patchValue({ budget_amount: parseFloat(data.budget_amount) });
      }
      this.isLoading = false;
    });
  }

  /**
   * Handles the income update form submission.
   * Sends the new budget amount to the backend API.
   */
  onSubmit(): void {
    if (this.incomeForm.valid) {
      this.isLoading = true;
      this.apiErrors = null; // Clear previous update errors
      this.fetchError = null; // Clear fetch errors
      this.updateSuccessMessage = null; // Clear success message

      // Get the budget amount from the form
      const budgetAmount = this.incomeForm.value.budget_amount;

      console.log('Attempting to update income with amount:', budgetAmount);

      // Call the updateIncome method from the AuthService
      this.authService.updateIncome(budgetAmount).pipe(
        catchError(error => {
          // Handle update errors
          this.isLoading = false;
          this.updateSuccessMessage = null; // Clear success message on error

          console.error('Update income failed', error);

          // Check if the error response has the expected format
          if (error.error && typeof error.error === 'object') {
             this.apiErrors = error.error as ErrorResponse; // Store API errors
             // If there are non-field errors, display them as a general message
             if (this.apiErrors.non_field_errors) {
                 this.fetchError = this.apiErrors.non_field_errors.join(', ');
             }
          } else {
             // Handle unexpected error formats
             this.fetchError = 'An unexpected error occurred during update. Please try again.';
          }
          return of(null); // Return an observable of null to continue the stream
        })
      )
      .subscribe(updatedIncome => {
        if (updatedIncome) {
          this.currentIncome = updatedIncome; // Update displayed income with the response
          // No need to patch form value again, as it already holds the submitted value
          this.updateSuccessMessage = 'Income updated successfully!';
          console.log('Income update successful', updatedIncome);
        }
        this.isLoading = false;
      });
    } else {
      // Mark all form controls as touched to display validation errors
      this.incomeForm.markAllAsTouched();
      console.log('Income form is invalid, not submitting.');
    }
  }
}
