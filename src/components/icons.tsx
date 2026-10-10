import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
    </Icon>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icon>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />
    </Icon>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
    </Icon>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  )
}

export function TrophyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M9 20h6M10 17h4" />
    </Icon>
  )
}

export function CalendarCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M4 10h16M9.5 15l2 2 3.5-3.5" />
    </Icon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Icon>
  )
}

export function KeyboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M17 14H7" />
    </Icon>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3c1 3.5 6 5.5 6 11a6 6 0 01-12 0c0-3 1.5-4.5 2.5-6 .3 2 1.2 3 2.5 3.3C10.3 8 11 5.5 12 3z" />
    </Icon>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 16l-5-5-8.5 8.5" />
    </Icon>
  )
}

export function MountainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 19l6.5-11 3.5 6 2-3 6 8H3z" />
      <path d="M8 10.5l1.5 1 1.5-1" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M7 11H6a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2h-1" />
    </Icon>
  )
}

export function VolumeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10v4h3l5 4V6L7 10H4z" />
      <path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" />
    </Icon>
  )
}

export function MuteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10v4h3l5 4V6L7 10H4z" />
      <path d="M16 10l4 4M20 10l-4 4" />
    </Icon>
  )
}

export function SunriseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 16a5 5 0 0110 0M3 20h18M12 4v4M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4M2 16h2M20 16h2" />
    </Icon>
  )
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 21h4" />
    </Icon>
  )
}

export function InstallIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 7v7M9 11l3 3 3-3M10 18.5h4" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </Icon>
  )
}

export function WindIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h10a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h7" />
    </Icon>
  )
}

export function RainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 15a4.5 4.5 0 01-.5-9A5.5 5.5 0 0117 7a4 4 0 01.5 8" />
      <path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
    </Icon>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
    </Icon>
  )
}

export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 8L4.5 12.5 9 17" />
      <path d="M4.5 12.5H15a4.5 4.5 0 010 9h-2" />
    </Icon>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 00-2.5-2.5H6A2.5 2.5 0 003.5 6v7A2.5 2.5 0 006 15.5h2.5" />
    </Icon>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6 9v9.5A1.5 1.5 0 007.5 20H10v-5h4v5h2.5a1.5 1.5 0 001.5-1.5V9" />
    </Icon>
  )
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2" />
    </Icon>
  )
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.75" />
      <path d="M5 6v12c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75V6M5 12c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75" />
    </Icon>
  )
}

export function PaletteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.7-1.7h2a4.5 4.5 0 004.5-4.5c0-3.6-4-6.5-9-6.5z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </Icon>
  )
}

export function AppIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <path d="M10.5 17.5h3" />
    </Icon>
  )
}

export function ExternalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 5h5v5M19 5l-8 8M17 14v4a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 015 18V8.5A1.5 1.5 0 016.5 7H10" />
    </Icon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.25v.25" />
    </Icon>
  )
}

export function InboxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 13.5l2.6-7.3A2 2 0 018 4.9h8a2 2 0 011.9 1.3l2.6 7.3v4.5a2 2 0 01-2 2h-13a2 2 0 01-2-2v-4.5z" />
      <path d="M3.5 13.5h4.25l1.5 2.5h5.5l1.5-2.5h4.25" />
    </Icon>
  )
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5l1.5 1.5L8.5 5M4 13.5L5.5 15l3-3M11.5 6.75H20M11.5 13.75H20M11.5 19.75H20M5 19.5h2" />
    </Icon>
  )
}

export function RepeatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 2.5l3 3-3 3M4 11.5v-1a5 5 0 015-5h11M7 21.5l-3-3 3-3M20 12.5v1a5 5 0 01-5 5H4" />
    </Icon>
  )
}

export function ColumnsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.75" y="4" width="5" height="11" rx="1.5" />
      <rect x="16" y="4" width="4.5" height="7" rx="1.5" />
    </Icon>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
      <circle cx="4.5" cy="6.5" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="12" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="17.5" r="0.75" fill="currentColor" />
    </Icon>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Icon>
  )
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5.5A2.5 2.5 0 017.5 3H19v15H7.5A2.5 2.5 0 005 20.5v-15z" />
      <path d="M5 20.5A2.5 2.5 0 017.5 18H19v3H7.5M9 7.5h6" />
    </Icon>
  )
}

export function TimerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M9.5 2.75h5M19 6.5l1.25-1.25" />
    </Icon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" />
    </Icon>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
      <rect x="14" y="5" width="3.5" height="14" rx="1" />
    </Icon>
  )
}

export function SkipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6v12l9-6-9-6zM17.5 6v12" />
    </Icon>
  )
}

export function NoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h8l4 4v13h-12z" />
      <path d="M14.5 3.5v4h4M9.5 12h5M9.5 15.5h5" />
    </Icon>
  )
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6l-1 5.5 3 3V13H7v-1l3-3z" />
      <path d="M12 13v7.5" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </Icon>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
  )
}

export function LibraryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 4.5h3.5v15H4.5zM10 4.5h3.5v15H10z" />
      <path d="m15.4 5.6 3.3-.9 3.1 14-3.3.8z" />
    </Icon>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function HighlighterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 4 5.5 5.5-8 8-5.5-5.5z" />
      <path d="M6.5 12 4 18.5l1.5 1.5L12 17.5M13 20.5h7" />
    </Icon>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function FitWidthIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5v14M20 5v14M8 12h8" />
      <path d="M10.5 9.5 8 12l2.5 2.5M13.5 9.5 16 12l-2.5 2.5" />
    </Icon>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-8l-4.5 3.5v-3.5H5A1.5 1.5 0 013.5 15V7A1.5 1.5 0 015 5.5z" />
      <path d="M8 10h8M8 13h5" />
    </Icon>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  )
}

export function CardsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="8" width="13" height="11.5" rx="2" />
      <path d="M7.5 8V6a2 2 0 012-2h9a2 2 0 012 2v7.5a2 2 0 01-2 2h-2" />
    </Icon>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  )
}

export function QuizIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M9.75 9.75a2.25 2.25 0 113.4 1.95c-.7.4-1.15.9-1.15 1.75" />
      <path d="M12 16.75h.01" />
    </Icon>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8.75A2.25 2.25 0 016.25 6.5h1.6l1.3-1.9a1.5 1.5 0 011.24-.6h3.22a1.5 1.5 0 011.24.6l1.3 1.9h1.6A2.25 2.25 0 0120 8.75v8A2.25 2.25 0 0117.75 19H6.25A2.25 2.25 0 014 16.75z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </Icon>
  )
}

export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  )
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7" />
    </Icon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6l-6 6 6 6" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </Icon>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="15" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="9" cy="12" r="0.9" fill="currentColor" />
      <circle cx="15" cy="12" r="0.9" fill="currentColor" />
      <circle cx="9" cy="17.5" r="0.9" fill="currentColor" />
      <circle cx="15" cy="17.5" r="0.9" fill="currentColor" />
    </Icon>
  )
}

export function PlanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M7.5 11h5M7.5 15.5h9" />
    </Icon>
  )
}
