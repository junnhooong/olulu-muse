import type { Readable } from 'node:stream'
import type { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js'

export interface RequestedBy {
  id: string
  tag: string
}

export interface Track {
  title: string
  url: string
  durationSec: number
  thumbnailUrl: string | null
  requestedBy: RequestedBy
}

export type LoopMode = 'off' | 'track' | 'queue'

export interface AudioPlayerLike {
  on(event: string, cb: (...args: unknown[]) => void): void
  play(resource: unknown): void
  stop(): void
  pause(): void
  unpause(): void
}

export interface VoiceConnectionLike {
  subscribe?: (audioPlayer: AudioPlayerLike) => void
  destroy?: () => void
  joinConfig?: { channelId?: string | null }
}

export interface AudioResourceLike {
  volume?: { setVolume(v: number): void }
}

export interface VoiceDeps {
  join: (voiceChannel: unknown) => VoiceConnectionLike
  createPlayer: () => AudioPlayerLike
  createResource: (input: Readable, opts?: { inlineVolume?: boolean }) => AudioResourceLike
}

export interface SourceDeps {
  stream: (track: Track) => Readable
}

export type PostEmbedKind = 'now-playing' | 'queued' | 'track-error'

export interface PostEmbedPayload {
  kind: PostEmbedKind
  track: Track
  error?: unknown
}

export interface GuildPlayerDeps {
  voice: VoiceDeps
  source: SourceDeps
  postEmbed?: (payload: PostEmbedPayload) => void | Promise<void>
}

export interface GuildPlayerState {
  queue: Track[]
  current: Track | null
  loopMode: LoopMode
  volume: number
}

export interface GuildPlayerLike {
  guildId: string
  textChannelId: string
  audioPlayer: AudioPlayerLike | null
  voiceConnection: VoiceConnectionLike | null
  getState(): GuildPlayerState
  connect(voiceChannel: unknown): void
  enqueue(tracks: Track[]): void
  setLoop(mode: LoopMode): void
  setVolume(n: number): void
  shuffle(): void
  skip(): void
  pause(): void
  resume(): void
  stop(): void
  destroy(): void
}

export interface RegistryLike {
  getOrCreate(guildId: string, textChannelId: string): GuildPlayerLike
  get(guildId: string): GuildPlayerLike | undefined
  destroy(guildId: string): void
  all(): GuildPlayerLike[]
}

export interface CommandContext {
  registry: RegistryLike
  resolveTrack: (query: string, requestedBy: RequestedBy) => Promise<Track[]>
  connect: (player: GuildPlayerLike, voiceChannel: unknown) => Promise<void>
}

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>

export interface CommandInteraction {
  guildId: string | null
  channelId: string | null
  commandName?: string
  user?: { id: string; tag: string }
  member?: { voice?: { channel?: { id: string; guild?: { id: string; voiceAdapterCreator?: unknown } } | null } } | null
  options: {
    getString(name: string, required?: boolean): string | null
    getInteger(name: string, required?: boolean): number | null
  }
  deferred?: boolean
  replied?: boolean
  deferReply(options?: unknown): Promise<unknown>
  reply(payload: unknown): Promise<unknown>
  editReply(payload: unknown): Promise<unknown>
  followUp(payload: unknown): Promise<unknown>
}

export interface CommandModule {
  data: CommandData
  execute(interaction: CommandInteraction, ctx: CommandContext): Promise<unknown>
}
