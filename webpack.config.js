// Build Configuration for Shadow Tagger Extension

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      background: './src/background/background.ts',
      content: './src/content/content.ts',
      popup: './src/popup/popup.ts'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.build.json',
              transpileOnly: true
            }
          },
          exclude: /node_modules/
        }
      ]
    },
    
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: './src/manifest.json',
            to: 'manifest.json'
          },
          {
            from: './src/popup/popup.html',
            to: 'popup.html'
          },
          {
            from: './src/popup/popup.css',
            to: 'popup.css'
          },
          {
            from: './src/icons',
            to: 'icons',
            noErrorOnMissing: true
          }
        ]
      })
    ],
    
    devtool: isProduction ? false : 'source-map',
    
    optimization: {
      minimize: isProduction
    },
    
    stats: {
      errorDetails: true
    }
  };
};
