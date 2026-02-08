import { CommonModule } from '@angular/common'
import { Component, ChangeDetectorRef, Injector, runInInjectionContext, OnInit, OnDestroy } from '@angular/core'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms'
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http'
import { Router } from '@angular/router'
import { Auth, signOut } from '@angular/fire/auth'
import type { Unsubscribe } from '@angular/fire/auth'
import { onAuthStateChanged } from '@angular/fire/auth'


interface FlightInfoPayload {
  airline: string
  arrivalDate: string
  arrivalTime: string
  flightNumber: string
  numOfGuests: number
  comments?: string
}

function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim()
  return value.length > 0 ? null : { trimmedRequired: true }
}

function airlineValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim()
  if (!value) return null

  const letters = value.match(/[A-Za-z]/g)?.length ?? 0
  if (letters < 2) return { airlineLength: 'min' }
  if (value.length > 50) return { airlineLength: 'max' }
  if (!/[A-Za-z]/.test(value)) return { airlineNotOnlyNumbers: true }

  const allowedPattern = /^[A-Za-z0-9][A-Za-z0-9\s&.,'()\/-]*[A-Za-z0-9)]$/
  if (!allowedPattern.test(value)) return { airlineCharacters: true }

  return null
}

function flightNumberValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim()
  if (!value) return null 

  if (value.length < 2) return { flightNumberLength: 'min' }
  if (value.length > 10) return { flightNumberLength: 'max' }

  const allowedChars = /^[A-Za-z0-9 -]+$/
  if (!allowedChars.test(value)) return { flightNumberCharacters: true }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return { flightNumberMustContainLetterDigit: true }

  if (/^[ -]/.test(value) || /[ -]$/.test(value) || /[ -]{2,}/.test(value)) {
    return { flightNumberSeparators: true }
  }

  const structure = /^[A-Za-z]{1,3}(?:[ -]?\d{1,4}[A-Za-z]?)$/
  if (!structure.test(value)) return { flightNumberFormat: true }
  return null
}

function arrivalDateValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim()
  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return { arrivalDateFormat: true }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { arrivalDateInvalid: true }
  }
  if (month < 1 || month > 12) return { arrivalDateInvalid: true }

  const selected = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    Number.isNaN(selected.getTime()) ||
    selected.getFullYear() !== year ||
    selected.getMonth() !== month - 1 ||
    selected.getDate() !== day
  ) {
    return { arrivalDateInvalid: true }
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  if (selected < today) return { arrivalDatePast: true }

  //Don't allow future dates after 2 years
  const maxFuture = new Date(today)
  maxFuture.setFullYear(maxFuture.getFullYear() + 2)
  if (selected > maxFuture) return { arrivalDateTooFar: true }
  return null
}

function arrivalTimeValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim()
  if (!raw) return null

  // Expected for input[type="time"]: HH:MM (24-hour)
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) return { arrivalTimeFormat: true }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return { arrivalTimeInvalid: true }
  if (hours < 0 || hours > 23) return { arrivalTimeInvalid: true }
  if (minutes < 0 || minutes > 59) return { arrivalTimeInvalid: true }

  return null
}

function arrivalDateTimeNotPastValidator(group: AbstractControl): ValidationErrors | null {
  const dateValue = String(group.get('arrivalDate')?.value ?? '').trim()
  const timeValue = String(group.get('arrivalTime')?.value ?? '').trim()

  if (!dateValue || !timeValue) return null

  // arrivalDate from input[type="date"] is typically YYYY-MM-DD
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])

  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/)
  if (!timeMatch) return null 
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  const selected = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (Number.isNaN(selected.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const selectedDay = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (selectedDay.getTime() !== today.getTime()) return null
  if (selected.getTime() < now.getTime()) return { arrivalTimePastToday: true }
  return null
}

function guestsRangeValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value
  const rawString = String(raw ?? '').trim()
  if (!rawString) return null
  if (!/^\d+$/.test(rawString)) return { guestsRange: true }

  const parsed = Number(rawString)
  if (!Number.isFinite(parsed)) return { guestsRange: true }
  if (!Number.isInteger(parsed)) return { guestsRange: true }
  if (parsed < 1 || parsed > 20) return { guestsRange: true }
  return null
}

function commentsValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '')
  const trimmed = raw.trim()

  if (!trimmed) return null
  if (trimmed.length > 300) return { commentsLength: 'max' }
  const allowedPattern = /^[A-Za-z0-9\s.,'"!?()\-/:;&@#%+*=\[\]{}\\|<>~`\n\r\t]+$/
  if (!allowedPattern.test(raw)) return { commentsCharacters: true }
  return null
}

@Component({
  selector: 'app-flight-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './flight-form.html',
  styleUrl: './flight-form.scss',
})
export class FlightForm implements OnInit,  OnDestroy {
  isSubmitting = false
  hasSubmitted = false
  //To prevent lot of POST during testing
  //TODO: Remove before final submission
  private readonly isDryRun = true

  private authUnsubscribe: Unsubscribe | null = null

  airlineSuggestions: string[] = []
  ngOnInit(): void {
  this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
  if (!user) {
    this.flightForm.disable({ emitEvent: false })
    this.submissionReceipt = null
    this.submitErrorMessage = ''
    this.submitSuccessMessage = ''
    this.changeDetectorRef.detectChanges()

    void this.router.navigate(['/login'], { queryParams: { reason: 'session-expired' } })
    return
  }

  this.flightForm.enable({ emitEvent: false })
  this.changeDetectorRef.detectChanges()
})

  this.http.get<Array<{ name: string }>>('assets/airlines.json').subscribe({
    next: (rows) => {
      this.airlineSuggestions = (rows ?? [])
        .map((r) => String(r.name ?? '').trim())
        .filter((n) => n.length > 0)
      this.changeDetectorRef.detectChanges()
    },
  })
}

