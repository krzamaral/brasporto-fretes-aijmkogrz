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
    const base64Data = body.pdfBase64
    const docType = body.docType || 'cota2'

    if (!base64Data) {
      throw new BadRequestError('Arquivo PDF ausente na requisição.')
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions'
    const apiKey = $secrets.get('OPENAI_API_KEY') || ''

    if (!apiKey) {
      throw new UnauthorizedError('OPENAI_API_KEY secret is not configured.')
    }

    let sysPrompt = ''
    if (docType === 'pedido') {
      sysPrompt =
        'Extraia os dados do pedido (load request) do documento. Retorne APENAS um objeto JSON válido no seguinte formato exato (sem blocos de código ou markdown):\n{\n  "origem": "string",\n  "destino": "string",\n  "peso_bruto": 0.0,\n  "volume": 0.0,\n  "tipo_mercadoria": "string",\n  "modal_desejado": "Aéreo",\n  "prazo_desejado_dias": 0\n}\nO campo modal_desejado deve ser estritamente "Aéreo", "FCL", ou "LCL".'
    } else if (docType === 'cota1') {
      sysPrompt =
        'Extraia MÚLTIPLAS opções de frete (cotações) do documento. Retorne APENAS um objeto JSON válido no seguinte formato exato:\n{\n  "type": "multiple",\n  "quotations": [\n    {\n      "agent_name": "string",\n      "modal": "Aéreo",\n      "cost": 0.0,\n      "transit_time": 0,\n      "etd": "YYYY-MM-DD",\n      "free_time": 0,\n      "taxable_weight": 0\n    }\n  ]\n}\nO campo modal deve ser estritamente "Aéreo", "FCL", ou "LCL".'
    } else {
      sysPrompt =
        'Extraia UMA opção de frete (cotação) do documento. Retorne APENAS um objeto JSON válido no seguinte formato exato:\n{\n  "type": "single",\n  "data": {\n    "agent_name": "string",\n    "modal": "Aéreo",\n    "cost": 0.0,\n    "transit_time": 0,\n    "etd": "YYYY-MM-DD",\n    "free_time": 0,\n    "taxable_weight": 0\n  }\n}\nO campo modal deve ser estritamente "Aéreo", "FCL", ou "LCL".'
    }

    const aiPayload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: sysPrompt },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Data}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
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
        body: JSON.stringify(aiPayload),
        timeout: 120,
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

      $app
        .logger()
        .error('AI extraction failed', 'status', res.statusCode, 'body', res.json || res.body)

      if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 404) {
        throw new BadRequestError('O arquivo enviado é inválido ou erro de autenticação na IA.')
      }

      if (res.statusCode === 413) {
        throw new BadRequestError('O PDF excede o limite de tamanho.')
      }

      if (i === retries.length) {
        throw new InternalServerError('Falha na comunicação com o serviço de IA.')
      }
    }

    let content = res.json?.choices?.[0]?.message?.content || '{}'
    let extracted = {}
    try {
      content = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
      extracted = JSON.parse(content)
    } catch (err) {
      $app.logger().error('AI parse failed', 'content', content)
      return e.badRequestError('Não foi possível interpretar os dados do PDF.')
    }

    return e.json(200, { data: extracted })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(10 * 1024 * 1024),
)
