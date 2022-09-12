import Helper from '@ember/component/helper';
import { addBreadcrumb } from '@sentry/ember';

export default class SentryBreadcrumbHelper extends Helper {
  compute(_positional: any[], { message }: Record<string, string>): void {
    addBreadcrumb({
      message,
    });
  }
}
