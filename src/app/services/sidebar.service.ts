import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isExpandedSubject = new BehaviorSubject<boolean>(true);
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  private isHoveredSubject = new BehaviorSubject<boolean>(false);

  public isExpanded$: Observable<boolean> = this.isExpandedSubject.asObservable();
  public isMobileOpen$: Observable<boolean> = this.isMobileOpenSubject.asObservable();
  public isHovered$: Observable<boolean> = this.isHoveredSubject.asObservable();

  public sidebarState$: Observable<[boolean, boolean, boolean]> = combineLatest([
    this.isExpanded$,
    this.isMobileOpen$,
    this.isHovered$
  ]).pipe(
    map(([isExpanded, isMobileOpen, isHovered]) => [isExpanded, isMobileOpen, isHovered])
  );

  toggleExpanded(): void {
    this.isExpandedSubject.next(!this.isExpandedSubject.value);
  }

  setExpanded(value: boolean): void {
    this.isExpandedSubject.next(value);
  }

  toggleMobileOpen(): void {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  setMobileOpen(value: boolean): void {
    this.isMobileOpenSubject.next(value);
  }

  setHovered(value: boolean): void {
    this.isHoveredSubject.next(value);
  }
}









