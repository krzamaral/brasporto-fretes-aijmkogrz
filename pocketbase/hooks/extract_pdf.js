routerAdd('OPTIONS', '/backend/v1/extract-pdf', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Headers', 'authorization, apikey, content-type')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')

    const body = e.requestInfo().body
    if (!body || !body.text) {
      throw new BadRequestError('Texto ausente na requisição.')
    }

    const apiKey = $secrets.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new InternalServerError('OPENAI_API_KEY não configurada.')
    }

    const docType = body.docType || 'pedido'
    let prompt = ''

    if (docType === 'pedido') {
      prompt =
        'Você é um especialista em logística e extração de dados.\n' +
        'Extraia as seguintes informações logísticas do texto abaixo:\n\n' +
        '- Origem: Formato obrigatório "Cidade, País" (ex: "São Paulo, Brasil").\n' +
        '- Destino: Apenas o nome do Porto ou Aeroporto (sem endereço completo, sem ruas, sem CEP. Ex: "GRU - Aeroporto de Guarulhos" ou "Porto de Santos").\n' +
        '- Peso Bruto: Numérico, em kg.\n' +
        '- Volume: Numérico, em m³. Se o texto listar apenas dimensões (ex: 2m x 1m x 1.5m ou comprimento, largura e altura), você DEVE calcular o volume multiplicando as dimensões e retornar o resultado em m³. Se não houver volume nem dimensões, retorne null. NÃO INVENTE VALORES.\n' +
        '- Quantidade de Containers: Numérico, ou null.\n' +
        '- Tipo de Mercadoria: Texto descritivo curto.\n' +
        '- Modal Desejado: Deve ser "Aéreo", "FCL" ou "LCL".\n' +
        '- Incoterm: EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR ou CIF.\n' +
        '- Prazo Desejado: Numérico em dias, ou null.\n\n' +
        'Retorne APENAS um JSON válido no seguinte formato, sem markdown:\n' +
        '{\n' +
        '  "origem": "string",\n' +
        '  "destino": "string",\n' +
        '  "peso_bruto": 123.4,\n' +
        '  "volume": 12.3,\n' +
        '  "quantidade_containers": 1,\n' +
        '  "tipo_mercadoria": "string",\n' +
        '  "modal_desejado": "Aéreo",\n' +
        '  "incoterm": "FOB",\n' +
        '  "prazo_desejado_dias": 30\n' +
        '}\n\n' +
        'TEXTO:\n' +
        body.text
    } else {
      prompt =
        'Você é um especialista em extração de dados logísticos.\n' +
        'Extraia as cotações concorrentes do texto abaixo. Pode haver várias cotações no mesmo documento.\n\n' +
        'Para cada cotação, extraia:\n' +
        '- agent_name: Nome da empresa ou agente de carga.\n' +
        '- modal: "Aéreo", "FCL" ou "LCL".\n' +
        '- cost: Numérico, custo total da cotação em USD.\n' +
        '- transit_time: Numérico, prazo de trânsito em dias.\n' +
        '- etd: Data prevista de partida no formato YYYY-MM-DD, ou null.\n' +
        '- free_time: Numérico, dias livres, ou null.\n' +
        '- taxable_weight: Numérico, peso taxável em kg, ou null.\n' +
        '- incoterm: O incoterm utilizado na cotação (ex: FOB, EXW), ou null.\n\n' +
        'Retorne APENAS um JSON válido no seguinte formato, sem markdown:\n' +
        '{\n' +
        '  "type": "multiple",\n' +
        '  "quotations": [\n' +
        '    {\n' +
        '      "agent_name": "string",\n' +
        '      "modal": "Aéreo",\n' +
        '      "cost": 123.4,\n' +
        '      "transit_time": 10,\n' +
        '      "etd": "2024-12-01",\n' +
        '      "free_time": 5,\n' +
        '      "taxable_weight": 1500.0,\n' +
        '      "incoterm": "FOB"\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'TEXTO:\n' +
        body.text
    }

    const aiBody = {
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }

    const res = $http.send({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify(aiBody),
      timeout: 60,
    })

    if (res.statusCode < 200 || res.statusCode >= 300) {
      $app.logger().error('OpenAI Error', 'status', res.statusCode, 'body', res.json || res.body)
      throw new BadRequestError('Falha ao processar o documento com a IA.')
    }

    try {
      const jsonStr = res.json.choices[0].message.content
      const data = JSON.parse(jsonStr)
      return e.json(200, { data })
    } catch (err) {
      $app.logger().error('Parse Error', 'error', String(err))
      throw new BadRequestError('A IA retornou um formato inválido.')
    }
  },
  $apis.requireAuth(),
)
