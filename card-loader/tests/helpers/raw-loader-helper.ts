/* eslint-disable node/no-unsupported-features/es-syntax */
import path from 'path';
import webpack from 'webpack';

// class CardResolver implements webpack.ResolvePlugin {
//   constructor(
//     private source: string = 'resolve',
//     private target: string = 'resolve'
//   ) {}

//   apply(resolver: any) {
//     let target = resolver.ensureHook(this.target);

//     resolver
//       .getHook(this.source)
//       .tapAsync(
//         'CardSolver',
//         function (request: any, resolveContext: any, callback: any) {
//           if (request.request.endsWith('compiled')) {
//             request.request = request.request.replace(/compiled$/, 'schema.js');
//             return resolver.doResolve(
//               target,
//               request,
//               null,
//               resolveContext,
//               callback
//             );
//           }
//           callback();
//         }
//       );
//   }
// }

//@ts-ignore
import memoryfs from 'memory-fs';

export default async (fixture: any, options = {}): Promise<webpack.Stats> => {
  const compiler = webpack({
    context: path.resolve(__dirname),
    entry: path.resolve('tests', fixture),
    output: {
      path: path.resolve(__dirname, '../..'),
      filename: 'bundle.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      // plugins: [new CardResolver()],
    },
    module: {
      rules: [
        {
          test: /raw.json$/,
          use: [
            {
              loader: path.resolve(__dirname, '../../src/raw-loader.ts'),
              options,
            },
          ],
        },
      ],
    },
  });

  compiler.outputFileSystem = new memoryfs();

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err);
      if (stats.hasErrors()) reject(stats.toJson().errors);

      resolve(stats);
    });
  });
};
