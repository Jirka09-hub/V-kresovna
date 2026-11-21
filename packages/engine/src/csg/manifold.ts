import Module, { type ManifoldToplevel } from 'manifold-3d'

let instance: Promise<ManifoldToplevel> | null = null

export type ManifoldInitOptions = {
  /** V prohlížeči: URL souboru manifold.wasm (bundler ho jinak nemusí najít). */
  readonly wasmUrl?: string
}

/** Načte WASM modul manifold-3d jednou a vrací stále stejnou instanci. */
export function loadManifold(options: ManifoldInitOptions = {}): Promise<ManifoldToplevel> {
  if (!instance) {
    const config = options.wasmUrl ? { locateFile: () => options.wasmUrl! } : undefined
    instance = Module(config).then((wasm) => {
      wasm.setup()
      return wasm
    })
  }
  return instance
}

/**
 * Počet segmentů kružnice. Musí být násobkem 4, aby teselace měla vrcholy přesně v krajních
 * bodech kružnice ve směru os; obrysové přímky děr ve výkresu pak leží přesně na průměru.
 */
export const CIRCULAR_SEGMENTS = 96
