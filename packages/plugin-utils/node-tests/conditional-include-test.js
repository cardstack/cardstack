const ConditionalInclude = require('../conditional-include');
const path = require('path');
const fs = require('fs-extra');
const fixturify = require('fixturify');
const { Builder } = require('broccoli-builder');
const walkSync = require('walk-sync');

describe('broccoli conditional include', function() {
  let builder;
  let input = path.resolve(__dirname, '../tmp/INPUT');

  beforeEach(function() {
    fs.mkdirpSync(input);
    fixturify.writeSync(input, {
      dir1: {
        'foo.txt': 'hello world',
        'bar.txt': 'goodbye',
        'baz.txt': 'stable',
      },
    });
  });

  afterEach(async function() {
    fs.removeSync(input);
    if (builder) {
      await builder.cleanup();
    }
  });

  it('builds when enabled', async function() {
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return true;
      },
    });
    builder = new Builder(node);
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql(walkSync(input, ['**/*']));
  });

  it('builds when disabled', async function() {
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return false;
      },
    });
    builder = new Builder(node);
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql([]);
  });

  it('rebuilds when still enabled', async function() {
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return true;
      },
    });
    builder = new Builder(node);
    await builder.build();
    fs.writeFileSync(`${input}/created-top-level.txt`, 'created', 'utf8');
    fs.writeFileSync(`${input}/dir1/created-inner.txt`, 'created', 'utf8');
    fs.writeFileSync(`${input}/dir1/foo.txt`, 'edited', 'utf8');
    fs.removeSync(`${input}/dir1/bar.txt`);
    let { directory: output } = await builder.build();
    let have = walkSync(output, ['**/*']);
    expect(have).contains('created-top-level.txt');
    expect(have).contains('dir1/created-inner.txt');
    expect(have).not.contains('dir1/bar.txt');
    expect(fs.readFileSync(`${input}/dir1/foo.txt`, 'utf8')).to.eql('edited');
  });

  it('rebuilds when still disabled', async function() {
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return false;
      },
    });
    builder = new Builder(node);
    await builder.build();
    fs.writeFileSync(`${input}/created-top-level.txt`, 'created', 'utf8');
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql([]);
  });

  it('rebuilds when going from enabled to disabled', async function() {
    let enabled = true;
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return enabled;
      },
    });
    builder = new Builder(node);
    await builder.build();
    fs.writeFileSync(`${input}/created-top-level.txt`, 'created', 'utf8');
    enabled = false;
    let { directory: output } = await builder.build();
    expect(walkSync(output, ['**/*'])).to.eql([]);
  });

  it('rebuilds when going from disabled to enabled', async function() {
    let enabled = false;
    let node = new ConditionalInclude(input, {
      name: 'test',
      predicate: function() {
        return enabled;
      },
    });
    builder = new Builder(node);
    await builder.build();
    fs.writeFileSync(`${input}/created-top-level.txt`, 'created', 'utf8');
    fs.writeFileSync(`${input}/dir1/created-inner.txt`, 'created', 'utf8');
    fs.writeFileSync(`${input}/dir1/foo.txt`, 'edited', 'utf8');
    fs.removeSync(`${input}/dir1/bar.txt`);
    enabled = true;
    let { directory: output } = await builder.build();
    let have = walkSync(output, ['**/*']);
    expect(have).contains('created-top-level.txt');
    expect(have).contains('dir1/created-inner.txt');
    expect(have).contains('dir1/baz.txt');
    expect(have).not.contains('dir1/bar.txt');
    expect(fs.readFileSync(`${input}/dir1/foo.txt`, 'utf8')).to.eql('edited');
  });
});
