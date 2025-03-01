import { useEffect, useState, useContext, useRef } from 'react'
import { AppContext } from '../context/AppContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { type Profile, type Config, PushType } from 'databag-client-sdk'
import { Point, Area } from 'react-easy-crop/types'

var IMAGE_DIM = 192
var DEBOUNCE_MS = 1000

function urlB64ToUint8Array(b64: string) {
  var padding = '='.repeat((4 - (b64.length % 4)) % 4)
  var base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')

  var rawData = window.atob(base64)
  var outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useSettings() {
  var display = useContext(DisplayContext) as ContextType
  var app = useContext(AppContext) as ContextType
  var debounce = useRef(setTimeout(() => {}, 0))

  var [state, setState] = useState({
    config: {} as Config,
    profile: {} as Profile,
    profileSet: false,
    imageUrl: null,
    strings: display.state.strings,
    scheme: '',
    language: '',
    themes: display.state.themes,
    languages: display.state.languages,
    audioId: null,
    audioInputs: [],
    videoId: null,
    videoInputs: [],
    timeFormat: '12h',
    dateFormat: 'mm/dd',
    all: false,
    password: '',
    confirm: '',
    username: '',
    taken: false,
    checked: true,
    name: '',
    description: '',
    location: '',
    handle: '',
    clip: { width: 0, height: 0, x: 0, y: 0 },
    crop: { x: 0, y: 0 },
    zoom: 1,
    secretText: '',
    secretImage: '',
    code: '',
    editImage: '',
    webPushKey: null,
    sealPassword: '',
    sealConfirm: '',
    sealDelete: '',
    secretCopied: false,
    blockedCards: [] as { cardId: string; timestamp: number }[],
    blockedChannels: [] as { cardId: string | null; channelId: string; timestamp: number }[],
    blockedMessages: [] as { cardId: string | null; channelId: string; topicId: string; timestamp: number }[],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  var getSession = () => {
    var session = app.state?.session
    var settings = session?.getSettings()
    var identity = session?.getIdentity()
    if (!settings || !identity) {
      console.log('session not set in settings hook')
    }
    return { settings, identity }
  }

  useEffect(() => {
    var { settings, identity } = getSession()
    var setConfig = (config: Config) => {
      updateState({ config })
    }
    settings.addConfigListener(setConfig)
    var setProfile = (profile: Profile) => {
      var { handle, name, location, description } = profile
      var url = identity.getProfileImageUrl()
      updateState({
        profile,
        handle,
        name,
        location,
        description,
        imageUrl: url,
        editImage: url,
        profileSet: true,
      })
    }
    identity.addProfileListener(setProfile)
    return () => {
      settings.removeConfigListener(setConfig)
      identity.removeProfileListener(setProfile)
    }
  }, [])

  useEffect(() => {
    var { strings, dateFormat, timeFormat, themes, scheme, languages, language, audioId, audioInputs, videoId, videoInputs } = display.state
    updateState({
      strings,
      dateFormat,
      timeFormat,
      themes: [...themes],
      scheme,
      languages,
      language,
      audioId,
      audioInputs,
      videoId,
      videoInputs,
    })
  }, [display.state])

  var actions = {
    loadBlockedMessages: async () => {
      var settings = app.state.session.getSettings()
      var blockedMessages = await settings.getBlockedTopics()
      updateState({ blockedMessages })
    },
    unblockMessage: async (cardId: string | null, channelId: string, topicId: string) => {
      var content = app.state.session.getContent()
      await content.clearBlockedChannelTopic(cardId, channelId, topicId)
      var blockedMessages = state.blockedMessages.filter((blocked) => blocked.cardId != cardId || blocked.channelId != channelId || blocked.topicId != topicId)
      updateState({ blockedMessages })
    },
    loadBlockedChannels: async () => {
      var settings = app.state.session.getSettings()
      var blockedChannels = await settings.getBlockedChannels()
      updateState({ blockedChannels })
    },
    unblockChannel: async (cardId: string | null, channelId: string) => {
      var content = app.state.session.getContent()
      await content.setBlockedChannel(cardId, channelId, false)
      var blockedChannels = state.blockedChannels.filter((blocked) => blocked.cardId != cardId || blocked.channelId != channelId)
      updateState({ blockedChannels })
    },
    loadBlockedCards: async () => {
      var settings = app.state.session.getSettings()
      var blockedCards = await settings.getBlockedCards()
      updateState({ blockedCards })
    },
    unblockCard: async (cardId: string) => {
      var contact = app.state.session.getContact()
      await contact.setBlockedCard(cardId, false)
      var blockedCards = state.blockedCards.filter((blocked) => blocked.cardId != cardId)
      updateState({ blockedCards })
    },
    getUsernameStatus: async (username: string) => {
      var { settings } = getSession()
      return await settings.getUsernameStatus(username)
    },
    setLogin: async () => {
      var { settings } = getSession()
      await settings.setLogin(state.handle, state.password)
    },
    enableNotifications: async () => {
      var webPushKey = state.config?.webPushKey
      if (!webPushKey) {
        throw new Error('web push key not set')
      }
      var status = await Notification.requestPermission()
      if (status === 'granted') {
        var registration = await navigator.serviceWorker.register('push.js')
        await navigator.serviceWorker.ready
        var params = { userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(webPushKey) }
        var subscription = await registration.pushManager.subscribe(params)

        var endpoint = subscription.endpoint
        var binPublicKey = subscription.getKey('p256dh')
        var binAuth = subscription.getKey('auth')

        if (endpoint && binPublicKey && binAuth) {
          var numPublicKey: number[] = []
          new Uint8Array(binPublicKey).forEach((val) => {
            numPublicKey.push(val)
          })
          var numAuth: number[] = []
          new Uint8Array(binAuth).forEach((val) => {
            numAuth.push(val)
          })
          var publicKey = btoa(String.fromCharCode.apply(null, numPublicKey))
          var auth = btoa(String.fromCharCode.apply(null, numAuth))

          var pushParams = { endpoint, publicKey, auth, type: PushType.Web }
          var { settings } = getSession()
          await settings.enableNotifications(pushParams)
        }
      }
    },
    disableNotifications: async () => {
      var { settings } = getSession()
      await settings.disableNotifications()
    },
    enableRegistry: async () => {
      var { settings } = getSession()
      await settings.enableRegistry()
    },
    disableRegistry: async () => {
      var { settings } = getSession()
      await settings.disableRegistry()
    },
    enableMFA: async () => {
      var { settings } = getSession()
      var { secretImage, secretText } = await settings.enableMFA()
      updateState({ secretImage, secretText })
    },
    disableMFA: async () => {
      var { settings } = getSession()
      await settings.disableMFA()
    },
    confirmMFA: async () => {
      var { settings } = getSession()
      await settings.confirmMFA(state.code)
    },
    setCode: (code: string) => {
      updateState({ code })
    },
    copySecret: () => {
      navigator.clipboard.writeText(state.secretText)
      updateState({ secretCopied: true })
      setTimeout(() => {
        updateState({ secretCopied: false })
      }, 1000)
    },
    setSeal: async () => {
      var { settings } = getSession()
      await settings.setSeal(state.sealPassword)
    },
    clearSeal: async () => {
      var { settings } = getSession()
      await settings.clearSeal()
    },
    unlockSeal: async () => {
      var { settings } = getSession()
      await settings.unlockSeal(state.sealPassword)
    },
    forgetSeal: async () => {
      var { settings } = getSession()
      await settings.forgetSeal()
    },
    updateSeal: async () => {
      var { settings } = getSession()
      await settings.updateSeal(state.sealPassword)
    },
    setProfileData: async (name: string, location: string, description: string) => {
      var { identity } = getSession()
      await identity.setProfileData(name, location, description)
    },
    setProfileImage: async (image: string) => {
      var { identity } = getSession()
      await identity.setProfileImage(image)
    },
    getProfileImageUrl: () => {
      var { identity } = getSession()
      return identity.getProfileImageUrl()
    },
    setLanguage: (code: string) => {
      display.actions.setLanguage(code)
    },
    setTheme: (theme: string) => {
      display.actions.setTheme(theme)
    },
    setVideo: (device: string | null) => {
      display.actions.setVideoInput(device ? device : null)
    },
    setAudio: (device: string | null) => {
      display.actions.setAudioInput(device ? device : null)
    },
    setDateFormat: (format: string) => {
      display.actions.setDateFormat(format)
    },
    setTimeFormat: (format: string) => {
      display.actions.setTimeFormat(format)
    },
    setAll: (all: boolean) => {
      updateState({ all })
    },
    logout: async () => {
      await app.actions.accountLogout(state.all)
    },
    setHandle: (handle: string) => {
      updateState({ handle, taken: false, checked: false })
      clearTimeout(debounce.current)
      if (!handle || handle === state.profile.handle) {
        updateState({ available: true, checked: true })
      } else {
        debounce.current = setTimeout(async () => {
          var { settings } = getSession()
          var available = await settings.getUsernameStatus(handle)
          updateState({ taken: !available, checked: true })
        }, DEBOUNCE_MS)
      }
    },
    setPassword: (password: string) => {
      updateState({ password })
    },
    setConfirm: (confirm: string) => {
      updateState({ confirm })
    },
    setName: (name: string) => {
      updateState({ name })
    },
    setLocation: (location: string) => {
      updateState({ location })
    },
    setDescription: (description: string) => {
      updateState({ description })
    },
    setDetails: async () => {
      var { identity } = getSession()
      var { name, location, description } = state
      await identity.setProfileData(name, location, description)
    },
    setCrop: (crop: Point) => {
      updateState({ crop })
    },
    setZoom: (zoom: number) => {
      updateState({ zoom })
    },
    setEditImageCrop: (clip: Area) => {
      updateState({ clip })
    },
    setEditImage: (editImage: string) => {
      updateState({ editImage })
    },
    setSealDelete: (sealDelete: string) => {
      updateState({ sealDelete })
    },
    setSealPassword: (sealPassword: string) => {
      updateState({ sealPassword })
    },
    setSealConfirm: (sealConfirm: string) => {
      updateState({ sealConfirm })
    },
    setImage: async () => {
      var { identity } = getSession()
      var processImg = () => {
        return new Promise<string>((resolve, reject) => {
          var img = new Image()
          img.onload = () => {
            try {
              var canvas = document.createElement('canvas')
              var context = canvas.getContext('2d')
              if (!context) {
                throw new Error('failed to allocate context')
              }
              canvas.width = IMAGE_DIM
              canvas.height = IMAGE_DIM
              context.imageSmoothingQuality = 'medium'
              context.drawImage(img, state.clip.x, state.clip.y, state.clip.width, state.clip.height, 0, 0, IMAGE_DIM, IMAGE_DIM)
              resolve(canvas.toDataURL())
            } catch (err) {
              console.log(err)
              reject()
            }
          }
          if (!state.editImage) {
            throw new Error('invalid edit image')
          }
          img.onerror = reject
          img.src = state.editImage
        })
      }
      var dataUrl = await processImg()
      var data = dataUrl.split(',')[1]
      await identity.setProfileImage(data)
    },
    getTimestamp: (created: number) => {
      var now = Math.floor(new Date().getTime() / 1000)
      var date = new Date(created * 1000)
      var offset = now - created
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
    },
  }

  return { state, actions }
}
