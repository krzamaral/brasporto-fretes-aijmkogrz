migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')
    const costField = col.fields.getByName('cost')
    if (costField) {
      costField.required = false
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')
    const costField = col.fields.getByName('cost')
    if (costField) {
      costField.required = true
      app.save(col)
    }
  },
)
