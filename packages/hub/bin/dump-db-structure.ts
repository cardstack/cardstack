#!/usr/bin/env node

const config = require('config');
const dbConfig = config.get('db');
const { exec } = require('child_process');
exec(`pg_dump ${dbConfig.url} -f config/structure.sql`);
