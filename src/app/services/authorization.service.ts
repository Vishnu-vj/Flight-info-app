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
    if (!email) return false

    const allowedUserDoc = doc(this.firestore, 'allowedUsers', email)
    const snap = await getDoc(allowedUserDoc)

    if (!snap.exists()) return false

    const data = snap.data() as { enabled?: boolean }
    return data?.enabled === true
  }
}
