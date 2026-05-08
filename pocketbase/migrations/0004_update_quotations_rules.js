migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    // Allow all authenticated users to read/view all quotations for the shared history
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('quotations')

    col.listRule = 'user_id = @request.auth.id'
    col.viewRule = 'user_id = @request.auth.id'

    app.save(col)
  },
)
