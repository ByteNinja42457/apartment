import { useEffect, useState } from 'react'
import { LightTheme, DarkTheme } from '../constants/Colors'
import { en, fr, sp, pt, de, ru, el } from '../constants/Strings'

export function useDisplayContext() {
  var [state, setState] = useState({
    layout: null,
    themes: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
    ],
    theme: null,
    scheme: null,
    colors: {},
    menuStyle: {},
    languages: [
      { value: 'en', label: 'English' },
      { value: 'fr', label: 'Français' },
      { value: 'sp', label: 'Español' },
      { value: 'pt', label: 'Português' },
      { value: 'de', label: 'Deutsch' },
      { value: 'ru', label: 'Русский' },
      { value: 'el', label: 'ελληνικά' },
    ],
    language: null,
    strings: en,
    dateFormat: 'mm/dd',
    timeFormat: '12h',
    audioId: null,
    audioInputs: [],
    videoId: null,
    videoInputs: [],
  })

  var SMALL_LARGE = 650

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  var handleResize = () => {
    if (window.innerWidth < SMALL_LARGE) {
      updateState({
        layout: 'small',
        width: window.innerWidth,
        height: window.innerHeight,
      })
    } else {
      updateState({
        layout: 'large',
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
  }

  var getDevices = async (type: string) => {
    if (!navigator || !navigator.mediaDevices) {
      return []
    }

    var filtered = new Map()
    var devices = await navigator.mediaDevices.enumerateDevices()
    devices
      .filter((item) => item.deviceId !== '' && item.kind === type + 'input')
      .forEach((item) => {
        if (item) {
          var label = item.label ? item.label : state.strings.integrated
          var entry = filtered.get(item.groupId)
          if (entry) {
            if (item.label && label.length < entry.label.length) {
              filtered.set(item.groupId, {
                value: item.deviceId,
                label,
              })
            }
          } else {
            filtered.set(item.groupId, {
              value: item.deviceId,
              label,
            })
          }
        }
      })
    return Array.from(filtered.values())
  }

  useEffect(() => {
    getDevices('audio').then((audio) => {
      updateState({ audioInputs: audio })
    })
    getDevices('video').then((video) => {
      updateState({ videoInputs: video })
    })
  }, [state.strings])

  useEffect(() => {
    for (let i = 0; i < 10; i++) {
      setTimeout(handleResize, 100 * i) // cludge for my mobile browser
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    var scheme = localStorage.getItem('color_scheme')
    if (scheme === 'dark') {
      updateState({
        theme: scheme,
        scheme: 'dark',
        colors: DarkTheme,
        menuStyle: {
          backgroundColor: DarkTheme.modalArea,
          color: DarkTheme.mainText,
        },
      })
    } else if (scheme === 'light') {
      updateState({
        theme: scheme,
        scheme: 'light',
        colors: LightTheme,
        menuStyle: {
          backgroundColor: LightTheme.modalArea,
          color: LightTheme.mainText,
        },
      })
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        updateState({
          theme: null,
          scheme: 'dark',
          colors: DarkTheme,
          menuStyle: {
            backgroundColor: DarkTheme.modalArea,
            color: DarkTheme.mainText,
          },
        })
      } else {
        updateState({
          theme: null,
          scheme: 'light',
          colors: LightTheme,
          menuStyle: {
            backgroundColor: LightTheme.modalArea,
            color: LightTheme.mainText,
          },
        })
      }
    }

    var timeFormat = localStorage.getItem('time_format')
    if (timeFormat === '24h') {
      updateState({ timeFormat })
    } else {
      updateState({ timeFormat: '12h' })
    }

    var dateFormat = localStorage.getItem('date_format')
    if (dateFormat === 'dd/mm') {
      updateState({ dateFormat })
    } else {
      updateState({ dateFormat: 'mm/dd' })
    }

    var language = localStorage.getItem('language')
    if (language && language.startsWith('fr')) {
      updateState({
        language: 'fr',
        strings: fr,
        themes: [
          { value: 'dark', label: fr.dark },
          { value: 'light', label: fr.light },
        ],
      })
    } else if (language && language.startsWith('sp')) {
      updateState({
        language: 'sp',
        strings: sp,
        themes: [
          { value: 'dark', label: sp.dark },
          { value: 'light', label: sp.light },
        ],
      })
    } else if (language && language.startsWith('en')) {
      updateState({
        language: 'en',
        strings: en,
        themes: [
          { value: 'dark', label: en.dark },
          { value: 'light', label: en.light },
        ],
      })
    } else if (language && language.startsWith('pt')) {
      updateState({
        language: 'pt',
        strings: pt,
        themes: [
          { value: 'dark', label: pt.dark },
          { value: 'light', label: pt.light },
        ],
      })
    } else if (language && language.startsWith('de')) {
      updateState({
        language: 'de',
        strings: de,
        themes: [
          { value: 'dark', label: de.dark },
          { value: 'light', label: de.light },
        ],
      })
    } else if (language && language.startsWith('ru')) {
      updateState({
        language: 'ru',
        strings: ru,
        themes: [
          { value: 'dark', label: ru.dark },
          { value: 'light', label: ru.light },
        ],
      })
    } else if (language && language.startsWith('el')) {
      updateState({
        language: 'el',
        strings: el,
        themes: [
          { value: 'dark', label: el.dark },
          { value: 'light', label: el.light },
        ],
      })
    } else {
      var browser = navigator.language
      if (browser && browser.startsWith('fr')) {
        updateState({
          language: 'fr',
          strings: fr,
          themes: [
            { value: 'dark', label: fr.dark },
            { value: 'light', label: fr.light },
          ],
        })
      } else if (browser && browser.startsWith('sp')) {
        updateState({
          language: 'sp',
          strings: sp,
          themes: [
            { value: 'dark', label: sp.dark },
            { value: 'light', label: sp.light },
          ],
        })
      } else if (browser && browser.startsWith('pt')) {
        updateState({
          language: 'pt',
          strings: pt,
          themes: [
            { value: 'dark', label: pt.dark },
            { value: 'light', label: pt.light },
          ],
        })
      } else if (browser && browser.startsWith('de')) {
        updateState({
          language: 'de',
          strings: de,
          themes: [
            { value: 'dark', label: de.dark },
            { value: 'light', label: de.light },
          ],
        })
      } else if (browser && browser.startsWith('ru')) {
        updateState({
          language: 'ru',
          strings: ru,
          themes: [
            { value: 'dark', label: ru.dark },
            { value: 'light', label: ru.light },
          ],
        })
      } else if (browser && browser.startsWith('el')) {
        updateState({
          language: 'el',
          strings: el,
          themes: [
            { value: 'dark', label: el.dark },
            { value: 'light', label: el.light },
          ],
        })
      } else {
        updateState({
          language: 'en',
          strings: en,
          themes: [
            { value: 'dark', label: en.dark },
            { value: 'light', label: en.light },
          ],
        })
      }
    }

    var audioId = localStorage.getItem('audio_input')
    var videoId = localStorage.getItem('video_input')
    updateState({ audioId, videoId })

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  var actions = {
    setTheme: (theme: string) => {
      if (theme === 'dark') {
        localStorage.setItem('color_scheme', 'dark')
        updateState({
          theme: 'dark',
          scheme: 'dark',
          colors: DarkTheme,
          menuStyle: {
            backgroundColor: DarkTheme.modalArea,
            color: DarkTheme.mainText,
          },
        })
      } else if (theme === 'light') {
        localStorage.setItem('color_scheme', 'light')
        updateState({
          theme: 'light',
          scheme: 'light',
          colors: LightTheme,
          menuStyle: {
            backgroundColor: LightTheme.modalArea,
            color: LightTheme.mainText,
          },
        })
      } else {
        localStorage.removeItem('color_scheme')
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          updateState({
            theme: null,
            scheme: 'dark',
            colors: DarkTheme,
            menuStyle: {
              backgroundColor: DarkTheme.modalArea,
              color: DarkTheme.mainText,
            },
          })
        } else {
          updateState({
            theme: null,
            scheme: 'light',
            colors: LightTheme,
            menuStyle: {
              backgroundColor: LightTheme.modalArea,
              color: LightTheme.mainText,
            },
          })
        }
      }
    },
    setLanguage: (code: string) => {
      if (code && code.startsWith('fr')) {
        localStorage.setItem('language', 'fr')
        updateState({
          language: 'fr',
          strings: fr,
          themes: [
            { value: 'dark', label: fr.dark },
            { value: 'light', label: fr.light },
          ],
        })
      } else if (code && code.startsWith('sp')) {
        localStorage.setItem('language', 'sp')
        updateState({
          language: 'sp',
          strings: sp,
          themes: [
            { value: 'dark', label: sp.dark },
            { value: 'light', label: sp.light },
          ],
        })
      } else if (code && code.startsWith('en')) {
        localStorage.setItem('language', 'en')
        updateState({
          language: 'en',
          strings: en,
          themes: [
            { value: 'dark', label: en.dark },
            { value: 'light', label: en.light },
          ],
        })
      } else if (code && code.startsWith('pt')) {
        localStorage.setItem('language', 'pt')
        updateState({
          language: 'pt',
          strings: pt,
          themes: [
            { value: 'dark', label: pt.dark },
            { value: 'light', label: pt.light },
          ],
        })
      } else if (code && code.startsWith('de')) {
        localStorage.setItem('language', 'de')
        updateState({
          language: 'de',
          strings: de,
          themes: [
            { value: 'dark', label: de.dark },
            { value: 'light', label: de.light },
          ],
        })
      } else if (code && code.startsWith('ru')) {
        localStorage.setItem('language', 'ru')
        updateState({
          language: 'ru',
          strings: ru,
          themes: [
            { value: 'dark', label: ru.dark },
            { value: 'light', label: ru.light },
          ],
        })
      } else if (code && code.startsWith('el')) {
        localStorage.setItem('language', 'el')
        updateState({
          language: 'el',
          strings: el,
          themes: [
            { value: 'dark', label: el.dark },
            { value: 'light', label: el.light },
          ],
        })
      } else {
        localStorage.removeItem('language')
        var browser = navigator.language
        if (browser && browser.startsWith('fr')) {
          updateState({
            language: 'fr',
            strings: fr,
            themes: [
              { value: 'dark', label: fr.dark },
              { value: 'light', label: fr.light },
            ],
          })
        } else if (browser && browser.startsWith('sp')) {
          updateState({
            language: 'sp',
            strings: sp,
            themes: [
              { value: 'dark', label: sp.dark },
              { value: 'light', label: sp.light },
            ],
          })
        } else if (browser && browser.startsWith('pt')) {
          updateState({
            language: 'pt',
            strings: pt,
            themes: [
              { value: 'dark', label: pt.dark },
              { value: 'light', label: pt.light },
            ],
          })
        } else if (browser && browser.startsWith('de')) {
          updateState({
            language: 'de',
            strings: de,
            themes: [
              { value: 'dark', label: de.dark },
              { value: 'light', label: de.light },
            ],
          })
        } else if (browser && browser.startsWith('ru')) {
          updateState({
            language: 'ru',
            strings: ru,
            themes: [
              { value: 'dark', label: ru.dark },
              { value: 'light', label: ru.light },
            ],
          })
        } else if (browser && browser.startsWith('el')) {
          updateState({
            language: 'el',
            strings: el,
            themes: [
              { value: 'dark', label: el.dark },
              { value: 'light', label: el.light },
            ],
          })
        } else {
          updateState({
            language: 'en',
            strings: en,
            themes: [
              { value: 'dark', label: en.dark },
              { value: 'light', label: en.light },
            ],
          })
        }
      }
    },
    setDateFormat: (dateFormat: string) => {
      localStorage.setItem('date_format', dateFormat)
      updateState({ dateFormat })
    },
    setTimeFormat: (timeFormat: string) => {
      localStorage.setItem('time_format', timeFormat)
      updateState({ timeFormat })
    },
    setAudioInput: (audioId: string | null) => {
      if (audioId == null) {
        localStorage.removeItem('audio_input')
      } else {
        localStorage.setItem('audio_input', audioId)
      }
      updateState({ audioId })
    },
    setVideoInput: (videoId: string | null) => {
      if (videoId == null) {
        localStorage.removeItem('video_input')
      } else {
        localStorage.setItem('video_input', videoId)
      }
      updateState({ videoId })
    },
  }

  return { state, actions }
}
