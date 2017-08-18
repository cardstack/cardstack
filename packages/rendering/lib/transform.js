/* eslint-env node */
"use strict";

/*
  This is the beginning of an experimental code transform for cardstack templates.

  It runs on any template that appears under
  templatse/components/cardstack. It transforms direct property
  bindings like:

    {{content.title}}

  Into simple cs-field calls like:

    {{cs-field content "title"}}

  In order to annotate those fields for editable by the cardstack tools.

*/

function BindTransform({ moduleName }) {
  this.moduleName = moduleName;
  this.syntax = null;
}

BindTransform.prototype.transform = function(ast) {
  if (/\btemplates\/components\/cardstack\//.test(this.moduleName)){
    var b = this.syntax.builders;

    this.syntax.traverse(ast, {
      MustacheStatement(node) {
        if (node.path.parts.length === 2 && node.path.parts[0] === 'content') {
          return b.mustache(b.path("cs-field"), [b.path("content"), b.string(node.path.parts[1])]);
        }
      }
    });
  }
  return ast;
};

module.exports = BindTransform;
