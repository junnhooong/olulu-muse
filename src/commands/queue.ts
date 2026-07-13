import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction, Track } from '../types.js'
const EPHEMERAL = 1 << 6

function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export const data = new SlashCommandBuilder().setName('queue').setDescription('Show the current queue.')

export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  const { current, queue, loopMode, volume } = player.getState()
  const lines: string[] = []
  lines.push(current ? `▶ **${current.title}** (${fmtDuration(current.durationSec)})` : '_Nothing playing_')
  const upcoming = queue.slice(0, 10)
  upcoming.forEach((t: Track, idx: number) => {
    lines.push(`${idx + 1}. ${t.title} (${fmtDuration(t.durationSec)})`)
  })
  if (queue.length > upcoming.length) {
    lines.push(`… and ${queue.length - upcoming.length} more`)
  }
  const embed = new EmbedBuilder()
    .setTitle('Queue')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Loop: ${loopMode} • Volume: ${volume}` })
  await interaction.reply({ embeds: [embed] })
}
