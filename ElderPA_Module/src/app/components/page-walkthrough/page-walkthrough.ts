import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  WalkthroughRegistryService,
  type WalkthroughRouteKey,
  type WalkthroughStep,
} from '../../Services/walkthrough-registry.service';

function normalizeRouteKey(url: string): WalkthroughRouteKey {
  const path = (url ?? '').split('?')[0];
  if (!path || path === '/') return 'home';
  return path.startsWith('/') ? path : `/${path}`;
}

@Component({
  selector: 'app-page-walkthrough',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-walkthrough.html',
  styleUrls: ['./page-walkthrough.css'],
})
export class PageWalkthroughComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly registry = inject(WalkthroughRegistryService);

  readonly open = signal(false);
  readonly routeKey = signal<WalkthroughRouteKey>('home');

  readonly steps = signal<WalkthroughStep[]>([]);
  readonly stepIndex = signal(0);
  readonly panelPlacement = signal<'left' | 'right'>('right');

  private highlightedEl: HTMLElement | null = null;
  private lastStepsFingerprint = '';

  // Spotlight rectangle blocks the dim/blur layer only over the active target.
  readonly spotlight = signal<{ left: number; top: number; width: number; height: number } | null>(null);
  private readonly spotlightPadding = 6;

  private scrollLockEnabled = false;

  private readonly onWheel = (e: WheelEvent) => {
    // Prevent user-driven scroll while walkthrough is open.
    e.preventDefault();
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    // Prevent user-driven scroll gestures while walkthrough is open.
    e.preventDefault();
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    // Block common scroll/navigation keys.
    const k = e.key;
    const blocked = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
    if (blocked.includes(k)) e.preventDefault();
  };

  ngOnInit(): void {
    this.routeKey.set(normalizeRouteKey(this.router.url));
    this.refreshSteps();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.routeKey.set(normalizeRouteKey(this.router.url));
        this.refreshSteps();

        // Close on route change to avoid pointing to stale DOM.
        if (this.open()) this.close();
      });

    this.registry.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
      // If steps get registered after navigation (or after async data loads), refresh.
      if (!this.open()) {
        this.refreshSteps();
        return;
      }

      const s = this.registry.getSteps(this.routeKey());
      const fingerprint = s.map((x) => x.targetId ?? '').join('|');

      this.steps.set(s);

      // If the active steps changed (e.g. Locations sub-tab changed), restart at step 1.
      if (fingerprint !== this.lastStepsFingerprint) {
        this.lastStepsFingerprint = fingerprint;
        this.stepIndex.set(0);
        this.applyStep(0);
        return;
      }

      // Keep current index if still in range; otherwise clamp.
      const idx = Math.min(this.stepIndex(), s.length - 1);
      if (idx !== this.stepIndex()) this.stepIndex.set(idx);
      this.applyStep(idx);
      });

    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateSpotlightFromHighlighted());
      fromEvent(window, 'scroll', { passive: true } as any)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateSpotlightFromHighlighted());
    }
  }

  get canGoBack(): boolean {
    return this.stepIndex() > 0;
  }

  get canGoNext(): boolean {
    return this.stepIndex() < this.steps().length - 1;
  }

  openWalkthrough(): void {
    this.open.set(true);
    this.stepIndex.set(0);
    this.lastStepsFingerprint = this.steps().map((x) => x.targetId ?? '').join('|');
    this.applyStep(0);
  }

  close(): void {
    this.open.set(false);
    this.disableScrollLock();
    this.removeHighlight();
  }

  next(): void {
    const nextIndex = this.stepIndex() + 1;
    if (nextIndex >= this.steps().length) {
      this.close();
      return;
    }
    this.stepIndex.set(nextIndex);
    this.applyStep(nextIndex);
  }

  back(): void {
    const prevIndex = this.stepIndex() - 1;
    if (prevIndex < 0) return;
    this.stepIndex.set(prevIndex);
    this.applyStep(prevIndex);
  }

  private refreshSteps(): void {
    const s = this.registry.getSteps(this.routeKey());
    this.steps.set(s);
    if (s.length === 0) {
      this.stepIndex.set(0);
      this.removeHighlight();
    } else {
      const clamped = Math.min(this.stepIndex(), s.length - 1);
      this.stepIndex.set(clamped);
    }
  }

  private applyStep(index: number): void {
    if (typeof document === 'undefined') return;

    this.removeHighlight();

    const step = this.steps()[index];
    const targetId = step?.targetId;
    if (!targetId) return;

    // UI / scroll behavior hints for this step.
    this.panelPlacement.set(step.panelPlacement ?? 'right');
    this.updateScrollLock(!!step.lockScroll);

    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(targetId) : targetId;
    const selector = `[data-walkthrough-id="${escaped}"]`;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;

    el.classList.add('walkthrough-highlight');
    this.highlightedEl = el;

    if (step.scrollTo && step.scrollTo !== 'none') {
      this.scrollTo(step.scrollTo, el);
      // Recalculate spotlight after scroll position updates.
      requestAnimationFrame(() => this.updateSpotlightFromHighlighted());
      return;
    }

    this.updateSpotlightFromHighlighted();
  }

  private removeHighlight(): void {
    if (!this.highlightedEl) return;
    this.highlightedEl.classList.remove('walkthrough-highlight');
    this.highlightedEl = null;
    this.spotlight.set(null);
  }

  private updateSpotlightFromHighlighted(): void {
    if (!this.open() || !this.highlightedEl) return;
    if (typeof window === 'undefined') return;

    const rect = this.highlightedEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.spotlight.set(null);
      return;
    }

    const pad = this.spotlightPadding;
    const left = Math.max(0, rect.left - pad);
    const top = Math.max(0, rect.top - pad);
    const width = Math.min(window.innerWidth - left, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top, rect.height + pad * 2);

    this.spotlight.set({ left, top, width, height });
  }

  private updateScrollLock(lock: boolean): void {
    if (lock === this.scrollLockEnabled) return;
    if (lock) this.enableScrollLock();
    else this.disableScrollLock();
  }

  private enableScrollLock(): void {
    if (this.scrollLockEnabled) return;
    this.scrollLockEnabled = true;

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  private disableScrollLock(): void {
    if (!this.scrollLockEnabled) return;
    this.scrollLockEnabled = false;

    window.removeEventListener('wheel', this.onWheel as any);
    window.removeEventListener('touchmove', this.onTouchMove as any);
    window.removeEventListener('keydown', this.onKeyDown as any, { capture: true } as any);
  }

  private scrollTo(action: NonNullable<WalkthroughStep['scrollTo']>, el: HTMLElement): void {
    if (typeof document === 'undefined') return;
    if (!el) return;

    // Use scrollIntoView so it works with both window scrolling and nested scroll containers.
    if (typeof (el as any).scrollIntoView === 'function') {
      if (action === 'top') el.scrollIntoView({ block: 'start', behavior: 'auto' });
      else if (action === 'half') el.scrollIntoView({ block: 'center', behavior: 'auto' });
      else if (action === 'bottom') el.scrollIntoView({ block: 'end', behavior: 'auto' });
      return;
    }
  }

  // Rounded-corner radius used by the SVG mask "hole".
  maskRadius(): number {
    const s = this.spotlight();
    if (!s) return 0;

    const minDim = Math.min(s.width, s.height);
    // Tune for a pleasant rounded-card look across different element sizes.
    const r = minDim * 0.12 + this.spotlightPadding;
    return Math.max(10, Math.min(24, r));
  }

}

