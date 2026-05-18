onRecordCreate((e) => {
  const record = e.record
  if (record.getString('modal') === 'LCL' && record.getString('pedido_id')) {
    try {
      const pedido = $app.findRecordById('pedidos', record.getString('pedido_id'))
      const pesoBruto = pedido.getFloat('peso_bruto') || 0
      let volume = pedido.getFloat('volume') || 0

      let calcVolume = 0
      try {
        const itens = pedido.get('itens')
        if (Array.isArray(itens) && itens.length > 0) {
          calcVolume = itens.reduce((acc, item) => {
            const c = Number(item.comprimento) || 0
            const l = Number(item.largura) || 0
            const a = Number(item.altura) || 0
            const q = Number(item.quantidade) || 1
            return acc + (c * l * a * q) / 1000000
          }, 0)
        } else {
          const comp = pedido.getFloat('comprimento') || 0
          const larg = pedido.getFloat('largura') || 0
          const alt = pedido.getFloat('altura') || 0
          const qtd = pedido.getFloat('quantidade_containers') || 1
          if (comp && larg && alt) {
            calcVolume = (comp * larg * alt * qtd) / 1000000
          }
        }
      } catch (err) {}

      if (calcVolume > volume) volume = calcVolume

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

      let calcVolume = 0
      try {
        const itens = pedido.get('itens')
        if (Array.isArray(itens) && itens.length > 0) {
          calcVolume = itens.reduce((acc, item) => {
            const c = Number(item.comprimento) || 0
            const l = Number(item.largura) || 0
            const a = Number(item.altura) || 0
            const q = Number(item.quantidade) || 1
            return acc + (c * l * a * q) / 1000000
          }, 0)
        } else {
          const comp = pedido.getFloat('comprimento') || 0
          const larg = pedido.getFloat('largura') || 0
          const alt = pedido.getFloat('altura') || 0
          const qtd = pedido.getFloat('quantidade_containers') || 1
          if (comp && larg && alt) {
            calcVolume = (comp * larg * alt * qtd) / 1000000
          }
        }
      } catch (err) {}

      if (calcVolume > volume) volume = calcVolume

      const baseWeight = Math.max(pesoBruto / 1000, volume)
      const calcWeight = Math.max(4, Math.ceil(baseWeight))
      record.set('taxable_weight', calcWeight)
    } catch (err) {
      $app.logger().warn('Failed to apply LCL taxable weight: ' + String(err))
    }
  }
  e.next()
}, 'quotations')
