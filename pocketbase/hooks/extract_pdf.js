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
    8. Frequência (frequencia): mapeie qualquer menção de periodicidade da rota/serviço para um destes valores EXATOS:
       - "daily" → diária, todo dia, daily, qualquer indicação de saídas diárias
       - "3x_semana" → 3x por semana, três vezes na semana, três voos/saídas por semana
       - "1x_semana" → semanal, weekly, 1x por semana, uma saída por semana
       - "sob_consulta" → quando o documento mencionar frequência mas com ressalva tipo "a confirmar", "sob disponibilidade"
       Se NÃO houver qualquer menção de frequência no documento, retorne null. NÃO inventar.
    9. REGRA DOCUMENTO-NÍVEL: Identifique formula_origem, taxas_origem, pickup_options e incoterm como valores de nível de documento globais. Repita esses valores idênticos em todos os objetos de cotação dentro do array retornado. Certifique-se de que pickup_options nunca fique vazio se o documento contiver uma tabela de pickup. Formate pickup_options como um array de objetos: [{ "local": "City Name", "valor": 123 }].

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
    - frequencia: 'daily' | '3x_semana' | '1x_semana' | 'sob_consulta' | null
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
    } else if (body.docType === 'cotacao_maritimo') {
      prompt = `Você é um assistente especializado em logística. Extraia as informações do seguinte e-mail ou PDF de cotação (FCL ou LCL) (resposta do agente).
    ATENÇÃO CRÍTICA:
    1. Granularidade: Uma linha de tabela ou oferta distinta (ex: diferentes rotas/carriers ou tipos de container) deve ser UM objeto de cotação distinto. NUNCA agregue múltiplas opções num só objeto.
    2. Sem Cálculos: NUNCA calcule custos totais. Retorne cost: null. O sistema extrai apenas o que o agente informou.
    3. Moedas Múltiplas: Preserve a moeda original informada no documento para cada taxa (ex: USD, EUR, BRL).
    4. Surcharges Marítimas: Mapeie as taxas para três seções específicas dentro de um objeto "surcharges":
       - "origin": Custos locais na origem, pré-transporte, taxas de BL, THC de origem, EXW pickup.
       - "freight": Frete marítimo (Ocean Freight), BAF, EBS e demais taxas diretas do armador aplicadas ao frete internacional.
       - "destination": Custos locais no destino, THC de destino, entrega.
    5. Container Info (FCL): Extraia "container_type" (ex: 20FT, 40HC) e "container_quantity". Se for LCL, preencha com null.
    6. Transit Time & Validade: Extraia "transit_time_min", "transit_time_max" (ambos numbers), "free_time_days" (number) e "validity_date" (formato YYYY-MM-DD).
    7. Frequência (frequencia): mapeie qualquer menção de periodicidade para: 'daily', '3x_semana', '1x_semana', 'sob_consulta', ou null se não houver.
    8. Totais Informados: Se o documento exibir totais ou subtotais, extraia para "totals_informed" contendo "all", "origin", "freight" e "destination" (cada um com { currency, amount }).
    9. Exclusões: Crie um array de strings "exclusions" com itens não inclusos mencionados (ex: seguro, armazenagem).

    Retorne um JSON com a chave "quotations" contendo um array de objetos. Cada objeto deve ter:
    - agent_name: string (nome do agente)
    - carrier: string (companhia marítima, se houver)
    - pol: string (Port of Loading)
    - pod: string (Port of Discharge)
    - modal: string ("FCL" ou "LCL")
    - container_type: string ou null
    - container_quantity: number ou null
    - cost: null
    - transit_time_min: number (em dias)
    - transit_time_max: number (em dias)
    - free_time_days: number (em dias)
    - validity_date: string (formato YYYY-MM-DD)
    - frequencia: 'daily' | '3x_semana' | '1x_semana' | 'sob_consulta' | null
    - incoterm: string (ex: "EXW", "FOB", etc.)
    - surcharges: objeto com { origin: [], freight: [], destination: [] }. Os arrays contém { type: string, description: string, currency: string, amount: number, per_unit: boolean }
    - totals_informed: objeto { all: { currency: string, amount: number }, origin: {...}, freight: {...}, destination: {...} } (apenas se fornecido pelo agente)
    - exclusions: array de strings (itens não inclusos)

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
