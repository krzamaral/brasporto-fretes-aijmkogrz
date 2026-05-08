migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'keiler@brasporto.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('keiler@brasporto.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Keiler')
      app.save(user)
    }

    const quotationsCol = app.findCollectionByNameOrId('quotations')

    const seedData = [
      {
        agent_name: 'Kuehne + Nagel',
        modal: 'FCL',
        cost: 2450.0,
        transit_time: 35,
        etd: '2026-06-15 10:00:00.000Z',
        free_time: 14,
        score: 92,
        user_id: user.id,
      },
      {
        agent_name: 'DHL Global Forwarding',
        modal: 'Aéreo',
        cost: 5800.0,
        transit_time: 5,
        etd: '2026-06-01 18:00:00.000Z',
        free_time: 3,
        score: 88,
        user_id: user.id,
      },
      {
        agent_name: 'DSV Panalpina',
        modal: 'LCL',
        cost: 850.0,
        transit_time: 40,
        etd: '2026-06-20 12:00:00.000Z',
        free_time: 7,
        score: 85,
        user_id: user.id,
      },
    ]

    for (const data of seedData) {
      try {
        app.findFirstRecordByData('quotations', 'agent_name', data.agent_name)
      } catch (_) {
        const record = new Record(quotationsCol)
        record.set('agent_name', data.agent_name)
        record.set('modal', data.modal)
        record.set('cost', data.cost)
        record.set('transit_time', data.transit_time)
        record.set('etd', data.etd)
        record.set('free_time', data.free_time)
        record.set('score', data.score)
        record.set('user_id', data.user_id)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'keiler@brasporto.com')
      const records = app.findRecordsByFilter('quotations', `user_id = '${user.id}'`, '', 100, 0)
      for (const record of records) {
        app.delete(record)
      }
      app.delete(user)
    } catch (_) {}
  },
)
