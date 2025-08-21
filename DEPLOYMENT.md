# HamView Deployment Guide

## GitHub Pages Setup

### 1. Repository Settings
1. Go to your GitHub repository settings
2. Navigate to "Pages" section
3. Set Source to "GitHub Actions"
4. Ensure custom domain is set to `hamview.com`

### 2. DNS Configuration
Make sure your DNS provider has these records:
```
CNAME hamview.com -> yourusername.github.io
```

### 3. Deployment Workflow
The `.github/workflows/deploy.yml` file is configured to:
- Trigger on pushes to `main` branch
- Build the Astro site
- Deploy to GitHub Pages
- Use the custom domain `hamview.com`

### 4. Troubleshooting
If deployment fails:
1. Check GitHub Actions tab for error logs
2. Verify GitHub Pages is enabled in repository settings
3. Ensure CNAME file exists in `public/` directory
4. Check that `astro.config.mjs` has correct site URL

### 5. Manual Deployment
To manually trigger deployment:
1. Go to Actions tab in GitHub
2. Select "Deploy HamView to GitHub Pages"
3. Click "Run workflow"

## Build Commands
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run dev` - Development server

## Domain Configuration
- Site URL: `https://hamview.com`
- CNAME: `hamview.com`
- GitHub Pages source: GitHub Actions
