migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.add(
      new SelectField({
        name: 'incoterm',
        required: true,
        maxSelect: 1,
        values: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'],
      }),
    )
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.removeByName('incoterm')
    app.save(col)
  },
)
