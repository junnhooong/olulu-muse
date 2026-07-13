import type { RegistryLike } from '../types.js'

export interface IdleTimers {
  setTimeout: (cb: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

interface MemberVoiceState {
  user?: { bot?: boolean }
  voice?: { channelId?: string | null }
}

export interface VoiceStateSnapshot {
  guild: {
    id: string
    members: { cache: Map<string, MemberVoiceState> }
  }
  channelId: string | null
}

export interface IdleWatcherOptions {
  registry: RegistryLike
  botUserId: string
  timeoutMs?: number
  timers?: IdleTimers
  getBotChannelId?: (guildId: string) => string | null | undefined
}

const defaultTimers: IdleTimers = {
  setTimeout: (cb, ms) => setTimeout(cb, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
}

export function createIdleWatcher({
  registry,
  timeoutMs = 30_000,
  timers = defaultTimers,
  getBotChannelId,
}: IdleWatcherOptions): { handleVoiceStateUpdate: (oldState: VoiceStateSnapshot, newState: VoiceStateSnapshot) => void } {
  const timerByGuild = new Map<string, number>()

  const defaultGetBotChannelId = (guildId: string): string | null => {
    const p = registry.get(guildId)
    return p?.voiceConnection?.joinConfig?.channelId ?? null
  }
  const resolveBotChannel = getBotChannelId ?? defaultGetBotChannelId

  function humansInChannel(state: VoiceStateSnapshot, channelId: string | null): number {
    if (!channelId) return 0
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      if (m.voice?.channelId === channelId) count++
    }
    return count
  }

  function countHumansUsingStateShim(state: VoiceStateSnapshot, channelId: string): number {
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      const memberChannel = m.voice?.channelId ?? state.channelId
      if (memberChannel === channelId) count++
    }
    return count
  }

  function handleVoiceStateUpdate(oldState: VoiceStateSnapshot, newState: VoiceStateSnapshot): void {
    const guildId = newState.guild.id
    if (!registry.get(guildId)) return
    const botChannelId = resolveBotChannel(guildId) ?? newState.channelId ?? oldState.channelId
    if (!botChannelId) return

    const humans = humansInChannel(newState, botChannelId) || countHumansUsingStateShim(newState, botChannelId)
    if (humans === 0) {
      if (!timerByGuild.has(guildId)) {
        const id = timers.setTimeout(() => {
          timerByGuild.delete(guildId)
          registry.destroy(guildId)
        }, timeoutMs)
        timerByGuild.set(guildId, id)
      }
    } else {
      const id = timerByGuild.get(guildId)
      if (id !== undefined) {
        timers.clearTimeout(id)
        timerByGuild.delete(guildId)
      }
    }
  }

  return { handleVoiceStateUpdate }
}
