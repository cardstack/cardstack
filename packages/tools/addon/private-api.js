export function transitionTo(owner, routeName, models, queryParams, shouldReplace) {
  let routingService = owner.lookup('service:-routing');
  return routingService.transitionTo(routeName, models, queryParams, shouldReplace);
}
