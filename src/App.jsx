import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  useEffect(() => {
    const blockEvent = (e) => {
      if (e.target.closest('#root')) {
        e.stopPropagation()
      }
    }

    document.addEventListener('mousedown', blockEvent, true)
    document.addEventListener('mouseup', blockEvent, true)
    document.addEventListener('click', blockEvent, true)
    document.addEventListener('dblclick', blockEvent, true)
    document.addEventListener('keydown', blockEvent, true)
    document.addEventListener('keyup', blockEvent, true)
    document.addEventListener('focus', blockEvent, true)
    document.addEventListener('blur', blockEvent, true)

    return () => {
      document.removeEventListener('mousedown', blockEvent, true)
      document.removeEventListener('mouseup', blockEvent, true)
      document.removeEventListener('click', blockEvent, true)
      document.removeEventListener('dblclick', blockEvent, true)
      document.removeEventListener('keydown', blockEvent, true)
      document.removeEventListener('keyup', blockEvent, true)
      document.removeEventListener('focus', blockEvent, true)
      document.removeEventListener('blur', blockEvent, true)
    }
  }, [])

  const stopAllEvents = (e) => {
    e.stopPropagation()
  }

  const blockEditorShortcuts = (e) => {
    const isMod = e.metaKey || e.ctrlKey

    if (isMod && (e.key === '\\' || e.key === 'b' || e.key === 'k')) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isMod && e.shiftKey && e.key === 'e') {
      e.preventDefault()
      e.stopPropagation()
    }

    e.stopPropagation()
  }

  return (
    <div
      onMouseDown={stopAllEvents}
      onMouseUp={stopAllEvents}
      onClick={stopAllEvents}
      onClickCapture={stopAllEvents}
      onDoubleClick={stopAllEvents}
      onKeyDown={blockEditorShortcuts}
      onKeyDownCapture={blockEditorShortcuts}
      onKeyUp={stopAllEvents}
      onFocus={stopAllEvents}
      onBlur={stopAllEvents}
      onPointerDown={stopAllEvents}
      onPointerUp={stopAllEvents}
    >
      <QueryClientProvider client={queryClient}>
        <Pages />
        <Toaster />
      </QueryClientProvider>
    </div>
  )
}

export default App 