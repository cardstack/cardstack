export const fieldTypeMappings = {
  string: '@cardstack/core-types::string',
  'case-insensitive string': '@cardstack/core-types::case-insensitive',
  boolean: '@cardstack/core-types::boolean',
  date: '@cardstack/core-types::date',
  integer: '@cardstack/core-types::integer',
  'related card': '@cardstack/core-types::belongs-to',
  'related cards': '@cardstack/core-types::has-many',
  'decorative image': '@cardstack/core-types::decorative-image',

  // Probably want to omit these types as they could probably be better
  // handled as related cards:
  // '@cardstack/core-types::string-array',
  // '@cardstack/core-types::object',
};

export const fieldComponents = [
  {
    id: 'text-field',
    coreType: '@cardstack/core-types::string',
    title: 'Text',
    description: 'All-purpose text field',
    type: 'string',
    icon: `/assets/images/field-types/text.svg`,
  },
  {
    id: 'text-field-case-insensitive',
    coreType: '@cardstack/core-types::case-insensitive',
    title: 'Text (case-insensitive)',
    description: 'Case-insensitive text field',
    type: 'case-insensitive string',
    icon: `/assets/images/field-types/text.svg`,
  },
  {
    id: 'checkbox',
    coreType: '@cardstack/core-types::boolean',
    title: 'Checkbox',
    description: 'True/false (boolean) values',
    type: 'boolean',
    icon: `/assets/images/field-types/checkbox.svg`,
  },
  {
    id: 'date-field',
    coreType: '@cardstack/core-types::date',
    title: 'Date',
    description: 'Date field',
    type: 'date',
    icon: `/assets/images/field-types/calendar.svg`,
  },
  {
    id: 'number',
    coreType: '@cardstack/core-types::integer',
    title: 'Number',
    description: 'Integer number field',
    type: 'integer',
    icon: `/assets/images/field-types/number.png`,
  },
  {
    id: 'dropdown',
    coreType: '@cardstack/core-types::belongs-to',
    title: 'Single-select',
    description: 'Single select dropdown',
    type: 'related card',
    icon: `/assets/images/field-types/dropdown.svg`,
  },
  {
    id: 'dropdown-multi',
    coreType: '@cardstack/core-types::has-many',
    title: 'Multi-select',
    description: 'Multiple select dropdown',
    type: 'related cards',
    icon: `/assets/images/field-types/dropdown.svg`,
  },
  {
    id: 'decorative-image',
    coreType: '@cardstack/core-types::decorative-image',
    title: 'Decorative image',
    description: 'Use this for images that are decorative, not informative',
    type: 'decorative image',
    icon: `/assets/images/field-types/image.svg`,
  },
  // We'll need to figure out how to deal with the other types of ui-components, ex:
  // {
  //   id: 'text-area',
  //   title: 'Text Area',
  //   description: 'Multi-line text field',
  //   type: 'string',
  //   icon: `/assets/images/field-types/textarea.png`
  // },
  // {
  //   id: 'phone-number-field',
  //   title: 'Phone Number',
  //   description: 'Description',
  //   type: 'string',
  //   icon: `/assets/images/field-types/phone-number.png`
  // },
];
