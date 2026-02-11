# AI Grader - Instructure Grading Interface

A React-based grading interface for educational institutions, built with TypeScript and Vite.

## Features

- Interactive grading interface with rubric-based scoring
- Real-time text highlighting for rubric criteria
- Student navigation with keyboard shortcuts
- Auto-save functionality
- Responsive design with collapsible sidebar

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   └── GradingPage.tsx # Main grading interface
├── hooks/              # Custom React hooks
├── models/             # Data models and types
├── services/           # API services
├── assets/             # Static assets (SVGs, images)
└── styles/             # CSS files
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible UI components
- **Lucide React** - Icons

## Keyboard Shortcuts

- `Ctrl/Cmd + ←/→` - Navigate between students
- `Ctrl/Cmd + S` - Save grades
- `1-3` - Highlight rubric sections