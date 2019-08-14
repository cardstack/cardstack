import { JSONAPISerializer } from 'ember-cli-mirage';

export default class ApplicationSerializer extends JSONAPISerializer {
  alwaysIncludeLinkageData = true;
}
