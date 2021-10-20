require('dotenv').config();
const config = require('config');
const {
  commandPrefix: botPrefix,
  botId: botTestId,
  botToken,
  cordeBotToken,
  allowedGuilds,
  allowedChannels,
} = config.get('discord');

module.exports = {
  $schema: './node_modules/corde/schema/corde.schema.json',
  botPrefix,
  botTestId,
  channelId: allowedChannels.split(',').pop(),
  cordeBotToken,
  guildId: allowedGuilds.split(',').pop(),
  testMatches: ['**/bot-tests/**/*.ts'],
  botToken,
  project: '<rootDir>/../../tsconfig.json',
  timeout: 5000,
  exitOnFileReadingError: true,
  extensions: ['.js', '.ts'],
  modulePathIgnorePatterns: ['(?:^|/)node_modules/'],
  rootDir: __dirname,
};
