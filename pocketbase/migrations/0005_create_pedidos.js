migrate(
  (app) => {
    const pedidos = new Collection({
      name: 'pedidos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')",
      viewRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')",
      createRule: 'user_id = @request.auth.id',
      updateRule: 'user_id = @request.auth.id',
      deleteRule: 'user_id = @request.auth.id',
      fields: [
        { name: 'origem', type: 'text', required: true },
        { name: 'destino', type: 'text', required: true },
        { name: 'peso_bruto', type: 'number', required: true },
        { name: 'volume', type: 'number', required: false },
        { name: 'tipo_mercadoria', type: 'text', required: false },
        {
          name: 'modal_desejado',
          type: 'select',
          required: true,
          values: ['Aéreo', 'FCL', 'LCL'],
          maxSelect: 1,
        },
        { name: 'prazo_desejado_dias', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aguardando_cotacao', 'em_andamento', 'concluido'],
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
    app.save(pedidos)
  },
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos')
    app.delete(pedidos)
  },
)
