migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')

    const pesoBrutoField = col.fields.getByName('peso_bruto')
    if (pesoBrutoField) {
      pesoBrutoField.required = false
    }

    if (!col.fields.getByName('quantidade_containers')) {
      col.fields.add(
        new NumberField({
          name: 'quantidade_containers',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')

    const pesoBrutoField = col.fields.getByName('peso_bruto')
    if (pesoBrutoField) {
      pesoBrutoField.required = true
    }

    if (col.fields.getByName('quantidade_containers')) {
      col.fields.removeByName('quantidade_containers')
    }

    app.save(col)
  },
)
