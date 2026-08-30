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

/** Phase 2 additions — same privacy rules, same workspace system. */
export const TOOLS_PHASE2: ToolInfo[] = [
  {
    slug: 'watermark',
    name: 'Watermark Tool',
    description: 'Text or logo watermarks on single images or big batches — position, size, opacity, rotation.',
    icon: 'image',
    batch: true,
  },
  {
    slug: 'rotate',
    name: 'Rotate & Flip',
    description: 'Rotate 90° or any custom angle, flip horizontally or vertically, with corner fill options.',
    icon: 'refresh',
    batch: true,
  },
  {
    slug: 'editor',
    name: 'Basic Editor',
    description: 'Brightness, contrast, saturation, sharpness, blur, grayscale, sepia, and opacity in real time.',
    icon: 'image',
    batch: true,
  },
  {
    slug: 'crop',
    name: 'Crop Tool',
    description: 'Free-form or fixed-ratio cropping with drag-to-resize, zoom, and rule-of-thirds guides.',
    icon: 'crop',
    batch: false,
  },
  {
    slug: 'transparency',
    name: 'Transparency Tools',
    description: 'Opacity control, color-to-transparent, white-background removal, and a manual eraser brush.',
    icon: 'bg',
    batch: true,
  },
  {
    slug: 'metadata',
    name: 'Metadata Tool',
    description: 'Inspect EXIF camera data and GPS, then download a cleaned, metadata-free copy.',
    icon: 'info',
    batch: false,
  },
  {
    slug: 'colors',
    name: 'Color Tools',
    description: 'Click to pick any pixel\u2019s HEX/RGB and generate a ready-to-copy color palette from any image.',
    icon: 'drop',
    batch: false,
  },
];
