onRecordCreate((e) => {
  const record = e.record
  if (record.getString('modal') === 'LCL' && record.getString('pedido_id')) {
    try {
      const pedido = $app.findRecordById('pedidos', record.getString('pedido_id'))
      const pesoBruto = pedido.getFloat('peso_bruto') || 0
      let volume = pedido.getFloat('volume') || 0
      const comp = pedido.getFloat('comprimento') || 0
      const larg = pedido.getFloat('largura') || 0
      const alt = pedido.getFloat('altura') || 0
      const qtd = pedido.getFloat('quantidade_containers') || 1

      if (comp && larg && alt) {
        const vol = (comp * larg * alt * qtd) / 1000000
        if (vol > volume) volume = vol
      }

      const baseWeight = Math.max(pesoBruto / 1000, volume)
      const calcWeight = Math.max(4, Math.ceil(baseWeight))
      record.set('taxable_weight', calcWeight)
    } catch (err) {
      $app.logger().warn('Failed to apply LCL taxable weight: ' + String(err))
    }
  }
  e.next()
}, 'quotations')

onRecordUpdate((e) => {
  const record = e.record
  if (record.getString('modal') === 'LCL' && record.getString('pedido_id')) {
    try {
      const pedido = $app.findRecordById('pedidos', record.getString('pedido_id'))
      const pesoBruto = pedido.getFloat('peso_bruto') || 0
      let volume = pedido.getFloat('volume') || 0
      const comp = pedido.getFloat('comprimento') || 0
      const larg = pedido.getFloat('largura') || 0
      const alt = pedido.getFloat('altura') || 0
      const qtd = pedido.getFloat('quantidade_containers') || 1

      if (comp && larg && alt) {
        const vol = (comp * larg * alt * qtd) / 1000000
        if (vol > volume) volume = vol
      }

      const baseWeight = Math.max(pesoBruto / 1000, volume)
      const calcWeight = Math.max(4, Math.ceil(baseWeight))
      record.set('taxable_weight', calcWeight)
    } catch (err) {
      $app.logger().warn('Failed to apply LCL taxable weight: ' + String(err))
    }
  }
  e.next()
}, 'quotations')
