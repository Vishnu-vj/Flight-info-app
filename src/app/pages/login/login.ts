import { CommonModule } from '@angular/common'
import { Component, ChangeDetectorRef, Injector, runInInjectionContext, OnInit, OnDestroy } from '@angular/core'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms'
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Unsubscribe,
} from '@angular/fire/auth'
import { Router } from '@angular/router'
import { ActivatedRoute } from '@angular/router'

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
export class Login implements OnInit, OnDestroy {
  showPassword = false
  isSubmitting = false
  authErrorMessage = ''
  hasSubmitted = false

  isResettingPassword = false
  resetEmailSent = false
  resetErrorMessage = ''

  isGoogleSigningIn = false
  googleAuthErrorMessage = ''
  sessionExpiredMessage = ''

  loginForm: FormGroup
  private authUnsubscribe: Unsubscribe | null = null

  constructor(
    private formBuilder: FormBuilder,
    private auth: Auth,
    private router: Router,
    private injector: Injector,
    private changeDetectorRef: ChangeDetectorRef,
    private route: ActivatedRoute
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

      if (this.resetEmailSent || this.resetErrorMessage) {
        this.resetEmailSent = false
        this.resetErrorMessage = ''
        this.changeDetectorRef.detectChanges()
      }

      if (this.googleAuthErrorMessage) {
        this.googleAuthErrorMessage = ''
        this.changeDetectorRef.detectChanges()
      }
    })

    this.route.queryParamMap.subscribe((params) => {
      const reason = params.get('reason')
      this.sessionExpiredMessage =
      reason === 'session-expired' ? 'Please sign in again to continue.' : ''
    })
  }

  ngOnInit(): void {
    this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        void this.router.navigateByUrl('/flight-form')
      }
    })
  }

  ngOnDestroy(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe()
      this.authUnsubscribe = null
    }
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

  async onForgotPasswordClick(): Promise<void> {
    this.resetEmailSent = false
    this.resetErrorMessage = ''

    const email = String(this.emailControl?.value ?? '').trim()

    if (!email) {
      this.resetErrorMessage = 'Enter your email above, then click “Forgot password?”.'
      this.changeDetectorRef.detectChanges()
      return
    }

    const consumerEmailPattern = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/
    if (!consumerEmailPattern.test(email)) {
      this.resetErrorMessage = 'Enter a valid email address first.'
      this.changeDetectorRef.detectChanges()
      return
    }

    this.isResettingPassword = true
    this.changeDetectorRef.detectChanges()

    try {
      await runInInjectionContext(this.injector, () =>
        sendPasswordResetEmail(this.auth, email, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        })
      )
      this.resetEmailSent = true
    } catch (error: any) {
      const errorCode = String(error?.code ?? '')

      if (errorCode === 'auth/user-not-found') {
        this.resetEmailSent = true
      } else if (errorCode === 'auth/invalid-email') {
        this.resetErrorMessage = 'That email address looks invalid.'
      } else if (errorCode === 'auth/too-many-requests') {
        this.resetErrorMessage = 'Too many attempts. Please try again in a bit.'
      } else if (errorCode === 'auth/network-request-failed') {
        this.resetErrorMessage = 'Network error. Please try again.'
      } else {
        this.resetErrorMessage = 'Could not send reset email. Please try again.'
      }
    } finally {
      this.isResettingPassword = false
      this.changeDetectorRef.detectChanges()
    }
  }

  async onGoogleSignIn(): Promise<void> {
  this.googleAuthErrorMessage = ''
  this.isGoogleSigningIn = true
  this.changeDetectorRef.detectChanges()

  let focusFallbackTimer: any = null

 const onWindowFocus = () => {
    focusFallbackTimer = setTimeout(() => {
      if (this.isGoogleSigningIn) {
        this.isGoogleSigningIn = false
        this.changeDetectorRef.detectChanges()
      }
    }, 250)
  }

  window.addEventListener('focus', onWindowFocus, { once: true })

  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    await runInInjectionContext(this.injector, () =>
      signInWithPopup(this.auth, provider)
    )

    await this.router.navigateByUrl('/flight-form')
  } catch (error: any) {
    const errorCode = String(error?.code ?? '')

    if (errorCode === 'auth/popup-closed-by-user') {
      this.googleAuthErrorMessage = ''
    } else if (errorCode === 'auth/popup-blocked') {
      this.googleAuthErrorMessage = 'Popup blocked by your browser. Please allow popups and try again.'
    } else if (errorCode === 'auth/cancelled-popup-request') {
      this.googleAuthErrorMessage = ''
    } else if (errorCode === 'auth/network-request-failed') {
      this.googleAuthErrorMessage = 'Network error. Please try again.'
    } else {
      this.googleAuthErrorMessage = 'Google sign-in failed. Please try again.'
    }
  } finally {
    if (focusFallbackTimer) clearTimeout(focusFallbackTimer)
    this.isGoogleSigningIn = false
    this.changeDetectorRef.detectChanges()
  }
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
