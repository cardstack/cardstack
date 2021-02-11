import { setComponentTemplate } from "@ember/component";
import templateOnlyComponent from "@ember/component/template-only";
import template from "./hello.hbs";
export default setComponentTemplate(template, templateOnlyComponent());
