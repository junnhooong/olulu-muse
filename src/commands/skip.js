import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.skip()
  await interaction.reply({ content: 'Skipped.', flags: EPHEMERAL })
}
