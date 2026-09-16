import { expect, it, vi } from 'vitest'
import { queueLatest } from '../queueLatest.js'

it('runs the latest pending task after the running task fails', async () => {
  const tasks = new WeakMap()
  const key = {}
  let fail
  const first = queueLatest(tasks, key, () => new Promise((resolve, reject) => { fail = reject }))
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'))
  const latest = vi.fn()
  const pending = queueLatest(tasks, key, latest)
  fail(new Error('obsolete request failed'))
  await Promise.all([first, pending])
  expect(latest).toHaveBeenCalledOnce()
  expect(tasks.has(key)).toBe(false)
})

it('reports a failed final task and permits subsequent updates', async () => {
  const tasks = new WeakMap()
  const key = {}
  await expect(queueLatest(tasks, key, async () => { throw new Error('failed') }))
    .rejects.toThrow('failed')
  const retry = vi.fn()
  await queueLatest(tasks, key, retry)
  expect(retry).toHaveBeenCalledOnce()
  expect(tasks.has(key)).toBe(false)
})
