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

  // taxonomy specific
  tid: 'integer',
  name: 'string',
  description: 'string',
  weight: 'integer',
  parent: 'entity_reference'
};


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
    await mkdirp([this.outdir, type].join('/'));
    await writeFile([this.outdir, type, id + '.json'].join('/'), JSON.stringify({
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

  async run() {
    for (let type of (await this.getCollection('/taxonomy_vocabulary/taxonomy_vocabulary'))) {
      let records = await this.getCollection(`/taxonomy_term/${type.attributes.vid}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, []));
      }
    }

    for (let type of (await this.getNodeTypes())) {
      let fields = await this.getFields(type);
      let records = await this.getCollection(`/node/${type.attributes.type}`);
      for (let record of records) {
        await this.saveRecord(this.rewriteRecord(record, fields));
      }
    }
  }
}

let downloader = new Downloader(commandLineOptions());
downloader.run();
