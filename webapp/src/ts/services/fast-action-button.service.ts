import { Inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Store } from '@ngrx/store';

import { AuthService } from '@mm-services/auth.service';
import { ResponsiveService } from '@mm-services/responsive.service';
import { GlobalActions } from '@mm-actions/global';
import { ReportsActions } from '@mm-actions/reports';
import { ButtonType } from '@mm-components/fast-action-button/fast-action-button.component';

@Injectable({
  providedIn: 'root'
})
export class FastActionButtonService {

  private globalActions: GlobalActions;
  private reportsActions: ReportsActions;

  constructor(
    private router: Router,
    private store: Store,
    private authService: AuthService,
    private responsiveService: ResponsiveService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.globalActions = new GlobalActions(store);
    this.reportsActions = new ReportsActions(store);
  }

  private executeMailto(link) {
    const element = this.document.createElement('a');
    element.href = link;
    element.click();
    element.remove();
  }

  private async filterActions(actions: FastAction[]): Promise<FastAction[]> {
    const filteredActions = [];

    for (const action of actions) {
      if (await action.canDisplay()) {
        filteredActions.push(action);
      }
    }

    return filteredActions;
  }

  private getFormActions(xmlForms): FastAction[] {
    return (xmlForms || []).map(form => ({
      id: form.code,
      label: form.title || form.code,
      icon: { name: form.icon, type: IconType.RESOURCE },
      canDisplay: () => this.authService.has('can_edit'),
      execute: () => this.router.navigate(['/reports', 'add', form.code]),
    }));
  }

  private getSendMessageAction(context: FastActionMessageContext, config: FastActionMessageConfig = {}) {
    const { sendTo, callbackOpenSendMessage } = context;
    const { isPhoneRequired, useMailtoInMobile } = config;

    const validatePhone = () => isPhoneRequired ? !!sendTo?.phone : true;
    const canUseMailto = () => useMailtoInMobile && this.responsiveService.isMobile();

    return {
      id: 'send-message',
      labelKey: 'fast_action_button.send_message',
      icon: { name: 'fa-envelope', type: IconType.FONT_AWESOME },
      canDisplay: async () => {
        const permission = [ 'can_view_message_action' ];
        !canUseMailto() && permission.push('can_edit');
        return validatePhone() && await this.authService.has(permission);
      },
      execute: () => {
        if (canUseMailto()) {
          this.executeMailto(`sms:${sendTo?.phone}`);
          return;
        }
        callbackOpenSendMessage && callbackOpenSendMessage(sendTo?._id);
      },
    };
  }

  private getUpdateFacilityAction(reportContentType) {
    return {
      id: 'update-facility',
      labelKey: 'fast_action_button.update_facility',
      icon: { name: 'fa-pencil', type: IconType.FONT_AWESOME },
      canDisplay: async () => reportContentType !== 'xml' && await this.authService.has('can_edit'),
      execute: () => this.reportsActions.launchEditFacilityDialog(),
    };
  }

  getReportRightSideActions(context: FastActionReportContext): Promise<FastAction[]> {
    const actions = [
      this.getSendMessageAction(context.messageContext, { isPhoneRequired: true, useMailtoInMobile: true }),
      this.getUpdateFacilityAction(context.reportContentType),
    ];

    return this.filterActions(actions);
  }

  getReportLeftSideActions(xmlForms): Promise<FastAction[]> {
    const actions = this.getFormActions(xmlForms);
    return this.filterActions(actions);
  }

  getMessageActions(context: FastActionMessageContext): Promise<FastAction[]> {
    const actions = [
      this.getSendMessageAction(context),
    ];

    return this.filterActions(actions);
  }

  getButtonTypeForContentList() {
    return this.responsiveService.isMobile() ? ButtonType.FAB : ButtonType.FLAT;
  }
}

export enum IconType {
  RESOURCE,
  FONT_AWESOME,
}

interface FastActionIcon {
  type: IconType;
  name: string;
}

export interface FastAction {
  id: string;
  label?: string;
  labelKey?: string;
  icon: FastActionIcon;
  canDisplay(): Promise<boolean>;
  execute(): void;
}

interface FastActionMessageContext {
  sendTo?: Record<string, any>;
  callbackOpenSendMessage(sendTo?: Record<string, any>): void;
}

interface FastActionReportContext {
  messageContext: FastActionMessageContext;
  reportContentType: string;
}

interface FastActionMessageConfig {
  isPhoneRequired?: boolean;
  useMailtoInMobile?: boolean;
}
