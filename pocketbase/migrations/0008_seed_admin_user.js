migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    try {
      app.findAuthRecordByEmail('users', 'tatiana@brasporto.com')
      return // already seeded
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('tatiana@brasporto.com')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Tatiana')

    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('users', 'tatiana@brasporto.com')
      app.delete(record)
    } catch (_) {}
  },
)
