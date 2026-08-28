import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import {
  assertRuntimeProfileCompatible,
  resolveBuildTargetDescriptor,
} from '@/build/buildTargetDescriptor'
import { appParams } from '@/lib/app-params'
import { bootstrapProvider } from '@/services/providerBootstrap'

const ROOT_ID = 'root'
const buildTarget = resolveBuildTargetDescriptor('base44-cloud')

function setRootText(text) {
  const root = document.getElementById(ROOT_ID)
  if (root) root.textContent = text
}

function showStartupFailure(code) {
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  root.textContent = ''
  const line = document.createElement('p')
  line.textContent = 'Application startup failed.'
  root.appendChild(line)
  if (code) {
    const codeLine = document.createElement('p')
    codeLine.textContent = String(code)
    root.appendChild(codeLine)
  }
}

async function startApplication() {
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  setRootText('Loading…')
  try {
    assertRuntimeProfileCompatible(buildTarget, appParams.profile)
    await bootstrapProvider(appParams.profile)
    const { default: App } = await import('@/App.jsx')
    setRootText('')
    ReactDOM.createRoot(root).render(
      <App />
    )
  } catch (e) {
    showStartupFailure(e && e.code)
  }
}

startApplication()
