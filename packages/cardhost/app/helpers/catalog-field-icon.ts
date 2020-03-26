import { helper } from '@ember/component/helper';

export default helper(function catalogFieldIcon([title]) {
  const iconMap = [
    {
      title: 'Text',
      icon: 'text-field',
    },
    {
      title: 'Checkbox',
      icon: 'boolean-field-icon',
    },
    {
      title: 'Number',
      icon: 'integer-field-icon',
    },
    {
      title: 'Date',
      icon: 'date-field-icon',
    },
    {
      title: 'Date-time',
      icon: 'date-field-icon',
    },
    {
      title: 'Link',
      icon: 'link-field-icon',
    },
    {
      title: 'Image',
      icon: 'image-field-icon',
    },
    {
      title: 'Image from relative URL',
      icon: 'image-field-icon',
    },
    {
      title: 'Button link',
      icon: 'cta-field-icon',
    },
    {
      title: 'Base Card',
      icon: 'link-field-icon',
    },
  ];

  let matched = iconMap.find(field => {
    return field.title === title;
  });

  if (matched) {
    return matched.icon;
  }
});
