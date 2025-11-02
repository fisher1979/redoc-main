import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import { resolve } from 'path';
import * as webpack from 'webpack';
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { webpackIgnore } from '../config/webpack-utils';

const VERSION = JSON.stringify(require('../package.json').version);
const REVISION = JSON.stringify(
  require('child_process').execSync('git rev-parse --short HEAD').toString().trim(),
);

console.log('VERSION-2', VERSION);
console.log('REVISION-2', REVISION);

function root(filename) {
  return resolve(__dirname + '/' + filename);
}

export default (env: { playground?: boolean; bench?: boolean } = {}) => ({
  entry: [
    root('../src/polyfills.ts'),
    root(
      env.playground
        ? 'playground/hmr-playground.tsx'
        : env.bench
        ? '../benchmark/index.tsx'
        : 'index.tsx',
    ),
  ],
  target: 'web',
  output: {
    filename: 'redoc-demo.bundle.js',
    path: root('dist'),
    globalObject: 'this',
  },

  devServer: {
    static: __dirname,
    port: 9092,
    hot: true,
    historyApiFallback: true,
    open: true,
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        return middlewares;
      }

      // Parse JSON body for POST requests
      const express = require('express');
      devServer.app?.use('/api', express.json());
      devServer.app?.use('/api', express.text({ type: 'text/plain' }));

      // Add API endpoint for generating static HTML using SSR
      devServer.app?.post('/api/generate-html', async (req: any, res: any) => {
        try {
          const { specUrl, spec } = req.body || {};

          if (!specUrl && !spec) {
            return res.status(400).json({ error: 'Either specUrl or spec is required' });
          }

          // Set up global variables for SSR - MUST be done before any imports
          // These are normally injected by webpack DefinePlugin
          const VERSION = JSON.stringify(require('../package.json').version);
          let REVISION: string;
          try {
            REVISION = JSON.stringify('dev');
          } catch (e) {
            REVISION = JSON.stringify('unknown');
          }
          console.info('VERSION', VERSION);
          console.info('REVISION', REVISION);

          // Inject globals into global scope - this must happen before ANY module
          // that references these globals (including ErrorBoundary) is loaded
          (global as any).__REDOC_VERSION__ = VERSION;
          (global as any).__REDOC_REVISION__ = REVISION;

          // Register ts-node with transpileOnly to skip type checking
          // This avoids TypeScript compilation errors for global variables
          if (!process.env.TS_NODE_REGISTERED) {
            require('ts-node').register({
              transpileOnly: true,
              compilerOptions: {
                module: 'commonjs',
                target: 'es2015',
                jsx: 'react',
                skipLibCheck: true,
                noImplicitAny: false,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
              },
            });
            process.env.TS_NODE_REGISTERED = 'true';
          }

          // Use require instead of dynamic import to ensure proper module loading order
          // Clear module cache to ensure fresh load with globals set
          const generateModulePath = require.resolve('./ssr/generate-html');
          if (require.cache[generateModulePath]) {
            delete require.cache[generateModulePath];
          }

          // Now require the module - globals are already set, ts-node will transpile
          const generateModule = require('./ssr/generate-html');
          const html = await generateModule.generateStaticHtml(spec || specUrl, specUrl);
          console.log('specUrl=>', specUrl, 'spec=>', spec);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(html);
        } catch (error: any) {
          console.error('Error generating HTML:', error);
          res.status(500).json({
            error: 'Failed to generate HTML',
            message: error.message || String(error),
          });
        }
      });

      return middlewares;
    },
  },
  stats: {
    children: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    fallback: {
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer'),
      http: false,
      fs: false,
      os: false,
    },
  },

  performance: false,

  externals: {
    esprima: 'esprima',
    'node-fetch': 'null',
    'node-fetch-h2': 'null',
    yaml: 'null',
    'safe-json-stringify': 'null',
  },

  module: {
    rules: [
      { test: [/\.eot$/, /\.gif$/, /\.woff$/, /\.svg$/, /\.ttf$/], use: 'null-loader' },
      {
        test: /\.(tsx?|[cm]?js)$/,
        loader: 'esbuild-loader',
        options: {
          target: 'es2015',
          tsconfigRaw: require('../tsconfig.json'),
        },
        exclude: [/node_modules/],
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'esbuild-loader',
            options: {
              minify: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __REDOC_VERSION__: VERSION,
      __REDOC_REVISION__: REVISION,
      'process.env': '{}',
      'process.platform': '"browser"',
      'process.stdout': 'null',
    }),
    // new webpack.NamedModulesPlugin(),
    // new webpack.optimize.ModuleConcatenationPlugin(),
    new HtmlWebpackPlugin({
      template: env.playground
        ? 'demo/playground/index.html'
        : env.bench
        ? 'benchmark/index.html'
        : 'demo/index.html',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new ForkTsCheckerWebpackPlugin({ logger: { infrastructure: 'silent', issues: 'console' } }),
    webpackIgnore(/js-yaml\/dumper\.js$/),
    webpackIgnore(/json-schema-ref-parser\/lib\/dereference\.js/),
    webpackIgnore(/^\.\/SearchWorker\.worker$/),
    new CopyWebpackPlugin({
      patterns: ['demo/museum.yaml', 'demo/custom-menu.json'],
    }),
  ],
});
