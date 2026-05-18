migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    if (!col.fields.getByName('cost_breakdown')) {
      col.fields.add(
        new JSONField({
          name: 'cost_breakdown',
          maxSize: 2000000,
        }),
      )
    }

    if (!col.fields.getByName('option_description')) {
      col.fields.add(
        new TextField({
          name: 'option_description',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')
    col.fields.removeByName('cost_breakdown')
    col.fields.removeByName('option_description')
    app.save(col)
  },
)
