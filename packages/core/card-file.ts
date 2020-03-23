import { join } from 'path';
import cloneDeep from 'lodash/cloneDeep';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { Card } from '@cardstack/hub';
import stringify from 'json-stable-stringify';

type WriteFn = (path: string, content: string) => Promise<void>;

export async function writeCard(cardPath: string, doc: SingleResourceDoc, writeFn: WriteFn): Promise<void> {
  if (doc.data.attributes?.csFiles) {
    await writeCSFiles(cardPath, doc.data.attributes?.csFiles as NonNullable<Card['csFiles']>, writeFn);
    doc = cloneDeep(doc);
    delete doc.data.attributes!.csFiles;
  }

  await writeFn(join(cardPath, 'package.json'), stringify({}, { space: 2 }));
  await writeFn(join(cardPath, 'card.json'), stringify(doc, { space: 2 }));
}

async function writeCSFiles(outDir: string, files: NonNullable<Card['csFiles']>, writeFn: WriteFn): Promise<void> {
  for (let [name, entry] of Object.entries(files)) {
    if (typeof entry === 'string') {
      await writeFn(join(outDir, name), entry);
    } else {
      await writeCSFiles(join(outDir, name), entry, writeFn);
    }
  }
}
