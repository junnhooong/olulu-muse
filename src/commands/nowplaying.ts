import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.')

export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  const current = player?.getState().current
  if (!current) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  await interaction.reply({ embeds: [trackEmbed('now-playing', current)] })
}
