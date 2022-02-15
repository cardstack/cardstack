import Helper from '@ember/component/helper';
import { htmlSafe } from '@ember/template';
import { inject as service } from '@ember/service';
import TextFormattingService from '../services/text-formatting';

type FormatWorkflowMessageHelperParams = string[];

class FormatWorkflowMessageHelper extends Helper {
  @service declare textFormatting: TextFormattingService;
  compute([message]: FormatWorkflowMessageHelperParams /*, hash*/) {
    let { textFormatting } = this;
    let formatted = textFormatting.formatWorkflowMessage(message);
    return htmlSafe(formatted);
  }
}

export default FormatWorkflowMessageHelper;
