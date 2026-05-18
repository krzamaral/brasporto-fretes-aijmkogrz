import { Pedido } from '@/services/pedidos'
import { Quotation } from '@/services/quotations'

export function calculateExwDynamic(
  formula: string | undefined,
  taxableWeight: number,
  fallbackValue: number,
  defaultRate: number,
  defaultFixed: number,
  defaultMin: number,
): { total: number; log: string } {
  let rate = defaultRate
  let fixed = defaultFixed
  let min = defaultMin
  let hasMatch = false

  if (!formula && fallbackValue > 0) {
    return { total: fallbackValue, log: `Valor informado: USD ${fallbackValue.toFixed(2)}` }
  }

  if (formula) {
    const upper = formula.toUpperCase()

    const rateMatch = upper.match(/([\d.]+)\s*\/\s*(?:K|KG)/)
    if (rateMatch) {
      rate = parseFloat(rateMatch[1])
      hasMatch = true
    }

    const fixedMatch = upper.match(/\+\s*(?:USD)?\s*([\d.]+)/)
    if (fixedMatch) {
      fixed = parseFloat(fixedMatch[1])
      hasMatch = true
    }

    const minMatch = upper.match(/MIN\s*(?:USD)?\s*([\d.]+)/)
    if (minMatch) {
      min = parseFloat(minMatch[1])
      hasMatch = true
    }

    if (!hasMatch) {
      const flatMatch = upper.match(/(?:USD)?\s*([\d.]+)\s*(?:PER JOB|PER SET|\/JOB|\/SET)/)
      if (flatMatch) {
        const val = parseFloat(flatMatch[1])
        return { total: val, log: `Taxa Fixa por Embarque: USD ${val.toFixed(2)}` }
      }

      const cleanStr = upper.replace(/[^\d.,]/g, '').replace(',', '.')
      const num = parseFloat(cleanStr)
      if (!isNaN(num) && num > 0 && cleanStr.length > 0)
        return { total: Math.max(num, min), log: `Taxa Fixa: USD ${Math.max(num, min).toFixed(2)}` }
    }
  }

  const baseCalculated = taxableWeight * rate + fixed
  const calculated = Math.max(baseCalculated, min)

  if (calculated === min && min > 0) {
    return {
      total: min,
      log: `mínimo USD ${min.toFixed(2)} (cálculo: ${taxableWeight.toFixed(2)}kg * USD ${rate.toFixed(2)} + USD ${fixed.toFixed(2)} = USD ${baseCalculated.toFixed(2)})`,
    }
  } else {
    return {
      total: calculated,
      log: `${taxableWeight.toFixed(2)}kg * USD ${rate.toFixed(2)} + USD ${fixed.toFixed(2)} = USD ${calculated.toFixed(2)}`,
    }
  }
}

export function calculateExw(
  formula: string | undefined,
  taxableWeight: number,
  fallbackValue: number,
): { total: number; log: string } {
  return calculateExwDynamic(formula, taxableWeight, fallbackValue, 0.15, 110.5, 150.5)
}

export function calculateChargeableWeight(pedido: Pedido): number {
  const pesoBruto = pedido.peso_bruto || 0

  if (pedido.modal_desejado === 'Aéreo') {
    let volumeWeight = 0
    if (pedido.comprimento && pedido.largura && pedido.altura) {
      volumeWeight =
        (pedido.comprimento *
          pedido.largura *
          pedido.altura *
          (pedido.quantidade_containers || 1)) /
        6000
    } else {
      const volume = pedido.volume || 0
      volumeWeight = volume / 0.006
    }
    return Math.ceil(Math.max(pesoBruto, volumeWeight))
  }

  const volume = pedido.volume || 0
  if (pedido.comprimento && pedido.largura && pedido.altura) {
    const vol =
      (pedido.comprimento * pedido.largura * pedido.altura * (pedido.quantidade_containers || 1)) /
      1000000
    return Math.max(pesoBruto / 1000, Math.max(volume, vol))
  }

  return Math.max(pesoBruto / 1000, volume)
}

