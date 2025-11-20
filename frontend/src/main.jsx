import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import {ChatsProvider} from './context/chatsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatsProvider>
        <App />

    </ChatsProvider>
  </StrictMode>,
)
