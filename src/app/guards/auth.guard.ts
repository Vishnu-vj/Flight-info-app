import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Auth, onAuthStateChanged, type User } from '@angular/fire/auth'
import { AuthorizationService } from '../services/authorization.service'
import { Observable, of, from } from 'rxjs'
import { take, switchMap, map, catchError } from 'rxjs/operators'

// Wrap Firebase auth listener
function authState$(auth: Auth): Observable<User | null> {
  return new Observable<User | null>((subscriber) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => subscriber.next(user),
      (error) => subscriber.error(error)
    )
    return unsubscribe // Clean up listener
  })
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth)
  const router = inject(Router)
  const authorizationService = inject(AuthorizationService)

  return authState$(auth).pipe(
    take(1), // Only first auth state
    switchMap((user) => {
      if (!user) {
        // Not logged in
        return of(
          router.createUrlTree(['/login'], {
            queryParams: { reason: 'auth-required' },
          })
        )
      }

      return from(authorizationService.isCurrentUserAllowed()).pipe(
        // Check backend access
        map((isAllowed) =>
          isAllowed
            ? true
            : router.createUrlTree(['/login'], {
                queryParams: { reason: 'not-authorized' },
              })
        ),
        // Fallback on error
        catchError(() =>
          of(
            router.createUrlTree(['/login'], {
              queryParams: { reason: 'not-authorized' },
            })
          )
        )
      )
    })
  )
}
