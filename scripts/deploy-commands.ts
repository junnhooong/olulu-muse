import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { commands } from '../src/commands/index.js'

const { DISCORD_TOKEN, CLIENT_ID } = process.env
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID')
  process.exit(1)
}

const body = [...commands.values()].map((c) => c.data.toJSON())
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

try {
  console.log(`Deploying ${body.length} slash commands...`)
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body })
  console.log('Done.')
} catch (err) {
  console.error('Failed to deploy:', err)
  process.exit(1)
}
