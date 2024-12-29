import React, { useCallback, useRef, useState } from 'react'; // ^18.0.0
import classnames from 'classnames'; // ^2.3.1
import Button, { ButtonProps } from './Button';
import ProgressBar from './ProgressBar';
import styles from './FileUpload.module.css';

/**
 * Custom error type for file upload failures
 */
export interface FileUploadError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Props interface for FileUpload component
 */
export interface FileUploadProps {
  /** Accepted file types with MIME type validation */
  accept?: string;
  /** Enable multiple file selection */
  multiple?: boolean;
  /** Maximum file size in bytes (5MB) */
  maxSize?: number;
  /** Async callback for file selection handling */
  onFileSelect: (files: File[]) => Promise<void>;
  /** Callback for upload progress updates */
  onProgress?: (progress: number) => void;
  /** Enhanced error handling callback */
  onError?: (error: FileUploadError) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable upload functionality */
  disabled?: boolean;
}

/**
 * Validates files against security and size constraints
 */
const validateFiles = async (
  files: FileList,
  accept?: string,
  maxSize?: number
): Promise<{ validFiles: File[]; errors: FileUploadError[] }> => {
  const validFiles: File[] = [];
  const errors: FileUploadError[] = [];
  const acceptedTypes = accept?.split(',').map(type => type.trim()) || [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    // Security checks
    if (fileExtension && /^(exe|bat|cmd|sh|php|pl|py|js|jar)$/i.test(fileExtension)) {
      errors.push({
        code: 'INVALID_FILE_TYPE',
        message: 'File type not allowed for security reasons',
        details: { fileName: file.name, fileType: file.type }
      });
      continue;
    }

    // MIME type validation
    if (acceptedTypes.length > 0 && !acceptedTypes.some(type => {
      const regex = new RegExp(type.replace('*', '.*'));
      return regex.test(file.type);
    })) {
      errors.push({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type ${file.type} is not supported`,
        details: { fileName: file.name, fileType: file.type }
      });
      continue;
    }

    // Size validation
    if (maxSize && file.size > maxSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
        details: { fileName: file.name, fileSize: file.size }
      });
      continue;
    }

    // Content type verification
    try {
      const arrayBuffer = await file.slice(0, 4).arrayBuffer();
      const header = new Uint8Array(arrayBuffer);
      const isValidHeader = validateFileHeader(header, file.type);
      
      if (!isValidHeader) {
        errors.push({
          code: 'INVALID_CONTENT',
          message: 'File content does not match its extension',
          details: { fileName: file.name }
        });
        continue;
      }
    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate file content',
        details: { fileName: file.name, error }
      });
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
};

/**
 * Validates file headers against known signatures
 */
const validateFileHeader = (header: Uint8Array, mimeType: string): boolean => {
  const signatures: Record<string, number[]> = {
    'text/csv': [0x2C, 0x0D, 0x0A], // CSV file signature
    'application/json': [0x7B, 0x22], // JSON file signature
  };

  const expectedSignature = signatures[mimeType];
  if (!expectedSignature) return true; // Skip validation if signature unknown

  return expectedSignature.every((byte, index) => header[index] === byte);
};

/**
 * FileUpload component provides secure, accessible file upload capabilities
 * with drag-and-drop support and progress tracking
 */
const FileUpload: React.FC<FileUploadProps> = ({
  accept = '.csv,.json',
  multiple = false,
  maxSize = 5 * 1024 * 1024, // 5MB
  onFileSelect,
  onProgress,
  onError,
  className,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(async (fileList: FileList) => {
    try {
      const { validFiles, errors } = await validateFiles(fileList, accept, maxSize);

      if (errors.length > 0) {
        errors.forEach(error => onError?.(error));
      }

      if (validFiles.length > 0) {
        setUploadProgress(0);
        await onFileSelect(validFiles);
      }
    } catch (error) {
      onError?.({
        code: 'PROCESSING_ERROR',
        message: 'Failed to process files',
        details: { error }
      });
    }
  }, [accept, maxSize, onFileSelect, onError]);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = event.dataTransfer.files;
    await processFiles(droppedFiles);
  }, [disabled, processFiles]);

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      await processFiles(files);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Update progress
  React.useEffect(() => {
    if (onProgress) {
      onProgress(uploadProgress);
    }
  }, [uploadProgress, onProgress]);

  const dropzoneClasses = classnames(
    styles.fileUpload__dropzone,
    {
      [styles['fileUpload__dropzone--active']]: isDragging,
      [styles['fileUpload__dropzone--disabled']]: disabled
    }
  );

  return (
    <div 
      className={classnames(styles.fileUpload, className)}
      data-testid="file-upload"
    >
      <div
        className={dropzoneClasses}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${disabled ? 'Disabled f' : 'F'}ile upload area. ${multiple ? 'Drop multiple files' : 'Drop a file'} here or click to select`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className={styles.fileUpload__input}
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
        />
        
        <Button
          variant="outline"
          disabled={disabled}
          onClick={handleButtonClick}
          ariaLabel="Select file"
        >
          Choose File{multiple ? 's' : ''}
        </Button>
        
        <p className={styles.fileUpload__text}>
          or drag and drop {multiple ? 'files' : 'a file'} here
        </p>
        
        <p className={styles.fileUpload__hint}>
          Accepted formats: {accept} (max {maxSize / 1024 / 1024}MB)
        </p>
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className={styles.fileUpload__progress}>
          <ProgressBar
            progress={uploadProgress}
            size="sm"
            variant="primary"
            animated
            ariaLabel="Upload progress"
          />
        </div>
      )}
    </div>
  );
};

export default FileUpload;