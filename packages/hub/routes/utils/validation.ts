import Koa from 'koa';

export function validateRequiredFields(
  ctx: Koa.Context,
  {
    requiredAttributes = [],
    requiredRelationships = [],
  }: { requiredAttributes?: string[]; requiredRelationships?: string[] }
) {
  let errors = [
    ...requiredAttributes.map((attr) => errorForAttribute(ctx, attr)),
    ...requiredRelationships.map((attr) => errorForRelationship(ctx, attr)),
  ].filter(Boolean);

  if (errors.length === 0) {
    return true;
  }
  ctx.body = {
    errors,
  };
  ctx.status = 422;
  ctx.type = 'application/vnd.api+json';
  return false;
}

function errorForAttribute(ctx: Koa.Context, attributeName: string) {
  let attributeValue = ctx.request.body?.data?.attributes?.[attributeName];
  if (attributeValue && attributeValue.length > 0) {
    return;
  }

  return {
    status: '422',
    title: `Missing required attribute: ${attributeName}`,
    detail: `Required field ${attributeName} was not provided`,
  };
}
function errorForRelationship(ctx: Koa.Context, relationshipName: string) {
  let relationshipValue = ctx.request.body?.data?.relationships?.[relationshipName];
  if (!relationshipValue?.data?.id) {
    return {
      status: '422',
      title: `Missing required relationship: ${relationshipName}`,
      detail: `Required relationship ${relationshipName} was not provided`,
    };
  }
  return;
}
