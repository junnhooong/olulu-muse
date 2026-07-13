import { SlashCommandBuilder } from 'discord.js'
import type { CommandContext, CommandInteraction, LoopMode } from '../types.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set loop mode.')
  .addStringOption((o) =>
    o.setName('mode').setDescription('Loop mode').setRequired(true).addChoices(
      { name: 'off', value: 'off' },
      { name: 'track', value: 'track' },
      { name: 'queue', value: 'queue' },
    ),
  )
export async function execute(interaction: CommandInteraction, { registry }: CommandContext): Promise<void> {
  const player = interaction.guildId ? registry.get(interaction.guildId) : undefined
  if (!player) { await interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL }); return }
  const mode = interaction.options.getString('mode') as LoopMode
  player.setLoop(mode)
  await interaction.reply({ content: `Loop mode: **${mode}**`, flags: EPHEMERAL })
}
