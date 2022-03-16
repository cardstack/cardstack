import { FileMeta } from '../babel-plugin-card-file-analyze';
import { ComponentInfo, Format, FORMATS, RawCard, Saved, Unsaved } from '../interfaces';

export function getComponentFormatsForPath(
  cardSource: RawCard<Saved | Unsaved>,
  localPath: string
): Format[] | undefined {
  let formats: Format[] = [];
  for (let format of FORMATS) {
    if (localPath === cardSource[format]) {
      formats.push(format);
    }
  }
  return formats.length ? formats : undefined;
}

export function getInlineHBS(
  componentMeta: FileMeta['component'],
  usedFields: ComponentInfo['usedFields']
  // fields: CompiledCard['fields'],
  // format: Format
): string | undefined {
  if (!componentMeta || componentMeta.hasModifiedScope) {
    return;
  }

  // TODO: This is shallow. We could traverse down the fields that are used to see if safe to inline
  if (usedFields && usedFields.length > 0) {
    return;
  }

  return componentMeta.rawHBS;
}

// we expect this to expand when we add edit format
export function defaultFormatForEmbeddedComponents(format: Format): Format {
  switch (format) {
    case 'isolated':
    case 'embedded':
      return 'embedded';
    case 'edit':
      return 'edit';
  }
}
