import { test, expect } from '@playwright/test'

// Plays the early game through the real app: collect eggs -> restock the stand -> customers buy ->
// build Coop 2 -> buy Field 1 -> harvest -> sell at the town market -> upgrade -> save + reload.
// The player really "walks" (teleport + simulated frames); only the money for big purchases is granted.

const SAVE_KEY = 'run-a-farm.save.v2'

test('plays the full farm game loop', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/WebSocket|net::|colyseus|Failed to load resource/i.test(m.text())) errors.push(m.text())
  })

  // Fresh save on the first load only (the reload in step 9 must keep it).
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('__fresh')) {
      localStorage.removeItem(k)
      sessionStorage.setItem('__fresh', '1')
    }
  }, SAVE_KEY)
  await page.goto('/')
  await page.waitForFunction(() => window.__game, null, { timeout: 90_000 })
  await expect(page.locator('canvas').first()).toBeVisible()

  // Runs `fn(game, G, cfg, arg)` inside the page: `game` is src/game.js (the same module instance the app
  // uses), `G` is window.__game, `cfg` is src/config.js. fn must be self-contained (it is serialized).
  const run = (fn, arg) =>
    page.evaluate(
      async ([src, a]) => {
        const game = await import('/src/game.js')
        const cfg = await import('/src/config.js')
        return new Function('game', 'G', 'cfg', 'a', `return (${src})(game, G, cfg, a)`)(game, window.__game, cfg, a)
      },
      [fn.toString(), arg],
    )
  const shot = (name) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
  const walkTo = (x, z, frames = 20) =>
    run((game, G, cfg, a) => {
      G.teleport(a.x, G.player.position?.y ?? 1, a.z)
      G.step(a.frames, 1 / 30)
      G.step(a.frames, 1 / 30)
    }, { x, z, frames })

  await test.step('1. new game starts with nothing', async () => {
    const s = await run((game) => ({ money: game.state.money, coop2: game.built('coop2'), eggs: game.bagEggs() }))
    expect(s).toEqual({ money: 0, coop2: false, eggs: 0 })
    await shot('01-start')
  })

  await test.step('2. walk to the nest: eggs go into the bag', async () => {
    await walkTo(-52 + 1.3, -5 + 3.1)
    await expect.poll(async () => { await walkTo(-52 + 1.3, -5 + 3.1); return run((game) => game.bagEggs()) }, { timeout: 20_000 }).toBeGreaterThan(0)
    await shot('02-collected')
  })

  await test.step('3. walk to the stand: the bag restocks it', async () => {
    await walkTo(-19, 27 + 2.2)
    const s = await run((game) => ({ stand: game.state.stand.eggs, bag: game.bagEggs() }))
    expect(s.stand).toBeGreaterThan(0)
    expect(s.bag).toBe(0)
    await shot('03-restocked')
  })

  await test.step('4. customers buy eggs from the stand', async () => {
    const m = await run((game, G) => {
      const before = game.state.money
      for (let i = 0; i < 120; i++) game.tick(1, G.player) // two simulated minutes
      return { before, after: game.state.money, sold: game.state.stats.sold }
    })
    expect(m.after).toBeGreaterThan(m.before)
    expect(m.sold).toBeGreaterThan(0)
  })

  await test.step('5. build Coop 2 (refused without money)', async () => {
    const r = await run((game) => {
      game.state.money = 0
      const b = game.buildingById('coop2')
      const poor = game.buyBuilding(b)
      game.state.money = b.price + 7
      const rich = game.buyBuilding(b)
      return { poor, rich, built: game.built('coop2') }
    })
    expect(r).toEqual({ poor: false, rich: true, built: true })
  })

  await test.step('6. buy Field 1, walk into the ripe crop and harvest it', async () => {
    const r = await run((game) => {
      game.state.money = 1000
      const p = game.PLOTS[0]
      const ok = game.buyPlot(p)
      game.state.plots.grow[p.n] = 1 // fully grown
      return { ok, owned: game.plotOwned(p), rect: p.rect }
    })
    expect(r.ok).toBe(true)
    expect(r.owned).toBe(true)
    const h = await run((game, G) => {
      const p = game.PLOTS[0]
      const cx = (p.rect.minX + p.rect.maxX) / 2
      const cz = (p.rect.minZ + p.rect.maxZ) / 2
      const before = game.bagCount() + game.storageCount()
      G.teleport(cx, G.player.position?.y ?? 1, cz)
      G.step(30, 1 / 30)
      for (let i = 0; i < 10; i++) game.tick(0.2, G.player)
      return { before, after: game.bagCount() + game.storageCount() }
    })
    expect(h.after).toBeGreaterThan(h.before)
    await shot('06-harvested')
  })

  await test.step('7. go to the town market: the bag sells', async () => {
    const r = await run((game, G, cfg) => {
      game.put(game.state.bag, 'egg', 5); const bagBefore = game.bagCount()
      const before = game.state.money
      const z = cfg.FARM.townMarket.zone
      G.teleport((z.minX + z.maxX) / 2, G.player.position?.y ?? 1, (z.minZ + z.maxZ) / 2)
      G.step(40, 1 / 30)
      for (let i = 0; i < 5; i++) game.tick(0.5, G.player)
      return { before, after: game.state.money, bag: game.bagCount(), bagBefore }
    })
    expect(r.after).toBeGreaterThan(r.before)
    expect(r.bag).toBeLessThan(r.bagBefore)
    await shot('07-market')
  })

  await test.step('8. buy a shop upgrade', async () => {
    const r = await run((game, G, cfg) => {
      const item = cfg.GAME.shop.find((i) => i.id === 'stand')
      game.state.money = 10_000
      const before = game.upgradeLevel('stand')
      game.buyUpgrade(item)
      return { before, after: game.upgradeLevel('stand') }
    })
    expect(r.after).toBe(r.before + 1)
  })

  await test.step('9. progress saves and survives a reload', async () => {
    const snap = (game) => ({ built: [...game.state.built], money: game.state.money, owned: [...game.state.plots.owned] })
    const before = await run((game) => {
      game.save()
      return { built: [...game.state.built], money: game.state.money, owned: [...game.state.plots.owned] }
    })
    await page.reload()
    await page.waitForFunction(() => window.__game, null, { timeout: 90_000 })
    const after = await run(snap)
    expect(after.built).toContain('coop2')
    expect(after.owned).toEqual(before.owned)
    expect(after.money).toBe(before.money)
    await shot('09-reloaded')
  })

  expect(errors, 'no uncaught errors in the page').toEqual([])
})
