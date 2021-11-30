import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import BoxelContainsManyManager from '@cardstack/boxel/components/boxel/contains-many-manager';
import './edit.css';
import HttpsDemoComLinkField from '@cardstack/compiled/https-demo.com-link/edit-35fd91449f6aa8f0194a81ef8eea5c34.js';

import { helper } from '@ember/component/helper';

const log = helper(function (params) {
  console.log(...params);
});

export default setComponentTemplate(
  precompileTemplate(
    `<section class="links-edit">
      <header class="links-edit__header">Links</header>
      <div class="links-edit__list">
        <BoxelContainsManyManager
          @model={{@model}}
          @set={{@set.setters.links}}
        as |api|>
          <HttpsDemoComLinkField @model={{api.item}} @set={{@set.setters.links}} />
        </BoxelContainsManyManager>
      </div>
    </section>`,
    {
      strictMode: true,
      scope: () => ({ BoxelField, BoxelContainsManyManager, HttpsDemoComLinkField, log }),
    }
  ),
  templateOnlyComponent()
);
