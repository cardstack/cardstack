import { Message, MessageVerificationScheduler, Snowflake, SUUID } from './types';
import { Bot } from './bot';

export default class InMemoryMessageVerificationScheduler implements MessageVerificationScheduler {
  queuedMessages: Map<Snowflake, { message: Message; scheduledVerification: ReturnType<typeof setTimeout> }> =
    new Map();
  constructor(readonly bot: Bot) {}

  get scheduledVerificationsCount(): number {
    return this.queuedMessages.size;
  }

  async scheduleVerification(message: Message): Promise<void> {
    let listenerId = await this.bot.discordBotsDbGateway.getCurrentListenerId(this.bot.type);
    let scheduledVerification = setTimeout(
      this.performVerification.bind(this, message.id, listenerId),
      this.bot.config.messageVerificationDelayMs
    );
    this.queuedMessages.set(message.id, { message, scheduledVerification: scheduledVerification });
  }

  async performVerification(messageId: Snowflake, listenerId: SUUID | null) {
    return this.bot.verifyMessage(messageId, listenerId);
  }

  cancelScheduledVerification(messageId: Snowflake): Message | undefined {
    let item = this.queuedMessages.get(messageId);
    if (!item) {
      return undefined;
    }
    let { message, scheduledVerification } = item;
    if (scheduledVerification) {
      clearTimeout(scheduledVerification);
    }
    this.queuedMessages.delete(messageId);
    return message;
  }

  destroy() {
    this.queuedMessages.forEach(({ scheduledVerification: scheduledCheck }) => clearTimeout(scheduledCheck));
    this.queuedMessages.clear();
  }
}
