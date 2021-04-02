import Service from '@ember/service';
import { Parser, HtmlRenderer } from 'commonmark';

export default class TextFormattingService extends Service {
  commonmarkParser = new Parser({ smart: true });
  commonmarkRenderer = new HtmlRenderer({ safe: true });

  formatWorkflowMessage(message) {
    let parsed = this.commonmarkParser.parse(message);
    return this.commonmarkRenderer.render(parsed);
  }
}
