import { Injectable } from '@angular/core'

export type ParsedTicket = {
  airline: string
  flightNumber: string
  arrivalDate: string
  arrivalTime: string
  confidence: number
  rawTextSnippet: string
}

type PdfJsModule = any

@Injectable({ providedIn: 'root' })
export class TicketParserService {
  private pdfWorkerReady = false
  private pdfJsPromise: Promise<PdfJsModule> | null = null

  private tesseractCreateWorkerPromise: Promise<any> | null = null

  private async loadPdfJs(): Promise<PdfJsModule> {
    if (!this.pdfJsPromise) {
      this.pdfJsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
    }
    return this.pdfJsPromise
  }

  private async ensurePdfWorkerConfigured(pdfjsLib: any): Promise<void> {
    if (this.pdfWorkerReady) return

    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs'
    this.pdfWorkerReady = true
  }

  private async loadTesseractCreateWorker(): Promise<any> {
    if (!this.tesseractCreateWorkerPromise) {
      this.tesseractCreateWorkerPromise = import('tesseract.js').then((mod: any) => {
        return mod?.createWorker ?? mod?.default?.createWorker
      })
    }

    const createWorker = await this.tesseractCreateWorkerPromise
    if (!createWorker) {
      throw new Error('Failed to load OCR engine. Please try again.')
    }

    return createWorker
  }

