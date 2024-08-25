module.exports = {
    entry: ['./js/main.js'],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    output: {
      path: __dirname + "/out",
      filename: 'bundle.js'
    }
  }
