// list of patterns that will be tried in order for remapping the
// Drupal JSONAPI module's type names to whatever we prefer.
exports.typeRemapping = [
  [/^node--(.*)$/, '$1'],
  [/^taxonomy_term--(.*)$/, '$1']
];

// list of [typePattern, fieldPattern, fieldReplacment]
//   where
// typePattern will be run against the type *after* it has gone through the above typeRemapping
// fieldPattern will be run against the field name as it comes from drupal ("field_my_custom_thing").
exports.fieldRemapping = [
  [/^showcase$/, /^field_credit$/, 'showcase_credit'],
  [/./, /^field_(.*)$/, '$1']
];

// field types can be inferred automatically, but you may wish to
// override some. The left side of each of these is a pattern that
// will run against the field name *after* it has been remapped via
// fieldRemapping above.
exports.fieldTypes = [
  ['about_the_contributor', "@cardstack/mobiledoc"],
  ['agenda', "@cardstack/mobiledoc"],
  ['attachments_body', "@cardstack/mobiledoc"],
  ['body', "@cardstack/mobiledoc"],
  ['showcase_credit', "@cardstack/mobiledoc"],
  ['contact', "@cardstack/mobiledoc"],
  ['contact_info', "@cardstack/mobiledoc"],
  ['discount_info', "@cardstack/mobiledoc"],
  ['jury', "@cardstack/mobiledoc"],
  ['materials', "@cardstack/mobiledoc"],
  ['mobiledoc_answer', "@cardstack/mobiledoc"],
  ['officers', "@cardstack/mobiledoc"],
  ['overview', "@cardstack/mobiledoc"],
  ['partner_news', "@cardstack/mobiledoc"],
  ['project_description', "@cardstack/mobiledoc"],
  ['project_information', "@cardstack/mobiledoc"],
  ['registration', "@cardstack/mobiledoc"],
  ['secondary_body', "@cardstack/mobiledoc"],
  ['speakers', "@cardstack/mobiledoc"],
  ['sponsors', "@cardstack/mobiledoc"],
  ['staff', "@cardstack/mobiledoc"],
  ['summary', "@cardstack/mobiledoc"],
  ['ad_links', "@cardstack/core-types::object"],
  ['chapters', "@cardstack/core-types::object"],
  ['crops', "@cardstack/core-types::object"],
  ['image_captions', "@cardstack/core-types::object"],
  ['image_titles', "@cardstack/core-types::object"],
  ['page_references', "@cardstack/core-types::object"],
  ['pick_lists', "@cardstack/core-types::object"],
  ['product_reference', "@cardstack/core-types::object"],
  ['showcase_image_captions', "@cardstack/core-types::object"],
  ['tabs', "@cardstack/core-types::object"],
  ['tile_labels', "@cardstack/core-types::object"],
  ['tile_links', "@cardstack/core-types::object"],
  ['updates', "@cardstack/core-types::object"],
  [/_text_box/, "@cardstack/core-types::string"],
  [/_box$/, "@cardstack/mobiledoc"]
];

// your remapped types may need postprocessing. The input value they
// receive will have already gone through the base formatter for its
// actual drupal type (so if the drupal type is "boolean", the value
// will have already been converting from "1" to "true" and your
// formatter will see "true".
//
// the keys here can be both drupal types (like "text_with_summary")
// and your own remapped types (which are presumably formatted as
// cardstack types like "@cardstack/core-types::string").
exports.formatters = {
  '@cardstack/mobiledoc': function(value) {
    if (value) {
      return JSON.parse(value);
    } else {
      return value;
    }
  },
  '@cardstack/core-types::object': function(value) {
    if (value) {
      return JSON.parse(value);
    } else {
      return value;
    }
  }
};
