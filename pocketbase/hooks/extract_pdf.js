routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.text) {
      throw new BadRequestError('Texto não fornecido')
    }

    const apiKey = $secrets.get('OPENAI_API_KEY') || ''
    if (!apiKey) {
      throw new UnauthorizedError('OPENAI_API_KEY não configurada')
    }

    let prompt = ''
    let responseFormat = {}

    if (body.docType === 'pedido') {
      prompt = `Você é um assistente especializado em logística. Extraia as informações do seguinte e-mail ou documento de solicitação de cotação. 
    ATENÇÃO CRÍTICA: Quando houver uma thread de e-mails, priorize SEMPRE as informações fornecidas pelo solicitante (Brasporto) no pedido original. Ignore qualquer peso ou dimensão divergente respondida posteriormente pelo agente.
    
    Retorne um JSON com os seguintes campos:
    - origem: string
    - destino: string
    - peso_bruto: number (em kg)
    - volume: number (em m³)
    - quantidade_containers: number
    - tipo_mercadoria: string
    - modal_desejado: string ("Aéreo", "FCL" ou "LCL")
    - incoterm: string (ex: "EXW", "FOB", etc.)
    - prazo_desejado_dias: number
    - itens: array de objetos com { comprimento: number, largura: number, altura: number, quantidade: number } (dimensões em cm. Se o documento informar múltiplas caixas/paletes com dimensões diferentes, liste todos aqui. Caso seja só um tipo, coloque-o aqui também).

    Texto do documento:
    """
    ${body.text}
    """`

      responseFormat = { type: 'json_object' }
    } else if (body.docType === 'cotacao') {
      prompt = `Você é um assistente especializado em logística. Extraia as informações do seguinte e-mail ou PDF de cotação (resposta do agente).
    ATENÇÃO: Extraia os custos e taxas do agente. Se houver divergência nas dimensões da carga em relação ao pedido original da Brasporto, apenas registre as taxas financeiras e prazos da cotação.
    
    Retorne um JSON com a chave "quotations" contendo um array de objetos. Cada objeto deve ter:
    - agent_name: string
    - modal: string ("Aéreo", "FCL" ou "LCL")
    - cost: number (custo total ALL-IN)
    - transit_time: number (em dias)
    - free_time: number (em dias)
    - taxable_weight: number (em kg ou ton/m³)
    - etd: string (formato YYYY-MM-DD)
    - incoterm: string (ex: "EXW", "FCA", etc.)
    - cost_breakdown: objeto com { frete_unitario: number, taxas_origem: number, pickup_fee: number, destination_taxes: number, taxas_adicionais: array de { tipo: "por_embarque" ou "por_kg", valor: number, descricao: string } }

    Texto do documento:
    """
    ${body.text}
    """`

      responseFormat = { type: 'json_object' }
    } else {
      throw new BadRequestError('docType inválido')
    }

    const aiBody = {
      model: 'gpt-4o',
      response_format: responseFormat,
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

    if (res.statusCode >= 400) {
      throw new BadRequestError('Falha na API da IA', res.json)
    }

    let extractedData = {}
    try {
      const content = res.json.choices[0].message.content
      extractedData = JSON.parse(content)
    } catch (err) {
      throw new BadRequestError('Falha ao analisar a resposta da IA')
    }

    return e.json(200, { data: extractedData })
  },
  $apis.requireAuth(),
)
