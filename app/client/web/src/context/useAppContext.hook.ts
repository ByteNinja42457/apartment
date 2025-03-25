import { useState, useEffect, useRef } from 'react'
import { DatabagSDK, Session, Focus } from 'databag-client-sdk'
import { SessionStore } from '../SessionStore'
import { WebCrypto } from '../WebCrypto'
import { StagingFiles } from '../StagingFiles'

let databag = new DatabagSDK({ channelTypes: ['sealed', 'superbasic'] }, new WebCrypto(), new StagingFiles())

let notifications = [
  { event: 'contact.addCard', messageTitle: 'New Contact Request' },
  { event: 'contact.updateCard', messageTitle: 'Contact Update' },
  { event: 'content.addChannel.superbasic', messageTitle: 'New Topic' },
  { event: 'content.addChannel.sealed', messageTitle: 'New Topic' },
  { event: 'content.addChannelTopic.superbasic', messageTitle: 'New Topic Message' },
  { event: 'content.addChannelTopic.sealed', messageTitle: 'New Topic Message' },
  { event: 'ring', messageTitle: 'Incoming Call' },
]

export function useAppContext() {
  let sdk = useRef(databag)
  let [state, setState] = useState({
    session: null as null | Session,
    focus: null as null | Focus,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    init()
  }, [])

  let init = async () => {
    let store = new SessionStore()
    let session: Session | null = await sdk.current.initOnlineStore(store)
    if (session) {
      updateState({ session })
    }
  }

  let actions = {
    accountLogin: async (username: string, password: string, node: string, secure: boolean, code: string) => {
      let params = {
        topicBatch: 16,
        tagBatch: 16,
        channelTypes: ['test'],
        pushType: '',
        deviceToken: '',
        notifications: notifications,
        deviceId: '0011',
        version: '0.0.1',
        appName: 'databag',
      }
      let login = await sdk.current.login(username, password, node, secure, code, params)
      updateState({ session: login })
    },
    accountLogout: async (all: boolean) => {
      if (state.session) {
        await sdk.current.logout(state.session, all)
        updateState({ session: null, focus: null })
      }
    },
    accountCreate: async (handle: string, password: string, node: string, secure: boolean, token: string) => {
      let params = {
        topicBatch: 16,
        tagBatch: 16,
        channelTypes: ['test'],
        pushType: '',
        deviceToken: '',
        notifications: notifications,
        deviceId: '0011',
        version: '0.0.1',
        appName: 'databag',
      }
      let session = await sdk.current.create(handle, password, node, secure, token, params)
      updateState({ session })
    },
    accountAccess: async (node: string, secure: boolean, token: string) => {
      let params = {
        topicBatch: 16,
        tagBatch: 16,
        channelTypes: ['test'],
        pushType: '',
        deviceToken: '',
        notifications: notifications,
        deviceId: '0011',
        version: '0.0.1',
        appName: 'databag',
      }
      let session = await sdk.current.access(node, secure, token, params)
      updateState({ session })
    },
    setFocus: async (cardId: string | null, channelId: string) => {
      if (state.session) {
        let focus = await state.session.setFocus(cardId, channelId)
        updateState({ focus })
      }
    },
    clearFocus: () => {
      if (state.session) {
        state.session.clearFocus()
        updateState({ focus: null })
      }
    },
    getAvailable: async (node: string, secure: boolean) => {
      return await sdk.current.available(node, secure)
    },
    getUsername: async (username: string, token: string, node: string, secure: boolean) => {
      return await sdk.current.username(username, token, node, secure)
    },
    adminLogin: async (token: string, node: string, secure: boolean, code: string) => {
      let service = await sdk.current.configure(node, secure, token, code)
      updateState({ service })
    },
    adminLogout: async () => {
      updateState({ service: null })
    },
  }

  return { state, actions }
}
