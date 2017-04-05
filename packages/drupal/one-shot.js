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


const formatters = {
  boolean(value) {
    return value === '1';
  },
  integer(value) {
    return parseInt(value, 10);
  },
  string_long(value) {
    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  },
  text_with_summary(value) {
    if (!value) { return value; }
    try {
      return JSON.parse(value.value);
    } catch (err) {
      return value.value;
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
    .parse(process.argv);

  if (commander.args.length < 1) {
    commander.outputHelp();
    process.exit(-1);
  }

  commander.drupalURL = commander.args[0];
  return commander;
}

class Downloader {
  constructor({ drupalURL, outdir }) {
    this.drupalURL = drupalURL;
    this.outdir = outdir;
    this.fields = {};
    this.fieldTypeOverrides = {};
  }
  get(url) {
    let authorization = 'Basic ' + new Buffer(process.env.DRUPAL_USER + ':' + process.env.DRUPAL_PASS, 'utf8').toString('base64');
    return request.get(url).set('Authorization', authorization);
  }


  rewriteType(type) {
    return type
      .replace(/^node--/, '')
      .replace(/^taxonomy_term--/, '');
  }

  rewriteFieldName(fieldName /* , type */) {
    return fieldName.replace(/^field_/, '');
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

  rewriteRecord(record, fields) {
    let output = {
      id: record.id,
      type: this.rewriteType(record.type)
    };
    for (let [k,value] of Object.entries(record.attributes).concat(Object.entries(record.relationships))) {
      // uuid is always redundant because the drupal jsonapi module
      // uses it as the jsonapi id.
      if (k === 'uuid') { continue; }
      let fieldType;
      let field = fields.find(f => f.attributes.field_name === k);
      if (field) {
        fieldType = field.attributes.field_type;
      } else if (baseFields[k]) {
        fieldType = baseFields[k];
      } else {
        throw new Error(`Unknown field ${k} on ${record.type} ${record.id}`);
      }
      if (formatters[fieldType]) {
        value = formatters[fieldType](value);
      }

      if ((fieldType === 'string_long' || fieldType === 'string') && value && typeof value !== 'string') {
        if (value.hasOwnProperty('atoms')) {
          this.fieldTypeOverrides[k] = 'mobiledoc';
        } else {
          this.fieldTypeOverrides[k] = 'any';
        }
      }

      if (['entity_reference', 'file'].includes(fieldType)) {
        if (!output.relationships) {
          output.relationships = {};
        }
        output.relationships[this.rewriteFieldName(k, record.type)] = this.rewriteRef(value);
      } else {
        if (!output.attributes) {
          output.attributes = {};
        }
        output.attributes[this.rewriteFieldName(k, record.type)] = value;
      }
    }
    return output;
  }

  rewriteFieldType(fieldType, sampleValue) {
    switch (fieldType) {
    case 'mobiledoc':
      return `@cardstack/mobiledoc`;
    case 'entity_reference':
    case 'file':
      if (sampleValue && Array.isArray(sampleValue.data)) {
        return `@cardstack/core-types::has-many`;
      } else {
        return `@cardstack/core-types::belongs-to`;
      }
    case 'decimal':
    case 'text_with_summary':
    case 'string_long':
      return `@cardstack/core-types::string`;
    case 'datetime':
      return `@cardstack/core-types::date`;
    default:
      return `@cardstack/core-types::${fieldType}`;
    }
  }

  async createField(origFieldName, fieldType, sampleValue) {
    if (this.fieldTypeOverrides[origFieldName]) {
      fieldType = this.fieldTypeOverrides[origFieldName];
    }

    let fieldName = this.rewriteFieldName(origFieldName);
    if (this.fields[fieldName]){
      if (!this.fields[fieldName] === fieldType) {
        throw new Error(`${fieldName} has conflicting types`);
      }
      return;
    }

    this.fields[fieldName] = fieldType;
    await this.saveRecord({
      type: 'fields',
      id: fieldName,
      attributes: {
        'field-type': this.rewriteFieldType(fieldType, sampleValue)
      }
    });
  }

  async defineTaxonomyType(type) {
    let contentType = {
      type: 'content-types',
      id: type.attributes.vid,
      relationships: {
        fields: {
          data: taxonomyFields.map(t => ({ type: 'fields', id: t }))
        }
      }
    };
    await this.saveRecord(contentType);

    // the only relationships (parent) is always plural
    let sample = { data: [] };

    for (let f of taxonomyFields) {
      await this.createField(f, baseFields[f], sample);
    }
  }

  async defineContentType(type, fields, sample) {
    let contentType = {
      type: 'content-types',
      id: type.attributes.type,
      relationships: {
        fields: {
          data: nodeBaseFields.map(t => ({ type: 'fields', id: t }))
            .concat(fields.map(f => ({ type: 'fields', id: this.rewriteFieldName(f.attributes.field_name) })))
        }
      }
    };
    await this.saveRecord(contentType);
    for (let f of nodeBaseFields) {
      let fieldType = baseFields[f];
      let sampleValue;
      if (['entity_reference', 'file'].includes(fieldType)) {
        sampleValue = sample.relationships[f];
      } else {
        sampleValue = sample.attributes[f];
      }
      await this.createField(f, fieldType, sampleValue);
    }
    for (let f of fields) {
      let fieldType = f.attributes.field_type;
      let fieldName = f.attributes.field_name;
      let sampleValue;
      if (['entity_reference', 'file'].includes(fieldType)) {
        sampleValue = sample.relationships[fieldName];
      } else {
        sampleValue = sample.attributes[fieldName];
      }
      await this.createField(fieldName, fieldType, sampleValue);
    }
  }

  async run() {
    for (let type of (await this.getCollection('/taxonomy_vocabulary/taxonomy_vocabulary'))) {
      let records = await this.getCollection(`/taxonomy_term/${type.attributes.vid}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, []));
      }
      await this.defineTaxonomyType(type);
    }
    for (let type of (await this.getNodeTypes())) {
      let fields = await this.getFields(type);
      let records = await this.getCollection(`/node/${type.attributes.type}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, fields));
      }
      if (records.length > 0) {
        await this.defineContentType(type, fields, records[0]);
      }
    }
  }
}

let downloader = new Downloader(commandLineOptions());
downloader.run();
