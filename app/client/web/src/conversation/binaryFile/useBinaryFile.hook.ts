import { useState, useEffect } from 'react'

export function useBinaryFile(source: File) {
  let [state, setState] = useState({
    name: '',
    extension: '',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let name = source.name.split('.').shift()
    let extension = source.name.split('.').pop()
    updateState({ name, extension })
  }, [source])

  let actions = {}

  return { state, actions }
}
