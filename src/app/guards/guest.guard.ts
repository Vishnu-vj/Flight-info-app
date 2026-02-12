import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Auth, onAuthStateChanged, type User } from '@angular/fire/auth'
import { AuthorizationService } from '../services/authorization.service'
import { Observable, of, from } from 'rxjs'
import { take, switchMap, map, catchError } from 'rxjs/operators'

// Convert Firebase auth to observable
function authState$(auth: Auth): Observable<User | null> {
  return new Observable<User | null>((subscriber) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => subscriber.next(user),
      (error) => subscriber.error(error)
    )
    return unsubscribe // Cleanup listener
  })
}

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth)
  const router = inject(Router)
  const authorizationService = inject(AuthorizationService)

  return authState$(auth).pipe(
    take(1), // Only first emission
    switchMap((user) => {
      if (!user) return of(true) // Allow guests

      return from(authorizationService.isCurrentUserAllowed()).pipe(
        // Check access status
        map((isAllowed) => {
          if (isAllowed) return router.createUrlTree(['/flight-form']) // Redirect logged-in user
          return router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } })
        }),
        // Safe fallback
        catchError(() =>
          of(router.createUrlTree(['/login'], { queryParams: { reason: 'not-authorized' } }))
        )
      )
    })
  )
}
