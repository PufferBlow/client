# Deployment Guide

This guide explains how to deploy Pufferblow UI to GitHub Pages using GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **GitHub Pages Enabled**: Pages must be enabled for your repository
3. **Main Branch**: Deployment happens from the `main` branch

## Setup Steps

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **GitHub Actions**
5. Click **Save**

### 2. Repository Settings

Make sure your repository allows GitHub Actions to deploy:

1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**

### 3. Environment Variables (Optional)

If your application needs environment variables:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add any required environment variables (e.g., `VITE_API_BASE_URL`)

## Deployment Workflow

The deployment is fully automated via `.github/workflows/deploy.yml`:

### What the workflow does:

1. **Triggers**: On push/PR to `main` branch
2. **Build Job**:
   - Checks out code
   - Sets up Node.js 20
   - Installs dependencies
   - Runs tests
   - Builds the application
   - Uploads build artifacts

3. **Deploy Job**:
   - Downloads build artifacts
   - Deploys to GitHub Pages
   - Provides deployment URL

### Workflow Permissions

The workflow requires these permissions:
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

## Manual Deployment

If you need to deploy manually:

```bash
# Install dependencies
npm ci

# Run tests
npm run test:run

# Build the application
npm run build

# Preview locally
npm run preview

# The build/client folder contains the deployable files
```

## Custom Domain (Optional)

To use a custom domain:

1. Go to **Settings** → **Pages**
2. Under **Custom domain**, enter your domain
3. Configure DNS records as instructed
4. Add a `CNAME` file to your repository root with your domain

## Troubleshooting

### Build Failures

- Check that all dependencies are properly listed in `package.json`
- Ensure Node.js version matches (currently set to 20)
- Verify that tests pass locally with `npm run test:run`

### Deployment Issues

- Check GitHub Actions logs for detailed error messages
- Ensure GitHub Pages is enabled and set to "GitHub Actions"
- Verify repository permissions allow Actions deployment

### SPA Routing Issues

GitHub Pages serves static files. For client-side routing to work:

- The workflow deploys the `build/client` folder
- React Router handles routing client-side
- 404 errors on direct navigation are handled by React Router

## Environment Variables

For production environment variables:

```bash
# Create .env.production file
VITE_API_BASE_URL=https://your-api-domain.com
VITE_APP_VERSION=1.0.0
```

These will be available in your deployed application as `import.meta.env.VITE_*`.

## Monitoring Deployments

- Go to **Actions** tab in your repository
- Click on the latest workflow run
- Check build and deployment logs
- View deployment status and URL

## Rollback

To rollback to a previous deployment:

1. Go to **Settings** → **Pages**
2. Find the deployment history
3. Click **Rollback** on the desired deployment

## Security Considerations

- Never commit sensitive data (API keys, secrets) to the repository
- Use GitHub Secrets for sensitive environment variables
- The workflow only runs on the `main` branch for security
- Review the workflow file before enabling it on your repository
