import type { TemplateOnlyComponent } from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';


export interface SidebarSectionSignature {
  Element: HTMLElement;
  Args: {
    title?: string;
  };
  Blocks: {
    'default': [],
  }
}

const SidebarSection: TemplateOnlyComponent<SidebarSectionSignature> = <template>
  <section class="boxel-sidebar-section" ...attributes>
    {{#if @title}}
      <h3 class="boxel-sidebar-section__title">
        {{@title}}
      </h3>
    {{/if}}

    <div class="boxel-sidebar-section__content">
      {{yield}}
    </div>
  </section>
</template>;

export default SidebarSection;

