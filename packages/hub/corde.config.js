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
  testMatches: ['dist/bot-tests.js'],
  botToken,
  timeout: 9000,
  exitOnFileReadingError: true,
  extensions: ['.js'],
  modulePathIgnorePatterns: ['(?:^|/)node_modules/'],
  rootDir: __dirname,
};
