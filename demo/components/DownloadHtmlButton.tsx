import * as React from 'react';
import styled from 'styled-components';

interface DownloadHtmlButtonProps {
  specUrl?: string;
  spec?: object;
}

const DownloadButton = styled.button`
  margin-left: 10px;
  padding: 5px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: Roboto, sans-serif;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }

  &:active {
    background-color: #004085;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

export class DownloadHtmlButton extends React.Component<DownloadHtmlButtonProps> {
  handleDownload = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    try {
      // Show loading indicator
      const button = event?.currentTarget as HTMLButtonElement;
      const originalText = button?.textContent || 'Download HTML';
      if (button) {
        button.disabled = true;
        button.textContent = 'Generating...';
      }

      const { specUrl, spec } = this.props;

      // Call SSR API endpoint to generate static HTML
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specUrl, spec }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Get the HTML content from response
      const htmlContent = await response.text();

      // Create a blob and download
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename from spec URL or use default
      const filename = this.getFilename();
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Restore button
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    } catch (error) {
      console.error('Error downloading HTML:', error);
      alert(`Failed to download HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Restore button on error
      const button = event?.currentTarget as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.textContent = 'Download HTML';
      }
    }
  };

  getFilename = (): string => {
    const { specUrl } = this.props;
    if (specUrl) {
      // Extract filename from URL
      const urlParts = specUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        return `redoc-${lastPart.replace(/\.(yaml|yml|json)$/, '')}.html`;
      }
    }
    return 'redoc-documentation.html';
  };

  render() {
    return (
      <DownloadButton
        onClick={this.handleDownload}
        title="Download current API documentation as HTML"
      >
        Download HTML
      </DownloadButton>
    );
  }
}
