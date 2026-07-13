import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that the bot is alive.')

export async function execute(interaction) {
  await interaction.reply({ content: 'pong', flags: 1 << 6 })
}
