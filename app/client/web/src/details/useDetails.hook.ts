import { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { FocusDetail, Card, Profile } from 'databag-client-sdk'

export function useDetails() {
  let display = useContext(DisplayContext) as ContextType
  let app = useContext(AppContext) as ContextType
  let [state, setState] = useState({
    cardId: null as null | string,
    channelId: '',
    detail: undefined as undefined | FocusDetail,
    access: false,
    host: false,
    sealed: false,
    locked: false,
    strings: display.state.strings,
    timeFormat: display.state.timeFormat,
    dateFormat: display.state.dateFormat,
    subject: '',
    editSubject: '',
    created: '',
    profile: null as null | Profile,
    cards: [] as Card[],
    hostCard: null as null | Card,
    channelCards: [] as Card[],
    unknownContacts: 0,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  let getTimestamp = (created: number) => {
    let now = Math.floor(new Date().getTime() / 1000)
    let date = new Date(created * 1000)
    let offset = now - created
    if (offset < 43200) {
      if (state.timeFormat === '12h') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      } else {
        return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
      }
    } else if (offset < 31449600) {
      if (state.dateFormat === 'mm/dd') {
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' })
      } else {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })
      }
    } else {
      if (state.dateFormat === 'mm/dd') {
        return date.toLocaleDateString('en-US')
      } else {
        return date.toLocaleDateString('en-GB')
      }
    }
  }

  useEffect(() => {
    let { strings, timeFormat, dateFormat } = display.state
    updateState({ strings, timeFormat, dateFormat })
  }, [display.state])

  useEffect(() => {
    console.log('DETAILS', state.detail)

    let hostCard = state.cards.find((entry) => entry.cardId == state.cardId)
    let profileRemoved = state.detail?.members ? state.detail.members.filter((member) => state.profile?.guid != member.guid) : []
    let contactCards = profileRemoved.map((member) => state.cards.find((card) => card.guid === member.guid))
    let channelCards = contactCards.filter((member) => Boolean(member))
    let unknownContacts = contactCards.length - channelCards.length
    updateState({ hostCard, channelCards, unknownContacts })
  }, [state.detail, state.cards, state.profile, state.cardId])

  useEffect(() => {
    let focus = app.state.focus
    let { contact, identity } = app.state.session || {}
    if (focus && contact && identity) {
      let setCards = (cards: Card[]) => {
        let filtered = cards.filter((card) => !card.blocked)
        let sorted = filtered.sort((a, b) => {
          if (a.handle > b.handle) {
            return 1
          } else if (a.handle < b.handle) {
            return -1
          } else {
            return 0
          }
        })
        updateState({ cards: sorted })
      }
      let setProfile = (profile: Profile) => {
        updateState({ profile })
      }
      let setDetail = (focused: { cardId: string | null; channelId: string; detail: FocusDetail | null }) => {
        let detail = focused ? focused.detail : null
        let cardId = focused.cardId
        let channelId = focused.channelId
        let access = Boolean(detail)
        let sealed = detail?.sealed
        let locked = detail?.locked
        let host = cardId == null
        let subject = detail?.data?.subject ? detail.data.subject : ''
        let created = detail?.created ? getTimestamp(detail.created) : ''
        updateState({ detail, editSubject: subject, subject, channelId, cardId, access, sealed, locked, host, created })
      }
      focus.addDetailListener(setDetail)
      contact.addCardListener(setCards)
      identity.addProfileListener(setProfile)
      return () => {
        focus.removeDetailListener(setDetail)
        contact.removeCardListener(setCards)
        identity.removeProfileListener(setProfile)
      }
    }
  }, [app.state.focus, state.timeFormat, state.dateFormat])

  let actions = {
    remove: async () => {
      let content = app.state.session.getContent()
      await content.removeChannel(state.channelId)
      app.actions.clearFocus()
    },
    leave: async () => {
      let content = app.state.session.getContent()
      await content.leaveChannel(state.cardId, state.channelId)
      app.actions.clearFocus()
    },
    block: async () => {
      let content = app.state.session.getContent()
      await content.setBlockedChannel(state.cardId, state.channelId, true)
      app.actions.clearFocus()
    },
    report: async () => {
      let content = app.state.session.getContent()
      await content.flagChannel(state.cardId, state.channelId)
    },
    setMember: async (cardId: string) => {
      let content = app.state.session.getContent()
      await content.setChannelCard(state.channelId, cardId)
    },
    clearMember: async (cardId: string) => {
      let content = app.state.session.getContent()
      await content.clearChannelCard(state.channelId, cardId)
    },
    setEditSubject: (editSubject: string) => {
      updateState({ editSubject })
    },
    undoSubject: () => {
      updateState({ editSubject: state.subject })
    },
    saveSubject: async () => {
      let content = app.state.session.getContent()
      await content.setChannelSubject(state.channelId, state.sealed ? 'sealed' : 'superbasic', { subject: state.editSubject })
    },
  }

  return { state, actions }
}
