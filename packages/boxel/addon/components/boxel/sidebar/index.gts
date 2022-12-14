import type { TemplateOnlyComponent } from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelSidebarSection, { SidebarSectionSignature } from './section';
import { ComponentLike } from '@glint/template';

interface Signature {
  Element: HTMLElement;
  Args: {
    header?: string;
    noBackground?: boolean;
    isHighlighted?: boolean;
  };
  Blocks: {
    'default': [ComponentLike<SidebarSectionSignature>],
  }
}

const SidebarContainer: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-sidebar" ...attributes>
    {{yield BoxelSidebarSection}}
  </div>
</template>;

export default SidebarContainer;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Sidebar': typeof SidebarContainer;
  }
}
