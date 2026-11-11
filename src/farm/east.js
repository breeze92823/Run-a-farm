import { Group } from 'three'
import { FARM } from '../config.js'
import { bakeInto, gated } from './kit.js'
import { barrel, pumpkin } from './props.js'

// East of the barn: an open lawn inside the plot fence with a few trees (from
// FARM.eastTrees, planted by scenery.js) and a couple of barrels and pumpkins by
// the barn, which come with the Storage Barn. The lawn stays plain grass:
// nothing is marked out before it is bought.

export function buildEast(root) {
  gated(root, 'storage', (G) => {
    const g = new Group()
    barrel(g, 67.5, -60, 0.2)
    barrel(g, 68.4, -61.2, 1.1)
    pumpkin(g, 68, -58, 0.34)
    pumpkin(g, 84, -46, 0.3, '#f6b13b')
    bakeInto(G, g)
  }, 1.4)
  return { rect: FARM.east }
}
