migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.add(new JSONField({ name: 'itens' }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.removeByName('itens')
    app.save(col)
  },
)
