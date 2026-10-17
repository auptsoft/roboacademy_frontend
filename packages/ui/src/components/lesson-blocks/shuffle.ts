/** A shuffle seeded by a string (a block id), so the order is the same every time a learner opens it. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const random = () => (state = (state * 1103515245 + 12345) >>> 0) / 2 ** 32
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
