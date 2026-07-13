import * as ping from './ping.js'
import * as play from './play.js'
import * as skip from './skip.js'
import * as pause from './pause.js'
import * as resume from './resume.js'
import * as stop from './stop.js'
import * as leave from './leave.js'
import * as shuffle from './shuffle.js'

export const commands = new Map([
  ['ping', ping],
  ['play', play],
  ['skip', skip],
  ['pause', pause],
  ['resume', resume],
  ['stop', stop],
  ['leave', leave],
  ['shuffle', shuffle],
])
