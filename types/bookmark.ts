export interface Bookmark {
  id: number
  url: string
  lastChecked: string
  lastUpdated: string | null
  contentHash?: string
  favorite: boolean
  saved?: boolean
  readLater?: boolean // Kept for backward compatibility
  error?: string
  changeDetected?: boolean
  category?: string
  changeDescription?: string
  isRssFeed?: boolean
  isChecking?: boolean // Added to track checking status per bookmark
  postUrl?: string
  excerpt?: string // Added excerpt field to store content changes
}
