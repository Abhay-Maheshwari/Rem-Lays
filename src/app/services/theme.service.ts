import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  currentTheme = signal<Theme>('system');
  isDark = signal<boolean>(true);

  constructor() {
    this.initTheme();
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (this.currentTheme() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  private initTheme() {
    const savedTheme = localStorage.getItem('remlays_theme') as Theme;
    if (savedTheme) {
      this.currentTheme.set(savedTheme);
      this.applyTheme(savedTheme);
    } else {
      this.applyTheme('system');
    }
  }

  setTheme(theme: Theme) {
    this.currentTheme.set(theme);
    localStorage.setItem('remlays_theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme) {
    let effectiveTheme = theme;
    if (theme === 'system') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = isSystemDark ? 'dark' : 'light';
    }

    const dark = effectiveTheme === 'dark';
    this.isDark.set(dark);

    if (!dark) {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }
}
