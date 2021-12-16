import { HubEventListenerController } from '../process-controllers/hub-event-listener-controller';

export const command = 'event-listener';
export const describe = 'Boot the contract events listener (used for push notifications)';
export const builder = {};
export async function handler() {
  await HubEventListenerController.create();
}
