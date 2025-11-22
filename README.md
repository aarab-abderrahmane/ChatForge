# 🚀 ChatForge Terminal

<div align="center">

![ChatForge Banner](https://img.shields.io/badge/ChatForge-AI%20Terminal-39ff14?style=for-the-badge&logo=terminal&logoColor=white)

**A retro-inspired terminal interface for AI conversations**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-43853d.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://reactjs.org/)

[Demo](#-demo) • [Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Tech Stack](#-tech-stack)

</div>

---

## 📖 About

ChatForge is a sleek, terminal-inspired AI chat interface that brings the nostalgia of classic computing to modern AI conversations. Built with a focus on aesthetics and user experience, it features a beautiful retro green terminal theme with scan lines, neon glow effects, and smooth animations.

## ✨ Features

### 🎨 **Terminal Aesthetics**
- Retro CRT monitor effects with scan lines
- Neon green text with customizable glow
- Smooth typing animations
- Classic terminal command interface

### 🤖 **AI-Powered Conversations**
- Integration with OpenRouter API
- Context-aware responses with chat history
- Real-time streaming responses
- Markdown rendering with syntax highlighting

### 🔐 **Secure & Private**
- Encrypted API key storage in MongoDB
- User-specific sessions with UUID
- Secure key validation system
- No client-side key exposure

### 💻 **Developer-Friendly**
- Clean, modular codebase
- React 19 with hooks
- Express.js backend
- MongoDB Atlas integration
- Responsive design for all devices

### 🎯 **User Experience**
- Multi-step loader with progress indicators
- Copy-to-clipboard functionality
- Command palette (coming soon)
- Smooth scrolling and animations
- Error handling with helpful messages

## 🎥 Demo

```
root@chatforge-terminal:~# ./start_chatforge.sh
[✓] Verifying ChatForge environment
[✓] Loading AI modules...
[✓] System ready for authentication
```

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Motion** - Animations
- **React Markdown** - Markdown rendering
- **Shiki** - Syntax highlighting
- **GSAP** - Advanced animations

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB Atlas** - Database
- **OpenRouter API** - AI model access

### Key Libraries
- `react-syntax-highlighter` - Code blocks
- `rehype-katex` - Math rendering
- `remark-gfm` - GitHub Flavored Markdown
- `lucide-react` - Icons

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account
- OpenRouter API account

### Clone the Repository
```bash
git clone https://github.com/yourusername/chatforge.git
cd chatforge
```

### Backend Setup
```bash
cd backend
npm install

# Create .env file
touch .env
```

Add to `.env`:
```env
USER_NAME_MONGO=your_mongodb_username
DB_PASSWORD=your_mongodb_password
CLUSTER=your_cluster_url
APP_NAME=ChatForge
```

### Frontend Setup
```bash
cd ../frontend
npm install
```

### Start Development Servers

**Backend:**
```bash
cd backend
npm run server
```

**Frontend:**
```bash
cd frontend
npm run chatforge
```

## 🚀 Usage

### 1. **Initial Setup**
- Visit the application
- You'll see the guide page requesting an OpenRouter API key
- Create your free API key at [OpenRouter](https://openrouter.ai)

### 2. **Authenticate**
```
→ Please create your key at https://openrouter.ai
→ Copy it here to enable full access
[paste your API key and press Enter]
```

### 3. **Start Chatting**
Once authenticated, you can:
- Ask questions naturally
- View formatted responses with syntax highlighting
- Copy code snippets with one click
- Review conversation history

### 4. **Example Conversations**
```
> Who is the author of this website?
Abderrahmane Aarab

> How can I generate a short summary of my chat history?
Simply type your question and the AI will summarize the previous messages.
```

## 🏗️ Project Structure

```
chatforge/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── features/
│   │   │   │   └── Terminal.jsx
│   │   │   └── ui/
│   │   │       ├── button.jsx
│   │   │       ├── multi-step-loader.jsx
│   │   │       └── shadcn-io/
│   │   │           └── ai/
│   │   ├── context/
│   │   │   └── chatsContext.jsx
│   │   ├── pages/
│   │   │   └── guidePage.jsx
│   │   ├── services/
│   │   │   └── api.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── package.json
│
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── vercel.json
│
└── README.md
```

## 🔑 Environment Variables

### Backend (.env)
```env
USER_NAME_MONGO=your_mongodb_username
DB_PASSWORD=your_mongodb_password
CLUSTER=your_cluster_name
APP_NAME=ChatForge
```

## 🌐 API Endpoints

### POST `/api/chat`
Send a message to the AI
```json
{
  "question": "Your question here",
  "history": "Previous conversation context",
  "userId": "user-uuid"
}
```

### POST `/api/test`
Validate an API key
```json
{
  "APIkey": "your-openrouter-key",
  "userId": "user-uuid"
}
```

### POST `/api/key-exists`
Check if user has a stored key
```json
{
  "userId": "user-uuid"
}
```

## 🎨 Customization

### Changing Colors
Edit `frontend/src/index.css`:
```css
body {
  background: #0a0a0a;
  color: #39ff14; /* Change this for different neon colors */
}
```

### Modifying AI Model
Edit `backend/server.js`:
```javascript
model: "openai/gpt-oss-20b:free", // Change to your preferred model
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Abderrahmane Aarab**

- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai) for AI API access
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Vercel](https://vercel.com) for AI components inspiration
- The open-source community

## 📊 Roadmap

- [ ] Add command palette with shortcuts
- [ ] Implement chat history export
- [ ] Add multiple AI model selection
- [ ] Create user preferences panel
- [ ] Add voice input support
- [ ] Implement collaborative chats
- [ ] Add plugin system

## 🐛 Known Issues

- Maximum token limit may be reached with very long conversations
- Some markdown tables may not render perfectly on mobile

## 💬 Support

If you have any questions or need help, please:
- Open an [issue](https://github.com/yourusername/chatforge/issues)
- Start a [discussion](https://github.com/yourusername/chatforge/discussions)

---

<div align="center">

**Made with 💚 and retro vibes**

⭐ Star this repo if you find it helpful!

</div>
