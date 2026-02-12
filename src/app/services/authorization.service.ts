import { Injectable, inject } from '@angular/core'
import { Auth } from '@angular/fire/auth'
import { Firestore, doc, getDoc } from '@angular/fire/firestore'

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly auth = inject(Auth)
  private readonly firestore = inject(Firestore)

  async isCurrentUserAllowed(): Promise<boolean> {
    const user = this.auth.currentUser
    const email = String(user?.email ?? '').trim().toLowerCase()

    if (!email) return false // No email, deny

    // Lookup allowed user
    const allowedUserDoc = doc(this.firestore, 'allowedUsers', email)
    const snap = await getDoc(allowedUserDoc)

    if (!snap.exists()) return false // Not in whitelist

    const data = snap.data() as { enabled?: boolean }

    // Must be explicitly enabled
    return data?.enabled === true
  }
}
