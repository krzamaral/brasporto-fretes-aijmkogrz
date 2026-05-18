migrate(
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos')
    if (!pedidos.fields.getByName('comprimento'))
      pedidos.fields.add(new NumberField({ name: 'comprimento', required: false }))
    if (!pedidos.fields.getByName('largura'))
      pedidos.fields.add(new NumberField({ name: 'largura', required: false }))
    if (!pedidos.fields.getByName('altura'))
      pedidos.fields.add(new NumberField({ name: 'altura', required: false }))
    app.save(pedidos)

    const quotations = app.findCollectionByNameOrId('quotations')
    if (!quotations.fields.getByName('status')) {
      quotations.fields.add(
        new SelectField({
          name: 'status',
          values: ['em_analise', 'aprovado', 'rejeitado'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    app.save(quotations)

    app
      .db()
      .newQuery("UPDATE quotations SET status = 'em_analise' WHERE status = '' OR status IS NULL")
      .execute()
  },
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos')
    pedidos.fields.removeByName('comprimento')
    pedidos.fields.removeByName('largura')
    pedidos.fields.removeByName('altura')
    app.save(pedidos)

    const quotations = app.findCollectionByNameOrId('quotations')
    quotations.fields.removeByName('status')
    app.save(quotations)
  },
)
