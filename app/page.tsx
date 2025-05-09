"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Plus, Download, Upload, ArrowUpRight, Rss, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkWebsiteUpdates } from "@/app/actions"
import { useTheme } from "next-themes"
import Papa from "papaparse"

// Import the components and hooks
import { useUserbase } from "@/lib/userbase"
import { UserMenu } from "@/components/user-menu"
import type { Bookmark } from "@/types/bookmark"
import { AuthDialog } from "@/components/auth-dialog"

// Local storage key for bookmarks
const BOOKMARKS_STORAGE_KEY = "bookmarks_v2" // Changed key to force a reset

// Sample bookmark data
const initialBookmarks: Bookmark[] = [
  {
    id: 1,
    url: "https://nextjs.org/docs",
    lastChecked: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    lastUpdated: null,
    contentHash: "",
    favorite: true,
    saved: false,
    category: "Development",
  },
  {
    id: 2,
    url: "https://react.dev",
    lastChecked: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastUpdated: new Date(Date.now() - 3600000 * 20).toISOString(),
    contentHash: "",
    favorite: true,
    saved: false,
    changeDetected: true,
    changeDescription: "New documentation on React Server Components and updated hooks reference",
    category: "Development",
  },
  {
    id: 3,
    url: "https://vercel.com/blog",
    lastChecked: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastUpdated: new Date(Date.now() - 3600000 * 6).toISOString(),
    contentHash: "",
    favorite: false,
    saved: true,
    changeDetected: true,
    changeDescription: "New post: Introducing v0 - The AI-enabled developer experience",
    excerpt:
      "Today, we're introducing v0, an AI-enabled developer experience that helps you build faster than ever before. v0 combines the power of AI with the familiarity of your existing workflow to help you write better code, faster.",
    category: "News",
  },
]

// Function to clean URL for display
const cleanUrl = (url: string): string => {
  try {
    // Ensure URL has a protocol for parsing
    let validUrl = url
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = "https://" + url
    }

    const urlObj = new URL(validUrl)
    let domain = urlObj.hostname

    // Remove www. prefix if present
    domain = domain.replace(/^www\./, "")

    return domain
  } catch (e) {
    return url
  }
}

// Ensure URL has https:// prefix
const ensureHttps = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    return "https://" + url
  }
  return url
}

// Extract title from URL
const extractTitleFromUrl = (url: string): string => {
  try {
    // Ensure URL has a protocol for parsing
    let validUrl = url
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = "https://" + url
    }

    const urlObj = new URL(validUrl)
    let domain = urlObj.hostname

    // Remove www. prefix if present
    domain = domain.replace(/^www\./, "")

    // Split by dots and get the main domain name
    const parts = domain.split(".")
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1)
    }

    return domain
  } catch (e) {
    return url
  }
}

// Check if URL is an RSS feed
const isRssFeed = (url: string): boolean => {
  return (
    url.includes("/feed") ||
    url.includes(".rss") ||
    url.includes("/rss") ||
    url.includes("atom.xml") ||
    url.includes("/atom") ||
    url.endsWith(".xml")
  )
}

// Load bookmarks from localStorage
function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return initialBookmarks

  try {
    const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY)
    if (!saved) return initialBookmarks

    const parsedBookmarks = JSON.parse(saved)
    console.log(`Loaded ${parsedBookmarks.length} bookmarks from localStorage`)
    return parsedBookmarks
  } catch (error) {
    console.error("Error loading bookmarks from localStorage:", error)
    return initialBookmarks
  }
}

// Save bookmarks to localStorage
function saveBookmarks(bookmarks: Bookmark[]): void {
  if (typeof window === "undefined") return

  try {
    console.log(`Saving ${bookmarks.length} bookmarks to localStorage`)
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks))
  } catch (error) {
    console.error("Error saving bookmarks to localStorage:", error)
  }
}

