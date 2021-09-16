const core = require('@actions/core');
const Discord = require('discord.js');

const token = core.getInput('token');
const channelID = core.getInput('channel');
const message = core.getInput('message');

const client = new Discord.Client();

async function run() {
  try {
    await client.login(token);

    if (!client.user) {
      reject('Discord user not found');
    }

    core.info(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(channelID);
    await channel.send(message);
  } catch (err) {
    core.setFailed(err.message);
  }
  client.destroy();
}

run();
