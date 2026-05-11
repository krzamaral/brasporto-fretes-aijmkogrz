routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    const body = e.requestInfo().body || {}
    const base64Data = body.pdfBase64
    if (!base64Data) {
      return e.badRequestError('Arquivo PDF ausente na requisição.')
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

      if (res.statusCode === 400) {
        return e.badRequestError('O PDF enviado é inválido, ilegível ou está corrompido.')
      } else if (res.statusCode === 413) {
        return e.badRequestError('O PDF excede o limite de tamanho permitido pela IA.')
      }
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
      return e.badRequestError(
        'Não foi possível interpretar os dados do PDF. Verifique se o formato está legível.',
      )
    }

    const quotationsCol = $app.findCollectionByNameOrId('quotations')
    const quotation = new Record(quotationsCol)

    if (extracted.agent_name) {
      quotation.set('agent_name', extracted.agent_name)
    }

    const validModals = ['Aéreo', 'FCL', 'LCL']
    if (extracted.modal && validModals.includes(extracted.modal)) {
      quotation.set('modal', extracted.modal)
    } else if (extracted.modal) {
      quotation.set('modal', extracted.modal)
    }

    if (extracted.cost !== undefined && extracted.cost !== null) {
      const costNum = Number(extracted.cost)
      if (!Number.isNaN(costNum)) {
        quotation.set('cost', costNum)
      }
    }

    if (extracted.transit_time !== undefined && extracted.transit_time !== null) {
      quotation.set('transit_time', Number(extracted.transit_time))
    }

    if (extracted.taxable_weight !== undefined && extracted.taxable_weight !== null) {
      quotation.set('taxable_weight', Number(extracted.taxable_weight))
    }

    if (extracted.etd) {
      let etd = extracted.etd
      if (!/^\d{4}-\d{2}-\d{2}$/.test(etd)) {
        // Ignorar formato incorreto para deixar o validador atuar ou simplesmente não setar
      } else {
        etd = etd + ' 12:00:00.000Z'
        quotation.set('etd', etd)
      }
    }

    if (extracted.free_time !== undefined && extracted.free_time !== null) {
      quotation.set('free_time', Number(extracted.free_time))
    }

    quotation.set('score', 0)
    quotation.set('user_id', e.auth.id)

    // O PocketBase validará o Record durante o save. Caso existam campos obrigatórios
    // ausentes (ex: cost, agent_name, modal), ele automaticamente lançará
    // um erro que será devolvido como 400 Bad Request contendo os dados do field.
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
  $apis.bodyLimit(10 * 1024 * 1024),
)
