import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Auth } from '@angular/fire/auth'
import { authState } from 'rxfire/auth'
import { map, take } from 'rxjs/operators'

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth)
  const router = inject(Router)

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (user) return true
      return router.createUrlTree(['/login'])
    })
  )
}
