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
        // Note: File objects can't be serialized, so we just restore the count
        // Users will need to re-select files, but we preserve the filename preference
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

    // Check total size (limit to 500MB for browser memory)
    const totalSize = [...files, ...pdfFiles].reduce((sum, file) => sum + file.size, 0)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (totalSize > maxSize) {
      setError(`Total file size exceeds 500MB limit. Please select smaller files.`)
      return
    }

    // Validate each PDF and get page count
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

  // Drag and drop handlers
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

  // Keyboard shortcuts
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
      
      // Auto-clear success message after 5 seconds
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            PDF Merger
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Merge multiple PDF files into one document
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
          {/* File Upload Area */}
          <div className="mb-6">
            <div
              ref={dropZoneRef}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className={`w-12 h-12 mb-4 transition-colors ${
                      isDragging
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 dark:text-gray-400'
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
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PDF files only (Max 500MB total)
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
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {/* Custom Filename */}
          {files.length >= 2 && (
            <div className="mb-6">
              <label htmlFor="output-filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Output Filename
              </label>
              <input
                id="output-filename"
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="merged.pdf"
                aria-label="Output filename for merged PDF"
              />
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Selected Files ({files.length})
                </h2>
                <button
                  onClick={clearAllFiles}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors"
                  aria-label="Clear all files"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    onClick={() => setSelectedFileIndex(index)}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                      selectedFileIndex === index
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700'
                        : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
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
                      <svg
                        className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 dark:text-white truncate block">
                          {file.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>{formatFileSize(file.size)}</span>
                          {file.pageCount !== undefined && (
                            <>
                              <span>•</span>
                              <span>{file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}</span>
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
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
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
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
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
                        className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors rounded"
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
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      <strong>Total:</strong> {formatFileSize(totalSize)}
                      {totalPages > 0 && (
                        <span className="ml-2">
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
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Processing file {mergeProgress.current} of {mergeProgress.total}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={mergeProgress.current}
                  aria-valuemin={0}
                  aria-valuemax={mergeProgress.total}
                />
              </div>
            </div>
          )}

          {/* Merge Button */}
          <button
            onClick={mergePDFs}
            disabled={files.length < 2 || isMerging}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Merge PDF files"
          >
            {isMerging ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Merging PDFs...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Merge PDFs
              </>
            )}
          </button>

          {files.length < 2 && files.length > 0 && (
            <p className="mt-3 text-sm text-center text-gray-500 dark:text-gray-400">
              Select at least one more PDF file to merge
            </p>
          )}

          {/* Keyboard Shortcuts Help */}
          {files.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                <strong>Keyboard shortcuts:</strong> Click a file to select, then use Delete to remove, Alt+↑/↓ to reorder
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>All processing is done in your browser. Your files never leave your device.</p>
        </div>
      </div>
    </main>
  )
}
