// ref: https://github.com/storybookjs/builder-vite/blob/main/examples/react-18/.storybook/main.js

module.exports = {
  features: {
    storyStoreV7: true,
  },
  async viteFinal(config, { configType }) {
    // customize the Vite config here
    return {
      ...config,
      define: {
        ...config.define,
        global: 'window',
      },
    }
  },
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    // '@storybook/addon-links',
    '@storybook/addon-essentials',
    // '@storybook/addon-interactions',
  ],
  framework: '@storybook/react',
  core: {
    builder: '@storybook/builder-vite',
    // ref: https://storybook.js.org/docs/react/configure/telemetry
    disableTelemetry: true, // 👈 Disables telemetry
  },
}
