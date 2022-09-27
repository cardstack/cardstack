import Component from '@glimmer/component';
import autoscroll from '@cardstack/boxel/modifiers/autoscroll';
import BoxelSidebar from '../sidebar';
import { ComponentLike } from '@glint/template';
import { SidebarSectionSignature } from '../sidebar/section';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
 Element: HTMLElement;
 Args: {
  autoscroll?: boolean;
 };
 Blocks: {
  header: [];
  taskbar: [];
  content: [];
  sidebar: [ComponentLike<SidebarSectionSignature>]
 };
};


export default class Thread extends Component<Signature> {
  <template>
    <article class="boxel-thread" data-test-boxel-thread ...attributes>
      <div class="boxel-thread__sticky-container">
        {{yield to="header"}}
      </div>

      <div class="boxel-thread__content-wrapper">
        {{!-- Note that tabindex=0 is applied to ensure that this scroll context can be reached and operated by keyboard --}}
        <div class="boxel-thread__scroll-wrapper" tabindex="0" {{autoscroll enabled=@autoscroll}}>
          <div class="boxel-thread__sticky-container">
            {{yield to="taskbar"}}
          </div>
          <section class="boxel-thread__content">
            {{yield to="content"}}
          </section>
        </div>

        {{!-- Note that tabindex=0 is applied to ensure that this scroll context can be reached and operated by keyboard --}}
        <div class="boxel-thread__scroll-wrapper" tabindex="0">
          <BoxelSidebar class="boxel-thread__sidebar" as |SidebarSection|>
            {{yield SidebarSection to="sidebar"}}
          </BoxelSidebar>
        </div>
      </div>
    </article>
  </template>
}
