import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Auth } from '@angular/fire/auth'
import { authState } from 'rxfire/auth'
import { map, take, switchMap, from, catchError, of } from 'rxjs'
import { AuthorizationService } from '../services/authorization.service'

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth)
  const router = inject(Router)
  const authorizationService = inject(AuthorizationService)

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login'], { queryParams: { reason: 'auth-required' } }))

      return from(authorizationService.isCurrentUserAllowed()).pipe(
        map((isAllowed) => {
          if (isAllowed) return true
          return router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } })
        }),
        catchError(() =>
          of(router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } }))
        )
      )
    })
  )
}

