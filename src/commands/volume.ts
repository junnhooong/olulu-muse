import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set volume (0-200, default 100).')
  .addIntegerOption((o) =>
    o.setName('level').setDescription('0..200').setRequired(true).setMinValue(0).setMaxValue(200),
  )
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  const level = interaction.options.getInteger('level') ?? 100
  player.setVolume(level)
  await interaction.reply({ content: `Volume: **${player.getState().volume}**`, flags: EPHEMERAL })
}
