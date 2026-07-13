import * as ping from './ping.js'
import * as play from './play.js'
import * as skip from './skip.js'
import * as pause from './pause.js'
import * as resume from './resume.js'
import * as stop from './stop.js'
import * as leave from './leave.js'
import * as shuffle from './shuffle.js'
import * as loop from './loop.js'
import * as volume from './volume.js'
import * as queue from './queue.js'
import * as nowplaying from './nowplaying.js'
import type { CommandModule } from '../types.js'

export const commands: Map<string, CommandModule> = new Map<string, CommandModule>([
  ['ping', ping],
  ['play', play],
  ['skip', skip],
  ['pause', pause],
  ['resume', resume],
  ['stop', stop],
  ['leave', leave],
  ['shuffle', shuffle],
  ['loop', loop],
  ['volume', volume],
  ['queue', queue],
  ['nowplaying', nowplaying],
])
