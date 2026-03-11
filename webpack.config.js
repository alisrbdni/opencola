const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");

/** @type {import('webpack').Configuration} */
module.exports = (env, argv) => ({
  mode: argv.mode || "development",
  devtool: argv.mode === "production" ? false : "cheap-module-source-map",

  entry: {
    background: "./src/background/index.ts",
    content: "./src/content/index.ts",
    popup: "./src/popup/index.tsx",
    options: "./src/options/index.tsx",
  },

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    fallback: {
      // Node built-ins not available in browser — use browser-compatible alternatives
      crypto: false,
      stream: false,
      buffer: false,
      util: false,
      url: false,
      http: false,
      https: false,
      net: false,
      tls: false,
      fs: false,
      path: false,
    },
  },

  plugins: [
    new Dotenv({ safe: true, allowEmptyValues: true }),

    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup/index.html",
      chunks: ["popup"],
    }),

    new HtmlWebpackPlugin({
      template: "./src/options/index.html",
      filename: "options/index.html",
      chunks: ["options"],
    }),

    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "icons", to: "icons", noErrorOnMissing: true },
        { from: "src/assets", to: "assets", noErrorOnMissing: true },
      ],
    }),
  ],

  optimization: {
    // Keep chunks separate for MV3 service worker compatibility
    splitChunks: false,
  },
});
