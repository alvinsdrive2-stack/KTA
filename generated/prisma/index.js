const { PrismaClient } = require('@prisma/client')

module.exports = {
  PrismaClient
}

// Untuk tes connection dengan adapter kosong
class TestPrismaClient extends PrismaClient {
  constructor() {
    super({
      __internal: {
        engine: {
          binaryPath: undefined
        }
      }
    })
  }
}