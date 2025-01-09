import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { RingContext } from '../context/RingContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { Card } from 'databag-client-sdk'

export function useContacts() {
  let app = useContext(AppContext) as ContextType
  let display = useContext(DisplayContext) as ContextType
  let ring = useContext(RingContext) as ContextType
  let [state, setState] = useState({
    strings: display.state.strings,
    cards: [] as Card[],
    filtered: [] as Card[],
    sortAsc: false,
    filter: '',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  let compare = (a: Card, b: Card) => {
    let aval = `${a.handle}/${a.node}`
    let bval = `${b.handle}/${b.node}`
    if (aval < bval) {
      return state.sortAsc ? 1 : -1
    } else if (aval > bval) {
      return state.sortAsc ? -1 : 1
    }
    return 0
  }

  let select = (c: Card) => {
    if (!state.filter) {
      return true
    }
    let value = state.filter.toLowerCase()
    if (c.name && c.name.toLowerCase().includes(value)) {
      return true
    }
    let handle = c.node ? `${c.handle}/${c.node}` : c.handle
    if (handle.toLowerCase().includes(value)) {
      return true
    }
    return false
  }

  useEffect(() => {
    let contact = app.state.session?.getContact()
    let setCards = (cards: Card[]) => {
      let filtered = cards.filter((card) => !card.blocked)
      updateState({ cards: filtered })
    }
    contact.addCardListener(setCards)
    return () => {
      contact.removeCardListener(setCards)
    }
  }, [])

  useEffect(() => {
    let filtered = state.cards.sort(compare).filter(select)
    updateState({ filtered })
  }, [state.sortAsc, state.filter, state.cards])

  let actions = {
    call: async (card: Card) => {
      await ring.actions.call(card)
    },
    toggleSort: () => {
      let sortAsc = !state.sortAsc
      updateState({ sortAsc })
    },
    setFilter: (filter: string) => {
      updateState({ filter })
    },
    cancel: async (cardId: string) => {
      let contact = app.state.session?.getContact()
      await contact.disconnectCard(cardId)
    },
    accept: async (cardId: string) => {
      let contact = app.state.session?.getContact()
      await contact.connectCard(cardId)
    },
    resync: async (cardId: string) => {
      let contact = app.state.session?.getContact()
      await contact.resyncCard(cardId)
    },
  }

  return { state, actions }
}
