import { useState, useEffect } from 'react'

export function useImageFile(source: File) {
  let [state, setState] = useState({
    thumbUrl: null,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let thumbUrl = URL.createObjectURL(source)
    updateState({ thumbUrl })
    return () => {
      URL.revokeObjectURL(thumbUrl)
    }
  }, [source])

  let actions = {}

  return { state, actions }
}
