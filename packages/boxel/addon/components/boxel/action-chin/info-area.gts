import type { TemplateOnlyComponent } from '@ember/component/template-only';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    class?: string;
  };
  Blocks: {
    'default': [],
  }
}

const InfoArea: TemplateOnlyComponent<Signature> = <template>
  <div class={{@class}} ...attributes data-test-boxel-action-chin-info-area>
    {{yield}}
  </div>
</template>

export default InfoArea;