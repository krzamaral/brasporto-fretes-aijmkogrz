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

  let calcVolumeM3 = 0
  if (pedido.itens && pedido.itens.length > 0) {
    calcVolumeM3 = pedido.itens.reduce((acc, item) => {
      return acc + (item.comprimento * item.largura * item.altura * item.quantidade) / 1000000
    }, 0)
  } else if (pedido.comprimento && pedido.largura && pedido.altura) {
    calcVolumeM3 =
      (pedido.comprimento * pedido.largura * pedido.altura * (pedido.quantidade_containers || 1)) /
      1000000
  }

  if (pedido.modal_desejado === 'Aéreo') {
    let volumeWeight = 0
    if (calcVolumeM3 > 0) {
      // 1 m3 = 166.667 kg in air freight (which is equivalent to / 6000 for cm3)
      volumeWeight = calcVolumeM3 * 166.666666667
    } else {
      const volume = pedido.volume || 0
      volumeWeight = volume / 0.006
    }
    return Math.ceil(Math.max(pesoBruto, volumeWeight))
  }

  let volume = pedido.volume || 0
  if (calcVolumeM3 > volume) volume = calcVolumeM3

  const baseWeight = Math.max(pesoBruto / 1000, volume)

  if (pedido.modal_desejado === 'LCL') {
    return Math.max(4, Math.ceil(baseWeight))
  }

  return baseWeight
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
  dataConfidence?: 'high' | 'medium' | 'low'
  missingDestination?: boolean
  sectionsCount?: number
  surchargesCount?: number
}

export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1 / 0.92,
  BRL: 1 / 5.1,
  R$: 1 / 5.1,
  GBP: 1 / 0.78,
}

export function toUSD(amount: number, currency: string = 'USD'): number {
  const curr = currency.toUpperCase().trim()
  const rate = FX_TO_USD[curr] || 1
  return amount * rate
}

function sumSurchargesBySection(surcharges: any[], section: string): number {
  if (!surcharges || !Array.isArray(surcharges)) return 0
  return surcharges
    .filter((s: any) => (s.section || '').toLowerCase() === section)
    .reduce((acc: number, s: any) => {
      const val = Number(s.amount) || 0
      return acc + toUSD(val, s.currency || 'USD')
    }, 0)
}

