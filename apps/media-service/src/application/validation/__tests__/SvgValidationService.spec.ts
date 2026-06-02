// isomorphic-dompurify pulls in jsdom@29 which has ESM-only transitive deps
// (@exodus/bytes) that ts-jest (CJS mode) cannot transform. We mock the module
// with a functional spy that mirrors the real DOMPurify API used by SvgValidationService.
// The real DOMPurify integration is verified at runtime (docker-compose smoke tests).
//
// The mock implements SVG-safe filtering so we can still assert on sanitization
// outcomes (script removal, onload stripping, etc.) without loading the actual jsdom.

const mockSanitize = jest.fn((input: string, _opts?: object): string => {
  // Minimal functional mock: strip <script>, <foreignObject>, on* attrs, javascript: hrefs
  let out = input;
  out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
  out = out.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  out = out.replace(/\s+href\s*=\s*["']javascript:[^"']*["']/gi, '');
  return out.trim();
});

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: mockSanitize,
    setConfig: jest.fn(),
  },
  sanitize: mockSanitize,
  setConfig: jest.fn(),
}));

import { SvgValidationService } from '../SvgValidationService';
import { InvalidFormatError } from '../../../domain/errors/DomainError';
import { SvgEntityType } from '../../../domain/entities/Svg';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function svgBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf8');
}

// ---------------------------------------------------------------------------
// ITEM A — DOMPurify sanitizer tests
// ---------------------------------------------------------------------------

describe('SvgValidationService.sanitizeSvgContent — ITEM A (DOMPurify)', () => {
  beforeEach(() => {
    mockSanitize.mockClear();
  });

  it('removes <script> tags from SVG content', () => {
    const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
    expect(mockSanitize).toHaveBeenCalledWith(malicious, expect.any(Object));
  });

  it('removes <foreignObject> elements (bypass vector)', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject>' +
      '</svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('alert(1)');
  });

  it('removes onload event handler attributes', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="5"/></svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert(1)');
  });

  it('removes onclick event handler attributes', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="10" height="10"/></svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('onclick');
  });

  it('removes onerror event handler attributes', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<image onerror="alert(1)"/>' +
      '</svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert(1)');
  });

  it('strips href="javascript:…" attributes', () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<a href="javascript:alert(1)"><text>click</text></a>' +
      '</svg>';
    const result = SvgValidationService.sanitizeSvgContent(malicious);

    expect(result).not.toContain('javascript:');
  });

  it('preserves safe SVG geometry elements', () => {
    const safe =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
      '<circle cx="12" cy="12" r="10" fill="blue"/>' +
      '</svg>';
    const result = SvgValidationService.sanitizeSvgContent(safe);

    expect(result).toContain('<circle');
  });

  it('throws InvalidFormatError when DOMPurify strips everything (fully malicious input)', () => {
    // Pure script with no SVG wrapper — mock strips <script>, leaving empty string
    mockSanitize.mockReturnValueOnce('');

    expect(() =>
      SvgValidationService.sanitizeSvgContent('<script>alert(1)</script>'),
    ).toThrow(InvalidFormatError);
  });

  it('calls DOMPurify.sanitize with SVG profile options', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    SvgValidationService.sanitizeSvgContent(safe);

    expect(mockSanitize).toHaveBeenCalledWith(
      safe,
      expect.objectContaining({ USE_PROFILES: { svg: true, svgFilters: true } }),
    );
  });
});

// ---------------------------------------------------------------------------
// ITEM B — Sanitization cannot be disabled
// ---------------------------------------------------------------------------

describe('SvgValidationService.sanitizeSvgContent — ITEM B (always sanitizes)', () => {
  beforeEach(() => {
    mockSanitize.mockClear();
  });

  it('calls DOMPurify even when SVG_ENABLE_SANITIZATION env is false', () => {
    const original = process.env.SVG_ENABLE_SANITIZATION;
    process.env.SVG_ENABLE_SANITIZATION = 'false';

    try {
      const malicious =
        '<svg xmlns="http://www.w3.org/2000/svg" onload="evil()"><circle r="5"/></svg>';
      // Must sanitize regardless of env
      SvgValidationService.sanitizeSvgContent(malicious);

      expect(mockSanitize).toHaveBeenCalled();
    } finally {
      if (original === undefined) {
        delete process.env.SVG_ENABLE_SANITIZATION;
      } else {
        process.env.SVG_ENABLE_SANITIZATION = original;
      }
    }
  });

  it('sanitizeSvgContent function has no enableSanitization parameter or branch', () => {
    // The function signature must not accept any "enable/disable" argument.
    // The function has exactly one required parameter: svgContent (string).
    expect(SvgValidationService.sanitizeSvgContent.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ITEM C — SVG content-structure validation
// ---------------------------------------------------------------------------

describe('SvgValidationService.validateSvgMagicBytes — ITEM C (content-structure)', () => {
  const SVG_MIME = 'image/svg+xml';

  it('accepts valid SVG content with correct MIME type', () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(content), SVG_MIME),
    ).not.toThrow();
  });

  it('throws InvalidFormatError when content has no <svg> element (binary file spoofing)', () => {
    // Binary files (PNG/JPEG/etc.) uploaded as SVG will decode as garbled text
    // with no valid <svg> tag — this check catches them after UTF-8 decode.
    const garbageContent = 'not-an-svg-document-and-no-svg-element-here';

    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(garbageContent), SVG_MIME),
    ).toThrow(InvalidFormatError);
  });

  it('throws InvalidFormatError when content is an HTML document (DOCTYPE html spoofing)', () => {
    const htmlDoc =
      '<!DOCTYPE html><html><body><svg onload="alert(1)"></svg></body></html>';

    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(htmlDoc), SVG_MIME),
    ).toThrow(InvalidFormatError);
  });

  it('throws InvalidFormatError when content is <html> root without DOCTYPE', () => {
    const htmlDoc = '<html><body><p>not an svg</p></body></html>';

    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(htmlDoc), SVG_MIME),
    ).toThrow(InvalidFormatError);
  });

  it('throws InvalidFormatError when declared MIME type is not an SVG MIME type', () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(content), 'image/png'),
    ).toThrow(InvalidFormatError);
  });

  it('accepts application/svg+xml as a valid SVG MIME type', () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(content), 'application/svg+xml'),
    ).not.toThrow();
  });

  it('accepts SVG content that starts with XML declaration', () => {
    const content =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    expect(() =>
      SvgValidationService.validateSvgMagicBytes(svgBuffer(content), SVG_MIME),
    ).not.toThrow();
  });
});
