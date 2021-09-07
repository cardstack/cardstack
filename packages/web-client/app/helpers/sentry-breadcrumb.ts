import Helper from '@ember/component/helper';
import { addBreadcrumb } from '@sentry/ember';

interface SentryBreadcrumbParams {
  message: string;
}

export default class SentryBreadcrumbHelper extends Helper {
  compute(_params: any[], { message }: SentryBreadcrumbParams) {
    addBreadcrumb({
      message,
    });
    return '';
  }
}
