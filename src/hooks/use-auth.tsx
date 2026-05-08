import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: any
  signIn: (email: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(pb.authStore.record)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record)
    })
    setLoading(false)
    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string) => {
    if (!email.endsWith('@brasporto.com')) {
      return { error: new Error('Por favor, utilize um e-mail corporativo @brasporto.com') }
    }

    try {
      await pb.collection('users').authWithPassword(email, 'Skip@Pass')
      return { error: null }
    } catch (error) {
      try {
        await pb.collection('users').create({
          email,
          password: 'Skip@Pass',
          passwordConfirm: 'Skip@Pass',
          name: email.split('@')[0],
        })
        await pb.collection('users').authWithPassword(email, 'Skip@Pass')
        return { error: null }
      } catch (err) {
        return { error: err }
      }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
