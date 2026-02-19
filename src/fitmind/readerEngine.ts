export type ReaderEngine = 'native_pdf' | 'web_pdfjs' | 'web_epub' | 'external';

const VALID_ENGINES: ReaderEngine[] = ['native_pdf', 'web_pdfjs', 'web_epub', 'external'];

export function resolveReaderEngine(
  requestedEngine: string | undefined,
  appOwnership: string | null | undefined
): ReaderEngine {
  const normalized = (requestedEngine || 'native_pdf').toLowerCase();
  const requested = VALID_ENGINES.includes(normalized as ReaderEngine)
    ? (normalized as ReaderEngine)
    : 'native_pdf';

  const isExpoGo = appOwnership === 'expo';
  if (isExpoGo && requested === 'native_pdf') {
    return 'external';
  }

  return requested;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateReaderProgressPercent(args: {
  documentType?: 'PDF' | 'EPUB' | 'ARTICLE' | 'NOTE' | 'UNKNOWN';
  currentPage: number;
  totalPages?: number;
  epubProgressPercent?: number;
}): number {
  const { documentType, currentPage, totalPages, epubProgressPercent } = args;

  if (documentType === 'EPUB' && epubProgressPercent != null) {
    return clampPercent(epubProgressPercent);
  }

  if (totalPages && totalPages > 0) {
    return clampPercent((currentPage / totalPages) * 100);
  }

  return 0;
}

export interface EpubRelocatedPayload {
  progress: number;
  atStart: boolean;
  atEnd: boolean;
  cfi?: string;
}

export function normalizeReaderFileUri(filePath: string | null | undefined): string | undefined {
  if (!filePath) return undefined;
  return filePath.startsWith('file://') ? filePath : `file://${filePath}`;
}

export function getBinaryRendererFailureMessage(
  documentType: 'PDF' | 'EPUB' | undefined
): string {
  if (documentType === 'PDF') {
    return 'The offline web PDF renderer failed to initialize. You can retry in-app or open with the system reader.';
  }

  if (documentType === 'EPUB') {
    return 'The offline web EPUB renderer failed to initialize. You can retry in-app or open with the system reader.';
  }

  return 'The offline renderer failed to initialize. You can retry in-app or open with the system reader.';
}

export function canUseInlinePageNavigation(args: {
  isBinaryDoc: boolean;
  isInAppWebPdfMode: boolean;
}): boolean {
  const { isBinaryDoc, isInAppWebPdfMode } = args;
  return !isBinaryDoc || isInAppWebPdfMode;
}

export function parseEpubWebMessage(raw: string):
  | { type: 'loaded'; totalPages: number }
  | { type: 'relocated'; payload: EpubRelocatedPayload }
  | { type: 'error'; message: string }
  | { type: 'unknown' } {
  try {
    const data = JSON.parse(raw || '{}');

    if (data?.type === 'loaded') {
      return {
        type: 'loaded',
        totalPages: Number(data?.payload?.totalPages || 0),
      };
    }

    if (data?.type === 'relocated') {
      return {
        type: 'relocated',
        payload: {
          progress: Number(data?.payload?.progress || 0),
          atStart: !!data?.payload?.atStart,
          atEnd: !!data?.payload?.atEnd,
          cfi: data?.payload?.cfi ? String(data.payload.cfi) : undefined,
        },
      };
    }

    if (data?.type === 'error') {
      return {
        type: 'error',
        message: String(data?.payload?.message || 'unknown'),
      };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}
