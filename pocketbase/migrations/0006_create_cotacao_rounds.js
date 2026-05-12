migrate(
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos')
    const rounds = new Collection({
      name: 'cotacao_rounds',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')",
      viewRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')",
      createRule: 'user_id = @request.auth.id',
      updateRule: 'user_id = @request.auth.id',
      deleteRule: 'user_id = @request.auth.id',
      fields: [
        {
          name: 'pedido_id',
          type: 'relation',
          required: true,
          collectionId: pedidos.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'nome_round',
          type: 'select',
          required: true,
          values: ['cota1', 'cota2'],
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(rounds)
  },
  (app) => {
    const rounds = app.findCollectionByNameOrId('cotacao_rounds')
    app.delete(rounds)
  },
)
