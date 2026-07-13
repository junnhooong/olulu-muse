import type { GuildPlayerLike, RegistryLike } from '../types.js'

export interface CreatePlayerArgs {
  guildId: string
  textChannelId: string
}

export type CreatePlayer = (args: CreatePlayerArgs) => GuildPlayerLike

export interface RegistryOptions {
  createPlayer: CreatePlayer
}

export class Registry implements RegistryLike {
  private readonly _createPlayer: CreatePlayer
  private readonly _players: Map<string, GuildPlayerLike>

  constructor({ createPlayer }: RegistryOptions) {
    this._createPlayer = createPlayer
    this._players = new Map()
  }

  getOrCreate(guildId: string, textChannelId: string): GuildPlayerLike {
    let p = this._players.get(guildId)
    if (!p) {
      p = this._createPlayer({ guildId, textChannelId })
      this._players.set(guildId, p)
    }
    return p
  }

  get(guildId: string): GuildPlayerLike | undefined {
    return this._players.get(guildId)
  }

  destroy(guildId: string): void {
    const p = this._players.get(guildId)
    if (p) {
      try { p.destroy() } catch { /* ignore */ }
      this._players.delete(guildId)
    }
  }

  all(): GuildPlayerLike[] {
    return [...this._players.values()]
  }
}
