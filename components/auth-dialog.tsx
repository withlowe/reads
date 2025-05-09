"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUserbase } from "@/lib/userbase"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthSuccess?: () => void
  initialTab?: "signin" | "signup"
}

export function AuthDialog({ open, onOpenChange, onAuthSuccess, initialTab = "signin" }: AuthDialogProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(initialTab)

  const { signIn, signUp } = useUserbase()

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
    } else {
      setUsername("")
      setPassword("")
      setAuthError(null)
    }
  }, [open, initialTab])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setIsLoading(true)

    try {
      if (activeTab === "signin") {
        await signIn(username, password, "local")
      } else {
        await signUp(username, password, "local")
      }

      setIsLoading(false)
      onOpenChange(false)

      // Call onAuthSuccess and allow time for state to update
      if (onAuthSuccess) {
        setTimeout(() => {
          onAuthSuccess()
        }, 100)
      }
    } catch (err: any) {
      setIsLoading(false)
      setAuthError(err.message || "Authentication failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{activeTab === "signin" ? "Sign in to Reads.now" : "Create an account"}</DialogTitle>
          <DialogDescription>
            {activeTab === "signin"
              ? "Sign in to sync your bookmarks across devices."
              : "Create an account to save and sync your bookmarks."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "signin" | "signup")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">SIGN IN</TabsTrigger>
            <TabsTrigger value="signup">SIGN UP</TabsTrigger>
          </TabsList>

          <form onSubmit={handleAuth}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  autoComplete={activeTab === "signin" ? "username" : "new-username"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={activeTab === "signin" ? "current-password" : "new-password"}
                />
              </div>

              {authError && <div className="text-sm text-red-500 mt-2">{authError}</div>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {activeTab === "signin" ? "SIGN IN" : "SIGN UP"}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
