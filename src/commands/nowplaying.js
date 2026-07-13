import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'
const EPHEMERAL = 1 << 6

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.')

export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  const current = player?.getState().current
  if (!current) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  await interaction.reply({ embeds: [trackEmbed('now-playing', current)] })
}
