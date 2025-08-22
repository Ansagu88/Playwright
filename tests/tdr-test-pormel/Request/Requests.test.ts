import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import { DownloadActiveFormatsAction } from './DownloadActiveFormats.action';
import { ExportRequestAction } from './ExportRequest.action';
import { NewRequestAction } from './NewRequest.action';

test('download active formats should be a zip', async ({ page }) => {
  const action = new DownloadActiveFormatsAction(page);

  // Trigger download and get saved path
  const savedPath = await action.downloadActiveFormats();

  // Verify file exists and has content
  const stat = await fs.stat(savedPath);
  expect(stat.size).toBeGreaterThan(0);

  // Verify ZIP magic bytes (PK\x03\x04)
  const buffer = await fs.readFile(savedPath);
  expect(buffer.slice(0, 4)).toEqual(Buffer.from([0x50, 0x4B, 0x03, 0x04]));

  // Cleanup
  await fs.unlink(savedPath);
});

test('export requests should be an excel file', async ({ page }) => {
  const action = new ExportRequestAction(page);
  const savedPath = await action.exportRequests();

  const stat = await fs.stat(savedPath);
  expect(stat.size).toBeGreaterThan(0);

  const buffer = await fs.readFile(savedPath);
  const header = buffer.slice(0, 4);
  const xlsxSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  const xlsSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0]);

  expect(header.equals(xlsxSignature) || header.equals(xlsSignature)).toBeTruthy();

  // Cleanup
  await fs.unlink(savedPath);
});

test('create new request with 3 random files', async ({ page }) => {
  const action = new NewRequestAction(page);

  // This will navigate, open the new-request flow, fill the form and upload 3 files
  const created = await action.createRequestWithFiles();

  // Verify the created request's unique description appears in the UI
  await expect(page.getByText(created.descripcion)).toBeVisible({ timeout: 30_000 });
});