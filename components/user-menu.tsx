"use client"

import { useUserbase } from "@/lib/userbase"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut } from "lucide-react"
import { useState } from "react"
import { AuthDialog } from "./auth-dialog"
import { AccountSettingsDialog } from "./account-settings-dialog"

interface UserMenuProps {
  onAuthSuccess?: () => void
}

export function UserMenu({ onAuthSuccess }: UserMenuProps) {
  const { user, loading, signOut } = useUserbase()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  // Show a loading state while Userbase is initializing
  if (loading) {
    return (
      <Button variant="ghost" size="sm" className="h-8" disabled>
        <span className="text-xs">Loading...</span>
      </Button>
    )
  }

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)}>
          SIGN IN
        </Button>
        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onAuthSuccess={() => {
            if (onAuthSuccess) onAuthSuccess()
            // Force a page refresh after successful login
            window.location.reload()
          }}
        />
      </>
    )
  }

  // Update the UserMenu component to handle sign out better
  const handleSignOut = async () => {
    try {
      await signOut()
      // Force a complete page refresh after sign out to clear any stale state
      window.location.href = window.location.href
    } catch (error) {
      console.error("Error signing out:", error)
      // Force reload even if there's an error
      window.location.reload()
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>Account</span>
              <span className="text-xs text-muted-foreground">{user.username}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
            <span>ACCOUNT SETTINGS</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>SIGN OUT</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </>
  )
}
