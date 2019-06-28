interface File {
  filename: string;
  contents: string;
  [key: string]: string;
}

interface Blueprint {
  [key: string]: File[];
}

const blueprint: Blueprint = {
  components: [
    {
      filename: "embedded.css",
      contents: ""
    },
    {
      filename: "embedded.hbs",
      contents: "{{outlet}}"
    },
    {
      filename: "embedded.js",
      contents: `import Component from '@glimmer/component';

export default class EmbeddedComponent extends Component {}
`
    },
    {
      filename: "isolated.css",
      contents: ""
    },
    {
      filename: "isolated.hbs",
      contents: "{{outlet}}"
    },
    {
      filename: "isolated.js",
      contents: `import Component from '@glimmer/component';

export default class IsolatedComponent extends Component {}
`
    }
  ]
};

export default blueprint;
