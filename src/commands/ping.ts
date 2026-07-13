import { SlashCommandBuilder } from 'discord.js'
import type { CommandInteraction } from '../types.js'

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that the bot is alive.')

export async function execute(interaction: CommandInteraction): Promise<void> {
  await interaction.reply({ content: 'pong', flags: 1 << 6 })
}
