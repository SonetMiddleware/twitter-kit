export default {
  // entry: 'src/index.tsx',
  esm: {
    type: 'rollup'
  },
  extraExternals: ['antd', '@ant-design/icons', 'react'],
  extraBabelPlugins: [
    [
      'file-loader',
      {
        name: '[hash].[ext]',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'],
        publicPath: './src/assets',
        outputPath: './dist/assets',
        context: '',
        limit: 10000
      }
    ],
    [
      'babel-plugin-import',
      {
        libraryName: 'antd',
        libraryDirectory: 'es',
        style: true
      },
      'antd'
    ]
  ]
}
