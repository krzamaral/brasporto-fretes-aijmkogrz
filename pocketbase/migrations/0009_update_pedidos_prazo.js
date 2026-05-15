migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    const field = col.fields.getByName('prazo_desejado_dias')
    if (field) {
      field.required = false
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    const field = col.fields.getByName('prazo_desejado_dias')
    if (field) {
      field.required = true
      app.save(col)
    }
  },
)
