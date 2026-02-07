import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms'

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

  constructor(private formBuilder: FormBuilder) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, consumerEmailValidator]],
      password: ['', [Validators.required, Validators.minLength(6)]],
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

    this.isSubmitting = true
    try {
      // Placeholder to wire Firebase Auth here 
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch {
      this.authErrorMessage = 'Login failed. Please try again.'
    } finally {
      this.isSubmitting = false
    }
  }
}
