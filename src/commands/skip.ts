import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.')
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  player.skip()
  await interaction.reply({ content: 'Skipped.', flags: EPHEMERAL })
}
