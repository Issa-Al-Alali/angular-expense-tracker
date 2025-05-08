import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for directives like *ngIf, *ngFor
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms'; // Import ReactiveFormsModule
import { AuthService, ErrorResponse } from '../auth.service'; // Import the AuthService and ErrorResponse interface (ErrorResponse is now exported)
import { Router, RouterModule } from '@angular/router'; // Import Router and RouterModule for navigation

// Custom validator function for checking if passwords match
export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirm_password');

  // Return null if controls are not initialized or passwords match
  // Return { passwordMismatch: true } if passwords exist and don't match
  return password && confirmPassword && password.value !== confirmPassword.value ? { passwordMismatch: true } : null;
};


@Component({
  selector: 'app-registration',
  standalone: true, // Mark the component as standalone
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Import necessary modules for standalone components
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css'] // Link to the separate CSS file
})
export class RegistrationComponent implements OnInit {

  registrationForm!: FormGroup; // Declare the form group
  apiErrors: ErrorResponse | null = null; // To store errors from the API
  isLoading = false; // To manage button loading state

  constructor(
    private fb: FormBuilder, // Inject FormBuilder for creating forms
    private authService: AuthService, // Inject the AuthService
    private router: Router // Inject Router for navigation
  ) { }

  ngOnInit(): void {
    // Initialize the form with form controls and validators
    this.registrationForm = this.fb.group({
      username: ['', Validators.required], // Username is required
      email: ['', [Validators.required, Validators.email]], // Email is required and must be a valid email
      password: ['', [Validators.required, Validators.minLength(8)]], // Password is required and min length 8
      confirm_password: ['', Validators.required] // Confirm password is required
    }, { validators: passwordMatchValidator }); // Add the custom password match validator to the form group
  }

  /**
   * Handles the form submission.
   * Sends registration data to the backend API.
   */
  onSubmit(): void {
    // Check if the form is valid before submitting
    if (this.registrationForm.valid) {
      this.isLoading = true; // Set loading state to true
      this.apiErrors = null; // Clear previous errors

      // Extract data from the form, excluding confirm_password for the API call
      const { username, email, password } = this.registrationForm.value;
      const userData = { username, email, password };

      console.log('Attempting registration with data:', userData); // Log data being sent

      // Call the register method from the AuthService
      this.authService.register(userData).subscribe({
        next: (response) => {
          // Handle successful registration
          console.log('Registration successful', response);
          // Redirect to the login page on success
          this.router.navigate(['/login']); // Navigate using the Angular Router
          this.isLoading = false; // Set loading state to false
        },
        error: (error) => {
          // Handle registration errors
          console.error('Registration failed', error); // Log the full error object
          this.isLoading = false; // Set loading state to false

          // Check if the error response has the expected format
          if (error.error && typeof error.error === 'object') {
             this.apiErrors = error.error as ErrorResponse; // Store API errors to display in the template
          } else {
             // Handle unexpected error formats
             this.apiErrors = { non_field_errors: ['An unexpected error occurred. Please try again.'] };
          }
        }
      });
    } else {
      // Mark all form controls as touched to display validation errors
      this.registrationForm.markAllAsTouched();
      console.log('Form is invalid, not submitting.'); // Log if form is invalid
    }
  }
}
