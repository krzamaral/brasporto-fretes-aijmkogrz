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

    const body = e.requestInfo().body || {}
    const text = body.text
    const step = body.step
    const docType = body.docType

    if (!text) {
      throw new BadRequestError('Texto do documento ausente.')
    }

    const apiKey = $secrets.get('OPENAI_API_KEY') || ''
    if (!apiKey) {
      throw new InternalServerError('OPENAI_API_KEY não configurada.')
    }

    let prompt = ''

    if (step === 1 || docType === 'pedido') {
      prompt = `Você é um especialista em logística internacional.
Sua tarefa é extrair as seguintes informações a partir do texto do documento de solicitação de cotação de frete (Booking/Pedido) e retornar EXCLUSIVAMENTE em formato JSON.

Regras de Extração e Formatação:
1. origem: Extraia a origem da carga. OBRIGATÓRIO: Formatar APENAS no padrão "Cidade, País". Remova completamente endereços de rua, números, bairros ou CEPs. Exemplos corretos: "Shanghai, China", "Santos, Brasil", "Miami, USA".
2. destino: Extraia o destino.
3. peso_bruto: Peso bruto total em kg (apenas número, ou null se não houver).
4. volume: Volume total em metros cúbicos (CBM) (apenas número, ou null).
5. quantidade_containers: Se houver indicação de contêiner (ex: 2x40HC), extraia a quantidade (apenas número, ou null).
6. tipo_mercadoria: Descrição do tipo de carga.
7. modal_desejado: Deve ser estritamente "Aéreo", "FCL" ou "LCL". Inferir pelo texto (ex: se mencionar containers, é FCL; se mencionar CBM sem container, LCL; se mencionar Air, Aéreo).
8. incoterm: Extraia o Incoterm mencionado. Você DEVE mapeá-lo para UM DESTES valores estritos: EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF. Se não conseguir identificar, retorne null.
9. prazo_desejado_dias: Prazo transit time desejado em dias (apenas número, ou null).

TEXTO PARA ANÁLISE:
"""
${text}
"""
`
    } else {
      prompt = `Você é um especialista em logística internacional.
Sua tarefa é extrair as cotações concorrentes presentes no documento e retornar EXCLUSIVAMENTE um objeto JSON contendo um array chamado "quotations".

Para cada cotação encontrada no array "quotations", extraia:
- agent_name: Nome do agente de cargas ou armador fornecendo a cotação.
- modal: "Aéreo", "FCL" ou "LCL".
- cost: Custo total em Dólar (USD). (apenas número float).
- transit_time: Transit time em dias (apenas número, ou null).
- free_time: Free time de Demurrage/Detention em dias (apenas número, ou null).
- taxable_weight: Peso taxado / Chargeable weight em kg (apenas número, ou null).
- etd: Estimated Time of Departure em formato YYYY-MM-DD (ou null).
- incoterm: O Incoterm associado à cotação, devendo ser estritamente mapeado para um destes: EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF. (ou null se não aplicável/não encontrado).

TEXTO PARA ANÁLISE:
"""
${text}
"""
`
    }

    const aiBody = {
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente de IA focado em extração de dados logísticos. Sempre retorne a resposta estritamente no formato JSON solicitado.',
        },
        { role: 'user', content: prompt },
      ],
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
      $app
        .logger()
        .error('Erro na API da OpenAI', 'status', res.statusCode, 'body', res.json || res.body)
      throw new BadRequestError('Falha ao processar o documento com a IA.')
    }

    let parsedData = {}
    try {
      const content = res.json.choices[0].message.content
      parsedData = JSON.parse(content)
    } catch (err) {
      $app.logger().error('Erro no parse do JSON da IA', 'err', String(err))
      throw new BadRequestError('Resposta inválida do serviço de IA.')
    }

    return e.json(200, { data: parsedData })
  },
  $apis.requireAuth(),
)
