import { SlashCommandBuilder } from 'discord.js'
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
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  const mode = interaction.options.getString('mode')
  player.setLoop(mode)
  await interaction.reply({ content: `Loop mode: **${mode}**`, flags: EPHEMERAL })
}
