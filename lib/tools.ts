import type { IconName } from '@/components/Icon';

export interface ToolInfo {
  slug: string;
  name: string;
  description: string;
  icon: IconName;
  /** All current tools support multi-upload + ZIP download. */
  batch: boolean;
}

export const TOOLS: ToolInfo[] = [
  {
    slug: 'vectorize',
    name: 'Image to Vector',
    description: 'Trace logos, icons, and illustrations into clean, scalable SVG vectors.',
    icon: 'vector',
    batch: true,
  },
  {
    slug: 'upscale',
    name: 'Image Upscaler',
    description: 'Enlarge images 2x, 4x, or more with high-quality resampling — right in your browser.',
    icon: 'upscale',
    batch: true,
  },
  {
    slug: 'remove-background',
    name: 'Background Remover',
    description: 'Erase backgrounds with an in-browser AI model. Transparent PNG, solid color, or a custom backdrop.',
    icon: 'bg',
    batch: true,
  },
  {
    slug: 'resize',
    name: 'Image Resizer',
    description: 'Resize by pixels or percentage, with presets for Instagram, YouTube, Facebook, and more.',
    icon: 'resize',
    batch: true,
  },
  {
    slug: 'compress',
    name: 'Image Compressor',
    description: 'Shrink file sizes dramatically while keeping visual quality — see exactly how much you save.',
    icon: 'compress',
    batch: true,
  },
  {
    slug: 'convert',
    name: 'Image Converter',
    description: 'Convert between JPG, PNG, and WebP in any direction, one file or a whole batch.',
    icon: 'convert',
    batch: true,
  },
];

export const toolHref = (slug: string) => `/tools/${slug}`;
