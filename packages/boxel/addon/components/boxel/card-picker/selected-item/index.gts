import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';

export interface Signature {
  Args: EmptyObject;
  Blocks: EmptyObject;
}

const SelectedItem: TemplateOnlyComponent<Signature> = <template>
  Change Card
</template>

export default SelectedItem;