function calculateCompatibility(q: Quotation, pedido: Pedido): number {
  let score = 0

  // Incoterm (0.4 max)
  const providesExw =
    q.cost_breakdown?.formula_origem ||
    q.cost_breakdown?.taxas_origem ||
    q.cost_breakdown?.origin_taxes
  if (pedido.incoterm === 'EXW') {
    score += providesExw ? 0.4 : 0.2
  } else {
    score += 0.4
  }

  // Airport proximity (0.4 max)
  const origin = (pedido.origem || '').toUpperCase()
  const qAeroporto = q.aeroporto_origem || (q.cost_breakdown as any)?.aeroporto || ''
  const qAgentDesc = (
    (q.option_description || '') +
    ' ' +
    (q.agent_name || '') +
    ' ' +
    qAeroporto
  ).toUpperCase()

  let proximityScore = 0.1
  if (origin.includes('DALIAN')) {
    if (qAgentDesc.includes('PEK') || qAgentDesc.includes('DLC') || qAgentDesc.includes('BEIJING'))
      proximityScore = 0.4
  } else if (origin.includes('SHANGHAI')) {
    if (qAgentDesc.includes('PVG') || qAgentDesc.includes('SHA')) proximityScore = 0.4
  } else if (origin.includes('GUANGZHOU')) {
    if (qAgentDesc.includes('CAN') || qAgentDesc.includes('SZX') || qAgentDesc.includes('SHENZHEN'))
      proximityScore = 0.4
  } else if (origin.includes('XIAMEN')) {
    if (qAgentDesc.includes('XMN')) proximityScore = 0.4
  } else if (origin.includes('EZHOU')) {
    if (qAgentDesc.includes('EHU')) proximityScore = 0.4
  } else {
    proximityScore = 0.3
  }
  score += proximityScore

  // Flight frequency (0.2 max)
  let freqScore = 0.1
  if (q.frequencia === 'daily') freqScore = 0.2
  else if (q.frequencia === '3x_semana') freqScore = 0.15
  else if (q.frequencia === '1x_semana') freqScore = 0.1
  else if (q.frequencia === 'sob_consulta') freqScore = 0.05
  score += freqScore

  return Math.min(score, 1)
}

export type EnrichedQuotation = Quotation & {
  qTaxable: number
  computedTotal: number
  exwLog: string
  addTaxesLog: string[]
  freteTotal: number
  appliedTaxasOrigem: number
  pickupFee: number
  additionalTaxes: number
  destinationTaxes: number
  compatScore: number
  calculatedScore: number
  costScore: number
  transitScore: number
  justificativaEngine: string
  isIncompleteData: boolean
  isCheapest: boolean
  isBestBalance: boolean
  subjectToReconfirmation: boolean
}

