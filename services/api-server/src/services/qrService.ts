/**
 * QR code generation and file storage service.
 * Generates QR code images for group access tokens and stores them
 * as PNG files served by Nginx.
 * @module api-server/services/qrService
 */

import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * QR code generation and storage service.
 */
export class QrService {
  /**
   * @param storagePath - Base directory for QR code image storage
   * @param host - Public host URL for generating QR code URLs
   */
  constructor(
    private readonly storagePath: string,
    private readonly host: string,
  ) {}

  /**
   * Generate a QR code PNG for a group access token and save to disk.
   * @param token - The access token string (QR payload encodes /control/{token})
   * @param tenantSlug - Tenant slug for directory organization
   * @param venueSlug - Venue slug for directory organization
   * @param groupId - Group UUID (used as filename)
   * @returns File path of the generated PNG
   */
  async generateAndSave(
    token: string,
    tenantSlug: string,
    venueSlug: string,
    groupId: string,
  ): Promise<string> {
    const url = `${this.host}/control/${token}`;
    const filePath = join(this.storagePath, tenantSlug, venueSlug, `${groupId}.png`);

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Generate at print-appropriate resolution (1200x1200px minimum)
    const pngBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    await writeFile(filePath, pngBuffer);
    return filePath;
  }

  /**
   * Generate a QR code as a PNG buffer (for download endpoints).
   * @param token - The access token string
   * @returns PNG image buffer
   */
  async generatePng(token: string): Promise<Buffer> {
    const url = `${this.host}/control/${token}`;
    return QRCode.toBuffer(url, {
      type: 'png',
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Generate a QR code as an SVG string (for download endpoints).
   * @param token - The access token string
   * @returns SVG markup string
   */
  async generateSvg(token: string): Promise<string> {
    const url = `${this.host}/control/${token}`;
    return QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  }
}
