import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Import ActivatedRoute and Router
// Corrected import: Import ErrorResponse from '../auth.service'
import { ExpenseService, Expense, Category, ExpenseSummary } from '../expense.service'; // Import ExpenseService and interfaces
import { AuthService, IncomeData, ErrorResponse } from '../auth.service'; // Import AuthService, IncomeData, and ErrorResponse
import { Observable, Subscription, combineLatest, of, throwError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { Chart, ChartConfiguration, ChartOptions, ChartType } from 'chart.js'; // Import Chart.js types
// Import jsPDF and jspdf-autotable
import jsPDF from 'jspdf'; // Import jsPDF directly
import 'jspdf-autotable';
declare const bootstrap: any; // Assuming Bootstrap JS is loaded globally

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Import necessary modules
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css'] // Link to the CSS file
})
export class ExpensesComponent implements OnInit, OnDestroy {

  // Forms
  filterForm!: FormGroup;
  addExpenseForm!: FormGroup;
  editExpenseForm!: FormGroup;

  // Data
  expenses: Expense[] = []; // Array to hold fetched expenses
  categories: Category[] = []; // Array to hold fetched categories
  currentIncome: IncomeData | null = null; // To store user's income for comparison

  // Loading/Error States
  isLoadingExpenses = false;
  isLoadingCategories = false;
  isLoadingChart = false;
  isAddingExpense = false;
  isUpdatingExpense = false;
  isDeletingExpense = false;
  fetchExpensesError: string | null = null;
  fetchCategoriesError: string | null = null;
  fetchChartError: string | null = null;
  addExpenseApiErrors: ErrorResponse | null = null; // For add modal
  editExpenseApiErrors: ErrorResponse | null = null; // For edit modal

  // Modals
  @ViewChild('addExpenseModal') addExpenseModal!: ElementRef;
  @ViewChild('editExpenseModal') editExpenseModal!: ElementRef;

  // Chart
  @ViewChild('expenseChart') expenseChartCanvas!: ElementRef<HTMLCanvasElement>;
  private expenseChart: Chart | undefined;
  currentChartType: 'monthly' | 'category' = 'monthly';

