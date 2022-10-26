import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    // example?: string;
  };
  Blocks: {
    'default': []
  }
}

export default class Boxel<%= classifiedModuleName %> extends Component<Signature> {
  <template>
    <div
      class="<%= cssClassName %>"
      data-test-<%= cssClassName %>
      ...attributes
    >
      {{yield}}
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    '<%= classComponentName %>': typeof Boxel<%= classifiedModuleName %>;
  }
}
