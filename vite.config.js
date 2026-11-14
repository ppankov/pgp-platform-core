import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  assertBuildTargetBinding,
  resolveBuildTargetDescriptor,
} from './src/build/buildTargetDescriptor.js'

// https://vite.dev/config/
export default defineConfig(async () => {
  const buildTarget = resolveBuildTargetDescriptor(process.env.PGP_BUILD_TARGET)

  assertBuildTargetBinding(
    buildTarget,
    'vitePlugin',
    'base44-vite-plugin-current'
  )
  assertBuildTargetBinding(
    buildTarget,
    'providerLoader',
    'base44-provider-loader-current'
  )
  assertBuildTargetBinding(
    buildTarget,
    'auth',
    'base44-auth-context-facade-current'
  )
  assertBuildTargetBinding(
    buildTarget,
    'appParameters',
    'base44-app-parameters-current'
  )
  assertBuildTargetBinding(
    buildTarget,
    'bootstrap',
    'base44-entry-bootstrap-current'
  )

  const { createBase44PluginSet } = await import(
    './build/vite/base44PluginSet.js'
  )
  const base44Plugins = createBase44PluginSet()

  return {
    plugins: [
      ...base44Plugins,
      react(),
    ],
  }
});
