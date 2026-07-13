const EPHEMERAL = 1 << 6

export function createHandler({ commands, ctx }) {
  return async function handle(interaction) {
    if (!interaction.isChatInputCommand?.()) return
    const cmd = commands.get(interaction.commandName)
    if (!cmd) {
      await interaction.reply({ content: `Unknown command: ${interaction.commandName}`, flags: EPHEMERAL })
      return
    }
    try {
      await cmd.execute(interaction, ctx)
    } catch (err) {
      console.error(`[cmd=${interaction.commandName}] error`, err)
      const payload = { content: 'Something went wrong.', flags: EPHEMERAL }
      if (interaction.deferred || interaction.replied) {
        try { await interaction.followUp(payload) } catch {}
      } else {
        try { await interaction.reply(payload) } catch {}
      }
    }
  }
}
