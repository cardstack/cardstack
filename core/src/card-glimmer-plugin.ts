import { ASTPlugin, ASTPluginEnvironment } from '@glimmer/syntax';

export default function cardTransform(env: ASTPluginEnvironment): ASTPlugin {
  return {
    name: 'card-glimmer-plugin',
    visitor: {
      ElementNode(node) {
        if (node.tag === 'this.title') {
          return env.syntax.builders.mustache(
            env.syntax.builders.path('this.title')
          );
        }
        return undefined;
      },
    },
  };
}
