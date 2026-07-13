import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a YouTube URL or keyword search.')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('YouTube URL or search terms').setRequired(true),
  )

const EPHEMERAL = 1 << 6

async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload)
  }
  return interaction.reply(payload)
}

export async function execute(interaction, ctx) {
  const voiceChannel = interaction.member?.voice?.channel
  if (!voiceChannel) {
    return safeReply(interaction, { content: 'Join a voice channel first.', flags: EPHEMERAL })
  }
  const query = interaction.options.getString('query')
  await interaction.deferReply()

  let tracks
  try {
    tracks = await ctx.resolveTrack(query, { id: interaction.user.id, tag: interaction.user.tag })
  } catch (err) {
    const msg = err?.name === 'SourceError' ? err.message : 'Could not resolve that query.'
    return safeReply(interaction, { content: msg, flags: EPHEMERAL })
  }

  const player = ctx.registry.getOrCreate(interaction.guildId, interaction.channelId)
  await ctx.connect(player, voiceChannel)

  const wasIdle = !player.getState().current && player.getState().queue.length === 0
  player.enqueue(tracks)

  const kind = wasIdle ? 'now-playing' : 'queued'
  await safeReply(interaction, { embeds: [trackEmbed(kind, tracks[0])] })
}
