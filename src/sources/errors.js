export class SourceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SourceError'
  }
}
