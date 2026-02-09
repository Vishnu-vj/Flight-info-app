import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Auth } from '@angular/fire/auth'
import { authState } from 'rxfire/auth'
import { map, take, switchMap, from, catchError, of } from 'rxjs'
import { AuthorizationService } from '../services/authorization.service'

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth)
  const router = inject(Router)
  const authorizationService = inject(AuthorizationService)

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(true)

      return from(authorizationService.isCurrentUserAllowed()).pipe(
        map((isAllowed) => {
          if (isAllowed) return router.createUrlTree(['/flight-form'])
          return router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } })
        }),
        catchError(() => of(router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } })))
      )
    })
  )
}
