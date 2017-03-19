/*
   This module encapsulates all known uses of Ember private APIs. By
   keeping them all together here we make it easier to upgrade Ember.
*/

import Ember from 'ember';

let getViewBounds;
if (Ember.ViewUtils && Ember.ViewUtils.getViewBounds) {
  getViewBounds = Ember.ViewUtils.getViewBounds;
}

function componentNodes_v113(component) {
  return {
    firstNode: component._renderNode.firstNode,
    lastNode: component._renderNode.lastNode
  };
}

function componentNodes_v29(component) {
  let bounds = getViewBounds(component);
  return {
    firstNode: bounds.firstNode,
    lastNode: bounds.lastNode
  };
}

// Get the first and last dom nodes for a component (even a tagless
// one, which is why we need private API).
export function componentNodes(component) {
  if (getViewBounds) {
    return componentNodes_v29(component);
  } else {
    return componentNodes_v113(component);
  }
}
