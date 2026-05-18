migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    if (!col.fields.getByName('rate_unitario')) {
      col.fields.add(new NumberField({ name: 'rate_unitario' }))
    }
    if (!col.fields.getByName('frequencia')) {
      col.fields.add(
        new SelectField({
          name: 'frequencia',
          values: ['daily', '3x_semana', '1x_semana', 'sob_consulta'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('aeroporto_origem')) {
      col.fields.add(new TextField({ name: 'aeroporto_origem' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')
    col.fields.removeByName('rate_unitario')
    col.fields.removeByName('frequencia')
    col.fields.removeByName('aeroporto_origem')
    app.save(col)
  },
)
