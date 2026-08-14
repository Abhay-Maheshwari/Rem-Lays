import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system' | 'vscode' | 'dracula' | 'oled';

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

    const dark = effectiveTheme !== 'light';
    this.isDark.set(dark);

    document.body.classList.remove('light-theme', 'dark-theme', 'theme-vscode', 'theme-dracula', 'theme-oled');
    
    if (effectiveTheme === 'light') {
      document.body.classList.add('light-theme');
    } else if (effectiveTheme === 'dark') {
      // Default :root handles dark, but we can add a class just in case
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.add(`theme-${effectiveTheme}`);
    }
  }
}
