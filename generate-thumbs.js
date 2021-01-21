const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { basename, dirname, join } = require('path');
const { writeFileSync } = require('fs');

const sizes = {
  thumb: '200x200',
  medium: '640x480',
  large: '1280x1024',
};

const coverDir = 'public/media-registry/covers';

const jsonToAddKeys = [
  './public/media-registry/api/custom_catalog_batch_f_table_1.json',
  './public/media-registry/api/all_tracks_combined.json',
];

(async function () {
  for (let sizeName of Object.keys(sizes)) {
    await process(sizeName);
  }

  for (let file of jsonToAddKeys) {
    let json = require(file);

    for (let record of json) {
      let currentPath = record.cover_art;

      if (currentPath) {
        let dirName = dirname(currentPath);
        let baseName = basename(currentPath);

        for (let sizeName of Object.keys(sizes)) {
          let key = `cover_art_${sizeName}`;
          record[key] = join(dirName, sizeName, baseName);
        }
      }

      writeFileSync(file, JSON.stringify(json, null, 2));
    }
  }
})();

async function process(sizeName) {
  let outDir = join(coverDir, sizeName);
  let size = sizes[sizeName];

  await runCmd(`rm -rf ${outDir}`);
  await runCmd(`mkdir ${outDir}`);
  await runCmd(
    `mogrify -verbose -path ${outDir} -thumbnail ${size}  ${join(
      coverDir,
      '*.jpg'
    )}`
  );
}

async function runCmd(cmd) {
  console.log('Running command:', cmd); // eslint-disable-line no-console
  await exec(cmd);
}
