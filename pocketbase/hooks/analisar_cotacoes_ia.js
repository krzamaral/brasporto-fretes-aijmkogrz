routerAdd('OPTIONS', '/backend/v1/analisar-cotacoes-ia', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Headers', 'authorization, apikey, content-type')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/analisar-cotacoes-ia',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')

    const body = e.requestInfo().body

    if (
      !body ||
      !body.pedido_id ||
      !body.cotacoes ||
      body.prazo_desejado_dias === undefined ||
      !body.origem ||
      !body.destino ||
      body.peso_bruto === undefined ||
      !body.modal_desejado
    ) {
      throw new BadRequestError('Todos os campos são obrigatórios.')
    }

    const cotacoes = body.cotacoes
    const prazo_desejado = body.prazo_desejado_dias

    let validas = []
    let descartadas = []

    for (let c of cotacoes) {
      let tt = c.transit_time || 0
      if (tt / prazo_desejado > 1.2) {
        descartadas.push(c)
      } else {
        validas.push(c)
      }
    }

    if (validas.length === 0) {
      throw new BadRequestError('Nenhuma cotacao atende o prazo maximo de 20%')
    }

    let vencedora = validas[0]
    for (let i = 1; i < validas.length; i++) {
      if (validas[i].cost < vencedora.cost) {
        vencedora = validas[i]
      }
    }

    let descartadasTexto =
      descartadas
        .map(
          (c) =>
            '- Agente: ' +
            c.agent_name +
            ', Custo: US$ ' +
            c.cost +
            ', Prazo: ' +
            c.transit_time +
            ' dias (Motivo: Prazo excedeu 120% do desejado)',
        )
        .join('\n') || 'Nenhuma'

    const prompt =
      'Voce e um especialista em logistica internacional. Analise a cotacao vencedora e gere um template de proposta para enviar ao cliente.\n\n' +
      'DADOS DO PEDIDO:\n' +
      '- Origem: ' +
      body.origem +
      '\n' +
      '- Destino: ' +
      body.destino +
      '\n' +
      '- Peso: ' +
      body.peso_bruto +
      ' kg\n' +
      '- Modal desejado: ' +
      body.modal_desejado +
      '\n' +
      '- Prazo desejado: ' +
      body.prazo_desejado_dias +
      ' dias\n\n' +
      'COTACAO VENCEDORA:\n' +
      '- Agente: ' +
      vencedora.agent_name +
      '\n' +
      '- Modal: ' +
      vencedora.modal +
      '\n' +
      '- Custo: US$ ' +
      vencedora.cost +
      '\n' +
      '- Prazo: ' +
      vencedora.transit_time +
      ' dias\n' +
      '- ETD: ' +
      (vencedora.etd || 'N/A') +
      '\n' +
      '- Free Time: ' +
      (vencedora.free_time || 0) +
      ' dias\n' +
      '- Peso Taxavel: ' +
      (vencedora.taxable_weight || 0) +
      ' kg\n\n' +
      'COTACOES DESCARTADAS (motivo):\n' +
      descartadasTexto +
      '\n\n' +
      'Gere um template em PORTUGUES BRASILEIRO, estruturado assim:\n' +
      '1. Cabecalho: "PROPOSTA DE FRETE INTERNACIONAL"\n' +
      '2. Dados do pedido (origem, destino, peso, modal)\n' +
      '3. Cotacao selecionada (agente, modal, custo, prazo, etd)\n' +
      '4. Justificativa: Por que essa cotacao foi escolhida (melhor custo-beneficio, atende prazo, etc)\n' +
      '5. Proximos passos: "Confirme a aceitacao desta proposta para prosseguirmos com o embarque."\n\n' +
      'Retorne APENAS o template em JSON com campos: titulo, dados_pedido, cotacao_selecionada, justificativa, proximos_passos. Sem markdown, sem blocos de codigo.'

    const apiUrl = 'https://api.openai.com/v1/chat/completions'
    const apiKey = $secrets.get('OPENAI_API_KEY') || ''

    if (!apiKey) {
      throw new UnauthorizedError('OPENAI_API_KEY secret is not configured.')
    }

    const aiBody = {
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }

    const retries = [2000, 4000, 8000]
    let res
    for (let i = 0; i <= retries.length; i++) {
      res = $http.send({
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify(aiBody),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        break
      }

      if (res.statusCode === 503 && i < retries.length) {
        const sleepMs = retries[i]
        const wake = Date.now() + sleepMs
        while (Date.now() < wake) {}
        continue
      }

      if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 404) {
        $app.logger().error('AI API error', 'status', res.statusCode, 'body', res.json || res.body)
        return e.json(res.statusCode, { error: 'AI API error', details: res.json })
      }

      if (i === retries.length) {
        return e.json(503, { error: 'Service Unavailable', details: res.statusCode })
      }
    }

    let template = {}
    try {
      const aiJson = res.json
      const content = aiJson.choices[0].message.content
      template = JSON.parse(content)
    } catch (err) {
      $app.logger().error('AI Parse Error', 'error', String(err))
      template = { error: 'Failed to parse AI response' }
    }

    return e.json(200, {
      data: {
        cotacao_vencedora: vencedora,
        template: template,
      },
    })
  },
  $apis.requireAuth(),
)
