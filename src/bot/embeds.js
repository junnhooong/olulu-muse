import { EmbedBuilder } from 'discord.js'

function fmtDuration(sec) {
  if (!sec || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function trackEmbed(kind, track) {
  const label = kind === 'now-playing' ? '▶ Now playing' : kind === 'queued' ? 'Queued' : kind === 'track-error' ? '⚠ Skipped' : kind
  const e = new EmbedBuilder()
    .setTitle(`${label}: ${track.title}`)
    .setURL(track.url)
    .setDescription(`Duration: ${fmtDuration(track.durationSec)} • Requested by ${track.requestedBy.tag}`)
  if (track.thumbnailUrl) e.setThumbnail(track.thumbnailUrl)
  return e
}
