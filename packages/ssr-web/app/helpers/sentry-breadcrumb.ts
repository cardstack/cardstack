import Helper from '@ember/component/helper';
import { addBreadcrumb } from '@sentry/ember';

interface SentryBreadcrumbParams {
  message: string;
}

interface Signature {
  Args: {
    Named: SentryBreadcrumbParams;
  };
  Return: void;
}

export default class SentryBreadcrumbHelper extends Helper<Signature> {
  compute(_params: never[], { message }: SentryBreadcrumbParams) {
    addBreadcrumb({
      message,
    });
  }
}
