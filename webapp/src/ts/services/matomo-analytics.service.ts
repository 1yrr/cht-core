import { Inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { SessionService } from '@mm-services/session.service';
import { AuthService } from '@mm-services/auth.service';

export const CAN_TRACK_USAGE_ANALYTICS = 'can_track_usage_analytics';

@Injectable({
  providedIn: 'root'
})
export class MatomoAnalyticsService {
  private window: any;
  private previousPageUrl: string;
  private trackingSubscription: Subscription;
  private isScriptReady = new Subject<boolean>();

  private MATOMO_SERVER_URL = 'https://matomo-care-teams.dev.medicmobile.org';
  private MATOMO_SCRIP_FILE = 'matomo.js';
  private MATOMO_TRACKER = 'matomo.php';
  private MATOMO_SITE_ID = '1';

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private sessionService: SessionService,
    private authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.window = this.document.defaultView;
  }

  async init() {
    if (!(await this.canTrack()) || !this.window) {
      return;
    }

    if (!this.window._paq) {
      this.window._paq = [];
    }

    this.window._paq.push(['trackPageView']); // TODO: extract to enum or something
    this.window._paq.push(['enableLinkTracking']);
    this.window._paq.push(['setTrackerUrl', `${this.MATOMO_SERVER_URL}/${this.MATOMO_TRACKER}`]);
    this.window._paq.push(['setSiteId', this.MATOMO_SITE_ID]);

    this.isScriptReady.subscribe(isReady => isReady && this.startTracking());
    this.loadScript();
  }

  private async canTrack() {
    return !this.sessionService.isDbAdmin() && await this.authService.has(CAN_TRACK_USAGE_ANALYTICS);
  }

  private loadScript() {
    const head = this.document.getElementsByTagName('head')[0];
    const script = this.document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `${this.MATOMO_SERVER_URL}/${this.MATOMO_SCRIP_FILE}`;
    script.onload = () => this.isScriptReady.next(true);
    head.appendChild(script);
  }

  private stopTracking() { // TODO: Do we need this?
    this.trackingSubscription?.unsubscribe();
  }

  private startTracking() {
    this.trackingSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        let currentRoute = this.activatedRoute.root;
        while (currentRoute?.firstChild) {
          currentRoute = currentRoute.firstChild;
        }

        if (this.previousPageUrl) {
          this.window._paq.push(['setReferrerUrl', this.previousPageUrl]);  // TODO: extract to enum or something
        }

        if (currentRoute.snapshot?.title) {
          this.window._paq.push(['setDocumentTitle', currentRoute.snapshot?.title]);
        }

        this.window._paq.push(['setCustomUrl', window.location.href]);
        this.previousPageUrl = window.location.href;
        this.window._paq.push(['trackPageView']); // Set last
        this.window._paq.push(['enableLinkTracking']); // Also, set last
      });
  }

  async trackEvent(category, action, name) {
    if (!(await this.canTrack()) || !this.window) {
      return;
    }

    this.window._paq.push(['trackEvent', category, action, name]);
  }
}

export const EventCategories = {
  CONTACTS: 'contacts',
  REPORTS: 'reports',
};

export const EventActions = {
  SORT: 'sort',
  SEARCH: 'search',
  LOAD: 'load',
};
