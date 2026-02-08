import { Routes } from '@angular/router'
import { Login } from './pages/login/login'
import { FlightForm } from './pages/flight-form/flight-form'
import { authGuard } from './guards/auth.guard'
import { guestGuard } from './guards/guest.guard'

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'flight-form', component: FlightForm, canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
]
