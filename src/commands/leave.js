import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('leave').setDescription('Disconnect from the voice channel.')
export async function execute(interaction, { registry }) {
  if (!registry.get(interaction.guildId)) {
    return interaction.reply({ content: 'Not connected.', flags: EPHEMERAL })
  }
  registry.destroy(interaction.guildId)
  await interaction.reply({ content: 'Left the voice channel.', flags: EPHEMERAL })
}
