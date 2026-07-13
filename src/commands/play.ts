import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'
import type { CommandContext, CommandInteraction, Track } from '../types.js'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a YouTube URL or keyword search.')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('YouTube URL or search terms').setRequired(true),
  )

const EPHEMERAL = 1 << 6

async function safeReply(interaction: CommandInteraction, payload: unknown): Promise<unknown> {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload)
  }
  return interaction.reply(payload)
}

export async function execute(interaction: CommandInteraction, ctx: CommandContext): Promise<void> {
  const voiceChannel = interaction.member?.voice?.channel
  if (!voiceChannel) {
    await safeReply(interaction, { content: 'Join a voice channel first.', flags: EPHEMERAL })
    return
  }
  const query = interaction.options.getString('query')
  if (!query || !interaction.user || !interaction.guildId || !interaction.channelId) {
    await safeReply(interaction, { content: 'Invalid command context.', flags: EPHEMERAL })
    return
  }
  await interaction.deferReply()

  let tracks: Track[]
  try {
    tracks = await ctx.resolveTrack(query, { id: interaction.user.id, tag: interaction.user.tag })
  } catch (err) {
    const asError = err as { name?: string; message?: string } | undefined
    const msg = asError?.name === 'SourceError' ? asError.message ?? 'Could not resolve that query.' : 'Could not resolve that query.'
    await safeReply(interaction, { content: msg, flags: EPHEMERAL })
    return
  }

  const player = ctx.registry.getOrCreate(interaction.guildId, interaction.channelId)
  await ctx.connect(player, voiceChannel)

  const wasIdle = !player.getState().current && player.getState().queue.length === 0
  player.enqueue(tracks)

  const first = tracks[0]
  if (!first) return
  const kind = wasIdle ? 'now-playing' : 'queued'
  await safeReply(interaction, { embeds: [trackEmbed(kind, first)] })
}
