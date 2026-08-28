import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  assertBuildTargetBinding,
  resolveBuildTargetDescriptor,
} from './src/build/buildTargetDescriptor.js'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});
