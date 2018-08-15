export function initialize( appInstance ) {
  // Look up the tools service, because it's init method registers an edge
  // component with the cardstack-edges service
  appInstance.lookup('service:cardstack-tools');
}

export default {
  name: 'cardstack-tools',
  initialize
};
