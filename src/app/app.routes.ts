import { Routes } from '@angular/router'
import { Login } from './pages/login/login'
import { FlightForm } from './pages/flight-form/flight-form'

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'flight-form', component: FlightForm },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
]
