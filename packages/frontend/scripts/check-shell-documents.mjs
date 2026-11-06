import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SHELL_DOCUMENT_ASSETS } from '../constants/shell-routes.js';

for (const asset of SHELL_DOCUMENT_ASSETS) {
  const filename = asset.endsWith('/')
    ? `${asset}index.html`
    : asset.endsWith('.html')
      ? asset
      : `${asset}.html`;
  await access(fileURLToPath(new URL(`../dist${filename}`, import.meta.url)));
}
