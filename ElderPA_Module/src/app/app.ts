import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavBar} from './components/navbar/navbar';
import {ThemeSwitcher} from './components/theme-switcher/theme-switcher';
import {AuthService} from './Services/Auth.service';
import {AsyncPipe, NgIf} from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar, NgIf, AsyncPipe],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  standalone: true
})
export class App {
  protected readonly title = signal('ElderPA_Module');
  constructor(public authService: AuthService) {}
}
