export class Registry {
  constructor({ createPlayer }) {
    this._createPlayer = createPlayer
    this._players = new Map()
  }

  getOrCreate(guildId, textChannelId) {
    let p = this._players.get(guildId)
    if (!p) {
      p = this._createPlayer({ guildId, textChannelId })
      this._players.set(guildId, p)
    }
    return p
  }

  get(guildId) {
    return this._players.get(guildId)
  }

  destroy(guildId) {
    const p = this._players.get(guildId)
    if (p) {
      try { p.destroy() } catch {}
      this._players.delete(guildId)
    }
  }

  all() {
    return [...this._players.values()]
  }
}
