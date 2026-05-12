routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    const body = e.requestInfo().body || {}
    const base64Data = body.pdfBase64
    const docType = body.docType || 'cota2'

    if (!base64Data) {
      return e.badRequestError('Arquivo PDF ausente na requisição.')
    }

    let url = $secrets.get('SKIP_AI_GATEWAY_URL') || ''
    if (url.endsWith('/')) url = url.slice(0, -1)
    const apiKey = $secrets.get('SKIP_AI_GATEWAY_API_KEY') || ''

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
      model: 'claude-3-5-sonnet-20241022',
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

    const res = $http.send({
      url: url + '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify(aiPayload),
      timeout: 120,
    })

    if (res.statusCode !== 200) {
      $app
        .logger()
        .error('AI extraction failed', 'status', res.statusCode, 'body', res.json || res.body)
      if (res.statusCode === 400) return e.badRequestError('O PDF enviado é inválido ou ilegível.')
      if (res.statusCode === 413) return e.badRequestError('O PDF excede o limite de tamanho.')
      return e.internalServerError('Falha na comunicação com o serviço de IA.')
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
