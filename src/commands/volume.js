import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set volume (0-200, default 100).')
  .addIntegerOption((o) =>
    o.setName('level').setDescription('0..200').setRequired(true).setMinValue(0).setMaxValue(200),
  )
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  const level = interaction.options.getInteger('level')
  player.setVolume(level)
  await interaction.reply({ content: `Volume: **${player.getState().volume}**`, flags: EPHEMERAL })
}
