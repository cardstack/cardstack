import { camelize } from '@ember/string';

export function processJsonApiErrors(errors: any[]) {
  let nonValidationErrors = getNonAttributeValidationErrors(errors);
  let validations = getAttributeValidationErrorsByProperty(errors);
  return {
    validations,
    nonValidationErrors,
  };
}

function getNonAttributeValidationErrors(errors: any[]) {
  return errors.filter((e) => !isAttributeValidationError(e));
}

function getAttributeValidationErrorsByProperty(errors: any[]) {
  let attributeValidationErrors = errors.filter((e) =>
    isAttributeValidationError(e)
  );
  let result: Record<string, [string]> = {};
  for (let attributeValidationError of attributeValidationErrors) {
    let path = pathForAttributeValidationError(
      attributeValidationError
    ) as string;
    let message = messageForError(attributeValidationError);
    result[path] = result[path] ?? [];
    result[path].push(message);
  }
  return result;
}

function isAttributeValidationError(error: {
  status: string;
  source?: { pointer?: string };
}): error is { status: string; source: { pointer: string } } {
  return error.status === '422' && typeof error.source?.pointer === 'string';
}

function messageForError(error: { title: string; detail?: string }) {
  return error.detail ?? error.title;
}

function pathForAttributeValidationError(error: {
  source?: {
    pointer?: string;
  };
}) {
  if (!error.source?.pointer) {
    return null;
  }

  return error.source.pointer
    .split('/')
    .slice(3)
    .map((str) => camelize(str))
    .join('.');
}
