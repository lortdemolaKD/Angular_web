import { Component, signal, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

type ThemeMode = 'light' | 'dark' | 'high-contrast'|`ccga-red`|`ccga-green`|`ccga-gold`|`ccga-teal`;

const MODES: ThemeMode[] = ['light', 'dark', 'high-contrast',`ccga-red`,`ccga-green`,`ccga-gold`,`ccga-teal`];

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './theme-switcher.html',
  styleUrls: ['./theme-switcher.css'],
})
export class ThemeSwitcher {
  readonly currentMode = signal<ThemeMode>('light');
  readonly nextMode = signal<ThemeMode>('dark');

  /** Icon name for current theme (palette / dark_mode / contrast). */
  themeIcon = signal<string>('palette');

  constructor() {
    effect(() => {
      const saved = localStorage.getItem('theme-mode') as ThemeMode || 'light';
      this.setTheme(saved);
    });
  }

  cycleTheme() {
    const currentIndex = MODES.indexOf(this.currentMode());
    const next = MODES[(currentIndex + 1) % MODES.length];
    this.setTheme(next);
  }

  private setTheme(mode: ThemeMode) {
    document.documentElement.setAttribute('data-theme', mode);
    this.currentMode.set(mode);
    this.nextMode.set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    const icon = mode === 'dark' ? 'dark_mode' : mode === 'light' ? 'light_mode' : 'palette';
    this.themeIcon.set(icon);
    localStorage.setItem('theme-mode', mode);

    // Set fallback CSS vars if needed (Material handles most via data-theme)
    const vars: Record<string, string> = {
      light: `
        --color-accent1: #9a538eff;
        --color-accent2: #00cec1ff;
      `,
      dark: `
        --color-accent1: #63345cff;
        --color-accent2: #146763ff;
      `,
      'high-contrast': `
        --color-accent1: #000000ff;
        --color-accent2: #ffffff;
      `,
      'ccga-red': `
        --color-accent1: #000000ff;
        --color-accent2: #ffffff;
      `,
      'ccga-green': `
        --color-accent1: #000000ff;
        --color-accent2: #ffffff;
      `,
      'ccga-gold': `
        --color-accent1: #000000ff;
        --color-accent2: #ffffff;
      `,
      'ccga-teal': `
        --color-accent1: #000000ff;
        --color-accent2: #ffffff;
      `,

    };

    const cssVars = vars[mode];
    if (cssVars) {
      cssVars.split(';').forEach(prop => {
        const [key, value] = prop.split(':');
        if (key && value) {
          document.documentElement.style.setProperty(key.trim(), value.trim());
        }
      });
    }
  }
}
