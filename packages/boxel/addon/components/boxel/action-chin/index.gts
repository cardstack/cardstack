import Component from '@glimmer/component';

export interface Signature {
  Element: HTMLDivElement;
  Args: {};
}

export default class ActionChin extends Component<Signature> {
  <template>
    <div
      class={{someHelper
        "boxel-action-chin"
      }}
    >
    </div>
  </template>
}

function someHelper(anArg: string) {
  return `a string: ${anArg}`;
}
