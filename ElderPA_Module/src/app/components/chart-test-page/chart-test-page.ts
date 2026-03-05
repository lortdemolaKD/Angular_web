import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SmartChartComponent,
  type ChartType,
  type ChartDatum,
  type ChartOptions,
} from '../../NEW for implemnet/smart-chart/smart-chart';

const CHART_TYPES: ChartType[] = [
  'bar-vertical',
  'bar-horizontal',
  'bar-grouped',
  'bar-stacked',
  'bar-stacked-100',
  'bar-grouped-stacked',
  'bar-diverging',
  'bar-with-markers',
  'bar-reversed',
  'mixed-bar-line',
  'mixed-overlay',
  'lollipop',
  'heatmap',
  'area-bar',
  'range-area',
  'timeline-range',
  'funnel',
  'waterfall',
  'slope',
  'radial-bar',
  'radial-bar-multiple',
  'radial-bar-custom-angle',
  'radial-bar-custom-angle-360',
  'radial-bar-custom-angle-270',
  'radial-bar-custom-angle-170',
  'radial-bar-custom-angle-100',
  'radial-bar-custom-angle-50',
  'pie',
  'pie-donut',
  'pie-monochrome',
  'pie-donut-gradient',
  'scatter',
  'bubble',
  'boxplot',
  'treemap',
  'candlestick',
  'broken-scale-bar',
  'bar-3d',
  'slope-grouped',
  'gradient-bar',
];

@Component({
  selector: 'app-chart-test-page',
  standalone: true,
  imports: [SmartChartComponent, RouterLink],
  templateUrl: './chart-test-page.html',
  styleUrl: './chart-test-page.css',
})
export class ChartTestPage {
  readonly chartTypes = CHART_TYPES;

  readonly defaultOptions: ChartOptions = {
    showAxis: true,
    showGrid: true,
    showLegend: true,
    showDataLabels: true,
    height: 260,
  };

