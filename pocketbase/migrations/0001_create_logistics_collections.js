migrate(
  (app) => {
    const quotations = new Collection({
      name: 'quotations',
      type: 'base',
      listRule: 'user_id = @request.auth.id',
      viewRule: 'user_id = @request.auth.id',
      createRule: 'user_id = @request.auth.id',
      updateRule: 'user_id = @request.auth.id',
      deleteRule: 'user_id = @request.auth.id',
      fields: [
        { name: 'agent_name', type: 'text', required: true },
        {
          name: 'modal',
          type: 'select',
          required: true,
          values: ['Aéreo', 'FCL', 'LCL'],
          maxSelect: 1,
        },
        { name: 'cost', type: 'number', required: true },
        { name: 'transit_time', type: 'number', required: true },
        { name: 'etd', type: 'date', required: true },
        { name: 'free_time', type: 'number' },
        { name: 'score', type: 'number' },
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
      indexes: ['CREATE INDEX idx_quotations_user_id ON quotations (user_id)'],
    })
    app.save(quotations)

    const extractedData = new Collection({
      name: 'extracted_data',
      type: 'base',
      listRule: 'quotation_id.user_id = @request.auth.id',
      viewRule: 'quotation_id.user_id = @request.auth.id',
      createRule: 'quotation_id.user_id = @request.auth.id',
      updateRule: 'quotation_id.user_id = @request.auth.id',
      deleteRule: 'quotation_id.user_id = @request.auth.id',
      fields: [
        {
          name: 'quotation_id',
          type: 'relation',
          required: true,
          collectionId: quotations.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'raw_data', type: 'json', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_extracted_data_quotation_id ON extracted_data (quotation_id)'],
    })
    app.save(extractedData)
  },
  (app) => {
    try {
      const extractedData = app.findCollectionByNameOrId('extracted_data')
      app.delete(extractedData)
    } catch (_) {}
    try {
      const quotations = app.findCollectionByNameOrId('quotations')
      app.delete(quotations)
    } catch (_) {}
  },
)
