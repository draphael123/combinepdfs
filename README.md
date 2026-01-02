# PDF Merger

A modern web application for merging multiple PDF files into a single document. Built with Next.js and deployed on Vercel.

## Features

- 📄 Merge multiple PDF files into one
- 🔄 Reorder PDFs before merging
- 🎨 Modern, responsive UI with dark mode support
- 🔒 Privacy-first: All processing happens in your browser
- ⚡ Fast and efficient PDF merging using pdf-lib

## Getting Started

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment on Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import your project on [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and configure the build settings
4. Deploy!

Alternatively, you can use the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## How to Use

1. Click the upload area or drag and drop PDF files
2. Select multiple PDF files you want to merge
3. Reorder files using the up/down arrows if needed
4. Click "Merge PDFs" to combine all files
5. The merged PDF will automatically download

## Technology Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **pdf-lib** - PDF manipulation library

## License

MIT

