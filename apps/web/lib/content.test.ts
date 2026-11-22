import { PILOT_MODULE } from '@vykresovna/content'
import {
  buildPart,
  createDrawing,
  loadManifold,
  validatePart,
  viewFingerprint,
} from '@vykresovna/engine'
import { applyDrawingMutation, ERROR_CODES } from '@vykresovna/exercises'
import { describe, expect, it } from 'vitest'
import cs from '../messages/cs.json'

describe('obsah lekcí', () => {
  it('součásti v úvodech jsou platné', () => {
    for (const lesson of PILOT_MODULE.lessons) {
      for (const screen of lesson.intro) {
        expect(validatePart(screen.part), `${lesson.slug}/${screen.id}`).toEqual([])
      }
    }
  })

  it('každá lekce a úvodní obrazovka má texty v češtině', () => {
    const items = cs.lessons.items as Record<
      string,
      { title: string; summary: string; intro?: Record<string, { title: string; text: string }> }
    >
    for (const lesson of PILOT_MODULE.lessons) {
      const texts = items[lesson.slug]
      expect(texts?.title, lesson.slug).toBeTruthy()
      expect(texts?.summary, lesson.slug).toBeTruthy()
      for (const screen of lesson.intro) {
        expect(texts?.intro?.[screen.id]?.title, `${lesson.slug}/${screen.id}`).toBeTruthy()
        expect(texts?.intro?.[screen.id]?.text, `${lesson.slug}/${screen.id}`).toBeTruthy()
      }
    }
  })

  it('každý kód chyby má vysvětlení', () => {
    const errors = cs.exercises.errors as Record<string, string>
    for (const code of ERROR_CODES) expect(errors[code], code).toBeTruthy()
  })
})

describe('ukázka chyby v lekci 6', () => {
  it('chyba v ukázce existuje a výkres opravdu změní', async () => {
    const wasm = await loadManifold()
    const screens = PILOT_MODULE.lessons.flatMap((l) => l.intro)
    const examples = screens.filter((s) => s.demo.kind === 'error-example')
    expect(examples.length).toBeGreaterThan(0)
    for (const screen of examples) {
      if (screen.demo.kind !== 'error-example') continue
      const { mutation } = screen.demo
      const drawing = createDrawing(screen.part, buildPart(wasm, screen.part))
      const view = drawing.views.find((v) => v.view === mutation.view)!
      const ids = new Set(view.projection.segments.flatMap((s) => s.edgeIds))
      for (const id of mutation.edgeIds) expect(ids, id).toContain(id)
      const mutated = applyDrawingMutation(drawing, mutation).views.find(
        (v) => v.view === mutation.view,
      )!
      expect(viewFingerprint(mutated)).not.toBe(viewFingerprint(view))
    }
  })
})
