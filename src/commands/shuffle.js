import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the upcoming queue.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is queued.', flags: EPHEMERAL })
  player.shuffle()
  await interaction.reply({ content: 'Shuffled the queue.', flags: EPHEMERAL })
}
