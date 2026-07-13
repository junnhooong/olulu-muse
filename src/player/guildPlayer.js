const VALID_LOOP_MODES = new Set(['off', 'track', 'queue'])

export class GuildPlayer {
  constructor({ guildId, textChannelId, deps }) {
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

  getState() {
    return {
      queue: [...this.queue],
      current: this.current,
      loopMode: this.loopMode,
      volume: this.volume,
    }
  }

  connect(voiceChannel) {
    if (this.audioPlayer) return
    this.voiceConnection = this.deps.voice.join(voiceChannel)
    this.audioPlayer = this.deps.voice.createPlayer()
    this.audioPlayer.on('stateChange', (oldS, newS) => {
      if (oldS.status !== 'idle' && newS.status === 'idle') {
        this._onTrackEnd()
      }
    })
    this.audioPlayer.on('error', (err) => {
      this._log('audioPlayer error', err)
      this._onTrackEnd({ errored: true })
    })
    this.voiceConnection.subscribe?.(this.audioPlayer)
  }

  enqueue(tracks) {
    this.queue.push(...tracks)
    if (!this.current && this.audioPlayer) {
      this._playNext()
    }
  }

  setLoop(mode) {
    if (!VALID_LOOP_MODES.has(mode)) {
      throw new Error(`invalid loopMode: ${mode}`)
    }
    this.loopMode = mode
  }

  setVolume(n) {
    this.volume = Math.max(0, Math.min(200, n))
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100)
    }
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]
    }
  }

  skip() {
    if (this.audioPlayer && this.current) {
      this.audioPlayer.stop()
    }
  }

  pause() {
    this.audioPlayer?.pause()
  }

  resume() {
    this.audioPlayer?.unpause()
  }

  stop() {
    this.queue = []
    this.current = null
    this.audioPlayer?.stop()
  }

  destroy() {
    this.queue = []
    this.current = null
    try { this.audioPlayer?.stop() } catch {}
    try { this.voiceConnection?.destroy?.() } catch {}
    this.audioPlayer = null
    this.voiceConnection = null
  }

  _onTrackEnd({ errored = false } = {}) {
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

  _playNext() {
    if (!this.audioPlayer) return
    if (this.queue.length === 0) {
      this.current = null
      return
    }
    const next = this.queue.shift()
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

  _log(msg, err) {
    console.error(`[guildId=${this.guildId}] ${msg}`, err?.message ?? '')
  }
}
