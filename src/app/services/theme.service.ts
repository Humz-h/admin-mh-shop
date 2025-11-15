import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly themeKey = 'theme';
  private themeSubject = new BehaviorSubject<Theme>(this.getInitialTheme());
  public theme$: Observable<Theme> = this.themeSubject.asObservable();

  constructor() {
    this.initializeTheme();
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem(this.themeKey);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private initializeTheme(): void {
    const theme = this.getInitialTheme();
    this.applyTheme(theme);
  }

  getTheme(): Theme {
    return this.themeSubject.value;
  }

  toggleTheme(): void {
    const newTheme = this.themeSubject.value === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    localStorage.setItem(this.themeKey, theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}









