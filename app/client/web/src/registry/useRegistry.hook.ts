import { useState, useContext, useEffect, useRef } from 'react'
import { AppContext } from '../context/AppContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { Profile } from 'databag-client-sdk'

export function useRegistry() {
  let updating = useRef(false)
  let update = useRef(null as { username: string; server: string } | null)
  let debounce = useRef(setTimeout(() => {}, 0))
  let app = useContext(AppContext) as ContextType
  let display = useContext(DisplayContext) as ContextType
  let [state, setState] = useState({
    strings: display.state.strings,
    username: '',
    server: '',
    profiles: [] as Profile[],
    contacts: [] as Profile[],
    guid: '',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  let getRegistry = async (username: string, server: string) => {
    update.current = { username, server }
    if (!updating.current) {
      while (update.current != null) {
        updating.current = true
        let params = update.current
        update.current = null
        try {
          let contact = app.state.session?.getContact()
          let username = params.username ? params.username : null
          let server = params.server ? params.server : null
          let profiles = await contact.getRegistry(username, server)
          updateState({ profiles })
        } catch (err) {
          console.log(err)
          updateState({ profiles: [] })
        }
        updating.current = false
      }
    }
  }
  useEffect(() => {
    updateState({ contacts: state.profiles.filter((profile: Profile) => profile.guid !== state.guid) })
  }, [state.profiles, state.guid])

  useEffect(() => {
    let identity = app.state?.session?.getIdentity()
    let setProfile = (profile: Profile) => {
      let { guid } = profile
      updateState({ guid })
    }
    if (identity) {
      identity.addProfileListener(setProfile)
      return () => {
        identity.removeProfileListener(setProfile)
      }
    }
  }, [])

  useEffect(() => {
    if (!state.username && !state.server) {
      clearTimeout(debounce.current)
      getRegistry(state.username, state.server)
    } else {
      clearTimeout(debounce.current)
      debounce.current = setTimeout(() => {
        getRegistry(state.username, state.server)
      }, 1000)
    }
  }, [state.username, state.server])

  let actions = {
    setUsername: (username: string) => {
      updateState({ username })
    },
    setServer: (server: string) => {
      updateState({ server })
    },
  }

  return { state, actions }
}
