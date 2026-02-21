import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export interface ReaderWebScripts {
  pdfScript: string;
  pdfWorkerScript: string;
  epubScript: string;
  pdfHtmlTemplate: string;
  epubHtmlTemplate: string;
}

function getReaderAssetModules() {
  return {
    pdfScriptAsset: require('../../assets/fitmind/reader/pdf.min.txt') as number,
    pdfWorkerScriptAsset: require('../../assets/fitmind/reader/pdf.worker.min.txt') as number,
    epubScriptAsset: require('../../assets/fitmind/reader/epub.min.txt') as number,
    pdfHtmlTemplateAsset: require('../../assets/fitmind/reader/pdf-viewer.html.txt') as number,
    epubHtmlTemplateAsset: require('../../assets/fitmind/reader/epub-viewer.html.txt') as number,
  };
}

async function readBundledTextAsset(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }

  const uri = asset.localUri || asset.uri;
  if (!uri) {
    throw new Error('Asset URI unavailable');
  }

  return FileSystem.readAsStringAsync(uri);
}

export async function loadReaderWebScripts(): Promise<ReaderWebScripts> {
  const {
    pdfScriptAsset,
    pdfWorkerScriptAsset,
    epubScriptAsset,
    pdfHtmlTemplateAsset,
    epubHtmlTemplateAsset,
  } = getReaderAssetModules();

  const [pdfScript, pdfWorkerScript, epubScript, pdfHtmlTemplate, epubHtmlTemplate] = await Promise.all([
    readBundledTextAsset(pdfScriptAsset),
    readBundledTextAsset(pdfWorkerScriptAsset),
    readBundledTextAsset(epubScriptAsset),
    readBundledTextAsset(pdfHtmlTemplateAsset),
    readBundledTextAsset(epubHtmlTemplateAsset),
  ]);

  return {
    pdfScript,
    pdfWorkerScript,
    epubScript,
    pdfHtmlTemplate,
    epubHtmlTemplate,
  };
}

function injectTemplateValue(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

export function buildPdfWebReaderHtml(args: {
  pdfUri: string;
  pdfScript: string;
  pdfWorkerScript: string;
  pdfHtmlTemplate: string;
}): string {
  const { pdfUri, pdfScript, pdfWorkerScript, pdfHtmlTemplate } = args;

  return injectTemplateValue(
    injectTemplateValue(
      injectTemplateValue(
        pdfHtmlTemplate,
        '__PDF_SOURCE__',
        JSON.stringify(pdfScript)
      ),
      '__PDF_WORKER_SOURCE__',
      JSON.stringify(pdfWorkerScript)
    ),
    '__PDF_URI__',
    JSON.stringify(pdfUri)
  );
}

export function buildEpubWebReaderHtml(args: {
  epubUri: string;
  epubScript: string;
  epubHtmlTemplate: string;
}): string {
  const { epubUri, epubScript, epubHtmlTemplate } = args;

  return injectTemplateValue(
    injectTemplateValue(
      epubHtmlTemplate,
      '__EPUB_SOURCE__',
      JSON.stringify(epubScript)
    ),
    '__EPUB_URI__',
    JSON.stringify(epubUri)
  );
}
