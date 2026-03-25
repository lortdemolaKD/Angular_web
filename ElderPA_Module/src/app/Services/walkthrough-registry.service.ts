import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type WalkthroughRouteKey = string;

export type WalkthroughPanelPlacement = 'left' | 'right';
export type WalkthroughScrollTo = 'none' | 'top' | 'half' | 'bottom';

export interface WalkthroughStep {
  targetId?: string;
  title: string;
  description: string;
  /**
   * Optional UI hints for the overlay when this step is active.
   * - `panelPlacement`: where to position the walkthrough panel on desktop.
   * - `scrollTo`: request an automatic page scroll.
   * - `lockScroll`: prevent user scrolling while this walkthrough is open.
   */
  panelPlacement?: WalkthroughPanelPlacement;
  scrollTo?: WalkthroughScrollTo;
  lockScroll?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WalkthroughRegistryService {
  private stepsByRoute = new Map<WalkthroughRouteKey, WalkthroughStep[]>();
  private readonly updatesSubject = new Subject<void>();
  readonly updates$ = this.updatesSubject.asObservable();

  register(routeKey: WalkthroughRouteKey, steps: WalkthroughStep[]): void {
    this.stepsByRoute.set(routeKey, steps);
    this.updatesSubject.next();
  }

  getSteps(routeKey: WalkthroughRouteKey): WalkthroughStep[] {
    return this.stepsByRoute.get(routeKey) ?? [];
  }
}

