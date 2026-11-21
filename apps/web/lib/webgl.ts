'use client'

let supported: boolean | null = null

/**
 * Umí prohlížeč WebGL? Výsledek se zjistí jednou za běh stránky a zkušební kontext se hned uvolní,
 * aby se na slabých zařízeních zbytečně nehromadily WebGL kontexty.
 */
export function webglSupported(): boolean {
  if (supported !== null) return supported
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    supported = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    supported = false
  }
  return supported
}
