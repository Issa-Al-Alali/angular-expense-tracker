import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VideoService, Video, VideoApiResponse } from '../video.service';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './videos.component.html',
  styleUrls: ['./videos.component.css'] // We'll put the CSS here
})
export class VideosComponent implements OnInit, OnDestroy {

  videos: Video[] = [];
  isLoadingVideos = false;
  fetchVideosError: string | null = null;
  searchForm!: FormGroup;
  searchQuery: string = '';

  // Pagination properties
  currentPage = 1;
  totalPages = 1;
  count = 0; // Total number of videos
  pageSize = 6; // Assuming 6 videos per page based on your HTML layout

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private videoService: VideoService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Initialize the search form
    this.searchForm = this.fb.group({
      search: ['']
    });

    // Subscribe to route query parameters for initial load and changes
    const routeSubscription = this.route.queryParams.subscribe(params => {
      this.currentPage = +params['page'] || 1; // Get page number from query params, default to 1
      this.searchQuery = params['search'] || ''; // Get search query from query params

      // Patch the search form value
      this.searchForm.patchValue({ search: this.searchQuery }, { emitEvent: false }); // Avoid triggering valueChanges subscription immediately

      this.fetchVideos(); // Fetch videos based on current query params
    });
    this.subscriptions.push(routeSubscription);

    // Subscribe to search form value changes for live search (with debounce)
    // This will trigger a new search as the user types, after a short delay.
    const searchFormSubscription = this.searchForm.get('search')?.valueChanges.pipe(
      debounceTime(500), // Wait 500ms after the last keystroke
      distinctUntilChanged() // Only emit if the value has changed
    ).subscribe(searchValue => {
      // Update the URL with the new search query and reset page to 1
      console.log('Search input changed:', searchValue); // Added log
      this.updateUrl({ search: searchValue || '', page: 1 });
    });
    if (searchFormSubscription) {
        this.subscriptions.push(searchFormSubscription);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Fetches videos from the service based on current page and search query.
   */
  fetchVideos(): void {
    this.isLoadingVideos = true;
    this.fetchVideosError = null;

    this.videoService.getVideos(this.currentPage, this.searchQuery).subscribe({
      next: (response: VideoApiResponse) => {
        this.videos = response.results;
        this.count = response.count;
        // Calculate total pages (handle case where count is 0)
        this.totalPages = this.count > 0 ? Math.ceil(this.count / this.pageSize) : 1;
        this.isLoadingVideos = false;
        console.log('Videos fetched:', this.videos);
        console.log('Pagination Info:', { count: this.count, currentPage: this.currentPage, totalPages: this.totalPages });
      },
      error: (error) => {
        this.fetchVideosError = error.message || 'Failed to load videos.';
        this.isLoadingVideos = false;
        console.error('Error fetching videos:', error);
        this.videos = []; // Clear videos on error
        this.count = 0;
        this.totalPages = 1;
      }
    });
  }

  /**
   * Handles the search form submission.
   * Updates the URL with the current search term and resets the page to 1.
   */
  onSearchSubmit(): void {
      console.log('Search form submitted.'); // Added log
      const searchValue = this.searchForm.get('search')?.value || '';
      this.updateUrl({ search: searchValue, page: 1 });
  }


  /**
   * Updates the URL with new query parameters.
   * @param params - An object containing the query parameters to update.
   */
  updateUrl(params: any): void {
    console.log('Updating URL with params:', params); // Added log
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // Merge new params with existing ones
      replaceUrl: true // Replace the current URL in history
    });
  }

  /**
   * Handles page change.
   * @param page - The page number to navigate to.
   */
  goToPage(page: number): void {
    console.log('Going to page:', page); // Added log
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.updateUrl({ page: page });
    }
  }

  /**
   * Generates an array of page numbers to display in the pagination.
   * @returns An array of page numbers.
   */
  get pageNumbers(): number[] {
      const pageRange = [];
      // Adjust the range to show a few pages around the current page
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(this.totalPages, this.currentPage + 2);

      for (let i = start; i <= end; i++) {
          pageRange.push(i);
      }
      return pageRange;
  }

  // Helper getters for pagination navigation
  get hasPreviousPage(): boolean {
      return this.currentPage > 1;
  }

  get hasNextPage(): boolean {
      return this.currentPage < this.totalPages;
  }

  get previousPageNumber(): number {
      return this.currentPage - 1;
  }

  get nextPageNumber(): number {
      return this.currentPage + 1;
  }

  get firstPageNumber(): number {
      return 1;
  }

  get lastPageNumber(): number {
      return this.totalPages;
  }
}