export function rankQuotations(quotations: Quotation[], pedido: Pedido): EnrichedQuotation[] {
  if (quotations.length === 0) return []

  const chargeableWeight = calculateChargeableWeight(pedido)

  const isLWHMissing = !pedido.comprimento || !pedido.largura || !pedido.altura
  const isWeightMissing = !pedido.peso_bruto

  const enriched = quotations.map((q) => {
    let isIncompleteData = false
    if (!q.taxable_weight) {
      if (pedido.modal_desejado === 'Aéreo') {
        if (isWeightMissing || isLWHMissing) {
          isIncompleteData = true
        }
      } else if (pedido.modal_desejado === 'LCL') {
        if (isWeightMissing || (isLWHMissing && !pedido.volume)) {
          isIncompleteData = true
        }
      }
    }

    const qTaxable =
      pedido.modal_desejado === 'Aéreo'
        ? Math.max(Math.ceil(q.taxable_weight || 0), chargeableWeight)
        : pedido.modal_desejado === 'LCL'
          ? Math.max(q.taxable_weight || 0, chargeableWeight)
          : q.taxable_weight || chargeableWeight

    let freteUnitario = q.cost_breakdown?.frete_unitario ?? q.rate_unitario ?? 0
    if (freteUnitario === 0 && q.cost > 0 && qTaxable > 0 && !q.cost_breakdown?.frete_peso) {
      freteUnitario = q.cost / qTaxable
    }

    let freteTotal =
      q.cost_breakdown?.frete_peso ?? (freteUnitario > 0 ? freteUnitario * qTaxable : q.cost)

    const isEXW = pedido.incoterm === 'EXW'

    let taxasOrigem = q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0
    let exwLog = ''

    if (q.cost_breakdown?.formula_origem || (isEXW && taxasOrigem === 0)) {
      const cb = q.cost_breakdown as any
      const taxaKg = cb?.taxa_kg !== undefined ? Number(cb.taxa_kg) : 0.15
      const taxaFixa = cb?.taxa_fixa !== undefined ? Number(cb.taxa_fixa) : 110.5
      const minimo = cb?.minimo !== undefined ? Number(cb.minimo) : 150.5

      const exwRes = calculateExwDynamic(
        q.cost_breakdown?.formula_origem,
        qTaxable,
        taxasOrigem,
        taxaKg,
        taxaFixa,
        minimo,
      )
      taxasOrigem = exwRes.total
      exwLog = exwRes.log
    } else if (isEXW && taxasOrigem > 0) {
      exwLog = `Valor Fixo/Informado: USD ${taxasOrigem.toFixed(2)}`
    }

    const appliedTaxasOrigem = isEXW ? taxasOrigem : taxasOrigem || 0

    let pickupFee = q.cost_breakdown?.pickup_fee || 0

    let additionalTaxes = 0
    let addTaxesLog: string[] = []
    if (q.cost_breakdown?.taxas_adicionais && Array.isArray(q.cost_breakdown.taxas_adicionais)) {
      q.cost_breakdown.taxas_adicionais.forEach((taxa) => {
        if (taxa.tipo === 'por_embarque') {
          additionalTaxes += taxa.valor
          addTaxesLog.push(
            `${taxa.descricao || 'Taxa'}: USD ${taxa.valor.toFixed(2)} (por embarque)`,
          )
        } else if (taxa.tipo === 'por_kg') {
          let calc = taxa.valor * qTaxable
          if (taxa.minimo && calc < taxa.minimo) {
            calc = taxa.minimo
            addTaxesLog.push(`${taxa.descricao || 'Taxa'}: mínimo USD ${calc.toFixed(2)}`)
          } else {
            addTaxesLog.push(
              `${taxa.descricao || 'Taxa'}: ${qTaxable}kg * USD ${taxa.valor.toFixed(2)} = USD ${calc.toFixed(2)}`,
            )
          }
          additionalTaxes += calc
        }
      })
    }

    const destinationTaxes = q.cost_breakdown?.destination_taxes ?? 0

    let computedTotal =
      freteTotal + appliedTaxasOrigem + pickupFee + additionalTaxes + destinationTaxes

    if (isIncompleteData) {
      computedTotal = 0
    } else if (computedTotal === 0 && q.cost > 0) {
      computedTotal = q.cost
    }

    const compatScore = calculateCompatibility(q, pedido)
    const subjectToReconfirmation =
      /subject to reconfirmation|unstable|subject to change|subject to increase/i.test(
        q.agent_name +
          ' ' +
          (q.option_description || '') +
          ' ' +
          (q.cost_breakdown?.formula_origem || ''),
      )

    return {
      ...q,
      qTaxable,
      computedTotal,
      exwLog,
      addTaxesLog,
      freteTotal,
      freteUnitario,
      appliedTaxasOrigem,
      pickupFee,
      additionalTaxes,
      destinationTaxes,
      compatScore,
      calculatedScore: 0,
      costScore: 0,
      transitScore: 0,
      justificativaEngine: '',
      isEXW,
      isIncompleteData,
      isCheapest: false,
      isBestBalance: false,
      subjectToReconfirmation,
    } as EnrichedQuotation & { freteUnitario: number; isEXW: boolean }
  })

  // Primary Ranking by computedTotal ascending
  enriched.sort((a, b) => {
    if (a.isIncompleteData && !b.isIncompleteData) return 1
    if (!a.isIncompleteData && b.isIncompleteData) return -1
    return a.computedTotal - b.computedTotal
  })

  const validForRanking = enriched.filter((q) => !q.isIncompleteData && q.computedTotal > 0)

  if (validForRanking.length > 0) {
    const cheapest = validForRanking[0]
    cheapest.isCheapest = true

    let bestBalance = cheapest
    for (let i = 1; i < validForRanking.length; i++) {
      const q = validForRanking[i]
      if (q.transit_time && cheapest.transit_time) {
        const timeDiffPct = (cheapest.transit_time - q.transit_time) / cheapest.transit_time
        const costDiffPct = (q.computedTotal - cheapest.computedTotal) / cheapest.computedTotal
        if (timeDiffPct >= 0.2 && costDiffPct <= 0.1) {
          if (bestBalance === cheapest || q.transit_time < bestBalance.transit_time!) {
            bestBalance = q
          }
        }
      }
    }
    bestBalance.isBestBalance = true

    const minCost = cheapest.computedTotal
    const minTransit = Math.min(...validForRanking.map((q) => q.transit_time || 999))

    enriched.forEach((q) => {
      let costScore = 0
      if (!q.isIncompleteData && q.computedTotal > 0) {
        costScore = (minCost / q.computedTotal) * 50
      }

      const transitScore =
        (q.transit_time ?? 0) > 0 ? (minTransit / (q.transit_time as number)) * 30 : 0
      const compatScorePoints = q.compatScore * 20

      const finalScore = q.isIncompleteData ? 0 : costScore + transitScore + compatScorePoints

      let justificativa = ''
      if (q.isIncompleteData) {
        justificativa = `Dados Incompletos: Não foi possível calcular o custo total devido à falta de peso, dimensões ou peso taxável na extração.`
      } else {
        if (q.isBestBalance && q !== cheapest) {
          justificativa = `🏆 Opção Recomendada (Best Balance): Transit time ${(((cheapest.transit_time! - q.transit_time!) / cheapest.transit_time!) * 100).toFixed(0)}% menor com custo apenas ${(((q.computedTotal - cheapest.computedTotal) / cheapest.computedTotal) * 100).toFixed(0)}% maior que a mais barata.\n\n`
        } else if (q.isCheapest) {
          justificativa = `💰 Opção Mais Barata (Menor Custo Total All-In).\n\n`
        }
        justificativa += `Score Operacional: ${finalScore.toFixed(1)}/100 (Custo: ${costScore.toFixed(1)}/50, Transit Time: ${transitScore.toFixed(1)}/30, Compatibilidade: ${compatScorePoints.toFixed(1)}/20).\n`
        justificativa += `Detalhamento de Custos (USD ${q.computedTotal.toFixed(2)}):\n`
        justificativa += `- Frete Base: USD ${q.freteTotal.toFixed(2)} (${q.qTaxable.toFixed(2)} kg * USD ${(q as any).freteUnitario.toFixed(2)})\n`
        if ((q as any).isEXW) {
          justificativa += `- EXW/Origem: USD ${q.appliedTaxasOrigem.toFixed(2)} (${q.exwLog})\n`
        } else if (q.appliedTaxasOrigem > 0) {
          justificativa += `- Taxas Origem: USD ${q.appliedTaxasOrigem.toFixed(2)}\n`
        }
        if (q.pickupFee > 0) {
          justificativa += `- Pickup Fee: USD ${q.pickupFee.toFixed(2)}\n`
        }
        if (q.addTaxesLog.length > 0) {
          justificativa += `- Adicionais: ${q.addTaxesLog.join(', ')}\n`
        }
        if (q.destinationTaxes > 0) {
          justificativa += `- Destino: USD ${q.destinationTaxes.toFixed(2)}\n`
        }
      }

      q.calculatedScore = finalScore
      q.costScore = costScore
      q.transitScore = transitScore
      q.justificativaEngine = justificativa
    })
  }

  return enriched
}
