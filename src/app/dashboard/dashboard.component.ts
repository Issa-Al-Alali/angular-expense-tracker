import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // If you have links within the dashboard content

@Component({
  selector: 'app-dashboard',
  standalone: true, // Mark as standalone
  imports: [CommonModule, RouterModule], // Import necessary modules
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  // You can add properties here to hold data fetched for the dashboard
  // For example, summary statistics, recent expenses, etc.

  constructor() { }

  ngOnInit(): void {
    // In a real dashboard, you would typically fetch data from your backend API here
    // For example:
    // this.dataService.getDashboardSummary().subscribe(data => {
    //   this.summaryData = data;
    // });
  }
}
