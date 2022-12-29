import { SchedulePaymentProgressListener } from '../scheduled-payment-module';
import { hubRequest, poll } from '../utils/general-utils';

export const GAS_ESTIMATION_SCENARIOS = [
  'create_safe_with_module',
  'execute_one_time_payment',
  'execute_recurring_payment',
] as const;
export type GasEstimationScenario = typeof GAS_ESTIMATION_SCENARIOS[number];

export async function waitUntilSchedulePaymentTransactionMined(
  hubRootUrl: string,
  scheduledPaymentId: string,
  authToken: string,
  listener?: SchedulePaymentProgressListener
) {
  listener?.onBeginWaitingForTransactionConfirmation?.();
  await poll(
    () => hubRequest(hubRootUrl, `api/scheduled-payments/${scheduledPaymentId}`, authToken, 'GET'),
    (response: any) => {
      let attributes = response.data.attributes;
      let error = attributes['creation-transaction-error'];
      if (error) {
        throw new Error(`Transaction reverted: ${error}`);
      }
      return attributes['creation-block-number'] != null;
    },
    1000
  );
  listener?.onEndWaitingForTransactionConfirmation?.();
}

export async function waitUntilCancelPaymentTransactionMined(
  hubRootUrl: string,
  scheduledPaymentId: string,
  authToken: string
) {
  return poll(
    () => hubRequest(hubRootUrl, `api/scheduled-payments/${scheduledPaymentId}`, authToken, 'GET'),
    (response: any) => {
      let attributes = response.data.attributes;
      let error = attributes['cancelation-transaction-error'];
      if (error) {
        throw new Error(`Transaction reverted: ${error}`);
      }
      return attributes['cancelation-block-number'] != null;
    },
    1000
  );
}
