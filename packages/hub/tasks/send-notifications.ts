import { Helpers } from 'graphile-worker';

export default class SendNotificationsTask {
  async perform(payload: any, _helpers: Helpers) {
    console.log('received job in send-notifications:', payload);
  }
}
