'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'

interface FileWithPages extends File {
  pageCount?: number
}

export default function Home() {
  const [files, setFiles] = useState<FileWithPages[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 })
  const [outputFilename, setOutputFilename] = useState('merged.pdf')
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Load files from localStorage on mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('pdfMergerFiles')
    if (savedFiles) {
      try {
        const fileNames = JSON.parse(savedFiles)
      } catch (e) {
        // Ignore parse errors
      }
    }
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

  // Validate and add files
  const addFiles = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter(file => file.type === 'application/pdf')
    
    if (pdfFiles.length !== newFiles.length) {
      setError('Some files are not PDFs. Only PDF files are supported.')
      return
    }

    const totalSize = [...files, ...pdfFiles].reduce((sum, file) => sum + file.size, 0)
    const maxSize = 500 * 1024 * 1024
    if (totalSize > maxSize) {
      setError(`Total file size exceeds 500MB limit. Please select smaller files.`)
      return
    }

    Promise.all(
      pdfFiles.map(async (file) => {
        try {
          const fileBytes = await file.arrayBuffer()
          const pdf = await PDFDocument.load(fileBytes)
          const pageCount = pdf.getPageCount()
          return { ...file, pageCount } as FileWithPages
        } catch (err) {
          setError(`"${file.name}" is not a valid PDF file or is corrupted.`)
          return null
        }
      })
    ).then((validatedFiles) => {
      const validFiles = validatedFiles.filter((f): f is FileWithPages => f !== null)
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles])
        setError(null)
      }
    })
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

  const mergePDFs = async () => {
    if (files.length < 2) {
      setError('Please select at least 2 PDF files to merge')
      return
    }

    setIsMerging(true)
    setError(null)
    setSuccess(null)
    setMergeProgress({ current: 0, total: files.length })

    try {
      const mergedPdf = await PDFDocument.create()
      for (let i = 0; i < files.length; i++) {
        setMergeProgress({ current: i + 1, total: files.length })
        const file = files[i]
        const fileBytes = await file.arrayBuffer()
        const pdf = await PDFDocument.load(fileBytes)
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach((page) => {
          mergedPdf.addPage(page)
        })
      }

      const mergedPdfBytes = await mergedPdf.save()
      const arrayBuffer = new ArrayBuffer(mergedPdfBytes.length)
      new Uint8Array(arrayBuffer).set(mergedPdfBytes)
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = outputFilename.endsWith('.pdf') ? outputFilename : `${outputFilename}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess(`Successfully merged ${files.length} PDF files!`)
      setError(null)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      let errorMessage = 'Failed to merge PDFs. '
      if (err instanceof Error) {
        if (err.message.includes('password')) {
          errorMessage += 'One or more PDFs are password-protected and cannot be merged.'
        } else if (err.message.includes('corrupt')) {
          errorMessage += 'One or more PDFs are corrupted.'
        } else {
          errorMessage += err.message
        }
      } else {
        errorMessage += 'Please ensure all files are valid PDF documents.'
      }
      setError(errorMessage)
      console.error('Error merging PDFs:', err)
    } finally {
      setIsMerging(false)
      setMergeProgress({ current: 0, total: 0 })
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const totalPages = files.reduce((sum, file) => sum + (file.pageCount || 0), 0)

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
              PDF Merger
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300 font-medium">
              Combine multiple PDFs into one beautiful document
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
                      PDF files only • Max 500MB total
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    aria-label="Upload PDF files"
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
                    placeholder="merged.pdf"
                    aria-label="Output filename for merged PDF"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
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
                      key={`${file.name}-${index}`}
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
                      aria-label={`File ${index + 1}: ${file.name}`}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center mr-4 transition-all ${
                          selectedFileIndex === index
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          <svg
                            className={`w-6 h-6 ${
                              selectedFileIndex === index ? 'text-white' : 'text-red-600 dark:text-red-400'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block">
                            {file.name}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                              </svg>
                              {formatFileSize(file.size)}
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
                          aria-label={`Move ${file.name} up`}
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
                          aria-label={`Move ${file.name} down`}
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
                          aria-label={`Remove ${file.name}`}
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
              onClick={mergePDFs}
              disabled={files.length < 2 || isMerging}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 relative overflow-hidden group"
              aria-label="Merge PDF files"
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
                  <span className="relative z-10">Merging PDFs...</span>
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
                  <span className="relative z-10">Merge PDFs</span>
                </>
              )}
            </button>

            {files.length < 2 && files.length > 0 && (
              <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400 font-medium">
                Select at least one more PDF file to merge
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