export function rankMaritimo(quotations: Quotation[], pedido: Pedido): EnrichedQuotation[] {
  if (quotations.length === 0) return []

  const enriched = quotations.map((q) => {
    let isIncompleteData = false
    const cb = (q.cost_breakdown as any) || {}
    const totalsInformed = Array.isArray(cb.totals_informed) ? cb.totals_informed : []
    const surcharges = Array.isArray(cb.surcharges) ? cb.surcharges : []

    const allTotalInfo = totalsInformed.find((t: any) => (t.section || '').toLowerCase() === 'all')

    let computedTotal = 0
    let appliedTaxasOrigem = 0
    let freteTotal = 0
    let destinationTaxes = 0

    const sumOrigin = sumSurchargesBySection(surcharges, 'origin')
    const sumFreight = sumSurchargesBySection(surcharges, 'freight')
    const sumDestination = sumSurchargesBySection(surcharges, 'destination')

    const originInfo = totalsInformed.find((t: any) => (t.section || '').toLowerCase() === 'origin')
    const freightInfo = totalsInformed.find(
      (t: any) => (t.section || '').toLowerCase() === 'freight',
    )
    const destInfo = totalsInformed.find(
      (t: any) => (t.section || '').toLowerCase() === 'destination',
    )

    appliedTaxasOrigem =
      sumOrigin > 0
        ? sumOrigin
        : originInfo?.amount
          ? toUSD(originInfo.amount, originInfo.currency || 'USD')
          : 0
    freteTotal =
      sumFreight > 0
        ? sumFreight
        : freightInfo?.amount
          ? toUSD(freightInfo.amount, freightInfo.currency || 'USD')
          : 0
    destinationTaxes =
      sumDestination > 0
        ? sumDestination
        : destInfo?.amount
          ? toUSD(destInfo.amount, destInfo.currency || 'USD')
          : 0

    computedTotal = appliedTaxasOrigem + freteTotal + destinationTaxes

    if (computedTotal === 0 && allTotalInfo && allTotalInfo.amount) {
      computedTotal = toUSD(allTotalInfo.amount, allTotalInfo.currency || 'USD')
      appliedTaxasOrigem = 0
      freteTotal = 0
      destinationTaxes = 0
    }

    if (computedTotal === 0 && surcharges.length === 0 && totalsInformed.length === 0) {
      isIncompleteData = true
    }

    const presentSections = new Set(surcharges.map((s: any) => (s.section || '').toLowerCase()))
    const hasOrigin = presentSections.has('origin')
    const hasFreight = presentSections.has('freight')
    const hasDestination = presentSections.has('destination')
    const sectionsCount = [hasOrigin, hasFreight, hasDestination].filter(Boolean).length

    let dataConfidence: 'high' | 'medium' | 'low' = 'low'
    if (sectionsCount === 3 && surcharges.length >= 5) {
      dataConfidence = 'high'
    } else if (sectionsCount >= 2 && hasDestination) {
      dataConfidence = 'medium'
    } else {
      dataConfidence = 'low'
    }

    const compatScore = q.modal === pedido.modal_desejado ? 1 : 0.5

    const addTaxesLog = surcharges.map((s: any) => {
      const amt = Number(s.amount) || 0
      return `${s.description || 'Taxa'} (${s.section || 'n/a'}): ${s.currency || 'USD'} ${amt.toFixed(2)}`
    })

    const subjectToReconfirmation =
      /subject to reconfirmation|unstable|subject to change|subject to increase/i.test(
        q.agent_name + ' ' + (q.option_description || ''),
      )

    return {
      ...q,
      qTaxable: q.taxable_weight || 0,
      computedTotal,
      exwLog: '',
      addTaxesLog,
      freteTotal,
      freteUnitario: 0,
      appliedTaxasOrigem,
      pickupFee: 0,
      additionalTaxes: 0,
      destinationTaxes,
      compatScore,
      calculatedScore: 0,
      costScore: 0,
      transitScore: 0,
      justificativaEngine: '',
      isEXW: pedido.incoterm === 'EXW',
      isIncompleteData,
      isCheapest: false,
      isBestBalance: false,
      subjectToReconfirmation,
      dataConfidence,
      missingDestination: !hasDestination,
      sectionsCount,
      surchargesCount: surcharges.length,
    } as EnrichedQuotation & { freteUnitario: number; isEXW: boolean }
  })

  enriched.sort((a, b) => {
    if (a.isIncompleteData && !b.isIncompleteData) return 1
    if (!a.isIncompleteData && b.isIncompleteData) return -1
    return a.computedTotal - b.computedTotal
  })

  const validForRanking = enriched.filter((q) => !q.isIncompleteData && q.computedTotal > 0)

  if (validForRanking.length > 0) {
    if (validForRanking.length >= 2) {
      const cheapestValid = validForRanking[0]
      const secondCheapest = validForRanking[1]
      if (cheapestValid.computedTotal < secondCheapest.computedTotal * 0.5) {
        cheapestValid.dataConfidence = 'low'
      }
    }

    let cheapest = validForRanking[0]

    if (cheapest.dataConfidence === 'low') {
      const reliableOptions = validForRanking.filter(
        (q) => q.dataConfidence !== 'low' && q.computedTotal <= cheapest.computedTotal * 1.5,
      )
      if (reliableOptions.length > 0) {
        cheapest = reliableOptions[0]
      }
    }

    cheapest.isCheapest = true

    let bestBalance = cheapest
    for (let i = 0; i < validForRanking.length; i++) {
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

    const minCost = Math.min(...validForRanking.map((q) => q.computedTotal))
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
        justificativa = `Dados Incompletos: Não foi possível calcular o custo total devido à falta de informações de taxas na extração.`
      } else {
        if (q.isBestBalance && q !== cheapest) {
          justificativa = `🏆 Opção Recomendada (Best Balance): Transit time ${(((cheapest.transit_time! - q.transit_time!) / cheapest.transit_time!) * 100).toFixed(0)}% menor com custo apenas ${(((q.computedTotal - cheapest.computedTotal) / cheapest.computedTotal) * 100).toFixed(0)}% maior que a mais barata.`
        } else if (q.isCheapest) {
          justificativa = `💰 Opção Mais Barata (Menor Custo Total All-In).`
        }

        if (q.dataConfidence === 'low') {
          let warning = ''
          if (q.missingDestination) {
            warning = `⚠️ Cotação incompleta: sem taxas de destino (THC/capatazias/desconsol). Total provavelmente subestimado. Confirme com o agente antes de decidir.`
          } else {
            warning = `⚠️ Cotação com poucos detalhes extraídos (${q.surchargesCount} surcharges em ${q.sectionsCount} seções). Total pode estar incompleto. Confirme com o agente.`
          }
          justificativa = justificativa ? `${warning} ${justificativa}` : warning
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

export function rankQuotations(quotations: Quotation[], pedido: Pedido): EnrichedQuotation[] {
  if (quotations.length === 0) return []

  const chargeableWeight = calculateChargeableWeight(pedido)

  const hasItens = pedido.itens && pedido.itens.length > 0
  const isLWHMissing = !hasItens && (!pedido.comprimento || !pedido.largura || !pedido.altura)
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
          ? Math.max(
              q.taxable_weight ? Math.max(4, Math.ceil(q.taxable_weight)) : 0,
              chargeableWeight,
            )
          : q.taxable_weight || chargeableWeight

    let freteUnitario = q.cost_breakdown?.frete_unitario ?? q.rate_unitario ?? 0

    let freteTotal = q.cost_breakdown?.frete_peso ?? freteUnitario * qTaxable

    if (freteTotal === 0 || isNaN(freteTotal)) {
      isIncompleteData = true
      freteTotal = 0
    }

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

    if (
      !pickupFee &&
      q.cost_breakdown?.pickup_options &&
      Array.isArray(q.cost_breakdown.pickup_options) &&
      q.cost_breakdown?.pol
    ) {
      const iataToCity: Record<string, string> = {
        PEK: 'PEKING',
        PVG: 'SHANGHAI',
        SHA: 'SHANGHAI',
        CAN: 'GUANGZHOU',
        SZX: 'SHENZHEN',
        EHU: 'EZHOU',
        XMN: 'XIAMEN',
        CTU: 'CHENGDU',
        HGH: 'HANGZHOU',
        NKG: 'NANJING',
        TAO: 'QINGDAO',
        DLC: 'DALIAN',
      }

      const pol = String(q.cost_breakdown.pol).toUpperCase().trim()
      const mappedCity = iataToCity[pol] || pol

      const matchedOption = q.cost_breakdown.pickup_options.find((opt: any) => {
        const local = opt.local ? String(opt.local).toUpperCase().trim() : ''
        return local === mappedCity
      })

      if (matchedOption && matchedOption.valor !== undefined && matchedOption.valor !== null) {
        pickupFee = Number(matchedOption.valor)
      }
    }

    let additionalTaxes = 0
    let addTaxesLog: string[] = []
    if (q.cost_breakdown?.taxas_adicionais && Array.isArray(q.cost_breakdown.taxas_adicionais)) {
      q.cost_breakdown.taxas_adicionais.forEach((taxa) => {
        if (taxa.condicional) return
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
        justificativa = `Dados Incompletos: Não foi possível calcular o custo total devido à falta de tarifas, peso ou dimensões na extração.`
      } else {
        if (q.isBestBalance && q !== cheapest) {
          justificativa = `🏆 Opção Recomendada (Best Balance): Transit time ${(((cheapest.transit_time! - q.transit_time!) / cheapest.transit_time!) * 100).toFixed(0)}% menor com custo apenas ${(((q.computedTotal - cheapest.computedTotal) / cheapest.computedTotal) * 100).toFixed(0)}% maior que a mais barata.`
        } else if (q.isCheapest) {
          justificativa = `💰 Opção Mais Barata (Menor Custo Total All-In).`
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
