const commander = require('commander');
const request = require('superagent');
const denodeify = require('denodeify');
const fs = require('fs');
const writeFile = denodeify(fs.writeFile);
const mkdirp = denodeify(require('mkdirp'));

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

function rewriteType(type) {
  return type.replace(/^node--/, '');
}

async function getNodeTypes(options) {
  let url = options.drupalURL + '/node_type/node_type';
  let types = [];
  while (url) {
    let response = await request.get(url);
    types = types.concat(response.body.data);
    url = response.body.links.next;
  }
  return types;
}

function basic() {
  return 'Basic ' + new Buffer(process.env.DRUPAL_USER + ':' + process.env.DRUPAL_PASS, 'utf8').toString('base64');
}

async function getFields(options, nodeType) {
  let url = options.drupalURL + `/field_config/field_config?filter[entity_type][value]=node&filter[bundle][value]=${nodeType.attributes.type}`;
  let fields = [];
  while (url) {
    console.log(url);
    let response = await request.get(url).set('Authorization', basic());
    fields = fields.concat(response.body.data);
    url = response.body.links.next;
  }
  return fields;
}

async function getCollection(options, collectionPath) {
  let url = options.drupalURL + collectionPath;
  while (url) {
    process.stdout.write(url + ' ');
    let response = await request.get(url);
    process.stdout.write(String(response.body.data.length) + "\n");
    for (let record of response.body.data) {
      let type = rewriteType(record.type);
      let id = record.id;
      await mkdirp([options.outdir, type].join('/'));
      await writeFile([options.outdir, type, id + '.json'].join('/'), JSON.stringify({
        attributes: record.attributes,
        relationships: record.relationships
      }, null, 2));
    }
    url = response.body.links.next;
  }
}

async function run(options) {
  for (let type of (await getNodeTypes(options))) {
    //await getCollection(options, '/node/' + type.attributes.type);
    let fields = await getFields(options, type);
    console.log(fields.map(f => ({
      name: f.attributes.field_name,
      type: f.attributes.field_type
    })));
    break;
  }
}

let options = commandLineOptions();
run(options);
