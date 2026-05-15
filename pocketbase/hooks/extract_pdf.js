routerAdd(
  'POST',
  '/backend/v1/extract-pdf',
  (e) => {
    const body = e.requestInfo().body || {}
    const text = body.text

    if (!text) {
      throw new BadRequestError('Nenhum texto fornecido para extração.')
    }

    const prompt = `
Você é um especialista em logística internacional. Extraia os dados de cotação do texto fornecido.
REGRAS RÍGIDAS DE EXTRAÇÃO DE ALTA FIDELIDADE:
1. NÃO invente ou infira informações. Se "tipo_mercadoria" ou "prazo_desejado_dias" não estiverem CLARAMENTE MENCIONADOS no texto, retorne estritamente null para eles (deixe em branco, sem valores padrão).
2. Identifique o modal corretamente: "Aéreo", "FCL", ou "LCL".
3. Custo Total (cost): Agregue (some) TODAS as taxas, sobretaxas e frete base para formar o Custo Total consolidado da cotação. Para o modal Aéreo, este deve ser obrigatoriamente o valor TOTAL da remessa (soma absoluta de todos os custos), e NÃO o preço unitário por kg.
4. Para modal Aéreo, calcule o Peso Cubado usando a fórmula: (Comprimento * Largura * Altura em cm / 6000) * Quantidade de volumes. O Peso Taxável (taxable_weight) deve ser o maior valor entre o Peso Real da mercadoria e o Peso Cubado calculado. Se não houver dimensões informadas, use apenas o Peso Real.
5. Regras de campos obrigatórios por modal (se a informação não constar no documento, retorne null, o sistema cuidará de avisar o usuário):
   - Aéreo: agent_name, cost, taxable_weight
   - FCL: agent_name, cost, free_time
   - LCL: agent_name, cost

Texto da cotação:
${text}

Retorne APENAS um JSON válido (sem blocos de markdown adicionais) com a seguinte estrutura exata:
{
  "origem": "Origem extraída ou null",
  "destino": "Destino extraído ou null",
  "peso_bruto": 100.5,
  "volume": 0.5,
  "modal_desejado": "Aéreo",
  "tipo_mercadoria": "Descrição exata ou null",
  "prazo_desejado_dias": 20, 
  "quotations": [
    {
      "agent_name": "Nome do Agente",
      "modal": "Aéreo", 
      "cost": 1234.56,
      "taxable_weight": 100.5,
      "free_time": 10,
      "transit_time": 15,
      "etd": "YYYY-MM-DD" 
    }
  ]
}
`

    const apiUrl = 'https://api.openai.com/v1/chat/completions'
    const apiKey = $secrets.get('OPENAI_API_KEY')

    if (!apiKey) {
      throw new UnauthorizedError('A chave OPENAI_API_KEY não está configurada nos secrets.')
    }

    const aiBody = {
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }

    const res = $http.send({
      url: apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify(aiBody),
      timeout: 60,
    })

    if (res.statusCode !== 200) {
      $app.logger().error('OpenAI Error', 'status', res.statusCode, 'body', res.json)
      throw new BadRequestError('Falha ao comunicar com IA de Extração: ' + res.statusCode)
    }

    try {
      const data = JSON.parse(res.json.choices[0].message.content)
      return e.json(200, data)
    } catch (err) {
      $app.logger().error('Parse Error', 'msg', err.message)
      throw new BadRequestError('Falha ao processar a resposta gerada pela IA.')
    }
  },
  $apis.requireAuth(),
)
