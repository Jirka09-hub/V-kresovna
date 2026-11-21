'use client'

import { Component, type ReactNode } from 'react'

/** Zjistí, zda prohlížeč umí WebGL (slabá nebo zamčená zařízení ho nemusí mít). */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

type Props = { fallback: ReactNode; children: ReactNode }

/** Když 3D selže, zobrazí náhradní obsah; výkres a cvičení fungují dál. */
export class WebGLBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
