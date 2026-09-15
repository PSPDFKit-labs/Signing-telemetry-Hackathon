import { ImageIcon } from '@/components/icons';

type FileTypeIcon = {
  icon?: React.ComponentType<any>;
  image?: string;
  className?: string;
};

export const extractFileExtension = (url: string | undefined | null): string => {
  if (!url) return '';

  try {
    // Handle both full URLs and file names
    const fileName = url.includes('/') ? url.split('/').pop() : url;
    if (!fileName) return '';

    // Handle timestamp prefixed names
    const nameParts = fileName.split('-');
    const actualFileName = nameParts.length > 1 ? nameParts.slice(1).join('-') : fileName;

    const extension = actualFileName.split('.').pop() || '';
    return extension.toLowerCase();
  } catch (error) {
    console.error('Error extracting file extension:', error);
    return '';
  }
};

export const getFileTypeDisplay = (extension: string): string => {
  const typeMap: { [key: string]: string } = {
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    tiff: 'Image',
    tif: 'Image',
    'application/pdf': 'PDF Document',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'image/jpeg': 'Image',
    'image/png': 'Image',
    'image/tiff': 'Image',
  };

  const displayType = typeMap[extension.toLowerCase()] || 'File';
  return displayType;
};

export const getFileTypeIcon = (type: string): FileTypeIcon => {
  switch (type) {
    case 'PDF Document':
      return {
        image: '/file-icons/pdf.svg',
        className: 'h-4 w-4',
      };
    case 'Word Document':
      return {
        image: '/file-icons/word.svg',
        className: 'h-4 w-4',
      };
    case 'Excel Spreadsheet':
      return {
        image: '/file-icons/excel.svg',
        className: 'h-4 w-4',
      };
    case 'PowerPoint':
      return {
        image: '/file-icons/powerpoint.svg',
        className: 'h-4 w-4',
      };
    case 'Image':
      return {
        icon: ImageIcon,
        className: 'h-4 w-4 text-current',
      };
    default:
      return {
        image: '/file-icons/file.svg',
        className: 'h-4 w-4',
      };
  }
};
