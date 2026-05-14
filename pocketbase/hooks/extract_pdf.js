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

    const apiKey = $secrets.get('OPENAI_API_KEY') || ''
    if (!apiKey) {
      throw new UnauthorizedError('OPENAI_API_KEY secret is not configured.')
    }

    function sleep(ms) {
      const wake = Date.now() + ms
      while (Date.now() < wake) {}
    }

    // 1. Decode base64 to binary
    let b64Data = base64Data.replace(/[^A-Za-z0-9\+\/]/g, '')
    let len = b64Data.length
    let fileBytes = new Uint8Array((len * 3) / 4)
    let b64tab = {}
    let b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for (let i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i
    let j = 0
    for (let i = 0; i < len; i += 4) {
      let a = b64tab[b64Data.charAt(i)]
      let b = b64tab[b64Data.charAt(i + 1)]
      let c = b64tab[b64Data.charAt(i + 2)]
      let d = b64tab[b64Data.charAt(i + 3)]
      fileBytes[j++] = (a << 2) | (b >> 4)
      if (c !== undefined) fileBytes[j++] = ((b & 15) << 4) | (c >> 2)
      if (d !== undefined) fileBytes[j++] = ((c & 3) << 6) | (d & 63)
    }
    let finalFileBytes = fileBytes.subarray(0, j)

    // Encode string to UTF-8
    function encodeUTF8(str) {
      let out = [],
        p = 0
      for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i)
        if (c < 128) out[p++] = c
        else if (c < 2048) {
          out[p++] = (c >> 6) | 192
          out[p++] = (c & 63) | 128
        } else {
          out[p++] = (c >> 12) | 224
          out[p++] = ((c >> 6) & 63) | 128
          out[p++] = (c & 63) | 128
        }
      }
      return new Uint8Array(out)
    }

    const boundary = '----WebKitFormBoundary' + $security.randomString(16)
    const pre = encodeUTF8(
      '--' +
        boundary +
        '\r\n' +
        'Content-Disposition: form-data; name="purpose"\r\n\r\n' +
        'assistants\r\n' +
        '--' +
        boundary +
        '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="document.pdf"\r\n' +
        'Content-Type: application/pdf\r\n\r\n',
    )
    const post = encodeUTF8('\r\n--' + boundary + '--\r\n')

    const multipartBody = new Uint8Array(pre.length + finalFileBytes.length + post.length)
    multipartBody.set(pre, 0)
    multipartBody.set(finalFileBytes, pre.length)
    multipartBody.set(post, pre.length + finalFileBytes.length)

    const openaiHeaders = {
      Authorization: 'Bearer ' + apiKey,
      'OpenAI-Beta': 'assistants=v2',
    }

    // 2. Upload file to OpenAI
    const uploadRes = $http.send({
      url: 'https://api.openai.com/v1/files',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
      },
      body: multipartBody,
      timeout: 120,
    })

    if (uploadRes.statusCode !== 200) {
      $app
        .logger()
        .error(
          'OpenAI file upload failed',
          'status',
          uploadRes.statusCode,
          'body',
          uploadRes.json || uploadRes.body,
        )
      throw new BadRequestError('Falha ao fazer upload do documento para a IA.')
    }
    const fileId = uploadRes.json.id

    // 3. Create Assistant
    const asstRes = $http.send({
      url: 'https://api.openai.com/v1/assistants',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...openaiHeaders },
      body: JSON.stringify({
        name: 'PDF Extractor',
        model: 'gpt-4o',
        tools: [{ type: 'file_search' }],
        response_format: { type: 'json_object' },
      }),
    })

    if (asstRes.statusCode !== 200) {
      $app.logger().error('Assistant creation failed', 'status', asstRes.statusCode)
      throw new InternalServerError('Falha ao criar o assistente de IA.')
    }
    const assistantId = asstRes.json.id

    let sysPrompt = ''
    if (docType === 'pedido') {
      sysPrompt =
        'Extraia os dados do pedido (load request) do documento anexado utilizando a ferramenta file_search. Retorne APENAS um objeto JSON válido no seguinte formato exato (sem blocos de código ou markdown):\n{\n  "origem": "string",\n  "destino": "string",\n  "peso_bruto": 0.0,\n  "volume": 0.0,\n  "tipo_mercadoria": "string",\n  "modal_desejado": "Aéreo",\n  "prazo_desejado_dias": 0\n}\nO campo modal_desejado deve ser estritamente "Aéreo", "FCL", ou "LCL". Se não souber o modal, assuma "Aéreo".'
    } else if (docType === 'cota1') {
      sysPrompt =
        'Extraia MÚLTIPLAS opções de frete (cotações) do documento anexado utilizando a ferramenta file_search. Retorne APENAS um objeto JSON válido no seguinte formato exato:\n{\n  "type": "multiple",\n  "quotations": [\n    {\n      "agent_name": "string",\n      "modal": "Aéreo",\n      "cost": 0.0,\n      "transit_time": 0,\n      "etd": "YYYY-MM-DD",\n      "free_time": 0,\n      "taxable_weight": 0\n    }\n  ]\n}\nO campo modal deve ser estritamente "Aéreo", "FCL", ou "LCL". Se não souber, assuma "Aéreo".'
    } else {
      sysPrompt =
        'Extraia UMA opção de frete (cotação) do documento anexado utilizando a ferramenta file_search. Retorne APENAS um objeto JSON válido no seguinte formato exato:\n{\n  "type": "single",\n  "data": {\n    "agent_name": "string",\n    "modal": "Aéreo",\n    "cost": 0.0,\n    "transit_time": 0,\n    "etd": "YYYY-MM-DD",\n    "free_time": 0,\n    "taxable_weight": 0\n  }\n}\nO campo modal deve ser estritamente "Aéreo", "FCL", ou "LCL". Se não souber, assuma "Aéreo".'
    }

    // 4. Create Thread and Run
    const runRes = $http.send({
      url: 'https://api.openai.com/v1/threads/runs',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...openaiHeaders },
      body: JSON.stringify({
        assistant_id: assistantId,
        thread: {
          messages: [
            {
              role: 'user',
              content: sysPrompt,
              attachments: [{ file_id: fileId, tools: [{ type: 'file_search' }] }],
            },
          ],
        },
      }),
    })

    if (runRes.statusCode !== 200) {
      $app.logger().error('Run creation failed', 'status', runRes.statusCode)
      throw new InternalServerError('Falha ao iniciar o processamento de IA.')
    }

    const runId = runRes.json.id
    const threadId = runRes.json.thread_id

    // 5. Poll for completion
    let completed = false
    let attempts = 0
    while (!completed && attempts < 30) {
      sleep(2000)
      const checkRes = $http.send({
        url: `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
        method: 'GET',
        headers: openaiHeaders,
      })
      if (checkRes.statusCode === 200) {
        const status = checkRes.json.status
        if (status === 'completed') {
          completed = true
        } else if (
          status === 'failed' ||
          status === 'cancelled' ||
          status === 'expired' ||
          status === 'incomplete'
        ) {
          $app
            .logger()
            .error('Run failed', 'status', status, 'last_error', checkRes.json.last_error)
          throw new BadRequestError('Could not process document structure')
        }
      }
      attempts++
    }

    if (!completed) {
      throw new InternalServerError('Tempo limite esgotado para o processamento da IA.')
    }

    // 6. Get response messages
    const msgRes = $http.send({
      url: `https://api.openai.com/v1/threads/${threadId}/messages`,
      method: 'GET',
      headers: openaiHeaders,
    })

    if (msgRes.statusCode !== 200) {
      throw new InternalServerError('Falha ao buscar a resposta da IA.')
    }

    const messages = msgRes.json.data
    const lastMessage = messages.find((m) => m.role === 'assistant')
    if (!lastMessage || !lastMessage.content || lastMessage.content.length === 0) {
      throw new BadRequestError('Nenhuma resposta foi retornada pela IA.')
    }

    let content = lastMessage.content[0].text.value || '{}'

    // 7. Cleanup OpenAI resources (fire and forget)
    try {
      $http.send({
        url: `https://api.openai.com/v1/assistants/${assistantId}`,
        method: 'DELETE',
        headers: openaiHeaders,
      })
      $http.send({
        url: `https://api.openai.com/v1/threads/${threadId}`,
        method: 'DELETE',
        headers: openaiHeaders,
      })
      $http.send({
        url: `https://api.openai.com/v1/files/${fileId}`,
        method: 'DELETE',
        headers: openaiHeaders,
      })
    } catch (err) {
      $app.logger().error('Failed to cleanup OpenAI resources', 'err', err)
    }

    let extracted = {}
    try {
      content = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
      extracted = JSON.parse(content)
    } catch (err) {
      $app.logger().error('AI parse failed', 'content', content)
      throw new BadRequestError('Could not process document structure')
    }

    return e.json(200, { data: extracted })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(10 * 1024 * 1024),
)
