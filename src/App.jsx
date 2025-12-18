import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/sonner"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DropdownProvider } from '@/contexts/DropdownContext'
import { AuthProvider } from '@/contexts/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DropdownProvider>
          <Pages />
          <Toaster />
        </DropdownProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App 