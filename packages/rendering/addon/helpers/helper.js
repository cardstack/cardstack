import Helper from '@ember/component/helper';
import { getOwner } from '@ember/application';

export default Helper.extend({
  compute(params) {
    let [name, ...args] = params;
    let hash = {};
    let lastArg = args[args.length - 1];
    if (typeof lastArg === 'object') {
      args.splice(args.length - 1);
      hash = lastArg;
    }
    let helper = getOwner(this).lookup(`helper:${name}`);
    return helper.compute.apply(this, [args].concat(hash));
  },
});