  async parseTicketFile(file: File): Promise<ParsedTicket> {
    const isPdf = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')

    if (!isPdf && !isImage) {
      throw new Error('Unsupported file type. Please upload a PDF or image.')
    }

    let extractedText = ''

    if (isPdf) extractedText = await this.extractTextFromPdf(file)
    else extractedText = await this.extractTextFromImage(file)

    const parsed = this.parseFieldsFromText(extractedText)

    return {
      ...parsed,
      rawTextSnippet: extractedText.replace(/\s+/g, ' ').trim().slice(0, 300),
    }
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    const pdfjsLib = await this.loadPdfJs()
    await this.ensurePdfWorkerConfigured(pdfjsLib)

    const buffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: buffer })
    const pdf = await loadingTask.promise

    let fullText = ''

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => (item?.str ? String(item.str) : ''))
        .join(' ')
      fullText += ` ${pageText}`
    }

    return fullText.trim()
  }

  private async extractTextFromImage(file: File): Promise<string> {
    const createWorker = await this.loadTesseractCreateWorker()
    const worker: any = await createWorker('eng')

    try {
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:-/ .',
        preserve_interword_spaces: '1',
      })

      const { data } = await worker.recognize(file)
      return String(data?.text ?? '').trim()
    } finally {
      await worker.terminate()
    }
  }

  private parseFieldsFromText(rawText: string): Omit<ParsedTicket, 'rawTextSnippet'> {
    const text = rawText.replace(/\s+/g, ' ').trim()

    // helpers
    const monthMap: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
    }

    const pad2 = (n: number) => String(n).padStart(2, '0')

    const toIsoDateFromDayMonth = (day: number, month: number): string => {
      const now = new Date()
      let year = now.getFullYear()
      const candidate = new Date(year, month - 1, day, 0, 0, 0, 0)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      if (candidate < thirtyDaysAgo) year += 1

      return `${year}-${pad2(month)}-${pad2(day)}`
    }

    const normalizeTimeTo24 = (value: string): string => {
      const v = value.trim()

      const m24 = v.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
      if (m24) return `${m24[1]}:${m24[2]}`
      const m12 = v.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i)
      if (!m12) return v

      let hh = Number(m12[1])
      const mm = Number(m12[2])
      const ampm = m12[3].toUpperCase()

      if (ampm === 'PM' && hh !== 12) hh += 12
      if (ampm === 'AM' && hh === 12) hh = 0

      return `${pad2(hh)}:${pad2(mm)}`
    }

    // 1) Airline
    // Small list of common airlines. Beta version.
    const airlineMatch =
      text.match(/\bIndiGo\b/i) ??
      text.match(/\b(Air\s*India|Vistara|SpiceJet|Akasa|Emirates|Qatar|Etihad|Lufthansa|Singapore Airlines)\b/i) ??
      text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+Airlines)\b/) ??
      text.match(/\b(Delta|United|American Airlines|Southwest|JetBlue|Alaska Airlines)\b/i)

    const airline = airlineMatch ? airlineMatch[0].trim() : ''

    // 2) Airport+Time pairs (to pick ARRIVAL)
    const airportTimePairs: Array<{ code: string; time: string; index: number }> = []

    const codeThenTime = /\b([A-Z]{3})\s+([0-2]?\d:\d{2})\s*(?:HRS|hrs)?\b/g
    for (;;) {
      const m = codeThenTime.exec(text)
      if (!m) break
      airportTimePairs.push({ code: m[1], time: normalizeTimeTo24(m[2]), index: m.index })
    }

    const timeThenCode = /\b([0-2]?\d:\d{2})\s*(?:HRS|hrs)?\s+([A-Z]{3})\b/g
    for (;;) {
      const m = timeThenCode.exec(text)
      if (!m) break
      airportTimePairs.push({ code: m[2], time: normalizeTimeTo24(m[1]), index: m.index })
    }

    const allAirportCodes = Array.from(new Set(airportTimePairs.map(p => p.code)))
    const destinationCode = allAirportCodes.length > 0 ? allAirportCodes[allAirportCodes.length - 1] : ''

    let arrivalTime = ''
    if (destinationCode) {
      const destMatches = airportTimePairs.filter(p => p.code === destinationCode)
      if (destMatches.length > 0) {
        arrivalTime = destMatches[destMatches.length - 1].time
      }
    }

    if (!arrivalTime && airportTimePairs.length > 0) {
      arrivalTime = airportTimePairs.sort((a, b) => a.index - b.index)[airportTimePairs.length - 1].time
    }

    // 3) Arrival Date
    const datePattern =
      /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/gi

    const dateHits: Array<{ day: number; month: number; index: number }> = []
    for (;;) {
      const m = datePattern.exec(text)
      if (!m) break
      const day = Number(m[2])
      const month = monthMap[m[3].toLowerCase()] ?? 0
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        dateHits.push({ day, month, index: m.index })
      }
    }

    const arrivalAnchorIndex =
      airportTimePairs.length > 0
        ? airportTimePairs.sort((a, b) => a.index - b.index)[airportTimePairs.length - 1].index
        : -1

    let arrivalDate = ''
    if (dateHits.length > 0) {
      const afterAnchor = arrivalAnchorIndex >= 0
        ? dateHits.filter((d) => d.index > arrivalAnchorIndex)
        : []

      const chosen = (afterAnchor.length > 0 ? afterAnchor : dateHits)[(afterAnchor.length > 0 ? afterAnchor : dateHits).length - 1]
      arrivalDate = toIsoDateFromDayMonth(chosen.day, chosen.month)
    }

    // 4) Flight Number
    const flightCandidates: Array<{ value: string; index: number }> = []
    const flightPattern = /\b([A-Z0-9]{2,3})\s*[- ]?\s*(\d{2,5})\b/g

    for (;;) {
      const m = flightPattern.exec(text)
      if (!m) break
      const prefix = m[1]
      const digits = m[2]
      const combined = `${prefix}-${digits}`.toUpperCase()

      // reject airport codes(pure 3 letters)
      if (/^[A-Z]{3}$/.test(prefix)) continue
      if (/\d{1,2}:\d{2}/.test(combined)) continue

      flightCandidates.push({ value: combined.replace('-', ''), index: m.index })
    }

    let flightNumber = ''
    if (flightCandidates.length > 0) {
      if (airline) {
        const airlineIndex = text.toLowerCase().indexOf(airline.toLowerCase())
        if (airlineIndex >= 0) {
          const nearest = flightCandidates
            .map((c) => ({ ...c, dist: Math.abs(c.index - airlineIndex) }))
            .sort((a, b) => a.dist - b.dist)[0]
          flightNumber = nearest.value
        } else {
          flightNumber = flightCandidates[0].value
        }
      } else {
        flightNumber = flightCandidates[0].value
      }
    }

    const confidence =
      (airline ? 30 : 0) +
      (flightNumber ? 35 : 0) +
      (arrivalDate ? 20 : 0) +
      (arrivalTime ? 15 : 0)

    return {
      airline,
      flightNumber,
      arrivalDate,
      arrivalTime,
      confidence,
    }
  }
}
