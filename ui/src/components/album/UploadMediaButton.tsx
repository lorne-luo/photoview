import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, gql } from '@apollo/client'
import { Button } from '../../primitives/form/Input'
import { authToken } from '../../helpers/authentication'

const SCAN_ALBUM_MUTATION = gql`
  mutation scanAlbumMutation($albumId: ID!) {
    scanAlbum(albumId: $albumId) {
      success
      message
    }
  }
`

type UploadMediaButtonProps = {
  albumId: string
  albumPath?: string
  onUploadComplete?: () => void
}

type UploadStatus = 'idle' | 'uploading' | 'scanning' | 'success' | 'error'

const UploadMediaButton = ({
  albumId,
  onUploadComplete,
}: UploadMediaButtonProps) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const [scanAlbum] = useMutation(SCAN_ALBUM_MUTATION)

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadStatus('uploading')
    setUploadProgress(
      t('upload.progress', 'Uploading {{count}} file(s)...', {
        count: files.length,
      })
    )

    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const apiUrl = import.meta.env.VITE_API_ENDPOINT || '/api'
      const response = await fetch(`${apiUrl}/upload/${albumId}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${authToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.uploaded > 0) {
        setUploadStatus('scanning')
        setUploadProgress(
          t('upload.scanning', 'Scanning album for new media...')
        )

        // Trigger album scan
        await scanAlbum({
          variables: { albumId },
        })

        setUploadStatus('success')
        setUploadProgress(
          t('upload.success', '{{count}} file(s) uploaded successfully!', {
            count: result.uploaded,
          })
        )

        // Notify parent to refresh
        onUploadComplete?.()

        // Reset after delay
        setTimeout(() => {
          setUploadStatus('idle')
          setUploadProgress('')
        }, 3000)
      } else {
        setUploadStatus('error')
        setUploadProgress(
          t('upload.no_files', 'No valid files were uploaded')
        )
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setUploadProgress(
        t('upload.error', 'Upload failed: {{error}}', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      )
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getButtonText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return t('upload.uploading', 'Uploading...')
      case 'scanning':
        return t('upload.scanning_btn', 'Scanning...')
      case 'success':
        return t('upload.done', 'Done!')
      case 'error':
        return t('upload.retry', 'Retry')
      default:
        return t('upload.button', 'Upload Media')
    }
  }

  const isDisabled = uploadStatus === 'uploading' || uploadStatus === 'scanning'

  return (
    <div className="inline-block">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,video/*"
        className="hidden"
      />
      <Button
        onClick={handleButtonClick}
        disabled={isDisabled}
        variant={uploadStatus === 'error' ? 'negative' : uploadStatus === 'success' ? 'positive' : 'default'}
        className="flex items-center gap-2"
      >
        {isDisabled && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isDisabled && (
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        )}
        {getButtonText()}
      </Button>
      {uploadProgress && (
        <div
          className={`mt-2 text-sm ${
            uploadStatus === 'error'
              ? 'text-red-600'
              : uploadStatus === 'success'
              ? 'text-green-600'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          {uploadProgress}
        </div>
      )}
    </div>
  )
}

export default UploadMediaButton
