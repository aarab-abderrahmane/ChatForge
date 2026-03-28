# Customization

The Settings Panel is designed to turn ChatForge into your perfect developer workspace.

![Settings Panel](file:///C:/Users/crafe/Desktop/pro/ChatForge/docs/images/chatforge_settings_panel_1774709506405.png)

## Appearance & Layout

Click the glowing **Gear Icon** (`⚙️`) in the top right to open the Settings Panel. All configurations save immediately to your local storage.

### Theme Engine
Choose between several pre-configured cyberpunk themes, or go completely custom! By selecting the **Custom** option, three color pickers will reveal:
- **Primary Color**: Defines the primary glowing UI elements (e.g. your active input, buttons).
- **Secondary Color**: Subtler UI boundaries and borders.
- **Accent Color**: Critical action indicators like errors or delete prompts.

### Fonts
Instantly toggle between distinct terminal monospaced fonts (`JetBrains Mono`, `Cascadia Code`, and `Fira Code`). Use the interactive slider to determine exactly how large your workspace text needs to be.

## AI Preferences & Models

ChatForge uses an incredibly robust AI state model.

### Context Prefix
A multi-line text area that allows you to force instructions into the start of *every* system prompt that goes to the AI.
Example: *“I am a senior Python engineer. Do not explain basics, only produce highly optimized code.”*

### Custom Skills & Personas
Want ChatForge to act like a specific agent? Click **Create Custom Skill**:
1. Name your agent.
2. Give them an Icon.
3. Write a deep System Prompt.

They are immediately available in the `//>skill` context menu.

### OpenRouter Intelligence
Select the exact foundational model you want to power the backend. Note that ChatForge dynamically detects when free models are at capacity and triggers intelligent fallbacks, ensuring you always receive an answer!
