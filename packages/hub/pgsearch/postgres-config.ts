import { ClientConfig } from 'pg';

export default function postgresConfig(defaultConfig: ClientConfig = {}) {
  return Object.assign({}, defaultConfig, {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || '5432',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || undefined,
    database: process.env.PGDATABASE || 'postgres',
  });
}
