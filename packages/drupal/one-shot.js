const commander = require('commander');
const request = require('superagent');
const denodeify = require('denodeify');
const fs = require('fs');
const writeFile = denodeify(fs.writeFile);
const mkdirp = denodeify(require('mkdirp'));

const baseFields = {
  nid: 'integer',
  uuid: 'string',
  vid: 'integer',
  langcode: 'string',
  title: 'string',
  status: 'boolean',
  created: 'integer',
  changed: 'integer',
  promote: 'boolean',
  sticky: 'boolean',
  revision_timestamp: 'integer',
  revision_log: 'string',
  revision_translation_affected: 'boolean',
  default_langcode: 'boolean',
  path: 'string',
  type: 'entity_reference',
  uid: 'entity_reference',
  revision_uid: 'entity_reference',
  tid: 'integer',
  name: 'string',
  description: 'string',
  weight: 'integer',
  parent: 'entity_reference'
};

const nodeBaseFields = [
  'nid',
  'uuid',
  'vid',
  'langcode',
  'title',
  'status',
  'created',
  'changed',
  'promote',
  'sticky',
  'revision_timestamp',
  'revision_log',
  'revision_translation_affected',
  'default_langcode',
  'path',
  'type',
  'uid',
  'revision_uid'
];

const taxonomyFields = [
  'tid',
  'langcode',
  'name',
  'description',
  'weight',
  'changed',
  'default_langcode',
  'path',
  'vid'
];

// The JSONAPI spec doesn't allow "type" as a field name. I filed a
// bug upstream: https://www.drupal.org/node/2867462
const defaultFieldRemapping = [
  [/./, /^type$/, 'drupal_type']
];

const formatters = {
  boolean(value) {
    return value === '1';
  },
  integer(value) {
    return parseInt(value, 10);
  },
  text_with_summary(value) {
    if (value) {
      return value.value;
    } else {
      return value;
    }
  }
};

function commandLineOptions() {
  if (!process.env.DRUPAL_PASS || !process.env.DRUPAL_USER) {
    process.stderr.write("You must set DRUPAL_USER and DRUPAL_PASS environment variables\n");
    process.exit(-1);
  }

  commander
    .usage('[options] <drupal-jsonapi-url>')
    .option('-o --outdir <dir>', 'Output directory.', './out')
    .option('-c --customizations <module>', 'Customization rules.', './customization')
    .parse(process.argv);

  if (commander.args.length < 1) {
    commander.outputHelp();
    process.exit(-1);
  }

  commander.drupalURL = commander.args[0];
  commander.custom = require(commander.customizations);

  return commander;
}

class Downloader {
  constructor({ drupalURL, outdir, custom }) {
    this.drupalURL = drupalURL;
    this.outdir = outdir;
    this.custom = custom;
    this.formatters = Object.assign({}, formatters, custom.formatters);
    this.fieldRemapping = custom.fieldRemapping.concat(defaultFieldRemapping);
    this.fieldTypes = {};
  }

  get(url) {
    let authorization = 'Basic ' + new Buffer(process.env.DRUPAL_USER + ':' + process.env.DRUPAL_PASS, 'utf8').toString('base64');
    return request.get(url).set('Authorization', authorization);
  }


  rewriteType(type) {
    for (let [pattern, replacement] of this.custom.typeRemapping) {
      if (pattern.test(type)) {
        return type.replace(pattern, replacement);
      }
    }
    return type;
  }

  rewriteFieldName(typeName, fieldName) {
    for (let [typePattern, fieldPattern, replacement] of this.fieldRemapping) {
      if (typePattern.test(typeName) && fieldPattern.test(fieldName)) {
        return fieldName.replace(fieldPattern, replacement);
      }
    }
    return fieldName;
  }

  async getNodeTypes() {
    return this.getCollection('/node_type/node_type');
  }

  async getFields(nodeType) {
    return this.getCollection(`/field_config/field_config?filter[entity_type][value]=node&filter[bundle][value]=${nodeType.attributes.type}`);
  }

  async getCollection(collectionPath) {
    let url = this.drupalURL + collectionPath;
    let records = [];
    while (url) {
      process.stdout.write(url + ' ');
      let response = await this.get(url);
      process.stdout.write(String(response.body.data.length) + "\n");
      records = records.concat(response.body.data);
      url = response.body.links.next;
    }
    return records;
  }

  async saveRecord(record) {
    let { type, id } = record;
    let section = ['content-types', 'fields'].includes(type) ? 'schema' : 'contents';
    let dir = [this.outdir, section, type].join('/');
    await mkdirp(dir);
    await writeFile([dir, id + '.json'].join('/'), JSON.stringify({
      attributes: record.attributes,
      relationships: record.relationships
    }, null, 2));
  }

