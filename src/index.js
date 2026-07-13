import 'dotenv/config'
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice'
import { createClient } from './bot/client.js'
import { createHandler } from './bot/handlers.js'
import { commands } from './commands/index.js'
import { Registry } from './player/registry.js'
import { GuildPlayer } from './player/guildPlayer.js'
import { createIdleWatcher } from './player/idle.js'
import { resolve as ytResolve, stream as ytStream } from './sources/youtube.js'
import { trackEmbed } from './bot/embeds.js'

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment')
  process.exit(1)
}

process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err))
process.on('uncaughtException', (err) => console.error('uncaughtException:', err))

const client = createClient()

function makePlayerFactory({ client }) {
  return function createPlayer({ guildId, textChannelId }) {
    const deps = {
      voice: {
        join: (voiceChannel) => joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: true,
        }),
        createPlayer: () => createAudioPlayer(),
        createResource: (stream, opts) => createAudioResource(stream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: opts?.inlineVolume ?? true,
        }),
      },
      source: {
        stream: (track) => ytStream(track),
      },
      postEmbed: async ({ kind, track }) => {
        try {
          const channel = await client.channels.fetch(textChannelId)
          await channel?.send({ embeds: [trackEmbed(kind, track)] })
        } catch (err) {
          console.error('postEmbed failed:', err.message)
        }
      },
    }
    return new GuildPlayer({ guildId, textChannelId, deps })
  }
}

const registry = new Registry({ createPlayer: makePlayerFactory({ client }) })

async function connect(player, voiceChannel) {
  if (player.audioPlayer) return
  player.connect(voiceChannel)
  try {
    await entersState(player.voiceConnection, VoiceConnectionStatus.Ready, 20_000)
  } catch (err) {
    console.error(`[guildId=${player.guildId}] voice connect failed:`, err.message)
    registry.destroy(player.guildId)
    throw err
  }
}

const ctx = {
  registry,
  resolveTrack: (query, requestedBy) => ytResolve(query, requestedBy),
  connect,
}

const handler = createHandler({ commands, ctx })

client.on('interactionCreate', handler)

client.once('ready', () => {
  const idle = createIdleWatcher({
    registry,
    botUserId: client.user.id,
    timeoutMs: 30_000,
  })
  client.on('voiceStateUpdate', (oldState, newState) => idle.handleVoiceStateUpdate(oldState, newState))
  console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.DISCORD_TOKEN)
