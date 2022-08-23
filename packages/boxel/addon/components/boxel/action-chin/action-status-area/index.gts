import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import type { TemplateOnlyComponent } from '@ember/component/template-only';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    icon?: string;
  };
  Blocks: {
    'default': [],
  }
}

const StatusArea: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-action-chin__action-status-area" ...attributes data-test-boxel-action-chin-action-status-area>
    {{#if @icon}}
      {{svgJar @icon class="boxel-action-chin__action-status-area-icon" width="20" height="20" role="presentation"}}
    {{/if}}
    {{yield}}
  </div>
</template>

export default StatusArea;

