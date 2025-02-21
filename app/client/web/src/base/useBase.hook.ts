import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { Card, Channel, Profile } from 'databag-client-sdk'

export function useBase() {
  let app = useContext(AppContext) as ContextType
  let display = useContext(DisplayContext) as ContextType
  let [state, setState] = useState({
    strings: display.state.strings,
    scheme: display.state.scheme,
    profileSet: null as null | boolean,
    cardSet: null as null | boolean,
    channelSet: null as null | boolean,
    contentSet: null as null | boolean,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let { strings, scheme } = display.state
    updateState({ strings, scheme })
  }, [display.state])

  useEffect(() => {
    let setProfile = (profile: Profile) => {
      updateState({ profileSet: Boolean(profile.name) })
    }
    let setCards = (cards: Card[]) => {
      updateState({ cardSet: cards.length > 0 })
    }
    let setChannels = ({ channels, cardId }: { channels: Channel[]; cardId: string | null }) => {
      updateState({ channelSet: cardId && channels.length > 0 })
    }
    let setContent = (loaded: boolean) => {
      updateState({ contentSet: loaded })
    }

    let { identity, contact, content } = app.state.session
    identity.addProfileListener(setProfile)
    contact.addCardListener(setCards)
    content.addChannelListener(setChannels)
    content.addLoadedListener(setContent)

    return () => {
      identity.removeProfileListener(setProfile)
      contact.removeCardListener(setCards)
      content.removeChannelListener(setChannels)
      content.removeLoadedListener(setContent)
    }
  }, [])

  let actions = {}

  return { state, actions }
}
