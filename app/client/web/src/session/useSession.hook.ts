import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { Focus } from 'databag-client-sdk'

export function useSession() {
  let app = useContext(AppContext) as ContextType
  let display = useContext(DisplayContext) as ContextType
  let [state, setState] = useState({
    focus: null as Focus | null,
    layout: null,
    strings: display.state.strings,
    disconnected: false,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let setStatus = (status: string) => {
      if (status === 'disconnected') {
        updateState({ disconnected: true })
      }
      if (status === 'connected') {
        updateState({ disconnected: false })
      }
    }
    let session = app.state.session
    if (session) {
      session.addStatusListener(setStatus)
      return () => session.removeStatusListener()
    }
  }, [app.state.session])

  useEffect(() => {
    let { layout, strings } = display.state
    updateState({ layout, strings })
  }, [display.state])

  useEffect(() => {
    let { focus } = app.state
    updateState({ focus })
  }, [app.state])

  let actions = {}

  return { state, actions }
}