ngOnDestroy(): void {
  if (this.authUnsubscribe) {
    this.authUnsubscribe()
    this.authUnsubscribe = null
  }
}

  airlinesFromDataset: Array<{ name: string; iata?: string; icao?: string }> = []
  airlineSuggestionValues: string[] = []
  private airlineLookupSet = new Set<string>()
  isAirlinesDatasetLoaded = false

  submitErrorMessage = ''
  submitSuccessMessage = ''

  submissionReceipt: FlightInfoPayload | null = null

  flightForm: FormGroup

  private readonly endpointUrl =
    'https://us-central1-crm-sdk.cloudfunctions.net/flightInfoChallenge'
  
  //TODO: Move it to env.ts instead of hard coding
  private readonly tokenHeaderValue =
    'WW91IG11c3QgYmUgdGhlIGN1cmlvdXMgdHlwZS4gIEJyaW5nIHRoaXMgdXAgYXQgdGhlIGludGVydmlldyBmb3IgYm9udXMgcG9pbnRzICEh'

  private readonly candidateName = 'Vishnu Prasath'

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private auth: Auth,
    private router: Router,
    private injector: Injector,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.flightForm = this.formBuilder.group({
      airline: ['', [trimmedRequired, airlineValidator]],
      flightNumber: ['', [trimmedRequired, flightNumberValidator]],
      arrivalDate: ['', [Validators.required, arrivalDateValidator]],
      arrivalTime: ['', [Validators.required, arrivalTimeValidator]],
      numOfGuests: ['', [Validators.required, guestsRangeValidator]],
      comments: ['', [commentsValidator]],
    },
    { validators: [arrivalDateTimeNotPastValidator] }
    )
    this.http.get<Array<{ name: string; iata?: string; icao?: string }>>('/assets/airlines.json')
    .subscribe({
      next: (rows) => {
        const cleaned = (rows || [])
          .map((row) => ({
            name: String(row?.name ?? '').trim(),
            iata: String(row?.iata ?? '').trim(),
            icao: String(row?.icao ?? '').trim(),
          }))
          .filter((row) => row.name.length > 0)

        this.airlinesFromDataset = cleaned
        this.airlineSuggestionValues = cleaned
          .map((row) => {
            const parts = []
            if (row.iata) parts.push(row.iata)
            if (row.icao) parts.push(row.icao)
            parts.push(row.name)
            return parts.join(' · ')
          })

        this.airlineLookupSet.clear()
        for (const row of cleaned) {
          this.airlineLookupSet.add(row.name.toLowerCase())
          if (row.iata) this.airlineLookupSet.add(row.iata.toLowerCase())
          if (row.icao) this.airlineLookupSet.add(row.icao.toLowerCase())
        }

        this.isAirlinesDatasetLoaded = true
        this.changeDetectorRef.detectChanges()
      },
      error: () => {
        this.isAirlinesDatasetLoaded = false
        this.changeDetectorRef.detectChanges()
      }
    })
  }

  get shouldShowArrivalTimePastTodayError(): boolean {
  const dateControl = this.flightForm.get('arrivalDate')
  const timeControl = this.flightForm.get('arrivalTime')

  const userInteracted =
    !!dateControl && (dateControl.touched || dateControl.dirty) ||
    !!timeControl && (timeControl.touched || timeControl.dirty)

  return userInteracted && !!this.flightForm.errors?.['arrivalTimePastToday']
}

  get arrivalTimeMinLabelForToday(): string {
    const now = new Date()
    const min = new Date(now.getTime() + 60 * 1000) // +1 minute to avoid edge flicker
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(min)
  }

  clearSubmissionMessages(): void {
    if (this.submitErrorMessage || this.submitSuccessMessage) {
      this.submitErrorMessage = ''
      this.submitSuccessMessage = ''
      this.changeDetectorRef.detectChanges()
    }
  }

  shouldShowError(controlName: string): boolean {
    const control = this.flightForm.get(controlName)
    if (!control) return false
    return (control.touched || this.hasSubmitted) && control.invalid
  }

  onResetClick(): void {
    this.hasSubmitted = false
    this.submitErrorMessage = ''
    this.submitSuccessMessage = ''
    this.submissionReceipt = null

    this.flightForm.reset({
      airline: '',
      flightNumber: '',
      arrivalDate: '',
      arrivalTime: '',
      numOfGuests: '',
      comments: '',
    })

    this.changeDetectorRef.detectChanges()
  }

  onSubmitAnotherClick(): void {
    this.onResetClick()
  }

  onEditSubmissionClick(): void {
    this.submissionReceipt = null
    this.changeDetectorRef.detectChanges()
  }

  async onSignOutClick(): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => signOut(this.auth))
    } finally {
      await this.router.navigateByUrl('/login')
    }
  }

  formatReceiptTime(timeString: string): string {
    const safe = String(timeString ?? '').trim()
    if (!safe) return ''

    const match = safe.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return safe

    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return safe

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  get todayDateString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  get minArrivalTimeForSelectedDate(): string | null {
    const rawDate = String(this.flightForm.get('arrivalDate')?.value ?? '').trim()
    if (!rawDate) return null

    const now = new Date()
    const today =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    if (rawDate !== today) return null
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  private parseLocalDate(dateString: string): Date | null {
  const parts = String(dateString || '').split('-').map(Number)
  if (parts.length !== 3) return null

  const [year, month, day] = parts
  if (!year || !month || !day) return null

  // Local date at midnight (no UTC shift)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

formatReceiptDate(dateString: string): string {
  const date = this.parseLocalDate(dateString)
  if (!date) return dateString

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

formatReceiptDateTime(dateString: string, timeString: string): string {
  const date = this.parseLocalDate(dateString)
  if (!date) return `${dateString} ${timeString}`

  const [hh, mm] = String(timeString || '').split(':').map(Number)
  if (Number.isFinite(hh) && Number.isFinite(mm)) {
    date.setHours(hh, mm, 0, 0)
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

  onAirlineBlur(): void {
    const control = this.flightForm.get('airline')
    if (!control) return
    const normalized = this.normalizeAirlineInput(control.value).trim().replace(/\s+/g, ' ')
    if (normalized !== String(control.value ?? '')) {
      control.setValue(normalized)
    }
  }

  onFlightNumberBlur(): void {
    const control = this.flightForm.get('flightNumber')
    if (!control) return
    const normalized = this.normalizeFlightNumberInput(control.value)
    if (normalized !== String(control.value ?? '')) {
      control.setValue(normalized)
    }
  }

  private normalizeFlightNumberInput(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return value
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, '')
  }

  private normalizeArrivalTimeInput(raw: string): string {
    const value = String(raw ?? '').trim()
    if (!value) return value
    const match = value.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return value
    const hh = String(Number(match[1])).padStart(2, '0')
    const mm = String(Number(match[2])).padStart(2, '0')
    return `${hh}:${mm}`
  }

  private normalizeCommentsInput(raw: string): string {
    const value = String(raw ?? '').trim()
    if (!value) return ''
    return value
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
  }

  private normalizeAirlineInput(raw: string): string {
    const value = String(raw ?? '').trim()
    if (!value) return value

    const parts = value.split('·').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return parts[parts.length - 1]
    }

    return value
  }

  get airlineLooksUnknown(): boolean {
    if (!this.isAirlinesDatasetLoaded) return false
    const raw = this.normalizeAirlineInput(this.flightForm.get('airline')?.value)
    const value = String(raw ?? '').trim().toLowerCase()
    if (!value) return false
    const airlineControl = this.flightForm.get('airline')
    if (airlineControl && airlineControl.invalid) return false
    return !this.airlineLookupSet.has(value)
  }

  private buildPayload(): FlightInfoPayload {
    const airline = this.normalizeAirlineInput(this.flightForm.get('airline')?.value).trim().replace(/\s+/g, ' ')
    const flightNumber = this.normalizeFlightNumberInput(this.flightForm.get('flightNumber')?.value)
    const arrivalDate = String(this.flightForm.get('arrivalDate')?.value ?? '').trim()
    const arrivalTime = this.normalizeArrivalTimeInput(this.flightForm.get('arrivalTime')?.value)
    const guestsRaw = this.flightForm.get('numOfGuests')?.value
    const numOfGuests = Number(String(guestsRaw ?? '').trim())
    const commentsNormalized = this.normalizeCommentsInput(this.flightForm.get('comments')?.value)

    const payload: FlightInfoPayload = {
      airline,
      arrivalDate,
      arrivalTime,
      flightNumber,
      numOfGuests,
    }

    if (commentsNormalized.length > 0) {
      payload.comments = commentsNormalized
    }
    return payload
  }

  async onSubmit(): Promise<void> {
    this.hasSubmitted = true
    this.submitErrorMessage = ''
    this.submitSuccessMessage = ''

    if (this.flightForm.invalid) {
      this.flightForm.markAllAsTouched()
      this.changeDetectorRef.detectChanges()
      return
    }

    this.isSubmitting = true
    this.changeDetectorRef.detectChanges()

    const payload = this.buildPayload()

    //TODO: Remove this before submitting
    if (this.isDryRun) {
    console.log('[DRY RUN] FlightInfoPayload:', payload)
    console.log('[DRY RUN] Headers:', { token: this.tokenHeaderValue, candidate: this.candidateName })

    // simulate success UX without hitting their server
    this.submissionReceipt = payload
    this.submitSuccessMessage = 'Dry run: payload looks good. No request was sent.'
    this.isSubmitting = false
    this.changeDetectorRef.detectChanges()
    return
  }

    const headers = new HttpHeaders({
      token: this.tokenHeaderValue,
      candidate: this.candidateName,
    })

    try {
      const response: any = await runInInjectionContext(this.injector, () =>
        this.http
          .post(this.endpointUrl, payload, { headers })
          .toPromise()
      )

      const isSuccess =
        response === true ||
        response === 'true' ||
        response?.success === true ||
        response?.ok === true

      if (!isSuccess) {
        this.submitErrorMessage =
          'Submission was received but marked as invalid. Please double-check each field and try again.'
        this.changeDetectorRef.detectChanges()
        return
      }

      this.submissionReceipt = payload
      this.submitSuccessMessage = 'Your flight details were submitted successfully.'
      this.changeDetectorRef.detectChanges()
    } catch (error: any) {
      this.submitErrorMessage =
        'Could not submit due to a network or server error. Please try again.'
      this.changeDetectorRef.detectChanges()
    } finally {
      this.isSubmitting = false
      this.changeDetectorRef.detectChanges()
    }
  }
}
