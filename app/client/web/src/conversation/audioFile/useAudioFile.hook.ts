import { useState, useEffect } from 'react'

export function useAudioFile(source: File) {
  let [state, setState] = useState({
    label: '',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let label = source.name.split('.').shift()
    updateState({ label })
  }, [source])

  let actions = {
    setLabel: (label: string) => {
      updateState({ label })
    },
  }

  return { state, actions }
}
