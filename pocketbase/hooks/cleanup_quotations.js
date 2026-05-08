cronAdd('cleanup_quotations', '0 0 * * *', () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ')

  try {
    const records = $app.findRecordsByFilter('quotations', `updated < '${dateStr}'`, '', 10000, 0)

    let count = 0
    for (const record of records) {
      $app.delete(record)
      count++
    }

    $app.logger().info('Cleanup: deleted old quotations', 'count', count)
  } catch (err) {
    // Log if anything goes wrong, though 'no rows in result set' throws and is caught here
  }
})
