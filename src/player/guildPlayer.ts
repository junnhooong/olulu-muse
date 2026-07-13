import type {
  AudioPlayerLike,
  AudioResourceLike,
  GuildPlayerDeps,
  GuildPlayerLike,
  GuildPlayerState,
  LoopMode,
  Track,
  VoiceConnectionLike,
} from '../types.js'

const VALID_LOOP_MODES = new Set<LoopMode>(['off', 'track', 'queue'])

interface GuildPlayerOptions {
  guildId: string
  textChannelId: string
  deps: GuildPlayerDeps
}

interface TrackEndOptions {
  errored?: boolean
}

export class GuildPlayer implements GuildPlayerLike {
  guildId: string
  textChannelId: string
  deps: GuildPlayerDeps
  queue: Track[]
  current: Track | null
  loopMode: LoopMode
  volume: number
  voiceConnection: VoiceConnectionLike | null
  audioPlayer: AudioPlayerLike | null
  currentResource: AudioResourceLike | null

  constructor({ guildId, textChannelId, deps }: GuildPlayerOptions) {
    this.guildId = guildId
    this.textChannelId = textChannelId
    this.deps = deps
    this.queue = []
    this.current = null
    this.loopMode = 'off'
    this.volume = 100
    this.voiceConnection = null
    this.audioPlayer = null
    this.currentResource = null
  }

  getState(): GuildPlayerState {
    return {
      queue: [...this.queue],
      current: this.current,
      loopMode: this.loopMode,
      volume: this.volume,
    }
  }

  connect(voiceChannel: unknown): void {
    if (this.audioPlayer) return
    this.voiceConnection = this.deps.voice.join(voiceChannel)
    this.audioPlayer = this.deps.voice.createPlayer()
    this.audioPlayer.on('stateChange', (...args: unknown[]) => {
      const [oldS, newS] = args as [{ status: string }, { status: string }]
      if (oldS.status !== 'idle' && newS.status === 'idle') {
        this._onTrackEnd()
      }
    })
    this.audioPlayer.on('error', (...args: unknown[]) => {
      const err = args[0]
      this._log('audioPlayer error', err)
      this._onTrackEnd({ errored: true })
    })
    this.voiceConnection.subscribe?.(this.audioPlayer)
  }

  enqueue(tracks: Track[]): void {
    this.queue.push(...tracks)
    if (!this.current && this.audioPlayer) {
      this._playNext()
    }
  }

  setLoop(mode: LoopMode): void {
    if (!VALID_LOOP_MODES.has(mode)) {
      throw new Error(`invalid loopMode: ${mode}`)
    }
    this.loopMode = mode
  }

  setVolume(n: number): void {
    this.volume = Math.max(0, Math.min(200, n))
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100)
    }
  }

  shuffle(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = this.queue[i] as Track
      const b = this.queue[j] as Track
      this.queue[i] = b
      this.queue[j] = a
    }
  }

  skip(): void {
    if (this.audioPlayer && this.current) {
      this.audioPlayer.stop()
    }
  }

  pause(): void {
    this.audioPlayer?.pause()
  }

  resume(): void {
    this.audioPlayer?.unpause()
  }

  stop(): void {
    this.queue = []
    this.current = null
    this.audioPlayer?.stop()
  }

  destroy(): void {
    this.queue = []
    this.current = null
    try { this.audioPlayer?.stop() } catch { /* ignore */ }
    try { this.voiceConnection?.destroy?.() } catch { /* ignore */ }
    this.audioPlayer = null
    this.voiceConnection = null
  }

  private _onTrackEnd({ errored = false }: TrackEndOptions = {}): void {
    const finished = this.current
    this.current = null
    this.currentResource = null
    if (finished && !errored) {
      if (this.loopMode === 'track') {
        this.queue.unshift(finished)
      } else if (this.loopMode === 'queue') {
        this.queue.push(finished)
      }
    }
    this._playNext()
  }

  private _playNext(): void {
    if (!this.audioPlayer) return
    if (this.queue.length === 0) {
      this.current = null
      return
    }
    const next = this.queue.shift() as Track
    this.current = next
    try {
      const stream = this.deps.source.stream(next)
      const resource = this.deps.voice.createResource(stream, { inlineVolume: true })
      resource.volume?.setVolume(this.volume / 100)
      this.currentResource = resource
      this.audioPlayer.play(resource)
      this.deps.postEmbed?.({ kind: 'now-playing', track: next })
    } catch (err) {
      this._log('failed to play track', err)
      this.deps.postEmbed?.({ kind: 'track-error', track: next, error: err })
      this.current = null
      this._playNext()
    }
  }

  private _log(msg: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : ''
    console.error(`[guildId=${this.guildId}] ${msg}`, detail)
  }
}
