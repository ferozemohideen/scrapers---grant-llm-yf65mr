# Technology Transfer Web Frontend

A modern, accessible, and performant web application for the Technology Transfer Data Aggregation and Grant-Writing Assistance System. This React-based frontend provides centralized access to research commercialization opportunities across 375+ global institutions with integrated AI-powered grant writing assistance.

## 🚀 Key Features

- Unified technology transfer opportunity search
- AI-powered grant writing assistance
- Real-time collaboration tools
- Responsive, mobile-first design
- WCAG 2.1 AA compliant accessibility
- Multi-language support
- Advanced data visualization

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### Recommended IDE Setup

- VSCode with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Jest
  - vscode-styled-components

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env.local
```

4. Configure environment variables:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GA_TRACKING_ID=<your-ga4-id>
VITE_SENTRY_DSN=<your-sentry-dsn>
```

## 💻 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Create optimized production build
- `npm run test` - Run test suite with coverage
- `npm run lint` - Run ESLint with TypeScript rules
- `npm run format` - Run Prettier code formatter
- `npm run typecheck` - Run TypeScript type checking
- `npm run e2e` - Run end-to-end tests
- `npm run analyze` - Analyze bundle size
- `npm run storybook` - Launch component documentation

### Technology Stack

- **Framework**: React 18.2.0
- **Language**: TypeScript 5.0.0
- **Bundler**: Vite 4.4.0
- **Testing**: Jest 29.0.0 + React Testing Library 14.0.0
- **Styling**: CSS Modules + CSS Variables
- **State Management**: Redux Toolkit 1.9.0
- **Routing**: React Router 6.8.0
- **UI**: Custom component library
- **Documentation**: Storybook 7.0.0
- **Analytics**: Google Analytics 4
- **Monitoring**: Sentry

## 🏗️ Architecture

### Component Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── features/        # Feature-based modules
├── hooks/          # Custom React hooks
├── layouts/        # Page layouts
├── lib/            # Utility functions
├── pages/          # Route pages
├── services/       # API services
├── store/          # Redux store configuration
├── styles/         # Global styles
└── types/          # TypeScript definitions
```

### State Management

- Redux Toolkit for global state
- React Query for server state
- Context API for component state
- Local storage for persistence

## ♿ Accessibility

### Standards Compliance

- WCAG 2.1 Level AA conformance
- WAI-ARIA patterns implementation
- Keyboard navigation support
- Screen reader optimization
- Color contrast requirements
- Focus management

### Testing Tools

- axe-core for automated testing
- VoiceOver and NVDA testing
- Keyboard navigation testing
- Color contrast analyzers

## 📱 Responsive Design

### Breakpoint System

```scss
$breakpoints: (
  'mobile': 320px,
  'tablet': 768px,
  'desktop': 1024px,
  'wide': 1440px
);
```

### Mobile-First Approach

- Fluid typography scaling
- Responsive images and media
- Touch-friendly interactions
- Progressive enhancement

## 🧪 Testing

### Test Types

- Unit tests with Jest and RTL
- Integration tests for features
- E2E tests with Cypress
- Visual regression tests
- Accessibility testing
- Performance testing

### Coverage Requirements

- Minimum 80% code coverage
- Critical path testing
- Error boundary testing
- Edge case scenarios

## 🔒 Security

- Input validation and sanitization
- XSS prevention
- CSRF protection
- Secure authentication
- API request encryption
- Content Security Policy

## ⚡ Performance

### Optimization Techniques

- Code splitting
- Lazy loading
- Image optimization
- Bundle size monitoring
- Caching strategies
- Performance budgets

### Monitoring

- Core Web Vitals tracking
- Real User Monitoring (RUM)
- Error tracking with Sentry
- Performance metrics logging

## 📦 Building

### Production Build

```bash
npm run build
```

Build output will be generated in the `dist` directory with the following optimizations:

- Minification and compression
- Tree shaking
- Asset optimization
- Source maps generation
- Chunk splitting

## 🚀 Deployment

### Deployment Process

1. Run quality checks:
```bash
npm run typecheck && npm run test && npm run lint
```

2. Create production build:
```bash
npm run build
```

3. Deploy to staging/production:
```bash
npm run deploy:<environment>
```

### Environment Configuration

- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

### Pull Request Requirements

- Passes all tests
- Meets code coverage requirements
- Follows coding standards
- Includes documentation updates
- Has been reviewed by peers

## 🔧 Troubleshooting

### Common Issues

1. Installation Problems
   - Clear npm cache
   - Delete node_modules
   - Reinstall dependencies

2. Build Failures
   - Check Node.js version
   - Verify environment variables
   - Review build logs

3. Testing Issues
   - Update test snapshots
   - Clear Jest cache
   - Check test environment

### Support Resources

- Project documentation
- GitHub Issues
- Team chat channels
- Technical leads contact

## 📚 Additional Resources

- [Component Documentation](./docs/components)
- [API Documentation](./docs/api)
- [Architecture Guide](./docs/architecture)
- [Style Guide](./docs/style-guide)
- [Testing Guide](./docs/testing)
- [Deployment Guide](./docs/deployment)

## 📄 License

[MIT License](./LICENSE)