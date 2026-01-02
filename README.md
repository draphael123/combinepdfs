# Fountain: File Merger

A modern, free, and privacy-focused web application for merging multiple files (PDF, CSV, Word documents, and images) into a single document. Built with Next.js and deployed on Vercel.

🌐 **Live Demo**: [View on Vercel](https://your-vercel-url.vercel.app) (Update this with your actual Vercel URL)

## Features

- 📄 Merge multiple PDF files into one
- 📊 Merge CSV files with header preservation
- 📝 Merge Word documents (.docx, .doc)
- 🖼️ Merge JPG/JPEG images (converted to PDF)
- 🔄 Reorder files before merging
- 🎨 Modern, responsive UI with dark mode support
- 🔒 Privacy-first: All processing happens in your browser
- ⚡ Fast and efficient file merging

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

1. Click the upload area or drag and drop files (PDF, CSV, Word, or images)
2. Select multiple files of the same type you want to merge
3. Reorder files using the up/down arrows if needed
4. Click "Merge Files" to combine all files
5. The merged file will automatically download

## Technology Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **pdf-lib** - PDF manipulation library
- **papaparse** - CSV parsing and merging
- **docx** - Word document creation
- **mammoth** - Word document reading

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/draphael123/combinepdfs/issues).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Privacy

All file processing happens entirely in your browser. Your files never leave your device and are never uploaded to any server. This ensures complete privacy and security for your documents.

