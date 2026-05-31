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
    ATENÇÃO CRÍTICA:
    1. Granularidade: Uma linha de tabela ou oferta distinta (ex: diferentes faixas de peso como +100kg, +300kg, ou diferentes rotas/carriers) deve ser UM objeto de cotação distinto. NUNCA agregue múltiplas opções num só objeto.
    2. Sem Cálculos: NUNCA calcule custos totais. Retorne cost: null.
    3. Unit Rates: Extraia frete_unitario como número e currency (padrão "USD").
    4. Weight Breaks: Regras como "+100" ou "MIN" devem ir para weight_break (string). Não coloque textos em taxable_weight.
    5. Origem/EXW: Use formula_origem (string) para fórmulas baseadas em peso e taxas_origem (number) para valores fixos.
    6. Pickup/Adicionais: Extraia pickup_options como array de { local: string, valor: number } e taxas_adicionais como array de { tipo, valor, minimo, descricao, condicional }.
    7. Transit Time: Extraia transit_time_min e transit_time_max (numbers).
    8. REGRA DOCUMENTO-NÍVEL: Identifique formula_origem, taxas_origem, pickup_options e incoterm como valores de nível de documento globais. Repita esses valores idênticos em todos os objetos de cotação dentro do array retornado. Certifique-se de que pickup_options nunca fique vazio se o documento contiver uma tabela de pickup. Formate pickup_options como um array de objetos: [{ "local": "City Name", "valor": 123 }].

    Retorne um JSON com a chave "quotations" contendo um array de objetos. Cada objeto deve ter:
    - agent_name: string (nome do agente)
    - carrier: string (companhia aérea/marítima, se houver)
    - pol: string (Port/Airport of Loading)
    - pod: string (Port/Airport of Discharge)
    - modal: string ("Aéreo", "FCL" ou "LCL")
    - cost: null
    - transit_time_min: number (em dias)
    - transit_time_max: number (em dias)
    - free_time: number (em dias)
    - taxable_weight: number (apenas se for um valor numérico exato extraído do documento)
    - weight_break: string (ex: "+100", "+300", "MIN")
    - etd: string (formato YYYY-MM-DD)
    - incoterm: string (ex: "EXW", "FCA", etc.)
    - frete_unitario: number
    - currency: string
    - formula_origem: string
    - taxas_origem: number
    - pickup_options: array de { local, valor }
    - taxas_adicionais: array de { tipo, valor, minimo, descricao, condicional }

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
      temperature: 0,
      top_p: 0,
      seed: 7,
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
