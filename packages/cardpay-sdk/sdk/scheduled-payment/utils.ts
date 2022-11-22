import { hubRequest, poll } from '../utils/general-utils';

export enum GasEstimationScenario {
  create_safe_with_module = 'create_safe_with_module',
  execute_one_time_payment = 'execute_one_time_payment',
  execute_recurring_payment = 'execute_recurring_payment',
}

export async function waitUntilSchedulePaymentTransactionMined(
  hubRootUrl: string,
  scheduledPaymentId: string,
  authToken: string
) {
  return poll(
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
}
