import 'dotenv/config'
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
} from '@discordjs/voice'
import { type Client, type Interaction, type VoiceBasedChannel, type VoiceState, Events } from 'discord.js'
import { createClient } from './bot/client.js'
import { createHandler } from './bot/handlers.js'
import { commands } from './commands/index.js'
import { Registry } from './player/registry.js'
import { GuildPlayer } from './player/guildPlayer.js'
import { createIdleWatcher, type VoiceStateSnapshot } from './player/idle.js'
import { resolve as ytResolve, stream as ytStream } from './sources/youtube.js'
import { trackEmbed } from './bot/embeds.js'
import type {
  CommandContext,
  GuildPlayerDeps,
  GuildPlayerLike,
  PostEmbedPayload,
  RequestedBy,
} from './types.js'

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment')
  process.exit(1)
}

process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err))
process.on('uncaughtException', (err) => console.error('uncaughtException:', err))

const client = createClient()

function makePlayerFactory({ client }: { client: Client }) {
  return function createPlayer({ guildId, textChannelId }: { guildId: string; textChannelId: string }): GuildPlayerLike {
    const rawDeps = {
      voice: {
        join: (voiceChannel: unknown) => {
          const ch = voiceChannel as VoiceBasedChannel
          return joinVoiceChannel({
            channelId: ch.id,
            guildId: ch.guild.id,
            adapterCreator: ch.guild.voiceAdapterCreator,
            selfDeaf: true,
          })
        },
        createPlayer: () => createAudioPlayer(),
        createResource: (stream: Parameters<typeof createAudioResource>[0], opts?: { inlineVolume?: boolean }) =>
          createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: opts?.inlineVolume ?? true,
          }),
      },
      source: {
        stream: ytStream,
      },
      postEmbed: async ({ kind, track }: PostEmbedPayload): Promise<void> => {
        try {
          const channel = await client.channels.fetch(textChannelId)
          if (channel && 'send' in channel && typeof channel.send === 'function') {
            await channel.send({ embeds: [trackEmbed(kind, track)] })
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('postEmbed failed:', msg)
        }
      },
    }
    return new GuildPlayer({ guildId, textChannelId, deps: rawDeps as unknown as GuildPlayerDeps })
  }
}

const registry = new Registry({ createPlayer: makePlayerFactory({ client }) })

async function connect(player: GuildPlayerLike, voiceChannel: unknown): Promise<void> {
  if (player.audioPlayer) return
  player.connect(voiceChannel)
  try {
    await entersState(player.voiceConnection as unknown as VoiceConnection, VoiceConnectionStatus.Ready, 20_000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[guildId=${player.guildId}] voice connect failed:`, msg)
    registry.destroy(player.guildId)
    throw err
  }
}

const ctx: CommandContext = {
  registry,
  resolveTrack: (query: string, requestedBy: RequestedBy) => ytResolve(query, requestedBy),
  connect,
}

const handler = createHandler({ commands, ctx })

client.on(Events.InteractionCreate, (interaction: Interaction) => { void handler(interaction as unknown as Parameters<typeof handler>[0]) })

client.once(Events.ClientReady, () => {
  if (!client.user) return
  const idle = createIdleWatcher({
    registry,
    botUserId: client.user.id,
    timeoutMs: 30_000,
  })
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) =>
    idle.handleVoiceStateUpdate(oldState as unknown as VoiceStateSnapshot, newState as unknown as VoiceStateSnapshot),
  )
  console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.DISCORD_TOKEN)
