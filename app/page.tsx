'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import Papa from 'papaparse'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import mammoth from 'mammoth'

type FileType = 'pdf' | 'csv' | 'docx' | 'doc'

interface FileWithMetadata extends File {
  fileType?: FileType
  pageCount?: number
  rowCount?: number
}

export default function Home() {
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 })
  const [outputFilename, setOutputFilename] = useState('merged')
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Detect file type
  const getFileType = (file: File): FileType | null => {
    const name = file.name.toLowerCase()
    const type = file.type.toLowerCase()
    
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
    if (type === 'text/csv' || type === 'application/vnd.ms-excel' || name.endsWith('.csv')) return 'csv'
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx'
    if (type === 'application/msword' || name.endsWith('.doc')) return 'doc'
    return null
  }

  // Get default extension based on file type
  const getDefaultExtension = (fileType: FileType): string => {
    switch (fileType) {
      case 'pdf': return '.pdf'
      case 'csv': return '.csv'
      case 'docx': return '.docx'
      case 'doc': return '.doc'
    }
  }

  // Load files from localStorage on mount
  useEffect(() => {
    const savedFilename = localStorage.getItem('pdfMergerFilename')
    if (savedFilename) {
      setOutputFilename(savedFilename)
    }
  }, [])

  // Save output filename to localStorage
  useEffect(() => {
    localStorage.setItem('pdfMergerFilename', outputFilename)
  }, [outputFilename])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file type icon
  const getFileTypeIcon = (fileType: FileType) => {
    switch (fileType) {
      case 'pdf':
        return '📄'
      case 'csv':
        return '📊'
      case 'docx':
      case 'doc':
        return '📝'
    }
  }

  // Get file type color
  const getFileTypeColor = (fileType: FileType) => {
    switch (fileType) {
      case 'pdf':
        return 'from-red-500 to-pink-500'
      case 'csv':
        return 'from-green-500 to-emerald-500'
      case 'docx':
      case 'doc':
        return 'from-blue-500 to-cyan-500'
    }
  }

  // Validate and add files
  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: FileWithMetadata[] = []
    const invalidFiles: string[] = []

    for (const file of newFiles) {
      const fileType = getFileType(file)
      if (!fileType) {
        invalidFiles.push(file.name)
        continue
      }

      const fileWithType = Object.assign(file, { fileType }) as FileWithMetadata
      validFiles.push(fileWithType)
    }

    if (invalidFiles.length > 0) {
      setError(`Some files are not supported. Supported formats: PDF, CSV, DOCX, DOC. Invalid files: ${invalidFiles.join(', ')}`)
    }

    // Check if all files are the same type
    if (validFiles.length > 0) {
      const firstType = validFiles[0].fileType
      const allSameType = validFiles.every(f => f.fileType === firstType)
      
      if (!allSameType && files.length > 0) {
        const existingType = files[0].fileType
        if (existingType !== firstType) {
          setError(`Please select files of the same type. Current files are ${existingType?.toUpperCase()}, but you're adding ${firstType?.toUpperCase()} files.`)
          return
        }
      }

      // Validate files based on type
      Promise.all(
        validFiles.map(async (file) => {
          try {
            if (file.fileType === 'pdf') {
              const fileBytes = await file.arrayBuffer()
              const pdf = await PDFDocument.load(fileBytes)
              const pageCount = pdf.getPageCount()
              return Object.assign(file, { pageCount }) as FileWithMetadata
            } else if (file.fileType === 'csv') {
              const text = await file.text()
              const result = Papa.parse(text, { header: false, skipEmptyLines: true })
              const rowCount = result.data.length
              return Object.assign(file, { rowCount }) as FileWithMetadata
            } else if (file.fileType === 'docx') {
              // Validate DOCX by trying to read it
              const arrayBuffer = await file.arrayBuffer()
              await mammoth.extractRawText({ arrayBuffer })
              return file
            } else {
              // DOC files - just accept them
              return file
            }
          } catch (err) {
            setError(`"${file.name}" is not a valid ${file.fileType?.toUpperCase()} file or is corrupted.`)
            return null
          }
        })
      ).then((validatedFiles) => {
        const valid = validatedFiles.filter((f): f is FileWithMetadata => f !== null)
        if (valid.length > 0) {
          setFiles(prev => {
            const combined = [...prev, ...valid]
            const totalSize = combined.reduce((sum, f) => sum + f.size, 0)
            const maxSize = 500 * 1024 * 1024
            if (totalSize > maxSize) {
              setError(`Total file size exceeds 500MB limit. Please select smaller files.`)
              return prev
            }
            return combined
          })
          if (valid.length > 0 && invalidFiles.length === 0) {
            setError(null)
          }
        }
      })
    }
  }, [files])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    addFiles(selectedFiles)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [addFiles])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setSelectedFileIndex(null)
  }

  const clearAllFiles = () => {
    setFiles([])
    setSelectedFileIndex(null)
    setError(null)
    setSuccess(null)
  }

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === files.length - 1) return
    const newFiles = [...files]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]]
    setFiles(newFiles)
    setSelectedFileIndex(targetIndex)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFileIndex === null) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault()
          removeFile(selectedFileIndex)
          if (selectedFileIndex > 0) {
            setSelectedFileIndex(selectedFileIndex - 1)
          } else if (files.length > 1) {
            setSelectedFileIndex(0)
          } else {
            setSelectedFileIndex(null)
          }
        }
      } else if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault()
        moveFile(selectedFileIndex, 'up')
      } else if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault()
        moveFile(selectedFileIndex, 'down')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFileIndex, files])

  // Merge PDFs
  const mergePDFs = async (filesToMerge: FileWithMetadata[]) => {
    const mergedPdf = await PDFDocument.create()
    for (let i = 0; i < filesToMerge.length; i++) {
      setMergeProgress({ current: i + 1, total: filesToMerge.length })
      const file = filesToMerge[i]
      const fileBytes = await file.arrayBuffer()
      const pdf = await PDFDocument.load(fileBytes)
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      pages.forEach((page) => {
        mergedPdf.addPage(page)
      })
    }
    return await mergedPdf.save()
  }

  // Merge CSV files
  const mergeCSVs = async (filesToMerge: FileWithMetadata[]): Promise<string> => {
    const allRows: string[][] = []
    let headers: string[] | null = null

    for (let i = 0; i < filesToMerge.length; i++) {
      setMergeProgress({ current: i + 1, total: filesToMerge.length })
      const file = filesToMerge[i]
      const text = await file.text()
      const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true })
      
      if (result.data.length > 0) {
        if (i === 0) {
          headers = result.data[0]
          allRows.push(...result.data)
        } else {
          // Skip header row for subsequent files
          const dataRows = result.data.slice(1)
          allRows.push(...dataRows)
        }
      }
    }

    // Ensure headers are included
    if (headers && allRows.length > 0 && JSON.stringify(allRows[0]) !== JSON.stringify(headers)) {
      allRows.unshift(headers)
    }

    return Papa.unparse(allRows)
  }

  // Merge Word documents
  const mergeWordDocs = async (filesToMerge: FileWithMetadata[]): Promise<Uint8Array> => {
    const paragraphs: Paragraph[] = []

    for (let i = 0; i < filesToMerge.length; i++) {
      setMergeProgress({ current: i + 1, total: filesToMerge.length })
      const file = filesToMerge[i]
      const arrayBuffer = await file.arrayBuffer()

      if (file.fileType === 'docx') {
        const result = await mammoth.extractRawText({ arrayBuffer })
        const text = result.value
        
        // Split text into paragraphs
        const lines = text.split('\n').filter(line => line.trim())
        lines.forEach((line, idx) => {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun(line)],
              spacing: { after: idx === lines.length - 1 ? 400 : 200 }
            })
          )
        })

        // Add page break between documents (except last)
        if (i < filesToMerge.length - 1) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun('')],
              pageBreakBefore: true
            })
          )
        }
      } else {
        // For .doc files, we can't easily parse them, so skip
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(`[Note: ${file.name} could not be processed - .doc format requires conversion to .docx]`)],
            spacing: { after: 400 }
          })
        )
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    })

    return await Packer.toBlob(doc).then(blob => blob.arrayBuffer()).then(buffer => new Uint8Array(buffer))
  }

  // Main merge function
  const mergeFiles = async () => {
    if (files.length < 2) {
      setError('Please select at least 2 files to merge')
      return
    }

    // Check all files are same type
    const firstType = files[0].fileType
    if (!files.every(f => f.fileType === firstType)) {
      setError('All files must be of the same type to merge. Please select files of the same format.')
      return
    }

    setIsMerging(true)
    setError(null)
    setSuccess(null)
    setMergeProgress({ current: 0, total: files.length })

    try {
      let blob: Blob
      let filename: string
      const fileType = firstType!

      if (fileType === 'pdf') {
        const mergedBytes = await mergePDFs(files)
        const arrayBuffer = new ArrayBuffer(mergedBytes.length)
        new Uint8Array(arrayBuffer).set(mergedBytes)
        blob = new Blob([arrayBuffer], { type: 'application/pdf' })
        filename = outputFilename.endsWith('.pdf') ? outputFilename : `${outputFilename}.pdf`
      } else if (fileType === 'csv') {
        const mergedCsv = await mergeCSVs(files)
        blob = new Blob([mergedCsv], { type: 'text/csv' })
        filename = outputFilename.endsWith('.csv') ? outputFilename : `${outputFilename}.csv`
      } else if (fileType === 'docx' || fileType === 'doc') {
        const mergedBytes = await mergeWordDocs(files)
        blob = new Blob([mergedBytes], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        })
        filename = outputFilename.endsWith('.docx') ? outputFilename : `${outputFilename}.docx`
      } else {
        throw new Error('Unsupported file type')
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess(`Successfully merged ${files.length} ${fileType.toUpperCase()} files!`)
      setError(null)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      let errorMessage = `Failed to merge ${firstType?.toUpperCase()} files. `
      if (err instanceof Error) {
        errorMessage += err.message
      } else {
        errorMessage += 'Please ensure all files are valid.'
      }
      setError(errorMessage)
      console.error('Error merging files:', err)
    } finally {
      setIsMerging(false)
      setMergeProgress({ current: 0, total: 0 })
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const totalPages = files.reduce((sum, file) => sum + (file.pageCount || 0), 0)
  const totalRows = files.reduce((sum, file) => sum + (file.rowCount || 0), 0)
  const currentFileType = files.length > 0 ? files[0].fileType : null

  // Update output filename extension based on file type
  useEffect(() => {
    if (currentFileType && files.length > 0) {
      const ext = getDefaultExtension(currentFileType)
      if (!outputFilename.endsWith(ext)) {
        // Remove any existing extension and add the correct one
        const nameWithoutExt = outputFilename.replace(/\.(pdf|csv|docx|doc)$/i, '')
        setOutputFilename(nameWithoutExt + ext)
      }
    }
  }, [currentFileType, files.length])

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 gradient-animated opacity-20 dark:opacity-10 -z-10" />
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 -z-20" />
      
      {/* Floating Decorative Elements */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-30 animate-float -z-10" style={{ animationDelay: '0s' }} />
      <div className="fixed top-40 right-10 w-72 h-72 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-30 animate-float -z-10" style={{ animationDelay: '2s' }} />
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-30 animate-float -z-10" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-slide-up">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-2xl transform rotate-3 hover:rotate-6 transition-transform duration-300">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              File Merger
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300 font-medium">
              Merge PDFs, CSV files, and Word documents into one
            </p>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>100% Free</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <span>No Uploads</span>
              </div>
            </div>
          </div>

          {/* Value Proposition Section */}
          <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-3xl p-8 sm:p-10 border border-indigo-200/50 dark:border-indigo-800/50 shadow-xl">
              <div className="text-center mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  Why Choose Our File Merger?
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                  The most secure, fast, and user-friendly way to combine your PDF, CSV, and Word documents
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Privacy & Security */}
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 dark:border-gray-700/50 hover:shadow-lg transition-all hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">100% Private & Secure</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    All processing happens directly in your browser. Your files never leave your device or get uploaded to any server. Complete privacy guaranteed.
                  </p>
                </div>

                {/* Free & No Limits */}
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 dark:border-gray-700/50 hover:shadow-lg transition-all hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Completely Free</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    No hidden fees, no subscriptions, no watermarks. Merge unlimited files for free. No registration or account required.
                  </p>
                </div>

                {/* Multiple Formats */}
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 dark:border-gray-700/50 hover:shadow-lg transition-all hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Multiple Formats</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    Support for PDF, CSV, and Word documents. Merge files of the same type together seamlessly.
                  </p>
                </div>
              </div>

              {/* Call to Action */}
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-white font-semibold">
                    Start merging your files now - it only takes seconds!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-6 sm:p-8 lg:p-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* File Upload Area */}
            <div className="mb-8">
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-56 border-3 border-dashed rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                  isDragging
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 scale-105 shadow-2xl'
                    : 'border-gray-300 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isDragging && (
                  <div className="absolute inset-0 shimmer-effect opacity-50" />
                )}
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-full cursor-pointer relative z-10"
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className={`mb-4 transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}>
                      <svg
                        className={`w-16 h-16 transition-colors duration-300 ${
                          isDragging
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <p className="mb-2 text-base font-semibold text-gray-700 dark:text-gray-300">
                      <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        Click to upload
                      </span>
                      {' '}or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      PDF, CSV, DOCX, or DOC files • Max 500MB total
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.csv,.docx,.doc,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                    multiple
                    onChange={handleFileSelect}
                    aria-label="Upload files"
                  />
                </label>
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl animate-fade-in shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">{success}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl animate-fade-in shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* File Type Indicator */}
            {currentFileType && files.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFileTypeIcon(currentFileType)}</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Merging {currentFileType.toUpperCase()} files
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      All files must be of the same type
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Filename */}
            {files.length >= 2 && (
              <div className="mb-6 animate-fade-in">
                <label htmlFor="output-filename" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Output Filename
                </label>
                <div className="relative">
                  <input
                    id="output-filename"
                    type="text"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="merged"
                    aria-label="Output filename"
                  />
                  {currentFileType && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-gray-400 text-sm">{getDefaultExtension(currentFileType)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <div className="mb-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                      Selected Files
                    </span>
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-semibold">
                      {files.length}
                    </span>
                  </h2>
                  <button
                    onClick={clearAllFiles}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    aria-label="Clear all files"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <div
                      key={`${file?.name || index}-${index}`}
                      onClick={() => setSelectedFileIndex(index)}
                      className={`group flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer ${
                        selectedFileIndex === index
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-2 border-indigo-400 dark:border-indigo-600 shadow-lg scale-[1.02]'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md hover:scale-[1.01]'
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedFileIndex(index)
                        }
                      }}
                      aria-label={`File ${index + 1}: ${file?.name || 'Unknown file'}`}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center mr-4 transition-all ${
                          selectedFileIndex === index
                            ? `bg-gradient-to-br ${getFileTypeColor(file.fileType!)}`
                            : 'bg-gray-100 dark:bg-gray-600'
                        }`}>
                          <span className="text-2xl">{getFileTypeIcon(file.fileType!)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block">
                            {file?.name || 'Unknown file'}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                              </svg>
                              {formatFileSize(file?.size || 0)}
                            </span>
                            {file.pageCount !== undefined && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                  </svg>
                                  {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                                </span>
                              </>
                            )}
                            {file.rowCount !== undefined && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                  </svg>
                                  {file.rowCount} {file.rowCount === 1 ? 'row' : 'rows'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveFile(index, 'up')
                          }}
                          disabled={index === 0}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                          title="Move up (Alt+↑)"
                          aria-label={`Move ${file?.name || 'file'} up`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveFile(index, 'down')
                          }}
                          disabled={index === files.length - 1}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                          title="Move down (Alt+↓)"
                          aria-label={`Move ${file?.name || 'file'} down`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(index)
                          }}
                          className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-lg"
                          title="Remove (Delete)"
                          aria-label={`Remove ${file?.name || 'file'}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {files.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        <span className="text-indigo-600 dark:text-indigo-400">Total:</span> {formatFileSize(totalSize)}
                        {totalPages > 0 && (
                          <span className="ml-3 text-purple-600 dark:text-purple-400">
                            • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                        {totalRows > 0 && (
                          <span className="ml-3 text-green-600 dark:text-green-400">
                            • {totalRows} {totalRows === 1 ? 'row' : 'rows'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Progress Indicator */}
            {isMerging && mergeProgress.total > 0 && (
              <div className="mb-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Processing file {mergeProgress.current} of {mergeProgress.total}
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 shadow-lg relative overflow-hidden"
                    style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={mergeProgress.current}
                    aria-valuemin={0}
                    aria-valuemax={mergeProgress.total}
                  >
                    <div className="absolute inset-0 shimmer-effect" />
                  </div>
                </div>
              </div>
            )}

            {/* Merge Button */}
            <button
              onClick={mergeFiles}
              disabled={files.length < 2 || isMerging}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 relative overflow-hidden group"
              aria-label="Merge files"
            >
              <div className="absolute inset-0 shimmer-effect opacity-30" />
              {isMerging ? (
                <>
                  <svg
                    className="animate-spin h-6 w-6 relative z-10"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="relative z-10">Merging Files...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6 relative z-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="relative z-10">Merge Files</span>
                </>
              )}
            </button>

            {files.length < 2 && files.length > 0 && (
              <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400 font-medium">
                Select at least one more file to merge
              </p>
            )}

            {/* Keyboard Shortcuts Help */}
            {files.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  <strong className="text-gray-700 dark:text-gray-300">Keyboard shortcuts:</strong> Click a file to select, then use <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Delete</kbd> to remove, <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Alt+↑/↓</kbd> to reorder
                </p>
              </div>
            )}
          </div>

          {/* How to Use Section */}
          <div className="mt-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              aria-expanded={showInstructions}
              aria-label="Toggle instructions"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  How to Use This Tool
                </h3>
              </div>
              <svg
                className={`w-6 h-6 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${showInstructions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showInstructions && (
              <div className="px-6 pb-6 animate-fade-in">
                <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        1
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Upload Your Files</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Click the upload area or drag and drop your files. Supported formats: PDF, CSV, DOCX, and DOC. 
                        You can select multiple files at once, but all files must be of the same type to merge. 
                        The tool supports up to 500MB total file size.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        2
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Reorder Files (Optional)</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Click on any file to select it, then use the up/down arrows to change the order. 
                        Files will be merged in the order they appear in the list. Use keyboard shortcuts: 
                        <kbd className="mx-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Alt+↑</kbd> and 
                        <kbd className="mx-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Alt+↓</kbd> to reorder.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        3
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Customize Output (Optional)</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Once you have at least 2 files, you can customize the output filename. 
                        The correct file extension will be added automatically based on your file type.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        4
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Merge Your Files</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Click the "Merge Files" button to combine all your files. You'll see a progress indicator 
                        showing which file is being processed. Once complete, your merged file will automatically download.
                      </p>
                    </div>
                  </div>

                  {/* Tips Section */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2">Pro Tips</h4>
                        <ul className="space-y-1.5 text-sm text-indigo-800 dark:text-indigo-300">
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-500 mt-1">•</span>
                            <span>All files must be of the same type (all PDFs, all CSVs, or all Word docs)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-500 mt-1">•</span>
                            <span>Use <kbd className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-xs">Delete</kbd> key to quickly remove selected files</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-500 mt-1">•</span>
                            <span>CSV files will be combined by rows (headers from first file only)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-500 mt-1">•</span>
                            <span>Word documents (.doc) need to be converted to .docx for best results</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full border border-gray-200 dark:border-gray-700 shadow-lg">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                All processing is done in your browser. Your files never leave your device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
