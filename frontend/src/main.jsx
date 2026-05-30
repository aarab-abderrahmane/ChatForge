import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import { ChatsProvider } from './context/chatsContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ChatsProvider>
        <App />
      </ChatsProvider>
    </ErrorBoundary>
  </StrictMode>,
)
