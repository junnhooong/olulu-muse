import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('resume').setDescription('Resume playback.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.resume()
  await interaction.reply({ content: 'Resumed.', flags: EPHEMERAL })
}
