// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownTasks {}

// if any new tasks are added, this must be updated.
// vscode can help with this, via Cmd + . -> 'Add missing properties'
const ALL_KNOWN_TASKS: Record<keyof KnownTasks, true> = {
  's3-put-json': true,
  'create-cloudfront-invalidation': true,
  'create-profile': true,
  'discord-post': true,
  'send-notifications': true,
  'notify-merchant-claim': true,
  'notify-customer-payment': true,
  'send-email-card-drop-verification': true,
  'notify-prepaid-card-drop': true,
  'subscribe-email': true,
  'remove-old-sent-notifications': true,
  'wyre-transfer': true,
  'print-queued-jobs': true,
  'persist-off-chain-prepaid-card-customization': true,
  'persist-off-chain-merchant-info': true,
  boom: true,
};

export function isKnownTask(k: string): k is keyof KnownTasks {
  return ALL_KNOWN_TASKS[k as keyof KnownTasks];
}
