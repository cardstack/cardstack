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

  It also transforms attribute assigments into cs-field calls. For example:

    <img src={{content.imageUrl}} />

  becomes

    {{#cs-field content "imageUrl" as |param1|}}<img src={{param1}}></img>{{/cs-field}}

  It does this in order to annotate those fields for editable by the cardstack tools.

*/

class BindTransform {
  constructor({ moduleName }) {
    this.moduleName = moduleName;
    this.syntax = null;
  }

  transform(ast) {
    if (!/\btemplates\/components\/cardstack\//.test(this.moduleName) &&
      !/\btemplates\/(embedded|isolated).hbs/.test(this.moduleName)) {
      return ast;
    }

    let b = this.syntax.builders;
    let foundBlockParams = collectBlockParams(ast);

    this.syntax.traverse(ast, {
      ElementNode(node) {
        let contentProperty,
          unusedBlockParam,
          foundDynamicContent = false,
          newAttributes = [];

        let tag = node.tag;
        for (let i = 0; i < node.attributes.length; i++) {
          let nodeAttributes = node.attributes[i];
          let name = nodeAttributes.name;
          let value = nodeAttributes.value;
          if (!value) {
            break;
          }

          if (value.type === 'MustacheStatement') {
            let path = value.path;
            let parts = path.parts;
            if (parts && parts.length === 2 && parts[0] === 'content') {
              foundDynamicContent = true;
              // contentProperty is the property that is looked up on content
              // (e.g `imageUrl` in the case of `content.imageUrl`)
              unusedBlockParam = getUnusedBlockParam(foundBlockParams);
              contentProperty = parts[1];
              newAttributes.push(b.attr(name, b.mustache(b.path(unusedBlockParam))));
            } else {
              newAttributes.push(b.attr(name, value));
            }
          } else if (nodeAttributes.type === 'AttrNode') {
            newAttributes.push(b.attr(name, value));
          } else if (nodeAttributes.type === 'TextNode') {
            newAttributes.push(b.attr(name, value.chars));
          }
        }

        if (foundDynamicContent) {
          let newTag = b.element(tag, newAttributes, []);
          let blockWithParam = b.program([newTag], [unusedBlockParam]);
          let block = b.block(b.path('cs-field'), [
            b.path("content"), b.string(contentProperty)
          ], b.hash(), blockWithParam);
          return block;
        }

        return node;
      },

      MustacheStatement(node) {
        if (node.path.parts && node.path.parts.length === 2 && node.path.parts[0] === 'content') {
          return b.mustache(b.path("cs-field"), [b.path("content"), b.string(node.path.parts[1])]);
        }
      }
    });

    return ast;
  }
}

function getUnusedBlockParam(foundNames) {
  let foundName = false;
  let i = 0;
  let paramName;

  do {
    i++;
    paramName = 'param' + i;
    if (foundNames.indexOf(paramName) === -1) {
      foundName = true;
    }
  } while (!foundName);

  return paramName;
}



function collectBlockParams(ast, foundBlockParams) {
  if (!foundBlockParams) {
    foundBlockParams = [];
  }

  for (let i=0; i<ast.body.length; i++) {
    let tree = ast.body[i];
    let program = tree.program;
    if (program) {
      foundBlockParams = foundBlockParams.concat(program.blockParams);
      return collectBlockParams(program, foundBlockParams);
    }
  }

  return foundBlockParams;
}

module.exports = BindTransform;
