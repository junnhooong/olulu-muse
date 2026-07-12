import 'dotenv/config'

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment')
  process.exit(1)
}

console.log('olulu-muse booting...')
