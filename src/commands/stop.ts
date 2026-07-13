import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.')
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  player.stop()
  await interaction.reply({ content: 'Stopped and cleared queue.', flags: EPHEMERAL })
}
