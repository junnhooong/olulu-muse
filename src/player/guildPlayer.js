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

  _playNext() {
    // Implemented in Task 6.
  }
}
