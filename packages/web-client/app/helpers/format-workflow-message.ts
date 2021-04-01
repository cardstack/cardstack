import { helper } from '@ember/component/helper';

type FormatWorkflowMessageHelperParams = string[];

export function formatWorkflowMessage(
  [message]: FormatWorkflowMessageHelperParams /*, hash*/
) {
  return message;
}

export default helper(formatWorkflowMessage);
