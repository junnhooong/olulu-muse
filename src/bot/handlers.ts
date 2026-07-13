import type { CommandContext, CommandInteraction, CommandModule } from '../types.js'

const EPHEMERAL = 1 << 6

export interface CreateHandlerOptions {
  commands: Map<string, Pick<CommandModule, 'execute'>>
  ctx: CommandContext
}

interface HandledInteraction extends Partial<CommandInteraction> {
  isChatInputCommand?: () => boolean
  commandName: string
  reply(payload: unknown): Promise<unknown>
  followUp(payload: unknown): Promise<unknown>
}

export function createHandler({ commands, ctx }: CreateHandlerOptions) {
  return async function handle(interaction: HandledInteraction): Promise<void> {
    if (!interaction.isChatInputCommand?.()) return
    const cmd = commands.get(interaction.commandName)
    if (!cmd) {
      await interaction.reply({ content: `Unknown command: ${interaction.commandName}`, flags: EPHEMERAL })
      return
    }
    try {
      await cmd.execute(interaction as CommandInteraction, ctx)
    } catch (err) {
      console.error(`[cmd=${interaction.commandName}] error`, err)
      const payload = { content: 'Something went wrong.', flags: EPHEMERAL }
      if (interaction.deferred || interaction.replied) {
        try { await interaction.followUp(payload) } catch { /* ignore */ }
      } else {
        try { await interaction.reply(payload) } catch { /* ignore */ }
      }
    }
  }
}
