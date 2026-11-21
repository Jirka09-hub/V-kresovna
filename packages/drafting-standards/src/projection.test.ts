import { describe, expect, it } from 'vitest'
import {
  FIRST_ANGLE_LAYOUT,
  PROJECTION_METHOD,
  THIRD_ANGLE_DEMO_ONLY,
  VIEWS,
  type ViewName,
} from './projection'
import { cross, dot, neg, X_AXIS, Y_AXIS, Z_AXIS, type Vec3 } from './vectors'

// + 0 převede −0 na 0, aby šly vektory porovnávat
const norm = (v: Vec3): Vec3 => [v[0] + 0, v[1] + 0, v[2] + 0]
const right = (v: ViewName): Vec3 => norm(cross(VIEWS[v].viewDirection, VIEWS[v].up))
const NEIGHBOURS: ViewName[] = ['top', 'left', 'right', 'bottom']

describe('evropské promítání (metoda E)', () => {
  it('používá metodu E', () => {
    expect(PROJECTION_METHOD).toBe('E')
  })

  it('rozmístí pohledy vůči nárysu podle zadání', () => {
    expect(FIRST_ANGLE_LAYOUT.front).toEqual([0, 0])
    expect(FIRST_ANGLE_LAYOUT.top).toEqual([0, -1]) // půdorys pod nárysem
    expect(FIRST_ANGLE_LAYOUT.left).toEqual([1, 0]) // bokorys zleva vpravo
    expect(FIRST_ANGLE_LAYOUT.right).toEqual([-1, 0]) // pohled zprava vlevo
    expect(FIRST_ANGLE_LAYOUT.bottom).toEqual([0, 1]) // pohled zdola nahoře
    expect(FIRST_ANGLE_LAYOUT.rear).toEqual([2, 0]) // pohled zezadu úplně vpravo
  })

  it('každý sousední pohled leží na opačné straně, než odkud se díváme', () => {
    for (const v of NEIGHBOURS) {
      const [gx, gy] = FIRST_ANGLE_LAYOUT[v]
      // směr v prostoru odpovídající posunu pohledu na výkrese
      const placement: Vec3 = [
        gx * right('front')[0] + gy * VIEWS.front.up[0],
        gx * right('front')[1] + gy * VIEWS.front.up[1],
        gx * right('front')[2] + gy * VIEWS.front.up[2],
      ]
      // pozorovatel stojí proti směru pohledu; pohled je umístěn na stranu, kam se dívá
      expect(dot(placement, VIEWS[v].viewDirection)).toBe(1)
    }
  })

  it('pohledy svázané s nárysem mají společné osy (šířka, výška)', () => {
    // půdorys a pohled zdola sdílejí s nárysem vodorovnou osu X
    expect(right('top')).toEqual(X_AXIS)
    expect(right('bottom')).toEqual(X_AXIS)
    // bokorysy sdílejí s nárysem svislou osu Z
    expect(norm(VIEWS.left.up)).toEqual(Z_AXIS)
    expect(norm(VIEWS.right.up)).toEqual(Z_AXIS)
  })

  it('zadní strana tělesa (+Y) přiléhá u sousedních pohledů k nárysu', () => {
    for (const v of NEIGHBOURS) {
      const [gx, gy] = FIRST_ANGLE_LAYOUT[v]
      // směr v obrázku pohledu, který míří k nárysu
      const towardFront: Vec3 = [
        -gx * right(v)[0] - gy * VIEWS[v].up[0],
        -gx * right(v)[1] - gy * VIEWS[v].up[1],
        -gx * right(v)[2] - gy * VIEWS[v].up[2],
      ]
      expect(norm(towardFront)).toEqual(Y_AXIS)
    }
  })

  it('všechny pohledy mají pravotočivou ortonormální soustavu', () => {
    for (const v of Object.keys(VIEWS) as ViewName[]) {
      const { viewDirection, up } = VIEWS[v]
      expect(dot(viewDirection, up) + 0).toBe(0)
      expect(dot(viewDirection, viewDirection)).toBe(1)
      expect(dot(up, up)).toBe(1)
    }
    expect(right('rear')).toEqual(norm(neg(X_AXIS)))
  })

  it('americké rozmístění je zrcadlové a slouží jen pro výukovou ukázku', () => {
    for (const v of NEIGHBOURS) {
      const [ex, ey] = FIRST_ANGLE_LAYOUT[v]
      expect(THIRD_ANGLE_DEMO_ONLY[v]).toEqual(norm([-ex, -ey, 0]).slice(0, 2))
    }
  })
})
