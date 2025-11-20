import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import {ChatsProvider} from './chatsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatsProvider>
        <App />

    </ChatsProvider>
  </StrictMode>,
)
