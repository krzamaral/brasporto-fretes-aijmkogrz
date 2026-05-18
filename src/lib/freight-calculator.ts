import { Pedido } from '@/services/pedidos'
import { Quotation } from '@/services/quotations'

export function calculateExw(
  formula: string | undefined,
  taxableWeight: number,
  fallbackValue: number,
): { total: number; log: string } {
  if (!formula)
    return {
      total: fallbackValue,
      log: fallbackValue > 0 ? `Taxa Fixa: USD ${fallbackValue.toFixed(2)}` : '',
    }
  const upper = formula.toUpperCase()

  let rate = 0
  let fixed = 0
  let min = 0
  let hasMatch = false

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

    return {
      total: Math.max(fallbackValue, min),
      log: fallbackValue > 0 ? `Taxa Fixa: USD ${Math.max(fallbackValue, min).toFixed(2)}` : '',
    }
  }

  const calculated = Math.max(taxableWeight * rate + fixed, min)

  if (calculated === min && min > 0) {
    return {
      total: min,
      log: `EXW charge: mínimo USD ${min.toFixed(2)} (cálculo: ${taxableWeight.toFixed(2)} * ${rate.toFixed(2)} + ${fixed.toFixed(2)} = ${(taxableWeight * rate + fixed).toFixed(2)})`,
    }
  } else {
    return {
      total: calculated,
      log: `EXW charge: USD ${taxableWeight.toFixed(2)} * ${rate.toFixed(2)} + ${fixed.toFixed(2)} = ${calculated.toFixed(2)}`,
    }
  }
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
      volumeWeight = volume * 166.667
    }
    return Math.max(pesoBruto, volumeWeight)
  }

  const volume = pedido.volume || 0
  if (pedido.comprimento && pedido.largura && pedido.altura) {
    const vol =
      (pedido.comprimento * pedido.largura * pedido.altura * (pedido.quantidade_containers || 1)) /
      1000000
    return Math.max(pesoBruto / 1000, vol)
  }

  return Math.max(pesoBruto / 1000, volume)
}

function calculateCompatibility(q: Quotation, pedido: Pedido): number {
  let score = 0

  const providesExw =
    q.cost_breakdown?.formula_origem ||
    q.cost_breakdown?.taxas_origem ||
    q.cost_breakdown?.origin_taxes
  if (pedido.incoterm === 'EXW') {
    score += providesExw ? 0.4 : 0.0
  } else {
    score += 0.4
  }

  const origin = (pedido.origem || '').toUpperCase()
  const qAgentDesc = (
    (q.option_description || '') +
    ' ' +
    (q.agent_name || '') +
    ' ' +
    (q.aeroporto_origem || '')
  ).toUpperCase()

  let proximityScore = 0.2
  if (origin.includes('DALIAN')) {
    if (qAgentDesc.includes('PEK') || qAgentDesc.includes('DLC') || qAgentDesc.includes('BEIJING'))
      proximityScore = 0.6
  } else if (origin.includes('SHANGHAI')) {
    if (qAgentDesc.includes('PVG') || qAgentDesc.includes('SHA')) proximityScore = 0.6
  } else if (origin.includes('GUANGZHOU')) {
    if (qAgentDesc.includes('CAN') || qAgentDesc.includes('SZX') || qAgentDesc.includes('SHENZHEN'))
      proximityScore = 0.6
  } else if (origin.includes('XIAMEN')) {
    if (qAgentDesc.includes('XMN')) proximityScore = 0.6
  } else if (origin.includes('EZHOU')) {
    if (qAgentDesc.includes('EHU')) proximityScore = 0.6
  } else {
    proximityScore = 0.4
  }
  score += proximityScore

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
}

export function rankQuotations(quotations: Quotation[], pedido: Pedido): EnrichedQuotation[] {
  if (quotations.length === 0) return []

  const chargeableWeight = calculateChargeableWeight(pedido)

  const enriched = quotations.map((q) => {
    const qTaxable =
      pedido.modal_desejado === 'Aéreo'
        ? Math.ceil(q.taxable_weight || chargeableWeight)
        : q.taxable_weight || chargeableWeight

    let freteUnitario = q.cost_breakdown?.frete_unitario || 0
    let freteTotal =
      q.cost_breakdown?.frete_peso || (freteUnitario > 0 ? freteUnitario * qTaxable : 0)

    let taxasOrigem = q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0
    let exwLog = ''
    if (q.cost_breakdown?.formula_origem) {
      const exwRes = calculateExw(q.cost_breakdown.formula_origem, qTaxable, taxasOrigem)
      taxasOrigem = exwRes.total
      exwLog = exwRes.log
    }

    const isEXW = pedido.incoterm === 'EXW'
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

    const destinationTaxes = q.cost_breakdown?.destination_taxes || 0

    const computedTotal =
      freteTotal + appliedTaxasOrigem + pickupFee + additionalTaxes + destinationTaxes
    const finalTotal = computedTotal > 0 ? computedTotal : q.cost

    const compatScore = calculateCompatibility(q, pedido)

    return {
      ...q,
      qTaxable,
      computedTotal: finalTotal,
      exwLog,
      addTaxesLog,
      freteTotal,
      appliedTaxasOrigem,
      pickupFee,
      additionalTaxes,
      destinationTaxes,
      compatScore,
      calculatedScore: 0,
      costScore: 0,
      transitScore: 0,
    }
  })

  const validForMinCost = enriched.filter((q) => q.computedTotal > 0)
  const minCost =
    validForMinCost.length > 0 ? Math.min(...validForMinCost.map((q) => q.computedTotal)) : 1

  const validForMinTransit = enriched.filter((q) => (q.transit_time ?? 0) > 0)
  const minTransit =
    validForMinTransit.length > 0
      ? Math.min(...validForMinTransit.map((q) => q.transit_time as number))
      : 1

  return enriched
    .map((q) => {
      const costScore = q.computedTotal > 0 ? (minCost / q.computedTotal) * 50 : 0
      const transitScore =
        (q.transit_time ?? 0) > 0 ? (minTransit / (q.transit_time as number)) * 30 : 0
      const compatScorePoints = q.compatScore * 20
      const finalScore = costScore + transitScore + compatScorePoints

      return {
        ...q,
        calculatedScore: finalScore,
        costScore,
        transitScore,
      }
    })
    .sort((a, b) => b.calculatedScore - a.calculatedScore)
}
