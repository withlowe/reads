import type { Bookmark } from "@/types/bookmark"

// Local storage key for bookmarks
const BOOKMARKS_STORAGE_KEY = "bookmarks"
// Local storage key for visited sites
const VISITED_SITES_STORAGE_KEY = "visited_sites"

// Improve the loadBookmarks function to ensure data is properly loaded
export function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return []

  try {
    const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY)
    if (!saved) return []

    const parsedBookmarks = JSON.parse(saved)
    console.log(`Loaded ${parsedBookmarks.length} bookmarks from localStorage`)

    // Ensure all bookmarks have the required properties
    return parsedBookmarks.map((bookmark: any) => ({
      ...bookmark,
      id: bookmark.id || Math.floor(Math.random() * 10000),
      saved: bookmark.saved === true || bookmark.readLater === true,
      lastChecked: bookmark.lastChecked || new Date().toISOString(),
    }))
  } catch (error) {
    console.error("Error loading bookmarks from localStorage:", error)
    return []
  }
}

// Improve the saveBookmarks function to ensure data is properly saved
export function saveBookmarks(bookmarks: Bookmark[]): void {
  if (typeof window === "undefined") return

  try {
    console.log(`Saving ${bookmarks.length} bookmarks to localStorage`)
    const bookmarksToSave = bookmarks.map((bookmark) => ({
      ...bookmark,
      // Ensure saved property is properly set
      saved: bookmark.saved === true,
    }))
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarksToSave))
  } catch (error) {
    console.error("Error saving bookmarks to localStorage:", error)
  }
}

// Add a site to visited sites
export function addVisitedSite(url: string): void {
  if (typeof window === "undefined") return

  try {
    const visitedSites = getVisitedSites()
    if (!visitedSites.includes(url)) {
      visitedSites.push(url)
      localStorage.setItem(VISITED_SITES_STORAGE_KEY, JSON.stringify(visitedSites))
    }
  } catch (error) {
    console.error("Error adding visited site to localStorage:", error)
  }
}

// Get all visited sites
export function getVisitedSites(): string[] {
  if (typeof window === "undefined") return []

  try {
    const saved = localStorage.getItem(VISITED_SITES_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error("Error loading visited sites from localStorage:", error)
    return []
  }
}

// Check if a site has been visited
export function hasVisitedSite(url: string): boolean {
  return getVisitedSites().includes(url)
}

// Sync bookmarks with Userbase if available
export async function syncBookmarksWithUserbase(
  bookmarks: Bookmark[],
  userbaseItems: any[],
  updateUserbaseItem: (id: string, item: any) => Promise<void>,
  insertUserbaseItem: (item: any) => Promise<void>,
): Promise<Bookmark[]> {
  try {
    // If no Userbase items, just return the local bookmarks
    if (!userbaseItems || userbaseItems.length === 0) {
      console.log("No Userbase items found, using local bookmarks")
      return bookmarks
    }

    // Verify userbaseItems is an array
    if (!Array.isArray(userbaseItems)) {
      console.error("Invalid Userbase items format:", userbaseItems)
      return bookmarks
    }

    // Convert Userbase items to bookmarks with defensive checks
    const userbaseBookmarks = userbaseItems
      .filter((item) => item && item.item && item.itemId) // Filter out invalid items
      .map((item) => ({
        ...item.item,
        id: Number.parseInt(item.itemId),
      })) as Bookmark[]

    // Merge local and Userbase bookmarks
    // For simplicity, we'll just use the Userbase bookmarks if they exist
    return userbaseBookmarks
  } catch (error) {
    console.error("Error syncing with Userbase:", error)
    // Return local bookmarks if sync fails
    return bookmarks
  }
}
