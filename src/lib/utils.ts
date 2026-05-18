/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses and evaluates an EXW formula like "0.15/K + 110.5, MIN 150.5" or "130 per job".
 */
export function calculateExw(
  formula: string | undefined,
  taxableWeight: number,
  fallbackValue: number,
): number {
  if (!formula) return fallbackValue
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
    // Try catching flat fees e.g. "130 per job" or "USD 130 per job"
    const flatMatch = upper.match(/(?:USD)?\s*([\d.]+)\s*(?:PER JOB|PER SET|\/JOB|\/SET)/)
    if (flatMatch) return parseFloat(flatMatch[1])

    // Just a straight number like "130"
    const cleanStr = upper.replace(/[^\d.,]/g, '').replace(',', '.')
    const num = parseFloat(cleanStr)
    if (!isNaN(num) && num > 0 && cleanStr.length > 0) return num

    return fallbackValue
  }

  return Math.max(rate * taxableWeight + fixed, min)
}
