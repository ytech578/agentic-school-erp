import { BadRequestException } from '@nestjs/common';

export const OFFICIAL_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const MAX_OFFICIAL_DOCUMENT_BYTES = 10 * 1024 * 1024;

interface DocumentUpload {
  mimetype: string;
  size: number;
}

/**
 * Applies the shared policy for documents kept in a learner's official record.
 * StorageService additionally verifies the corresponding file signature.
 */
export function validateOfficialDocumentUpload(
  file: DocumentUpload | undefined,
) {
  if (!file) {
    throw new BadRequestException('File is required');
  }

  if (
    !OFFICIAL_DOCUMENT_MIME_TYPES.includes(
      file.mimetype as (typeof OFFICIAL_DOCUMENT_MIME_TYPES)[number],
    )
  ) {
    throw new BadRequestException(
      'Only PDF, PNG, and JPEG files are permitted',
    );
  }

  if (file.size > MAX_OFFICIAL_DOCUMENT_BYTES) {
    throw new BadRequestException('File size exceeds the 10MB limit');
  }
}
