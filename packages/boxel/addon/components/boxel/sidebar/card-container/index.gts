import type { TemplateOnlyComponent } from '@ember/component/template-only';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';


interface Signature {
  Element: HTMLDivElement;
  Args: {
    header?: string;
    attachNext?: boolean;
  };
  Blocks: {
    'default': [],
  }
}
const SidebarCardContainer: TemplateOnlyComponent<Signature> = <template>

  <div class={{cn
      "boxel-sidebar-card-container"
      boxel-sidebar-card-container--attach-next=@attachNext
    }}
    ...attributes
  >
    {{#if @header}}
      <header class="boxel-sidebar-card-container__header">
        {{@header}}
      </header>
    {{/if}}

    <div class="boxel-sidebar-card-container__content">
      {{yield}}
    </div>
  </div>
  </template>;

export default SidebarCardContainer;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Sidebar::CardContainer': typeof SidebarCardContainer;
  }
}
