
module.exports = {
  name: 'hub:build',
  description: "Builds the docker image to run the Cardstack hub for this app",

  works: 'insideProject',

  availableOptions: [
    {
      name: 'tag',
      aliases: ['t'],
      type: String,
      default: 'cardstack-app:latest',
    }
  ],

  run(args) {
    this.ui.writeLine(`hub:build heyy ${JSON.stringify(args, null, 2)}`);
  }
}
