import type { TemplateOnlyComponent } from '@ember/component/template-only';

export interface InfoAreaSignature {
  Element: HTMLDivElement;
  Args: {
    class?: string;
  };
  Blocks: {
    'default': [],
  }
}

const InfoArea: TemplateOnlyComponent<InfoAreaSignature> = <template>
  <div class={{@class}} ...attributes data-test-boxel-action-chin-info-area>
    {{yield}}
  </div>
</template>

export default InfoArea;