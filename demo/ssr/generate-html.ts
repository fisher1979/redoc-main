import puppeteer from 'puppeteer';
import { loadAndBundleSpec } from '../../src/utils/loadAndBundleSpec';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Generate static HTML from OpenAPI spec using Puppeteer
 * @param specOrUrl - OpenAPI spec object or URL
 * @param specUrl - Optional spec URL for references
 * @returns Complete static HTML string
 */
export async function generateStaticHtml(
  specOrUrl: string | object,
  specUrl?: string,
): Promise<string> {
  let spec: object;
  let actualSpecUrl: string | undefined;

  try {
    // Resolve relative spec URL to absolute path
    let specToLoad: string | object = specOrUrl;

    // If specOrUrl is a string (URL), resolve relative paths
    if (typeof specOrUrl === 'string' && !specOrUrl.startsWith('http')) {
      const path = require('path');
      const fs = require('fs');

      // Check if it's a relative path
      if (!path.isAbsolute(specOrUrl)) {
        // Try to resolve from demo directory first (most common case), then from project root
        const demoDir = path.resolve(__dirname, '..');
        const demoPath = path.resolve(demoDir, specOrUrl);
        const rootPath = path.resolve(__dirname, '../..', specOrUrl);

        if (fs.existsSync(demoPath)) {
          specToLoad = demoPath;
          actualSpecUrl = demoPath;
        } else if (fs.existsSync(rootPath)) {
          specToLoad = rootPath;
          actualSpecUrl = rootPath;
        } else {
          // Try relative to current working directory as fallback
          const cwdPath = path.resolve(process.cwd(), specOrUrl);
          if (fs.existsSync(cwdPath)) {
            specToLoad = cwdPath;
            actualSpecUrl = cwdPath;
          } else {
            // Keep original URL, but set base path for loadAndBundleSpec
            // The base should be the demo directory for relative path resolution
            specToLoad = specOrUrl;
            actualSpecUrl = specOrUrl;
          }
        }
      } else {
        // Absolute path
        actualSpecUrl = specOrUrl;
        specToLoad = specOrUrl;
      }
    } else if (typeof specOrUrl === 'string') {
      actualSpecUrl = specOrUrl;
    } else {
      actualSpecUrl = specUrl;
    }

    // Temporarily change process.cwd() for loadAndBundleSpec if needed
    // This helps resolve relative paths in spec files
    const originalCwd = process.cwd();
    let resolvedSpec: any;
    try {
      // If we have a file path, set cwd to its directory to help resolve relative refs
      if (typeof specToLoad === 'string' && !specToLoad.startsWith('http')) {
        const path = require('path');
        const specDir = path.isAbsolute(specToLoad)
          ? path.dirname(specToLoad)
          : path.resolve(originalCwd, path.dirname(specToLoad));
        process.chdir(specDir);
      }

      // Load and bundle the spec
      resolvedSpec = await loadAndBundleSpec(specToLoad);
      spec = resolvedSpec;
    } finally {
      // Restore original cwd
      process.chdir(originalCwd);
    }

    // If actualSpecUrl wasn't set above, set it now
    if (!actualSpecUrl) {
      actualSpecUrl = specUrl || (typeof specOrUrl === 'string' ? specOrUrl : undefined);
    }

    // Extract title from spec
    const title = resolvedSpec?.info?.title || 'API Documentation';

    // Get path to local redoc.standalone.js
    // Try multiple possible locations
    const projectRoot = path.resolve(__dirname, '../..');
    const bundlesDir = path.join(projectRoot, 'bundles');
    const standaloneJsPath = path.join(bundlesDir, 'redoc.standalone.js');

    // Read the local standalone.js file and inline it
    let redocScriptTag: string;
    if (fs.existsSync(standaloneJsPath)) {
      try {
        // Read the file content
        const standaloneJsContent = fs.readFileSync(standaloneJsPath, 'utf-8');
        // Inline the script directly in the HTML for complete offline support
        redocScriptTag = `<script>${standaloneJsContent}</script>`;
        console.log(`Using local redoc.standalone.js from ${standaloneJsPath}`);
      } catch (error) {
        console.error(`Error reading local redoc.standalone.js: ${error}`);
        throw new Error(`Failed to read local redoc.standalone.js: ${error}`);
      }
    } else {
      // Throw error instead of falling back to CDN to ensure local file is used
      const errorMsg =
        `Local redoc.standalone.js not found at ${standaloneJsPath}. ` +
        `Please run 'npm run bundle:standalone' to build it first.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Build HTML template with Redoc
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  ${redocScriptTag}
  <style>
    html, body, #redoc {
      height: 100%;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="redoc"></div>
  <script>
    (function() {
      const SPEC = ${JSON.stringify(spec)};
      const SPEC_URL = ${JSON.stringify(actualSpecUrl || '')};
      
      function initRedoc() {
        if (typeof Redoc === 'undefined') {
          setTimeout(initRedoc, 100);
          return;
        }
        
        const element = document.getElementById('redoc');
        if (element) {
          try {
            Redoc.init(SPEC_URL || SPEC, { hideDownloadButton: true }, element);
          } catch (e) {
            console.error('Error initializing Redoc:', e);
          }
        }
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRedoc);
      } else {
        initRedoc();
      }
    })();
  </script>
</body>
</html>`;

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });

    try {
      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1920, height: 1080 });

      // Load the HTML template
      await page.setContent(template, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for Redoc to initialize and render
      await page.waitForFunction(
        () => {
          const redoc = document.getElementById('redoc');
          return redoc && redoc.children.length > 0;
        },
        { timeout: 30000 },
      );

      // Wait additional time for all styles and content to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get all styles from the page (including dynamically injected styled-components styles)
      const pageData = await page.evaluate(() => {
        const styleElements = Array.from(document.querySelectorAll('style'));
        const styles = styleElements
          .map(el => el.innerHTML || el.textContent || '')
          .filter(Boolean);

        return {
          styles: styles.join('\n'),
          html: document.documentElement.outerHTML,
        };
      });

      // Ensure all styles are in the head
      let finalHtml = pageData.html;
      if (pageData.styles) {
        const headEndIndex = finalHtml.indexOf('</head>');
        if (headEndIndex > -1 && !finalHtml.includes(pageData.styles.substring(0, 50))) {
          finalHtml =
            finalHtml.substring(0, headEndIndex) +
            `\n<style>\n${pageData.styles}\n</style>\n` +
            finalHtml.substring(headEndIndex);
        }
      }

      return finalHtml;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Error generating static HTML with Puppeteer:', error);
    throw error;
  }
}
