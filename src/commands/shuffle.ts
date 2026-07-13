import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the upcoming queue.')
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is queued.', flags: EPHEMERAL }); return }
  player.shuffle()
  await interaction.reply({ content: 'Shuffled the queue.', flags: EPHEMERAL })
}
