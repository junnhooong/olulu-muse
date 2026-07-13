import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.stop()
  await interaction.reply({ content: 'Stopped and cleared queue.', flags: EPHEMERAL })
}
