import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService, User } from '../user.service'; // Import the UserService and User interface
import { Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'] // We'll put the CSS here
})
export class ProfileComponent implements OnInit {

  user: User | null = null;
  isLoadingProfile = false;
  fetchProfileError: string | null = null;

  profilePictureForm!: FormGroup;
  selectedFile: File | null = null;
  isUploadingPicture = false;
  uploadPictureError: string | null = null;
  uploadPictureSuccess: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService // Inject the UserService
  ) { }

  ngOnInit(): void {
    // Initialize the profile picture form
    this.profilePictureForm = this.fb.group({
      profile_picture: [null, Validators.required] // File input
    });

    // Fetch the user's profile data when the component initializes
    this.fetchUserProfile();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Fetches the authenticated user's profile.
   */
  fetchUserProfile(): void {
    this.isLoadingProfile = true;
    this.fetchProfileError = null;

    const profileSubscription = this.userService.getUserProfile().pipe(
      catchError(error => {
        this.fetchProfileError = error.message || 'Failed to load user profile.';
        this.isLoadingProfile = false;
        console.error('Error fetching user profile:', error);
        this.user = null; // Clear user data on error
        return of(null);
      })
    ).subscribe(user => {
      this.user = user;
      this.isLoadingProfile = false;
    });
    this.subscriptions.push(profileSubscription);
  }

  /**
   * Handles the file selection for the profile picture.
   * @param event - The file input change event.
   */
  onFileSelect(event: any): void {
    const file = event.target.files.length > 0 ? event.target.files[0] : null;
    this.selectedFile = file;
    // Patch the form control value with the selected file
    this.profilePictureForm.patchValue({
      profile_picture: file
    });
    // Update validity for the file input
    this.profilePictureForm.get('profile_picture')?.updateValueAndValidity();
    console.log('Selected file:', this.selectedFile?.name);
  }

  /**
   * Handles the profile picture form submission.
   */
  onProfilePictureSubmit(): void {
    if (this.profilePictureForm.valid && this.selectedFile) {
      this.isUploadingPicture = true;
      this.uploadPictureError = null;
      this.uploadPictureSuccess = null;

      const uploadSubscription = this.userService.updateProfilePicture(this.selectedFile).subscribe({
        next: (updatedUser: User) => {
          console.log('Profile picture updated successfully', updatedUser);
          this.user = updatedUser; // Update the displayed user data
          this.isUploadingPicture = false;
          this.uploadPictureSuccess = 'Profile picture updated successfully!';
          // Optionally reset the form after successful upload
          this.profilePictureForm.reset();
          this.selectedFile = null;
        },
        error: (error) => {
          console.error('Error uploading profile picture:', error);
          this.isUploadingPicture = false;
          this.uploadPictureError = error.message || 'Failed to upload profile picture.';
          this.uploadPictureSuccess = null;
        }
      });
      this.subscriptions.push(uploadSubscription);
    } else {
      this.profilePictureForm.markAllAsTouched();
      console.log('Profile picture form is invalid or no file selected.');
    }
  }
}