  rewriteRef(value) {
    if (!value || !value.data) {
      return value;
    }
    if (Array.isArray(value.data)) {
      return { data : value.data.map(r => ({ type: this.rewriteType(r.type), id: r.id })) };
    } else {
      return { data: { type: this.rewriteType(value.data.type), id: value.data.id } };
    }
  }

  cardstackType(fieldType, fieldName, sampleValue) {
    for (let [fieldPattern, typeName] of this.custom.fieldTypes) {
      if (typeof fieldPattern === 'string') {
        if (fieldPattern === fieldName) {
          return typeName;
        }
      } else if (fieldPattern.test(fieldName)) {
        return typeName;
      }
    }
    switch (fieldType) {
    case 'entity_reference':
    case 'file':
      if (sampleValue && Array.isArray(sampleValue.data)) {
        return `@cardstack/core-types::has-many`;
      } else {
        return `@cardstack/core-types::belongs-to`;
      }
    case 'datetime':
      return `@cardstack/core-types::date`;
    case 'integer':
      return `@cardstack/core-types::integer`;
    case 'boolean':
      return `@cardstack/core-types::boolean`;
    case 'decimal':
    case 'text_with_summary':
    case 'string_long':
    default:
      return `@cardstack/core-types::string`;
    }
  }

  rewriteRecord(record, fields) {
    let output = {
      id: record.id,
      type: this.rewriteType(record.type)
    };
    for (let [originalFieldName, value] of Object.entries(record.attributes).concat(Object.entries(record.relationships))) {
      // uuid is always redundant because the drupal jsonapi module
      // uses it as the jsonapi id.
      if (originalFieldName === 'uuid') { continue; }

      let fieldName = this.rewriteFieldName(output.type, originalFieldName);
      let fieldType;


      let field = fields.find(f => f.attributes.field_name === originalFieldName);
      if (field) {
        fieldType = field.attributes.field_type;
      } else if (baseFields[originalFieldName]) {
        fieldType = baseFields[originalFieldName];
      } else {
        throw new Error(`Unknown field ${originalFieldName} on ${record.type} ${record.id}`);
      }

      if (this.formatters[fieldType]) {
        value = this.formatters[fieldType](value);
      }

      let cardstackType = this.cardstackType(fieldType, fieldName, value);
      if (this.formatters[cardstackType]) {
        try {
          value = this.formatters[cardstackType](value);
        } catch (err) {
          process.stderr.write(`formatter failed for ${cardstackType} ${fieldName} ${value}\n`);
          throw err;
        }
      }

      this.rememberField(fieldName, cardstackType);

      if (['entity_reference', 'file'].includes(fieldType)) {
        if (!output.relationships) {
          output.relationships = {};
        }
        output.relationships[fieldName] = this.rewriteRef(value);
      } else {
        if (!output.attributes) {
          output.attributes = {};
        }
        output.attributes[fieldName] = value;
      }
    }
    return output;
  }

  rememberField(fieldName, cardstackType) {
    let had = this.fieldTypes[fieldName];
    if (had && had !== cardstackType) {
      throw new Error(`conflicting types for ${fieldName}: ${had} vs ${cardstackType}`);
    }
    this.fieldTypes[fieldName] = cardstackType;
  }

  async flushFields() {
    for (let [name, type] of Object.entries(this.fieldTypes)) {
      await this.saveRecord({
        type: 'fields',
        id: name,
        attributes: {
          'field-type': type
        }
      });
    }
  }

  async defineTaxonomyType(vid) {
    let contentType = {
      type: 'content-types',
      id: vid,
      relationships: {
        fields: {
          data: taxonomyFields.map(t => ({ type: 'fields', id: t }))
        }
      }
    };
    await this.saveRecord(contentType);
  }

  async defineContentType(originalTypeName, fields) {
    let typeName = this.rewriteType(originalTypeName);
    let contentType = {
      type: 'content-types',
      id: typeName,
      relationships: {
        fields: {
          data: nodeBaseFields.map(t => ({ type: 'fields', id: t }))
            .concat(fields.map(f => ({ type: 'fields', id: this.rewriteFieldName(typeName, f.attributes.field_name) })))
        }
      }
    };
    await this.saveRecord(contentType);
  }

  async run() {
    for (let type of (await this.getCollection('/taxonomy_vocabulary/taxonomy_vocabulary'))) {
      let records = await this.getCollection(`/taxonomy_term/${type.attributes.vid}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, []));
      }
      await this.defineTaxonomyType(type.attributes.vid);
    }
    for (let type of (await this.getNodeTypes())) {
      let fields = await this.getFields(type);
      let records = await this.getCollection(`/node/${type.attributes.type}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, fields));
      }
      if (records.length > 0) {
        await this.defineContentType(type.attributes.type, fields);
      }
    }
    await this.flushFields();
  }
}

process.on('warning', (warning) => {
  process.stderr.write(warning.stack);
});

let downloader = new Downloader(commandLineOptions());
downloader.run();
