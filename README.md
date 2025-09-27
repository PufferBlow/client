# Pufferblow UI

A modern, decentralized messaging platform built with React Router v7, featuring Discord-like functionality with enhanced privacy and security.

## Features

- 🎨 **Modern UI**: Discord-inspired interface with dark theme
- 🔐 **Secure Authentication**: Cookie-based authentication with server-side rendering support
- 🌐 **Decentralized**: Built for distributed messaging networks
- 📱 **Responsive**: Works seamlessly on desktop and mobile
- ⚡ **Fast**: Optimized with Vite and React Router v7
- 🧪 **Well Tested**: Comprehensive test suite with Vitest
- 🚀 **Deploy Ready**: Automated deployment to GitHub Pages

## Tech Stack

- **Frontend**: React 19, React Router v7, TypeScript
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Testing**: Vitest, Testing Library
- **Deployment**: GitHub Pages with GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pufferblow-client.git
cd pufferblow-client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
pufferblow-client/
├── app/
│   ├── components/          # Reusable UI components
│   ├── models/             # TypeScript data models
│   ├── routes/             # Route components and actions
│   ├── services/           # API service functions
│   ├── test/               # Test utilities
│   └── utils/              # Utility functions
├── .github/
│   └── workflows/          # GitHub Actions workflows
├── public/                 # Static assets
└── build/                  # Build output (generated)
```

## Deployment

### GitHub Pages

The project includes automated deployment to GitHub Pages:

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Select "GitHub Actions" as source

2. **Push to main branch**:
   - The workflow will automatically build and deploy
   - Your site will be available at `https://yourusername.github.io/repository-name`

### Manual Deployment

To deploy manually:

```bash
# Build the application
npm run build

# Preview locally
npm run preview

# Deploy the build/client folder to your hosting service
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Add your environment variables here
# Example:
# VITE_API_BASE_URL=https://api.example.com
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm run test:run

# Run tests with coverage
npm run test:run -- --coverage

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