export default function ReadsNow() {
  // State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [filter, setFilter] = useState<"updated" | "saved">("updated")
  const [isChecking, setIsChecking] = useState(false)
  const [checkingProgress, setCheckingProgress] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editingBookmarkId, setEditingBookmarkId] = useState<number | null>(null)
  const [newBookmark, setNewBookmark] = useState({
    url: "",
    favorite: false,
    category: "",
  })
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [urlError, setUrlError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [importError, setImportError] = useState("")
  const [csvData, setCsvData] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const pullThreshold = 80 // Distance in pixels to trigger refresh
  const startY = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Userbase hooks
  const { user, loading: userLoading } = useUserbase()

  // Load bookmarks from localStorage on initial render
  useEffect(() => {
    const loadedBookmarks = loadBookmarks()
    console.log("Initial load of bookmarks:", loadedBookmarks)
    setBookmarks(loadedBookmarks)
  }, [])

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    if (bookmarks !== initialBookmarks) {
      console.log("Saving bookmarks to localStorage:", bookmarks)
      saveBookmarks(bookmarks)
    }
  }, [bookmarks])

  // Pull to refresh handlers
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull-to-refresh when at the top of the page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY
        setIsPulling(true)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return

      const currentY = e.touches[0].clientY
      const distance = currentY - startY.current

      // Only allow pulling down, not up
      if (distance > 0) {
        // Apply resistance to make the pull feel natural
        const pullWithResistance = Math.min(distance * 0.5, pullThreshold * 1.5)
        setPullDistance(pullWithResistance)

        // Prevent default scrolling behavior when pulling
        if (distance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = () => {
      if (!isPulling) return

      if (pullDistance >= pullThreshold) {
        // Trigger refresh
        setIsRefreshing(true)
        checkForUpdates().then(() => {
          setIsRefreshing(false)
          setPullDistance(0)
          setIsPulling(false)
        })
      } else {
        // Reset without refreshing
        setPullDistance(0)
        setIsPulling(false)
      }
    }

    // Add event listeners
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)

    // Clean up
    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isPulling, pullDistance])

  // Format date in a readable format
  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""

    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays < 30) {
      return `${diffInDays} DAYS AGO`
    } else if (diffInDays < 365) {
      return `${Math.floor(diffInDays / 30)} MONTHS AGO`
    } else {
      return `${Math.floor(diffInDays / 365)} YEARS AGO`
    }
  }

  // Check for updates
  const checkForUpdates = async () => {
    setIsChecking(true)
    setCheckingProgress(0)

    // Set a timeout to reset the UI state if the check takes too long
    const timeoutId = setTimeout(() => {
      console.log("Update check timed out")
      setIsChecking(false)
      setCheckingProgress(0)
    }, 30000) // 30 second timeout

    try {
      const total = bookmarks.length
      let completed = 0
      const updatedBookmarks = [...bookmarks]

      for (let i = 0; i < updatedBookmarks.length; i++) {
        try {
          const bookmark = updatedBookmarks[i]

          // Update the UI to show which bookmark is being checked
          updatedBookmarks[i] = {
            ...bookmark,
            isChecking: true,
          }
          setBookmarks([...updatedBookmarks])

          // Check for updates with error handling
          const result = await checkWebsiteUpdates(bookmark.url, bookmark.contentHash || "").catch((error) => {
            console.error(`Error checking updates for ${bookmark.url}:`, error)
            return {
              contentHash: bookmark.contentHash || "",
              hasChanged: false,
              error: error instanceof Error ? error.message : "Failed to check for updates",
            }
          })

          // Update the bookmark with the results
          updatedBookmarks[i] = {
            ...bookmark,
            lastChecked: new Date().toISOString(),
            contentHash: result.contentHash,
            error: result.error,
            isChecking: false,
            // Only update changeDetected if there's a new change
            changeDetected: result.hasChanged ? true : bookmark.changeDetected,
            // Preserve existing changeDescription if no new changes are detected
            changeDescription: result.hasChanged ? result.changeDescription : bookmark.changeDescription,
            postUrl: result.hasChanged ? result.postUrl : bookmark.postUrl,
            // Preserve existing excerpt if no new changes are detected
            excerpt: result.hasChanged
              ? bookmark.excerpt ||
                `This site has been updated with new content. The changes include ${result.changeDescription || "updates to the website content"}.`
              : bookmark.excerpt,
          }

          if (result.hasChanged) {
            updatedBookmarks[i].lastUpdated = new Date().toISOString()
          }
        } catch (error) {
          console.error(`Error processing bookmark at index ${i}:`, error)
          // Ensure the bookmark is marked as not checking even if there's an error
          if (updatedBookmarks[i]) {
            updatedBookmarks[i].isChecking = false
          }
        }

        completed++
        setCheckingProgress(Math.floor((completed / total) * 100))

        // Update the bookmarks state after each bookmark is processed
        setBookmarks([...updatedBookmarks])

        // Add a small delay between checks to prevent UI freezing
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Clear the timeout since we completed successfully
      clearTimeout(timeoutId)
      return true
    } catch (error) {
      console.error("Error in checkForUpdates:", error)
      return false
    } finally {
      // Always reset the UI state when done, regardless of success or failure
      setIsChecking(false)
      setCheckingProgress(0)
    }
  }

  // Toggle Saved status
  const toggleSaved = (id: number) => {
    console.log(`Toggling saved for bookmark ${id}`)
    setBookmarks((prevBookmarks) => {
      const updatedBookmarks = prevBookmarks.map((bookmark) => {
        if (bookmark.id === id) {
          const newValue = !bookmark.saved
          console.log(`Changed saved status from ${bookmark.saved} to ${newValue}`)
          return { ...bookmark, saved: newValue }
        }
        return bookmark
      })
      return updatedBookmarks
    })
  }

  // Delete a bookmark
  const deleteBookmark = (id: number) => {
    console.log(`Deleting bookmark ${id}`)
    setBookmarks((prevBookmarks) => prevBookmarks.filter((bookmark) => bookmark.id !== id))
  }

  // Open edit dialog
  const openEditDialog = (bookmark: Bookmark) => {
    console.log(`Opening edit dialog for bookmark ${bookmark.id}`)
    setNewBookmark({
      url: bookmark.url,
      favorite: bookmark.favorite,
      category: bookmark.category || "",
    })
    setEditingBookmarkId(bookmark.id)
    setDialogMode("edit")
    setDialogOpen(true)
  }

  // Handle saving a bookmark
  const handleSaveBookmark = () => {
    console.log("Saving bookmark:", newBookmark)
    let hasError = false

    try {
      let url = newBookmark.url
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url
      }

      new URL(url)
      setUrlError("")
      setNewBookmark({ ...newBookmark, url })
    } catch (e) {
      setUrlError("Please enter a valid URL")
      hasError = true
    }

    if (hasError) return

    if (dialogMode === "add") {
      // Generate a new ID that's definitely unique
      const newId = Math.max(0, ...bookmarks.map((b) => b.id)) + 1
      console.log(`Adding new bookmark with ID ${newId}`)

      const bookmark: Bookmark = {
        id: newId,
        url: newBookmark.url,
        lastChecked: new Date().toISOString(),
        lastUpdated: null,
        contentHash: "",
        favorite: newBookmark.favorite,
        saved: false,
        category: newBookmark.category || undefined,
        isRssFeed: isRssFeed(newBookmark.url),
      }

      // Update state with the new bookmark
      setBookmarks((prevBookmarks) => [...prevBookmarks, bookmark])
    } else {
      if (editingBookmarkId !== null) {
        console.log(`Updating bookmark ${editingBookmarkId}`)
        setBookmarks((prevBookmarks) => {
          return prevBookmarks.map((bookmark) =>
            bookmark.id === editingBookmarkId
              ? {
                  ...bookmark,
                  url: newBookmark.url,
                  favorite: newBookmark.favorite,
                  category: newBookmark.category || undefined,
                  isRssFeed: isRssFeed(newBookmark.url),
                }
              : bookmark,
          )
        })
      }
    }

    setNewBookmark({
      url: "",
      favorite: false,
      category: "",
    })
    setEditingBookmarkId(null)
    setDialogMode("add")
    setDialogOpen(false)
  }

  // Export bookmarks
  const exportBookmarks = () => {
    const dataStr = JSON.stringify(bookmarks, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    const exportFileDefaultName = `reads-now-export-${new Date().toISOString().split("T")[0]}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  // Export as CSV
  const exportAsCSV = () => {
    const headers = ["url", "favorite", "category", "changeDescription", "saved"]
    const rows = bookmarks.map((bookmark) => [
      bookmark.url,
      bookmark.favorite ? "true" : "false",
      bookmark.category || "",
      bookmark.changeDescription || "",
      bookmark.saved ? "true" : "false",
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
    const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
    const exportFileDefaultName = `reads-now-export-${new Date().toISOString().split("T")[0]}.csv`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  // Import bookmarks from file
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  // Process file import
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExt = file.name.split(".").pop()?.toLowerCase()

    if (fileExt === "json") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const importedBookmarks = JSON.parse(content) as Bookmark[]

          if (!Array.isArray(importedBookmarks)) {
            throw new Error("Invalid format: Expected an array of bookmarks")
          }

          importedBookmarks.forEach((bookmark) => {
            if (!bookmark.url || typeof bookmark.url !== "string") {
              throw new Error("Invalid bookmark: Missing or invalid URL")
            }
          })

          const maxId = Math.max(0, ...bookmarks.map((b) => b.id))
          const newBookmarks = importedBookmarks.map((bookmark, index) => ({
            ...bookmark,
            id: maxId + index + 1,
            url: ensureHttps(bookmark.url),
            saved: bookmark.saved === true || bookmark.readLater === true,
            readLater: undefined,
          }))

          setBookmarks([...bookmarks, ...newBookmarks])
          setImportDialogOpen(false)
          setImportError("")

          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Failed to import bookmarks")
        }
      }
      reader.readAsText(file)
    } else if (fileExt === "csv") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string

          Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0) {
                throw new Error(`CSV parsing error: ${results.errors[0].message}`)
              }

              const importedData = results.data as Record<string, string>[]

              if (!importedData.length) {
                throw new Error("No data found in CSV file")
              }

              const maxId = Math.max(0, ...bookmarks.map((b) => b.id))
              const newBookmarks = importedData.map((row, index) => {
                if (!row.url) {
                  throw new Error(`Row ${index + 1}: Missing URL`)
                }

                return {
                  id: maxId + index + 1,
                  url: ensureHttps(row.url),
                  lastChecked: new Date().toISOString(),
                  lastUpdated: null,
                  contentHash: "",
                  favorite: row.favorite?.toLowerCase() === "true",
                  saved: row.saved?.toLowerCase() === "true" || row.readLater?.toLowerCase() === "true",
                  category: row.category || undefined,
                  changeDescription: row.changeDescription || undefined,
                } as Bookmark
              })

              setBookmarks([...bookmarks, ...newBookmarks])
              setImportDialogOpen(false)
              setImportError("")

              if (fileInputRef.current) {
                fileInputRef.current.value = ""
              }
            },
          })
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Failed to import CSV")
        }
      }
      reader.readAsText(file)
    } else {
      setImportError("Unsupported file format. Please use JSON or CSV files.")
    }
  }

  // Import from CSV text
  const handleImportCSV = () => {
    try {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            throw new Error(`CSV parsing error: ${results.errors[0].message}`)
          }

          const importedData = results.data as Record<string, string>[]

          if (!importedData.length) {
            throw new Error("No data found in CSV data")
          }

          const maxId = Math.max(0, ...bookmarks.map((b) => b.id))
          const newBookmarks = importedData.map((row, index) => {
            if (!row.url) {
              throw new Error(`Row ${index + 1}: Missing URL`)
            }

            return {
              id: maxId + index + 1,
              url: ensureHttps(row.url),
              lastChecked: new Date().toISOString(),
              lastUpdated: null,
              contentHash: "",
              favorite: row.favorite?.toLowerCase() === "true",
              saved: row.saved?.toLowerCase() === "true" || row.readLater?.toLowerCase() === "true",
              category: row.category || undefined,
              changeDescription: row.changeDescription || undefined,
            } as Bookmark
          })

          setBookmarks([...bookmarks, ...newBookmarks])
          setImportDialogOpen(false)
          setImportError("")
          setCsvData("")
        },
      })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import CSV")
    }
  }

  // Filter bookmarks
  const filteredBookmarks = useMemo(() => {
    let filtered = bookmarks

    // Apply main filter
    if (filter === "updated") {
      // Show all bookmarks in the updated view
    } else if (filter === "saved") {
      filtered = filtered.filter((bookmark) => bookmark.saved)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((bookmark) => {
        const url = bookmark.url.toLowerCase()
        const domain = cleanUrl(bookmark.url).toLowerCase()
        const title = extractTitleFromUrl(bookmark.url).toLowerCase()
        const category = (bookmark.category || "").toLowerCase()
        const description = (bookmark.changeDescription || "").toLowerCase()
        return (
          url.includes(query) ||
          domain.includes(query) ||
          title.includes(query) ||
          category.includes(query) ||
          description.includes(query)
        )
      })
    }

    // Sort bookmarks
    return filtered.sort((a, b) => {
      // Always prioritize items with updates
      const aHasUpdate = a.changeDetected && a.lastUpdated !== null
      const bHasUpdate = b.changeDetected && b.lastUpdated !== null

      if (aHasUpdate && !bHasUpdate) return -1
      if (!aHasUpdate && bHasUpdate) return 1

      // For Saved view, sort by most recently added to Saved
      if (filter === "saved") {
        // Since we don't track when items were added to Saved,
        // use lastUpdated or lastChecked as a proxy
        const aDate = a.lastUpdated ? new Date(a.lastUpdated).getTime() : new Date(a.lastChecked).getTime()
        const bDate = b.lastUpdated ? new Date(b.lastUpdated).getTime() : new Date(a.lastChecked).getTime()
        return bDate - aDate
      }

      // For other views, sort by lastUpdated date
      if (a.lastUpdated && b.lastUpdated) {
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      }

      if (a.lastUpdated && !b.lastUpdated) return -1
      if (!a.lastUpdated && b.lastUpdated) return 1

      return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime()
    })
  }, [bookmarks, filter, searchQuery])

  // Update document title based on current filter
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (filter === "updated") {
        document.title = "Latest | Reads.now"
      } else if (filter === "saved") {
        document.title = "Saved | Reads.now"
      } else {
        document.title = "Reads.now"
      }
    }
  }, [filter])

  // Determine if we should show the welcome message or the feed
  const showWelcomeMessage = !user // Always show welcome message if not signed in
  const isSavedView = filter === "saved"

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Progress bar for checking */}
      {isChecking && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gray-100 dark:bg-gray-900">
          <div
            className="h-full bg-black dark:bg-white transition-all duration-300 ease-in-out"
            style={{ width: `${checkingProgress}%` }}
          ></div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-black py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg width="20" height="20" viewBox="0 0 43 42" className="mr-2" fill="currentColor">
                <g transform="matrix(3.61815e-17,0.590889,-0.737625,4.51665e-17,154.429,7822.54)">
                  <g transform="matrix(1,0,0,1,0,-3)">
                    <rect x="-13238.6" y="155.043" width="70.959" height="25.698" />
                  </g>
                  <g transform="matrix(1,0,0,1,0,28.6175)">
                    <rect x="-13238.6" y="155.043" width="70.959" height="25.698" />
                  </g>
                </g>
              </svg>
              <h1 className="text-base font-medium uppercase tracking-wide">Reads.now</h1>
            </div>

            <div className="flex items-center space-x-3">
              {user ? (
                // Logged in header
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      console.log("Opening add dialog")
                      setDialogMode("add")
                      setNewBookmark({
                        url: "",
                        favorite: false,
                        category: "",
                      })
                      setDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkForUpdates}
                    disabled={isChecking}
                    className="h-8 font-mono text-xs"
                  >
                    {isChecking ? "CHECKING" : "CHECK"}
                  </Button>
                  <UserMenu
                    onAuthSuccess={() => {
                      window.location.reload()
                    }}
                  />
                </>
              ) : (
                // Not logged in header - only show sign in/up buttons
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAuthDialogOpen(true)}
                    className="h-8 font-mono text-xs"
                  >
                    SIGN IN
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAuthDialogOpen(true)
                    }}
                    className="h-8 font-mono text-xs"
                  >
                    SIGN UP
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Dialog */}
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onAuthSuccess={() => {
          window.location.reload()
        }}
        initialTab="signin"
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Add New Read" : "Edit Read"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "add"
                ? "Enter the URL of the website you want to bookmark."
                : "Edit the details of this bookmark."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="url-input">URL</Label>
              <Input
                id="url-input"
                value={newBookmark.url}
                onChange={(e) => setNewBookmark({ ...newBookmark, url: e.target.value })}
                placeholder="example.com"
              />
              {urlError && <p className="text-sm text-red-500">{urlError}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-input">Category (optional)</Label>
              <Input
                id="category-input"
                value={newBookmark.category}
                onChange={(e) => setNewBookmark({ ...newBookmark, category: e.target.value })}
                placeholder="e.g., Development, News, Design"
              />
            </div>
          </div>
          <DialogFooter>
            {dialogMode === "edit" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (editingBookmarkId !== null) {
                    deleteBookmark(editingBookmarkId)
                    setDialogOpen(false)
                  }
                }}
              >
                DELETE
              </Button>
            )}
            <Button type="submit" onClick={handleSaveBookmark}>
              {dialogMode === "add" ? "ADD" : "SAVE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user && (
        <div className="container max-w-3xl mx-auto px-4 mt-4">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 mb-4">
            <div className="flex space-x-2 mb-2 md:mb-0 md:mr-4 w-full md:w-auto">
              <Button
                variant={filter === "updated" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("updated")}
                className="text-xs font-mono"
              >
                LATEST
              </Button>
              <Button
                variant={filter === "saved" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("saved")}
                className="text-xs font-mono"
              >
                SAVED
              </Button>
            </div>
            <div className="relative flex-grow w-full">
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full pl-8"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {user && <div className="border-t border-gray-200 dark:border-gray-800"></div>}

      {/* Pull to refresh indicator */}
      {isPulling && pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-white dark:bg-black z-30 transition-all"
          style={{ height: `${pullDistance}px` }}
        >
          <RefreshCw
            className={`h-6 w-6 text-gray-500 dark:text-gray-400 transition-transform ${
              pullDistance >= pullThreshold ? "text-black dark:text-white" : ""
            }`}
            style={{
              transform: `rotate(${(pullDistance / pullThreshold) * 360}deg)`,
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div ref={contentRef} className={`relative ${pullDistance > 0 ? `mt-[${pullDistance}px]` : ""}`}>
        {showWelcomeMessage ? (
          <main className="container max-w-3xl mx-auto px-4">
            <div className="text-center py-12 mt-12">
              <h2 className="text-xl font-medium mb-4">Welcome to Reads.now</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                A simple bookmark manager that checks for updates on your favorite websites. Track changes, save
                articles for later, and never miss important updates.
              </p>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Sign in to sync your bookmarks across devices.</p>
              <Button variant="default" onClick={() => setAuthDialogOpen(true)} className="mr-2">
                SIGN IN
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAuthDialogOpen(true)
                }}
              >
                SIGN UP
              </Button>
            </div>
          </main>
        ) : user && bookmarks.length === 0 ? (
          <main className="container max-w-3xl mx-auto px-4">
            <div className="text-center py-12 mt-12">
              <h2 className="text-xl font-medium mb-4">Welcome to Reads.now</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Your bookmarks will sync across devices. Add your first bookmark to get started.
              </p>
              <Button
                variant="default"
                className="z-10 relative"
                onClick={() => {
                  setDialogMode("add")
                  setNewBookmark({
                    url: "",
                    favorite: false,
                    category: "",
                  })
                  setDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                ADD URL
              </Button>
            </div>
          </main>
        ) : user && filteredBookmarks.length > 0 ? (
          <main className="container max-w-3xl mx-auto px-4">
            <div className="space-y-8 my-8">
              {filteredBookmarks.map((bookmark) => {
                const domain = cleanUrl(bookmark.url)
                const date = bookmark.lastUpdated ? formatDate(bookmark.lastUpdated) : formatDate(bookmark.lastChecked)
                const displayTitle = bookmark.changeDescription || extractTitleFromUrl(bookmark.url)
                const hasError = bookmark.error !== undefined
                const linkUrl = bookmark.isRssFeed && bookmark.postUrl ? bookmark.postUrl : ensureHttps(bookmark.url)
                const isSavedView = filter === "saved"
                const hasExcerpt = bookmark.excerpt && bookmark.changeDetected

                return (
                  <div key={bookmark.id} className="group pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center mb-2">
                      {bookmark.isRssFeed && <Rss className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />}
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group-hover:opacity-90 transition-opacity"
                      >
                        <h3 className="text-xl font-medium flex items-center">
                          {displayTitle}
                          <ArrowUpRight className="h-4 w-4 ml-1 inline opacity-50" />
                        </h3>
                      </a>
                    </div>

                    {bookmark.isChecking && (
                      <div className="mt-2 mb-3 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                        <span>Checking for updates...</span>
                      </div>
                    )}

                    {/* Excerpt section */}
                    {hasExcerpt && (
                      <div className="mt-2 mb-3">
                        <div className="text-sm font-mono text-gray-700 dark:text-gray-300">{bookmark.excerpt}</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 mb-2">
                      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-mono">
                        <span>{date}</span>
                        <span>—</span>
                        <span>{domain}</span>

                        {!isSavedView && (
                          <>
                            <span>—</span>
                            <button
                              onClick={() => openEditDialog(bookmark)}
                              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white text-xs underline uppercase"
                            >
                              EDIT
                            </button>
                            <span>—</span>
                            <button
                              onClick={() => toggleSaved(bookmark.id)}
                              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white text-xs underline uppercase"
                            >
                              {bookmark.saved ? "SAVED" : "SAVE"}
                            </button>
                          </>
                        )}

                        {isSavedView && (
                          <>
                            <span>—</span>
                            <button
                              onClick={() => toggleSaved(bookmark.id)}
                              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white text-xs underline uppercase"
                            >
                              REMOVE
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {hasError && (
                      <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        <p>Error checking site: {bookmark.error}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </main>
        ) : user ? (
          <main className="container max-w-3xl mx-auto px-4">
            <div className="space-y-8 my-8">
              {filter === "saved" && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No saved items</p>
                </div>
              )}
              {filter !== "saved" && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-6">No bookmarks found</p>
                  <Button
                    variant="default"
                    className="z-10 relative"
                    onClick={() => {
                      setDialogMode("add")
                      setNewBookmark({
                        url: "",
                        favorite: false,
                        category: "",
                      })
                      setDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    ADD URL
                  </Button>
                </div>
              )}
            </div>
          </main>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-12">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xs font-medium uppercase tracking-wide mb-2">Reads.now</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md font-mono">
                A simple bookmark manager that checks for updates.
              </p>
            </div>

            {user && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide mb-2">Import/Export</h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={exportBookmarks}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center"
                    >
                      <Download className="h-3 w-3 mr-2" />
                      EXPORT AS JSON
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={exportAsCSV}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center"
                    >
                      <Download className="h-3 w-3 mr-2" />
                      EXPORT AS CSV
                    </button>
                  </li>
                  <li>
                    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                      <DialogTrigger asChild>
                        <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center">
                          <Upload className="h-3 w-3 mr-2" />
                          IMPORT BOOKMARKS
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Import Bookmarks</DialogTitle>
                          <DialogDescription>
                            Import bookmarks from a file or paste CSV data directly.
                          </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="file" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="file">FROM FILE</TabsTrigger>
                            <TabsTrigger value="csv">PASTE CSV</TabsTrigger>
                          </TabsList>
                          <TabsContent value="file" className="py-4">
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept=".json,.csv"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            {importError && <p className="text-sm text-red-500 mb-4">{importError}</p>}
                            <Button onClick={handleImportClick} className="w-full">
                              SELECT FILE (JSON OR CSV)
                            </Button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              CSV should have columns: url, favorite, category, changeDescription
                            </p>
                          </TabsContent>

                          <TabsContent value="csv" className="py-4">
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="csv-data">Paste CSV Data</Label>
                                <Textarea
                                  id="csv-data"
                                  placeholder="url,favorite,category,changeDescription
example.com,true,News,New blog post on AI
github.com,false,Development,Updated documentation"
                                  value={csvData}
                                  onChange={(e) => setCsvData(e.target.value)}
                                  className="min-h-[150px]"
                                />
                                {importError && <p className="text-sm text-red-500">{importError}</p>}
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  CSV should have columns: url, favorite, category, changeDescription
                                </p>
                              </div>
                              <Button onClick={handleImportCSV} className="w-full">
                                IMPORT CSV DATA
                              </Button>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} Reads.now</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
