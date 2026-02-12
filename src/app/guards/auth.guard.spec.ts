import { authGuard } from './auth.guard'

describe('authGuard (basic)', () => {
  it('should be defined', () => {
    expect(authGuard).toBeDefined()
  })
})
