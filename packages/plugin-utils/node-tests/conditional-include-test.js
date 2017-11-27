const ConditionalInclude = require('../conditional-include');
const path = require('path');
const fs = require('fs-extra');
const fixturify = require('fixturify');
const { Builder } = require('broccoli-builder');
const walkSync = require('walk-sync');

describe("broccoli conditional include", function() {
  let builder;
  let input = path.resolve(__dirname, '../tmp/INPUT');

  beforeEach(function() {
    fs.mkdirpSync(input);
    fixturify.writeSync(input, {
      dir1: {
        'foo.txt': 'hello world'
      }
    });
  });

  afterEach(async function() {
    fs.removeSync(input);
    if (builder) {
      await builder.cleanup();
    }
  });

  it('builds when enabled', async function() {
    let node = new ConditionalInclude(input, { name: 'test', predicate: function(){ return true; }});
    builder = new Builder(node);
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql(walkSync(input, ['**/*']));
  });

  it('builds when disabled', async function() {
    let node = new ConditionalInclude(input, { name: 'test', predicate: function(){ return false; }});
    builder = new Builder(node);
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql([]);
  });

});
