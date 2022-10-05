import type { TemplateOnlyComponent } from '@ember/component/template-only';

import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}

const GlintTestComponent: TemplateOnlyComponent<Signature> = 
<template>
    <h1>GlintTestComponent</h1>
</template>

export default GlintTestComponent;

