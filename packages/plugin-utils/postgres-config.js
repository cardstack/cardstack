const parse = require('pg-connection-string');

module.exports = function postgresConfig(defaultConfig={}) {
  let config;
  let { database } = defaultConfig;

  for (let param of Object.keys(defaultConfig)) {
    if (!defaultConfig[param]) {
      delete defaultConfig[param];
    }
  }

  if (process.env.DB_URL) {
    config = parse(process.env.DB_URL);
  } else {
    config = Object.assign({
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || '5432',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || undefined
    }, defaultConfig);
  }

  config.database = database || process.env.PGDATABASE || 'postgres';

  return config;
};
