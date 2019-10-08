import ENV from "dummy/config/environment";

export default [
  {
    id: 'text-field',
    title: 'Text Field',
    description: 'Description',
    mode: 'view',
    icon: `${ENV.rootURL}images/field-types/text.png`
  },
  {
    id: 'cta',
    title: 'CTA',
    description: 'Description',
    mode: 'view',
    icon: `${ENV.rootURL}images/field-types/cta.png`
  },
  {
    id: 'phone-number-field',
    title: 'Phone Number Field',
    description: 'Description',
    mode: 'view',
    icon: `${ENV.rootURL}images/field-types/phone-number.png`
  },
]
