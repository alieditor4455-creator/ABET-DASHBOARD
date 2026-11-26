import {
  House, WandSparkles, Palette, Folder, SquareKanban, Calendar, Layers, Plug, Shield, Search, Bell, Plus, Menu, X,
  Moon, Sun, ChevronLeft, ChevronRight, ChevronDown, ChevronsLeft, ArrowUpRight, ArrowRight, ArrowLeft, Clapperboard,
  SquarePlay, Presentation, Shapes, Image, GalleryHorizontal, FileImage, Megaphone, FileText, Check, CircleCheck, CircleX,
  TriangleAlert, Info, Clock, PenLine, RefreshCw, Sparkles, BookOpen, Users, Target, Send, Download, Upload, Eye, Archive,
  Repeat, Ellipsis, List, Cpu, Cloud, Film, Key, HardDrive, UserPlus, Lock, Zap, LoaderCircle, Type, LayoutGrid, AtSign,
  Copy, LogOut, Mail, ExternalLink, EyeOff, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  home: House, wand: WandSparkles, palette: Palette, folder: Folder, kanban: SquareKanban, calendar: Calendar, brand: Layers,
  plug: Plug, shield: Shield, search: Search, bell: Bell, plus: Plus, menu: Menu, x: X, moon: Moon, sun: Sun,
  chevL: ChevronLeft, chevR: ChevronRight, chevD: ChevronDown, chevsL: ChevronsLeft, arrowUR: ArrowUpRight, arrowR: ArrowRight,
  arrowL: ArrowLeft, clap: Clapperboard, yt: SquarePlay, present: Presentation, shapes: Shapes, image: Image,
  carousel: GalleryHorizontal, poster: FileImage, megaphone: Megaphone, file: FileText, check: Check, checkc: CircleCheck,
  xc: CircleX, alert: TriangleAlert, info: Info, clock: Clock, edit: PenLine, refresh: RefreshCw, sparkles: Sparkles,
  book: BookOpen, users: Users, target: Target, send: Send, download: Download, upload: Upload, eye: Eye, archive: Archive,
  repeat: Repeat, more: Ellipsis, list: List, cpu: Cpu, cloud: Cloud, film: Film, key: Key, drive: HardDrive,
  userplus: UserPlus, lock: Lock, zap: Zap, loader: LoaderCircle, type: Type, grid: LayoutGrid, at: AtSign, copy: Copy,
  logout: LogOut, mail: Mail, external: ExternalLink, eyeoff: EyeOff,
};

export function Icon({ name, size = 18, className, spin }: { name: string; size?: number; className?: string; spin?: boolean }) {
  const C = MAP[name] ?? Info;
  return <C size={size} strokeWidth={1.7} aria-hidden="true" className={[className, spin ? 'spin' : ''].filter(Boolean).join(' ') || undefined} />;
}
