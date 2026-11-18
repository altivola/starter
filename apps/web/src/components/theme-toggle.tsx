import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { currentTheme, setTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const [theme, setState] = useState<Theme>(currentTheme)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        setTheme(next)
        setState(next)
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
