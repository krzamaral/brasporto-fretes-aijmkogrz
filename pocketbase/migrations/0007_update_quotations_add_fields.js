migrate(
  (app) => {
    const rounds = app.findCollectionByNameOrId('cotacao_rounds')
    const pedidos = app.findCollectionByNameOrId('pedidos')
    const quotations = app.findCollectionByNameOrId('quotations')

    quotations.fields.add(
      new RelationField({
        name: 'cotacao_round_id',
        collectionId: rounds.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }),
    )

    quotations.fields.add(
      new NumberField({
        name: 'compatibilidade_score',
        required: false,
      }),
    )

    quotations.fields.add(
      new RelationField({
        name: 'pedido_id',
        collectionId: pedidos.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }),
    )

    quotations.listRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')"
    quotations.viewRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.email ~ '@brasporto.com')"

    app.save(quotations)
  },
  (app) => {
    const quotations = app.findCollectionByNameOrId('quotations')
    quotations.fields.removeByName('cotacao_round_id')
    quotations.fields.removeByName('compatibilidade_score')
    quotations.fields.removeByName('pedido_id')
    quotations.listRule = "@request.auth.id != ''"
    quotations.viewRule = "@request.auth.id != ''"
    app.save(quotations)
  },
)
