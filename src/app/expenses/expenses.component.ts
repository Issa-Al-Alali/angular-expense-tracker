import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExpenseService, Expense, Category, ExpenseSummary } from '../expense.service';
import { AuthService, IncomeData, ErrorResponse } from '../auth.service';
import { Observable, Subscription, combineLatest, of, throwError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { Chart, ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
declare const jsPDF: any;
declare global {
  interface Window {
    jspdf: {
      jsPDF: typeof jsPDF;
    };
  }
}
declare const bootstrap: any;

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css']
})
export class ExpensesComponent implements OnInit, OnDestroy, AfterViewInit {

  // Forms
  filterForm!: FormGroup;
  addExpenseForm!: FormGroup;
  editExpenseForm!: FormGroup;

  // Data
  expenses: Expense[] = [];
  categories: Category[] = [];
  currentIncome: IncomeData | null = null;

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
  addExpenseApiErrors: ErrorResponse | null = null;
  editExpenseApiErrors: ErrorResponse | null = null;

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
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Initialize forms
    this.filterForm = this.fb.group({
      year: ['', [Validators.pattern(/^\d{4}$/)]],
      month: ['', [Validators.min(1), Validators.max(12)]],
      category_name: [''],
      sort: ['']
    });

    this.addExpenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      expense_date: ['', Validators.required],
      location: [''],
      category: ['', Validators.required],
      receipt: [null]
    });

    this.editExpenseForm = this.fb.group({
      id: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      expense_date: ['', Validators.required],
      location: [''],
      category: ['', Validators.required],
    });

    // Fetch categories and user income
    this.fetchCategories();
    this.fetchUserIncome();

    // Subscribe to route query parameters to update filters and fetch data
    // NOTE: We keep this subscription to initialize the form and data on first load
    // and when navigating to the page with existing query params.
    // Filter form changes will now trigger a full reload instead of just refetching data.
    const routeSubscription = this.route.queryParams.subscribe(params => {
      this.filterForm.patchValue({
        year: params['year'] || '',
        month: params['month'] || '',
        category_name: params['category_name'] || '',
        sort: params['sort'] || ''
      });

      this.fetchExpenses();
      const activeChartBtn = document.querySelector('.chart-type-btn.active');
      this.currentChartType = (activeChartBtn?.getAttribute('data-type') as 'monthly' | 'category') || 'monthly';
      this.fetchChartData(this.currentChartType);
    });
    this.subscriptions.push(routeSubscription);

     // *** REMOVED: Subscription to filterForm.valueChanges ***
     // This subscription is removed because filter changes will now trigger a full page reload
     // via the onFilterSubmit method, which is bound to the form's submit event.
  }

  ngAfterViewInit(): void {
    // Add listener to the edit modal hidden event for debugging
    const modalElement = this.editExpenseModal.nativeElement;
    modalElement.addEventListener('hidden.bs.modal', () => {
      console.log('Edit modal was hidden.');
    });
     console.log('ngAfterViewInit completed. Edit modal hidden listener attached.');
  }


  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.expenseChart) {
      this.expenseChart.destroy();
    }
  }

  fetchCategories(): void {
    this.isLoadingCategories = true;
    this.fetchCategoriesError = null;

    this.expenseService.getCategories().pipe(
      catchError(error => {
        this.fetchCategoriesError = error.message || 'Failed to load categories.';
        this.isLoadingCategories = false;
        console.error('Fetch categories error:', error);
        return of([]);
      })
    )
    .subscribe(categories => {
      this.categories = categories;
      this.isLoadingCategories = false;
    });
  }

  fetchUserIncome(): void {
      this.authService.getIncome().pipe(
          catchError(error => {
              console.error('Error fetching user income:', error);
              this.currentIncome = null;
              return of(null);
          })
      ).subscribe(income => {
          this.currentIncome = income;
      });
  }


  fetchExpenses(): void {
    this.isLoadingExpenses = true;
    this.fetchExpensesError = null;

    const filters = this.filterForm.value;

    this.expenseService.getExpenses(filters).pipe(
      catchError(error => {
        this.fetchExpensesError = error.message || 'Failed to load expenses.';
        this.isLoadingExpenses = false;
        console.error('Fetch expenses error:', error);
        return of([]);
      })
    )
    .subscribe(expenses => {
      console.log('Expenses fetched:', expenses);
      this.expenses = expenses;
      this.isLoadingExpenses = false;
    });
  }

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
              this.renderChart(type, { labels: [], data: [] });
              return;
          }
          chartDataObservable = this.expenseService.getMonthlySummary(year);
      } else { // 'category'
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
              this.renderChart(type, { labels: [], data: [] });
              return of(null);
          })
      ).subscribe(data => {
          if (data) {
              this.renderChart(type, data);
          }
          this.isLoadingChart = false;
      });
  }


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

    if (this.expenseChart) {
      this.expenseChart.destroy();
    }

    const backgroundColor = type === 'monthly'
        ? chartData.data.map(amount => {
             if (this.currentIncome && this.currentIncome.budget_amount) {
                 const incomeAmount = parseFloat(this.currentIncome.budget_amount);
                 return amount > incomeAmount ? 'rgba(255, 99, 132, 0.5)' : 'rgba(54, 162, 235, 0.5)';
             }
             return 'rgba(54, 162, 235, 0.5)';
          })
        : this.generateCategoryColors(chartData.labels.length, 0.5);

     const borderColor = type === 'monthly'
        ? chartData.data.map(amount => {
             if (this.currentIncome && this.currentIncome.budget_amount) {
                 const incomeAmount = parseFloat(this.currentIncome.budget_amount);
                 return amount > incomeAmount ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)';
             }
             return 'rgba(54, 162, 235, 1)';
          })
        : this.generateCategoryColors(chartData.labels.length, 1);


    const chartConfig: ChartConfiguration = {
      type: 'bar',
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
            display: type === 'category'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return '$' + parseFloat(context.raw as any).toFixed(2);
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

    this.expenseChart = new Chart(chartCtx, chartConfig);
  }

  generateCategoryColors(count: number, alpha: number): string[] {
      const colors = [];
      const hueStep = 360 / (count || 1);
      for (let i = 0; i < count; i++) {
          const hue = i * hueStep;
          colors.push(`hsla(${hue}, 70%, 50%, ${alpha})`);
      }
      return colors;
  }


  onChartTypeChange(type: 'monthly' | 'category'): void {
      this.currentChartType = type;
      this.fetchChartData(this.currentChartType); // Ensure this calls with updated type
  }


  /**
   * Handles the filter form submission.
   * Updates URL query parameters and triggers a full page reload.
   */
  onFilterSubmit(): void {
       console.log('Filter form submitted. Updating URL and refreshing.');
       const filters = this.filterForm.value;
       const queryParams: any = {};
       if (filters.year) queryParams['year'] = filters.year;
       if (filters.month) queryParams['month'] = filters.month;
       if (filters.category_name) queryParams['category_name'] = filters.category_name;
       if (filters.sort) queryParams['sort'] = filters.sort;

       // Construct the new URL with updated query parameters
       const urlTree = this.router.createUrlTree([], {
           relativeTo: this.route,
           queryParams: queryParams,
           queryParamsHandling: 'merge' // Merge with existing query params
       });

       // Navigate to the new URL, which will trigger a full page reload
       // by default when the route changes with different query parameters.
       // Alternatively, use window.location.reload() for a guaranteed full refresh.
       // Let's use window.location.href for a clear full page reload.
       window.location.href = this.router.serializeUrl(urlTree);
       // Or simply: window.location.reload();
  }

  /**
   * Handles the reset filters button click.
   * Resets the form and triggers a full page reload (to clear query params).
   */
  onResetFilters(): void {
    console.log('Reset filters clicked. Resetting form and refreshing.');
    this.filterForm.reset({
      year: '',
      month: '',
      category_name: '',
      sort: ''
    });
    // Trigger a full page reload to clear all query parameters from the URL
    window.location.href = this.router.url.split('?')[0]; // Navigate to base URL without query params
    // Or simply: window.location.reload();
  }

  onAddExpenseSubmit(): void {
    if (this.addExpenseForm.valid) {
      this.isAddingExpense = true;
      this.addExpenseApiErrors = null;

      const formData = this.addExpenseForm.value;
      const receiptFile: File | undefined = formData.receipt || undefined;

      const expenseDataForService = {
          amount: formData.amount,
          description: formData.description,
          expense_date: formData.expense_date,
          location: formData.location
      };

      const selectedCategory = this.categories.find(cat => cat.id === formData.category);
      if (!selectedCategory) {
          console.error('Selected category not found.');
          this.addExpenseApiErrors = { non_field_errors: ['Invalid category selected.'] };
          this.isAddingExpense = false;
          return;
      }
      const categoryName = selectedCategory.name;
      const categoryId = selectedCategory.id;


      if (this.currentIncome && this.currentIncome.budget_amount) {
          const incomeAmount = parseFloat(this.currentIncome.budget_amount);
          if (expenseDataForService.amount > incomeAmount) {
              if (!confirm('The expense exceeds your income. Are you sure you want to add this expense?')) {
                  this.isAddingExpense = false;
                  return;
              }
          }
      }

      this.expenseService.addExpense(expenseDataForService, categoryName, categoryId, receiptFile).subscribe({
        next: (response) => {
          console.log('Expense added successfully', response);
          this.closeModal(this.addExpenseModal);
          // *** Added: Full page reload after successful add ***
          window.location.reload();
        },
        error: (error) => {
          console.error('Error adding expense:', error);
          this.isAddingExpense = false;
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

  onReceiptFileSelect(event: any): void {
      const file = event.target.files.length > 0 ? event.target.files[0] : null;
      this.addExpenseForm.patchValue({
          receipt: file
      });
      console.log('Selected file:', file?.name);
  }


  openAddExpenseModal(): void {
      console.log('Attempting to open add modal.');
      this.addExpenseForm.reset();
      this.addExpenseApiErrors = null;
      const receiptInput = this.addExpenseModal.nativeElement.querySelector('#receipt') as HTMLInputElement;
      if (receiptInput) {
          receiptInput.value = '';
      }
      this.addExpenseForm.get('receipt')?.setValue(null);

      const modalElement = this.addExpenseModal.nativeElement;
      let modal = bootstrap.Modal.getInstance(modalElement);
      if (!modal) {
          console.log('No existing add modal instance found, creating a new one.');
          modal = new bootstrap.Modal(modalElement);
      } else {
          console.log('Existing add modal instance found.');
      }
      modal.show();
      console.log('Bootstrap add modal show() called.');
  }

  /**
   * Opens the edit expense modal and populates it with expense data.
   * @param expense - The expense object to edit.
   */
  openEditExpenseModal(expense: Expense): void {
      console.log('Edit button clicked. Attempting to open edit modal for expense:', expense);
      this.editExpenseApiErrors = null;
      this.editExpenseForm.patchValue({
          id: expense.id,
          amount: parseFloat(expense.amount),
          description: expense.description,
          expense_date: expense.expense_date,
          location: expense.location,
          category: expense.category
      });

      console.log('Edit form patched with values:', this.editExpenseForm.value);

      const modalElement = this.editExpenseModal.nativeElement;
      console.log('Edit modal element:', modalElement);

      let modal = bootstrap.Modal.getInstance(modalElement);
      if (!modal) {
          console.log('No existing edit modal instance found, creating a new one.');
          modal = new bootstrap.Modal(modalElement);
      } else {
          console.log('Existing edit modal instance found.');
      }

      modal.show();
      console.log('Bootstrap edit modal show() called.');
  }

  onEditExpenseSubmit(): void {
    console.log('Edit expense form submitted.');
    if (this.editExpenseForm.valid) {
      this.isUpdatingExpense = true;
      this.editExpenseApiErrors = null;

      const formData = this.editExpenseForm.value;
      const expenseId = formData.id;

      if (this.currentIncome && this.currentIncome.budget_amount) {
          const incomeAmount = parseFloat(this.currentIncome.budget_amount);
          if (formData.amount > incomeAmount) {
              if (!confirm('The expense exceeds your income. Are you sure you want to update this expense?')) {
                  this.isUpdatingExpense = false;
                  return;
              }
          }
      }

      const updateData = {
          amount: formData.amount,
          description: formData.description,
          expense_date: formData.expense_date,
          location: formData.location,
          category: formData.category
      };

      this.expenseService.updateExpense(expenseId, updateData).subscribe({
        next: (response) => {
          console.log('Expense updated successfully', response);
          this.closeModal(this.editExpenseModal);
          // *** Added: Full page reload after successful edit ***
          window.location.reload();
        },
        error: (error) => {
          console.error('Error updating expense:', error);
          this.isUpdatingExpense = false;
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

  onDeleteExpense(expenseId: string): void {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.isDeletingExpense = true;
      this.expenseService.deleteExpense(expenseId).subscribe({
        next: (response) => {
          console.log('Expense deleted successfully', response);
          // *** Added: Full page reload after successful delete ***
          window.location.reload();
        },
        error: (error) => {
          console.error('Error deleting expense:', error);
          this.isDeletingExpense = false;
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

  viewReceipt(receiptUrl: string | null): void {
      if (receiptUrl) {
          const fullUrl = `http://localhost:8000${receiptUrl}`;
          window.open(fullUrl, '_blank');
      } else {
          alert('No receipt available for this expense.');
      }
  }

  downloadYearlyPDF(): void {
      const year = this.filterForm.value.year;
      if (!year || !/^\d{4}$/.test(year)) {
          alert('Please enter a valid 4-digit year in the filter to generate the yearly summary.');
          return;
      }

      if (typeof jsPDF === 'undefined' || typeof jsPDF.jsPDF === 'undefined' || typeof (jsPDF.jsPDF.prototype as any).autoTable !== 'function') {
          console.error('jsPDF or AutoTable plugin not properly loaded.');
          alert('PDF generation failed: Required libraries not loaded.');
          return;
      }

      alert('Generating PDF...');

      this.expenseService.getMonthlySummary(year).subscribe({
          next: (expenseData) => {
              try {
                  const { jsPDF } = window.jspdf;
                  const doc = new jsPDF();

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
                      didParseCell: function(data: any) {
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
                      didParseCell: function(data: any) {
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

              } catch (error: any) {
                  console.error('Error generating PDF:', error);
                  alert('Error generating PDF: ' + error.message);
              } finally {
              }
          },
          error: (error) => {
              console.error('Error fetching data for PDF:', error);
              alert('Could not generate PDF: Error fetching expense data');
          }
      });
  }

  private closeModal(modalElementRef: ElementRef): void {
      const modalElement = modalElementRef.nativeElement;
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
          modal.hide();
      }
  }
}