  // Subscriptions to manage memory leaks
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private expenseService: ExpenseService,
    private authService: AuthService, // Inject AuthService
    private route: ActivatedRoute, // Inject ActivatedRoute to read query params
    private router: Router // Inject Router for navigation/URL manipulation
  ) { }

  ngOnInit(): void {
    // Initialize forms
    this.filterForm = this.fb.group({
      year: ['', [Validators.pattern(/^\d{4}$/)]], // Optional year, validate format
      month: ['', [Validators.min(1), Validators.max(12)]], // Optional month, validate range
      category_name: [''], // Optional category name
      sort: [''] // Optional sort order
    });

    this.addExpenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]], // Amount required, min 0.01
      description: ['', Validators.required], // Description required
      expense_date: ['', Validators.required], // Date required
      location: [''], // Location optional
      category: ['', Validators.required], // Category ID required
      receipt: [null] // Receipt file (will handle separately)
    });

    this.editExpenseForm = this.fb.group({
      id: ['', Validators.required], // Expense ID (hidden)
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      expense_date: ['', Validators.required],
      location: [''],
      category: ['', Validators.required],
      // Receipt handling for edit is more complex (displaying existing, uploading new)
      // We'll handle this separately or simplify for now.
    });

    // Fetch categories and user income first, as they are needed for the forms and logic
    this.fetchCategories();
    this.fetchUserIncome();

    // Subscribe to route query parameters to update filters and fetch data
    const routeSubscription = this.route.queryParams.subscribe(params => {
      // Patch form values based on query params
      this.filterForm.patchValue({
        year: params['year'] || '',
        month: params['month'] || '',
        category_name: params['category_name'] || '',
        sort: params['sort'] || ''
      });

      // Fetch expenses and update chart based on the new filters
      this.fetchExpenses();
      // Determine the initial chart type based on active button or default
      const activeChartBtn = document.querySelector('.chart-type-btn.active');
      this.currentChartType = (activeChartBtn?.getAttribute('data-type') as 'monthly' | 'category') || 'monthly';
      this.fetchChartData(this.currentChartType);
    });
    this.subscriptions.push(routeSubscription);

     // Subscribe to filter form value changes to update the URL
     // Use debounceTime to avoid updating URL on every keystroke
     const filterFormSubscription = this.filterForm.valueChanges.pipe(
        debounceTime(500), // Wait for 500ms after the last change
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)) // Only emit if the value has actually changed
     ).subscribe(filters => {
        // Update URL query parameters without navigating
        const queryParams: any = {};
        if (filters.year) queryParams['year'] = filters.year;
        if (filters.month) queryParams['month'] = filters.month;
        if (filters.category_name) queryParams['category_name'] = filters.category_name;
        if (filters.sort) queryParams['sort'] = filters.sort;

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: queryParams,
            queryParamsHandling: 'merge', // Merge with existing query params
            replaceUrl: true // Replace the current URL state in history
        });
     });
     this.subscriptions.push(filterFormSubscription);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Destroy the chart instance
    if (this.expenseChart) {
      this.expenseChart.destroy();
    }
  }

  /**
   * Fetches the list of expense categories.
   */
  fetchCategories(): void {
    this.isLoadingCategories = true;
    this.fetchCategoriesError = null;

    this.expenseService.getCategories().pipe(
      catchError(error => {
        this.fetchCategoriesError = error.message || 'Failed to load categories.';
        this.isLoadingCategories = false;
        console.error('Fetch categories error:', error);
        return of([]); // Return an empty array observable on error
      })
    )
    .subscribe(categories => {
      this.categories = categories;
      this.isLoadingCategories = false;
    });
  }

  /**
   * Fetches the current user's income data.
   * Needed for the expense vs income comparison.
   */
  fetchUserIncome(): void {
      this.authService.getIncome().pipe(
          catchError(error => {
              console.error('Error fetching user income:', error);
              // Handle error, maybe set a default income or show a message
              this.currentIncome = null; // Ensure income is null on error
              return of(null); // Return observable of null
          })
      ).subscribe(income => {
          this.currentIncome = income;
      });
  }


  /**
   * Fetches the list of expenses based on current filters.
   */
  fetchExpenses(): void {
    this.isLoadingExpenses = true;
    this.fetchExpensesError = null;

    // Get current filter values from the form
    const filters = this.filterForm.value;

    this.expenseService.getExpenses(filters).pipe(
      catchError(error => {
        this.fetchExpensesError = error.message || 'Failed to load expenses.';
        this.isLoadingExpenses = false;
        console.error('Fetch expenses error:', error);
        return of([]); // Return an empty array observable on error
      })
    )
    .subscribe(expenses => {
      this.expenses = expenses;
      this.isLoadingExpenses = false;
    });
  }

  /**
   * Fetches data for the expense chart based on the selected type and filters.
   * @param type - The type of chart data to fetch ('monthly' or 'category').
   */
  fetchChartData(type: 'monthly' | 'category'): void {
      this.isLoadingChart = true;
      this.fetchChartError = null;

      const filters = this.filterForm.value;
      let chartDataObservable: Observable<ExpenseSummary>;

      if (type === 'monthly') {
          const year = filters.year;
          if (!year) {
              this.fetchChartError = 'Please select a year to view monthly expenses chart.';
              this.isLoadingChart = false;
              this.renderChart(type, { labels: [], data: [] }); // Render empty chart
              return;
          }
          chartDataObservable = this.expenseService.getMonthlySummary(year);
      } else { // 'category'
          // For category chart, use year and category_name filters if present
          chartDataObservable = this.expenseService.getCategorySummary({
              year: filters.year,
              category_name: filters.category_name
          });
      }

      chartDataObservable.pipe(
          catchError(error => {
              this.fetchChartError = error.message || `Failed to load ${type} chart data.`;
              this.isLoadingChart = false;
              console.error(`Fetch ${type} chart data error:`, error);
              this.renderChart(type, { labels: [], data: [] }); // Render empty chart on error
              return of(null); // Return observable of null
          })
      ).subscribe(data => {
          if (data) {
              this.renderChart(type, data);
          }
          this.isLoadingChart = false;
      });
  }


  /**
   * Renders or updates the Chart.js instance.
   * @param type - The type of chart ('bar' for now).
   * @param chartData - The data for the chart (labels and data array).
   */
  renderChart(type: 'monthly' | 'category', chartData: ExpenseSummary): void {
    if (!this.expenseChartCanvas) {
        console.error('Chart canvas element not found.');
        return;
    }

    const chartCtx = this.expenseChartCanvas.nativeElement.getContext('2d');
    if (!chartCtx) {
        console.error('Could not get 2D context for chart canvas.');
        return;
    }

    // Destroy existing chart if it exists
    if (this.expenseChart) {
      this.expenseChart.destroy();
    }

    // Determine background colors
    const backgroundColor = type === 'monthly'
        ? chartData.data.map(amount => {
             // Optional: Color bars based on expense vs income if income is available
             if (this.currentIncome && this.currentIncome.budget_amount) {
                 const incomeAmount = parseFloat(this.currentIncome.budget_amount);
                 return amount > incomeAmount ? 'rgba(255, 99, 132, 0.5)' : 'rgba(54, 162, 235, 0.5)'; // Red if over income, blue otherwise
             }
             return 'rgba(54, 162, 235, 0.5)'; // Default blue if income not available
          })
        : this.generateCategoryColors(chartData.labels.length, 0.5); // Generate colors for categories

     const borderColor = type === 'monthly'
        ? chartData.data.map(amount => {
             if (this.currentIncome && this.currentIncome.budget_amount) {
                 const incomeAmount = parseFloat(this.currentIncome.budget_amount);
                 return amount > incomeAmount ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'; // Red if over income, blue otherwise
             }
             return 'rgba(54, 162, 235, 1)'; // Default blue if income not available
          })
        : this.generateCategoryColors(chartData.labels.length, 1); // Generate colors for categories


    const chartConfig: ChartConfiguration = {
      type: 'bar', // Or 'pie' for category chart? Let's stick to 'bar' for now.
      data: {
        labels: chartData.labels,
        datasets: [{
          label: type === 'monthly' ? `Monthly Expenses for ${this.filterForm.value.year || ''}` : 'Expenses by Category',
          data: chartData.data,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: type === 'category' // Display legend for category chart
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return '$' + parseFloat(context.raw as any).toFixed(2); // Ensure correct type casting
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount ($)'
            },
            ticks: {
              callback: function(value) {
                return '$' + value;
              }
            }
          },
          x: {
            title: {
              display: true,
              text: type === 'monthly' ? 'Month' : 'Category'
            }
          }
        }
      }
    };

    // Create the new chart instance
    this.expenseChart = new Chart(chartCtx, chartConfig);
  }

  /**
   * Helper function to generate colors for categories.
   * @param count - Number of colors to generate.
   * @param alpha - The opacity level (0 to 1).
   * @returns An array of HSL colors.
   */
  generateCategoryColors(count: number, alpha: number): string[] {
      const colors = [];
      const hueStep = 360 / (count || 1); // Avoid division by zero
      for (let i = 0; i < count; i++) {
          const hue = i * hueStep;
          colors.push(`hsla(${hue}, 70%, 50%, ${alpha})`);
      }
      return colors;
  }


  /**
   * Handles the chart type button click.
   * @param type - The selected chart type ('monthly' or 'category').
   */
  onChartTypeChange(type: 'monthly' | 'category'): void {
      this.currentChartType = type;
      // Update active button class (handled in HTML with [class.active])
      this.fetchChartData(type); // Fetch and render chart data for the selected type
  }


  /**
   * Handles the filter form submission.
   * The actual filtering and URL update is handled by the filterForm.valueChanges subscription.
   * This method can be used for explicit submission if needed, but the reactive approach is better.
   */
  onFilterSubmit(): void {
      // The subscription to filterForm.valueChanges handles the logic.
      // We can add additional logic here if needed before the subscription triggers.
       console.log('Filter form submitted');
       // The subscription will trigger fetchExpenses and fetchChartData
  }

  /**
   * Handles the reset filters button click.
   */
  onResetFilters(): void {
    this.filterForm.reset({
      year: '',
      month: '',
      category_name: '',
      sort: ''
    });
    // The filterForm.valueChanges subscription will handle refetching data and updating URL
  }

  /**
   * Handles the add expense form submission.
   */
  onAddExpenseSubmit(): void {
    if (this.addExpenseForm.valid) {
      this.isAddingExpense = true;
      this.addExpenseApiErrors = null;

      const formData = this.addExpenseForm.value;
      const receiptFile: File | null = formData.receipt; // Get the file object

      // Remove the file from the form value before sending JSON data (if no file)
      delete formData.receipt;

      // Get the category name from the selected category ID
      const selectedCategory = this.categories.find(cat => cat.id === formData.category);
      if (!selectedCategory) {
          console.error('Selected category not found.');
          this.addExpenseApiErrors = { non_field_errors: ['Invalid category selected.'] };
          this.isAddingExpense = false;
          return;
      }
      const categoryName = selectedCategory.name;

      // Check if the expense exceeds the income (if income data is available)
      if (this.currentIncome && this.currentIncome.budget_amount) {
          const incomeAmount = parseFloat(this.currentIncome.budget_amount);
          if (formData.amount > incomeAmount) {
              if (!confirm('The expense exceeds your income. Are you sure you want to add this expense?')) {
                  this.isAddingExpense = false;
                  return; // Cancel the submission
              }
          }
      }


      // Pass categoryName to the service call as per API example URL structure
      this.expenseService.addExpense({
          amount: formData.amount,
          description: formData.description,
          expense_date: formData.expense_date,
          location: formData.location,
          category: formData.category // Send category ID in the body
      }, receiptFile || undefined).subscribe({
        next: (response) => {
          console.log('Expense added successfully', response);
          // Close the modal
          this.closeModal(this.addExpenseModal);
          // Refresh the expense list and chart
          this.fetchExpenses();
          this.fetchChartData(this.currentChartType);
          this.addExpenseForm.reset(); // Reset the form
          this.addExpenseForm.get('receipt')?.setValue(null); // Clear file input separately
          // Show a success message (optional, could use a message service)
          // alert('Expense added successfully!'); // Using alert for simplicity
        },
        error: (error) => {
          console.error('Error adding expense:', error);
          this.isAddingExpense = false;
          // Display API errors
          if (error.error && typeof error.error === 'object') {
             this.addExpenseApiErrors = error.error as ErrorResponse;
          } else {
             this.addExpenseApiErrors = { non_field_errors: ['An unexpected error occurred while adding expense.'] };
          }
        }
      });
    } else {
      this.addExpenseForm.markAllAsTouched();
      console.log('Add expense form is invalid.');
    }
  }

  /**
   * Handles file selection for the receipt input.
   * @param event - The input change event.
   */
  onReceiptFileSelect(event: any): void {
      const file = event.target.files.length > 0 ? event.target.files[0] : null;
      this.addExpenseForm.patchValue({
          receipt: file // Store the file object in the form control
      });
      // You might want to display the selected file name to the user
      console.log('Selected file:', file?.name);
  }


  /**
   * Opens the add expense modal.
   */
  openAddExpenseModal(): void {
      // Reset the form when opening the modal
      this.addExpenseForm.reset();
      this.addExpenseApiErrors = null; // Clear previous errors
      this.addExpenseForm.get('receipt')?.setValue(null); // Clear file input value

      // Use Bootstrap's modal functionality
      const modalElement = this.addExpenseModal.nativeElement;
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
  }

  /**
   * Opens the edit expense modal and populates it with expense data.
   * @param expense - The expense object to edit.
   */
  openEditExpenseModal(expense: Expense): void {
      this.editExpenseApiErrors = null; // Clear previous errors
      this.editExpenseForm.patchValue({
          id: expense.id,
          amount: parseFloat(expense.amount), // Convert string to number
          description: expense.description,
          expense_date: expense.expense_date,
          location: expense.location,
          category: expense.category // Use category ID
      });

      // Handle receipt display/upload for edit modal if needed

      // Use Bootstrap's modal functionality
      const modalElement = this.editExpenseModal.nativeElement;
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
  }

  /**
   * Handles the edit expense form submission.
   */
  onEditExpenseSubmit(): void {
    if (this.editExpenseForm.valid) {
      this.isUpdatingExpense = true;
      this.editExpenseApiErrors = null;

      const formData = this.editExpenseForm.value;
      const expenseId = formData.id;

      // Check if the expense exceeds the income (if income data is available)
      if (this.currentIncome && this.currentIncome.budget_amount) {
          const incomeAmount = parseFloat(this.currentIncome.budget_amount);
          if (formData.amount > incomeAmount) {
              if (!confirm('The expense exceeds your income. Are you sure you want to update this expense?')) {
                  this.isUpdatingExpense = false;
                  return; // Cancel the submission
              }
          }
      }

      // Prepare update data (excluding id)
      const updateData = {
          amount: formData.amount,
          description: formData.description,
          expense_date: formData.expense_date,
          location: formData.location,
          category: formData.category // Send category ID
      };

      this.expenseService.updateExpense(expenseId, updateData).subscribe({
        next: (response) => {
          console.log('Expense updated successfully', response);
          // Close the modal
          this.closeModal(this.editExpenseModal);
          // Refresh the expense list and chart
          this.fetchExpenses();
          this.fetchChartData(this.currentChartType);
          // Show a success message (optional)
          // alert('Expense updated successfully!');
        },
        error: (error) => {
          console.error('Error updating expense:', error);
          this.isUpdatingExpense = false;
          // Display API errors
          if (error.error && typeof error.error === 'object') {
             this.editExpenseApiErrors = error.error as ErrorResponse;
          } else {
             this.editExpenseApiErrors = { non_field_errors: ['An unexpected error occurred while updating expense.'] };
          }
        }
      });
    } else {
      this.editExpenseForm.markAllAsTouched();
      console.log('Edit expense form is invalid.');
    }
  }

  /**
   * Handles the delete expense button click.
   * @param expenseId - The ID of the expense to delete.
   */
  onDeleteExpense(expenseId: string): void {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.isDeletingExpense = true;
      this.expenseService.deleteExpense(expenseId).subscribe({
        next: (response) => {
          console.log('Expense deleted successfully', response);
          // Refresh the expense list and chart
          this.fetchExpenses();
          this.fetchChartData(this.currentChartType);
          this.isDeletingExpense = false;
          // Show a success message (optional)
          // alert('Expense deleted successfully!');
        },
        error: (error) => {
          console.error('Error deleting expense:', error);
          this.isDeletingExpense = false;
          // Show an error message (optional)
          let errorMessage = 'Failed to delete expense.';
          if (error.error && error.error.detail) {
              errorMessage = error.error.detail;
          } else if (error.message) {
              errorMessage = error.message;
          }
          alert('Error: ' + errorMessage);
        }
      });
    }
  }

  /**
   * Opens the PDF receipt in a new tab or modal.
   * @param receiptUrl - The URL of the receipt PDF.
   */
  viewReceipt(receiptUrl: string | null): void {
      if (receiptUrl) {
          // Assuming the receipt URL is relative to your media root
          // You might need to prepend your backend's base URL if it's different
          const fullUrl = `http://localhost:8000${receiptUrl}`; // Adjust if needed
          window.open(fullUrl, '_blank'); // Open in a new tab
          // Or implement modal display with iframe as in the original JS
      } else {
          alert('No receipt available for this expense.');
      }
  }

  /**
   * Generates and downloads a yearly expense summary PDF.
   */
  downloadYearlyPDF(): void {
      const year = this.filterForm.value.year;
      if (!year || !/^\d{4}$/.test(year)) {
          alert('Please enter a valid 4-digit year in the filter to generate the yearly summary.');
          return;
      }

      // Check if jsPDF and autoTable are loaded
      if (typeof jsPDF === 'undefined' || typeof (jsPDF.prototype as any).autoTable !== 'function') {
          console.error('jsPDF or AutoTable plugin not properly loaded.');
          alert('PDF generation failed: Required libraries not loaded.');
          return;
      }

      // Show loading indicator on the button (requires getting the button element)
      // This is harder in Angular without direct DOM manipulation or a specific directive.
      // For simplicity, we'll just show an alert or a global loading indicator.
      alert('Generating PDF...'); // Simple indicator

      this.expenseService.getMonthlySummary(year).subscribe({
          next: (expenseData) => {
              try {
                  const doc = new jsPDF();
                  // Use the user's income from the component property
                  const monthlyIncome = this.currentIncome ? parseFloat(this.currentIncome.budget_amount) : 0;

                  const monthlyData: { month: string; income: string; spending: string; remaining: string; isNegative: boolean }[] = [];
                  let totalSpending = 0;

                  if (!expenseData.labels || !expenseData.data || expenseData.labels.length === 0) {
                     throw new Error('No expense data available for the selected year');
                  }

                  for (let i = 0; i < expenseData.labels.length; i++) {
                      const monthName = expenseData.labels[i];
                      const spending = expenseData.data[i];
                      totalSpending += spending;
                      const remaining = monthlyIncome - spending;

                      monthlyData.push({
                          month: monthName,
                          income: monthlyIncome.toFixed(2),
                          spending: spending.toFixed(2),
                          remaining: remaining.toFixed(2),
                          isNegative: remaining < 0
                      });
                  }

                  const yearlyIncome = monthlyIncome * 12;
                  const yearlyRemaining = yearlyIncome - totalSpending;
                  const isYearlyPositive = yearlyRemaining >= 0;

                  doc.setFontSize(18);
                  doc.text(`Yearly Expense Summary - ${year}`, 14, 22);

                  doc.setFontSize(12);
                  doc.text('Monthly Breakdown:', 14, 35);

                  (doc as any).autoTable({
                      startY: 40,
                      head: [['Month', 'Income', 'Spending', 'Remaining']],
                      body: monthlyData.map(row => [
                          row.month,
                          `$${row.income}`,
                          `$${row.spending}`,
                          `$${row.remaining}`
                      ]),
                      theme: 'striped',
                      headStyles: { fillColor: [66, 139, 202] },
                      bodyStyles: { fontSize: 10 },
                      columnStyles: {
                          3: { cellWidth: 'auto' }
                      },
                      didParseCell: function(data: any) { // Use 'any' for data parameter type
                          if (data.row.index >= 0 && data.column.index === 3) {
                              const rowData = monthlyData[data.row.index];
                              if (rowData.isNegative) {
                                  data.cell.styles = data.cell.styles || {};
                                  data.cell.styles.textColor = [255, 0, 0];
                                  data.cell.styles.fontStyle = 'bold';
                                  data.cell.styles.fillColor = [255, 230, 230];
                              }
                          }
                      }
                  });

                  const finalY = (doc as any).lastAutoTable.finalY + 20;
                  doc.setFontSize(14);
                  doc.text('Yearly Summary:', 14, finalY);

                  (doc as any).autoTable({
                      startY: finalY + 5,
                      head: [['Total Income', 'Total Spending', 'Total Remaining']],
                      body: [[
                          `$${yearlyIncome.toFixed(2)}`,
                          `$${totalSpending.toFixed(2)}`,
                          `$${yearlyRemaining.toFixed(2)}`
                      ]],
                      theme: 'grid',
                      headStyles: { fillColor: [92, 184, 92] },
                      didParseCell: function(data: any) { // Use 'any' for data parameter type
                          if (data.column.index === 2 && !isYearlyPositive) {
                              data.cell.styles = data.cell.styles || {};
                              data.cell.styles.fontStyle = 'bold';
                              data.cell.styles.textColor = [255, 0, 0];
                              data.cell.styles.fillColor = [255, 200, 200];
                          }
                      }
                  });

                  const feedbackY = (doc as any).lastAutoTable.finalY + 15;
                  doc.setFontSize(12);

                  if (isYearlyPositive) {
                      doc.setTextColor(0, 128, 0);
                      doc.setFont('helvetica', 'bold');
                      doc.text('GREAT JOB!', 14, feedbackY);
                      doc.setFont('helvetica', 'normal');
                      doc.text(`You saved $${yearlyRemaining.toFixed(2)} this year. Keep up the excellent financial management!`, 14, feedbackY + 7);
                      doc.text('Consider investing your savings or building your emergency fund.', 14, feedbackY + 14);
                  } else {
                      doc.setTextColor(192, 0, 0);
                      doc.setFont('helvetica', 'bold');
                      doc.text('ATTENTION!', 14, feedbackY);
                      doc.setFont('helvetica', 'normal');
                      doc.text(`You've overspent by $${Math.abs(yearlyRemaining).toFixed(2)} this year.`, 14, feedbackY + 7);
                      doc.text('Consider reviewing your expenses and creating a budget to avoid debt.', 14, feedbackY + 14);
                      doc.text('Focus on reducing non-essential spending and increasing your income if possible.', 14, feedbackY + 21);
                  }

                  doc.setTextColor(0);

                  const today = new Date();
                  doc.setFontSize(10);
                  doc.setTextColor(100);
                  doc.text(`Generated on: ${today.toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);

                  doc.save(`Expense_Summary_${year}.pdf`);

              } catch (error: any) { // Use 'any' for error type
                  console.error('Error generating PDF:', error);
                  alert('Error generating PDF: ' + error.message);
              } finally {
                  // Reset button state (if you implement button loading)
              }
          },
          error: (error) => {
              console.error('Error fetching data for PDF:', error);
              alert('Could not generate PDF: Error fetching expense data');
              // Reset button state
          }
      });
  }


  /**
   * Helper function to close a Bootstrap modal.
   * @param modalElementRef - ElementRef of the modal div.
   */
  private closeModal(modalElementRef: ElementRef): void {
      const modalElement = modalElementRef.nativeElement;
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
          modal.hide();
      }
  }
}
