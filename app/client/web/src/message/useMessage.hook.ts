import { useState, useContext, useEffect } from 'react'
import { DisplayContext } from '../context/DisplayContext'
import { AppContext } from '../context/AppContext'
import { ContextType } from '../context/ContextType'

export function useMessage() {
  let app = useContext(AppContext) as ContextType
  let display = useContext(DisplayContext) as ContextType
  let [state, setState] = useState({
    strings: display.state.strings,
    timeFormat: display.state.timeFormat,
    dateFormat: display.state.dateFormat,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let { strings, timeFormat, dateFormat } = display.state
    updateState({ strings, timeFormat, dateFormat })
  }, [display.state])

  let actions = {
    block: async (topicId: string) => {
      let focus = app.state.focus
      if (focus) {
        await focus.setBlockTopic(topicId)
      }
    },
    flag: async (topicId: string) => {
      let focus = app.state.focus
      if (focus) {
        await focus.flagTopic(topicId)
      }
    },
    remove: async (topicId: string) => {
      let focus = app.state.focus
      if (focus) {
        await focus.removeTopic(topicId)
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveSubject: async (topicId: string, sealed: boolean, subject: any) => {
      let focus = app.state.focus
      if (focus) {
        await focus.setTopicSubject(
          topicId,
          sealed ? 'sealedtopic' : 'superbasictopic',
          () => subject,
          [],
          () => true
        )
      }
    },
    getTimestamp: (created: number) => {
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
    },
  }

  return { state, actions }
}
