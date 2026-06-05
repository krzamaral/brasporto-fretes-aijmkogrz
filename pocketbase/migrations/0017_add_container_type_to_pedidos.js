migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.add(
      new SelectField({
        name: 'container_type',
        values: ['20FT', '40FT', '40HC', 'REEFER'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    col.fields.removeByName('container_type')
    app.save(col)
  },
)
