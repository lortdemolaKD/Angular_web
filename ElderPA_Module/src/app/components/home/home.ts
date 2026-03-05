import {
  Component,
} from '@angular/core';
import {CommonModule,} from '@angular/common';

import { FormsModule } from '@angular/forms';
import {Dashboard} from '../dashboard/dashboard';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  imports: [
    CommonModule,


    FormsModule,

    Dashboard,


  ],
  styleUrl: './home.css'
})
export class Home {}
