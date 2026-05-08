routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    const body = e.requestInfo().body || {}
    const base64Data = body.pdfBase64
    if (!base64Data) {
      return e.badRequestError('Missing pdfBase64 in body')
    }

    let url = $secrets.get('SKIP_AI_GATEWAY_URL') || ''
    if (url.endsWith('/')) url = url.slice(0, -1)
    const apiKey = $secrets.get('SKIP_AI_GATEWAY_API_KEY') || ''

    const aiPayload = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Extraia as seguintes informações deste documento de cotação de frete (PDF) e retorne os dados estritamente como um objeto JSON válido. Use APENAS JSON, sem blocos de código ou formatação markdown adicional:\n' +
                '{\n' +
                '  "agent_name": "string (nome da transportadora ou agente)",\n' +
                "  \"modal\": \"string (exatamente 'Aéreo', 'FCL', ou 'LCL')\",\n" +
                '  "cost": 0.0 (number, custo principal do frete),\n' +
                '  "transit_time": 0 (number, tempo de trânsito estimado em dias),\n' +
                '  "etd": "string (data de partida no formato YYYY-MM-DD)",\n' +
                '  "free_time": 0 (number, tempo livre em dias, use 0 se não aplicável),\n' +
                '  "taxable_weight": 0 (number, peso taxável, use 0 se não aplicável)\n' +
                '}',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Data}`,
              },
            },
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
      return e.internalServerError('Failed to extract data from PDF')
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
      return e.internalServerError('Failed to parse AI response')
    }

    const quotationsCol = $app.findCollectionByNameOrId('quotations')
    const quotation = new Record(quotationsCol)

    quotation.set('agent_name', extracted.agent_name || 'Desconhecido')

    const validModals = ['Aéreo', 'FCL', 'LCL']
    const modal = validModals.includes(extracted.modal) ? extracted.modal : 'FCL'
    quotation.set('modal', modal)

    quotation.set('cost', Number(extracted.cost) || 0)
    quotation.set('transit_time', Number(extracted.transit_time) || 0)

    let etd = extracted.etd
    if (!etd || !/^\d{4}-\d{2}-\d{2}$/.test(etd)) {
      etd = new Date().toISOString().replace('T', ' ')
    } else {
      etd = etd + ' 12:00:00.000Z'
    }
    quotation.set('etd', etd)

    quotation.set('free_time', Number(extracted.free_time) || 0)
    quotation.set('score', 0)
    quotation.set('user_id', e.auth.id)

    $app.save(quotation)

    const extractedCol = $app.findCollectionByNameOrId('extracted_data')
    const extractedRecord = new Record(extractedCol)
    extractedRecord.set('quotation_id', quotation.id)
    extractedRecord.set('raw_data', extracted)

    $app.save(extractedRecord)

    return e.json(200, {
      id: quotation.id,
      data: extracted,
    })
  },
  $apis.requireAuth(),
)
