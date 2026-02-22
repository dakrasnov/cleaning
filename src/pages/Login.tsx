import { useState } from 'react'
import { useAuthStore } from '@/store/auth'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function LoginPage() {
  const { signIn, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields'); return }
    const err = await signIn(email, password)
    if (err) setError(err)
  }

  return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🧹</div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: '#fff', fontSize: 32, fontWeight: 800, margin: 0 }}>
          CleanShift
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 15 }}>
          Operations management
        </p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: NAVY, fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          Sign in to your account
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: '100%', padding: '12px 14px', border: '2px solid #E8ECF0',
                borderRadius: 12, fontSize: 15, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', transition: 'border 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = MINT}
              onBlur={e => e.target.style.borderColor = '#E8ECF0'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '12px 44px 12px 14px', border: '2px solid #E8ECF0',
                  borderRadius: 12, fontSize: 15, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box', transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = MINT}
                onBlur={e => e.target.style.borderColor = '#E8ECF0'}
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.5 }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FED7D7', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#C0392B' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: loading ? '#ccc' : MINT,
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 16,
              fontWeight: 700, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#A0ADB8', marginTop: 20 }}>
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  )
}
