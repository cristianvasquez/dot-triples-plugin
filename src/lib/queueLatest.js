/** Run one task at a time, retaining only the latest pending task per key. */
export function queueLatest (tasks, key, task) {
  const existing = tasks.get(key)
  if (existing) {
    existing.next = task
    return existing.promise
  }

  const state = { next: task, promise: null }
  tasks.set(key, state)
  state.promise = Promise.resolve().then(async () => {
    try {
      while (state.next) {
        const run = state.next
        state.next = null
        try {
          await run()
        } catch (error) {
          // A failed obsolete task must not prevent the latest update.
          if (!state.next) throw error
        }
      }
    } finally {
      tasks.delete(key)
    }
  })
  return state.promise
}
