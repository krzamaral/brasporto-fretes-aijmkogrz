migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    if (!col.fields.getByName('taxable_weight')) {
      col.fields.add(new NumberField({ name: 'taxable_weight', required: false }))
    }

    const transitTime = col.fields.getByName('transit_time')
    if (transitTime) {
      transitTime.required = false
    }

    const etd = col.fields.getByName('etd')
    if (etd) {
      etd.required = false
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    if (col.fields.getByName('taxable_weight')) {
      col.fields.removeByName('taxable_weight')
    }

    const transitTime = col.fields.getByName('transit_time')
    if (transitTime) {
      transitTime.required = true
    }

    const etd = col.fields.getByName('etd')
    if (etd) {
      etd.required = true
    }

    app.save(col)
  },
)
