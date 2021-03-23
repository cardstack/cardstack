import { setComponentTemplate } from "@ember/component";
import { precompileTemplate } from "@ember/template-compilation";
import templateOnlyComponent from "@ember/component/template-only";

const FormatDate = setComponentTemplate(
  precompileTemplate("FORMATTED DATE: {{@date}}", {
    strictMode: true,
    scope: { FormatDate },
  }),
  templateOnlyComponent()
);

export default setComponentTemplate(
  precompileTemplate("<FormatDate @date={{@model}} />", {
    strictMode: true,
    scope: { FormatDate },
  }),
  templateOnlyComponent()
);
