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
      // BlockStatement(node) {
      //   console.log('BLOCK', node);
      //   return node;
      // },
      ElementNode(node) {
        //FIXME: Go through all the attributes and stop at one
        // which is of the type MustacheStatement
        var tag = node.tag;
        var value = node.attributes[0].value;
        if (value.type === 'MustacheStatement') {
          var path = value.path;
          var parts = path.parts;
          if (parts.length === 2 && parts[0] === 'content') {
            var imageTag = b.element(tag, [
              b.attr("src", b.mustache(b.path('url')))
            ], []);
            var block = b.program([imageTag], ['url']);
            return b.block(b.path('cs-field'), [
              b.path("content"), b.string(parts[1])
            ], b.hash(), block);
          }
        }
      },
      /*
      AttrNode(node) {
      },
      */
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
