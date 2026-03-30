import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import { ChatsProvider } from './context/chatsContext.jsx'
import { WorkspaceProvider } from './context/workspaceContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatsProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </ChatsProvider>
  </StrictMode>,
)
