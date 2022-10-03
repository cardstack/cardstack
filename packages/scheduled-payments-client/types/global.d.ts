// Types for compiled templates
declare module '@cardstack/scheduled-payments-client/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}
