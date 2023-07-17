import { Inject, Injectable, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { SessionService } from '@mm-services/session.service';
import { AuthService } from '@mm-services/auth.service';
import { SettingsService } from '@mm-services/settings.service';

export const CAN_TRACK_USAGE_ANALYTICS = 'can_track_usage_analytics';

@Injectable({
  providedIn: 'root'
})
export class UsageAnalyticsService {

  private window: any;
  private previousPageUrl: string;
  private isScriptReady = new Subject<boolean>();
  private analyticsServer: string;

  private THIRD_PARTY_SCRIPT_VERSION = '4.14.2';
  private THIRD_PARTY_SCRIPT_FILE = 'matomo.js';
  private THIRD_PARTY_TRACKER_FILE = 'matomo.php';
  private UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  constructor(
    private router: Router,
    private sessionService: SessionService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private ngZone: NgZone,
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

    const isConfigOkay = await this.setConfig();
    if (!isConfigOkay) {
      return;
    }

    this.loadScript();
  }

  private async setConfig() {
    const settings = await this.settingsService.get().catch(() => null);
    const siteId = settings?.usage_analytics?.site_id;
    this.analyticsServer = settings?.usage_analytics?.server_url;

    if (!this.analyticsServer || !siteId) {
      console.warn(`Usage Analytics :: Missing configuration. Server URL: ${this.analyticsServer} Site ID: ${siteId}`);
      return false;
    }

    this.window._paq.push([ MatomoConfig.DISABLE_CAPTURE_KEYSTROKES ]);
    this.window._paq.push([ MatomoConfig.MATCH_TRACKER_URL ]);
    this.window._paq.push([ MatomoConfig.TRACK_PAGE_VIEW ]);
    this.window._paq.push([ MatomoConfig.ENABLE_LINK_TRACKING ]);
    this.window._paq.push([ MatomoConfig.SET_TRACKER_URL, `${this.analyticsServer}/${this.THIRD_PARTY_TRACKER_FILE}` ]);
    this.window._paq.push([ MatomoConfig.SET_SITE_ID, siteId.toString() ]);

    return true;
  }

  private async canTrack() {
    return !this.sessionService.isDbAdmin() && await this.authService.has(CAN_TRACK_USAGE_ANALYTICS);
  }

  private loadScript() {
    const head = this.document.getElementsByTagName('head')[0];
    const script = this.document.createElement('script');

    script.type = 'text/javascript';
    script.async = true;
    script.src = `${this.analyticsServer}/${this.THIRD_PARTY_SCRIPT_FILE}`;

    this.isScriptReady.subscribe(isReady => isReady && this.startTracking());
    script.onload = () => this.isScriptReady.next(true);

    head.appendChild(script);
  }

  private startTracking() {
    console.info('Usage analytics tracking started. Support compatible with ' +
      this.THIRD_PARTY_SCRIPT_FILE + ' version ' + this.THIRD_PARTY_SCRIPT_VERSION);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.ngZone.runOutsideAngular(() => this.trackNavigation());
      });
  }

  private trackNavigation() {
    const module = this.getModuleFromCurrentUrl();
    if (module) {
      this.window._paq.push([ MatomoConfig.SET_DOCUMENT_TITLE, module ]);
    }

    if (this.previousPageUrl) {
      this.window._paq.push([ MatomoConfig.SET_REFERENCE_URL, this.previousPageUrl ]);
    }

    const currentUrl = this.replaceUuid(this.window.location.href);
    this.window._paq.push([ MatomoConfig.SET_CUSTOM_URL, currentUrl ]);
    this.previousPageUrl = currentUrl;

    this.window._paq.push([ MatomoConfig.TRACK_PAGE_VIEW ]); // Set last
    this.window._paq.push([ MatomoConfig.ENABLE_LINK_TRACKING ]); // Also, set last
  }

  private replaceUuid(url) {
    if (!this.UUID_REGEX.test(url)) {
      return url;
    }

    const newURL = url.replace(this.UUID_REGEX, 'UUID');
    const navigation = this.router.getCurrentNavigation();
    const usageAnalyticsValue = navigation?.extras?.state?.usageAnalyticsValue;

    return usageAnalyticsValue ? `${newURL}~${usageAnalyticsValue}` : newURL;
  }

  private getModuleFromCurrentUrl() {
    const parts = this.window.location.hash?.split('/');
    return parts?.length >= 2 ? parts[1] : undefined;
  }

  async trackEvent(category, action, name?) {
    if (!(await this.canTrack()) || !this.window) {
      return;
    }

    const event = [ MatomoConfig.TRACK_EVENT, category, action ];
    name && event.push(name);
    this.ngZone.runOutsideAngular(() => this.window._paq.push(event));
  }
}

export const EventActions = {
  SEARCH: 'search',
  SORT: 'sort',
};

export const EventCategories = {
  CONTACTS: 'contacts',
};

export const MatomoConfig = {
  ENABLE_LINK_TRACKING: 'enableLinkTracking',
  SET_CUSTOM_URL: 'setCustomUrl',
  SET_DOCUMENT_TITLE: 'setDocumentTitle',
  SET_REFERENCE_URL: 'setReferrerUrl',
  SET_SITE_ID: 'setSiteId',
  SET_TRACKER_URL: 'setTrackerUrl',
  TRACK_EVENT: 'trackEvent',
  TRACK_PAGE_VIEW: 'trackPageView',
  DISABLE_CAPTURE_KEYSTROKES: 'HeatmapSessionRecording::disableCaptureKeystrokes',
  MATCH_TRACKER_URL: 'HeatmapSessionRecording::matchTrackerUrl',
};
