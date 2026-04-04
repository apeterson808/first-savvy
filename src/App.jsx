import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/sonner"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'
import { DropdownProvider } from '@/contexts/DropdownContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProfileProvider } from '@/contexts/ProfileContext'

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
      <Router>
        <AuthProvider>
          <ProfileProvider>
            <DropdownProvider>
              <Pages />
              <Toaster />
            </DropdownProvider>
          </ProfileProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App 