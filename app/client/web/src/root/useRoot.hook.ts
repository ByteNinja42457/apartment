import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { ContextType } from '../context/ContextType'
import { useLocation, useNavigate } from 'react-router-dom'

export function useRoot() {
  let app = useContext(AppContext) as ContextType
  let location = useLocation()
  let navigate = useNavigate()
  let [state, setState] = useState({
    pathname: '',
    session: null,
    service: null,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let { pathname } = location
    updateState({ pathname })
  }, [location.pathname])

  useEffect(() => {
    let { pathname, service, session } = app.state || {}
    let path = pathname === '/session' || pathname === '/service' || pathname === '/access' ? pathname : '/'
    if (path === '/session' && !session) {
      navigate('/')
    } else if (path === '/service' && !service) {
      navigate('/')
    } else if (path === '/' && !session && !service) {
      navigate('/access')
    } else if (path !== '/service' && service) {
      navigate('/service')
    } else if (path !== '/session' && session) {
      navigate('/session')
    } else {
      navigate('/')
    }
  }, [state?.pathname, app.state?.session, app.state?.service])

  let actions = {}

  return { state, actions }
}
