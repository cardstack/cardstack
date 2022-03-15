import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';

export default setComponentTemplate(
  precompileTemplate(
    `
    <@fields.firstName />
    <@fields.maritalStatus />
    <div data-test-field="salutation">
      <@fields.salutation />
    </div> 
    `,
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
