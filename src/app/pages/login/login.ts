import { CommonModule } from '@angular/common'
import { Component, ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms'
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth'
import { Router } from '@angular/router'

function consumerEmailValidator(control: AbstractControl): ValidationErrors | null {
  const rawValue = String(control.value ?? '').trim()
  if (!rawValue) return null

  const consumerEmailPattern = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/
  return consumerEmailPattern.test(rawValue) ? null : { consumerEmail: true }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  showPassword = false
  isSubmitting = false
  authErrorMessage = ''
  hasSubmitted = false

  loginForm: FormGroup

  constructor(
  private formBuilder: FormBuilder,
  private auth: Auth,
  private router: Router,
  private injector: Injector,
  private changeDetectorRef: ChangeDetectorRef
) {
  this.loginForm = this.formBuilder.group({
    email: ['', [Validators.required, consumerEmailValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  })

  this.loginForm.valueChanges.subscribe(() => {
    if (this.authErrorMessage) {
      this.authErrorMessage = ''
      this.changeDetectorRef.detectChanges()
    }
  })
}

  get emailControl() {
    return this.loginForm.get('email')
  }

  get passwordControl() {
    return this.loginForm.get('password')
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword
  }

  async onSubmit(): Promise<void> {
    this.hasSubmitted = true
    this.authErrorMessage = ''

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched()
      return
    }

    const email = String(this.emailControl?.value ?? '').trim()
    const password = String(this.passwordControl?.value ?? '')

    this.isSubmitting = true
    this.changeDetectorRef.detectChanges()

    let timeoutId: any = null

    try {
      const signInPromise = runInInjectionContext(this.injector, () =>
        signInWithEmailAndPassword(this.auth, email, password)
      )

      await Promise.race([
        signInPromise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject({ code: 'app/timeout' }), 10000)
        }),
      ])

      await this.router.navigateByUrl('/flight-form')
    } catch (error: any) {
      const errorCode = String(error?.code ?? '')

      if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-login-credentials'
      ) {
        this.authErrorMessage = 'Incorrect email or password.'
      } else if (errorCode === 'auth/user-not-found') {
        this.authErrorMessage = 'No account exists for this email.'
      } else if (errorCode === 'auth/too-many-requests') {
        this.authErrorMessage = 'Too many attempts. Please try again in a bit.'
      } else if (errorCode === 'auth/network-request-failed') {
        this.authErrorMessage = 'Network error. Check your connection and try again.'
      } else if (errorCode === 'app/timeout') {
        this.authErrorMessage = 'Login timed out. Please try again.'
      } else {
        this.authErrorMessage = 'Login failed. Please try again.'
      }
      this.changeDetectorRef.detectChanges()
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      this.isSubmitting = false

      this.changeDetectorRef.detectChanges()
    }
  }
}
