import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { updateUserActivity } from '../services/activityService'

export default function UserPresenceReporter() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const route = `${location.pathname}${location.search || ''}`

    updateUserActivity({
      userId: user.id,
      route,
    })

    const interval = setInterval(() => {
      updateUserActivity({
        userId: user.id,
        route,
      })
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, user?.id, location.pathname, location.search])

  return null
}