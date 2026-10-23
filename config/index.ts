import path from 'path'
import { execSync } from 'child_process'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'

/** 构建戳：换算目录 / 换分支后，用来在「我的」页确认跑的是哪份产物 */
function buildStamp(): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const time = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  let sha = 'nogit'
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim()
  } catch {
    // 非 git 环境（如 CI 打包产物）忽略
  }
  return `${time} · ${sha}`
}

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'shinecar-admin-frontend',
    date: '2026-10-23',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      // 管理端只有 development / pre / production 三套环境
      __APP_ENV__: JSON.stringify(process.env.TARO_APP_ENV || process.env.NODE_ENV || 'development'),
      // 构建戳（时间 · commit），用于确认开发者工具里跑的是哪份产物
      __BUILD_STAMP__: JSON.stringify(buildStamp())
    },
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'vue3',
    compiler: 'webpack5',
    cache: {
      enable: false
    },
    sass: {
      // 设计变量全局注入，页面样式里禁止写十六进制色值
      resource: [path.resolve(__dirname, '..', 'src/styles/tokens.scss')]
    },
    mini: {
      enableSourceMap: false,
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