  /** Sample data per chart type (key = ChartType) */
  getData(type: ChartType): ChartDatum[] {
    switch (type) {
      case 'bar-vertical':
        return [
          { label: 'Jan', value: 40, target: 50 },
          { label: 'Feb', value: 60, target: 70 },
          { label: 'Mar', value: 35, target: 40 },
          { label: 'Apr', value: 80, target: 90 },
        ];
      case 'bar-horizontal':
      case 'bar-reversed':
      case 'lollipop':
      case 'area-bar':
      case 'gradient-bar':
        return [
          { label: 'A', value: 30 },
          { label: 'B', value: 60 },
          { label: 'C', value: 45 },
          { label: 'D', value: 80 },
          { label: 'E', value: 25 },
        ];
      case 'bar-3d':
        return [
          { group: '2009', label: 'North America', value: 390 },
          { group: '2009', label: 'Europe', value: 330 },
          { group: '2009', label: 'Africa', value: 290 },
          { group: '2009', label: 'Asia', value: 230 },
          { group: '2009', label: 'South America', value: 190 },
          { group: '2008', label: 'North America', value: 310 },
          { group: '2008', label: 'Europe', value: 270 },
          { group: '2008', label: 'Africa', value: 210 },
          { group: '2008', label: 'Asia', value: 170 },
          { group: '2008', label: 'South America', value: 130 },
          { group: '2007', label: 'North America', value: 290 },
          { group: '2007', label: 'Europe', value: 250 },
          { group: '2007', label: 'Africa', value: 190 },
          { group: '2007', label: 'Asia', value: 150 },
          { group: '2007', label: 'South America', value: 110 },
        ];
      case 'bar-stacked':
      case 'bar-stacked-100':
      case 'bar-grouped':
        return [
          { label: '2023', series: 'A', value: 30 },
          { label: '2023', series: 'B', value: 45 },
          { label: '2024', series: 'A', value: 50 },
          { label: '2024', series: 'B', value: 35 },
          { label: '2025', series: 'A', value: 40 },
          { label: '2025', series: 'B', value: 55 },
        ];
      case 'bar-grouped-stacked':
        return [
          { label: 'Online', group: '2019', series: 'A', value: 44 },
          { label: 'Online', group: '2019', series: 'B', value: 18 },
          { label: 'Online', group: '2020', series: 'A', value: 40 },
          { label: 'Online', group: '2020', series: 'B', value: 20 },
          { label: 'Sales', group: '2019', series: 'A', value: 30 },
          { label: 'Sales', group: '2019', series: 'B', value: 25 },
          { label: 'Sales', group: '2020', series: 'A', value: 35 },
          { label: 'Sales', group: '2020', series: 'B', value: 28 },
        ];
      case 'bar-with-markers':
        return [
          { label: '2011', value: 83, target: 14 },
          { label: '2012', value: 65, target: 45 },
          { label: '2013', value: 72, target: 60 },
          { label: '2014', value: 55, target: 70 },
        ];
      case 'bar-diverging':
        return [
          { label: 'A', value: -40 },
          { label: 'B', value: 20 },
          { label: 'C', value: -10 },
          { label: 'D', value: 60 },
        ];
      case 'heatmap':
        return [
          { label: 'Mon-9', value: 20 },
          { label: 'Mon-12', value: 45 },
          { label: 'Mon-15', value: 30 },
          { label: 'Tue-9', value: 60 },
          { label: 'Tue-12', value: 35 },
          { label: 'Tue-15', value: 50 },
        ];
      case 'range-area':
        return [
          { label: 'Day 1', value: 10, value2: 40 },
          { label: 'Day 2', value: 20, value2: 60 },
          { label: 'Day 3', value: 15, value2: 55 },
          { label: 'Day 4', value: 5, value2: 35 },
        ];
      case 'mixed-bar-line':
        return [
          { label: 'Jan', value: 30, lineValue: 25 },
          { label: 'Feb', value: 45, lineValue: 50 },
          { label: 'Mar', value: 20, lineValue: 30 },
          { label: 'Apr', value: 60, lineValue: 55 },
        ];
      case 'timeline-range':
        return [
          { label: 'Task A', start: 0, end: 3 },
          { label: 'Task B', start: 1, end: 5 },
          { label: 'Task C', start: 4, end: 7 },
          { label: 'Task D', start: 2, end: 6 },
        ];
      case 'funnel':
        return [
          { label: 'Visits', value: 1000 },
          { label: 'Signups', value: 400 },
          { label: 'Trials', value: 200 },
          { label: 'Customers', value: 80 },
        ];
      case 'waterfall':
        return [
          { label: 'Main Column 1', value: 50, isTotal: true },
          { label: 'Delta 1', value: 40 },
          { label: 'Delta 2', value: 30 },
          { label: 'Middle Column', value: 120, isTotal: true },
          { label: 'Delta 3', value: 10 },
          { label: 'Delta 4', value: 20 },
          { label: 'Delta 5', value: -50 },
          { label: 'End Value', value: 100, isTotal: true },
        ];
      case 'slope':
        return [
          { label: 'Red', value: 55, value2: 21 },
          { label: 'Blue', value: 43, value2: 58 },
          { label: 'Green', value: 33, value2: 38 },
        ];
      case 'radial-bar':
        return [{ label: 'Cricket', value: 70 }];
      case 'radial-bar-multiple':
        return [
          { label: 'A', value: 82, color: '#4f46e5' },
          { label: 'B', value: 68, color: '#22c55e' },
          { label: 'C', value: 55, color: '#eab308' },
          { label: 'D', value: 48, color: '#f97316' },
          { label: 'E', value: 35, color: '#e11d48' },
        ];
      case 'radial-bar-custom-angle':
      case 'radial-bar-custom-angle-360':
      case 'radial-bar-custom-angle-270':
      case 'radial-bar-custom-angle-170':
      case 'radial-bar-custom-angle-100':
      case 'radial-bar-custom-angle-50':
        return [
          { label: 'LinkedIn', value: 90, color: '#0f172a' },
          { label: 'Vimeo', value: 78, color: '#3b82f6' },
          { label: 'Messenger', value: 67, color: '#60a5fa' },
          { label: 'Facebook', value: 61, color: '#93c5fd' },
        ];
      case 'pie':
      case 'pie-donut':
      case 'pie-donut-gradient':
        return [
          { label: 'series-1', value: 26 },
          { label: 'series-2', value: 32 },
          { label: 'series-3', value: 24 },
          { label: 'series-4', value: 10 },
          { label: 'series-5', value: 9 },
        ];
      case 'pie-monochrome':
        return [
          { label: 'Monday', value: 8 },
          { label: 'Tuesday', value: 13 },
          { label: 'Wednesday', value: 23 },
          { label: 'Thursday', value: 28 },
          { label: 'Friday', value: 21 },
          { label: 'Saturday', value: 9 },
        ];
      case 'scatter':
        return [
          { label: 'P1', x: 1, y: 2 },
          { label: 'P2', x: 3, y: 5 },
          { label: 'P3', x: 5, y: 3 },
          { label: 'P4', x: 7, y: 8 },
          { label: 'P5', x: 2, y: 6 },
        ];
      case 'bubble':
        return [
          { label: 'B1', x: 2, y: 3, r: 2 },
          { label: 'B2', x: 4, y: 6, r: 4 },
          { label: 'B3', x: 6, y: 4, r: 1 },
          { label: 'B4', x: 5, y: 5, r: 3 },
        ];
      case 'boxplot':
        return [
          { label: 'Jan 2015', min: 55, q1: 65, median: 70, q3: 75, max: 87 },
          { label: 'Jan 2016', min: 42, q1: 65, median: 71, q3: 78, max: 80 },
          { label: 'Jan 2017', min: 30, q1: 40, median: 45, q3: 50, max: 58 },
          { label: 'Jan 2018', min: 38, q1: 50, median: 57, q3: 65, max: 70 },
          { label: 'Jan 2019', min: 28, q1: 30, median: 34, q3: 38, max: 45 },
          { label: 'Jan 2020', min: 40, q1: 50, median: 55, q3: 60, max: 68 },
          { label: 'Jan 2021', min: 55, q1: 55, median: 62, q3: 70, max: 87 },
        ];
      case 'treemap':
        return [
          { label: 'A', value: 30 },
          { label: 'B', value: 20 },
          { label: 'C', value: 15 },
          { label: 'D', value: 25 },
          { label: 'E', value: 10 },
        ];
      case 'candlestick':
        return [
          { label: 'Mon', open: 100, high: 110, low: 95, close: 105 },
          { label: 'Tue', open: 105, high: 115, low: 102, close: 108 },
          { label: 'Wed', open: 108, high: 109, low: 98, close: 102 },
          { label: 'Thu', open: 102, high: 118, low: 100, close: 115 },
        ];
      case 'broken-scale-bar':
        return [
          { label: 'Operations', value: 1500 },
          { label: 'HR', value: 20 },
          { label: 'IT', value: 100 },
          { label: 'Sales', value: 120 },
          { label: 'Marketing', value: 50 },
        ];
      case 'slope-grouped':
        return [
          { label: 'Category 1', series: 'Blue', value: 43 },
          { label: 'Category 1', series: 'Green', value: 38 },
          { label: 'Category 1', series: 'Red', value: 35 },
          { label: 'Category 1', series: 'Orange', value: 28 },
          { label: 'Category 2', series: 'Blue', value: 58 },
          { label: 'Category 2', series: 'Green', value: 45 },
          { label: 'Category 2', series: 'Red', value: 62 },
          { label: 'Category 2', series: 'Orange', value: 32 },
          { label: 'Category 3', series: 'Blue', value: 48 },
          { label: 'Category 3', series: 'Green', value: 55 },
          { label: 'Category 3', series: 'Red', value: 52 },
          { label: 'Category 3', series: 'Orange', value: 41 },
        ];
      case 'mixed-overlay':
        return [
          { label: 'Jan', value: 30, value2: 25 },
          { label: 'Feb', value: 45, value2: 50 },
          { label: 'Mar', value: 20, value2: 30 },
          { label: 'Apr', value: 55, value2: 40 },
        ];
      default:
        return [
          { label: 'A', value: 30 },
          { label: 'B', value: 60 },
          { label: 'C', value: 45 },
        ];
    }
  }

  getOptions(type: ChartType): ChartOptions {
    const base = { ...this.defaultOptions };
    if (type === 'bar-diverging') {
      base.min = -100;
      base.max = 100;
    }
    if (type === 'broken-scale-bar') {
      base.scaleBreakAt = 140;
      base.max = 1500;
      base.scaleLabel = 'Scale: 1 cm = 20 employees';
    }
    if (type === 'radial-bar' || type === 'radial-bar-multiple' || type.startsWith('radial-bar-custom-angle')) {
      base.max = 100;
    }
    // Custom angle: value = % of angle range; presets set endAngle (startAngle = 0)
    if (type === 'radial-bar-custom-angle') {
      base.startAngle = 0;
      base.endAngle = 360;
    }
    if (type.startsWith('radial-bar-custom-angle-')) {
      base.startAngle = 0;
      const n = type.replace('radial-bar-custom-angle-', '');
      base.endAngle = parseInt(n, 10) || 360;
    }
    if (type === 'bar-3d') {
      base.max = 400;
    }
    if (type === 'waterfall') {
      base.min = 0;
      // max is auto: max cumulative + 20 (do not set base.max so the chart fits all values)
    }
    return base;
  }

  formatLabel(type: ChartType): string {
    return type
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
