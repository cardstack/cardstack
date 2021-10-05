import Service from '@ember/service';
import MarkdownIt from 'markdown-it';

export default class TextFormattingService extends Service {
  renderer = new MarkdownIt({ typographer: true }).disable(['code']);

  formatWorkflowMessage(message) {
    return this.renderer.render(message);
  }
}
