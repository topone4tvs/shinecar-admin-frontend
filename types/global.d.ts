/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

/** 构建期注入的环境标识，见 config/index.ts 的 defineConstants */
declare const __APP_ENV__: 'development' | 'pre' | 'production';

/** 构建期注入的构建戳：`MM-DD HH:mm · shortSha`，见 config/index.ts */
declare const __BUILD_STAMP__: string;

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'quickapp' | 'qq' | 'jd'
    /** 构建时指定环境：development / pre / production */
    TARO_APP_ENV?: 'development' | 'pre' | 'production'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
  }
}

declare module '@tarojs/components' {
  export * from '@tarojs/components/types/index.vue3'
}
