export function createIdleWatcher({
  registry,
  botUserId,
  timeoutMs = 30_000,
  timers = { setTimeout, clearTimeout },
  getBotChannelId,
}) {
  const timerByGuild = new Map()

  const defaultGetBotChannelId = (guildId) => {
    const p = registry.get(guildId)
    return p?.voiceConnection?.joinConfig?.channelId ?? null
  }
  const resolveBotChannel = getBotChannelId ?? defaultGetBotChannelId

  function humansInChannel(state, channelId) {
    if (!channelId) return 0
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      if (m.voice?.channelId === channelId) count++
    }
    return count
  }

  function countHumansUsingStateShim(state, channelId) {
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      const memberChannel = m.voice?.channelId ?? state.channelId
      if (memberChannel === channelId) count++
    }
    return count
  }

  function handleVoiceStateUpdate(oldState, newState) {
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
