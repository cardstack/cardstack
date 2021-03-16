// Types for compiled templates
declare module 'cardhost/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

declare module '@ember/component' {
  export function setComponentTemplate<T, C>(template: T, component: C): C;
}
