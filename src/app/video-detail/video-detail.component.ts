import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription, switchMap, Observable } from 'rxjs'; // switchMap to handle route param changes
import { VideoService, Video, Comment, Review } from '../video.service';
import { AuthService } from '../auth.service'; // Assuming AuthService provides user info

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Include ReactiveFormsModule for forms
  templateUrl: './video-detail.component.html',
  styleUrls: ['./video-detail.component.css'] // We'll create this CSS
})
export class VideoDetailComponent implements OnInit, OnDestroy {
  video: Video | null = null;
  isLoading = true;
  error: string | null = null;
  private routeSubscription: Subscription | undefined;

  // Forms for interaction
  commentForm!: FormGroup;
  reviewForm!: FormGroup;

  // State for UI elements
  showAddCommentForm = false;
  showAddOrEditReviewForm = false;
  editingCommentId: string | null = null; // Track which comment is being edited

  // Assuming user is logged in to interact
  isAuthenticated = false;
  currentUserId: number | null = null; // To check comment ownership

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private fb: FormBuilder,
    private authService: AuthService // Assuming AuthService is available
  ) { }

  ngOnInit(): void {
    // Check authentication status and get user ID on init
    // Replace with actual checks from your AuthService
    // Example: this.isAuthenticated = this.authService.isAuthenticated();
    // Example: this.currentUserId = this.authService.getUserId();
    this.isAuthenticated = this.authService.isAuthenticated(); // Implement this in AuthService
    const userId = this.authService.getUserId(); // Implement this in AuthService
    this.currentUserId = userId ? parseInt(userId, 10) : null; // Convert string to number or set to null


    // Initialize forms
    this.commentForm = this.fb.group({
      content: ['', Validators.required]
    });

    this.reviewForm = this.fb.group({
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]], // Default rating 5
      review_text: ['', Validators.required]
    });

    // Subscribe to route parameters to get the video ID
    this.routeSubscription = this.route.paramMap.pipe(
      switchMap(params => {
        const videoId = params.get('id');
        if (videoId) {
          this.isLoading = true;
          this.error = null;
          // Fetch video details using the new service method
          return this.videoService.getVideoDetails(videoId);
        } else {
          // Handle case where ID is missing (e.g., navigate away or show error)
          console.error('Video ID not provided in route.');
          this.error = 'Video ID not found.';
          this.isLoading = false;
          return new Observable<Video>(subscriber => subscriber.complete()); // Complete observable
        }
      })
    ).subscribe({
      next: (video) => {
        this.video = video;
        this.isLoading = false;
        console.log('Video details loaded:', this.video);

        // If the user has a review, pre-fill the review form
        if (this.video.user_review) {
          this.reviewForm.patchValue({
            rating: this.video.user_review.rating,
            review_text: this.video.user_review.review_text
          });
          this.showAddOrEditReviewForm = true; // Show the form if user has a review
        }
      },
      error: (err) => {
        console.error('Error loading video details:', err);
        this.error = err.message || 'Failed to load video details.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  // --- Like Functionality ---
  toggleLike(): void {
    if (!this.video || !this.isAuthenticated) {
      // Prompt user to log in if not authenticated
      alert('Please log in to like videos.'); // Replace with a proper login prompt
      return;
    }

    console.log('Attempting to toggle like for video:', this.video.id);
    this.videoService.toggleLike(this.video.id).subscribe({
    next: (response) => {
      // ... (logging)
      if (this.video) {
        this.video.liked = response.liked; // This line updates the property that ngClass watches
        this.video.likes_count = response.likes_count;
      }
    },
      error: (err) => {
        console.error('Error toggling like:', err);
        alert('Failed to toggle like. Please try again.'); // Show user feedback
      }
    });
  }

  // --- Comment Functionality ---
  onSubmitComment(): void {
    if (this.commentForm.invalid || !this.video || !this.isAuthenticated) {
      return; // Don't submit if form is invalid or not authenticated
    }

    const content = this.commentForm.value.content;

    if (this.editingCommentId) {
      // Update existing comment
      console.log('Attempting to update comment:', this.editingCommentId);
      this.videoService.updateComment(this.editingCommentId, content).subscribe({
        next: (updatedComment) => {
          console.log('Comment updated successfully', updatedComment);
          // Find and replace the updated comment in the video's comments array
          if (this.video?.comments) {
            const index = this.video.comments.findIndex(c => c.id === updatedComment.id);
            if (index !== -1) {
              this.video.comments[index] = updatedComment;
            }
          }
          this.cancelEditComment(); // Exit edit mode
        },
        error: (err) => {
          console.error('Error updating comment:', err);
          alert('Failed to update comment. Please try again.');
        }
      });
    } else {
      // Add new comment
      console.log('Attempting to add comment to video:', this.video.id);
      this.videoService.addComment(this.video.id, content).subscribe({
        next: (newComment) => {
          console.log('Comment added successfully', newComment);
          // Add the new comment to the video's comments array
          if (this.video?.comments) {
            this.video.comments.push(newComment);
          } else if (this.video) {
             this.video.comments = [newComment]; // Initialize if comments array was null/undefined
          }
          this.commentForm.reset(); // Clear the form
          this.showAddCommentForm = false; // Hide the form after adding
        },
        error: (err) => {
          console.error('Error adding comment:', err);
          alert('Failed to add comment. Please try again.');
        }
      });
    }
  }

  editComment(comment: Comment): void {
    if (!this.isCommentOwner(comment)) {
      alert('You can only edit your own comments.');
      return;
    }
    console.log('Editing comment:', comment.id);
    this.editingCommentId = comment.id;
    this.commentForm.patchValue({ content: comment.content });
    this.showAddCommentForm = true; // Show the form
  }

  cancelEditComment(): void {
    console.log('Cancelling comment edit.');
    this.editingCommentId = null;
    this.commentForm.reset();
    this.showAddCommentForm = false; // Hide the form
  }


  deleteComment(commentId: string): void {
     // Find the comment to check ownership before deleting
     const commentToDelete = this.video?.comments?.find(c => c.id === commentId);
     if (!commentToDelete || !this.isCommentOwner(commentToDelete)) {
         alert('You can only delete your own comments.');
         return;
     }

    if (confirm('Are you sure you want to delete this comment?')) {
      console.log('Attempting to delete comment:', commentId);
      this.videoService.deleteComment(commentId).subscribe({
        next: () => {
          console.log('Comment deleted successfully', commentId);
          // Remove the comment from the video's comments array
          if (this.video?.comments) {
            this.video.comments = this.video.comments.filter(c => c.id !== commentId);
          }
          // If the deleted comment was being edited, cancel editing
          if (this.editingCommentId === commentId) {
            this.cancelEditComment();
          }
        },
        error: (err) => {
          console.error('Error deleting comment:', err);
          alert('Failed to delete comment. Please try again.');
        }
      });
    }
  }

  // Helper to check if the current user owns a comment
  isCommentOwner(comment: Comment): boolean {
     // IMPORTANT: Ensure videoService.getCurrentUserId() is implemented
     // and that comment.user.id correctly represents the owner's ID from your API
    return this.isAuthenticated && this.currentUserId !== null && comment.user === this.currentUserId.toString();
  }


  // --- Review Functionality ---
  onSubmitReview(): void {
    if (this.reviewForm.invalid || !this.video || !this.isAuthenticated) {
      return; // Don't submit if form is invalid or not authenticated
    }

    const { rating, review_text } = this.reviewForm.value;

    console.log('Attempting to add/update review for video:', this.video.id);
    this.videoService.addOrUpdateReview(this.video.id, rating, review_text).subscribe({
      next: (responseReview) => {
        console.log('Review added/updated successfully', responseReview);
        // Update the video object with the new/updated user review
        if (this.video) {
           this.video.user_review = responseReview; // Store the current user's review
           // Also update the main reviews array if the API returns all reviews with detail
           // Or, if the API returns just the user's review, you might need to
           // find and replace it in the main reviews array if it exists.
           // Assuming API returns all reviews in the main 'reviews' array on detail fetch,
           // we need to update that array too, or refetch details.
           // For simplicity, let's try to update the array if the review exists.
           const existingReviewIndex = this.video.reviews?.findIndex(r => r.id === responseReview.id);
           if (this.video.reviews && existingReviewIndex !== undefined && existingReviewIndex !== -1) {
               this.video.reviews[existingReviewIndex] = responseReview;
           } else if (this.video.reviews) {
               // If it's a new review, add it to the list
               this.video.reviews.push(responseReview);
           } else {
               // Initialize reviews array if it was null/undefined
                this.video.reviews = [responseReview];
           }
        }
        this.showAddOrEditReviewForm = false; // Hide form after submission
      },
      error: (err) => {
        console.error('Error adding/updating review:', err);
        alert('Failed to add/update review. Please try again.');
      }
    });
  }

  // Helper to show/hide the add comment form
  toggleAddCommentForm(): void {
     if (!this.isAuthenticated) {
         alert('Please log in to add comments.');
         return;
     }
    this.showAddCommentForm = !this.showAddCommentForm;
    if (!this.showAddCommentForm) {
        this.cancelEditComment(); // Cancel edit mode if hiding the form
    }
  }

   // Helper to show/hide the add/edit review form
  toggleAddOrEditReviewForm(): void {
      if (!this.isAuthenticated) {
          alert('Please log in to add reviews.');
          return;
      }
      this.showAddOrEditReviewForm = !this.showAddOrEditReviewForm;
      // If hiding, reset form unless the user already has a review
       if (!this.showAddOrEditReviewForm && !this.video?.user_review) {
           this.reviewForm.reset({ rating: 5, review_text: '' }); // Reset only if no existing review
       } else if (!this.showAddOrEditReviewForm && this.video?.user_review) {
           // If hiding and user has review, reset to their existing review data
            this.reviewForm.patchValue({
                rating: this.video.user_review.rating,
                review_text: this.video.user_review.review_text
            });
       }
  }


  // Helper to get the total number of comments
  get commentCount(): number {
    return this.video?.comments?.length || 0;
  }

   // Helper to get the total number of reviews
  get reviewCount(): number {
    return this.video?.reviews?.length || 0;
  }

  // Helper to format video URL for embedding (basic example)
  get embedVideoUrl(): string | null {
      if (!this.video?.url) {
          return null;
      }
      // Assuming a simple YouTube URL format for embedding
      // You'll need to adjust this based on your actual video URLs
      if (this.video.url.includes('youtube.com/watch')) {
          const videoId = this.video.url.split('v=')[1]?.split('&')[0];
          return `https://www.youtube.com/embed/${videoId}`;
      }
       if (this.video.url.includes('youtu.be/')) {
          const videoId = this.video.url.split('youtu.be/')[1]?.split('?')[0];
           return `https://www.youtube.com/embed/${videoId}`;
      }
      // Add more embedding logic for other platforms if needed
      // Otherwise, return null or the original URL if it's a direct video file
      return null; // Or return this.video.url for <video> tag if it's a direct link
  }

}