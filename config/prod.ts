import type { UserConfigExport } from '@tarojs/cli'

export default {
  mini: {
    webpackChain(chain) {
      chain.optimization.usedExports(true)
      chain.optimization.sideEffects(false)
      chain.optimization.minimize(true)
    }
  },
  h5: {}
} satisfies UserConfigExport<'webpack5'>
