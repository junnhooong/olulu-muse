import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('leave').setDescription('Disconnect from the voice channel.')
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  if (!interaction.guildId || !registry.get(interaction.guildId)) {
    await interaction.reply({ content: 'Not connected.', flags: EPHEMERAL })
    return
  }
  registry.destroy(interaction.guildId)
  await interaction.reply({ content: 'Left the voice channel.', flags: EPHEMERAL })
}
