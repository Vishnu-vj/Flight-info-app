import { CommonModule } from '@angular/common'
import { Component, ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms'
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http'
import { Router } from '@angular/router'
import { Auth, signOut } from '@angular/fire/auth'

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

function guestsRangeValidator(control: AbstractControl): ValidationErrors | null {
  const rawValue = control.value
  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) return { guestsRange: true }
  if (!Number.isInteger(parsed)) return { guestsRange: true }
  if (parsed < 1 || parsed > 20) return { guestsRange: true }

  return null
}

@Component({
  selector: 'app-flight-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './flight-form.html',
  styleUrl: './flight-form.scss',
})
export class FlightForm {
  isSubmitting = false
  hasSubmitted = false
  //To prevent lot of POST during testing
  //TODO: Remove before final submission
  private readonly isDryRun = true

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
      airline: ['', [trimmedRequired]],
      flightNumber: ['', [trimmedRequired]],
      arrivalDate: ['', [Validators.required]],
      arrivalTime: ['', [Validators.required]],
      numOfGuests: ['', [Validators.required, guestsRangeValidator]],
      comments: [''],
    })
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

  private buildPayload(): FlightInfoPayload {
    const airline = String(this.flightForm.get('airline')?.value ?? '').trim()
    const flightNumber = String(this.flightForm.get('flightNumber')?.value ?? '').trim()
    const arrivalDate = String(this.flightForm.get('arrivalDate')?.value ?? '').trim()
    const arrivalTime = String(this.flightForm.get('arrivalTime')?.value ?? '').trim()

    const guestsRaw = this.flightForm.get('numOfGuests')?.value
    const numOfGuests = Number(guestsRaw)

    const commentsRaw = String(this.flightForm.get('comments')?.value ?? '').trim()

    const payload: FlightInfoPayload = {
      airline,
      arrivalDate,
      arrivalTime,
      flightNumber,
      numOfGuests,
    }

    if (commentsRaw.length > 0) {
      payload.comments = commentsRaw
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
