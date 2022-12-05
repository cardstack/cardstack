import DuckDB from '../../services/duckdb';
import { setupHub } from '../helpers/server';

describe('DuckDB', function () {
  let subject: DuckDB;
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = (await getContainer().lookup('duckdb')) as DuckDB;
  });

  it('httpfs extension installed and loaded', async function () {
    const db = await subject.getClient(false); // false to avoid configuring aws config
    const extensions = await subject.listExtensions(db);
    expect(subject.extensionInstalled(extensions, 'httpfs')).to.be.true;
    expect(subject.extensionLoaded(extensions, 'httpfs')).to.be.true;
  });
});
