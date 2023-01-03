import Component from '@glimmer/component';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import cssVar from '@cardstack/boxel/helpers/css-var';

interface Signature {
  Element: HTMLElement;
  Args: {
  };
}

export default class SuccessIcon extends Component<Signature> {
  <template>
    <div ...attributes>
      {{svgJar
        'icon-x-circle-ht'
        style=(cssVar
          icon-color='var(--boxel-red)'
        )
      }}
    </div>
  </template>
}
