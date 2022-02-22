/* eslint-disable node/no-unpublished-require */
const exec = require('child_process').exec;
const Table = require('cli-table3');
const variablesToGet = process.argv.slice(2).map((v) => v.toLowerCase());

/**
 * Get waypoint variables and print them neatly.
 * Has very rough fuzzy search.
 */
exec('waypoint config get -json', (error, stdout, stderr) => {
  if (stderr) console.error(stderr);
  if (!stdout || error) {
    console.error('Could not retrieve waypoint config');
    console.error(error);
    return;
  }
  const data = JSON.parse(stdout);
  if (variablesToGet.length) {
    const result = {};
    for (let key in data) {
      if (variablesToGet.some((str) => key.toLowerCase().includes(str))) {
        result[key] = data[key];
      }
    }
    console.log(result);
  } else {
    const table = new Table({
      head: ['Key', 'Value'],
      colWidths: [40, 100],
    });

    for (let key in data) {
      table.push([key, data[key]]);
    }

    console.log(table.toString());
    console.log(
      `\nThis table is for easy scanning of the variables so text is truncated where necessary. Get the specific variables by specifying them in the command for precise values.`
    );
  }
});
