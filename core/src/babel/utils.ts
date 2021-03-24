import {
  Expression,
  isStringLiteral,
  isV8IntrinsicIdentifier,
  V8IntrinsicIdentifier,
  StringLiteral,
  Identifier,
  isIdentifier,
  ObjectExpression,
  ObjectProperty,
} from '@babel/types';

export function name(
  node: StringLiteral | Identifier | Expression | V8IntrinsicIdentifier
): string {
  if (isIdentifier(node) || isV8IntrinsicIdentifier(node)) {
    return node.name;
  } else if (isStringLiteral(node)) {
    return node.value;
  } else {
    return node.toString();
  }
}

export function getObjectKey(
  obj: ObjectExpression,
  key: string
): ObjectProperty | undefined {
  return (obj.properties.filter(
    (p: ObjectProperty) => name(p.key) === key
  ) as ObjectProperty[])[0];
}
