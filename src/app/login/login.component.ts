import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, ErrorResponse } from '../auth.service'; // Import AuthService and ErrorResponse
import { Router, RouterModule } from '@angular/router'; // Import Router and RouterModule

@Component({
  selector: 'app-login',
  standalone: true, // Mark as standalone
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Import necessary modules
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'] // Link to the CSS file
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup; // Declare the form group
  apiErrors: ErrorResponse | null = null; // To store errors from the API
  isLoading = false; // To manage button loading state

  constructor(
    private fb: FormBuilder, // Inject FormBuilder
    private authService: AuthService, // Inject AuthService
    private router: Router // Inject Router
  ) { }

  ngOnInit(): void {
    // Initialize the login form with validators
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]], // Email is required and must be valid
      password: ['', Validators.required] // Password is required
    });
  }

  /**
   * Handles the login form submission.
   * Sends login credentials to the backend API.
   */
  onSubmit(): void {
    // Check if the form is valid
    if (this.loginForm.valid) {
      this.isLoading = true; // Set loading state
      this.apiErrors = null; // Clear previous errors

      // Extract email and password from the form
      const { email, password } = this.loginForm.value;
      const credentials = { email, password };

      console.log('Attempting login with credentials:', credentials); // Log credentials being sent

      // Call the login method from the AuthService
      this.authService.login(credentials).subscribe({
        next: (response) => {
          // Handle successful login
          console.log('Login successful', response);
          // Redirect to the dashboard or another protected page
          this.router.navigate(['/dashboard']); // You will need to create a DashboardComponent and route later
          this.isLoading = false; // Reset loading state
        },
        error: (error) => {
          // Handle login errors
          console.error('Login failed', error); // Log the full error object
          this.isLoading = false; // Reset loading state

          // Check if the error response has the expected format
          if (error.error && typeof error.error === 'object') {
             this.apiErrors = error.error as ErrorResponse; // Store API errors
          } else {
             // Handle unexpected error formats
             this.apiErrors = { non_field_errors: ['Invalid email or password. Please try again.'] };
          }
        }
      });
    } else {
      // Mark all form controls as touched to display validation errors
      this.loginForm.markAllAsTouched();
      console.log('Login form is invalid, not submitting.'); // Log if form is invalid
    }
  }
}
