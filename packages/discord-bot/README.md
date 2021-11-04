# cardstack discord-bot library

This library is intended to help write robust Discord Bots in node.js. It is a layer on top of the Discord Javascript SDK.

It allows implementation of new message handlers by simply adding a new file.

One example of using this library can be found in the `hub` package in this repository:
  https://github.com/cardstack/cardstack/tree/main/packages/hub/services/discord-bots/hub-bot

## Notes

Instances of bots made with this library are able to collaborate with each other so that only one bot of a given type is
processing commands at a time. This facilitates deploying without losing messages. The approach is documented here:

https://github.com/cardstack/cardstack/tree/main/packages/discord-bot/docs

Because of this, it is important that commands load/store any conversation state in the database, not in memory.

